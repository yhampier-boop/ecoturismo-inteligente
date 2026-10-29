import {useEffect,useState} from 'react';
import {Link,NavLink,Route,Routes,useLocation,Navigate,Outlet} from 'react-router-dom';
import {ArrowRight,Menu,X,LogOut,UserRound} from 'lucide-react';
import {useAuth} from './context/AuthContext';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Destination from './pages/Destination';
import Planner from './pages/Planner';
import SavedTrips from './pages/SavedTrips';
import AuthPage from './pages/AuthPage';
import PasswordRecovery from './pages/PasswordRecovery';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import SiteNotices from './components/SiteNotices';
import AdminLayout from './components/AdminLayout';

function Header(){
 const [open,setOpen]=useState(false);
 const {user,logout}=useAuth();
 const loc=useLocation();
 const nav=[['/','Inicio'],['/explorar','Destinos'],['/#experiencias','Experiencias'],['/mis-viajes','Mis viajes']];

 useEffect(()=>{setOpen(false)},[loc.pathname,loc.hash]);
 useEffect(()=>{
  const onKey=event=>{if(event.key==='Escape')setOpen(false)};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[]);

 return <header className="site-header">
  <div className="container nav-bar">
   <Link to="/" className="brand brand-image" onClick={()=>setOpen(false)}><img className="brand-logo" src="/images/logo.png" alt="EcoTurismo Inteligente"/></Link>
   <nav id="main-nav" className={`nav-links ${open?'open':''}`} aria-label="Navegación principal">
    {nav.map(([to,label])=>to.includes('#')?<Link key={to} to={to} onClick={()=>setOpen(false)}>{label}</Link>:<NavLink key={to} end={to==='/'} to={to} onClick={()=>setOpen(false)} className={({isActive})=>isActive?'active':''}>{label}</NavLink>)}
    <div className="nav-mobile-actions">
     <Link className="btn btn-primary" to="/planificar" onClick={()=>setOpen(false)}>Planifica tu viaje</Link>
     {user?<button type="button" className="btn btn-outline" onClick={()=>{logout();setOpen(false)}}><LogOut size={16}/> Cerrar sesión</button>:<Link className="btn btn-outline" to="/acceso" onClick={()=>setOpen(false)}>Iniciar sesión</Link>}
    </div>
   </nav>
   <div className="nav-actions">
    <Link className="btn btn-primary nav-planner" to="/planificar">Planifica tu viaje</Link>
    {user?<div className="user-pill"><UserRound size={16}/><Link to="/mis-viajes">{user.name.split(' ')[0]}</Link><button type="button" onClick={logout} className="logout-btn" title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={15}/></button></div>:<Link className="nav-login" to="/acceso">Iniciar sesión <ArrowRight size={15}/></Link>}
   </div>
   <button type="button" className="nav-hamburger" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="main-nav" aria-label={open?'Cerrar menú':'Abrir menú'}>{open?<X/>:<Menu/>}</button>
  </div>
 </header>;
}

function Footer(){
 return <footer className="footer">
  <div className="container footer-main">
   <div className="footer-brand-block">
    <Link to="/" className="footer-brand"><img className="brand-logo" src="/images/logo.png" alt="EcoTurismo Inteligente"/></Link>
    <p>Destinos de Perú y el mundo, con clima y planificación de rutas en un mismo lugar.</p>
   </div>
   <div className="footer-col">
    <h3>Explorar</h3>
    <Link to="/explorar">Destinos</Link>
    <Link to="/#experiencias">Experiencias</Link>
    <Link to="/planificar">Planificador</Link>
   </div>
   <div className="footer-col">
    <h3>Tu cuenta</h3>
    <Link to="/mis-viajes">Mis viajes</Link>
     <Link to="/acceso">Iniciar sesión</Link>
     <Link to="/admin/login">Admin</Link>
   </div>
  </div>
  <div className="container footer-bottom">
   <span>© {new Date().getFullYear()} EcoTurismo Inteligente.</span>
   <span>Fotografías: Unsplash · Mapas: OpenStreetMap · Clima: OpenWeather</span>
  </div>
 </footer>;
}

function PublicLayout(){
 return <>
  <a className="skip-link" href="#main">Saltar al contenido</a>
  <Header/>
   <main id="main">
    <SiteNotices/>
    <Outlet/>
   </main>
   <Footer/>
  </>;
}

export default function App(){
 return <Routes>
   <Route path="/admin" element={<AdminLayout/>}>
    <Route path="login" element={<AdminLogin/>}/>
    <Route index element={<AdminPanel/>}/>
    <Route path="*" element={<Navigate to="/admin/login" replace/>}/>
   </Route>
   <Route element={<PublicLayout/>}>
    <Route path="/" element={<Home/>}/>
    <Route path="/explorar" element={<Explore/>}/>
    <Route path="/destinos/:id" element={<Destination/>}/>
    <Route path="/planificar" element={<Planner/>}/>
    <Route path="/mis-viajes" element={<SavedTrips/>}/>
     <Route path="/acceso" element={<AuthPage/>}/>
      <Route path="/recuperar-contrasena" element={<PasswordRecovery key="forgot"/>}/>
      <Route path="/restablecer-contrasena" element={<PasswordRecovery key="reset" reset/>}/>
    <Route path="*" element={<section className="container page-message"><span className="kicker">Página no encontrada</span><h1>Esa ruta no existe.</h1><p>Vuelve al inicio o revisa el catálogo de destinos.</p><Link to="/" className="btn btn-primary">Ir al inicio <ArrowRight size={16}/></Link></section>}/>
   </Route>
  </Routes>;
}
