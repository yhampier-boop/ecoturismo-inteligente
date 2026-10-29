// Vite usa su proxy en desarrollo. En una compilación local/preview se conecta
// directamente al backend para evitar que el servidor estático responda HTML a /api.
const API=(import.meta.env.VITE_API_URL || (import.meta.env.DEV?'':'http://localhost:4000')).replace(/\/$/,'');
export async function request(path,{method='GET',body,token,signal,keepalive=false}={}){
 let res;
 try{res=await fetch(`${API}/api${path}`,{
   method, signal, keepalive,
   headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });}catch(error){
  if(error.name==='AbortError')throw error;
  throw new Error('No se pudo conectar con el servidor. Inicia el proyecto con “npm run dev”.');
 }
 if(res.status===204)return null;
 let data;
 try{data=await res.json()}catch{
  throw new Error(res.status>=500?'El servidor no está disponible. Verifica que el backend esté iniciado.':'La respuesta del servidor no es válida.');
 }
 if(!res.ok){const error=new Error(data.error||'No se pudo completar la solicitud.');error.status=res.status;throw error;}
 return data;
}
export function durationText(minutes){
  if(minutes==null||!Number.isFinite(Number(minutes)))return 'No disponible';
 const h=Math.floor(minutes/60),m=minutes%60;
 return `${h?h+' h ':''}${m?m+' min':!h?'0 min':''}`.trim();
}
export function dateNice(iso){
 if(!iso)return '';
 const [y,m,d]=iso.split('-').map(Number);
 return new Date(y,m-1,d).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'});
}
export function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function addDays(date,n=1){const [y,m,d]=date.split('-').map(Number);const dt=new Date(y,m-1,d+n);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
