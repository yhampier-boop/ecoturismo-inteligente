import {test,expect} from '@playwright/test';
import dotenv from 'dotenv';
import {randomUUID} from 'node:crypto';
import {SMTPServer} from 'smtp-server';
dotenv.config({path:'backend/.env'});

let pool;
const users=[];
const messages=[];
let smtp;
test.beforeAll(async()=>{
 smtp=new SMTPServer({authOptional:true,disabledCommands:['STARTTLS'],logger:false,onData(stream,_session,callback){
  let raw='';stream.on('data',chunk=>raw+=chunk);stream.on('end',()=>{messages.push(raw.replace(/=\r?\n/g,'').replace(/=([\da-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))));callback();});
 }});
 await new Promise(resolve=>smtp.listen(4026,'127.0.0.1',resolve));
});
test.afterAll(async()=>{
 if(users.length){
  ({pool}=await import('../../backend/src/database.js'));
  for(const id of users)await pool.query('DELETE FROM users WHERE id=?',[id]);
  await pool.end();
 }
 if(smtp)await new Promise(resolve=>smtp.close(resolve));
});
test.beforeEach(async({page})=>{
 // Los datos de negocio y las APIs NO se sustituyen en estas pruebas.
 // Se omiten solo teselas/fotos remotas para evitar ruido de red en el navegador.
 await page.route(/https:\/\/[^/]*(tile\.openstreetmap\.org|images\.unsplash\.com|openweathermap\.org\/img)/,route=>route.abort());
});

