import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,MapPin,Clock3,Mountain,CloudSun,Check,Thermometer,Droplets,Wind,Camera} from 'lucide-react';
import {request} from '../api';
import {ApiNotice,DestinationCard,DestinationImage,placeLabel} from '../components/Common';
import {useDestinationPhotos} from '../data/destinationPhotos';

export default function Destination(){
 const {id}=useParams();
 const navigate=useNavigate();
 const [d,setD]=useState(null);
 const [related,setRelated]=useState([]);
 const [error,setError]=useState('');
 const [weather,setWeather]=useState(null);
 const photoState=useDestinationPhotos(d);

 useEffect(()=>{
  window.scrollTo(0,0);
  let active=true;
  setD(null);setRelated([]);setError('');setWeather(null);
  Promise.all([request(`/destinations/${id}`),request('/destinations').catch(()=>({destinations:[]}))])
   .then(([one,all])=>{
    if(!active)return;
    const current=one.destination;
    setD(current);
    const others=all.destinations.filter(destination=>destination.id!==current.id);
    const sameRegion=others.filter(destination=>destination.region===current.region);
    const sameCategory=others.filter(destination=>destination.category===current.category&&!sameRegion.some(item=>item.id===destination.id));
    const picked=[...sameRegion,...sameCategory];
    for(const item of others){
     if(picked.length>=3)break;
     if(!picked.some(pickedItem=>pickedItem.id===item.id))picked.push(item);
    }
    setRelated(picked.slice(0,3));
   })
   .catch(requestError=>{if(active)setError(requestError.message)});
  return()=>{active=false};
 },[id]);

 useEffect(()=>{
  if(!d)return;
  const controller=new AbortController();
  setWeather(null);
  request(`/weather?lat=${encodeURIComponent(d.lat)}&lon=${encodeURIComponent(d.lon)}`,{signal:controller.signal})
   .then(setWeather)
   .catch(()=>{if(!controller.signal.aborted)setWeather({source:'unavailable',message:'No se pudo consultar el clima en este momento.'})});
  return()=>controller.abort();
 },[d?.id]);

 if(error)return <section className="container page-message">
  <span className="kicker">Destino no disponible</span>
  <h1>No pudimos abrir esta ficha.</h1>
  <p>{error}</p>
  <Link className="btn btn-primary" to="/explorar">Volver a explorar</Link>
 </section>;

 if(!d)return <div className="container page-loading"><span>Cargando destino…</span></div>;

 const heroMedia=photoState.hero;
 const gallery=photoState.gallery;
 const forecast=weather?.forecast||[];

 return <>
  <section className="detail-hero">
   <DestinationImage key={d.id} destination={d} priority showNote={false}/>
   <div className="detail-shade" aria-hidden="true"/>
   <div className="container detail-hero-inner">
    <Link className="back-link light" to="/explorar"><ArrowLeft size={17}/> Volver a destinos</Link>
    <span className="detail-tag">{d.category}</span>
    <h1>{d.name}</h1>
    <p className="detail-location"><MapPin size={17}/>{placeLabel(d)}</p>
   </div>
   {heroMedia?.author
    ?<a className="detail-credit" href={heroMedia.photoUrl||heroMedia.authorUrl} target="_blank" rel="noreferrer">{photoState.source==='unsplash'?'Foto de referencia: ':'Foto: '}{heroMedia.author} / Unsplash</a>
    :photoState.status==='empty'?<span className="detail-credit">Imagen de referencia</span>:null}
  </section>

  <section className="container destination-content">
   <div className="destination-main">
    <div className="destination-intro">
     <span className="kicker">Sobre el destino</span>
     <h2>{d.name}, {d.region}.</h2>
     <p className="detail-desc">{d.description}</p>
    </div>

    <div className="destination-facts">
     <div><Clock3 size={19}/><span>Tiempo recomendado</span><strong>{d.duration}</strong></div>
     <div><Mountain size={19}/><span>Altitud aproximada</span><strong>{d.altitude||'—'}</strong></div>
     <div><MapPin size={19}/><span>Ubicación</span><strong>{placeLabel(d)}</strong></div>
    </div>

    {d.highlights?.length>0&&<section className="detail-section destination-highlights">
     <span className="kicker">Para tu visita</span>
     <h3>Lugares y experiencias</h3>
     <ul className="highlights">
      {d.highlights.map(highlight=><li key={highlight}><Check size={15}/>{highlight}</li>)}
     </ul>
    </section>}

    <section className="detail-section weather-section">
     <div className="detail-section-head">
      <div>
       <span className="kicker">Clima</span>
       <h3>Qué esperar en {d.name}</h3>
       <p>Consulta las condiciones actuales antes de visitar.</p>
      </div>
      <CloudSun size={24} aria-hidden="true"/>
     </div>
     {weather?.source==='openweather'&&weather.current?<>
      <div className="weather-live">
       <div className="weather-current">
        <img src={weather.current.iconUrl} alt={weather.current.description}/>
        <div>
         <span>En este momento</span>
         <strong>{weather.current.temperatureC} °C</strong>
         <p>{weather.current.description}</p>
        </div>
       </div>
       <div className="weather-metrics">
         <div><Thermometer size={18}/><span>Sensación térmica</span><strong>{weather.current.feelsLikeC??'—'} °C</strong></div>
         <div><Droplets size={18}/><span>Humedad</span><strong>{weather.current.humidity??'—'}%</strong></div>
         <div><Wind size={18}/><span>Viento</span><strong>{weather.current.windKph??'—'} km/h</strong></div>
       </div>
      </div>
      {forecast.length>0&&<div className="weather-forecast">
       {forecast.map(day=><div key={day.date}>
        <img src={day.iconUrl} alt=""/>
        <strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString('es-PE',{weekday:'long'})}</strong>
         <span>{day.temperatureC??'—'} °C</span>
        <small>{day.description}</small>
       </div>)}
      </div>}
     </>:<div className="weather-unavailable">
      <CloudSun size={24}/>
      <div><strong>Clima no disponible</strong><p>{weather?.message||'Consultando información meteorológica…'}</p></div>
     </div>}
     <ApiNotice kind="weather" source={weather?.source}/>
    </section>

    <section className="detail-section gallery-section">
     <div className="detail-section-head">
      <div>
       <span className="kicker">Fotografías</span>
       <h3>{d.name} en imágenes</h3>
      </div>
      <Camera size={22} aria-hidden="true"/>
     </div>
     {gallery.length?<div className="photo-gallery">
      {gallery.map((photo,index)=><figure key={`${photo.photoUrl||photo.src}-${index}`}>
       <img src={photo.src} alt={photo.alt||`Fotografía de referencia de ${d.name}`} loading="lazy"/>
       <figcaption>
        {photoState.source==='unsplash'?'Foto de referencia: ':photo.author?'Foto: ':''}
        {photo.authorUrl?<a href={photo.authorUrl} target="_blank" rel="noreferrer">{photo.author}</a>:photo.author}
        {photo.author?' · ':''}<a href={photo.photoUrl||`https://unsplash.com/s/photos/${encodeURIComponent(d.name)}`} target="_blank" rel="noreferrer">Unsplash</a>
       </figcaption>
      </figure>)}
     </div>:<div className="gallery-empty"><span>{photoState.loading?'Buscando fotografías en Unsplash…':photoState.source==='fallback'?photoState.message||'No hay fotografías disponibles para este destino en este momento. Se muestra una imagen de referencia.':photoState.source==='local'?'Este destino tiene una imagen principal, pero no una galería adicional.':'No hay fotografías adicionales disponibles para este destino.'}</span></div>}
     {photoState.source==='unsplash'&&<p className="photo-source">Fotografías de referencia obtenidas de Unsplash para “{d.name}”. Pueden mostrar escenas relacionadas y no garantizan representar el lugar exacto. <a href={`https://unsplash.com/s/photos/${encodeURIComponent(d.name)}`} target="_blank" rel="noreferrer">Ver más en Unsplash</a>.</p>}
     {photoState.source==='fallback'&&<p className="photo-source">Unsplash no devolvió fotografías para este destino. La imagen mostrada es un respaldo visual y no representa el lugar. <a href={`https://unsplash.com/s/photos/${encodeURIComponent(d.name)}`} target="_blank" rel="noreferrer">Buscar en Unsplash</a>.</p>}
     {photoState.source==='local'&&<p className="photo-source">Fotografías del catálogo local con sus créditos correspondientes.</p>}
    </section>
   </div>

   <aside className="destination-aside">
    <div className="aside-block">
     <span className="kicker">Planifica tu visita</span>
     <h2>Incluye {d.name} en tu recorrido.</h2>
     <p>Agrega este destino al planificador y revisa cómo se conecta con el resto de tus paradas.</p>
     <div className="aside-actions">
      <button className="btn btn-primary full" onClick={()=>navigate(`/planificar?add=${d.id}`)}>Agregar a mi viaje <ArrowRight size={16}/></button>
      <a className="btn btn-outline full" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(d.lat)}&mlon=${encodeURIComponent(d.lon)}#map=11/${encodeURIComponent(d.lat)}/${encodeURIComponent(d.lon)}`}>Ver ubicación</a>
     </div>
    </div>

    <div className="aside-block aside-facts">
     <span className="kicker">Datos prácticos</span>
     <div><span>Categoría</span><strong>{d.category}</strong></div>
     <div><span>Región</span><strong>{d.region}</strong></div>
     <div><span>Tiempo recomendado</span><strong>{d.duration}</strong></div>
     <div><span>Altitud</span><strong>{d.altitude||'—'}</strong></div>
    </div>

     <p className="aside-note">{d.external?`Lugar identificado con ${d.provider==='photon'?'Photon / OpenStreetMap':'OpenWeather Geocoding'}. No incluye horarios, precios ni datos turísticos verificados; las imágenes de Unsplash son referencias visuales. `:''}El clima se consulta con OpenWeather. Las rutas terrestres usan OpenRouteService o una estimación DEMO; las conexiones aéreas son ilustrativas.</p>
   </aside>
  </section>

  {related.length>0&&<section className="container related-destinations">
   <div className="section-head">
    <div className="section-head-copy">
     <span className="kicker">Sigue explorando</span>
     <h2>Otros lugares del catálogo.</h2>
    </div>
    <Link className="inline-link" to="/explorar">Ver todos los destinos <ArrowRight size={16}/></Link>
   </div>
   <div className="related-grid">
    {related.map(destination=><DestinationCard key={destination.id} destination={destination} compact/>)}
   </div>
  </section>}
 </>;
}
