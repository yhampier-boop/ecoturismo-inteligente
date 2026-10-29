import {test,expect} from '@playwright/test';
import {randomUUID,randomBytes} from 'node:crypto';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
dotenv.config({path:'backend/.env'});

let db,admin,traveler;
const users=[],notices=[];
const password=randomBytes(24).toString('base64url');
const unique=randomUUID().slice(0,8);
test.beforeAll(async({request})=>{
 db=await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'ecoturismo_db'});
 async function account(name){
  const email=`admin-browser-${randomUUID()}@example.test`;
  const response=await request.post('/api/auth/register',{data:{name,email,password}});
  expect(response.status()).toBe(201);const data=await response.json();users.push(data.user.id);return {...data.user,email,token:data.token};
 }
 admin=await account(`Administrador ${unique}`);traveler=await account(`Viajero ${unique}`);
 await db.query("UPDATE users SET role='admin' WHERE id=?",[admin.id]);
});
test.afterAll(async()=>{
 if(db){for(const id of notices)await db.query('DELETE FROM site_notices WHERE id=?',[id]);for(const id of users)await db.query('DELETE FROM users WHERE id=?',[id]);await db.end();}
});
async function login(page){
 await page.goto('/admin/login');await page.getByLabel('Correo electrónico').fill(admin.email);await page.getByLabel('Contraseña',{exact:true}).fill(password);
 const response=page.waitForResponse(r=>r.url().endsWith('/api/admin/login')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Ingresar al panel'}).click();await expect(page.getByRole('heading',{name:'Panel de control'})).toBeVisible();
 return (await (await response).json()).token;
}

test('Admin es texto del footer y un usuario normal no puede entrar',async({page,request})=>{
 await page.goto('/');
 const accountLinks=page.locator('.footer-col').filter({has:page.getByRole('heading',{name:'Tu cuenta',exact:true})});
 const adminLink=accountLinks.getByRole('link',{name:'Admin',exact:true});
 await expect(adminLink).toHaveAttribute('href','/admin/login');await expect(adminLink.locator('svg')).toHaveCount(0);
 expect(await adminLink.evaluate(element=>{
  const previous=element.previousElementSibling;const a=getComputedStyle(element),b=getComputedStyle(previous);
  return previous.textContent==='Iniciar sesión'&&['color','fontFamily','fontSize','fontWeight','backgroundColor'].every(key=>a[key]===b[key]);
 })).toBe(true);
 await adminLink.click();await page.getByLabel('Correo electrónico').fill(traveler.email);await page.getByLabel('Contraseña',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Ingresar al panel'}).click();await expect(page.getByRole('alert')).toContainText('no tiene acceso');
 const denied=await request.get('/api/admin/stats',{headers:{Authorization:`Bearer ${traveler.token}`}});expect(denied.status()).toBe(401);
 await page.evaluate(token=>localStorage.setItem('eco_token',token),traveler.token);await page.goto('/admin');
 await expect(page).toHaveURL(/\/admin\/login$/);await expect(page.getByRole('heading',{name:'Acceso administrador'})).toBeVisible();
 await expect(page.locator('.site-header,.footer')).toHaveCount(0);
});

test('panel real: estadísticas, buscar, desactivar/activar, avisos públicos y cerrar sesión',async({page,context,request})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const token=await login(page);await expect(page.locator('.admin-stats article')).toHaveCount(3);
 await expect(page.locator('.site-header,.footer')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Dashboard',exact:true})).toBeVisible();
 await expect(page.locator('.admin-stats strong').first()).toHaveText(/^\d+$/);
 await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 await page.getByLabel('Buscar usuarios por nombre o correo').fill(traveler.email);
 await expect(page.locator('tbody tr')).toHaveCount(1);await expect(page.locator('tbody')).toContainText(traveler.name);
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:`Desactivar cuenta de ${traveler.name}`,exact:true}).click();
 await expect(page.locator('.form-success')).toContainText('Cuenta desactivada');
 const denied=await request.post('/api/auth/login',{data:{email:traveler.email,password}});expect(denied.status()).toBe(403);
 await page.getByRole('button',{name:`Activar cuenta de ${traveler.name}`,exact:true}).click();await expect(page.locator('.form-success')).toContainText('Cuenta activada');
 const fresh=await request.post('/api/auth/login',{data:{email:traveler.email,password}});traveler.token=(await fresh.json()).token;
 await page.getByLabel('Buscar usuarios por nombre o correo').fill(admin.email);await expect(page.getByRole('button',{name:'Tu cuenta'})).toBeDisabled();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Avisos',exact:true}).click();
 const title=`Aviso navegador ${unique}`;
 await page.getByLabel('Título del aviso').fill(title);await page.getByLabel('Contenido del aviso').fill('Información temporal de una prueba automatizada.');
 const created=page.waitForResponse(r=>r.url().endsWith('/api/admin/notices')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Crear aviso'}).click();const notice=(await (await created).json()).notice;notices.push(notice.id);
 await expect(page.locator('.form-success')).toContainText('sin publicar');
 const entry=page.locator('.admin-notices article').filter({hasText:title});await expect(entry).toBeVisible();
 await entry.getByRole('button',{name:'Editar aviso'}).click();await expect(page.getByLabel('Título del aviso')).toHaveValue(title);
 await page.getByRole('button',{name:'Cancelar edición'}).click();await expect(page.getByLabel('Título del aviso')).toHaveValue('');
 await entry.getByRole('button',{name:'Editar aviso'}).click();await page.getByLabel('Contenido del aviso').fill('Contenido actualizado por una prueba automatizada.');
 await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(entry).toContainText('Contenido actualizado');
 await entry.getByRole('button',{name:'Publicar aviso'}).click();await expect(page.locator('.form-success')).toContainText('Aviso publicado');
 const publicPage=await context.newPage();await publicPage.goto('/');await expect(publicPage.getByRole('complementary',{name:'Avisos generales'})).toContainText(title);
 await entry.getByRole('button',{name:'Retirar aviso'}).click();await expect(page.locator('.form-success')).toContainText('Aviso retirado');
 const publicData=await request.get('/api/notices');expect((await publicData.json()).notices.some(n=>n.id===notice.id)).toBe(false);
 await publicPage.reload();await expect(publicPage.getByRole('heading',{name:title,exact:true})).toHaveCount(0);await publicPage.close();
 await page.getByRole('button',{name:'Cerrar sesión del panel'}).click();await expect(page).toHaveURL(/\/admin\/login$/);
 expect(await page.evaluate(()=>localStorage.getItem('eco_token'))).toBeNull();expect(errors).toEqual([]);
 await expect.poll(async()=>(await request.get('/api/admin/stats',{headers:{Authorization:`Bearer ${token}`}})).status()).toBe(401);
});

test('F5 solicita credenciales, no persiste tokens administrativos y conserva la sesión normal',async({page,request})=>{
 await page.goto('/');await page.evaluate(token=>localStorage.setItem('eco_token',token),traveler.token);
 const token=await login(page);
 expect(await page.evaluate(()=>localStorage.getItem('eco_token'))).toBe(traveler.token);
 expect(await page.evaluate(()=>Object.keys(sessionStorage))).toEqual([]);
 expect(await page.evaluate(value=>Object.values(localStorage).includes(value),token)).toBe(false);
 await page.reload();await expect(page).toHaveURL(/\/admin\/login$/);
 await expect(page.getByRole('heading',{name:'Acceso administrador'})).toBeVisible();
 await expect(page.locator('.site-header,.footer')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('eco_token'))).toBe(traveler.token);
 await expect.poll(async()=>(await request.get('/api/admin/stats',{headers:{Authorization:`Bearer ${token}`}})).status()).toBe(401);
});

