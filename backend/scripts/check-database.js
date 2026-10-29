import 'dotenv/config';
import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';

// Diagnóstico de solo lectura: nunca muestra filas de usuarios, hashes ni tokens.
let connection;
try {
 const caPath=process.env.DB_SSL_CA_PATH?.trim();
 const ssl=caPath?{ca:await readFile(caPath),rejectUnauthorized:true,verifyIdentity:true}:undefined;
 connection=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'ecoturismo_db',...(ssl?{ssl}:{})});
 const [[info]]=await connection.query('SELECT DATABASE() AS database_name,VERSION() AS server_version');console.log(JSON.stringify(info));
 const required=['users','destinations','trips','trip_stops','trip_segments','site_notices','password_reset_tokens'];
 for(const table of required){
  const [[meta]]=await connection.query('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
  if(!meta){console.log(`PENDIENTE: falta ${table}`);process.exitCode=1;continue;}
  const [[count]]=await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  console.log(`${table}: ${count.total} filas; motor ${meta.ENGINE}`);
  if(meta.ENGINE!=='InnoDB')process.exitCode=1;
 }
 const [columns]=await connection.query("SELECT COLUMN_NAME,COLUMN_TYPE,COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME IN ('id','role','is_active')");
 console.log(JSON.stringify({userColumns:columns}));if(columns.length!==3)process.exitCode=1;
 const [foreignKeys]=await connection.query(`SELECT f.TABLE_NAME,f.COLUMN_NAME,f.REFERENCED_TABLE_NAME,f.REFERENCED_COLUMN_NAME,
  a.COLUMN_TYPE AS child_type,b.COLUMN_TYPE AS parent_type,a.COLLATION_NAME AS child_collation,b.COLLATION_NAME AS parent_collation
  FROM information_schema.KEY_COLUMN_USAGE f
  JOIN information_schema.COLUMNS a ON a.TABLE_SCHEMA=f.TABLE_SCHEMA AND a.TABLE_NAME=f.TABLE_NAME AND a.COLUMN_NAME=f.COLUMN_NAME
  JOIN information_schema.COLUMNS b ON b.TABLE_SCHEMA=f.REFERENCED_TABLE_SCHEMA AND b.TABLE_NAME=f.REFERENCED_TABLE_NAME AND b.COLUMN_NAME=f.REFERENCED_COLUMN_NAME
  WHERE f.TABLE_SCHEMA=DATABASE() AND f.REFERENCED_TABLE_NAME IS NOT NULL`);
 console.log(JSON.stringify({foreignKeys}));
 if(foreignKeys.some(f=>f.child_type!==f.parent_type||f.child_collation!==f.parent_collation))process.exitCode=1;
 for(const [table,column,parent] of [['trips','user_id','users'],['trip_stops','trip_id','trips'],['trip_stops','destination_id','destinations'],['trip_segments','trip_id','trips'],['trip_segments','origin_stop_id','trip_stops'],['trip_segments','destination_stop_id','trip_stops'],['password_reset_tokens','user_id','users']]){
  if(!foreignKeys.some(f=>f.TABLE_NAME===table&&f.COLUMN_NAME===column&&f.REFERENCED_TABLE_NAME===parent)){console.log(`PENDIENTE: FK ${table}.${column} -> ${parent}.id`);process.exitCode=1;}
 }
} catch {
 console.error('No se pudo comprobar MySQL. Revisa DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME y DB_SSL_CA_PATH en backend/.env.');process.exitCode=1;
} finally {if(connection)await connection.end();}
