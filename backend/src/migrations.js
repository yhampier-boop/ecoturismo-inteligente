import {readFile} from 'node:fs/promises';

// Ejecuta el mismo SQL importable en phpMyAdmin (incluye DELIMITER para rutinas).
export async function applySqlMigration(connection, sql) {
 let delimiter=';',statement='';
 for(const line of sql.split(/\r?\n/)) {
  const command=line.trim().match(/^DELIMITER\s+(\S+)$/i);
  if(command){delimiter=command[1];continue;}
  if(line.trim().startsWith('--')||!line.trim())continue;
  statement+=line+'\n';
  if(statement.trimEnd().endsWith(delimiter)){
   await connection.query(statement.trimEnd().slice(0,-delimiter.length));statement='';
  }
 }
 if(statement.trim())throw new Error('Migración SQL incompleta.');
}

// Migraciones aditivas/reentrantes para MySQL 8 y MariaDB (XAMPP).
export async function migrate(pool, database) {
 const connection=await pool.getConnection();
 try {
  const [[lock]]=await connection.query('SELECT GET_LOCK(?, 30) AS acquired',[`${database}:eco_migrations`.slice(0,64)]);
  if(lock.acquired!==1)throw new Error('No se pudo bloquear la migración. Intenta iniciar de nuevo.');
  await applyMigrations(connection,database);
  const [applied]=await connection.query('SELECT id FROM schema_migrations WHERE id=?',['20261028_admin_recovery']);
  if(!applied.length){
   const sql=await readFile(new URL('../database/migrations/20261028_admin_recovery.sql',import.meta.url),'utf8');
   await applySqlMigration(connection,sql);
   await connection.query('INSERT IGNORE INTO schema_migrations(id) VALUES(?)',['20261028_admin_recovery']);
  }
 } finally {
  try {await connection.query('SELECT RELEASE_LOCK(?)',[`${database}:eco_migrations`.slice(0,64)]);}
  finally {connection.release();}
 }
}

async function applyMigrations(pool, database) {
 await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(80) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
 const [applied]=await pool.query('SELECT id FROM schema_migrations WHERE id=?',['20261028_recovery_world_flight']);
 if(applied.length)return;
 async function column(table, name, definition) {
  const [rows] = await pool.query('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [database, table, name]);
  if (!rows.length) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
 }
 await column('users', 'auth_version', 'INT NOT NULL DEFAULT 0');
 await column('destinations', 'provider', "VARCHAR(30) NOT NULL DEFAULT 'catalog'");
 await column('destinations', 'place_type', "VARCHAR(30) NOT NULL DEFAULT 'destination'");
 await column('destinations', 'country_code', 'CHAR(2) NULL');
 await column('destinations', 'city', 'VARCHAR(160) NULL');
 // Ambas familias soportan CHECK, pero su sintaxis para retirarlo es distinta.
 const [checks] = await pool.query(`SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME='trips' AND CONSTRAINT_TYPE='CHECK' AND CONSTRAINT_NAME='chk_trips_transport_mode'`, [database]);
 if (checks.length) {
  const [[version]] = await pool.query('SELECT VERSION() AS version');
  const operation = /mariadb/i.test(version.version) ? 'DROP CONSTRAINT' : 'DROP CHECK';
  // Una sola operación DDL: nunca deja la tabla sin su restricción.
  await pool.query(`ALTER TABLE trips ${operation} chk_trips_transport_mode, ADD CONSTRAINT chk_trips_transport_mode CHECK (transport_mode IN ('driving','walking','cycling','flight'))`);
 }
 await pool.query('INSERT IGNORE INTO schema_migrations(id) VALUES(?)',['20261028_recovery_world_flight']);
}