test('cerrar la pestaña y volver a entrar exige correo y contraseña',async({page,context})=>{
 const tab=await context.newPage();await login(tab);await tab.close();
 await page.goto('/admin');await expect(page).toHaveURL(/\/admin\/login$/);
 await expect(page.getByLabel('Correo electrónico')).toHaveValue('');
 await expect(page.getByLabel('Contraseña',{exact:true})).toHaveValue('');
});

test('salir al sitio y volver por Admin no restaura la sesión del panel',async({page})=>{
 await login(page);await page.goto('/');await expect(page.locator('.site-header')).toBeVisible();
 await page.getByRole('contentinfo').getByRole('link',{name:'Admin',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Acceso administrador'})).toBeVisible();
 await expect(page.locator('.site-header,.footer')).toHaveCount(0);
});

test('15 minutos sin interacción cierran el panel y revocan el token en backend',async({page,request})=>{
 // Reloj del navegador adelantado, no se reduce el plazo real configurado.
 await page.clock.install();const token=await login(page);
 await page.clock.fastForward(15*60_000+1500);
 await expect(page).toHaveURL(/\/admin\/login$/);
 await expect(page.getByRole('status')).toContainText('15 minutos');
 await expect.poll(async()=>(await request.get('/api/admin/stats',{headers:{Authorization:`Bearer ${token}`}})).status()).toBe(401);
 await page.goBack();await expect(page.getByRole('heading',{name:'Panel de control'})).toHaveCount(0);
});

test('interacción real renueva actividad sin un heartbeat permanente',async({page})=>{
 await page.clock.install();await login(page);await expect(page.locator('.admin-stats article')).toHaveCount(3);
 await page.clock.fastForward(14*60_000);
 const synced=page.waitForResponse(r=>r.url().endsWith('/api/admin/activity'));
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();expect((await synced).status()).toBe(200);
 await page.clock.fastForward(14*60_000);await expect(page.getByRole('heading',{name:'Panel de control'})).toBeVisible();
 await page.clock.fastForward(2*60_000);await expect(page.getByRole('heading',{name:'Acceso administrador'})).toBeVisible();
});

test('cerrar administración no cierra la sesión del viajero',async({page,request})=>{
 await page.goto('/');await page.evaluate(token=>localStorage.setItem('eco_token',token),traveler.token);
 await login(page);await page.getByRole('button',{name:'Cerrar sesión del panel'}).click();
 await expect(page).toHaveURL(/\/admin\/login$/);
 expect(await page.evaluate(()=>localStorage.getItem('eco_token'))).toBe(traveler.token);
 expect((await request.get('/api/auth/me',{headers:{Authorization:`Bearer ${traveler.token}`}})).status()).toBe(200);
});

test('un fallo de red en administración muestra error y permite reintentar',async({page})=>{
 await login(page);
 await page.route('**/api/admin/users*',route=>route.abort());await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('No se pudo conectar');
 await page.unroute('**/api/admin/users*');await page.getByRole('button',{name:'Reintentar'}).click();
 await expect(page.locator('tbody tr').first()).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
});

test('una respuesta de login tardía no restaura acceso tras salir de administración',async({page,request})=>{
 let release,received,token;
 const gate=new Promise(resolve=>{release=resolve;});
 const ready=new Promise(resolve=>{received=resolve;});
 await page.route('**/api/admin/login',async route=>{
  const response=await route.fetch();token=(await response.json()).token;received();
  await gate;await route.fulfill({response});
 });
 await page.goto('/admin/login');await page.getByLabel('Correo electrónico').fill(admin.email);await page.getByLabel('Contraseña',{exact:true}).fill(password);
 await page.getByRole('button',{name:'Ingresar al panel'}).click();await ready;
 await page.getByRole('link',{name:'Volver al inicio'}).click();await expect(page.locator('.site-header')).toBeVisible();release();
 await expect.poll(async()=>(await request.get('/api/admin/stats',{headers:{Authorization:`Bearer ${token}`}})).status()).toBe(401);
 expect(await page.evaluate(value=>Object.values(localStorage).includes(value),token)).toBe(false);
});
