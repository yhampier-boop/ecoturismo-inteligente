import {useEffect,useMemo} from 'react';
import {MapContainer,Marker,Popup,Polyline,TileLayer,useMap} from 'react-leaflet';
import {divIcon} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {airGeometry} from '../data/airGeometry';

function markerIcon(index){
 return divIcon({className:'route-map-marker',html:`<span>${index+1}</span>`,iconSize:[34,34],iconAnchor:[17,17]});
}

function FitRoute({points}){
 const map=useMap();
 useEffect(()=>{
  if(!points.length)return;
  if(points.length===1) map.setView(points[0],10);
  if(points.length>1) map.fitBounds(points,{padding:[36,36],maxZoom:10});
 },[map,points]);
 return null;
}

export default function RouteMap({destinations=[],geometry=null,mode='driving'}){
 const stops=useMemo(()=>destinations.filter(destination=>Number.isFinite(destination.lat)&&Number.isFinite(destination.lon)),[destinations]);
 const air=useMemo(()=>airGeometry(stops),[stops]);
 const stopPoints=useMemo(()=>mode==='flight'?air.stops:stops.map(destination=>[destination.lat,destination.lon]),[stops,mode,air]);
 const routePoints=useMemo(()=>Array.isArray(geometry)?geometry.filter(point=>Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1])).map(([lon,lat])=>[lat,lon]):[],[geometry]);
 const line=useMemo(()=>mode==='flight'?air.arcs.flat():routePoints.length>1?routePoints:stopPoints,[routePoints,stopPoints,air,mode]);
 return <div className="route-map" aria-label="Mapa interactivo del recorrido">
  <MapContainer center={stopPoints[0]||[-9.19,-75.015]} zoom={stops.length?8:5} scrollWheelZoom={false} className="route-map-canvas">
   <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
   <FitRoute points={line.length>1?line:stopPoints}/>
   {line.length>1&&<Polyline positions={line} pathOptions={{color:mode==='flight'?'#65538c':'#b45e42',weight:4,opacity:.92,dashArray:mode==='flight'||!routePoints.length?'9 8':undefined}}/>}
   {mode==='flight'&&air.arcs.map((arc,index)=><Marker key={`plane-${index}`} position={arc[32]} icon={divIcon({className:'air-map-marker',html:'<span aria-hidden="true">✈</span>',iconSize:[30,30],iconAnchor:[15,15]})}><Popup>Conexión aérea orientativa. No representa un vuelo disponible.</Popup></Marker>)}
   {stops.map((destination,index)=><Marker key={`${destination.id}-${index}`} position={stopPoints[index]} icon={markerIcon(index)}><Popup><strong>{index+1}. {destination.name}</strong><br/>{destination.region}, {destination.country}</Popup></Marker>)}
  </MapContainer>
  {!stops.length&&<div className="route-map-guide"><strong>Empieza tu recorrido</strong><span>Agrega destinos y los verás marcados en el mapa.</span></div>}
  <span className="route-map-note">{mode==='flight'?'✈ Conexión ilustrativa · No es un vuelo real':routePoints.length>1?'Ruta calculada':stops.length?'Paradas seleccionadas':'Mapa de Perú'} · OpenStreetMap</span>
 </div>;
}
