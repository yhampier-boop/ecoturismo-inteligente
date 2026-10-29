import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {applySqlMigration} from '../src/migrations.js';

test('migraciones en base nueva y reejecución sin perder usuarios ni viajes',async()=>{
 // Base aislada creada por esta prueba; nunca elimina la base del proyecto.
 const name=`eco_test_${randomUUID().replaceAll('-','')}`;
 const admin=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''});
 try {
  const script=`
   import assert from 'node:assert/strict';
   import {pool,createUser,writeTrip,getDestinations} from './src/database.js';
   import {migrate} from './src/migrations.js';
   const id='00000000-0000-0000-0000-000000000001';
   await createUser({id,name:'Migración',email:'migration@example.test',passwordHash:'solo-prueba'});
   await pool.query("UPDATE destinations SET description='Descripción existente: no sobrescribir' WHERE id='cusco'");
   const trip=await writeTrip({userId:id,title:'Vuelo conservado',startDate:'2027-01-01',endDate:'2027-01-03',mode:'flight',stops:[{destination_id:'lima'},{destination_id:'cusco'}]});
   await migrate(pool,process.env.DB_NAME);
   const [[user]]=await pool.query('SELECT COUNT(*) AS n FROM users');assert.equal(user.n,1);
   const [[saved]]=await pool.query('SELECT COUNT(*) AS n FROM trips');assert.equal(saved.n,1);
   assert.equal(trip.segments[0].estimated_minutes,null);
   assert.equal((await getDestinations()).length,8);
   await pool.end();console.log('migration-ok');
  `;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{env:{...process.env,DB_NAME:name},timeout:30_000});
  assert.match(stdout,/migration-ok/);
  // Un reinicio sobre una base existente tampoco debe reemplazar datos del catálogo.
  const restart=`
   import assert from 'node:assert/strict';
   import {pool} from './src/database.js';
   const [[user]]=await pool.query('SELECT password_hash FROM users WHERE id=?',['00000000-0000-0000-0000-000000000001']);
   assert.equal(user.password_hash,'solo-prueba');
   const [[trip]]=await pool.query('SELECT title FROM trips');assert.equal(trip.title,'Vuelo conservado');
   const [[destination]]=await pool.query("SELECT description FROM destinations WHERE id='cusco'");
   assert.equal(destination.description,'Descripción existente: no sobrescribir');
   await pool.end();
  `;
  await promisify(execFile)(process.execPath,['--input-type=module','-e',restart],{env:{...process.env,DB_NAME:name,DB_SKIP_CREATE:'true'},timeout:30_000});
 } finally {
  await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await admin.end();
 }
});

test('SQL reentrante copia tokens previos y respeta el charset real de users.id sin error de FK',async()=>{
 const name=`eco_test_${randomUUID().replaceAll('-','')}`;
 const conn=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',dateStrings:true});
 try {
  await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await conn.query(`USE \`${name}\``);
  await conn.query(`CREATE TABLE users(id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY, password_hash TEXT NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'user',is_active TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB`);
  const id=randomUUID();await conn.query("INSERT INTO users(id,password_hash,role) VALUES(?,?,'admin')",[id,'hash-original-no-modificar']);
  await conn.query(`CREATE TABLE password_resets(user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,token_hash CHAR(64) UNIQUE NOT NULL,expires_at BIGINT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id)) ENGINE=InnoDB`);
  await conn.query('INSERT INTO password_resets VALUES(?,?,?)',[id,'a'.repeat(64),Date.UTC(2027,0,1)]);
  const sql=await readFile(new URL('../database/migrations/20261028_admin_recovery.sql',import.meta.url),'utf8');
  await applySqlMigration(conn,sql);await applySqlMigration(conn,sql);
  const [[column]]=await conn.query("SELECT CHARACTER_SET_NAME,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='user_id'",[name]);
  assert.equal(column.CHARACTER_SET_NAME,'ascii');assert.equal(column.COLLATION_NAME,'ascii_bin');
  const [[token]]=await conn.query('SELECT COUNT(*) AS n,MIN(expires_at) AS expires FROM password_reset_tokens');assert.equal(token.n,1);assert.equal(token.expires,'2027-01-01 00:00:00');
  const [[legacy]]=await conn.query('SELECT COUNT(*) AS n FROM password_resets');assert.equal(legacy.n,1);
  const [[user]]=await conn.query('SELECT * FROM users WHERE id=?',[id]);assert.equal(user.password_hash,'hash-original-no-modificar');assert.equal(user.role,'admin');assert.equal(user.is_active,1);
  // Un hijo incompatible debe producir un diagnóstico, no cambiar users.id a ciegas.
  await conn.query('DROP TABLE password_reset_tokens');
  await conn.query('CREATE TABLE password_reset_tokens(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,token_hash CHAR(64) UNIQUE,expires_at DATETIME NOT NULL,used_at DATETIME) ENGINE=InnoDB');
  await assert.rejects(()=>applySqlMigration(conn,sql),error=>error.sqlState==='45000'&&/incompatible/.test(error.message));
  const [[parent]]=await conn.query("SELECT COLUMN_TYPE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='id'",[name]);
  assert.equal(parent.COLUMN_TYPE,'char(36)');assert.equal(parent.COLLATION_NAME,'ascii_bin');
 } finally {await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);await conn.end();}
});
