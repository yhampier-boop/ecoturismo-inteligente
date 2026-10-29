-- EcoTurismo Inteligente · Esquema para MariaDB/MySQL (XAMPP + phpMyAdmin)
-- Importar desde phpMyAdmin: Importar → elegir este archivo → Continuar.
-- El backend también crea y actualiza estas tablas automáticamente al iniciar.

CREATE DATABASE IF NOT EXISTS `ecoturismo_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
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
  `highlights_json` LONGTEXT NOT NULL,
  `photo_url` TEXT NOT NULL,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `provider` VARCHAR(30) NOT NULL DEFAULT 'catalog',
  `place_type` VARCHAR(30) NOT NULL DEFAULT 'destination',
  `country_code` CHAR(2) DEFAULT NULL,
  `city` VARCHAR(160) DEFAULT NULL,
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
  `route_source` VARCHAR(20) NOT NULL DEFAULT 'demo',
  `route_geometry_json` LONGTEXT DEFAULT NULL,
  `route_total_km` DECIMAL(10,1) DEFAULT NULL,
  `route_total_minutes` INT DEFAULT NULL,
  `route_calculated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_trip_user` (`user_id`),
  CONSTRAINT `fk_trips_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_trips_transport_mode` CHECK (`transport_mode` IN ('driving','walking','cycling','flight'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_stops` (
  `id` CHAR(36) NOT NULL,
  `trip_id` CHAR(36) NOT NULL,
  `destination_id` VARCHAR(80) NOT NULL,
  `position` SMALLINT NOT NULL,
  `visit_date` DATE DEFAULT NULL,
  `duration_min` INT DEFAULT 120,
  `notes` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trip_stops_position` (`trip_id`,`position`),
  KEY `idx_stops_trip` (`trip_id`,`position`),
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
  `is_demo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_segments_trip` (`trip_id`),
  KEY `idx_segments_origin` (`origin_stop_id`),
  KEY `idx_segments_destination` (`destination_stop_id`),
  CONSTRAINT `fk_segments_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_segments_origin` FOREIGN KEY (`origin_stop_id`) REFERENCES `trip_stops` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_segments_destination` FOREIGN KEY (`destination_stop_id`) REFERENCES `trip_stops` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
 `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 `user_id` CHAR(36) NOT NULL,
 `token_hash` CHAR(64) NOT NULL UNIQUE,
 `expires_at` DATETIME NOT NULL,
 `used_at` DATETIME DEFAULT NULL,
 `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY `idx_reset_user` (`user_id`),
 CONSTRAINT `fk_reset_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `site_notices` (
 `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 `title` VARCHAR(160) NOT NULL, `content` TEXT NOT NULL,
 `is_active` TINYINT(1) NOT NULL DEFAULT 0,
 `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY `idx_notices_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Para bases existentes, las migraciones reentrantes de src/migrations.js se
-- aplican al iniciar Express. No borres ni vuelvas a crear tablas existentes.
INSERT IGNORE INTO `destinations`
(`id`,`name`,`region`,`country`,`lat`,`lon`,`category`,`description`,`duration`,`altitude`,`highlights_json`,`photo_url`,`featured`) VALUES
('machu-picchu','Machu Picchu','Cusco','Perú',-13.163100,-72.545000,'Cultura','Explora una de las maravillas del mundo, rodeada de montañas y siglos de historia inca.','Día completo','2 430 m','["Ciudadela inca","Paisajes andinos","Patrimonio mundial"]','https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1100&q=85',1),
('cusco','Cusco','Cusco','Perú',-13.531900,-71.967500,'Cultura','Calles de piedra, arquitectura colonial y una impresionante herencia ancestral.','2–3 días','3 399 m','["Plaza de Armas","Sacsayhuamán","Barrio San Blas"]','https://images.unsplash.com/photo-1531968455001-5c5272a41129?auto=format&fit=crop&w=1100&q=85',1),
('valle-sagrado','Valle Sagrado','Cusco','Perú',-13.320000,-72.100000,'Naturaleza','Pueblos tradicionales, terrazas agrícolas y caminos entre los Andes.','1–2 días','2 800 m','["Pisac","Ollantaytambo","Mercados artesanales"]','https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1100&q=85',1),
('arequipa','Arequipa','Arequipa','Perú',-16.409000,-71.537500,'Ciudad','La ciudad blanca ofrece una mezcla única de volcanes, arquitectura e identidad local.','2–3 días','2 335 m','["Monasterio de Santa Catalina","Plaza de Armas","Miradores"]','https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1100&q=85',1),
('lago-titicaca','Lago Titicaca','Puno','Perú',-15.840200,-69.315200,'Naturaleza','Un lago de gran altitud donde conviven paisajes serenos y culturas vivas.','Día completo','3 812 m','["Islas flotantes","Comunidad Taquile","Paseos en bote"]','https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1100&q=85',0),
('paracas','Paracas','Ica','Perú',-13.835000,-76.250000,'Aventura','Acantilados, océano y una reserva de biodiversidad en la costa peruana.','1–2 días','Nivel del mar','["Reserva Nacional","Islas Ballestas","Playas"]','https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1100&q=85',0),
('huaraz','Huaraz','Áncash','Perú',-9.528000,-77.528000,'Aventura','Puerta de entrada a lagunas turquesas y caminatas por la Cordillera Blanca.','2–4 días','3 052 m','["Laguna 69","Cordillera Blanca","Senderismo"]','https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85',0),
('lima','Lima','Lima','Perú',-12.046400,-77.042800,'Ciudad','Gastronomía, paseos frente al mar y barrios llenos de cultura.','2–3 días','154 m','["Miraflores","Barranco","Centro histórico"]','https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1100&q=85',0);
