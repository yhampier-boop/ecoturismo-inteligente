# EcoTurismo Inteligente — Sitio web funcional (versión local)

Una aplicación para **explorar destinos de Perú y el mundo, planificar itinerarios y guardar viajes**, desarrollada con React, CSS, Node.js, Express y base de datos MySQL/MariaDB administrada con phpMyAdmin (XAMPP).

> **APIs externas con respaldo seguro.** OpenRouteService, OpenWeather y Unsplash se consultan exclusivamente desde Express cuando sus claves están en `backend/.env`. Si falta una clave, conexión, resultados o cuota, la aplicación conserva el catálogo local y rotula los respaldos DEMO; nunca los presenta como resultados reales.

## 1. Instalación en Windows (Visual Studio Code)

Requisitos: **Node.js versión 22.13 o superior** (preferiblemente Node 22 LTS), npm, **XAMPP** con MySQL/MariaDB y un navegador web.

1. Extrae `EcoTurismo_Inteligente_Web.zip`.
2. Abre **XAMPP Control Panel** y pulsa **Start** en **MySQL** (y en **Apache** si quieres abrir phpMyAdmin).
3. Abre la carpeta `EcoTurismo_Inteligente_Web` en Visual Studio Code: **Archivo → Abrir carpeta**.
4. Abre la terminal integrada: **Terminal → Nuevo terminal**.
5. Ejecuta:

   ```powershell
   npm install
   npm run dev
   ```

6. Ingresa a **http://localhost:5173**.
7. El backend responde en **http://localhost:4000/api/health**.
8. La base de datos se crea y actualiza sola. Ábrela en **http://localhost/phpmyadmin** → base **`ecoturismo_db`**.

**Alternativa Windows:** también puedes hacer doble clic en `iniciar-windows.bat` (instala dependencias la primera vez).

> Mantén la terminal abierta mientras utilizas el sistema. Para detenerlo, pulsa **Ctrl+C**.

## 2. ¿Qué funciona ahora?

| Área | Funcionalidades actuales |
|---|---|
| Inicio | Hero, buscador, destinos destacados, acceso al planificador |
| Explorar | Buscar destinos, filtrar por categoría, abrir fichas |
| Destinos | Descripción, región, duración, lugares destacados, botón «Añadir a mi itinerario» |
| Planificador | Nombre, fechas, hasta 10 paradas con buscador de ciudades, reordenación, fecha de visita, transporte, vista esquemática |
| Rutas | OpenRouteService para distancia, duración y trazado cuando está disponible; cálculo geométrico **DEMO** explícito como respaldo |
| Clima | Condiciones actuales y pronóstico gratuito de OpenWeather, sin datos inventados si no está disponible |
| Fotografías | Búsqueda global con Unsplash por ciudad y país, prioridad de fotos locales verificadas, galería, atribución y respaldo neutro |
| Usuarios | Registro, inicio/cierre de sesión, contraseñas hasheadas, JWT |
| Recuperación | Correo SMTP, enlace de 30 minutos y un solo uso; invalida las sesiones anteriores al cambiar la contraseña |
| Búsqueda mundial | Países, ciudades y lugares turísticos mediante Photon/OpenStreetMap y OpenWeather; filtros de país, ciudad/región disponible y categoría |
| Avión | Conexiones ilustrativas en el mapa y distancia geodésica; sin vuelos, aeropuertos, precios, horarios o tiempos inventados |
| Mis viajes | Guardar, listar, editar, duplicar, eliminar itinerarios del usuario |
| Base de datos | Tablas reales MySQL/MariaDB: usuarios, destinos, viajes, paradas, tramos; semilla de 8 destinos y ciudades externas guardadas al añadirlas |
| Diseño | Responsive para computadora, tablet y teléfono |

Las respuestas externas se guardan temporalmente en memoria para evitar consultas repetidas. La vista de ruta sigue siendo ilustrativa: cuando OpenRouteService devuelve geometría, dibuja ese recorrido, pero no reemplaza el mapa por un proveedor cartográfico.

## 3. Tecnologías

- **Frontend:** React 18 + Vite 6 + React Router + CSS.
- **Backend:** Node.js 22 + Express 4, REST API.
- **Base de datos local:** MySQL/MariaDB de XAMPP, cliente `mysql2` y administración con **phpMyAdmin**.
- **Seguridad:** bcryptjs para contraseñas y JWT para rutas privadas.

La base `ecoturismo_db` se crea automáticamente al iniciar el backend y queda disponible en phpMyAdmin. La ruta calculada al guardar un viaje —real si OpenRouteService está disponible o DEMO identificada— queda asociada al itinerario y sus tramos. En avión se conserva la distancia geométrica y la duración permanece `NULL`.

