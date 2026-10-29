-- ECOTURISMO INTELIGENTE
-- Esquema convertido de PostgreSQL a MySQL 8.0.16+ / MariaDB 10.4+
-- Importar en phpMyAdmin. Solo crea la estructura: NO incluye datos de ejemplo.
-- El backend actual usa mysql2 y aplica migraciones automáticamente al iniciar.
-- Para una base existente usar database/migrations/20261028_admin_recovery.sql;
-- CREATE TABLE IF NOT EXISTS no actualiza por sí solo columnas existentes.
-- UUID se almacena en CHAR(36). El backend debe generar los identificadores UUID.

CREATE DATABASE IF NOT EXISTS `ecoturismo_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `ecoturismo_db`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` TEXT NOT NULL,
  `auth_version` INT NOT NULL DEFAULT 0,
  `role` VARCHAR(16) NOT NULL DEFAULT 'user',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id CHAR(36)
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
        NOT NULL,

    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_reset_user (user_id),

    CONSTRAINT fk_reset_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_notices (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(160) NOT NULL, content TEXT NOT NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_notices_active(is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `destinations` (
  `id` VARCHAR(80) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `region` VARCHAR(120) NOT NULL,
  `country` VARCHAR(80) NOT NULL,
  `lat` DECIMAL(9,6) NOT NULL,
  `lon` DECIMAL(9,6) NOT NULL,
  `category` VARCHAR(50) NOT NULL,
  `description` TEXT NOT NULL,
  `duration` VARCHAR(50) NOT NULL,
  `altitude` VARCHAR(50) DEFAULT NULL,
  `highlights_json` JSON NOT NULL,
  `photo_url` TEXT NOT NULL,
  `featured` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trips` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `transport_mode` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'planificado',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trip_user` (`user_id`),
  CONSTRAINT `fk_trips_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_trips_transport_mode` CHECK (`transport_mode` IN ('driving', 'walking', 'cycling'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_stops` (
  `id` CHAR(36) NOT NULL,
  `trip_id` CHAR(36) NOT NULL,
  `destination_id` VARCHAR(80) NOT NULL,
  `position` SMALLINT NOT NULL,
  `visit_date` DATE DEFAULT NULL,
  `duration_min` INT DEFAULT 120,
  `notes` TEXT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trip_stops_position` (`trip_id`, `position`),
  KEY `idx_stops_trip` (`trip_id`, `position`),
  KEY `idx_stops_destination` (`destination_id`),
  CONSTRAINT `fk_stops_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stops_destination` FOREIGN KEY (`destination_id`) REFERENCES `destinations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_segments` (
  `id` CHAR(36) NOT NULL,
  `trip_id` CHAR(36) NOT NULL,
  `origin_stop_id` CHAR(36) NOT NULL,
  `destination_stop_id` CHAR(36) NOT NULL,
  `position` SMALLINT NOT NULL,
  `transport_mode` VARCHAR(20) NOT NULL,
  `estimated_distance_km` DECIMAL(10,1) DEFAULT NULL,
  `estimated_minutes` INT DEFAULT NULL,
  `is_demo` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`id`),
  KEY `idx_segments_trip` (`trip_id`),
  KEY `idx_segments_origin` (`origin_stop_id`),
  KEY `idx_segments_destination` (`destination_stop_id`),
  CONSTRAINT `fk_segments_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_segments_origin` FOREIGN KEY (`origin_stop_id`) REFERENCES `trip_stops` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_segments_destination` FOREIGN KEY (`destination_stop_id`) REFERENCES `trip_stops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- ==========================================
-- ECOTURISMO INTELIGENTE
-- CONFIGURACION COMPLETA DEL PANEL ADMIN
-- MySQL 8 / MariaDB
-- ==========================================

USE ecoturismo_db;

-- 1. AGREGAR ROL DE USUARIO
-- Solo si no existe la columna

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT ''user''',
        'SELECT ''La columna role ya existe'' AS mensaje'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 2. AGREGAR ESTADO DE CUENTA
-- 1 = Activo
-- 0 = Desactivado

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
        'SELECT ''La columna is_active ya existe'' AS mensaje'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'is_active'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- 3. CREAR TABLA DE AVISOS

CREATE TABLE IF NOT EXISTS site_notices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    content TEXT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_notices_active (is_active)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- 4. CONFIGURAR CUENTA ADMINISTRADORA
-- Cambiar el correo si es necesario

SET @admin_email = '022200780e@uandina.edu.pe';

UPDATE users
SET role = 'admin',
    is_active = 1
WHERE email = @admin_email;


-- 5. ESTADISTICAS PARA EL DASHBOARD

SELECT
    (SELECT COUNT(*) FROM users)
        AS total_usuarios,
    (SELECT COUNT(*) FROM users WHERE role = 'admin')
        AS total_administradores,
    (SELECT COUNT(*) FROM trips)
        AS total_viajes,
    (SELECT COUNT(*) FROM site_notices WHERE is_active = 1)
        AS avisos_activos;


-- 6. VERIFICAR ADMINISTRADOR

SELECT
    id,
    name,
    email,
    role,
    is_active
FROM users
WHERE email = @admin_email;


-- 7. VERIFICAR TABLAS DEL PANEL

SHOW TABLES;
