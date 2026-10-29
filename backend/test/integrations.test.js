import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.OPENROUTESERVICE_API_KEY;
delete process.env.OPENWEATHER_API_KEY;
delete process.env.UNSPLASH_ACCESS_KEY;

const { normalizeCoordinates, getRoute, getWeather, getPhotos, normalizeGeocodeResult, countryDisplayName, searchCities, countryEnglishName, destinationPhotoQueries } = await import('../src/integrations.js');
const {normalizePhoton,searchWorld,tourismQuery}=await import('../src/places.js');

test('valida coordenadas para rutas externas', () => {
  assert.deepEqual(normalizeCoordinates([{ lat: -13.5319, lon: -71.9675 }, { lat: -13.1631, lon: -72.545 }]), [[-71.9675, -13.5319], [-72.545, -13.1631]]);
  assert.equal(normalizeCoordinates([{ lat: 100, lon: 0 }, { lat: 0, lon: 0 }]), null);
});

test('normaliza ciudades de OpenWeather sin inventar datos', () => {
  const tokyo = normalizeGeocodeResult({ name: 'Tokyo', local_names: { es: 'Tokio' }, country: 'JP', lat: 35.6768601, lon: 139.7638947 });
  assert.deepEqual(tokyo, { name: 'Tokio', region: 'Japón', country: 'Japón', countryCode: 'JP', lat: 35.6768601, lon: 139.7638947 });
  const bogota = normalizeGeocodeResult({ name: 'Bogota', local_names: { es: 'Bogotá, Distrito Capital' }, country: 'CO', lat: 4.7110053, lon: -74.0720857 });
  assert.equal(bogota.name, 'Bogotá');
  assert.equal(bogota.region, 'Colombia');
  assert.equal(countryDisplayName('ES'), 'España');
  assert.equal(normalizeGeocodeResult({ name: 'Sin coordenadas', country: 'ES' }), null);
});

test('la geocodificación falla de forma explícita sin clave', async () => {
  await assert.rejects(() => searchCities('Madrid'), /no está configurado/i);
});

test('traduce países al inglés y construye consultas útiles para Unsplash', () => {
  assert.equal(countryEnglishName('Perú'), 'Peru');
  assert.equal(countryEnglishName('España'), 'Spain');
  assert.equal(countryEnglishName('Japón'), 'Japan');
  assert.equal(countryEnglishName('Francia'), 'France');
  assert.equal(countryEnglishName('Colombia'), 'Colombia');
  assert.deepEqual(
    destinationPhotoQueries({ name: 'Cajamarca', region: 'Cajamarca', country: 'Perú' }),
    ['Cajamarca city Peru', 'Cajamarca Peru']
  );
  assert.deepEqual(
    destinationPhotoQueries({ name: 'Madrid', region: 'Community of Madrid', country: 'España' }),
    ['Madrid city Spain', 'Madrid Spain']
  );
  assert.deepEqual(
    destinationPhotoQueries({ name: 'Bogotá', region: 'Colombia', country: 'Colombia' }),
    ['Bogota city Colombia', 'Bogota Colombia']
  );
  assert.deepEqual(
    destinationPhotoQueries({ name: 'París', region: 'Ile-de-France', country: 'Francia' }),
    ['Paris city France', 'Paris France']
  );
  assert.deepEqual(destinationPhotoQueries({ name: '  ', region: 'Lima', country: 'Perú' }), []);
});

