const ROUTE_PROFILES = {
  driving: 'driving-car',
  walking: 'foot-walking',
  cycling: 'cycling-regular'
};

const caches = new Map();
const CACHE_TTL = { route: 10 * 60_000, weather: 10 * 60_000, photos: 30 * 60_000, geocode: 24 * 60 * 60_000 };
// La cuenta gratuita de OpenWeather permite 60 consultas por minuto. La cola
// espacia las llamadas reales para no agotar ese límite al escribir rápido.
const GEOCODE_MIN_INTERVAL = 1_100;
let geocodeQueue = Promise.resolve();
let lastGeocodeRequest = 0;
let pendingGeocodes = 0;

export function cache(key, ttl, load) {
  for (const [key, entry] of caches) if (entry.expiresAt <= Date.now()) caches.delete(key);
  const previous = caches.get(key);
  if (previous && previous.expiresAt > Date.now()) return previous.value;
  const value = Promise.resolve().then(load).catch(error => {
    caches.delete(key);
    throw error;
  });
  caches.set(key, { value, expiresAt: Date.now() + ttl });
  if (caches.size > 500) caches.delete(caches.keys().next().value);
  return value;
}

function publicProviderMessage(status) {
  if (status === 429) return 'El servicio externo alcanzó temporalmente su límite de consultas.';
  if (status === 401 || status === 403) return 'El servicio externo no aceptó su configuración.';
  if (status >= 500) return 'El servicio externo no está disponible en este momento.';
  return 'No fue posible consultar el servicio externo.';
}

const providerCooldowns = new Map();
export async function fetchJson(url, options = {}) {
  const origin = new URL(url).origin;
  if ((providerCooldowns.get(origin) || 0) > Date.now()) throw new Error(publicProviderMessage(429));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      if (response.status === 429) {
        const retry = Number(response.headers.get('retry-after'));
        providerCooldowns.set(origin, Date.now() + Math.min(900, Math.max(60, Number.isFinite(retry) ? retry : 60)) * 1000);
      }
      const error = new Error(publicProviderMessage(response.status));
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new Error('La consulta al servicio externo tardó demasiado.');
      timeout.status = 504;
      throw timeout;
    }
    if (!error.status) throw new Error('No se pudo conectar con el servicio externo.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function isValidCoordinate(point) {
  if (point?.lat == null || point?.lon == null || String(point.lat).trim() === '' || String(point.lon).trim() === '') return false;
  const lat = Number(point?.lat);
  const lon = Number(point?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function normalizeCoordinates(points) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 10 || !points.every(isValidCoordinate)) return null;
  return points.map(({ lat, lon }) => [Number(lon), Number(lat)]);
}

const regionNames = (() => {
  try { return new Intl.DisplayNames(['es'], { type: 'region' }); }
  catch { return null; }
})();

export function countryDisplayName(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '';
  try { return regionNames?.of(normalized) || normalized; }
  catch { return normalized; }
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Unsplash funciona mejor con el nombre del país en inglés. Construimos el
// mapa inverso con Intl.DisplayNames para no depender de una lista manual y
// para que sirva también con países que no están en el catálogo local.
const countryEnglishBySpanish = (() => {
  const map = new Map();
  let spanish;
  let english;
  try {
    spanish = new Intl.DisplayNames(['es'], { type: 'region' });
    english = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return map;
  }
  const ignored = new Set(['unknown region', 'región desconocida', 'regiao desconhecida']);
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      try {
        const spanishName = spanish.of(code);
        const englishName = english.of(code);
        if (!spanishName || !englishName || spanishName === code || englishName === code) continue;
        if (ignored.has(spanishName.toLowerCase()) || ignored.has(englishName.toLowerCase())) continue;
        map.set(normalizeSearchText(spanishName), englishName);
      } catch {}
    }
  }
  return map;
})();

export function countryEnglishName(country) {
  const name = String(country || '').trim();
  if (!name) return '';
  return countryEnglishBySpanish.get(normalizeSearchText(name)) || name;
}

