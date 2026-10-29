import {useEffect,useMemo,useRef,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowRight,Plus,X,ChevronUp,ChevronDown,CalendarDays,Car,Bike,Footprints,Plane,MapPin,Save,Route,Leaf,Check,LoaderCircle,AlertCircle,Compass} from 'lucide-react';
import {request,durationText,dateNice,todayLocal,addDays} from '../api';
import {useAuth} from '../context/AuthContext';
import RouteMap from '../components/RouteMap';
import PlaceAutocomplete from '../components/PlaceAutocomplete';
import {ApiNotice,placeLabel} from '../components/Common';

const transport=[
 {id:'driving',label:'En auto',icon:Car},
 {id:'walking',label:'A pie',icon:Footprints},
 {id:'cycling',label:'En bicicleta',icon:Bike},
 {id:'flight',label:'En avión',icon:Plane}
];
const DEFAULT_DRAFT={title:'Mi próxima aventura',startDate:todayLocal(),endDate:addDays(todayLocal(),2),mode:'driving',stops:[]};

export default function Planner(){
 const navigate=useNavigate();
 const [params,setParams]=useSearchParams();
 const {user,token,loading:authLoading}=useAuth();
 const [destinations,setDestinations]=useState([]);
 const [ready,setReady]=useState(false);
 const [draft,setDraft]=useState({...DEFAULT_DRAFT});
 const [selectedPlace,setSelectedPlace]=useState(null);
 const [placeReset,setPlaceReset]=useState(0);
 const [adding,setAdding]=useState(false);
 const [estimate,setEstimate]=useState(null);
 const [loadingRoute,setLoadingRoute]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [editId,setEditId]=useState('');
 const routeKey=JSON.stringify([draft.mode,draft.stops.map(stop=>stop.destination_id)]);
 const currentRouteKey=useRef(routeKey);
 currentRouteKey.current=routeKey;

 useEffect(()=>{
  if(authLoading)return;
  if(params.get('edit')&&!token){navigate(`/acceso?next=${encodeURIComponent(`/planificar?edit=${params.get('edit')}`)}`,{replace:true});return;}
  let ok=true;
  setReady(false);setError('');setEstimate(null);setEditId('');
  request('/destinations?includeExternal=1').then(async ({destinations:list})=>{
   if(!ok)return;
   setDestinations(list);
   const id=params.get('edit');
   const added=params.get('add');
   const pending=sessionStorage.getItem('eco_pending_draft')||sessionStorage.getItem('eco_planner_draft');
   if(id&&token){
    try{
     const {trip}=await request(`/trips/${encodeURIComponent(id)}`,{token});
     if(ok){
      setEditId(id);
      setDraft({title:trip.title,startDate:trip.start_date,endDate:trip.end_date,mode:trip.transport_mode,stops:trip.stops.map(stop=>({destination_id:stop.destination_id,visit_date:stop.visit_date,duration_min:stop.duration_min,notes:stop.notes}))});
      setEstimate(trip.segments.length?{source:trip.route_source,geometry:trip.route_geometry,totalKm:trip.route_total_km,totalMinutes:trip.route_total_minutes,segments:trip.segments.map(segment=>({distanceKm:segment.estimated_distance_km,durationMinutes:segment.estimated_minutes,demo:Boolean(segment.is_demo)}))}:null);
     }
    }catch(requestError){if(ok)setError(requestError.message)}
   }else if(pending){
    try{
     const parsed=JSON.parse(pending);
     if(ok&&Array.isArray(parsed.stops)&&parsed.stops.length<=10){
      const restored={...DEFAULT_DRAFT,...parsed};
      if(added&&list.some(d=>d.id===added)&&restored.stops.length<10)restored.stops=[...restored.stops,{destination_id:added,visit_date:restored.startDate,duration_min:120}];
      setDraft(restored);setNotice('Recuperamos tu borrador. Puedes guardarlo cuando quieras.');
     }
    }catch{}
    sessionStorage.removeItem('eco_pending_draft');
   }else if(added&&list.some(destination=>destination.id===added)){
    setDraft(previous=>({...previous,stops:[{destination_id:added,visit_date:previous.startDate}]}));
   }
  }).catch(requestError=>{if(ok)setError(requestError.message)}).finally(()=>{if(ok)setReady(true)});
  return()=>{ok=false};
 },[params.get('edit'),params.get('add'),token,authLoading]);

 useEffect(()=>{if(ready&&!params.get('edit'))sessionStorage.setItem('eco_planner_draft',JSON.stringify(draft));},[draft,ready,params.get('edit')]);
 // Consumir la acción impide añadir otra vez la parada al recargar la página.
 // Se ejecuta después de persistir el borrador actualizado.
 useEffect(()=>{
  if(ready&&params.get('add')&&!params.get('edit')){
   const next=new URLSearchParams(params);next.delete('add');setParams(next,{replace:true});
  }
 },[ready,params.get('add'),params.get('edit')]);

 const stopDests=useMemo(()=>draft.stops.map(stop=>destinations.find(destination=>destination.id===stop.destination_id)).filter(Boolean),[draft.stops,destinations]);
 const setField=(key,value)=>{setDraft(previous=>({...previous,[key]:value}));if(['mode','stops'].includes(key))setEstimate(null)};
 const addStop=async()=>{
  setError('');
  if(!selectedPlace)return setError('Selecciona una ciudad de las sugerencias para añadirla.');
  if(draft.stops.length>=10)return setError('Máximo 10 paradas.');
  setAdding(true);
  try{
   let destination=destinations.find(item=>item.id===selectedPlace.id);
   if(!destination){
    if(selectedPlace.saved){
     const {destination:fetched}=await request(`/destinations/${encodeURIComponent(selectedPlace.id)}`);
     destination=fetched;
    }else{
     if(!selectedPlace.countryCode)throw new Error('La sugerencia no incluye un país válido. Busca la ciudad nuevamente.');
     const {destination:created}=await request('/destinations/ensure',{
      method:'POST',
      body:{
       name:selectedPlace.name,
       region:selectedPlace.region,
       countryCode:selectedPlace.countryCode,
       lat:selectedPlace.lat,
        lon:selectedPlace.lon,
        proof:selectedPlace.proof
      }
     });
     destination=created;
    }
    if(!destination)throw new Error('No se pudo registrar la ciudad seleccionada.');
    setDestinations(previous=>previous.some(item=>item.id===destination.id)?previous:[...previous,destination]);
   }
   setDraft(previous=>({...previous,stops:[...previous.stops,{destination_id:destination.id,visit_date:previous.startDate,duration_min:120}]}));
   setEstimate(null);
   setSelectedPlace(null);
   setPlaceReset(previous=>previous+1);
  }catch(requestError){
   setError(requestError.message||'No se pudo añadir la ciudad seleccionada.');
  }finally{
   setAdding(false);
  }
 };
 const removeStop=index=>{setField('stops',draft.stops.filter((_,stopIndex)=>stopIndex!==index));setEstimate(null)};
 const moveStop=(index,delta)=>{
  const nextIndex=index+delta;
  if(nextIndex<0||nextIndex>=draft.stops.length)return;
  const stops=[...draft.stops];
  [stops[index],stops[nextIndex]]=[stops[nextIndex],stops[index]];
  setField('stops',stops);
 };
 const patchStop=(index,patch)=>setDraft(previous=>({...previous,stops:previous.stops.map((stop,stopIndex)=>stopIndex===index?{...stop,...patch}:stop)}));

 const calculate=async()=>{
  if(draft.stops.length<2)return setError('Agrega por lo menos dos paradas para calcular la distancia.');
  setError('');setLoadingRoute(true);
  const calculatingKey=routeKey;
  try{
   const coordinates=draft.stops.map(stop=>{
    const destination=destinations.find(item=>item.id===stop.destination_id);
    return {lat:destination?.lat,lon:destination?.lon};
   });
   const response=await request('/routes',{method:'POST',body:{coordinates,mode:draft.mode}});
   if(currentRouteKey.current===calculatingKey)setEstimate(response);
  }catch(requestError){setError(requestError.message)}finally{setLoadingRoute(false)}
 };

 const save=async()=>{
  setError('');setNotice('');
  if(draft.title.trim().length<3)return setError('Escribe un nombre de al menos 3 caracteres.');
  if(draft.startDate>draft.endDate)return setError('La fecha final debe ser igual o posterior a la inicial.');
  if(draft.stops.length<1)return setError('Agrega al menos una parada.');
  if(draft.stops.some(stop=>stop.visit_date<draft.startDate||stop.visit_date>draft.endDate))return setError('Revisa las fechas de las paradas: deben estar dentro del viaje.');
  if(!user){
   sessionStorage.setItem('eco_pending_draft',JSON.stringify(draft));
   navigate('/acceso?next=%2Fplanificar');
   return;
  }
  setBusy(true);
  try{
   const path=editId?`/trips/${encodeURIComponent(editId)}`:'/trips';
    const {trip}=await request(path,{method:editId?'PUT':'POST',body:draft,token});
    sessionStorage.removeItem('eco_pending_draft');sessionStorage.removeItem('eco_planner_draft');
   navigate(`/mis-viajes?guardado=${trip.id}`);
  }catch(requestError){setError(requestError.message)}finally{setBusy(false)}
 };

 return <>
  <section className="page-intro planner-intro">
   <div className="container">
    <span className="kicker">Planificador</span>
    <h1>Ordena tu recorrido.</h1>
    <p>Elige fechas, destinos y transporte. Las rutas terrestres usan OpenRouteService o una estimación DEMO identificada. En avión se muestran conexiones orientativas, no vuelos disponibles.</p>
   </div>
  </section>

  <section className="container planner-layout">
   <fieldset className="planner-form planner-fields" disabled={!ready||busy||loadingRoute||adding} aria-busy={!ready||busy||loadingRoute||adding}>
    {!ready&&<p role="status">Cargando planificador…</p>}
    <section className="planner-card">
     <div className="planner-card-title">
      <div><h2>1. Datos del viaje</h2><p>Ponle un nombre y define las fechas.</p></div>
     </div>
     <label className="field-label" htmlFor="triptitle">Nombre del itinerario</label>
     <input id="triptitle" className="field-input" maxLength={160} placeholder="Ej. Una semana por el sur de Perú" value={draft.title} onChange={event=>setField('title',event.target.value)}/>
     <div className="field-row">
      <div><label className="field-label" htmlFor="startDate">Fecha de inicio</label><input className="field-input" type="date" id="startDate" value={draft.startDate} onChange={event=>{setField('startDate',event.target.value);setDraft(previous=>({...previous,stops:previous.stops.map(stop=>({...stop,visit_date:event.target.value}))}))}}/></div>
      <div><label className="field-label" htmlFor="endDate">Fecha de fin</label><input className="field-input" type="date" min={draft.startDate} id="endDate" value={draft.endDate} onChange={event=>setField('endDate',event.target.value)}/></div>
     </div>
    </section>

    <section className="planner-card">
     <div className="planner-card-title">
      <div><h2>2. Paradas</h2><p>Agrega los lugares que quieres visitar.</p></div>
     </div>
     <label className="field-label" htmlFor="destination-search">Añadir un destino</label>
     <div className="select-add">
      <PlaceAutocomplete
       inputId="destination-search"
       onSelect={setSelectedPlace}
       resetKey={placeReset}
       disabled={adding}
      />
      <button className="btn btn-primary" onClick={addStop} type="button" disabled={!selectedPlace||adding||draft.stops.length>=10}>
       {adding?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>} Añadir
      </button>
     </div>
     <p className="small-help">Selecciona una sugerencia de la lista. El texto libre no se añade como parada.</p>

     {draft.stops.length?<div className="stop-list">
      {draft.stops.map((stop,index)=>{
       const destination=destinations.find(item=>item.id===stop.destination_id);
       return <div className="stop-item" key={`${stop.destination_id}-${index}`}>
        <div className="stop-index">{index+1}</div>
        <div className="stop-data">
         <strong>{destination?.name||stop.destination_id}</strong>
         <small><MapPin size={12}/>{destination?placeLabel(destination):'Destino sin datos de ubicación'}</small>
         <label>Fecha de visita <input aria-label={`Fecha de visita de ${destination?.name}`} type="date" min={draft.startDate} max={draft.endDate} value={stop.visit_date||draft.startDate} onChange={event=>patchStop(index,{visit_date:event.target.value})}/></label>
        </div>
        <div className="stop-actions">
         <button type="button" title="Subir parada" aria-label="Subir parada" disabled={index===0} onClick={()=>moveStop(index,-1)}><ChevronUp size={17}/></button>
         <button type="button" title="Bajar parada" aria-label="Bajar parada" disabled={index===draft.stops.length-1} onClick={()=>moveStop(index,1)}><ChevronDown size={17}/></button>
         <button type="button" title="Quitar parada" aria-label="Quitar parada" onClick={()=>removeStop(index)}><X size={17}/></button>
        </div>
       </div>;
      })}
     </div>:<div className="stop-empty"><Compass size={21}/><span>Todavía no agregaste paradas a tu recorrido.</span></div>}
     <p className="small-help">Puedes agregar hasta 10 paradas, repetir destinos y cambiar el orden cuando quieras.</p>
    </section>

    <section className="planner-card">
     <div className="planner-card-title">
      <div><h2>3. Transporte</h2><p>Elige cómo vas a moverte entre paradas.</p></div>
     </div>
     <div className="transport-choices">
       {transport.map(({id,label,icon:Icon})=><button type="button" key={id} disabled={loadingRoute||busy} aria-pressed={draft.mode===id} onClick={()=>setField('mode',id)} className={draft.mode===id?'active':''}><Icon size={20}/><span>{label}</span></button>)}
     </div>
     <div className="sustainability-hint"><Leaf size={18}/><p>Caminar o pedalear puede ser una alternativa más sostenible cuando el recorrido lo permita.</p></div>
    </section>

    {error&&<div role="alert" className="form-error"><AlertCircle size={18}/>{error}</div>}
    {notice&&<div role="status" className="form-success"><Check size={18}/>{notice}</div>}

    <div className="planner-action-row">
     <button type="button" className="btn btn-outline" onClick={calculate} disabled={loadingRoute||draft.stops.length<2}>{loadingRoute?<LoaderCircle className="spin" size={17}/>:<Route size={17}/>}Calcular recorrido</button>
     <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>} {editId?'Actualizar viaje':'Guardar itinerario'}</button>
    </div>
    <p className="small-help">Guardar un itinerario requiere una cuenta gratuita. Si la ruta real no está disponible, la estimación se identifica como DEMO.</p>
   </fieldset>

   <div className="planner-preview">
    <section className="preview-card">
     <div className="preview-head">
      <div><h2>Tu recorrido</h2><span>{draft.stops.length} {draft.stops.length===1?'parada':'paradas'}</span></div>
      <MapPin size={20} aria-hidden="true"/>
     </div>
      <RouteMap destinations={stopDests} geometry={estimate?.geometry} mode={draft.mode}/>
     <div className="preview-stats">
      <div><span>Paradas</span><strong>{draft.stops.length}</strong></div>
       <div><span>{draft.mode==='flight'?'Distancia geodésica':estimate?.source==='openrouteservice'?'Distancia':'Distancia aprox.'}</span><strong>{estimate?`${estimate.totalKm} km`:'—'}</strong></div>
      <div><span>{estimate?.source==='openrouteservice'?'Tiempo':'Tiempo aprox.'}</span><strong>{estimate?durationText(estimate.totalMinutes):'—'}</strong></div>
     </div>
      <ApiNotice kind="route" source={estimate?.source}/>
      {(estimate?.message||draft.mode==='flight')&&<p className="api-notice" role="status">{estimate?.message||'En avión: conexiones orientativas. No se comprueba que existan vuelos ni aeropuertos; no hay precios, horarios o duración disponibles.'}</p>}
    </section>

    <section className="preview-card itinerary-preview">
     <div className="preview-head">
      <div><h2>Itinerario</h2><span>{stopDests.length} {stopDests.length===1?'destino':'destinos'}</span></div>
      <CalendarDays size={20} aria-hidden="true"/>
     </div>
     <div className="itinerary-list">
      {stopDests.length?stopDests.map((destination,index)=><div className="itinerary-item" key={`${destination.id}-${index}`}>
       <span className="itinerary-point">{index+1}</span>
       <div>
        <strong>{destination.name}</strong>
        <p>{dateNice(draft.stops[index]?.visit_date||draft.startDate)}</p>
        {estimate?.segments[index]&&<span className="leg-description">Siguiente tramo: {estimate.segments[index].distanceKm} km{estimate.segments[index].demo?' DEMO':''} · {durationText(estimate.segments[index].durationMinutes)}</span>}
       </div>
      </div>):<p className="muted">Tus paradas aparecerán aquí cuando las añadas.</p>}
     </div>
    </section>
   </div>
  </section>
 </>;
}
