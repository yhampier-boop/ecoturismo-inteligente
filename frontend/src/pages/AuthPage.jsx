import {useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowRight,Eye,EyeOff,AlertCircle} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {siteMedia} from '../data/media';

export default function AuthPage(){
 const {user,login,register}=useAuth();
 const navigate=useNavigate();
 const [params]=useSearchParams();
 const [mode,setMode]=useState('login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [visible,setVisible]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const candidate=params.get('next')||'';
 const next=/^\/(planificar|mis-viajes)(?:\?|$)/.test(candidate)&&!/[\\\u0000-\u001f]/.test(candidate)?candidate:'/mis-viajes';

 const onSubmit=async event=>{
  event.preventDefault();
  setError('');setBusy(true);
  try{
   if(mode==='register')await register(name,email,password);
   else await login(email,password);
   navigate(next,{replace:true});
  }catch(requestError){setError(requestError.message)}
  finally{setBusy(false)}
 };

 if(user)return <section className="container page-message">
  <span className="kicker">Tu cuenta</span>
  <h1>Ya tienes una sesión iniciada.</h1>
  <Link to="/mis-viajes" className="btn btn-primary">Ver mis viajes <ArrowRight size={16}/></Link>
 </section>;

 return <div className="auth-page">
  <div className="auth-photo">
   <img src={siteMedia.auth.src} alt={siteMedia.auth.alt}/>
   <div className="auth-photo-shade" aria-hidden="true"/>
   <div className="auth-photo-copy">
    <span className="kicker light">EcoTurismo Inteligente</span>
    <h2>Los viajes que valen la pena empiezan por un buen plan.</h2>
    <p>Guarda tus itinerarios y vuelve a ellos cuando quieras.</p>
   </div>
   <a className="auth-credit" href={siteMedia.auth.photoUrl} target="_blank" rel="noreferrer">Foto: {siteMedia.auth.author} / Unsplash</a>
  </div>

  <div className="auth-form-area">
   <div className="auth-form-box">
    <span className="kicker">Tu cuenta</span>
    <h1>{mode==='login'?'Inicia sesión':'Crea tu cuenta'}</h1>
    <p className="auth-subtitle">{mode==='login'?'Entra para guardar y editar tus itinerarios.':'Solo necesitas un nombre, un correo y una contraseña.'}</p>

    <div className="auth-tabs">
     <button type="button" className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>Iniciar sesión</button>
     <button type="button" className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>Crear cuenta</button>
    </div>

    <form onSubmit={onSubmit} className="auth-form">
     {mode==='register'&&<div className="auth-field">
      <label htmlFor="fullName">Tu nombre</label>
      <input id="fullName" name="name" required minLength={2} maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder="¿Cómo te llamas?"/>
     </div>}
     <div className="auth-field">
      <label htmlFor="email">Correo electrónico</label>
      <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="tu@correo.com"/>
     </div>
     <div className="auth-field">
      <label htmlFor="password">Contraseña</label>
      <div className="auth-password">
       <input id="password" name="password" type={visible?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?8:1} value={password} onChange={event=>setPassword(event.target.value)} placeholder={mode==='register'?'Al menos 8 caracteres':'Tu contraseña'}/>
       <button type="button" className="show-pass" aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button>
      </div>
      {mode==='register'&&<span className="password-hint">Mínimo 8 caracteres.</span>}
     </div>

     {error&&<div className="form-error" role="alert"><AlertCircle size={17}/>{error}</div>}

     <button disabled={busy} className="btn btn-primary full auth-submit" type="submit">{busy?'Procesando…':mode==='login'?'Ingresar a mi cuenta':'Crear mi cuenta'}<ArrowRight size={17}/></button>
     </form>
     {mode==='login'&&<Link className="recovery-link" to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>}

    <div className="auth-bottom">
     <p>Tu cuenta se guarda en la base de datos de este proyecto.</p>
     <Link to="/">Volver al inicio</Link>
    </div>
   </div>
  </div>
 </div>;
}
