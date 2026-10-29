-- Ejecutar con ecoturismo_db seleccionada. Reentrante; no borra datos ni cambia users.id.
-- El backend ejecuta este mismo archivo automáticamente bajo un bloqueo de migración.
DELIMITER $$
DROP PROCEDURE IF EXISTS eco_admin_recovery_migrate$$
CREATE PROCEDURE eco_admin_recovery_migrate()
BEGIN
 DECLARE id_type VARCHAR(80);
 DECLARE id_charset VARCHAR(64);
 DECLARE id_collation VARCHAR(64);
 DECLARE parent_engine VARCHAR(64);
 SELECT COLUMN_TYPE,CHARACTER_SET_NAME,COLLATION_NAME INTO id_type,id_charset,id_collation
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='id';
 SELECT ENGINE INTO parent_engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users';
 IF id_type IS NULL OR id_type NOT IN ('char(36)','varchar(36)') OR parent_engine <> 'InnoDB'
  OR NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='PRIMARY' AND COLUMN_NAME='id') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Revisa users.id: se requiere UUID CHAR/VARCHAR(36), clave primaria e InnoDB. No se modifica la tabla a ciegas.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role') THEN
  ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='is_active') THEN
  ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='auth_version') THEN
  ALTER TABLE users ADD COLUMN auth_version INT NOT NULL DEFAULT 0;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='idx_users_role_active') THEN
  CREATE INDEX idx_users_role_active ON users(role,is_active);
 END IF;

 CREATE TABLE IF NOT EXISTS site_notices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL, content TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_notices_active(is_active)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

 -- La FK nueva copia el tipo, charset y collation REALES de users.id.
 SET @eco_reset_ddl=CONCAT('CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id ',id_type,' CHARACTER SET ',id_charset,' COLLATE ',id_collation,' NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL,
  used_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reset_user(user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
 PREPARE eco_reset_stmt FROM @eco_reset_ddl;
 EXECUTE eco_reset_stmt;
 DEALLOCATE PREPARE eco_reset_stmt;

 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='used_at') THEN
  ALTER TABLE password_reset_tokens ADD COLUMN used_at DATETIME NULL;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='user_id' AND COLUMN_TYPE=id_type AND CHARACTER_SET_NAME=id_charset AND COLLATION_NAME=id_collation)
  OR NOT EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND ENGINE='InnoDB')
  OR NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='expires_at' AND DATA_TYPE='datetime') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='password_reset_tokens incompatible: revisa tipo/charset/collation de user_id, motor y expires_at DATETIME antes de modificar.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='user_id' AND SEQ_IN_INDEX=1) THEN
  CREATE INDEX idx_reset_user ON password_reset_tokens(user_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='token_hash' AND NON_UNIQUE=0) THEN
  CREATE UNIQUE INDEX uq_reset_token_hash ON password_reset_tokens(token_hash);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_reset_tokens' AND COLUMN_NAME='user_id' AND REFERENCED_TABLE_NAME='users' AND REFERENCED_COLUMN_NAME='id') THEN
  ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_reset_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
 END IF;

 -- Compatibilidad con enlaces anteriores. Se conservan tabla y filas originales.
 IF EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='password_resets' AND TABLE_TYPE='BASE TABLE') THEN
  INSERT IGNORE INTO password_reset_tokens(user_id,token_hash,expires_at)
   SELECT user_id,token_hash,TIMESTAMPADD(SECOND,FLOOR(expires_at/1000),'1970-01-01 00:00:00') FROM password_resets;
 END IF;
END$$
CALL eco_admin_recovery_migrate()$$
DROP PROCEDURE eco_admin_recovery_migrate$$
DELIMITER ;
CREATE TABLE IF NOT EXISTS schema_migrations (
 id VARCHAR(80) PRIMARY KEY,
 applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(id) VALUES('20261028_admin_recovery');
