import {ArrowRight,MapPin,Compass} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useEffect,useState} from 'react';
import {useDestinationPhotos} from '../data/destinationPhotos';

const FALLBACK_PHOTO='/images/destination-fallback.svg';

export function placeLabel(destination){
 const region=String(destination?.region||'').trim();
 const country=String(destination?.country||'').trim();
 if(!region)return country;
 if(!country||region===country)return region;
 return `${region}, ${country}`;
}

export function DestinationImage({destination,className='',style={},priority=false,useCard=false,showNote=true}){
 const state=useDestinationPhotos(destination);
 const media=(useCard?state.card:state.hero)||state.hero||state.card;
 const [failed,setFailed]=useState(false);
 useEffect(()=>{setFailed(false)},[media?.src]);
 const fallback=!media?.src||failed;
 const src=fallback?FALLBACK_PHOTO:media.src;
 const label=destination?`${destination.name}, ${placeLabel(destination)}`:'destino';
 return <div className={`destination-image ${fallback?'is-fallback':''} ${className}`} style={style}>
  <img
   src={src}
   alt={fallback?`Imagen de referencia de paisaje para ${label}`:media.alt||label}
   loading={priority?'eager':'lazy'}
   fetchPriority={priority?'high':'auto'}
   onError={()=>{if(!failed)setFailed(true)}}
  />
  {fallback&&showNote&&<span className="destination-photo-note">{state.loading?'Buscando fotografía…':'Imagen de referencia'}</span>}
 </div>;
}

function photoCredit(state){
 const photo=state.card||state.hero;
 return state.source==='unsplash'&&photo?.author?photo:null;
}

function CreditLink({photo}){
 if(!photo)return null;
 return <a
  className="destination-photo-credit"
  href={photo.photoUrl||photo.authorUrl}
  target="_blank"
  rel="noreferrer"
  aria-label={`Fotografía de referencia de ${photo.author} en Unsplash`}
 >Foto de referencia: {photo.author} / Unsplash</a>;
}

export function DestinationCard({destination,compact=false,priority=false}){
 const state=useDestinationPhotos(destination);
 return <article className={`destination-card ${compact?'compact':''}`}>
  <Link className="destination-card-main" to={`/destinos/${destination.id}`}>
   <DestinationImage destination={destination} className="card-photo" useCard priority={priority}/>
   <div className="destination-card-body">
     <span className="destination-card-meta">{destination.category}{destination.external?destination.provider==='photon'?' · OpenStreetMap':' · OpenWeather':''}</span>
    <h3>{destination.name}</h3>
    <span className="destination-card-region"><MapPin size={13}/>{placeLabel(destination)}</span>
    <p className="destination-card-description">{destination.description}</p>
    <span className="destination-card-footer"><span>Explorar destino</span><ArrowRight size={15}/></span>
   </div>
  </Link>
  <CreditLink photo={photoCredit(state)}/>
 </article>;
}

export function DestinationTile({destination,primary=false,priority=false}){
 const state=useDestinationPhotos(destination);
 return <article className={`destination-tile ${primary?'primary':''}`}>
  <Link className="destination-tile-main" to={`/destinos/${destination.id}`}>
   <DestinationImage destination={destination} className="destination-tile-media" useCard priority={priority}/>
   <div className="destination-tile-caption">
    <span className="destination-tile-meta">{destination.category} · {destination.region}</span>
    <h3>{destination.name}</h3>
    <span className="destination-tile-link">Explorar <ArrowRight size={14}/></span>
   </div>
  </Link>
  <CreditLink photo={photoCredit(state)}/>
 </article>;
}

export function SectionHeading({eyebrow,title,desc,action,href}){
 return <div className="section-head">
  <div className="section-head-copy">
   {eyebrow&&<span className="kicker">{eyebrow}</span>}
   <h2>{title}</h2>
   {desc&&<p>{desc}</p>}
  </div>
  {action&&href&&<Link className="inline-link" to={href}>{action}<ArrowRight size={16}/></Link>}
 </div>;
}

export function ApiNotice({kind='general',source,children}){
 if(!source&&!children)return null;
 if(source==='not-required')return null;
 const text=children||({
   openrouteservice:'Ruta calculada con OpenRouteService.',
   'air-direct':'Conexión aérea ilustrativa, no una ruta de vuelo comercial.',
  demo:'Estimación aproximada (DEMO). No representa una ruta vial real.',
  openweather:'Datos meteorológicos de OpenWeather.',
  unsplash:'Fotografías de Unsplash.',
  fallback:'Se muestran imágenes de referencia del destino.',
  unavailable:'Los datos en vivo no están disponibles en este momento.',
  general:'Información guardada en este proyecto.'
 }[source]||{
  route:'Distancia y tiempo orientativos.',
  weather:'Información meteorológica del destino.',
  photos:'Fotografías de referencia del destino.',
  general:'Información del proyecto.'
 }[kind]);
 return <p className="api-notice">{text}</p>;
}

export function EmptyState({icon:Icon=Compass,title,desc,children}){
 return <div className="empty-state">
  <span className="empty-icon"><Icon size={24}/></span>
  <h3>{title}</h3>
  <p>{desc}</p>
  {children}
 </div>;
}