// Genera variantes de búsqueda para Unsplash. Se eliminan los acentos porque
// el buscador de Unsplash no siempre indexa “París” o “Bogotá”, y se prueban
// solo consultas de ciudad + país para evitar resultados de regiones ambiguas.
export function destinationPhotoQueries({ name, region, country, placeType = 'city' }) {
  const plain = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const city = plain(name).slice(0, 160);
  if (!city) return [];
  const countryName = String(country || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const countryEn = plain(countryEnglishName(countryName)).slice(0, 80);
  const same = (a, b) => normalizeSearchText(a) === normalizeSearchText(b);
  const queries = [];
  const add = parts => {
    const query = parts
      .map(part => String(part || '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    if (query && !queries.some(existing => same(existing, query))) queries.push(query);
  };

  if (placeType === 'country') return [countryEn || plain(countryEnglishName(city))];
  if (placeType === 'city' || placeType === 'destination') add([city, 'city', countryEn]);
  add([city, countryEn]);
  return queries.slice(0, 2);
}

// Convierte una respuesta de OpenWeather Geocoding en el formato del catálogo.
// No añade descripciones ni datos turísticos: solo nombre, región, país y
// coordenadas reales devueltas por el proveedor.
export function normalizeGeocodeResult(item) {
  if (!item || !item.name || !isValidCoordinate(item)) return null;
  const countryCode = String(item.country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  const country = countryDisplayName(countryCode);
  const localized = String(item.local_names?.es || '').split(',')[0].trim();
  const name = (localized || String(item.name)).trim().slice(0, 160);
  const region = (String(item.state || '').trim() || country).slice(0, 120);
  if (!name || !region || !country) return null;
  return {
    name,
    region,
    country,
    countryCode,
    lat: Number(item.lat),
    lon: Number(item.lon)
  };
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function enqueueGeocodeRequest(task) {
  if (pendingGeocodes >= 5) return Promise.reject(new Error('La búsqueda de ciudades está ocupada. Inténtalo de nuevo en unos segundos.'));
  pendingGeocodes++;
  const run = geocodeQueue.then(async () => {
    const elapsed = Date.now() - lastGeocodeRequest;
    if (elapsed < GEOCODE_MIN_INTERVAL) await wait(GEOCODE_MIN_INTERVAL - elapsed);
    lastGeocodeRequest = Date.now();
    return task();
  });
  // La cola sigue avanzando aunque una consulta falle.
  const result=run.finally(()=>{pendingGeocodes--;});
  geocodeQueue = result.catch(() => {});
  return result;
}

export async function searchCities(query) {
  const term = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (term.length < 2) return [];
  if (!process.env.OPENWEATHER_API_KEY) {
    const error = new Error('OpenWeather Geocoding no está configurado.');
    error.status = 503;
    throw error;
  }
  const key = `geocode:${term.toLocaleLowerCase('es')}`;
  return cache(key, CACHE_TTL.geocode, async () => {
    const params = new URLSearchParams({ q: term, limit: '5', appid: process.env.OPENWEATHER_API_KEY });
    const body = await enqueueGeocodeRequest(() => fetchJson(`https://api.openweathermap.org/geo/1.0/direct?${params}`));
    if (!Array.isArray(body)) throw new Error('OpenWeather Geocoding devolvió una respuesta incompleta.');
    const seen = new Set();
    return body
      .map(normalizeGeocodeResult)
      .filter(city => {
        if (!city) return false;
        const identity = `${city.countryCode}:${city.name.toLocaleLowerCase('es')}:${city.lat.toFixed(3)}:${city.lon.toFixed(3)}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      })
      .slice(0, 5);
  });
}

function haversineKm([lonA, latA], [lonB, latB]) {
  const radians = value => value * Math.PI / 180;
  const latDiff = radians(latB - latA), lonDiff = radians(lonB - lonA);
  const h = Math.sin(latDiff / 2) ** 2 + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(lonDiff / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
}

function demoRoute(coordinates, mode, message) {
  const speed = { driving: 45, walking: 4.5, cycling: 14 }[mode] || 45;
  const factor = mode === 'driving' ? 1.28 : 1.15;
  const segments = coordinates.slice(0, -1).map((origin, index) => {
    const distanceKm = Number((haversineKm(origin, coordinates[index + 1]) * factor).toFixed(1));
    return { distanceKm, durationMinutes: Math.round(distanceKm / speed * 60), demo: true };
  });
  return {
    source: 'demo', demo: true, message,
    disclaimer: 'Estimación geométrica local para demostración; no representa una ruta vial real.',
    segments,
    totalKm: Number(segments.reduce((total, segment) => total + segment.distanceKm, 0).toFixed(1)),
    totalMinutes: segments.reduce((total, segment) => total + segment.durationMinutes, 0),
    geometry: null
  };
}

export async function getRoute({ coordinates, mode }) {
  if (mode === 'flight') return flightRoute(coordinates);
  const profile = ROUTE_PROFILES[mode];
  if (!profile) throw new Error('Selecciona un transporte válido.');
  if (!process.env.OPENROUTESERVICE_API_KEY) {
    return demoRoute(coordinates, mode, 'OpenRouteService no está configurado. Se muestra una estimación de demostración.');
  }
  const key = `route:${profile}:${JSON.stringify(coordinates)}`;
  try {
    return await cache(key, CACHE_TTL.route, async () => {
      const body = await fetchJson(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
        method: 'POST',
        headers: { Authorization: process.env.OPENROUTESERVICE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates })
      });
      const feature = body?.features?.[0];
      const summary = feature?.properties?.summary;
      if (!Number.isFinite(summary?.distance) || !Number.isFinite(summary?.duration)
        || !Array.isArray(feature.geometry?.coordinates) || feature.geometry.coordinates.length < 2
        || !feature.geometry.coordinates.every(point=>Array.isArray(point)&&isValidCoordinate({lon:point[0],lat:point[1]}))
        || !Array.isArray(feature.properties.segments) || feature.properties.segments.length !== coordinates.length-1
        || !feature.properties.segments.every(segment=>Number.isFinite(segment.distance)&&segment.distance>=0&&Number.isFinite(segment.duration)&&segment.duration>=0)) throw new Error('OpenRouteService devolvió una respuesta incompleta.');
      const segments = (feature.properties.segments || []).map(segment => ({
        distanceKm: Number((Number(segment.distance) / 1000).toFixed(1)),
        durationMinutes: Math.max(1, Math.round(Number(segment.duration) / 60)),
        demo: false
      }));
      return {
        source: 'openrouteservice', demo: false, provider: 'OpenRouteService', profile,
        segments,
        totalKm: Number((Number(summary.distance) / 1000).toFixed(1)),
        totalMinutes: Math.max(1, Math.round(Number(summary.duration) / 60)),
        geometry: feature.geometry.coordinates
      };
    });
  } catch (error) {
    return demoRoute(coordinates, mode, `${error.message} Se muestra una estimación de demostración.`);
  }
}

export function flightRoute(coordinates) {
 const segments = coordinates.slice(0, -1).map((origin, index) => ({
  distanceKm: Number(haversineKm(origin, coordinates[index + 1]).toFixed(1)),
  durationMinutes: null, demo: false
 }));
 return {
  source:'air-direct', demo:false, segments,
  totalKm:Number(segments.reduce((sum, item) => sum + item.distanceKm, 0).toFixed(1)),
  totalMinutes:null, geometry:null,
  message:'Conexiones aéreas orientativas entre destinos; distancia geodésica, no ruta de vuelo. No se verifica la existencia de aeropuertos o vuelos. Sin precios, horarios ni duración: se necesita una API de vuelos.'
 };
}

function rounded(value) { return value != null && Number.isFinite(Number(value)) ? Math.round(Number(value)) : null; }
function weatherIcon(icon) { return icon ? `https://openweathermap.org/img/wn/${encodeURIComponent(icon)}@2x.png` : null; }

export async function getWeather({ lat, lon }) {
  if (!process.env.OPENWEATHER_API_KEY) {
    return { source: 'unavailable', demo: false, current: null, forecast: [], message: 'OpenWeather no está configurado; no se muestran datos meteorológicos de demostración.' };
  }
  const key = `weather:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  try {
    return await cache(key, CACHE_TTL.weather, async () => {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon), units: 'metric', lang: 'es', appid: process.env.OPENWEATHER_API_KEY });
      const [currentBody, forecastBody] = await Promise.all([
        fetchJson(`https://api.openweathermap.org/data/2.5/weather?${params}`),
        fetchJson(`https://api.openweathermap.org/data/2.5/forecast?${params}`)
      ]);
      if (!Number.isFinite(currentBody?.main?.temp) || !Array.isArray(forecastBody?.list) || !forecastBody.list.length) throw new Error('OpenWeather devolvió una respuesta incompleta.');
      const daily = new Map();
      for (const item of forecastBody.list) {
        const date = String(item.dt_txt || '').slice(0, 10);
        if (!date) continue;
        const previous = daily.get(date);
        const hour = Number(String(item.dt_txt || '').slice(11, 13));
        if (!previous || Math.abs(hour - 12) < Math.abs(previous.hour - 12)) daily.set(date, { ...item, hour });
      }
      return {
        source: 'openweather', demo: false, provider: 'OpenWeather',
        current: {
          temperatureC: rounded(currentBody.main.temp), feelsLikeC: rounded(currentBody.main.feels_like),
          description: currentBody.weather?.[0]?.description || 'Sin descripción disponible',
          humidity: rounded(currentBody.main.humidity), windKph: currentBody.wind?.speed == null ? null : rounded(Number(currentBody.wind.speed) * 3.6),
          iconUrl: weatherIcon(currentBody.weather?.[0]?.icon)
        },
        forecast: [...daily.values()].slice(0, 5).map(item => ({
          date: String(item.dt_txt).slice(0, 10), temperatureC: rounded(item.main?.temp),
          description: item.weather?.[0]?.description || 'Sin descripción disponible', iconUrl: weatherIcon(item.weather?.[0]?.icon)
        }))
      };
    });
  } catch (error) {
    return { source: 'unavailable', demo: false, current: null, forecast: [], message: error.message };
  }
}

function withUtm(url) {
  try {
    const link = new URL(url);
    link.searchParams.set('utm_source', 'ecoturismo_inteligente');
    link.searchParams.set('utm_medium', 'referral');
    return link.toString();
  } catch { return 'https://unsplash.com/?utm_source=ecoturismo_inteligente&utm_medium=referral'; }
}

async function unsplashPhotos(query, limit) {
  const params = new URLSearchParams({ query, per_page: String(limit), orientation: 'landscape', content_filter: 'high' });
  const body = await fetchJson(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' }
  });
  if (!Array.isArray(body?.results)) throw new Error('Unsplash devolvió una respuesta incompleta.');
  return body.results.map(photo => ({
    id: photo.id,
    regularUrl: photo.urls?.regular,
    smallUrl: photo.urls?.small || photo.urls?.regular,
    alt: photo.alt_description || photo.description || `Fotografía de ${query}`,
    author: photo.user?.name || 'Autor de Unsplash',
    authorUrl: withUtm(photo.user?.links?.html),
    photoUrl: withUtm(photo.links?.html)
  })).filter(photo => photo.id && photo.regularUrl);
}

export async function getPhotos({ query = '', name = '', region = '', country = '', placeType = 'city', limit = 6 } = {}) {
  const destinationName = String(name || '').trim().replace(/\s+/g, ' ');
  const legacyQuery = String(query || '').trim().replace(/\s+/g, ' ');
  const requested = Number(limit);
  const safeLimit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 8) : 6;
  const candidates = (destinationName
    ? destinationPhotoQueries({ name: destinationName, region, country, placeType })
    : [legacyQuery]
  ).filter(candidate => candidate.length >= 2 && candidate.length <= 160);

  if (!candidates.length) {
    return { source: 'fallback', demo: true, photos: [], message: 'No se pudo construir una búsqueda de fotografías válida.' };
  }
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    return {
      source: 'fallback', demo: true, photos: [],
      message: destinationName
        ? `Unsplash no está configurado; se muestra una imagen de referencia para “${destinationName}”.`
        : 'Unsplash no está configurado; se muestra una imagen de referencia.'
    };
  }

  const identity = destinationName
    ? `destination:${normalizeSearchText(destinationName)}:${normalizeSearchText(region)}:${normalizeSearchText(country)}:${placeType}`
    : `query:${normalizeSearchText(legacyQuery)}`;
  const key = `photos:${identity}:${safeLimit}`;

  try {
    return await cache(key, CACHE_TTL.photos, async () => {
      let lastQuery = candidates[0];
      for (const candidate of candidates) {
        lastQuery = candidate;
        const photos = await unsplashPhotos(candidate, safeLimit);
        if (photos.length) {
          return { source: 'unsplash', demo: false, provider: 'Unsplash', query: candidate, photos };
        }
      }
      return {
        source: 'fallback', demo: true, provider: 'Unsplash', query: lastQuery, photos: [],
        message: destinationName
          ? `Unsplash no devolvió fotografías para “${destinationName}”. Se muestra una imagen de referencia.`
          : `Unsplash no devolvió fotografías para “${lastQuery}”. Se muestra una imagen de referencia.`
      };
    });
  } catch (error) {
    return { source: 'fallback', demo: true, photos: [], message: `${error.message} Se muestra una imagen de referencia.` };
  }
}

export async function trackPhotoDownload(photoId) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return false;
  await fetchJson(`https://api.unsplash.com/photos/${encodeURIComponent(photoId)}/download`, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' }
  });
  return true;
}

export function integrationStatus() {
  return {
    openrouteservice: { enabled: Boolean(process.env.OPENROUTESERVICE_API_KEY), label: process.env.OPENROUTESERVICE_API_KEY ? 'Configurado' : 'Sin configurar' },
    openweather: { enabled: Boolean(process.env.OPENWEATHER_API_KEY), label: process.env.OPENWEATHER_API_KEY ? 'Configurado' : 'Sin configurar' },
    unsplash: { enabled: Boolean(process.env.UNSPLASH_ACCESS_KEY), label: process.env.UNSPLASH_ACCESS_KEY ? 'Configurado' : 'Sin configurar' }
  };
}
