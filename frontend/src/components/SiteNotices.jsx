import {useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {request} from '../api';

export default function SiteNotices(){
 const {pathname}=useLocation();
 const [notices,setNotices]=useState([]);
 const privatePage=pathname.startsWith('/admin')||pathname.includes('contrasena')||pathname==='/acceso';
 useEffect(()=>{
  if(privatePage)return;
  const controller=new AbortController();
  request('/notices',{signal:controller.signal}).then(data=>setNotices(data.notices||[])).catch(()=>{if(!controller.signal.aborted)setNotices([])});
  return()=>controller.abort();
 },[pathname,privatePage]);
 if(privatePage||!notices.length)return null;
 return <aside className="container site-notices" aria-label="Avisos generales">{notices.map(notice=><article className="site-notice" key={notice.id}><h2>{notice.title}</h2><p>{notice.content}</p></article>)}</aside>;
}
