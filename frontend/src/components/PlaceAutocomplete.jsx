import {useEffect,useId,useRef,useState} from 'react';
import {AlertCircle,Check,LoaderCircle,MapPin,Search,X} from 'lucide-react';
import {request} from '../api';

const CACHE_TTL=5*60_000;
const cache=new Map();
const normalize=value=>String(value||'')
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'')
 .toLowerCase()
 .replace(/\s+/g,' ')
 .trim();

function placeDetails(place){
 const parts=[place.region,place.country].filter(Boolean);
 return parts.filter((part,index)=>index===0||normalize(part)!==normalize(parts[index-1])).join(', ');
}

function selectedLabel(place){
 const parts=[place.name,place.region,place.country].filter(Boolean);
 return parts.filter((part,index)=>index===0||normalize(part)!==normalize(parts[index-1])).join(' · ');
}

export default function PlaceAutocomplete({onSelect=()=>{},resetKey=0,inputId='destination-search',disabled=false}){
 const listId=useId();
 const inputRef=useRef(null);
 const rootRef=useRef(null);
 const firstReset=useRef(true);
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 const [status,setStatus]=useState('idle');
 const [places,setPlaces]=useState([]);
 const [message,setMessage]=useState('');
 const [activeIndex,setActiveIndex]=useState(-1);
 const [selectedId,setSelectedId]=useState('');

 const term=query.trim().replace(/\s+/g,' ');
 const showDropdown=open&&(status!=='idle'||term.length>0);

 useEffect(()=>{
  if(firstReset.current){
   firstReset.current=false;
   return;
  }
  setQuery('');
  setPlaces([]);
  setStatus('idle');
  setMessage('');
  setActiveIndex(-1);
  setOpen(false);
  setSelectedId('');
 },[resetKey]);

 useEffect(()=>{
  if(!open)return;
  if(term.length<2){
   setPlaces([]);
   setStatus('idle');
   setMessage('');
   setActiveIndex(-1);
   return;
  }
  const key=normalize(term);
  const cached=cache.get(key);
  if(cached&&Date.now()-cached.time<CACHE_TTL){
   setPlaces(cached.places);
   setMessage(cached.message);
   setStatus(cached.places.length?'ready':'empty');
   setActiveIndex(cached.places.length?0:-1);
   return;
  }

  const controller=new AbortController();
  setStatus('loading');
  setMessage('');
  setActiveIndex(-1);
  const timer=setTimeout(()=>{
   request(`/places?search=${encodeURIComponent(term)}`,{signal:controller.signal})
    .then(response=>{
     const next=Array.isArray(response.places)?response.places:[];
     cache.set(key,{time:Date.now(),places:next,message:response.message||''});
     setPlaces(next);
     setMessage(response.message||'');
     setStatus(next.length?'ready':'empty');
     setActiveIndex(next.length?0:-1);
    })
    .catch(error=>{
     if(error.name==='AbortError')return;
     setPlaces([]);
     setStatus('error');
     setMessage(error.message||'No se pudieron consultar las sugerencias.');
     setActiveIndex(-1);
    });
  },350);
  return()=>{clearTimeout(timer);controller.abort()};
 },[term,open]);

 useEffect(()=>{
  if(!open)return;
  const closeOnOutside=event=>{
   if(rootRef.current&&!rootRef.current.contains(event.target))setOpen(false);
  };
  document.addEventListener('pointerdown',closeOnOutside);
  return()=>document.removeEventListener('pointerdown',closeOnOutside);
 },[open]);

 function choose(place){
  setQuery(selectedLabel(place));
  setSelectedId(place.id);
  setOpen(false);
  setActiveIndex(-1);
  onSelect(place);
 }

 function clear(){
  setQuery('');
  setSelectedId('');
  setPlaces([]);
  setStatus('idle');
  setMessage('');
  setActiveIndex(-1);
  setOpen(false);
  onSelect(null);
  inputRef.current?.focus();
 }

 function handleChange(event){
  const value=event.target.value;
  setQuery(value);
  setOpen(true);
  if(selectedId){
   setSelectedId('');
   onSelect(null);
  }
 }

 function handleKeyDown(event){
  if(event.key==='ArrowDown'){
   event.preventDefault();
   if(!open){setOpen(true);return;}
   if(!places.length)return;
   setActiveIndex(previous=>previous<0?0:Math.min(previous+1,places.length-1));
   return;
  }
  if(event.key==='ArrowUp'){
   if(!open||!places.length)return;
   event.preventDefault();
   setActiveIndex(previous=>previous<=0?places.length-1:previous-1);
   return;
  }
  if(event.key==='Enter'){
   if(open&&activeIndex>=0&&places[activeIndex]){
    event.preventDefault();
    choose(places[activeIndex]);
   }
   return;
  }
  if(event.key==='Escape'&&open){
   event.preventDefault();
   setOpen(false);
   setActiveIndex(-1);
  }
 }

 return <div className={`place-autocomplete ${open?'open':''}`} ref={rootRef}>
  <div className="place-input">
   <MapPin className="place-input-icon" size={18} aria-hidden="true"/>
   <input
    ref={inputRef}
    id={inputId}
    className="field-input place-input-field"
    type="text"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={showDropdown}
    aria-controls={status==='ready'?listId:undefined}
    aria-activedescendant={activeIndex>=0&&places[activeIndex]?`${listId}-${activeIndex}`:undefined}
    autoComplete="off"
    spellCheck="false"
    disabled={disabled}
    placeholder="Busca una ciudad, país o lugar turístico"
    value={query}
    onChange={handleChange}
    onFocus={()=>{if(!selectedId&&term.length>0)setOpen(true)}}
    onKeyDown={handleKeyDown}
    onBlur={event=>{if(!rootRef.current?.contains(event.relatedTarget))setOpen(false)}}
   />
   {status==='loading'
    ?<LoaderCircle className="place-input-status spin" size={17} aria-hidden="true"/>
    :query
     ?<button type="button" className="place-clear" aria-label="Borrar búsqueda" onClick={clear}><X size={16}/></button>
     :<Search className="place-input-status" size={16} aria-hidden="true"/>}
  </div>

  {showDropdown&&<div className="place-suggestions">
   {status==='loading'&&<div className="place-state"><LoaderCircle className="spin" size={17}/><span>Buscando ciudades…</span></div>}
   {status==='error'&&<div className="place-state place-state-error"><AlertCircle size={17}/><span>{message}</span></div>}
   {status==='empty'&&<div className="place-state"><Search size={17}/><div><strong>Sin coincidencias</strong><small>{message||`No encontramos ciudades para “${term}”. Revisa la ortografía o prueba con otro nombre.`}</small></div></div>}
   {status==='idle'&&<div className="place-state"><MapPin size={17}/><span>Escribe al menos 2 caracteres para ver sugerencias.</span></div>}
   {status==='ready'&&<ul id={listId} role="listbox" aria-label="Sugerencias de ciudades">
    {places.map((place,index)=><li
     key={place.id||`${place.name}-${place.region}-${index}`}
     id={`${listId}-${index}`}
     role="option"
     aria-selected={activeIndex===index}
     className={`place-option ${activeIndex===index?'active':''}`}
     onMouseDown={event=>event.preventDefault()}
     onMouseEnter={()=>setActiveIndex(index)}
     onClick={()=>choose(place)}
    >
     <MapPin className="place-option-icon" size={17} aria-hidden="true"/>
     <span className="place-option-copy">
      <strong>{place.name}</strong>
      <small>{placeDetails(place)}</small>
     </span>
     {place.saved
      ?<span className="place-option-saved"><Check size={12}/>Guardado</span>
       :<span className="place-option-source">{place.source==='photon'?'OpenStreetMap':'OpenWeather'}</span>}
    </li>)}
   </ul>}
   {status==='ready'&&message&&<p className="place-suggestions-note">{message}</p>}
  </div>}
 </div>;
}
