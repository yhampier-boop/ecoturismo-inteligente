# Administración, MySQL y recuperación

## Revisión de la base real

Conexión comprobada a `ecoturismo_db`, **MariaDB 10.4.32**, usando las variables privadas existentes. Antes de cambiar archivos se verificaron tablas, columnas, motores, índices y claves foráneas. `users.id` es `CHAR(36)`, clave primaria, InnoDB, charset `utf8mb4`, collation `utf8mb4_unicode_ci`; los UUID relacionados son compatibles. Las referencias a destinos usan `VARCHAR(80)` de forma consistente.

La base ya tenía `users.role`, `users.is_active`, `site_notices` y `password_reset_tokens`, además de una cuenta administradora activa. Se conservan sus permisos, contraseña y registros. No se necesitó cambiar tipos, motores o collations existentes. `npm run db:check` repite el diagnóstico sin mostrar filas privadas, contraseñas, hashes o tokens.

## Correcciones y migración

- El backend anterior usaba `password_resets` con milisegundos, mientras la tabla preparada en phpMyAdmin era `password_reset_tokens` con `DATETIME`. Ahora emisión, vencimiento, consumo y desactivación usan **una sola tabla activa: `password_reset_tokens`**, con fechas UTC y `used_at`.
- El archivo `backend/database/migrations/20261028_admin_recovery.sql` se ejecuta automáticamente al iniciar Express. Es reentrante: crea solo lo que falta, añade el índice de rol/estado y comprueba el tipo/charset/collation real antes de crear la FK.
- Copia hashes/enlaces legados sin sobrescribir filas de la tabla actual. La tabla legada y sus registros no se eliminan ni se vuelven a crear en instalaciones nuevas. Los tokens usados o sustituidos se marcan, no se reutilizan.
- Se probó una FK nueva con un `users.id` de charset/collation distintos y se comprobó que, ante un hijo incompatible, la migración se detiene con diagnóstico sin alterar `users.id`. No se deshabilita `FOREIGN_KEY_CHECKS`.
- Se corrigió el comentario obsoleto de SQLite en `backend/sql/phpmyadmin.sql`; el backend ya usa `mysql2`.

### ¿Debo ejecutar SQL en phpMyAdmin?

**No en la instalación verificada:** Express ya aplica y registra la migración. Si prefieres aplicarla manualmente o el usuario del backend no tiene permisos para crear rutinas, selecciona `ecoturismo_db` e importa **solo** `backend/database/migrations/20261028_admin_recovery.sql` con una cuenta autorizada. El archivo registra su aplicación para que el backend no necesite repetirla. No reimportes tablas ni elimines registros. Para errores #1005/150 revisa primero `SHOW CREATE TABLE users`, `SHOW CREATE TABLE password_reset_tokens` y `npm run db:check`.

No se necesita SQL para convertir cuentas en administradoras: esta base ya tiene una. No se creó un usuario administrador por defecto. Las cuentas administradoras temporales de las pruebas tienen claves aleatorias, solo existen durante esas pruebas y se retiran al terminarlas.

## Acceso y permisos

