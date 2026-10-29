import {MapPin,Navigation2} from 'lucide-react';
export default function RouteSketch({destinations=[],mode='driving',geometry=null}){
  const count=destinations.length;
 let points=[],routePoints=[];
  if(count){
   const routeCoordinates=Array.isArray(geometry)?geometry.filter(point=>Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1])):[];
   const lats=[...destinations.map(d=>d.lat),...routeCoordinates.map(point=>point[1])],lons=[...destinations.map(d=>d.lon),...routeCoordinates.map(point=>point[0])];
   const loLat=Math.min(...lats),hiLat=Math.max(...lats),loLon=Math.min(...lons),hiLon=Math.max(...lons);
   const width=Math.max(hiLon-loLon,.6),height=Math.max(hiLat-loLat,.6);
   points=destinations.map((d,i)=>({x:80+((d.lon-loLon)/width)*480,y:315-((d.lat-loLat)/height)*235,index:i,label:d.name}));
   routePoints=routeCoordinates.map(([lon,lat])=>({x:80+((lon-loLon)/width)*480,y:315-((lat-loLat)/height)*235}));
   if(count===1)points=[{...points[0],x:320,y:195}];
 }
 return <div className="route-sketch" aria-label="Representación esquemática de las paradas seleccionadas">
  <div className="map-grid"/>
  <svg viewBox="0 0 640 380" role="img" aria-label="Paradas conectadas de forma aproximada" preserveAspectRatio="xMidYMid meet">
   <defs><pattern id="mapPattern" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0H0V54" fill="none" stroke="#c4d8c8" strokeWidth=".8"/></pattern><linearGradient id="routeFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#165c48"/><stop offset="100%" stopColor="#b7b35d"/></linearGradient></defs>
   <rect width="640" height="380" fill="url(#mapPattern)" opacity=".65"/>
   <path d="M-20 305Q110 130 215 270T470 90T680 180" fill="none" stroke="#c6dbcb" strokeWidth="29" opacity=".3"/>
   <path d="M-50 310Q110 130 215 270T470 90T680 180" fill="none" stroke="#9fbfaf" strokeWidth="1.5" strokeDasharray="4 8" opacity=".8"/>
    {points.length>1&&<polyline points={(routePoints.length>1?routePoints:points).map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="url(#routeFill)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={routePoints.length>1?undefined:'9 7'}/>} 
   {points.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="24" fill="#fff" opacity=".85"/><circle cx={p.x} cy={p.y} r="16" fill="#114d3b" stroke="#fff" strokeWidth="3"/><text x={p.x} y={p.y+5} fontSize="13" fontWeight="700" textAnchor="middle" fill="#fff">{i+1}</text><text x={p.x} y={p.y-37} fontSize="14" fontWeight="700" textAnchor="middle" fill="#244e40">{p.label}</text></g>)}
  </svg>
  {!count&&<div className="map-placeholder"><MapPin size={30}/><h4>Tu ruta empieza aquí</h4><p>Agrega paradas para ver tu recorrido esquemático.</p></div>}
   <div className="map-chip"><Navigation2 size={14}/>{routePoints.length>1?'Trayecto vial real · Vista ilustrativa':'Vista ilustrativa · No es un mapa vial real'}</div>
 </div>
}
