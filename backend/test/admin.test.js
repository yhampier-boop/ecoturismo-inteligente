import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {app} from '../src/server.js';
import {pool,createUser,storePasswordReset} from '../src/database.js';
import {newResetToken} from '../src/passwordReset.js';
import {ADMIN_IDLE_MS} from '../src/adminSessions.js';

let server,base,adminToken,regularToken,regularId,noticeId;
const adminId=randomUUID(),inactiveId=randomUUID();
const adminEmail=`admin-test-${randomUUID()}@example.test`;
const password=randomBytes(24).toString('base64url');
const regularEmail=`user-test-${randomUUID()}@example.test`;
async function api(path,{body,token,method=body?'POST':'GET'}={}){
 const response=await fetch(`${base}/api${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:response.status===204?null:await response.json()};
}
before(async()=>{
 const hash=await bcrypt.hash(password,10);
 await createUser({id:adminId,name:'Admin temporal de pruebas',email:adminEmail,passwordHash:hash});
 await createUser({id:inactiveId,name:'Admin temporal inactivo',email:`inactive-${adminEmail}`,passwordHash:hash});
 // Solo estas cuentas temporales de prueba: nunca cambia permisos de usuarios existentes.
 await pool.query("UPDATE users SET role='admin' WHERE id=?",[adminId]);
 await pool.query("UPDATE users SET role='admin',is_active=0 WHERE id=?",[inactiveId]);
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{
 if(noticeId)await pool.query('DELETE FROM site_notices WHERE id=?',[noticeId]);
 for(const id of [regularId,adminId,inactiveId].filter(Boolean))await pool.query('DELETE FROM users WHERE id=?',[id]);
 if(server)await new Promise(resolve=>server.close(resolve));await pool.end();
});

test('registro no permite autoconcederse rol admin ni elegir estado',async()=>{
 const response=await api('/auth/register',{body:{name:'Viajero temporal',email:regularEmail,password,role:'admin',is_active:0}});
 assert.equal(response.status,201);regularToken=response.data.token;regularId=response.data.user.id;
 assert.equal(response.data.user.role,'user');assert.equal(response.data.user.is_active,1);
 assert.equal(response.data.user.password_hash,undefined);
});

test('login admin rechaza contraseña errónea, cuenta normal e inactiva',async()=>{
 assert.equal((await api('/admin/login',{body:{email:adminEmail,password:'incorrecta'}})).status,401);
 assert.equal((await api('/admin/login',{body:{email:regularEmail,password}})).status,403);
 assert.equal((await api('/admin/login',{body:{email:`inactive-${adminEmail}`,password}})).status,403);
 const response=await api('/admin/login',{body:{email:adminEmail,password}});
 assert.equal(response.status,200);assert.equal(response.data.sessionType,'admin');adminToken=response.data.token;
 assert.equal(response.data.user.password_hash,undefined);
});

test('todos los endpoints administrativos verifican permisos desde el backend',async()=>{
 const paths=[['/admin/me','GET'],['/admin/stats','GET'],['/admin/users','GET'],['/admin/notices','GET'],[`/admin/users/${regularId}/active`,'PATCH'],['/admin/notices','POST'],['/admin/notices/1','PUT']];
 for(const [path,method] of paths){
  assert.equal((await api(path,{method,body:['POST','PUT','PATCH'].includes(method)?{}:undefined})).status,401);
   assert.equal((await api(path,{method,token:regularToken,body:['POST','PUT','PATCH'].includes(method)?{}:undefined})).status,401);
 }
 const forged=jwt.sign({id:regularId,version:0,purpose:'admin',role:'admin'},process.env.JWT_SECRET||randomBytes(32).toString('hex'));
 assert.ok([401,403].includes((await api('/admin/stats',{token:forged})).status));
 const publicLogin=await api('/auth/login',{body:{email:adminEmail,password}});
 assert.equal((await api('/admin/stats',{token:publicLogin.data.token})).status,401);
 assert.equal((await api('/auth/me',{token:adminToken})).status,401);
});

test('estadísticas reales, búsqueda y paginación sin hashes ni contraseñas',async()=>{
 const stats=await api('/admin/stats',{token:adminToken});
 assert.equal(stats.status,200);assert.ok(stats.data.users>=3);assert.ok(stats.data.trips>=0);assert.ok(stats.data.notices>=0);
 const list=await api(`/admin/users?search=${encodeURIComponent(regularEmail)}`,{token:adminToken});
 assert.equal(list.status,200);assert.equal(list.data.total,1);assert.equal(list.data.users[0].id,regularId);
 assert.equal(list.data.users[0].password_hash,undefined);assert.equal(list.data.users[0].password,undefined);
 assert.equal((await api('/admin/users?page=-1',{token:adminToken})).status,400);
 assert.equal((await api('/admin/users?page=999999',{token:adminToken})).data.users.length,0);
});

test('desactivar no borra datos, revoca JWT y tokens; reactivar exige nuevo acceso',async()=>{
 const reset=newResetToken();await storePasswordReset(regularId,reset.hash,reset.expiresAt);
 const disabled=await api(`/admin/users/${regularId}/active`,{method:'PATCH',token:adminToken,body:{is_active:false}});
 assert.equal(disabled.status,200);assert.equal(disabled.data.user.is_active,0);
 assert.equal((await api('/auth/me',{token:regularToken})).status,403);
 assert.equal((await api('/auth/login',{body:{email:regularEmail,password}})).status,403);
 assert.equal((await api('/auth/reset-password',{body:{token:reset.token,password:'Nueva-clave-prueba-123'}})).status,400);
 const [[row]]=await pool.query('SELECT password_hash FROM users WHERE id=?',[regularId]);assert.ok(await bcrypt.compare(password,row.password_hash));
 assert.equal((await api(`/admin/users/${regularId}/active`,{method:'PATCH',token:adminToken,body:{is_active:true}})).status,200);
 assert.equal((await api('/auth/me',{token:regularToken})).status,401);
 assert.equal((await api('/auth/login',{body:{email:regularEmail,password}})).status,200);
 assert.equal((await api(`/admin/users/${adminId}/active`,{method:'PATCH',token:adminToken,body:{is_active:false}})).status,409);
 assert.equal((await api(`/admin/users/${adminId.toUpperCase()}/active`,{method:'PATCH',token:adminToken,body:{is_active:false}})).status,409);
 assert.equal((await api(`/admin/users/${regularId}/active`,{method:'PATCH',token:adminToken,body:{is_active:true,role:'admin'}})).status,400);
});

test('avisos: crear borrador, editar, publicar, retirar y validar; público solo ve publicados',async()=>{
 const title=`Aviso de prueba ${randomUUID()}`;
 const created=await api('/admin/notices',{token:adminToken,body:{title,content:'Texto público de prueba, sin datos simulados de viajes.',is_active:false}});
 assert.equal(created.status,201);noticeId=created.data.notice.id;
 let publicData=await api('/notices');assert.ok(!publicData.data.notices.some(n=>n.id===noticeId));
 const edited=await api(`/admin/notices/${noticeId}`,{method:'PUT',token:adminToken,body:{title:title+' editado',content:'Aviso actualizado de prueba.',is_active:true}});
 assert.equal(edited.status,200);assert.ok((await api('/notices')).data.notices.some(n=>n.id===noticeId));
 assert.equal((await api(`/admin/notices/${noticeId}`,{method:'PUT',token:adminToken,body:{title,content:'Aviso retirado.',is_active:false}})).status,200);
 assert.ok(!(await api('/notices')).data.notices.some(n=>n.id===noticeId));
 assert.equal((await api('/admin/notices',{token:adminToken,body:{title:'x',content:'x',is_active:'true'}})).status,400);
 assert.equal((await api('/admin/notices/99999999999999999999',{method:'PUT',token:adminToken,body:{title,content:'Contenido válido',is_active:true}})).status,400);
});

test('cambio de rol en la base retira acceso inmediatamente sin confiar en el JWT',async()=>{
 await pool.query("UPDATE users SET role='user' WHERE id=?",[adminId]);
 assert.equal((await api('/admin/stats',{token:adminToken})).status,403);
});

test('logout revoca en el servidor y mantiene independiente la sesión del viajero',async()=>{
 await pool.query("UPDATE users SET role='admin' WHERE id=?",[adminId]);
 const normal=await api('/auth/login',{body:{email:regularEmail,password}});
 const login=await api('/admin/login',{body:{email:adminEmail,password}});
 assert.match(login.data.token,/^[a-f0-9]{64}$/);assert.equal(login.data.idleTimeoutMs,900000);
 assert.equal((await api('/admin/logout',{token:login.data.token,method:'POST'})).status,204);
 assert.equal((await api('/admin/stats',{token:login.data.token})).status,401);
 assert.equal((await api('/auth/me',{token:normal.data.token})).status,200);
});

test('el backend rechaza sesiones con 15 minutos de inactividad aunque el cliente no cierre',async()=>{
 const login=await api('/admin/login',{body:{email:adminEmail,password}});
 const realNow=Date.now;
 try{
  Date.now=()=>realNow()+ADMIN_IDLE_MS+1000;
  assert.equal((await api('/admin/stats',{token:login.data.token})).status,401);
 }finally{Date.now=realNow;}
 assert.equal((await api('/admin/activity',{method:'POST',token:login.data.token})).status,401);
});
