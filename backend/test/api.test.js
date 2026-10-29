import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SMTPServer} from 'smtp-server';
import {app} from '../src/server.js';
import {pool,storePasswordReset,findUserByEmail} from '../src/database.js';
import {newResetToken} from '../src/passwordReset.js';
import {setTimeout as wait} from 'node:timers/promises';

let server,smtp,base,userId,token;
const email=`api-${randomUUID()}@example.test`;
const messages=[];
async function api(path,{body,auth,method=body?'POST':'GET'}={}){
 const response=await fetch(`${base}/api${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{Authorization:`Bearer ${auth}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=response.status===204?null:await response.json();
 return {status:response.status,data};
}
before(async()=>{
 smtp=new SMTPServer({authOptional:true,disabledCommands:['STARTTLS'],logger:false,onData(stream,_session,callback){
  let raw='';stream.on('data',chunk=>raw+=chunk);stream.on('end',()=>{messages.push(raw.replace(/=\r?\n/g,'').replace(/=([\da-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))));callback();});
 }});
 await new Promise(resolve=>smtp.listen(0,'127.0.0.1',resolve));
 Object.assign(process.env,{SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtp.server.address().port),SMTP_FROM:'EcoTurismo <noreply@example.test>',SMTP_SECURE:'false',CLIENT_URL:'http://localhost:5173'});
 delete process.env.SMTP_USER;delete process.env.SMTP_PASSWORD;delete process.env.SMTP_PASS;
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 if(userId)await pool.query('DELETE FROM users WHERE id=?',[userId]);
 if(server)await new Promise(resolve=>server.close(resolve));
 if(smtp)await new Promise(resolve=>smtp.close(resolve));
 await pool.end();
});

test('registro, acceso y rutas privadas mantienen su contrato',async()=>{
 assert.equal((await api('/trips')).status,401);
 const created=await api('/auth/register',{body:{name:'Prueba API',email,password:'Original-12345'}});
 assert.equal(created.status,201);userId=created.data.user.id;token=created.data.token;
 assert.equal(created.data.user.password_hash,undefined);
 assert.equal((await api('/auth/me',{auth:token})).status,200);
 assert.equal((await api('/auth/login',{body:{email,password:'incorrecta'}})).status,401);
});

test('avión: calcular, guardar, editar, duplicar y eliminar sin duración ni vuelos inventados',async()=>{
 const route=await api('/routes',{body:{mode:'flight',coordinates:[{lat:-12.0464,lon:-77.0428},{lat:-13.5319,lon:-71.9675}]}});
 assert.equal(route.data.source,'air-direct');assert.equal(route.data.totalMinutes,null);assert.ok(route.data.totalKm>0);
 const payload={title:'Vuelo de prueba',startDate:'2027-01-01',endDate:'2027-01-03',mode:'flight',stops:[{destination_id:'lima'},{destination_id:'cusco'}]};
 const saved=await api('/trips',{auth:token,body:payload});
 assert.equal(saved.status,201);const trip=saved.data.trip;
 assert.equal(trip.transport_mode,'flight');assert.equal(trip.route_source,'air-direct');assert.equal(trip.route_total_minutes,null);
 assert.equal(trip.segments[0].estimated_minutes,null);assert.ok(trip.segments[0].estimated_distance_km>0);
 assert.equal((await api(`/trips/${trip.id}`,{auth:token,method:'PUT',body:{...payload,title:'Vuelo actualizado'}})).status,200);
 const copy=await api(`/trips/${trip.id}/duplicate`,{auth:token,method:'POST'});
 assert.equal(copy.status,201);assert.equal(copy.data.trip.route_total_minutes,null);assert.equal(copy.data.trip.segments[0].estimated_minutes,null);
 assert.equal((await api(`/trips/${trip.id}`,{auth:token,method:'DELETE'})).status,204);
 assert.equal((await api(`/trips/${trip.id}`,{auth:token})).status,404);
});

test('validación de formularios, coordenadas vacías y filtros de catálogo',async()=>{
 assert.equal((await api('/weather?lat=&lon=')).status,400);
 assert.equal((await api('/routes',{body:{mode:'flight',coordinates:[{lat:null,lon:0},{lat:0,lon:0}]}})).status,400);
 const list=await api('/destinations?country=Per%C3%BA&category=Cultura&city=Cusco');
 assert.equal(list.status,200);assert.ok(list.data.destinations.length);assert.ok(list.data.destinations.every(d=>d.country==='Perú'&&d.category==='Cultura'));
 const countries=await api('/countries');assert.ok(countries.data.countries.length>=249);
 assert.equal((await api('/destinations/ensure',{body:{name:'No firmado',lat:0,lon:0}})).status,400);
});

