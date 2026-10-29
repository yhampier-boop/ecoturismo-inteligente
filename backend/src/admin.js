import {Router} from 'express';
import {rateLimit} from './rateLimit.js';
import {adminStats,adminUsers,setUserActive,listNotices,writeNotice} from './adminDatabase.js';
import {findUserById} from './database.js';
import {adminSessions} from './adminSessions.js';

const validPage=value=>value==null?1:/^[1-9]\d{0,5}$/.test(String(value))?Number(value):null;
const validNoticeId=id=>/^[1-9]\d{0,19}$/.test(id)&&BigInt(id)<=18446744073709551615n;

export function adminRouter({route,authenticate,safeUser,sessions=adminSessions}) {
 const router=Router();
 router.post('/login',rateLimit({limit:10}),route(async(req,res)=>{
  const account=await authenticate(req.body?.email,req.body?.password);
  if(!account)return res.status(401).json({error:'Correo o contraseña incorrectos.'});
  if(Number(account.is_active)!==1)return res.status(403).json({error:'La cuenta está desactivada. Contacta al administrador.'});
  if(account.role!=='admin')return res.status(403).json({error:'Esta cuenta no tiene acceso al panel de administración.'});
  const session=sessions.create(account);
  if(!session)return res.status(503).json({error:'Hay demasiadas sesiones abiertas. Inténtalo de nuevo más tarde.'});
  return res.json({user:safeUser(account),...session,sessionType:'admin'});
 }));
 // Cerrar es idempotente, incluso si ya expiró. No acepta el token en URL/cuerpo.
 router.post('/logout',(req,res)=>{
  sessions.revoke((req.headers.authorization||'').replace(/^Bearer\s+/i,''));
  return res.status(204).end();
 });
 router.use(route(async(req,res,next)=>{
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const session=sessions.get(token);
  if(!session)return res.status(401).json({error:'La sesión administrativa terminó. Ingresa nuevamente tu correo y contraseña.'});
  const account=await findUserById(session.id);
  if(!account||account.role!=='admin'||Number(account.is_active)!==1||Number(account.auth_version)!==session.version){
   sessions.revoke(token);return res.status(403).json({error:'La cuenta ya no tiene acceso administrativo. Vuelve a iniciar sesión.'});
  }
  req.account=account;req.user={id:account.id};
  const active=sessions.get(token,{touch:req.path!=='/me'});
  if(!active)return res.status(401).json({error:'La sesión administrativa ha vencido. Vuelve a iniciar sesión.'});
  req.adminSession=active;next();
 }));
 router.post('/activity',(req,res)=>res.json({expiresAt:req.adminSession.expiresAt}));
 router.get('/me',(req,res)=>res.json({user:safeUser(req.account)}));
 router.get('/stats',route(async(_req,res)=>res.json(await adminStats())));
 router.get('/users',route(async(req,res)=>{
  const page=validPage(req.query.page);
  if(!page)return res.status(400).json({error:'Página inválida.'});
  return res.json(await adminUsers(String(req.query.search||'').trim().slice(0,120),page));
 }));
 router.patch('/users/:id/active',route(async(req,res)=>{
  if(!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(req.params.id)||typeof req.body?.is_active!=='boolean')return res.status(400).json({error:'Envía una cuenta válida y un estado activo o inactivo.'});
  if(Object.keys(req.body).some(key=>key!=='is_active'))return res.status(400).json({error:'Solo se permite cambiar el estado de la cuenta, no sus permisos.'});
  const result=await setUserActive(req.params.id,req.body.is_active,req.user.id);
  if(!result.error&&!req.body.is_active)sessions.revokeUser(result.user.id);
  return res.status(result.status||200).json(result.error?{error:result.error}:{user:result.user});
 }));
 router.get('/notices',route(async(req,res)=>{
  const page=validPage(req.query.page);
  if(!page)return res.status(400).json({error:'Página inválida.'});
  return res.json(await listNotices({page}));
 }));
 const saveNotice=route(async(req,res)=>{
  const title=typeof req.body?.title==='string'?req.body.title.trim():'';
  const content=typeof req.body?.content==='string'?req.body.content.trim():'';
  if(title.length<3||title.length>160||content.length<3||content.length>5000||typeof req.body?.is_active!=='boolean')return res.status(400).json({error:'Escribe un título de 3 a 160 caracteres, un contenido de 3 a 5000 y un estado válido.'});
  if(req.params.id&&!validNoticeId(req.params.id))return res.status(400).json({error:'Identificador de aviso inválido.'});
  const notice=await writeNotice({id:req.params.id,title,content,active:req.body.is_active});
  if(!notice)return res.status(404).json({error:'Aviso no encontrado.'});
  return res.status(req.params.id?200:201).json({notice});
 });
 router.post('/notices',saveNotice);
 router.put('/notices/:id',saveNotice);
 return router;
}
