import {Outlet} from 'react-router-dom';
import {AdminAuthProvider} from '../context/AdminAuthContext';
import '../pages/admin.css';

export default function AdminLayout(){
 return <AdminAuthProvider><div className="admin-shell">
  <a className="skip-link" href="#admin-main">Saltar al contenido administrativo</a>
  <header className="admin-brand"><img src="/images/logo.png" alt="EcoTurismo Inteligente"/><span>Administración</span></header>
  <main id="admin-main"><Outlet/></main>
 </div></AdminAuthProvider>;
}