- **Tu cuenta → Admin**, texto sin botón ni icono, abre `/admin/login`.
- Layout exclusivo de `/admin/*`, también en login: sin navbar ni footer públicos. Solo Dashboard, Usuarios, Avisos y Cerrar sesión dentro del panel; el acceso conserva enlaces para recuperar contraseña y volver al sitio.
- Correo y contraseña existentes, rol exacto `admin` y estado activo. Se sustituyó el JWT administrativo persistido por un token aleatorio opaco de 256 bits. React lo mantiene solo en memoria; Express conserva su hash y vigencia en un almacén efímero acotado. No se guarda en cookies ni en `localStorage`/`sessionStorage`.
- Cada endpoint protegido comprueba sesión, vencimiento y cuenta/estado/versión/rol en MySQL. Login y logout son las únicas excepciones: logout es idempotente y no entrega acceso. Los JWT de viajeros y los JWT administrativos antiguos no sirven para este panel. El token administrativo tampoco sirve para las rutas privadas de viajeros.
- Plazo de inactividad: **15 minutos**, aplicado en navegador y servidor; límite absoluto adicional de 8 horas. Las interacciones reales notifican actividad como máximo cada 30 segundos; no existe un heartbeat que mantenga la sesión indefinidamente sin interacción.
- F5/recarga y una nueva pestaña exigen credenciales porque no se hidrata ninguna sesión administrativa. Salir de `/admin/*` desmonta el contexto y revoca la sesión. `pagehide` intenta revocar al recargar/cerrar y se descarta memoria al volver desde la caché de navegación. Navegadores, cortes de red o cierres forzados pueden impedir la notificación de salida: aun así no se restaura acceso en el cliente y el backend caduca por inactividad. Logout normal sí invalida el token en el servidor.
- Las sesiones de usuario normal siguen usando su JWT independiente. Entrar/salir del panel no sustituye ni borra el token del viajero. Un reinicio de Express invalida todas las sesiones administrativas; varias instancias requieren afinidad de proceso o un diseño de almacén compartido antes de desplegar.
- `JWT_SECRET` debe ser privado y tener al menos 32 caracteres en producción. Sin configuración en desarrollo se usa un secreto aleatorio por proceso, nunca uno predeterminado conocido; en ese caso reiniciar Express invalida sesiones.
- Dashboard real, usuarios con búsqueda/paginación y activación/desactivación, avisos con borrador/edición/publicación/retiro y cierre de sesión. No hay endpoint para borrar usuarios, cambiar roles, contraseñas o ajustes de APIs.
- La desactivación no elimina viajes; invalida JWT anteriores y enlaces pendientes. Reactivar exige un nuevo inicio de sesión. La propia cuenta administradora no puede desactivarse desde el panel, tampoco cambiando mayúsculas del UUID.
- Los avisos publicados se muestran como texto en el sitio; borradores/retirados no aparecen en la API pública. Las pantallas de cuenta/recuperación/administración no muestran avisos generales.

## Correo y recuperación

Configurar **solo en `backend/.env`**:

