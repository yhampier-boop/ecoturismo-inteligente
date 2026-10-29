import {createHash,randomBytes} from 'node:crypto';

export const ADMIN_IDLE_MS=15*60_000;
const MAX_AGE_MS=8*60*60_000;
const digest=token=>createHash('sha256').update(token).digest('hex');

// Sesiones efímeras: nunca MySQL, cookies, localStorage ni JWT reutilizables.
// Un reinicio invalida todas. Para varias instancias hace falta un almacén compartido.
export function createAdminSessions({now=()=>Date.now(),maxSessions=1000}={}) {
 const sessions=new Map();
 function cleanup(){
  const time=now();
  for(const [key,session] of sessions)if(time-session.lastActivity>=ADMIN_IDLE_MS||time-session.createdAt>=MAX_AGE_MS)sessions.delete(key);
 }
 return {
  create(user){
   cleanup();
   if(sessions.size>=maxSessions)return null;
   const token=randomBytes(32).toString('hex');
   const session={id:user.id,version:Number(user.auth_version),createdAt:now(),lastActivity:now()};
   sessions.set(digest(token),session);
   return {token,expiresAt:session.lastActivity+ADMIN_IDLE_MS,idleTimeoutMs:ADMIN_IDLE_MS};
  },
  get(token,{touch=false}={}){
   cleanup();
   if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
   const session=sessions.get(digest(token));
   if(!session)return null;
   if(touch)session.lastActivity=now();
   return {...session,expiresAt:Math.min(session.lastActivity+ADMIN_IDLE_MS,session.createdAt+MAX_AGE_MS)};
  },
  revoke(token){if(typeof token==='string')sessions.delete(digest(token));},
  revokeUser(id){for(const [key,session] of sessions)if(session.id===id)sessions.delete(key);},
  cleanup
 };
}

export const adminSessions=createAdminSessions();
const timer=setInterval(()=>adminSessions.cleanup(),60_000);timer.unref();