test('busca fotografías por ciudad y reintenta con variantes antes de usar el respaldo', async () => {
  process.env.UNSPLASH_ACCESS_KEY = 'clave-solo-para-prueba';
  const originalFetch = globalThis.fetch;
  const queries = [];
  globalThis.fetch = async url => {
    const query = new URL(url).searchParams.get('query');
    queries.push(query);
    const results = query === 'Ciudad Ficticia Peru'
      ? [{
          id: 'foto-prueba',
          urls: { regular: 'https://images.unsplash.com/foto-prueba', small: 'https://images.unsplash.com/foto-prueba-small' },
          alt_description: 'Vista de una ciudad',
          user: { name: 'Autora de Prueba', links: { html: 'https://unsplash.com/@prueba' } },
          links: { html: 'https://unsplash.com/photos/foto-prueba' }
        }]
      : [];
    return new Response(JSON.stringify({ results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const first = await getPhotos({ name: 'Ciudad Ficticia', region: 'Región de Prueba', country: 'Perú', limit: 4 });
    const second = await getPhotos({ name: 'Ciudad Ficticia', region: 'Región de Prueba', country: 'Perú', limit: 4 });
    assert.equal(first.source, 'unsplash');
    assert.equal(first.query, 'Ciudad Ficticia Peru');
    assert.equal(first.photos[0].author, 'Autora de Prueba');
    assert.deepEqual(queries, [
      'Ciudad Ficticia city Peru',
      'Ciudad Ficticia Peru'
    ]);
    assert.deepEqual(second.photos, first.photos);
    assert.equal(queries.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.UNSPLASH_ACCESS_KEY;
  }
});

test('cachea los resultados de geocodificación y evita repetir consultas', async () => {
  process.env.OPENWEATHER_API_KEY = 'clave-solo-para-prueba';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify([
      { name: 'Ciudad Caché', local_names: { es: 'Ciudad Caché' }, state: 'Región de Prueba', country: 'ES', lat: 40.1, lon: -3.1 }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const first = await searchCities('Ciudad Caché');
    const second = await searchCities('Ciudad Caché');
    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    assert.equal(first[0].country, 'España');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENWEATHER_API_KEY;
  }
});

test('usa respaldos explícitos cuando no hay claves externas', async () => {
  const route = await getRoute({ coordinates: [[-71.9675, -13.5319], [-72.545, -13.1631]], mode: 'driving' });
  const weather = await getWeather({ lat: -13.5319, lon: -71.9675 });
  const photos = await getPhotos({ query: 'Cusco Perú', limit: 4 });
  const namedPhotos = await getPhotos({ name: 'Cajamarca', region: 'Cajamarca', country: 'Perú', limit: 4 });
  assert.equal(route.source, 'demo');
  assert.equal(route.demo, true);
  assert.equal(weather.source, 'unavailable');
  assert.equal(weather.current, null);
  assert.equal(photos.source, 'fallback');
  assert.deepEqual(photos.photos, []);
  assert.equal(namedPhotos.source, 'fallback');
  assert.deepEqual(namedPhotos.photos, []);
  assert.match(namedPhotos.message, /Cajamarca/);
});

test('avión no consulta proveedores de carreteras ni inventa duración',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No debe consultarse');};
 try {
  const route=await getRoute({mode:'flight',coordinates:[[0,0],[1,0]]});
  assert.equal(route.source,'air-direct');assert.equal(route.totalMinutes,null);
  assert.ok(Math.abs(route.totalKm-111.2)<0.1);assert.equal(route.segments[0].durationMinutes,null);
 } finally {globalThis.fetch=original;}
});

test('normaliza países y lugares turísticos de OSM sin añadir horarios ni precios',()=>{
 const place=normalizePhoton({geometry:{coordinates:[2.2945,48.8584]},properties:{name:'Eiffel Tower',countrycode:'FR',city:'Paris',osm_key:'man_made',osm_value:'tower'}});
 assert.equal(place.country,'Francia');assert.equal(place.placeType,'place');assert.equal(place.city,'Paris');assert.equal(place.provider,'photon');
 assert.equal(place.price,undefined);assert.equal(normalizePhoton({}),null);
 assert.deepEqual(destinationPhotoQueries({name:'Francia',country:'Francia',placeType:'country'}),['France']);
 assert.deepEqual(destinationPhotoQueries({name:'Eiffel Tower',country:'Francia',placeType:'place'}),['Eiffel Tower France']);
 assert.equal(tourismQuery('Torre Eiffel'),'Eiffel tower');
 assert.equal(tourismQuery('Museo del Louvre'),'Louvre museum');
 assert.equal(tourismQuery('Cusco'),'Cusco');
});

test('búsqueda mundial aplica filtro de país y reutiliza la caché',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({features:[
  {geometry:{coordinates:[2,48]},properties:{name:'Lugar prueba',countrycode:'FR',osm_key:'tourism',osm_value:'attraction'}},
  {geometry:{coordinates:[3,49]},properties:{name:'Otro',countrycode:'ES',osm_key:'tourism',osm_value:'attraction'}}
 ]}),{status:200});};
 try {
  const result=await searchWorld('Lugar prueba','FR');
  assert.equal(result.places.length,1);assert.equal(result.places[0].country,'Francia');
  await searchWorld('Lugar prueba','FR');assert.equal(calls,1);
 } finally {globalThis.fetch=original;}
});

test('respuestas vacías/incompletas de clima y rutas no se presentan como reales',async()=>{
 process.env.OPENWEATHER_API_KEY='solo-prueba';process.env.OPENROUTESERVICE_API_KEY='solo-prueba';
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:200});
 try {
  const weather=await getWeather({lat:1,lon:2});assert.equal(weather.source,'unavailable');assert.equal(weather.current,null);
  const route=await getRoute({mode:'walking',coordinates:[[1,2],[1.1,2.1]]});assert.equal(route.demo,true);
 } finally {globalThis.fetch=original;delete process.env.OPENWEATHER_API_KEY;delete process.env.OPENROUTESERVICE_API_KEY;}
});

test('cuota 429 produce mensaje claro y evita llamadas repetidas al proveedor',async()=>{
 process.env.UNSPLASH_ACCESS_KEY='solo-prueba';const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('{}',{status:429,headers:{'Retry-After':'60'}});};
 try {
  const photos=await getPhotos({query:'Prueba de cuota uno'});
  assert.equal(photos.source,'fallback');assert.match(photos.message,/límite/);
  await getPhotos({query:'Prueba de cuota dos'});assert.equal(calls,1);
 } finally {globalThis.fetch=original;delete process.env.UNSPLASH_ACCESS_KEY;}
});