Las migraciones de `backend/src/migrations.js` son reentrantes y se registran en `schema_migrations`. Añaden metadatos de lugares, `users.auth_version`, roles/estado, avisos, `password_reset_tokens` y compatibilidad del transporte con `flight`, sin borrar usuarios, destinos o viajes. El antiguo `password_resets`, si existe, queda conservado como legado; sus enlaces se copian sin sobrescribir tokens existentes. Probadas con MariaDB local, tanto sobre la base existente como sobre una base nueva aislada. La rama específica de MySQL 8 necesita comprobarse en una instancia de esa versión antes de desplegar allí.

## 4. Estructura de carpetas

```text
EcoTurismo_Inteligente_Web/
├── frontend/
│   ├── public/images/hero-mountains.png
│   ├── src/
│   │   ├── App.jsx              # Navegación general
│   │   ├── styles.css           # Diseño visual responsive
│   │   ├── api.js               # Cliente REST propio
│   │   ├── context/AuthContext.jsx
│   │   ├── components/          # Tarjetas, avisos y mapa esquemático
│   │   └── pages/               # Inicio, Explorar, Destino, Planificador,
│   │                             Mis viajes, Inicio de sesión
│   └── vite.config.js           # Proxy a Express (localhost:4000)
├── backend/
│   ├── src/server.js            # Endpoints HTTP, seguridad, validación
│   ├── src/database.js          # Conexión MySQL, esquema, consultas y catálogo demo
│   ├── src/integrations.js      # Clientes de las tres API y caché temporal
│   └── database/ecoturismo.sql  # Esquema y datos para importar en phpMyAdmin
├── scripts/dev.mjs
├── iniciar-windows.bat
└── package.json
```

## 5. Endpoints propios de Express

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/health` | Estado de servidor |
| GET | `/api/integrations/status` | Estado de configuración de las API, sin exponer claves |
| GET | `/api/countries` | Países/territorios ISO para el filtro mundial |
| GET | `/api/destinations` | Lista y filtros `search`, `category`, `country`, `city` |
| GET | `/api/destinations/:id` | Detalle de un destino |
| GET | `/api/places` | Sugerencias de MySQL, Photon/OSM y OpenWeather, sin persistirlas |
| POST | `/api/destinations/ensure` | Guarda una sugerencia externa firmada (`proof`) con coordenadas reales e ID estable |
| POST | `/api/auth/register` | Registrar cuenta |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Información del usuario autenticado |
| POST | `/api/admin/login` | Acceso con correo/contraseña; sesión opaca en memoria, 15 minutos máximos sin actividad |
| POST | `/api/admin/logout`, `/api/admin/activity` | Revocar la sesión o comunicar actividad real |
| GET | `/api/admin/me`, `/api/admin/stats` | Perfil administrativo y totales reales |
| GET | `/api/admin/users` | Usuarios sin hashes, búsqueda y paginación |
| PATCH | `/api/admin/users/:id/active` | Activar/desactivar; no cambia roles ni borra cuentas |
| GET/POST | `/api/admin/notices` | Listar/crear avisos |
| PUT | `/api/admin/notices/:id` | Editar, publicar o retirar un aviso |
| GET | `/api/notices` | Avisos publicados del sitio público |
| POST | `/api/auth/forgot-password` | Solicitar correo (`email`); respuesta genérica para proteger la existencia de cuentas |
| POST | `/api/auth/reset-password` | Cambiar contraseña (`token`, `password`); enlace válido una vez durante 30 minutos |
| GET | `/api/trips` | Itinerarios guardados, requiere Bearer Token |
| POST | `/api/trips` | Crear itinerario, requiere Bearer Token |
| GET | `/api/trips/:id` | Ver itinerario propio |
| PUT | `/api/trips/:id` | Modificar itinerario propio |
| POST | `/api/trips/:id/duplicate` | Duplicar itinerario propio |
| DELETE | `/api/trips/:id` | Eliminar itinerario propio |
| POST | `/api/routes` | Ruta OpenRouteService o respaldo DEMO explícito |
| GET | `/api/weather` | Clima actual y pronóstico gratuito de OpenWeather |
| GET | `/api/photos` | Búsqueda de imágenes y atribuciones de Unsplash |
| POST | `/api/photos/:id/download` | Seguimiento de descarga de Unsplash cuando corresponda |

Las rutas externas validan entradas, usan caché temporal acotada y no envían claves al navegador. Manejan tiempos de espera, respuestas incompletas y cuota 429 (con pausa temporal por proveedor). Los formularios sensibles tienen límites por IP. Son límites en memoria para una instancia; en producción con varios procesos se necesita un almacén compartido.

## 6. Probar una historia completa

1. En `http://localhost:5173`, entra a **Explorar** y busca «Cusco».
2. Abre una ficha y pulsa **Añadir a mi itinerario**.
3. En el **Planificador**, busca otra ciudad (por ejemplo, «Madrid»), selecciona una sugerencia y añádela como parada. El texto libre no se guarda como destino.
4. Elige fechas y transporte, y pulsa **Calcular recorrido** para ver la ruta real o el respaldo **DEMO** claramente rotulado.
5. Pulsa **Guardar itinerario**: si no tienes cuenta, el sitio te llevará a crearla y conservará el borrador.
6. Una vez autenticado, guarda el viaje, ve a **Mis viajes** y pruébalo: **Editar**, **Duplicar**, **Eliminar**.

