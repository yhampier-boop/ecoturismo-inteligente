// Arcos de círculo máximo sobre una esfera. Longitudes continuas para no
// dibujar una línea alrededor del mundo al cruzar el antimeridiano.
export function airGeometry(destinations) {
 const stops=[];
 for(const destination of destinations) {
  let lon=Number(destination.lon);
  const previous=stops.at(-1)?.[1];
  if(previous!=null) {while(lon-previous>180)lon-=360;while(lon-previous<-180)lon+=360;}
  stops.push([Number(destination.lat),lon]);
 }
 const radians=x=>x*Math.PI/180;
 const degrees=x=>x*180/Math.PI;
 const arcs=stops.slice(0,-1).map(([lat,lon],i)=>{
  const [endLat,endLon]=stops[i+1];
  const a=radians(lat),b=radians(endLat),delta=radians(endLon-lon);
  const distance=2*Math.asin(Math.min(1,Math.sqrt(Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(delta/2)**2)));
  const bearing=Math.atan2(Math.sin(delta)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(delta));
  let previous=lon;
  return Array.from({length:65},(_,step)=>{
   if(step===0)return [lat,lon];
   if(step===64)return [endLat,endLon];
   const d=distance*step/64;
   const phi=Math.asin(Math.max(-1,Math.min(1,Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(bearing))));
   let lambda=lon+degrees(Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(phi)));
   while(lambda-previous>180)lambda-=360;
   while(lambda-previous<-180)lambda+=360;
   previous=lambda;
   return [degrees(phi),lambda];
  });
 });
 return {stops,arcs};
}
