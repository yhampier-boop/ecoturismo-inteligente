import {useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {request} from '../api';
import {useAuth} from '../context/AuthContext';

export default function PasswordRecovery({reset=false}) {
 const location=useLocation();
 const {logout}=useAuth();
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 async function submit(event) {
  event.preventDefault();setError('');setMessage('');
  if(reset && password!==confirmation) return setError('Las contraseñas no coinciden.');
  setBusy(true);
  try {
   const response=await request(`/auth/${reset?'reset-password':'forgot-password'}`,{method:'POST',body:reset?{token,password}:{email}});
   if(reset){logout();window.history.replaceState(null,'',location.pathname);setPassword('');setConfirmation('');}
   setMessage(response.message);
  } catch(err) {setError(err.message);}
  finally {setBusy(false);}
 }
 const invalid=reset&&!/^[a-f0-9]{64}$/.test(token);
 return <section className="container recovery-page">
  <div className="auth-form-box">
   <span className="kicker">Tu cuenta</span>
   <h1>{reset?'Nueva contraseña':'Recupera tu contraseña'}</h1>
   <p>{reset?'El enlace vence en 30 minutos y solo puede usarse una vez.':'Te enviaremos un enlace seguro para establecer una nueva contraseña.'}</p>
   {invalid?<div role="alert" className="form-error">El enlace está incompleto o no es válido. Solicita uno nuevo.</div>:(!reset||!message)&&<form className="auth-form" onSubmit={submit}>
    {!reset?<div className="auth-field"><label htmlFor="recovery-email">Correo electrónico</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div>:<>
     <div className="auth-field"><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} value={password} onChange={e=>setPassword(e.target.value)}/></div>
     <div className="auth-field"><label htmlFor="confirm-password">Repite la contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></div>
    </>}
    <button className="btn btn-primary full" disabled={busy} type="submit">{busy?'Procesando…':reset?'Guardar nueva contraseña':'Enviar enlace'}</button>
   </form>}
   {error&&<div role="alert" className="form-error">{error}</div>}
   {message&&<div role="status" className="form-success">{message}</div>}
   <div className="auth-bottom"><Link to="/acceso">Volver a iniciar sesión</Link>{reset&&<Link to="/recuperar-contrasena">Solicitar otro enlace</Link>}</div>
  </div>
 </section>;
}
