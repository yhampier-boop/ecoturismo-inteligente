import {useEffect,useMemo,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowRight,Search} from 'lucide-react';
import {request} from '../api';
import {DestinationTile,SectionHeading} from '../components/Common';
import {destinationMedia,experienceMedia,siteMedia} from '../data/media';

const experienceCopy={
 Cultura:{title:'Cultura e historia',description:'Ciudades, iglesias y sitios arqueológicos para leer el pasado del país.'},
 Naturaleza:{title:'Naturaleza y paisaje',description:'Valles, lagos y reservas para caminar sin prisa.'},
 Aventura:{title:'Aventura y altura',description:'Caminatas y paisajes de montaña para quienes buscan movimiento.'},
 Ciudad:{title:'Ciudades y costa',description:'Barrios, mar y vida urbana para completar el recorrido.'}
};

export default function Home(){
 const navigate=useNavigate();
 const location=useLocation();
 const [q,setQ]=useState('');
 const [destinations,setDestinations]=useState([]);
 const [catalog,setCatalog]=useState([]);
 const [error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  request('/destinations').then(({destinations:list})=>{
   if(!active)return;
   const featured=list.filter(destination=>destination.featured);
   setCatalog(list);
   setDestinations((featured.length?featured:list).slice(0,4));
   }).catch(err=>{if(active)setError(err.message)});
  return()=>{active=false};
 },[]);

 useEffect(()=>{
  if(location.hash==='#experiencias')document.getElementById('experiencias')?.scrollIntoView({behavior:'smooth'});
 },[location.hash]);

 const experiences=useMemo(()=>Object.entries(experienceCopy).map(([category,copy])=>({
  category,...copy,photo:experienceMedia[category]||siteMedia.hero
 })),[]);
 const featuredExperience=experiences.find(experience=>experience.category==='Naturaleza')||experiences[0];
 const secondaryExperiences=experiences.filter(experience=>experience.category!==featuredExperience.category);

 function search(event){
  event.preventDefault();
  navigate(`/explorar${q.trim()?`?buscar=${encodeURIComponent(q.trim())}`:''}`);
 }

 return <>
  <section className="home-hero">
   <div className="home-hero-media">
    <img src={siteMedia.hero.src} alt="Río entre montañas nevadas de los Andes peruanos" fetchPriority="high"/>
   </div>
   <div className="home-hero-shade" aria-hidden="true"/>
   <div className="container home-hero-content">
    <p className="hero-kicker">Perú · Destinos reales</p>
    <h1>Viajar por Perú,<br/>con tiempo para mirar.</h1>
    <p className="hero-intro">Ocho destinos para empezar: costa, Andes y ciudades. Consulta el clima, ordena tus paradas y guarda el recorrido.</p>
    <form className="hero-search" onSubmit={search}>
     <Search size={19} aria-hidden="true"/>
     <input aria-label="Buscar país, ciudad o lugar turístico" value={q} onChange={event=>setQ(event.target.value)} placeholder="Busca un país, ciudad o lugar del mundo"/>
     <button type="submit">Buscar</button>
    </form>
    <div className="hero-links">
     <Link to="/explorar">Ver los destinos</Link>
     <Link to="/planificar">Planificar un viaje</Link>
    </div>
   </div>
   <a className="home-hero-credit" href={siteMedia.hero.photoUrl} target="_blank" rel="noreferrer">Foto: {siteMedia.hero.author} / Unsplash</a>
  </section>

  <section className="section container" aria-labelledby="destinos-destacados">
   <SectionHeading eyebrow="Destinos" title={<span id="destinos-destacados">Lugares para empezar</span>} desc="Una selección del catálogo. Cada destino tiene su propia ficha con clima, ubicación y datos prácticos." action="Ver todos los destinos" href="/explorar"/>
   <div className="destination-mosaic">
    {destinations.map((destination,index)=><DestinationTile key={destination.id} destination={destination} primary={index===0} priority={index<3}/>)}
    {destinations.length>0&&<Link className="destination-more" to="/explorar">
     <span className="destination-more-count">{catalog.length||8} destinos en el catálogo</span>
     <div>
      <h3>Explora el resto del catálogo.</h3>
      <p>Filtra por cultura, naturaleza, aventura o ciudad.</p>
     </div>
     <span className="destination-more-link">Ver catálogo <ArrowRight size={16}/></span>
    </Link>}
     {!destinations.length&&<div role={error?'alert':'status'} className="loading-text">{error||'Cargando destinos…'}</div>}
   </div>
  </section>

  <section id="experiencias" className="experiences-section">
   <div className="container">
    <div className="section-head section-head-split">
     <div className="section-head-copy">
      <span className="kicker">Experiencias</span>
      <h2>Cuatro maneras de recorrer el país.</h2>
     </div>
     <p>Elige una categoría y revisa los destinos del catálogo que corresponden a ella.</p>
    </div>

    <div className="experiences-layout">
     {featuredExperience&&<button type="button" className="experience-feature" onClick={()=>navigate(`/explorar?categoria=${encodeURIComponent(featuredExperience.category)}`)}>
      <img src={featuredExperience.photo.src} alt={featuredExperience.photo.alt} loading="lazy"/>
      <span className="experience-feature-copy">
       <span className="kicker light">{featuredExperience.category}</span>
       <strong>{featuredExperience.title}</strong>
       <span>{featuredExperience.description}</span>
       <span className="experience-link">Ver destinos <ArrowRight size={15}/></span>
      </span>
     </button>}
     <div className="experience-list">
      {secondaryExperiences.map(experience=><button type="button" className="experience-row" key={experience.category} onClick={()=>navigate(`/explorar?categoria=${encodeURIComponent(experience.category)}`)}>
       <img src={experience.photo.src} alt={experience.photo.alt} loading="lazy"/>
       <span className="experience-row-copy">
        <span className="experience-row-category">{experience.category}</span>
        <strong>{experience.title}</strong>
        <small>{experience.description}</small>
       </span>
       <ArrowRight size={17}/>
      </button>)}
     </div>
    </div>

    <div className="gastronomy-feature">
     <img src={siteMedia.ceviche.src} alt="Ceviche peruano servido en un plato blanco" loading="lazy"/>
     <div className="gastronomy-copy">
      <span className="kicker">Cocina local</span>
      <h3>La mesa también cuenta el viaje.</h3>
      <p>La gastronomía también forma parte del viaje. En Lima, el mercado, el mar y las cocinas de barrio explican buena parte de la ciudad.</p>
      <Link className="inline-link" to="/destinos/lima">Lima y su cocina <ArrowRight size={16}/></Link>
     </div>
    </div>
   </div>
  </section>

  <section className="sustainability-section">
   <div className="sustainability-media">
    <img src={siteMedia.weaving.src} alt="Manos tejiendo un textil andino en un telar" loading="lazy"/>
    <span className="media-credit">Foto: <a href={siteMedia.weaving.photoUrl} target="_blank" rel="noreferrer">{siteMedia.weaving.author}</a> / Unsplash</span>
   </div>
   <div className="sustainability-copy">
    <span className="kicker light">Turismo responsable</span>
    <h2>Viajar también es cuidar el lugar al que llegas.</h2>
    <p>Tres criterios prácticos para que la visita sea respetuosa con el entorno y con quienes viven allí.</p>
    <ol className="sustainability-list">
     <li><span>Respeta los senderos y las normas de cada área protegida.</span></li>
     <li><span>Contrata servicios y compra productos de operadores y comunidades locales.</span></li>
     <li><span>Lleva lo necesario y regresa con tus residuos.</span></li>
    </ol>
   </div>
  </section>

  <section className="planner-promo">
   <div className="planner-promo-media">
    <img src={destinationMedia.arequipa.hero.src} alt="Vista panorámica de Arequipa y el volcán Misti" loading="lazy"/>
   </div>
   <div className="planner-promo-copy">
    <span className="kicker">Planificador</span>
    <h2>Tu recorrido, ordenado antes de salir.</h2>
    <p>Agrega hasta diez paradas, elige cómo moverte y revisa la distancia y el tiempo de tu ruta. Si la ruta real no está disponible, la estimación se identifica como DEMO.</p>
    <div className="planner-promo-facts">
     <span>Hasta 10 paradas</span>
      <span>Auto, a pie, bicicleta o avión</span>
     <span>Mapa y distancia</span>
    </div>
    <Link className="btn btn-primary" to="/planificar">Abrir el planificador <ArrowRight size={16}/></Link>
   </div>
  </section>
 </>;
}