| Variable | Uso |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` (predeterminado) |
| `SMTP_PORT` | `465` para Gmail |
| `SMTP_SECURE` | `true`; Gmail siempre usa TLS directo |
| `SMTP_USER` | Correo Gmail/Workspace autorizado |
| `SMTP_PASS` | Contraseña de aplicación de Google; nunca la contraseña normal |
| `SMTP_FROM` | Opcional: remitente autorizado; por defecto `SMTP_USER` |
| `CLIENT_URL` | URL real del frontend; HTTPS en producción |
| `SMTP_TEST_TO` | Destinatario autorizado para el correo de prueba |

No se introdujeron credenciales ficticias. Se preparó `backend/.env` con el host/puerto/TLS de Gmail y campos SMTP vacíos; se conservaron los demás valores privados. Antes `SMTP_PASS` no se reconocía y se exigían host/remitente aunque bastara la cuenta; ahora se admite directamente y se conserva `SMTP_PASSWORD` como alias antiguo. Para Gmail se garantiza puerto 465/TLS. Sin usuario/contraseña de aplicación el formulario sigue informando honestamente 503, en lugar de simular éxito. `npm run mail:verify` y `npm run mail:test` permiten comprobar autenticación y enviar un correo real autorizado sin imprimir credenciales. Los detalles de Google y configuración están en `README.md`.

Con SMTP configurado la recuperación responde de forma neutral y no espera la latencia del correo para evitar revelar cuentas. Si el envío falla, invalida el token y registra únicamente un aviso genérico. La entrega usa el proceso de Express: para producción conviene una cola persistente para sobrevivir a reinicios.

Se reutilizan formulario, enlace y endpoints anteriores. Token aleatorio de 256 bits, solo hash SHA-256 almacenado, vencimiento de 30 minutos, uso único transaccional, bcrypt y revocación de sesiones. Un enlace no reactiva cuentas ni cambia roles. Se protege contra exceso de solicitudes por IP; para varios procesos se necesita un almacén compartido.

## Archivos de la integración anterior

- Backend: `backend/src/database.js`, `migrations.js`, `server.js`, `passwordReset.js`; nuevos `admin.js`, `adminDatabase.js`.
- SQL: `backend/database/ecoturismo.sql`, `backend/sql/phpmyadmin.sql`; nueva migración `backend/database/migrations/20261028_admin_recovery.sql`.
- Frontend: `frontend/src/App.jsx`, `api.js`, `context/AuthContext.jsx`; nuevos `pages/AdminLogin.jsx`, `pages/AdminPanel.jsx`, `pages/admin.css`, `components/SiteNotices.jsx`.
- Configuración/diagnóstico: `backend/.env.example`, ambos `package.json`, `backend/scripts/check-database.js`.
- Pruebas: `backend/test/api.test.js`, `migrations.test.js`, nuevo `admin.test.js`; `tests/e2e/app.spec.js` y nuevo `admin.spec.js`.
- Documentación: `README.md`, `VERIFICACION.md` y este archivo.

No se modificaron buscador mundial, filtros, fotografías, clima, rutas, itinerarios ni los clientes de las tres APIs.

### Cambios de Gmail y sesión efímera

- Backend: `backend/src/passwordReset.js`, `backend/src/server.js`, `backend/src/admin.js`; nuevos `backend/src/adminSessions.js`, `backend/scripts/verify-mail.js`.
- Frontend: `frontend/src/App.jsx`, `frontend/src/api.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/AdminLogin.jsx`, `frontend/src/pages/AdminPanel.jsx`, `frontend/src/pages/admin.css`; nuevos `frontend/src/context/AdminAuthContext.jsx` y `frontend/src/components/AdminLayout.jsx`.
- Configuración: `backend/.env` (solo campos SMTP sin credenciales), `backend/.env.example`, `backend/package.json`, `package.json`, `playwright.config.js`.
- Pruebas: `backend/test/admin.test.js`, `backend/test/api.test.js`, nuevos `backend/test/adminSessions.test.js`, `backend/test/mail.test.js`; `tests/e2e/admin.spec.js`.
- Documentación: `README.md`, `ADMINISTRACION.md`, `VERIFICACION.md`.

Esta revisión no requiere nuevas columnas, tablas ni SQL manual: se verificaron y reutilizaron `users`, `site_notices` y `password_reset_tokens` sin modificar su esquema ni los registros originales. Las sesiones administrativas no se persisten en MySQL. No se añadieron dependencias.

## Validación y pendientes

Las pruebas verifican administrador temporal real en MySQL, rechazo de usuario normal/inactivo, prevención de escalada de rol, permisos en todos los endpoints, estadísticas, usuarios, avisos públicos, errores/reintentos, móvil y recuperación completa por SMTP local. También se repite la regresión turística existente, compilación y sintaxis. El acceso de la cuenta administradora preexistente no se intentó adivinando o cambiando su contraseña: usa sus credenciales originales.

La revisión anterior aprobó 38 pruebas de backend y 9 escenarios de Chromium. La nueva revisión añade pruebas de tokens opacos, revocación, aislamiento de la sesión del viajero, vencimiento en backend, F5, pestaña nueva, reentrada, inactividad/actividad y login cancelado. Los relojes se adelantan en las pruebas de 15 minutos: no se reduce el plazo real ni se afirma haber esperado 15 minutos físicos.

Resultado de Gmail/sesiones: **47 pruebas de backend y 16 escenarios de Chromium aprobados**. Compilación Vite y sintaxis correctas; conexión real a `ecoturismo_db` y compatibilidad de claves foráneas comprobadas. El flujo completo de recuperación se ejecutó con un servidor SMTP local real de pruebas.

Se verificó una conexión real a `smtp.gmail.com:465`, con certificado válido, **TLS 1.3** y saludo SMTP 220. Esto no es una autenticación ni una entrega: `npm run mail:verify` y `npm run mail:test` quedaron **pendientes**, con salida 1, porque `SMTP_USER` y `SMTP_PASS` siguen vacíos en `.env`. No se envió correo desde Gmail. Tras configurar esas variables y `SMTP_TEST_TO`, vuelve a ejecutar ambos comandos y comprueba la bandeja real.

**Pendiente externo:** este entorno no tiene SMTP real configurado. La entrega a un buzón real, spam, SPF/DKIM/DMARC y TLS con el proveedor deben comprobarse tras configurar las variables. No se certifica MySQL 8 sin una instancia de esa versión; las migraciones se comprobaron en MariaDB 10.4.32. Continúan las alertas de dependencias previamente documentadas en `VERIFICACION.md`; no se hicieron actualizaciones mayores ajenas a esta tarea.
