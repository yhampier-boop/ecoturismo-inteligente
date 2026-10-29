import 'dotenv/config';
import {getWeather,getRoute,getPhotos,searchCities} from '../src/integrations.js';
import {searchWorld} from '../src/places.js';

// Consultas pequeñas a los servicios REALES; nunca imprime URLs con claves.
const checks=[
 ['OpenWeather actual + pronóstico',()=>getWeather({lat:40.4168,lon:-3.7038}),r=>r.source==='openweather'&&r.current&&r.forecast.length],
 ['OpenWeather Geocoding',()=>searchCities('Madrid'),r=>r.length>0],
 ['OpenRouteService',()=>getRoute({coordinates:[[-3.7038,40.4168],[-3.6883,40.4200]],mode:'walking'}),r=>r.source==='openrouteservice'&&r.geometry?.length>1],
 ['Unsplash',()=>getPhotos({name:'Madrid',country:'España',limit:1}),r=>r.source==='unsplash'&&r.photos.length],
 ['Photon / OpenStreetMap (búsqueda en español)',()=>searchWorld('Torre Eiffel','FR'),r=>r.places.some(p=>p.provider==='photon')]
];
for(const [provider,run,valid] of checks){
 try {
  const result=await run();
  const ok=Boolean(valid(result));
  console.log(`${ok?'OK':'PENDIENTE'} · ${provider}${!ok?` · ${result.message||'Sin resultados válidos; revisa credenciales, cuota o conexión.'}`:''}`);
  if(!ok)process.exitCode=1;
 } catch {
  console.log(`PENDIENTE · ${provider} · No se pudo verificar; revisa configuración o conexión.`);
  process.exitCode=1;
 }
}
