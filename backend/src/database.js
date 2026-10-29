import 'dotenv/config';
import mysql from 'mysql2/promise';
import { createHash, randomUUID } from 'node:crypto';
import {migrate} from './migrations.js';

// Conexión a MariaDB/MySQL de XAMPP. La base se crea sola la primera vez y
// queda disponible en phpMyAdmin (http://localhost/phpmyadmin).
const DB_NAME = process.env.DB_NAME || 'ecoturismo_db';
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME solo puede contener letras, números y guiones bajos.');

const connectionConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  dateStrings: true,
  decimalNumbers: true
};

let admin;
try {
  admin = await mysql.createConnection(connectionConfig);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
} catch (error) {
  throw new Error(`No se pudo conectar a MySQL/MariaDB en ${connectionConfig.host}:${connectionConfig.port}. Inicia MySQL desde el panel de XAMPP y revisa backend/.env. Detalle: ${error.message}`);
} finally {
  if (admin) await admin.end();
}

export const pool = mysql.createPool({
  ...connectionConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
 id CHAR(36) PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 email VARCHAR(254) NOT NULL,
 password_hash TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS destinations (
 id VARCHAR(80) PRIMARY KEY,
 name VARCHAR(160) NOT NULL,
 region VARCHAR(120) NOT NULL,
 country VARCHAR(80) NOT NULL,
 lat DECIMAL(9,6) NOT NULL,
 lon DECIMAL(9,6) NOT NULL,
 category VARCHAR(50) NOT NULL,
 description TEXT NOT NULL,
 duration VARCHAR(50) NOT NULL,
 altitude VARCHAR(50),
 highlights_json LONGTEXT NOT NULL,
 photo_url TEXT NOT NULL,
 featured TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trips (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL,
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 transport_mode VARCHAR(20) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'planificado',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 route_source VARCHAR(20) NOT NULL DEFAULT 'demo',
 route_geometry_json LONGTEXT,
 route_total_km DECIMAL(10,1),
 route_total_minutes INT,
 route_calculated_at TIMESTAMP NULL DEFAULT NULL,
 KEY idx_trip_user (user_id),
 CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT chk_trips_transport_mode CHECK (transport_mode IN ('driving','walking','cycling'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_stops (
 id CHAR(36) PRIMARY KEY,
 trip_id CHAR(36) NOT NULL,
 destination_id VARCHAR(80) NOT NULL,
 position SMALLINT NOT NULL,
 visit_date DATE,
 duration_min INT DEFAULT 120,
 notes TEXT,
 UNIQUE KEY uq_trip_stops_position (trip_id, position),
 KEY idx_stops_trip (trip_id, position),
 KEY idx_stops_destination (destination_id),
 CONSTRAINT fk_stops_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
 CONSTRAINT fk_stops_destination FOREIGN KEY (destination_id) REFERENCES destinations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trip_segments (
 id CHAR(36) PRIMARY KEY,
 trip_id CHAR(36) NOT NULL,
 origin_stop_id CHAR(36) NOT NULL,
 destination_stop_id CHAR(36) NOT NULL,
 position SMALLINT NOT NULL,
 transport_mode VARCHAR(20) NOT NULL,
 estimated_distance_km DECIMAL(10,1),
 estimated_minutes INT,
 is_demo TINYINT(1) NOT NULL DEFAULT 1,
 KEY idx_segments_trip (trip_id),
 KEY idx_segments_origin (origin_stop_id),
 KEY idx_segments_destination (destination_stop_id),
 CONSTRAINT fk_segments_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
 CONSTRAINT fk_segments_origin FOREIGN KEY (origin_stop_id) REFERENCES trip_stops(id) ON DELETE CASCADE,
 CONSTRAINT fk_segments_destination FOREIGN KEY (destination_stop_id) REFERENCES trip_stops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

for (const statement of schemaSql.split(/;\s*\n/).map(value => value.trim()).filter(Boolean)) {
  await pool.query(statement);
}

// Las primeras versiones no almacenaban el resultado del cálculo de ruta.
// La migración es segura para bases ya existentes y para instalaciones nuevas.
async function ensureColumn(table, column, definition) {
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, table, column]
  );
  if (!columns.length) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}
await ensureColumn('trips', 'route_source', "VARCHAR(20) NOT NULL DEFAULT 'demo'");
await ensureColumn('trips', 'route_geometry_json', 'LONGTEXT');
await ensureColumn('trips', 'route_total_km', 'DECIMAL(10,1)');
await ensureColumn('trips', 'route_total_minutes', 'INT');
await ensureColumn('trips', 'route_calculated_at', 'TIMESTAMP NULL DEFAULT NULL');
await migrate(pool, DB_NAME);

// Imágenes de referencia estáticas, NO provienen de la API de Unsplash.
// El navegador muestra la imagen local de respaldo si una foto externa falla.
const d = [
 ['machu-picchu','Machu Picchu','Cusco','Perú',-13.1631,-72.5450,'Cultura','Explora una de las maravillas del mundo, rodeada de montañas y siglos de historia inca.','Día completo','2 430 m',['Ciudadela inca','Paisajes andinos','Patrimonio mundial'],'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1100&q=85',1],
 ['cusco','Cusco','Cusco','Perú',-13.5319,-71.9675,'Cultura','Calles de piedra, arquitectura colonial y una impresionante herencia ancestral.','2–3 días','3 399 m',['Plaza de Armas','Sacsayhuamán','Barrio San Blas'],'https://images.unsplash.com/photo-1531968455001-5c5272a41129?auto=format&fit=crop&w=1100&q=85',1],
 ['valle-sagrado','Valle Sagrado','Cusco','Perú',-13.3200,-72.1000,'Naturaleza','Pueblos tradicionales, terrazas agrícolas y caminos entre los Andes.','1–2 días','2 800 m',['Pisac','Ollantaytambo','Mercados artesanales'],'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1100&q=85',1],
 ['arequipa','Arequipa','Arequipa','Perú',-16.4090,-71.5375,'Ciudad','La ciudad blanca ofrece una mezcla única de volcanes, arquitectura e identidad local.','2–3 días','2 335 m',['Monasterio de Santa Catalina','Plaza de Armas','Miradores'],'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1100&q=85',1],
 ['lago-titicaca','Lago Titicaca','Puno','Perú',-15.8402,-69.3152,'Naturaleza','Un lago de gran altitud donde conviven paisajes serenos y culturas vivas.','Día completo','3 812 m',['Islas flotantes','Comunidad Taquile','Paseos en bote'],'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1100&q=85',0],
 ['paracas','Paracas','Ica','Perú',-13.8350,-76.2500,'Aventura','Acantilados, océano y una reserva de biodiversidad en la costa peruana.','1–2 días','Nivel del mar',['Reserva Nacional','Islas Ballestas','Playas'],'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1100&q=85',0],
 ['huaraz','Huaraz','Áncash','Perú',-9.5280,-77.5280,'Aventura','Puerta de entrada a lagunas turquesas y caminatas por la Cordillera Blanca.','2–4 días','3 052 m',['Laguna 69','Cordillera Blanca','Senderismo'],'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85',0],
 ['lima','Lima','Lima','Perú',-12.0464,-77.0428,'Ciudad','Gastronomía, paseos frente al mar y barrios llenos de cultura.','2–3 días','154 m',['Miraflores','Barranco','Centro histórico'],'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1100&q=85',0]
];
const insert = `INSERT IGNORE INTO destinations
  (id,name,region,country,lat,lon,category,description,duration,altitude,highlights_json,photo_url,featured)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`;
for (const v of d) {
  await pool.query(insert, [...v.slice(0, 10), JSON.stringify(v[10]), v[11], v[12]]);
}

export const formatDest = row => row ? ({
  ...row,
  highlights: JSON.parse(row.highlights_json),
  featured: Boolean(row.featured),
  external: /^(ow-|geo-)/.test(row.id),
  provider: row.provider === 'catalog' && /^ow-/.test(row.id) ? 'openweather' : row.provider,
  highlights_json: undefined
}) : null;

export function isExternalDestinationId(id) {
  return /^(ow-|geo-)/.test(String(id || ''));
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ID determinista: la misma ciudad geocodificada reutiliza la misma fila.
export function externalDestinationId(city) {
  const identity = [String(city.countryCode).toUpperCase(), slugify(city.name), Number(city.lat).toFixed(4), Number(city.lon).toFixed(4), ...(city.provider === 'photon' ? [city.placeType || 'place'] : [])]
    .join(':');
  const hash = createHash('sha1').update(identity).digest('hex').slice(0, 10);
  const slug = slugify(city.name).slice(0, 32) || 'ciudad';
  return `${city.provider === 'photon' ? 'geo' : 'ow'}-${slug}-${hash}`;
}

export async function ensureExternalCity(city) {
  if (!city || !isValidCity(city)) throw new Error('La ciudad externa no tiene datos válidos.');
  const id = externalDestinationId(city);

  const [byId] = await pool.query('SELECT * FROM destinations WHERE id = ? LIMIT 1', [id]);
  if (byId[0]) return formatDest(byId[0]);

  // Evita duplicar una ciudad ya guardada si el proveedor cambia mínimamente
  // las coordenadas o el nombre lleva tilde en una consulta posterior.
  const [nearby] = await pool.query(
    `SELECT * FROM destinations
     WHERE country = ? AND ABS(lat - ?) <= 0.02 AND ABS(lon - ?) <= 0.02`,
    [city.country, city.lat, city.lon]
  );
  const existing = nearby.find(row => slugify(row.name) === slugify(city.name));
  if (existing) return formatDest(existing);

  const provider = city.provider === 'photon' ? 'photon' : 'openweather';
  const description = `Lugar identificado mediante ${provider === 'photon' ? 'Photon / OpenStreetMap' : 'OpenWeather Geocoding'}. No incluye horarios, precios ni información turística verificada.`;
  await pool.query(
    `INSERT IGNORE INTO destinations
     (id,name,region,country,lat,lon,category,description,duration,altitude,highlights_json,photo_url,featured,provider,place_type,country_code,city)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, city.name, city.region, city.country, Number(city.lat), Number(city.lon), city.category || 'Ciudad', description, 'Por definir', null, '[]', '', 0, provider, city.placeType || 'city', city.countryCode, city.city || (provider === 'openweather' ? city.name : null)]
  );
  return getDestination(id);
}

function isValidCity(city) {
  return city.name && city.region && city.country && /^[A-Z]{2}$/.test(String(city.countryCode || ''))
    && Number.isFinite(Number(city.lat)) && Number.isFinite(Number(city.lon))
    && Math.abs(Number(city.lat)) <= 90 && Math.abs(Number(city.lon)) <= 180;
}

export async function getDestinations({ q = '', category = '', country = '', city = '', includeExternal = false } = {}) {
  const where = []; const params = [];
  // Las ciudades geocodificadas solo se incluyen cuando se buscan o cuando el
  // planificador las necesita; el catálogo general conserva sus ocho destinos.
  if (!includeExternal) where.push("id NOT LIKE 'ow-%' AND id NOT LIKE 'geo-%'");
  if (q) {
    where.push('(name LIKE ? OR region LIKE ? OR country LIKE ? OR description LIKE ?)');
    params.push(...Array(4).fill(`%${q}%`));
  }
  if (category && category !== 'Todos') { where.push('category = ?'); params.push(category); }
  if (country && country !== 'Todos') { where.push('country = ?'); params.push(country); }
  if (city && city !== 'Todos') { where.push('(city = ? OR name = ? OR region = ?)'); params.push(city, city, city); }
  const sql = `SELECT * FROM destinations ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY featured DESC, name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows.map(formatDest);
}

export async function getDestination(id) {
  const [rows] = await pool.query('SELECT * FROM destinations WHERE id = ? LIMIT 1', [id]);
  return formatDest(rows[0]);
}

export async function readTrip(id, userId) {
  const [tripRows] = await pool.query('SELECT * FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
  const t = tripRows[0];
  if (!t) return null;
  const [stops] = await pool.query(`SELECT ts.id,ts.destination_id,ts.position,ts.visit_date,ts.duration_min,ts.notes,
   d.name,d.region,d.country,d.lat,d.lon,d.photo_url,d.category FROM trip_stops ts
   JOIN destinations d ON d.id=ts.destination_id WHERE ts.trip_id=? ORDER BY ts.position`, [id]);
  const [segments] = await pool.query('SELECT * FROM trip_segments WHERE trip_id = ? ORDER BY position', [id]);
  let routeGeometry = null;
  try { routeGeometry = t.route_geometry_json ? JSON.parse(t.route_geometry_json) : null; } catch { routeGeometry = null; }
  const { route_geometry_json, ...trip } = t;
  return { ...trip, route_geometry: routeGeometry, stops, segments };
}

export async function listTrips(userId) {
  const [rows] = await pool.query('SELECT id FROM trips WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  return Promise.all(rows.map(({ id }) => readTrip(id, userId)));
}

export async function writeTrip({ id = randomUUID(), userId, title, startDate, endDate, mode, stops, route = null }) {
  const destinationCache = new Map();
  for (const stop of stops) {
    if (!destinationCache.has(stop.destination_id)) destinationCache.set(stop.destination_id, await getDestination(stop.destination_id));
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existsRows] = await conn.query('SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
    if (existsRows.length) {
      await conn.query(`UPDATE trips SET title=?,start_date=?,end_date=?,transport_mode=?,route_source=?,route_geometry_json=?,route_total_km=?,route_total_minutes=?,route_calculated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
        [title, startDate, endDate, mode, route?.source || 'demo', serializeGeometry(route?.geometry), route?.totalKm ?? null, route?.totalMinutes ?? null, id, userId]);
    } else {
      await conn.query(`INSERT INTO trips(id,user_id,title,start_date,end_date,transport_mode,route_source,route_geometry_json,route_total_km,route_total_minutes,route_calculated_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
        [id, userId, title, startDate, endDate, mode, route?.source || 'demo', serializeGeometry(route?.geometry), route?.totalKm ?? null, route?.totalMinutes ?? null]);
    }

    await conn.query('DELETE FROM trip_segments WHERE trip_id = ?', [id]);
    await conn.query('DELETE FROM trip_stops WHERE trip_id = ?', [id]);

    const ids = [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      const sid = randomUUID(); ids.push(sid);
      await conn.query('INSERT INTO trip_stops(id,trip_id,destination_id,position,visit_date,duration_min,notes) VALUES(?,?,?,?,?,?,?)',
        [sid, id, s.destination_id, i, s.visit_date || startDate, Number(s.duration_min) || 120, String(s.notes || '').slice(0, 500)]);
    }

    for (let i = 0; i < ids.length - 1; i++) {
      const origin = destinationCache.get(stops[i].destination_id);
      const dest = destinationCache.get(stops[i + 1].destination_id);
      const fallback = estimateDistance(origin, dest, mode);
      const segment = route?.segments?.[i];
      const distance = segment?.distanceKm == null ? NaN : Number(segment.distanceKm);
      const minutes = segment?.durationMinutes == null ? NaN : Number(segment.durationMinutes);
      const usable = Number.isFinite(distance) && distance >= 0 && Number.isFinite(minutes) && minutes >= 0;
      await conn.query(`INSERT INTO trip_segments
        (id,trip_id,origin_stop_id,destination_stop_id,position,transport_mode,estimated_distance_km,estimated_minutes,is_demo)
        VALUES(?,?,?,?,?,?,?,?,?)`,
        [randomUUID(), id, ids[i], ids[i + 1], i, mode, mode === 'flight' ? (Number.isFinite(distance) ? distance : null) : usable ? distance : fallback.km, mode === 'flight' ? null : usable ? Math.round(minutes) : fallback.minutes, mode === 'flight' ? 0 : usable ? Number(segment?.demo ?? route?.demo ?? false) : 1]);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  return readTrip(id, userId);
}

export async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function createUser({ id, name, email, passwordHash }) {
  // El registro público nunca toma permisos del navegador ni de defaults ajenos.
  await pool.query("INSERT INTO users (id,name,email,password_hash,role,is_active) VALUES(?,?,?,?,'user',1)", [id, name, email, passwordHash]);
  return findUserById(id);
}

export async function storePasswordReset(userId, hash, expiresAt) {
 const conn=await pool.getConnection();
 try {
  await conn.beginTransaction();
  const [[user]]=await conn.query('SELECT id,is_active FROM users WHERE id=? FOR UPDATE',[userId]);
  if(!user||Number(user.is_active)!==1){await conn.rollback();return false;}
  await conn.query('UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL',[userId]);
  const utc=new Date(expiresAt).toISOString().slice(0,19).replace('T',' ');
  await conn.query('INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)',[userId,hash,utc]);
  await conn.commit();return true;
 } catch(error){await conn.rollback();throw error;}
 finally {conn.release();}
}

export async function discardPasswordReset(hash) {
 await pool.query('UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE token_hash=? AND used_at IS NULL', [hash]);
}

export async function consumePasswordReset(hash, passwordHash) {
 const conn = await pool.getConnection();
 try {
  await conn.beginTransaction();
  const [[candidate]]=await conn.query('SELECT user_id FROM password_reset_tokens WHERE token_hash=?',[hash]);
  if(!candidate){await conn.rollback();return false;}
  // Mismo orden de bloqueo que la emisión y la desactivación: usuario, luego token.
  const [[user]]=await conn.query('SELECT id,is_active FROM users WHERE id=? FOR UPDATE',[candidate.user_id]);
  const [[token]]=await conn.query('SELECT id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[hash]);
  if(!user||Number(user.is_active)!==1||!token){await conn.rollback();return false;}
  await conn.query('UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?', [passwordHash,user.id]);
  await conn.query('UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL', [user.id]);
  await conn.commit();
  return true;
 } catch (error) { await conn.rollback(); throw error; }
 finally { conn.release(); }
}

export async function removeTrip(id, userId) {
  const [result] = await pool.query('DELETE FROM trips WHERE id = ? AND user_id = ?', [id, userId]);
  return result.affectedRows;
}

export function closeDatabase() {
  return pool.end();
}

function serializeGeometry(geometry) {
  if (!Array.isArray(geometry)) return null;
  // Evita que una respuesta anómala de un proveedor externo infle la base local.
  const points = geometry.filter(point => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])).slice(0, 10_000);
  return points.length > 1 ? JSON.stringify(points) : null;
}

export function estimateDistance(a, b, mode = 'driving') {
  const toRad = x => x * Math.PI / 180;
  const dl = toRad(b.lat - a.lat), dn = toRad(b.lon - a.lon);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dn / 2) ** 2;
  const direct = 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
  // Cálculo de DEMOSTRACIÓN. No es una ruta real de una API de mapas.
  const km = Number((direct * (mode === 'driving' ? 1.28 : 1.15)).toFixed(1));
  const speed = { driving: 45, walking: 4.5, cycling: 14 }[mode] || 45;
  return { km, minutes: Math.round(km / speed * 60), demo: true };
}
