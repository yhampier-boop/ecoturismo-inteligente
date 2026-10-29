import {useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAdminAuth} from '../context/AdminAuthContext';

export default function AdminLogin(){
 const {reason,login,logout}=useAdminAuth();
 const navigate=useNavigate();
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 // Volver al acceso siempre exige credenciales, incluso dentro de la misma pestaña.
 useEffect(()=>{void logout(reason);},[logout]);
 async function submit(event){
  event.preventDefault();setError('');setBusy(true);
   try{await login(email,password);setPassword('');navigate('/admin',{replace:true});}
  catch(err){setError(err.message);}
  finally{setBusy(false);}
 }
 return <section className="container recovery-page">
  <div className="auth-form-box">
   <span className="kicker">Administración</span><h1>Acceso administrador</h1>
   <p>Ingresa con una cuenta administradora activa. Este acceso no permite crear cuentas ni cambiar permisos.</p>
   {reason&&<div className="form-success" role="status">{reason}</div>}
   <form className="auth-form" onSubmit={submit}>
    <div className="auth-field"><label htmlFor="admin-email">Correo electrónico</label><input id="admin-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div>
    <div className="auth-field"><label htmlFor="admin-password">Contraseña</label><input id="admin-password" type="password" autoComplete="current-password" required maxLength={100} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></div>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <button type="submit" className="btn btn-primary full" disabled={busy}>{busy?'Verificando…':'Ingresar al panel'}</button>
   </form>
   <Link className="recovery-link" to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
   <div className="auth-bottom"><Link to="/">Volver al inicio</Link><Link to="/acceso">Acceso de viajeros</Link></div>
  </div>
 </section>;
}
