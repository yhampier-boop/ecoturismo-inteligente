import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {CalendarDays,ArrowRight,Plus,Trash2,Copy,Pencil,Leaf,AlertCircle,LogIn} from 'lucide-react';
import {request,dateNice} from '../api';
import {useAuth} from '../context/AuthContext';
import {EmptyState} from '../components/Common';

export default function SavedTrips(){
 const {user,token,loading}=useAuth();
 const navigate=useNavigate();
 const [params]=useSearchParams();
 const [trips,setTrips]=useState([]);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [loadingTrips,setLoadingTrips]=useState(true);

 useEffect(()=>{
  let active=true;setTrips([]);setError('');setLoadingTrips(Boolean(token));
  if(token)request('/trips',{token})
   .then(response=>{if(active)setTrips(response.trips)})
   .catch(err=>{if(active)setError(err.message)})
   .finally(()=>{if(active)setLoadingTrips(false)});
  return()=>{active=false};
 },[token]);

 const remove=async id=>{
  if(!window.confirm('¿Eliminar este itinerario? Esta acción no se puede deshacer.'))return;
  setBusy(id);setError('');setNotice('');
  try{await request(`/trips/${id}`,{method:'DELETE',token});setTrips(previous=>previous.filter(trip=>trip.id!==id));setNotice('Itinerario eliminado.')}
  catch(requestError){setError(requestError.message)}
  finally{setBusy('')}
 };

 const duplicate=async id=>{
  setBusy(id);setError('');setNotice('');
  try{const {trip}=await request(`/trips/${id}/duplicate`,{method:'POST',token});setTrips(previous=>[trip,...previous]);setNotice('Itinerario duplicado.')}
  catch(requestError){setError(requestError.message)}
  finally{setBusy('')}
 };

 if(!loading&&!user)return <>
  <section className="page-intro">
   <div className="container">
    <span className="kicker">Tu cuenta</span>
    <h1>Mis viajes.</h1>
    <p>Inicia sesión para ver y editar los itinerarios guardados en tu cuenta.</p>
   </div>
  </section>
  <section className="container page-auth-required">
   <EmptyState icon={LogIn} title="Tus itinerarios se guardan en tu cuenta" desc="Crea una cuenta o inicia sesión para consultar, editar y duplicar tus viajes.">
    <Link className="btn btn-primary" to="/acceso?next=%2Fmis-viajes">Iniciar sesión <ArrowRight size={16}/></Link>
   </EmptyState>
  </section>
 </>;

 return <>
  <section className="page-intro trips-intro">
   <div className="container trips-intro-row">
    <div>
     <span className="kicker">Tu cuenta</span>
     <h1>Mis viajes.</h1>
     <p>{user?`Hola, ${user.name.split(' ')[0]}. `:''}Itinerarios guardados para volver a ellos cuando quieras.</p>
    </div>
    <Link to="/planificar" className="btn btn-primary"><Plus size={17}/> Nuevo viaje</Link>
   </div>
  </section>

  <section className="container trips-section">
   <div className="trips-title">
    <div><h2>Itinerarios guardados</h2><p>{loadingTrips?'Consultando tu cuenta…':`${trips.length} ${trips.length===1?'viaje':'viajes'}`}</p></div>
   </div>

   {(notice||params.get('guardado'))&&<div role="status" className="form-success"><Leaf size={17}/>{notice||'Tu itinerario se guardó correctamente.'}</div>}
   {error&&<div role="alert" className="form-error"><AlertCircle size={17}/>{error}</div>}

   {loadingTrips?<p className="loading-text">Cargando viajes…</p>:trips.length?<div className="trip-list">
    {trips.map((trip,index)=><article className="trip-row" key={trip.id}>
     <span className="trip-row-index">{String(index+1).padStart(2,'0')}</span>
     <div className="trip-row-main">
      <p className="trip-row-dates"><CalendarDays size={13}/>{dateNice(trip.start_date)} — {dateNice(trip.end_date)}</p>
      <h2>{trip.title}</h2>
      <p className="trip-row-route">{trip.stops.map(stop=>stop.name).join(' → ')}</p>
       <p className="trip-row-meta">{trip.stops.length} {trip.stops.length===1?'destino':'destinos'} · {trip.transport_mode==='flight'?'En avión · conexión orientativa':trip.transport_mode==='walking'?'A pie':trip.transport_mode==='cycling'?'En bicicleta':'En auto'}</p>
     </div>
     <div className="trip-row-actions">
       <button type="button" disabled={Boolean(busy)} onClick={()=>navigate(`/planificar?edit=${trip.id}`)}><Pencil size={15}/> Editar</button>
       <button type="button" disabled={Boolean(busy)} onClick={()=>duplicate(trip.id)}><Copy size={15}/> Duplicar</button>
       <button type="button" className="delete-trip" disabled={Boolean(busy)} onClick={()=>remove(trip.id)} aria-label={`Eliminar ${trip.title}`} title="Eliminar itinerario"><Trash2 size={16}/></button>
     </div>
    </article>)}
   </div>:<EmptyState title="Todavía no hay viajes guardados" desc="Crea un itinerario y vuelve a él cuando quieras.">
    <Link className="btn btn-primary" to="/planificar">Crear mi primer viaje <ArrowRight size={16}/></Link>
   </EmptyState>}
  </section>
 </>;
}
