import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,getDestinations,getDestination,estimateDistance,writeTrip,readTrip,listTrips,externalDestinationId,isExternalDestinationId} from '../src/database.js';

after(async()=>{ await pool.end(); });

const originalIds=['machu-picchu','cusco','valle-sagrado','arequipa','lago-titicaca','paracas','huaraz','lima'];

test('conserva los ocho destinos originales del catálogo',async()=>{
 const all=await getDestinations();
 assert.ok(all.length>=8);
 for(const id of originalIds){
  const destination=all.find(item=>item.id===id);
  assert.ok(destination,`Falta el destino original ${id}`);
  assert.equal(destination.external,false);
 }
 assert.equal((await getDestination('cusco')).name,'Cusco');
 assert.ok(all.some(x=>x.category==='Naturaleza'));
});
test('genera identificadores externos deterministas y sin duplicados',()=>{
 const madrid={name:'Madrid',region:'Community of Madrid',country:'España',countryCode:'ES',lat:40.4167,lon:-3.7036};
 const madridConTilde={...madrid,name:'Mádrid'};
 const bogotaUsa={name:'Madrid',region:'Iowa',country:'Estados Unidos',countryCode:'US',lat:41.8767,lon:-93.8233};
 assert.equal(externalDestinationId(madrid),externalDestinationId(madridConTilde));
 assert.notEqual(externalDestinationId(madrid),externalDestinationId(bogotaUsa));
 assert.equal(isExternalDestinationId(externalDestinationId(madrid)),true);
 assert.equal(isExternalDestinationId('cusco'),false);
});
test('filtrar el catálogo por categoría',async()=>{
 const a=await getDestinations({category:'Aventura'});
 assert.ok(a.length>=1);
 assert.ok(a.every(x=>x.category==='Aventura'));
});
test('estimación de DEMO explícitamente marcada',async()=>{
 const r=estimateDistance(await getDestination('cusco'),await getDestination('machu-picchu'),'walking');
 assert.ok(r.km>0);assert.ok(r.minutes>0);assert.equal(r.demo,true);
});
test('persistencia de viajes y paradas para un usuario',async()=>{
 const uid=randomUUID();
 await pool.query('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',[uid,'Prueba','test-'+uid+'@example.test','hash-prueba']);
 try{
  const trip=await writeTrip({userId:uid,title:'Viaje de prueba',startDate:'2027-02-01',endDate:'2027-02-03',mode:'driving',stops:[
   {destination_id:'cusco',visit_date:'2027-02-01'},
   {destination_id:'machu-picchu',visit_date:'2027-02-02'}
  ]});
  assert.equal(trip.stops.length,2);
  assert.equal(trip.segments.length,1);
  assert.equal((await listTrips(uid)).length,1);
  assert.equal(await readTrip(trip.id,'usuario-ajeno'),null);
 }finally{await pool.query('DELETE FROM users WHERE id=?',[uid])}
});
test('guarda la ruta calculada junto a los tramos del viaje',async()=>{
 const uid=randomUUID();
 await pool.query('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)',[uid,'Prueba','route-'+uid+'@example.test','hash-prueba']);
 try{
  const route={source:'demo',demo:true,totalKm:92.4,totalMinutes:126,geometry:[[-71.9675,-13.5319],[-72.545,-13.1631]],segments:[{distanceKm:92.4,durationMinutes:126}]};
  const trip=await writeTrip({userId:uid,title:'Viaje con ruta',startDate:'2027-03-01',endDate:'2027-03-02',mode:'driving',route,stops:[{destination_id:'cusco'},{destination_id:'machu-picchu'}]});
  assert.equal(trip.route_source,'demo');
  assert.deepEqual(trip.route_geometry,route.geometry);
  assert.equal(trip.segments[0].estimated_distance_km,92.4);
 }finally{await pool.query('DELETE FROM users WHERE id=?',[uid])}
});
