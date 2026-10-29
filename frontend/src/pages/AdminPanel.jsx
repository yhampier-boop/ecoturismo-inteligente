import {useEffect,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useAdminAuth} from '../context/AdminAuthContext';
import './admin.css';

const EMPTY_NOTICE={title:'',content:'',is_active:false};
export default function AdminPanel(){
 const auth=useAdminAuth();
 if(!auth.user||auth.user.role!=='admin')return <Navigate to="/admin/login" replace/>;
 return <Panel key={auth.token} {...auth}/>;
}

function Panel({token,user,logout,request}){
 const [tab,setTab]=useState('dashboard'),[stats,setStats]=useState(null);
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[data,setData]=useState({users:[],notices:[],total:0});
 const [form,setForm]=useState({...EMPTY_NOTICE}),[editId,setEditId]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[reload,setReload]=useState(0),[denied,setDenied]=useState(false);
 function handleError(err){setError(err.message);if(err.status===401||err.status===403)setDenied(true);}
 useEffect(()=>{
  let active=true;setLoading(true);setError('');
  const timer=setTimeout(async()=>{
   try{
    const counts=await request('/admin/stats',{token});
    const result=tab==='dashboard'?null:await request(`/admin/${tab}?page=${page}${tab==='users'?`&search=${encodeURIComponent(search)}`:''}`,{token});
    if(active){setStats(counts);if(result)setData(result);}
   }catch(err){if(active)handleError(err);}
   finally{if(active)setLoading(false);}
  },tab==='users'?300:0);
  return()=>{active=false;clearTimeout(timer);};
  },[tab,page,search,reload,token,request]);
 function changeTab(value){setTab(value);setPage(1);setMessage('');setError('');setForm({...EMPTY_NOTICE});setEditId('');}
 async function changeActive(account){
  if(!window.confirm(`¿${account.is_active?'Desactivar':'Activar'} la cuenta de ${account.name}?`))return;
  setBusy(true);setError('');setMessage('');
  try{
   await request(`/admin/users/${encodeURIComponent(account.id)}/active`,{method:'PATCH',token,body:{is_active:!Number(account.is_active)}});
   setMessage(account.is_active?'Cuenta desactivada. Sus sesiones y enlaces de recuperación fueron invalidados.':'Cuenta activada. Puede volver a iniciar sesión.');setReload(v=>v+1);
  }catch(err){handleError(err);}finally{setBusy(false);}
 }
 async function saveNotice(event){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   await request(`/admin/notices${editId?`/${editId}`:''}`,{method:editId?'PUT':'POST',token,body:form});
   setMessage(form.is_active?'Aviso guardado y publicado.':'Aviso guardado sin publicar.');setForm({...EMPTY_NOTICE});setEditId('');setPage(1);setReload(v=>v+1);
  }catch(err){handleError(err);}finally{setBusy(false);}
 }
 async function publish(notice){
  setBusy(true);setError('');setMessage('');
  try{
   await request(`/admin/notices/${notice.id}`,{method:'PUT',token,body:{title:notice.title,content:notice.content,is_active:!Number(notice.is_active)}});
   setMessage(notice.is_active?'Aviso retirado del sitio público.':'Aviso publicado.');setReload(v=>v+1);
  }catch(err){handleError(err);}finally{setBusy(false);}
 }
 return <section className="container admin-panel">
  <header className="admin-heading"><div><span className="kicker">Administración</span><h1>Panel de control</h1><p>Hola, {user.name}. Usuarios, viajes y avisos del sitio.</p></div><button type="button" className="btn btn-outline" onClick={logout}>Cerrar sesión del panel</button></header>
  <nav className="admin-tabs" aria-label="Secciones de administración">
    {[['dashboard','Dashboard'],['users','Usuarios'],['notices','Avisos']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} disabled={busy||denied} onClick={()=>changeTab(id)}>{label}</button>)}
  </nav>
  {error&&<div role="alert" className="form-error">{error}</div>}
  {message&&<div role="status" className="form-success">{message}</div>}
  {denied?<p>Tu acceso ya no es válido. <Link to="/admin/login" onClick={logout}>Volver a iniciar sesión</Link></p>:<>
   {loading&&<p role="status">Cargando datos…</p>}
   {!loading&&error&&<button type="button" className="btn btn-outline" onClick={()=>setReload(v=>v+1)}>Reintentar</button>}
   {tab==='dashboard'&&stats&&<div className="admin-stats">{[['users','Usuarios'],['trips','Viajes'],['notices','Avisos']].map(([id,label])=><article key={id}><h2>{label}</h2><strong>{stats[id]}</strong></article>)}</div>}
   {tab==='users'&&<section aria-label="Gestión de usuarios">
    <label className="field-label" htmlFor="admin-search">Buscar usuarios por nombre o correo</label><input className="field-input" id="admin-search" type="search" maxLength={120} value={search} disabled={busy} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
    {!loading&&<><p>{data.total} cuentas encontradas</p><div className="admin-table-wrap"><table><caption className="sr-only">Usuarios registrados</caption><thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead><tbody>{(data.users||[]).map(account=><tr key={account.id}><td>{account.name}</td><td>{account.email}</td><td>{account.role==='admin'?'Administrador':'Usuario'}</td><td>{Number(account.is_active)===1?'Activa':'Inactiva'}</td><td><button type="button" className="btn btn-outline" disabled={busy||account.id===user.id} onClick={()=>changeActive(account)} aria-label={account.id===user.id?'Tu cuenta':`${account.is_active?'Desactivar':'Activar'} cuenta de ${account.name}`}>{account.id===user.id?'Tu cuenta':account.is_active?'Desactivar':'Activar'}</button></td></tr>)}</tbody></table></div>{!data.users?.length&&<p>No encontramos usuarios con esa búsqueda.</p>}</>}
   </section>}
   {tab==='notices'&&<section aria-label="Gestión de avisos">
    <h2>{editId?'Editar aviso':'Nuevo aviso'}</h2>
    <form className="auth-form admin-notice-form" onSubmit={saveNotice}>
     <fieldset disabled={busy}>
      <div className="auth-field"><label htmlFor="notice-title">Título del aviso</label><input id="notice-title" required minLength={3} maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></div>
      <div className="auth-field"><label htmlFor="notice-content">Contenido del aviso</label><textarea className="field-input" id="notice-content" required minLength={3} maxLength={5000} rows={4} value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></div>
      <label className="admin-checkbox"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Publicar en el sitio</label>
      <div className="admin-actions"><button className="btn btn-primary" type="submit">{busy?'Guardando…':editId?'Guardar cambios':'Crear aviso'}</button>{editId&&<button className="btn btn-outline" type="button" onClick={()=>{setEditId('');setForm({...EMPTY_NOTICE})}}>Cancelar edición</button>}</div>
     </fieldset>
    </form>
    {!loading&&<><h2>Avisos guardados ({data.total})</h2><div className="admin-notices">{(data.notices||[]).map(notice=><article key={notice.id}><h3>{notice.title}</h3><p className="admin-notice-content">{notice.content}</p><p>{Number(notice.is_active)===1?'Publicado':'Sin publicar'}</p><div className="admin-actions"><button className="btn btn-outline" type="button" disabled={busy} onClick={()=>{setEditId(notice.id);setForm({title:notice.title,content:notice.content,is_active:Number(notice.is_active)===1});document.getElementById('notice-title')?.focus()}}>Editar aviso</button><button className="btn btn-outline" type="button" disabled={busy} onClick={()=>publish(notice)}>{notice.is_active?'Retirar aviso':'Publicar aviso'}</button></div></article>)}</div>{!data.notices?.length&&<p>Todavía no hay avisos guardados.</p>}</>}
   </section>}
   {tab!=='dashboard'&&!loading&&<nav className="admin-pagination" aria-label="Paginación"><button type="button" className="btn btn-outline" disabled={busy||page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page} de {Math.max(1,Math.ceil(data.total/20))}</span><button type="button" className="btn btn-outline" disabled={busy||page*20>=data.total} onClick={()=>setPage(p=>p+1)}>Siguiente</button></nav>}
  </>}
 </section>;
}
