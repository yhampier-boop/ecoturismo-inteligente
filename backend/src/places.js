import {cache, fetchJson, countryDisplayName, isValidCoordinate, searchCities} from './integrations.js';

const ISO_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
export const countries = ISO_CODES.map(code => ({code, name:countryDisplayName(code)})).sort((a,b) => a.name.localeCompare(b.name,'es'));

export function normalizePhoton(feature) {
 const p = feature?.properties;
 const [lon, lat] = feature?.geometry?.coordinates || [];
 if (!p?.name || !isValidCoordinate({lat,lon})) return null;
 const countryCode = String(p.countrycode || '').toUpperCase();
 if (!ISO_CODES.includes(countryCode)) return null;
 const country = countryDisplayName(countryCode);
 const kind = p.osm_value;
 const placeType = kind === 'country' ? 'country' : p.osm_key === 'place' && ['city','town','village','municipality'].includes(kind) ? 'city' : 'place';
 const category = placeType === 'country' ? 'País' : placeType === 'city' ? 'Ciudad'
  : ['natural','leisure'].includes(p.osm_key) ? 'Naturaleza'
  : p.osm_key === 'historic' || ['museum','gallery','artwork'].includes(kind) ? 'Cultura' : 'Lugar turístico';
 if (!['place','tourism','historic','natural','leisure','man_made'].includes(p.osm_key) && !(p.osm_key === 'amenity' && p.osm_value === 'place_of_worship')) return null;
 return {name:placeType === 'country' ? country : String(p.name).slice(0,160), region:String(p.state || p.county || p.city || country).slice(0,120), country, countryCode, lat, lon,
  provider:'photon', placeType, category, city: p.city ? String(p.city).slice(0,160) : placeType === 'city' ? String(p.name).slice(0,160) : null};
}

// Solo traduce términos genéricos, nunca crea nombres, coordenadas o destinos.
export function tourismQuery(query) {
 const match=query.match(/^(torre|museo|palacio|puente|estatua|lago|cataratas|parque|catedral|templo|castillo|isla|playa)\s+(?:(?:de|del|la|el|los|las)\s+)*(.*)$/i);
 if(!match?.[2])return query;
 const words={torre:'tower',museo:'museum',palacio:'palace',puente:'bridge',estatua:'statue',lago:'lake',cataratas:'falls',parque:'park',catedral:'cathedral',templo:'temple',castillo:'castle',isla:'island',playa:'beach'};
 return `${match[2]} ${words[match[1].toLowerCase()]}`;
}

export async function searchWorld(query, countryCode = '') {
 const q=String(query||'').trim().slice(0,80);
 if(q.length<2)return {places:[],message:''};
 const plain=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const exactCountry=countries.find(item=>plain(item.name)===plain(q)||item.code===q.toUpperCase());
 const boundary=countryCode||exactCountry?.code||'';
 const term=exactCountry?new Intl.DisplayNames(['en'],{type:'region'}).of(exactCountry.code):q;
 const photon=cache(`world:${q.toLowerCase()}:${boundary}`,60*60_000,async()=>{
  const variants=[...new Set([term,tourismQuery(term)])];
  for(const text of variants){
   const params=new URLSearchParams({q:text,limit:'12',lang:'en'});
   if(boundary)params.set('countrycode',boundary.toLowerCase());
   const body=await fetchJson(`https://photon.komoot.io/api/?${params}`);
   if(!Array.isArray(body?.features))throw new Error('Respuesta geográfica incompleta.');
   const places=body.features.map(normalizePhoton).filter(p=>p&&(!boundary||p.countryCode===boundary));
   if(places.length)return places;
  }
  return [];
 });
 const cities=process.env.OPENWEATHER_API_KEY&&!exactCountry
  ?searchCities(q).then(items=>items.filter(p=>!boundary||p.countryCode===boundary).map(p=>({...p,provider:'openweather',placeType:'city',category:'Ciudad',city:p.name})))
  :Promise.resolve([]);
 const [osm,weather]=await Promise.allSettled([photon,cities]);
 const combined=[...(weather.status==='fulfilled'?weather.value:[]),...(osm.status==='fulfilled'?osm.value:[])];
 const places=[];
 for(const place of combined){
  if(!places.some(p=>p.countryCode===place.countryCode&&plain(p.name)===plain(place.name)&&Math.abs(p.lat-place.lat)<0.05&&Math.abs(p.lon-place.lon)<0.05))places.push(place);
 }
 const message=osm.status==='rejected'
  ?places.length?'La búsqueda de países y lugares no está disponible temporalmente; se muestran las ciudades disponibles de OpenWeather.':'La búsqueda mundial no está disponible temporalmente. Puedes explorar los destinos guardados o volver a intentarlo más tarde.'
  :'';
 return {places:places.slice(0,12),message};
}