test('SMTP sin configurar informa el bloqueo; no expone enlaces ni tokens',async()=>{
 const host=process.env.SMTP_HOST;delete process.env.SMTP_HOST;
 try {const result=await api('/auth/forgot-password',{body:{email}});assert.equal(result.status,503);assert.match(result.data.error,/no está configurado/);}
 finally {process.env.SMTP_HOST=host;}
});

test('sugerencias firmadas conservan proveedor, categoría y coordenadas al añadirlas',async()=>{
 // Respuesta de prueba SOLO para este caso: nunca se usa como dato de producción.
 const original=globalThis.fetch;let destinationId;
 const weatherKey=process.env.OPENWEATHER_API_KEY;delete process.env.OPENWEATHER_API_KEY;
 const query=`Firma-${randomUUID()}`;
 globalThis.fetch=async(url,options)=>String(url).startsWith('https://photon.komoot.io/')
  ?new Response(JSON.stringify({features:[{geometry:{coordinates:[2.1,48.1]},properties:{name:query,countrycode:'FR',city:'Paris',osm_key:'tourism',osm_value:'museum'}}]}),{status:200})
  :original(url,options);
 try {
  const response=await api(`/places?search=${query}`);
  const place=response.data.places[0];assert.ok(place.proof);assert.equal(place.source,'photon');
  const ensured=await api('/destinations/ensure',{body:{proof:place.proof,lat:0,lon:0}});
  assert.equal(ensured.status,200);destinationId=ensured.data.destination.id;
  assert.equal(ensured.data.destination.lat,48.1);assert.equal(ensured.data.destination.category,'Cultura');
  assert.equal(ensured.data.destination.provider,'photon');
  assert.equal((await api('/destinations/ensure',{body:{proof:place.proof+'alterado'}})).status,400);
 } finally {globalThis.fetch=original;if(weatherKey)process.env.OPENWEATHER_API_KEY=weatherKey;if(destinationId)await pool.query('DELETE FROM destinations WHERE id=?',[destinationId]);}
});

test('recuperación envía correo por SMTP local, almacena solo hash y revoca sesiones',async()=>{
 const request=await api('/auth/forgot-password',{body:{email}});
 assert.equal(request.status,202);assert.equal(request.data.token,undefined);
 for(let i=0;i<100&&!messages.length;i++)await wait(20);
 assert.equal(messages.length,1);
 const resetToken=messages[0].match(/#token=([a-f0-9]{64})/)?.[1];
 assert.ok(resetToken,'El SMTP local debe recibir un enlace válido');
 const [[row]]=await pool.query('SELECT * FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL',[userId]);
 assert.notEqual(row.token_hash,resetToken);
 const updated=await api('/auth/reset-password',{body:{token:resetToken,password:'Nueva-clave-12345'}});
 assert.equal(updated.status,200);
 assert.equal((await api('/auth/me',{auth:token})).status,401);
 assert.equal((await api('/auth/login',{body:{email,password:'Original-12345'}})).status,401);
 assert.equal((await api('/auth/login',{body:{email,password:'Nueva-clave-12345'}})).status,200);
 assert.equal((await api('/auth/reset-password',{body:{token:resetToken,password:'Otra-clave-12345'}})).status,400);
 const unknown=await api('/auth/forgot-password',{body:{email:'no-existe@example.test'}});
 assert.deepEqual(unknown,request);
});

test('enlaces vencidos, sustituidos y consumo concurrente de un solo uso',async()=>{
 const expired=newResetToken();await storePasswordReset(userId,expired.hash,Date.now()-1000);
 assert.equal((await api('/auth/reset-password',{body:{token:expired.token,password:'Otra-clave-12345'}})).status,400);
 const previous=newResetToken(),current=newResetToken();
 await storePasswordReset(userId,previous.hash,previous.expiresAt);await storePasswordReset(userId,current.hash,current.expiresAt);
 assert.equal((await api('/auth/reset-password',{body:{token:previous.token,password:'Otra-clave-12345'}})).status,400);
 const results=await Promise.all([1,2].map(()=>api('/auth/reset-password',{body:{token:current.token,password:'Final-clave-12345'}})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
 assert.equal((await findUserByEmail(email)).auth_version,2);
});

test('la recuperación limita solicitudes HTTP y mantiene respuestas neutrales',async()=>{
 const a=await api('/auth/forgot-password',{body:{email:'limite-uno@example.test'}});
 const b=await api('/auth/forgot-password',{body:{email:'limite-dos@example.test'}});
 assert.equal(a.status,202);assert.deepEqual(a,b);
 const response=await fetch(`${base}/api/auth/forgot-password`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'limite-tres@example.test'})});
 assert.equal(response.status,429);assert.ok(Number(response.headers.get('Retry-After'))>0);
 assert.match((await response.json()).error,/Demasiadas consultas/);
});
