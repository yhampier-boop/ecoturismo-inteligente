import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

let sequence=0;
const schemaBoundary=new Error('Inicio del esquema (no se ejecuta DDL en estas pruebas).');

// Solo dobles de MySQL: nunca conecta ni modifica una base real.
async function bootstrap(t,env={},connectionError=null) {
 const defaults={DB_HOST:'127.0.0.1',DB_PORT:'3306',DB_USER:'root',DB_PASSWORD:'',DB_NAME:'ecoturismo_db',DB_SSL_CA_PATH:'',DB_SKIP_CREATE:'false'};
 const original=Object.fromEntries(Object.keys(defaults).map(key=>[key,process.env[key]]));
 Object.assign(process.env,defaults,env);
 t.after(()=>{
  for(const [key,value] of Object.entries(original)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 });
 const events=[],configs=[];
 t.mock.method(mysql,'createConnection',async config=>{
  events.push('admin.connect');configs.push(config);
  return {query:async sql=>events.push(sql),end:async()=>events.push('admin.end')};
 });
 t.mock.method(mysql,'createPool',config=>{
  events.push('pool.create');configs.push(config);
  return {
   query:async sql=>{
    events.push(sql);
    if(sql==='SELECT 1'){
     if(connectionError)throw connectionError;
     return [[{'1':1}]];
    }
    throw schemaBoundary;
   },
   end:async()=>events.push('pool.end')
  };
 });
 let error;
 try {await import(`../src/database.js?connection-test=${++sequence}`);}
 catch(caught){error=caught;}
 return {events,configs,error};
}

test('XAMPP conserva valores por defecto, creación y conexión previa al esquema',async t=>{
 const {events,configs,error}=await bootstrap(t);
 assert.equal(error,schemaBoundary);
 assert.equal(configs[0].host,'127.0.0.1');assert.equal(configs[0].port,3306);
 assert.equal(configs[0].user,'root');assert.equal(configs[0].password,'');
 assert.equal(configs[0].ssl,undefined);
 assert.equal(configs[1].database,'ecoturismo_db');
 assert.match(events[1],/^CREATE DATABASE IF NOT EXISTS `ecoturismo_db`/);
 assert.equal(events[2],'admin.end');
 assert.equal(events[4],'SELECT 1');
 assert.match(events[5],/^\s*CREATE TABLE IF NOT EXISTS users/);
});

test('DB_SKIP_CREATE=true omite por completo la conexión administrativa y CREATE DATABASE',async t=>{
 const {events,configs,error}=await bootstrap(t,{DB_SKIP_CREATE:'true'});
 assert.equal(error,schemaBoundary);
 assert.deepEqual(events.slice(0,2),['pool.create','SELECT 1']);
 assert.equal(events.some(event=>/CREATE DATABASE|admin\./.test(event)),false);
 assert.equal(configs.length,1);assert.equal(configs[0].database,'ecoturismo_db');
});

test('lee el CA desde disco y verifica certificado e identidad en ambas conexiones',async t=>{
 // Archivo de texto existente: el doble no negocia TLS ni necesita un certificado real.
 const path=fileURLToPath(new URL('../package.json',import.meta.url));
 const {configs,error}=await bootstrap(t,{DB_HOST:'mysql.example.test',DB_PORT:'25060',DB_USER:'eco_test',DB_NAME:'eco_test',DB_SSL_CA_PATH:path});
 assert.equal(error,schemaBoundary);
 for(const config of configs){
  assert.deepEqual(config.ssl.ca,await readFile(path));
  assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.verifyIdentity,true);
  assert.equal(config.host,'mysql.example.test');assert.equal(config.port,25060);assert.equal(config.user,'eco_test');
 }
});

test('Aiven usa SSL también cuando omite la creación de la base',async t=>{
 const path=fileURLToPath(new URL('../package.json',import.meta.url));
 const {configs,events,error}=await bootstrap(t,{DB_SKIP_CREATE:'true',DB_SSL_CA_PATH:path});
 assert.equal(error,schemaBoundary);assert.equal(configs.length,1);
 assert.equal(configs[0].ssl.rejectUnauthorized,true);assert.equal(configs[0].ssl.verifyIdentity,true);
 assert.equal(events.includes('admin.connect'),false);
});

test('CA inaccesible detiene el arranque sin conectar ni degradar a texto plano',async t=>{
 const {events,error}=await bootstrap(t,{DB_SSL_CA_PATH:fileURLToPath(new URL('./ca-inexistente/ca.pem',import.meta.url))});
 assert.match(error.message,/DB_SSL_CA_PATH/);assert.deepEqual(events,[]);
});

for(const code of ['ER_BAD_DB_ERROR','ER_ACCESS_DENIED_ERROR','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID']){
 test(`${code}: cierra el pool y no inicializa tablas ni migraciones`,async t=>{
  const {events,error}=await bootstrap(t,{DB_SKIP_CREATE:'true'},new Error(code));
  assert.match(error.message,/No se pudo acceder a la base/);assert.ok(error.message.includes(code));
  assert.deepEqual(events,['pool.create','SELECT 1','pool.end']);
 });
}
