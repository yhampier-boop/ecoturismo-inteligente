import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Search,SlidersHorizontal,Compass} from 'lucide-react';
import {request} from '../api';
import {DestinationCard,EmptyState} from '../components/Common';

const cats=['Todos','Cultura','Naturaleza','Aventura','Ciudad','País','Lugar turístico'];

export default function Explore(){
 const [params,setParams]=useSearchParams();
 const q=params.get('buscar')||'';
 const category=cats.includes(params.get('categoria'))?params.get('categoria'):'Todos';
 const country=params.get('pais')||'Todos';
 const city=params.get('ciudad')||'Todos';
 const [countryList,setCountryList]=useState([]);
 const [data,setData]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const countries=useMemo(()=>['Todos',...new Set([...countryList.map(item=>item.name),country==='Todos'?'Perú':country])],[countryList,country]);
 const cities=useMemo(()=>['Todos',...new Set(data.map(d=>d.city||(d.category==='Ciudad'?d.name:!d.external?d.region:null)).filter(Boolean)),...(city!=='Todos'?[city]:[])].filter((item,index,array)=>array.indexOf(item)===index),[data,city]);
 const visible=useMemo(()=>city==='Todos'?data:data.filter(d=>[d.city,d.name,d.region].includes(city)),[city,data]);
 const sync=(nextQ=q,nextCategory=category,nextCountry=country,nextCity='Todos')=>{
  const next={};
  if(nextQ)next.buscar=nextQ;
  if(nextCategory!=='Todos')next.categoria=nextCategory;
   if(nextCountry!=='Todos')next.pais=nextCountry;
   if(nextCity!=='Todos')next.ciudad=nextCity;
  setParams(next,{replace:true});
 };

 useEffect(()=>{request('/countries').then(response=>setCountryList(response.countries)).catch(()=>{});},[]);

 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setLoading(true);
    request(`/destinations?search=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&country=${encodeURIComponent(country==='Todos'?'':country)}`,{signal:controller.signal})
     .then(response=>{setData(response.destinations||[]);setMessage(response.message||'');setError('')})
    .catch(requestError=>{
     if(requestError.name==='AbortError')return;
      setData([]);setMessage('');setError(requestError.message);
    })
    .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  },500);
  return()=>{clearTimeout(timer);controller.abort()};
 },[q,category,country]);

 return <>
  <section className="page-intro explore-intro">
   <div className="container">
    <span className="kicker">Catálogo de destinos</span>
    <h1>Lugares para empezar a planificar.</h1>
     <p>Busca países, ciudades y lugares turísticos del mundo. Cada ficha reúne clima, fotografías y los datos disponibles del destino.</p>
   </div>
  </section>

  <section className="container explore-content">
   <div className="explore-toolbar">
    <label className="explore-search">
     <Search size={19} aria-hidden="true"/>
      <input aria-label="Buscar país, ciudad o lugar turístico" placeholder="País, ciudad o lugar turístico" maxLength={80} value={q} onChange={event=>sync(event.target.value)}/>
    </label>
    <div className="destination-filters">
     <div className="category-tabs" role="group" aria-label="Filtrar por categoría">
       {cats.map(item=><button type="button" aria-pressed={category===item} className={category===item?'selected':''} key={item} onClick={()=>sync(q,item)}>{item}</button>)}
     </div>
     <label className="country-filter">
      <span><SlidersHorizontal size={14}/> País</span>
       <select aria-label="País" value={country} onChange={event=>sync(q,category,event.target.value)}>
       {countries.map(item=><option key={item}>{item}</option>)}
      </select>
      </label>
      <label className="country-filter"><span>Ciudad / región disponible</span><select aria-label="Ciudad o región disponible" value={city} onChange={event=>sync(q,category,country,event.target.value)}>{cities.map(item=><option key={item}>{item}</option>)}</select></label>
      {(q||category!=='Todos'||country!=='Todos'||city!=='Todos')&&<button type="button" className="btn btn-outline" onClick={()=>sync('','Todos','Todos')}>Limpiar filtros</button>}
    </div>
   </div>

   <div className="results-header">
    <div>
      <h2>{category==='Todos'?'Todos los destinos':category}</h2>
      <p role="status" aria-live="polite">{loading?'Buscando destinos…':`${visible.length} ${visible.length===1?'destino encontrado':'destinos encontrados'}`}</p>
    </div>
   </div>

   {error?<EmptyState title="No se pudieron cargar los destinos" desc={error}/>:
    loading?<div className="skeleton-grid">{Array.from({length:6}).map((_,index)=><div className="skeleton" key={index}/>)}</div>:
    visible.length?<div className="explore-grid">{visible.map(destination=><DestinationCard destination={destination} key={destination.id}/>)}</div>:
     <EmptyState icon={Compass} title="¡Ups! No encontramos ese destino." desc={message||'Prueba con otro nombre o revisa cómo lo escribiste. También puedes cambiar o limpiar los filtros.'}/>}

    {message&&<p className="api-notice" role="status">{message}</p>}
    <p className="page-note">Búsqueda mundial: Photon / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>; respaldo de ciudades: OpenWeather Geocoding. La cobertura depende de los datos disponibles; no es un catálogo exhaustivo de cada país. Las categorías internacionales proceden del tipo de lugar registrado. Las fotografías de Unsplash son referencias visuales, no identificaciones verificadas del lugar.</p>
  </section>
 </>;
}