test('navbar de escritorio y móvil: Inicio, destinos, experiencias y cuenta',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await expect(page.getByRole('navigation').getByRole('link',{name:'Inicio',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('navigation').getByRole('link',{name:'Experiencias',exact:true}).click();
 await expect(page.locator('#experiencias')).toBeInViewport();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Abrir menú'}).click();
 await page.getByRole('navigation').getByRole('link',{name:'Destinos',exact:true}).click();
 await expect(page).toHaveURL(/explorar/);await expect(page.getByRole('button',{name:'Abrir menú'})).toBeVisible();
 await page.getByRole('button',{name:'Abrir menú'}).click();await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Abrir menú'})).toHaveAttribute('aria-expanded','false');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/mis-viajes');await expect(page.getByRole('heading',{name:'Tus itinerarios se guardan en tu cuenta'})).toBeVisible();
 expect(errors).toEqual([]);
});

test('búsqueda mundial real de país y lugar turístico, filtros y mensaje vacío',async({page})=>{
 await page.goto('/explorar?buscar=Torre%20Eiffel&pais=Francia');
 await expect(page.locator('.destination-card h3').filter({hasText:'Eiffel'}).first()).toBeVisible({timeout:30_000});
 await expect(page.getByLabel('País',{exact:true})).toHaveValue('Francia');
 await page.locator('.destination-card-main').first().click();
 await expect(page.locator('.detail-hero h1')).toContainText('Eiffel');
 await expect(page.locator('.aside-note')).toContainText('OpenStreetMap');
 await page.getByRole('button',{name:/Agregar a mi viaje/}).click();
 await expect(page.locator('.stop-list')).toContainText('Eiffel');
 await page.goto('/explorar?buscar=Francia');
 await expect(page.locator('.destination-card h3').filter({hasText:'Francia'}).first()).toBeVisible({timeout:30_000});
 await page.goto('/explorar?buscar=zzzxxyyqvnonexistent987654321');
 await expect(page.getByRole('heading',{name:'¡Ups! No encontramos ese destino.'})).toBeVisible({timeout:30_000});
 await page.getByRole('button',{name:'Limpiar filtros'}).click();
 await expect(page.locator('.destination-card')).toHaveCount(8);
 await page.getByLabel('Ciudad o región disponible').selectOption('Cusco');
 await expect(page.locator('.destination-card')).toHaveCount(3);
 await page.getByRole('button',{name:'Naturaleza',exact:true}).click();
 await expect(page.locator('.destination-card')).toHaveCount(2);
 await page.getByLabel('Ciudad o región disponible').selectOption('Cusco');
 await expect(page.locator('.destination-card')).toHaveCount(1);
 await expect(page.locator('.destination-card h3')).toHaveText('Valle Sagrado');
});

test('registro, planificador aéreo, reordenación, cálculo, guardado, edición y duplicado',async({page})=>{
 const email=`browser-${randomUUID()}@example.test`;
 await page.goto('/acceso?next=%2Fplanificar%3Fadd%3Dlima');
 await page.getByRole('button',{name:'Crear cuenta',exact:true}).click();
 await page.getByLabel('Tu nombre').fill('Prueba Navegador');await page.getByLabel('Correo electrónico').fill(email);
 await page.getByLabel('Contraseña',{exact:true}).fill('Navegador-seguro-123');
 const registered=page.waitForResponse(response=>response.url().endsWith('/api/auth/register')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Crear mi cuenta'}).click();
 users.push((await (await registered).json()).user.id);
 await expect(page).toHaveURL(/\/planificar(?:\?|$)/);
 await expect(page.locator('.stop-list')).toContainText('Lima');
 await page.goto('/destinos/cusco');await page.getByRole('button',{name:/Agregar a mi viaje/}).click();
 await expect(page.locator('.stop-item')).toHaveCount(2);
 await page.reload();await expect(page.locator('.stop-item')).toHaveCount(2);
 await page.getByRole('button',{name:'Subir parada',exact:true}).nth(1).click();
 await expect(page.locator('.stop-item').first()).toContainText('Cusco');
 await page.getByRole('button',{name:'En avión',exact:true}).click();
 await expect(page.getByRole('button',{name:'En avión',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.air-map-marker')).toHaveCount(1);
 await page.getByRole('button',{name:'Calcular recorrido'}).click();
 await expect(page.locator('.preview-stats')).toContainText('No disponible');
 await expect(page.locator('.api-notice').filter({hasText:'Sin precios, horarios ni duración'})).toBeVisible();
 await page.getByRole('button',{name:'Guardar itinerario'}).click();
 await expect(page.locator('.trip-row')).toHaveCount(1);
 await expect(page.locator('.trip-row-meta')).toContainText('En avión');
 await page.getByRole('button',{name:'Editar',exact:true}).click();
 await expect(page.getByRole('button',{name:'En avión',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Nombre del itinerario').fill('Aventura aérea actualizada');
 await page.getByRole('button',{name:'Actualizar viaje'}).click();
 await expect(page.locator('.trip-row h2')).toHaveText('Aventura aérea actualizada');
 await page.getByRole('button',{name:'Duplicar',exact:true}).click();await expect(page.locator('.trip-row')).toHaveCount(2);
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/Eliminar /}).first().click();await expect(page.locator('.trip-row')).toHaveCount(1);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:'Tus itinerarios se guardan en tu cuenta'})).toBeVisible();
});

test('recuperación accesible, enlace inválido, confirmación y errores de red',async({page})=>{
 await page.goto('/acceso');await page.getByRole('link',{name:'¿Olvidaste tu contraseña?'}).click();
 await expect(page.getByLabel('Correo electrónico')).toBeVisible();
 await page.goto('/restablecer-contrasena');await expect(page.getByRole('alert')).toContainText('no es válido');
 await page.goto(`/restablecer-contrasena#token=${'a'.repeat(64)}`);
 await page.getByLabel('Nueva contraseña',{exact:true}).fill('Prueba-segura-123');
 await page.getByLabel('Repite la contraseña').fill('Diferente-123');
 await page.getByRole('button',{name:'Guardar nueva contraseña'}).click();
 await expect(page.getByRole('alert')).toContainText('no coinciden');
 await page.getByLabel('Repite la contraseña').fill('Prueba-segura-123');
 await page.getByRole('button',{name:'Guardar nueva contraseña'}).click();
 await expect(page.getByRole('alert')).toContainText('ha vencido');
 // Un fallo de red controlado se usa SOLO para verificar el mensaje de error.
 await page.route('**/api/destinations*',route=>route.abort());
 await page.goto('/');await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
});

test('recuperación completa en navegador con correo recibido por SMTP local',async({page})=>{
 const email=`browser-reset-${randomUUID()}@example.test`;
 const registered=await page.request.post('/api/auth/register',{data:{name:'Prueba Navegador',email,password:'Original-browser-123'}});
 const account=await registered.json();users.push(account.user.id);
 await page.goto('/recuperar-contrasena');
 await page.getByLabel('Correo electrónico').fill(email);
 await page.getByRole('button',{name:'Enviar enlace'}).click();
 await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
 await expect.poll(()=>messages.length).toBeGreaterThan(0);
 const resetToken=messages.at(-1)?.match(/#token=([a-f0-9]{64})/)?.[1];
 expect(resetToken).toBeTruthy();
 await page.goto(`/restablecer-contrasena#token=${resetToken}`);
 await page.getByLabel('Nueva contraseña',{exact:true}).fill('Restablecida-browser-123');
 await page.getByLabel('Repite la contraseña').fill('Restablecida-browser-123');
 await page.getByRole('button',{name:'Guardar nueva contraseña'}).click();
 await expect(page.getByRole('status')).toContainText('Contraseña actualizada');
 expect(new URL(page.url()).hash).toBe('');
 const oldSession=await page.request.get('/api/auth/me',{headers:{Authorization:`Bearer ${account.token}`}});
 expect(oldSession.status()).toBe(401);
 await page.getByRole('link',{name:'Volver a iniciar sesión'}).click();
 await page.getByLabel('Correo electrónico').fill(email);
 await page.getByLabel('Contraseña',{exact:true}).fill('Restablecida-browser-123');
 await page.getByRole('button',{name:'Ingresar a mi cuenta'}).click();
 await expect(page).toHaveURL(/\/mis-viajes$/);
 await expect(page.locator('.trips-intro')).toContainText('Prueba');
});

test('autocompletado por teclado y controles del planificador en móvil',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/planificar');
 await page.getByRole('combobox',{name:'Añadir un destino'}).fill('Cusco');
 await expect(page.getByRole('option').first()).toContainText('Cusco',{timeout:30_000});
 await page.getByRole('combobox',{name:'Añadir un destino'}).press('Enter');
 await page.getByRole('button',{name:'Añadir',exact:true}).click();
 await expect(page.locator('.stop-item')).toHaveCount(1);
 await expect(page.getByRole('combobox',{name:'Añadir un destino'})).toHaveValue('');
 await expect(page.getByRole('button',{name:'Calcular recorrido'})).toBeDisabled();
 await page.getByRole('button',{name:'En avión',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Quitar parada',exact:true}).click();
 await expect(page.locator('.stop-item')).toHaveCount(0);
});
