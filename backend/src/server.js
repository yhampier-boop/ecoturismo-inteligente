import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID,randomBytes } from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {countries, searchWorld} from './places.js';
import {rateLimit} from './rateLimit.js';
import {adminRouter} from './admin.js';
import {listNotices} from './adminDatabase.js';
import {newResetToken, resetHash, validResetToken, mailConfigured, sendResetEmail} from './passwordReset.js';
import { getDestinations, getDestination, readTrip, listTrips, writeTrip, findUserByEmail, findUserById, createUser, removeTrip, closeDatabase, ensureExternalCity, externalDestinationId, storePasswordReset, discardPasswordReset, consumePasswordReset } from './database.js';
import { getRoute, getWeather, getPhotos, integrationStatus, isValidCoordinate, normalizeCoordinates, trackPhotoDownload, countryDisplayName } from './integrations.js';

export const app = express();
const PORT = Number(process.env.PORT || 4000);
if(process.env.NODE_ENV==='production'&&(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32))throw new Error('Configura JWT_SECRET privado de al menos 32 caracteres antes de publicar.');
// En desarrollo sin .env se permite trabajar, pero nunca con un secreto conocido.
const SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
app.disable('x-powered-by');
const configuredOrigins=(process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:4173').split(',').map(value=>value.trim()).filter(Boolean);
app.use(cors({origin(origin,callback){
 if(!origin||configuredOrigins.includes(origin)||(!process.env.CLIENT_URL&&/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))return callback(null,true);
 return callback(new Error('Origen no permitido por CORS.'));
}}));
app.use(express.json({limit:'100kb'}));
app.use('/api', (_req,res,next) => {res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next();});
app.use(['/api/auth/login','/api/auth/register'], rateLimit({limit:30}));
app.use(['/api/places','/api/destinations','/api/photos','/api/weather','/api/routes'], rateLimit({limit:180,windowMs:60_000}));

// Express 4 no captura promesas rechazadas: este envoltorio las envía al
// manejador de errores en lugar de dejar la petición colgada.
const route = handler => (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next);

const fail = (res,status,message) => res.status(status).json({error:message});
const auth = route(async (req,res,next) => {
 const token=(req.headers.authorization || '').replace(/^Bearer\s+/i,'');
 if(!token) return fail(res,401,'Inicia sesión para continuar.');
 try {req.user=jwt.verify(token,SECRET);}catch{return fail(res,401,'Tu sesión ha expirado. Vuelve a ingresar.');}
 if(req.user.purpose&&req.user.purpose!=='user')return fail(res,401,'Usa una sesión de viajero para este acceso.');
 if(typeof req.user.id!=='string')return fail(res,401,'Sesión inválida.');
 const u=await findUserById(req.user.id);
 if(!u)return fail(res,401,'Tu sesión ha expirado. Vuelve a ingresar.');
 if(Number(u.is_active)!==1)return fail(res,403,'La cuenta está desactivada. Contacta al administrador.');
 if(Number(req.user.version||0)!==Number(u.auth_version))return fail(res,401,'Tu sesión ha expirado. Vuelve a ingresar.');
 req.account=u;next();
});
const safeUser = u => ({id:u.id,name:u.name,email:u.email,role:u.role,is_active:Number(u.is_active),created_at:u.created_at});
const tokenFor = u => jwt.sign({id:u.id,email:u.email,version:u.auth_version,purpose:'user'},SECRET,{expiresIn:'7d'});
const dummyHash=await bcrypt.hash(randomUUID(),10);
async function authenticate(email,password) {
 const normalized=String(email||'').trim().toLowerCase();
 const supplied=typeof password==='string'&&password.length<=1000?password:'';
 const account=normalized.length<=254?await findUserByEmail(normalized):null;
 const matches=await bcrypt.compare(supplied,account?.password_hash||dummyHash);
 return account&&matches?account:null;
}
app.use('/api/admin',adminRouter({route,authenticate,safeUser}));
app.get('/api/notices',route(async(_req,res)=>res.json(await listNotices({publishedOnly:true}))));

function normalizePlaceName(value) {
 return String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
}

function localPlaceSuggestion(destination) {
 return {
  id: destination.id, name: destination.name, region: destination.region, country: destination.country,
  category: destination.category, lat: Number(destination.lat), lon: Number(destination.lon),
  external: destination.external, source: destination.provider || 'mysql', saved: true
 };
}

function remotePlaceSuggestion(city) {
 return {
  id: externalDestinationId(city), name: city.name, region: city.region, country: city.country,
  countryCode: city.countryCode, category: 'Ciudad', lat: Number(city.lat), lon: Number(city.lon),
  external: true, source: 'openweather', saved: false
 };
}

// Ordena primero las coincidencias exactas de nombre y las ciudades cuya
// región coincide (por ejemplo, Cajamarca, Cajamarca). MySQL ordena por nombre,
// así que una búsqueda como “Lima” podía dejar delante una región “Tolima”.
function placeRank(place, term) {
 const name=normalizePlaceName(place.name);
 const region=normalizePlaceName(place.region);
 const country=normalizePlaceName(place.country);
 let score=name===term?0:name.startsWith(term)?10:name.includes(term)?20:30;
 if(region===term)score-=3;
 else if(region.startsWith(term))score+=1;
 if(country===term)score-=2;
 return score;
}

function hasWordMatch(value, term) {
 const text=normalizePlaceName(value);
 if(!text||!term)return false;
 let index=text.indexOf(term);
 while(index!==-1){
  if(index===0||!/[a-z0-9]/.test(text[index-1]))return true;
  index=text.indexOf(term,index+1);
 }
 return false;
}

function localPlaceMatches(place, term) {
 return ['name','region','country'].some(key=>hasWordMatch(place[key],term));
}

function rankLocalPlaces(places, query) {
 const term=normalizePlaceName(query);
 return [...places]
  .filter(place=>localPlaceMatches(place,term))
  .sort((a,b)=>placeRank(a,term)-placeRank(b,term));
}

// Une MySQL con la geocodificación mundial sin persistir sugerencias.
// La firma evita guardar coordenadas o metadatos alterados en el navegador.
function mergePlaceSuggestions(local, remote) {
  const places = local.map(localPlaceSuggestion);
 const seenIds = new Set(places.map(place => place.id));
 for (const city of remote) {
  const suggestion = {...remotePlaceSuggestion(city),category:city.category,source:city.provider,proof:jwt.sign({purpose:'place',place:city},SECRET,{expiresIn:'1h'})};
  if (seenIds.has(suggestion.id)) continue;
  const duplicate = places.some(place =>
   place.country === suggestion.country
   && normalizePlaceName(place.name) === normalizePlaceName(suggestion.name)
   && (
    normalizePlaceName(place.region) === normalizePlaceName(suggestion.region)
    || (Math.abs(Number(place.lat) - suggestion.lat) <= 0.05
     && Math.abs(Number(place.lon) - suggestion.lon) <= 0.05)
   )
  );
  if (duplicate) continue;
  seenIds.add(suggestion.id);
  places.push(suggestion);
 }
 return places.slice(0, 8);
}

app.get('/api/health', (_req,res)=>res.json({ok:true,name:'EcoTurismo API',database:'MySQL/MariaDB · phpMyAdmin',integrations:integrationStatus()}));
app.get('/api/integrations/status', (_req,res)=>res.json(integrationStatus()));
app.get('/api/countries', (_req,res)=>res.json({countries}));

app.get('/api/places', route(async (req,res)=>{
 const q=String(req.query.search||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(q.length<2) return res.json({places:[],source:'none'});
 const local=await getDestinations({q,includeExternal:true});
  const {places:remote,message}=await searchWorld(q);
 const places=mergePlaceSuggestions(rankLocalPlaces(local,q),remote);
  return res.json({places,source:remote.length?'world+mysql':(places.length?'mysql':'none'),...(message?{message}:{})});
}));

app.post('/api/destinations/ensure', route(async (req,res)=>{
  let verified;
  try {verified=jwt.verify(req.body?.proof,SECRET);} catch {return fail(res,400,'La sugerencia venció. Busca el destino nuevamente.');}
  if(verified.purpose!=='place') return fail(res,400,'Sugerencia inválida.');
  return res.json({destination:await ensureExternalCity(verified.place)});
}));

app.get('/api/destinations', route(async (req,res)=>{
  const q=String(req.query.search||'').trim().slice(0,80);
  const category=String(req.query.category||'').slice(0,50);
  const country=String(req.query.country||'').slice(0,80);
  const city=String(req.query.city||'').slice(0,160);
  const countryCode=countries.find(item=>item.name===country||item.code===country.toUpperCase())?.code||'';
  const countryName=countryCode?countryDisplayName(countryCode):country;
  let message='';
  const found=[];
  if(q || (countryCode && !city)) {
   const remote=await searchWorld(q||countryName,countryCode);
   message=remote.message;
   for(const place of remote.places) found.push(await ensureExternalCity(place));
  }
  const local=await getDestinations({q,category,country:countryName,city,includeExternal:Boolean(q||country||city||req.query.includeExternal==='1')});
  const combined=[...local,...found.filter(place=>(!category||category==='Todos'||place.category===category)&&(!countryName||place.country===countryName)&&(!city||[place.city,place.name,place.region].includes(city)))];
  const destinations=[...new Map(combined.map(place=>[place.id,place])).values()];
  return res.json({destinations,source:q||country?'world':'catalog',message});
}));

app.get('/api/destinations/:id', route(async (req,res)=>{
 const destination=await getDestination(req.params.id);
 if(!destination) return fail(res,404,'Destino no encontrado.');
 return res.json({destination});
}));

app.post('/api/auth/register', route(async (req,res)=>{
 const name=String(req.body.name||'').trim();
 const email=String(req.body.email||'').trim().toLowerCase();
 const password=String(req.body.password||'');
 if(name.length<2||name.length>120) return fail(res,400,'Ingresa un nombre de 2 a 120 caracteres.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return fail(res,400,'Ingresa un correo válido.');
 if(password.length<8||password.length>100||Buffer.byteLength(password,'utf8')>72) return fail(res,400,'La contraseña debe tener entre 8 y 100 caracteres, sin superar 72 bytes.');
 if(await findUserByEmail(email)) return fail(res,409,'Este correo ya está registrado.');
 const id=randomUUID();
 try {
  const hash=await bcrypt.hash(password,10);
  const u=await createUser({id,name,email,passwordHash:hash});
  return res.status(201).json({user:safeUser(u),token:tokenFor(u)});
 }catch(e){
  if(e.code==='ER_DUP_ENTRY') return fail(res,409,'Este correo ya está registrado.');
   console.error('No se pudo crear la cuenta:',e.code||e.name);
  return fail(res,500,'No se pudo crear la cuenta.');
 }
}));
app.post('/api/auth/login', route(async (req,res)=>{
 const u=await authenticate(req.body?.email,req.body?.password);
 if(!u)return fail(res,401,'Correo o contraseña incorrectos.');
 if(Number(u.is_active)!==1)return fail(res,403,'La cuenta está desactivada. Contacta al administrador.');
 return res.json({user:safeUser(u),token:tokenFor(u)});
}));
app.get('/api/auth/me', auth, route(async (req,res)=>{
  return res.json({user:safeUser(req.account),sessionType:'user'});
}));

app.post('/api/auth/forgot-password', rateLimit({limit:5}), route(async (req,res)=>{
 const email=String(req.body?.email||'').trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return fail(res,400,'Ingresa un correo válido.');
 if(!mailConfigured()) return fail(res,503,'El envío de correo no está configurado. Contacta al administrador.');
 const user=await findUserByEmail(email);
 let reset=null;
 if(user&&Number(user.is_active)===1){
  reset=newResetToken();
  if(!await storePasswordReset(user.id,reset.hash,reset.expiresAt))reset=null;
 }
 // No esperar al SMTP para responder: su latencia no debe revelar si existe la cuenta.
 res.status(202).json({message:'Si existe una cuenta con ese correo, recibirás un enlace válido por 30 minutos. Revisa también tu carpeta de spam.'});
 if(reset){
  try {await sendResetEmail(email,reset.token);}
  catch {
   try {await discardPasswordReset(reset.hash);}catch {/* No escribir tokens ni errores SMTP completos en registros. */}
   console.error('Recuperación: SMTP no pudo entregar el mensaje. Revisa su configuración.');
  }
 }
}));

app.post('/api/auth/reset-password', rateLimit({limit:10}), route(async (req,res)=>{
 const {token,password}=req.body||{};
 if(!validResetToken(token)) return fail(res,400,'El enlace no es válido o ha vencido. Solicita uno nuevo.');
 if(typeof password!=='string'||password.length<8||password.length>100||Buffer.byteLength(password,'utf8')>72) return fail(res,400,'Usa entre 8 y 100 caracteres, sin superar 72 bytes.');
 const hash=await bcrypt.hash(password,10);
 if(!await consumePasswordReset(resetHash(token),hash)) return fail(res,400,'El enlace no es válido o ha vencido. Solicita uno nuevo.');
 // auth_version se comprueba en MySQL en cada acceso administrativo; invalida
 // también sesiones que ya estaban abiertas antes de restablecer la contraseña.
 return res.json({message:'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'});
}));

function validDate(value) {
 if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const [year, month, day] = value.split('-').map(Number);
 const date = new Date(Date.UTC(year, month - 1, day));
 return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
async function validateTrip(payload){
 const {title,startDate,endDate,mode,stops}=payload||{};
 if(typeof title!=='string'||title.trim().length<3||title.trim().length>160) return 'El título debe tener entre 3 y 160 caracteres.';
  if(!validDate(startDate)||!validDate(endDate)) return 'Selecciona fechas válidas.';
 if(startDate>endDate) return 'La fecha final no puede ser anterior a la inicial.';
  if(!['driving','walking','cycling','flight'].includes(mode)) return 'Selecciona un transporte válido.';
 if(!Array.isArray(stops)||stops.length<1||stops.length>10) return 'El itinerario requiere entre 1 y 10 paradas.';
 for(const stop of stops){
  if(!stop||!stop.destination_id||!await getDestination(stop.destination_id)) return 'Hay un destino que no existe.';
   if(stop.visit_date && (!validDate(stop.visit_date)||stop.visit_date<startDate||stop.visit_date>endDate)) return 'La fecha de una parada está fuera del viaje.';
   if(stop.duration_min != null && (!Number.isInteger(Number(stop.duration_min)) || Number(stop.duration_min) < 1 || Number(stop.duration_min) > 1_440)) return 'La duración de una parada debe estar entre 1 y 1440 minutos.';
   if(stop.notes != null && (typeof stop.notes !== 'string' || stop.notes.length > 500)) return 'Las notas de una parada no pueden superar 500 caracteres.';
 }
  return null;
}
async function calculateTripRoute(stops, mode) {
 if (stops.length < 2) return { source: 'not-required', demo: false, totalKm: 0, totalMinutes: 0, geometry: null, segments: [] };
 const coordinates = [];
 for (const stop of stops) {
  const destination = await getDestination(stop.destination_id);
  coordinates.push([destination.lon, destination.lat]);
 }
 return getRoute({ coordinates, mode });
}
app.get('/api/trips', auth, route(async (req,res)=>res.json({trips:await listTrips(req.user.id)})));
app.post('/api/trips', auth, route(async (req,res)=>{
 const error=await validateTrip(req.body);if(error)return fail(res,400,error);
 try{
   const {title,startDate,endDate,mode,stops}=req.body;
   const route=await calculateTripRoute(stops,mode);
   return res.status(201).json({trip:await writeTrip({userId:req.user.id,title:title.trim(),startDate,endDate,mode,stops,route})});
  }catch(e){console.error(e);return fail(res,500,'No se pudo guardar el itinerario.');}
}));
app.get('/api/trips/:id', auth, route(async (req,res)=>{
 const trip=await readTrip(req.params.id,req.user.id);
 if(!trip)return fail(res,404,'Viaje no encontrado.');
 return res.json({trip});
}));
app.put('/api/trips/:id', auth, route(async (req,res)=>{
 if(!await readTrip(req.params.id,req.user.id))return fail(res,404,'Viaje no encontrado.');
 const error=await validateTrip(req.body);if(error)return fail(res,400,error);
 try{
   const {title,startDate,endDate,mode,stops}=req.body;
   const route=await calculateTripRoute(stops,mode);
   const trip=await writeTrip({id:req.params.id,userId:req.user.id,title:title.trim(),startDate,endDate,mode,stops,route});
   return res.json({trip});
  }catch(e){console.error(e);return fail(res,500,'No se pudo actualizar el itinerario.');}
}));
app.post('/api/trips/:id/duplicate', auth, route(async (req,res)=>{
 const prev=await readTrip(req.params.id,req.user.id);
 if(!prev)return fail(res,404,'Viaje no encontrado.');
  const trip=await writeTrip({userId:req.user.id,title:`Copia de ${prev.title}`.slice(0,160),startDate:prev.start_date,endDate:prev.end_date,mode:prev.transport_mode,
   route:{source:prev.route_source,demo:prev.segments.some(s=>Boolean(s.is_demo)),geometry:prev.route_geometry,totalKm:prev.route_total_km,totalMinutes:prev.route_total_minutes,segments:prev.segments.map(s=>({distanceKm:s.estimated_distance_km,durationMinutes:s.estimated_minutes,demo:Boolean(s.is_demo)}))},
   stops:prev.stops.map(s=>({destination_id:s.destination_id,visit_date:s.visit_date,duration_min:s.duration_min,notes:s.notes}))});
 return res.status(201).json({trip});
}));
app.delete('/api/trips/:id', auth, route(async (req,res)=>{
 const changes=await removeTrip(req.params.id,req.user.id);
 if(!changes)return fail(res,404,'Viaje no encontrado.');
 return res.status(204).end();
}));

app.post('/api/routes', route(async (req,res)=>{
 const mode=String(req.body?.mode||'');const coordinates=normalizeCoordinates(req.body?.coordinates);
  if(!coordinates||!['driving','walking','cycling','flight'].includes(mode)) return fail(res,400,'Envía entre 2 y 10 coordenadas válidas y un transporte compatible.');
 try{return res.json(await getRoute({coordinates,mode}));}
 catch{return fail(res,502,'No se pudo calcular el recorrido.');}
}));
app.get('/api/weather', route(async (req,res)=>{
 const point={lat:req.query.lat,lon:req.query.lon};
 if(!isValidCoordinate(point))return fail(res,400,'Envía una latitud y longitud válidas.');
 return res.json(await getWeather({lat:Number(point.lat),lon:Number(point.lon)}));
}));
app.get('/api/photos', route(async (req,res)=>{
 const query=String(req.query.query||'').trim().replace(/\s+/g,' ');
 const name=String(req.query.name||'').trim().replace(/\s+/g,' ');
 const region=String(req.query.region||'').trim().replace(/\s+/g,' ');
  const country=String(req.query.country||'').trim().replace(/\s+/g,' ');
  const placeType=['country','city','place','destination'].includes(req.query.type)?req.query.type:'city';
 if(name){
  if(name.length<2||name.length>160||region.length>120||country.length>80)return fail(res,400,'Envía una ciudad de 2 a 160 caracteres con una región y país válidos.');
 }else if(query.length<2||query.length>120){
  return fail(res,400,'Ingresa un destino de 2 a 120 caracteres.');
 }
 const requested=Number(req.query.limit||6);
 const limit=Number.isInteger(requested)?Math.min(Math.max(requested,1),8):6;
  return res.json(await getPhotos({query,name,region,country,placeType,limit}));
}));
app.post('/api/photos/:id/download', route(async (req,res)=>{
 const id=String(req.params.id||'');
 if(!/^[A-Za-z0-9_-]{3,80}$/.test(id))return fail(res,400,'Identificador de foto inválido.');
 try{await trackPhotoDownload(id);return res.status(204).end();}
 catch{return fail(res,502,'No se pudo registrar la descarga en Unsplash.');}
}));

app.use('/api',(req,res)=>fail(res,404,'Endpoint no encontrado.'));
app.use((err,_req,res,_next)=>{
 if(err.type==='entity.parse.failed')return fail(res,400,'El formulario no contiene JSON válido.');
 if(err.type==='entity.too.large')return fail(res,413,'El formulario es demasiado grande.');
 console.error('Error interno:',err.code||err.name);return fail(res,500,'Ocurrió un error interno.');
});
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const server = app.listen(PORT,()=>console.log(`EcoTurismo API lista: http://localhost:${PORT} · Base de datos: MySQL (phpMyAdmin)`));

for (const signal of ['SIGINT','SIGTERM']) {
 process.on(signal, () => {
  server.close(() => closeDatabase().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 3000).unref();
 });
}
}