## 7. Preparar variables de entorno

En desarrollo puedes ejecutar sin configurar `.env`. Para configurar tu propio secreto JWT:

- Copia `backend/.env.example` como `backend/.env`.
- Cambia `JWT_SECRET` por un valor largo, único y secreto.
- Agrega `OPENROUTESERVICE_API_KEY`, `OPENWEATHER_API_KEY` y `UNSPLASH_ACCESS_KEY` con sus valores reales.
- `PORT=4000` y `CLIENT_URL=http://localhost:5173` son los valores por defecto.
- La conexión a MySQL usa por defecto `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=` (vacío) y `DB_NAME=ecoturismo_db`, que son los valores habituales de XAMPP. Si tu instalación tiene contraseña, escríbela en `DB_PASSWORD`.

### Importar la base en phpMyAdmin

El backend crea las tablas y los 8 destinos automáticamente, así que no es obligatorio importar nada. Si prefieres hacerlo manualmente:

1. Inicia **MySQL** y **Apache** en XAMPP.
2. Entra a **http://localhost/phpmyadmin**.
3. Pestaña **Importar** → selecciona `backend/database/ecoturismo.sql` → **Continuar**.
4. Verás la base `ecoturismo_db` con las tablas `users`, `destinations`, `trips`, `trip_stops` y `trip_segments`.

**No publiques** el archivo `.env` ni claves reales. El frontend nunca debe contener estas variables.

### Recuperación de contraseña (SMTP)

Para Gmail configura exclusivamente en `backend/.env`:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
CLIENT_URL=http://localhost:5173
SMTP_TEST_TO=
```

Completa `SMTP_USER` con tu correo y `SMTP_PASS` con una **contraseña de aplicación de Google**, no la contraseña normal. Activa la verificación en dos pasos y crea la contraseña en <https://myaccount.google.com/apppasswords> (la disponibilidad depende de las políticas de la cuenta). No compartas el `.env`. `SMTP_FROM` es opcional: sin él se usa `SMTP_USER`; para un alias debe estar autorizado en Gmail. `SMTP_PASSWORD` sigue admitido como alias antiguo, pero `SMTP_PASS` tiene prioridad. No dupliques variables al editar `.env`.

El backend usa Gmail/465/TLS por defecto y no permite degradar TLS al usar `smtp.gmail.com`. Otros servidores SMTP siguen disponibles para pruebas o proveedores distintos. Reinicia Express después de configurar `.env`. En producción usa HTTPS en `CLIENT_URL`; el enlace nunca se construye desde cabeceras enviadas por el usuario.

`npm run mail:verify` comprueba conexión/autenticación SMTP. Con un destinatario autorizado en `SMTP_TEST_TO`, `npm run mail:test` envía un correo real de comprobación sin tokens ni contraseñas. Que SMTP lo acepte no prueba recepción: verifica la bandeja y spam. Si faltan credenciales, ambos comandos terminan con estado pendiente y **no envían** nada.

Sin SMTP, el formulario informa que el correo no está configurado (503); no muestra enlaces ni simula entregas. Una respuesta genérica 202 no certifica recepción: si SMTP falla, se invalida el token y se registra un aviso sin credenciales. Configura y prueba una entrega real, carpeta de spam, SPF/DKIM/DMARC y la seguridad TLS antes de publicar.

El token tiene 256 bits aleatorios; solo su SHA-256 y vencimiento se guardan en MySQL. Un nuevo enlace sustituye al anterior. El cambio de contraseña consume el token transaccionalmente y revoca los JWT anteriores. El enlace lleva el token en el fragmento `#token=…`, no en una consulta que llegue a los registros HTTP; se envía al backend únicamente al confirmar el formulario. No compartas ese enlace.

