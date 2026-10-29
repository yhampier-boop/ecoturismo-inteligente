import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {request as apiRequest} from '../api';

const AdminContext=createContext(null);
export const ADMIN_IDLE_MS=15*60_000;
const ACTIVITY_SYNC_MS=30_000;

export function AdminAuthProvider({children}){
 const [session,setSession]=useState(null),[reason,setReason]=useState('');
 const current=useRef(null),lastActivity=useRef(0),lastSync=useRef(0);
 const generation=useRef(0);
 const revoke=useCallback(token=>apiRequest('/admin/logout',{method:'POST',token,keepalive:true}).catch(()=>null),[]);
 const logout=useCallback(async(message='')=>{
  generation.current++;
  const previous=current.current;current.current=null;setSession(null);setReason(typeof message==='string'?message:'');
  if(previous)await revoke(previous.token);
 },[revoke]);
 const login=useCallback(async(email,password)=>{
  await logout();
  const attempt=++generation.current;
  const data=await apiRequest('/admin/login',{method:'POST',body:{email,password}});
  if(attempt!==generation.current){await revoke(data.token);throw new Error('El acceso fue cancelado. Ingresa nuevamente tus credenciales.');}
  current.current=data;lastActivity.current=Date.now();lastSync.current=Date.now();setSession(data);setReason('');
 },[logout,revoke]);
 const request=useCallback(async(path,options={})=>{
  const active=current.current;
  if(!active)throw Object.assign(new Error('Ingresa nuevamente tus credenciales administrativas.'),{status:401});
  try{return await apiRequest(path,{...options,token:active.token});}
  catch(error){
   if((error.status===401||error.status===403)&&current.current===active)await logout(error.message);
   throw error;
  }
 },[logout]);

 useEffect(()=>{
  function expired(){
   if(current.current&&Date.now()-lastActivity.current>=ADMIN_IDLE_MS){void logout('La sesión terminó tras 15 minutos sin actividad. Ingresa nuevamente tus credenciales.');return true;}
   return false;
  }
  function activity(event){
   if(!event.isTrusted||!current.current||expired())return;
   lastActivity.current=Date.now();
   if(Date.now()-lastSync.current>=ACTIVITY_SYNC_MS){lastSync.current=Date.now();void request('/admin/activity',{method:'POST'}).catch(()=>{});}
  }
  function leave(){
   generation.current++;
   const previous=current.current;current.current=null;setSession(null);
   if(previous)void revoke(previous.token);
  }
  function resume(event){if(event.persisted)leave();else expired();}
  const events=['pointerdown','pointermove','keydown','wheel','touchstart'];
  for(const name of events)window.addEventListener(name,activity,{passive:true});
  window.addEventListener('pagehide',leave);window.addEventListener('pageshow',resume);
  window.addEventListener('focus',expired);document.addEventListener('visibilitychange',expired);
  const timer=setInterval(expired,1000);
  return()=>{
   clearInterval(timer);for(const name of events)window.removeEventListener(name,activity);
   window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',resume);
   window.removeEventListener('focus',expired);document.removeEventListener('visibilitychange',expired);
   generation.current++;const previous=current.current;current.current=null;if(previous)void revoke(previous.token);
  };
 },[logout,revoke,request]);
 return <AdminContext.Provider value={{token:session?.token||'',user:session?.user||null,reason,login,logout,request}}>{children}</AdminContext.Provider>;
}
export function useAdminAuth(){return useContext(AdminContext);}