**Seguridad del ejemplo:** se retiraron claves del antiguo `.env.example`. Si alguna era real o fue compartida, revócala y reemplázala en el proveedor. No se alteraron las claves privadas de APIs ni los respaldos existentes. En la revisión de Gmail solo se añadieron los campos SMTP sin credenciales a `backend/.env`.

### Cobertura mundial

Photon (`https://photon.komoot.io`) aporta datos reales de OpenStreetMap sin clave. OpenWeather mejora las ciudades y sus nombres en español. Se traducen únicamente términos genéricos de búsqueda (por ejemplo, «torre» → «tower»), nunca datos geográficos. Las fichas conservan país, región, coordenadas y proveedor; las categorías se derivan de los tipos OSM disponibles. Las fotos de Unsplash se rotulan como referencias, no como prueba de que representan exactamente el lugar.

La cobertura y relevancia dependen del proveedor. Filtrar un país muestra los lugares disponibles/guardados y las coincidencias geocodificadas, no un catálogo turístico exhaustivo. El filtro de ciudad/región usa los datos realmente disponibles. El servicio público Photon no tiene garantía de disponibilidad; para tráfico de producción considera una instancia propia o un proveedor con acuerdo de servicio.

## 8. Pruebas

Con **MySQL encendido en XAMPP**:

```powershell
npm run test
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run verify:integrations
npm run db:check
```

Las pruebas comprueban catálogo, filtros, persistencia, restricciones de propietario, avión sin duración inventada, sugerencias firmadas, migraciones, límites, respuestas externas incompletas y recuperación segura. Los casos de SMTP usan un servidor local de pruebas, no una bandeja real. Playwright inicia servidores propios en 4005/5175 y SMTP de prueba en 4026; elimina las cuentas temporales creadas. Sus casos mundiales consultan servicios reales y requieren Internet. Los fallos controlados se usan únicamente en pruebas de errores.

`npm run verify:integrations` realiza peticiones reales pequeñas a las tres APIs y al geocodificador, sin imprimir claves. «Configurado» en `/api/integrations/status` solo indica presencia de una variable, no garantiza que la credencial sea válida. Consulta [VERIFICACION.md](VERIFICACION.md) para resultados y pendientes.

## 9. Consideraciones para publicar

Es una **versión académica local**. Antes de desplegarla en Internet: configurar JWT seguro, HTTPS, SMTP, límites distribuidos y proxy de confianza según el despliegue, un usuario MySQL con contraseña (no `root` sin contraseña), copias de seguridad y revisar licencias/atribuciones. No fijes `trust proxy` sin conocer la infraestructura. La conexión actual está pensada para XAMPP y phpMyAdmin.

## 10. Verificar las integraciones

1. En una ficha de destino, confirma que el clima indique OpenWeather y que la galería muestre el crédito al fotógrafo y a Unsplash.
2. En el planificador, añade dos paradas y pulsa **Calcular recorrido**. El panel mostrará «DISTANCIA REAL» solo si OpenRouteService respondió; de otro modo dirá «DEMO».
3. Sin claves o conexión, los mismos espacios deben mostrar mensajes de indisponibilidad o DEMO, sin datos meteorológicos inventados.
4. En avión confirma la línea discontinua y el icono de avión. El tiempo debe ser «No disponible»: los puntos son destinos, no aeropuertos ni vuelos confirmados.

## 11. Administración y esquema existente

En el footer, **Tu cuenta → Admin** abre `/admin/login`, con layout exclusivo sin navbar ni footer públicos. Usa las credenciales de una cuenta existente con `role='admin'` e `is_active=1`; no se crean administradores ni contraseñas predeterminadas. El registro público siempre crea usuarios normales. Cada endpoint del panel vuelve a consultar permisos/estado en MySQL; no acepta un rol enviado por el navegador. El administrador no puede desactivar su propia cuenta y la desactivación revoca sesiones y enlaces de recuperación sin borrar sus viajes.

La sesión administrativa está **solo en memoria**, separada del JWT del viajero. Se exige login de nuevo al recargar/F5, abrir otra pestaña o volver después de salir del área administrativa. Logout e inactividad de 15 minutos invalidan el token en Express; las consultas sin interacción no mantienen el navegador conectado. No hay token administrativo en cookies, `localStorage` o `sessionStorage`. Consulta los límites de cierre abrupto y despliegue en [ADMINISTRACION.md](ADMINISTRACION.md).

El panel no configura ni consulta las tres APIs externas. Los avisos se publican como texto, sin HTML ejecutable. Consulta [ADMINISTRACION.md](ADMINISTRACION.md) para archivos afectados, diagnóstico, migración importable en phpMyAdmin y límites de verificación.
