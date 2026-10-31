(()=>{'use strict';
const $=id=>document.getElementById(id),msg=t=>$('message').textContent=t;
let map,geocoder,siteMarker,partnerMarkers=[],partners=[],site=null,visible=false;
const storageKey='pf2_',get=k=>localStorage.getItem(storageKey+k)||'',put=(k,v)=>localStorage.setItem(storageKey+k,v);
$('key').value=get('key');$('sheet').value=get('sheet');
function readMapsAddress(){
 const params=new URLSearchParams(location.search);
 if(params.get('address'))return params.get('address').trim();
 const raw=params.get('maps');if(!raw)return '';
 try{
  const u=new URL(raw);
  const q=u.searchParams.get('query')||u.searchParams.get('q')||u.searchParams.get('destination');
  if(q)return q;
  const match=u.pathname.match(/\/(?:place|search)\/([^/]+)/);
  if(match)return decodeURIComponent(match[1]).replace(/\+/g,' ');
  return '';
 }catch{return ''}
}
$('address').value=readMapsAddress();
function loadMap(){const key=$('key').value.trim();if(!key){msg('Bitte zuerst unter Einrichtung den Google Maps API-Schlüssel eintragen.');$('setup').open=true;return}if(window.google?.maps){initMap();return}const old=document.getElementById('gmaps');if(old)old.remove();const s=document.createElement('script');s.id='gmaps';s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&callback=partnerfinderInit&v=weekly';s.async=true;s.onerror=()=>msg('Google Maps konnte nicht geladen werden. API-Schlüssel, Abrechnung und Domain-Beschränkung prüfen.');document.head.appendChild(s)}
window.partnerfinderInit=()=>initMap();
function initMap(){map=new google.maps.Map($('map'),{center:{lat:51.2,lng:7},zoom:8,mapTypeControl:false});geocoder=new google.maps.Geocoder();msg('Karte bereit. Baustelle anzeigen, dann Partnerbetriebe einblenden.');$('show').disabled=false;if($('address').value.trim())locate();}
function geo(address){return new Promise((resolve,reject)=>geocoder.geocode({address},(r,status)=>status==='OK'&&r?.[0]?resolve(r[0].geometry.location):reject(new Error('Adresse nicht gefunden: '+address+' ('+status+')'))))}
async function locate(){if(!map){loadMap();return}const a=$('address').value.trim();if(!a){msg('Bitte Baustellenadresse eingeben.');return}try{msg('Baustelle wird gesucht …');site=await geo(a);if(siteMarker)siteMarker.setMap(null);siteMarker=new google.maps.Marker({map,position:site,title:'Baustelle: '+a,icon:{url:'https://maps.google.com/mapfiles/ms/icons/red-dot.png'}});map.setCenter(site);map.setZoom(11);msg('Baustelle gefunden.');if(visible)render()}catch(e){msg(e.message)}}
$('locate').addEventListener('click',locate);
function parseCSV(text){return PartnerData.fromCSV(text)}
function setPartners(data){const selectedTrade=$('trade').value;renderVersion++;partnerMarkers.forEach(m=>m.setMap(null));partnerMarkers=[];$('results').replaceChildren();partners=data;for(const key of Object.keys(coordsCache))delete coordsCache[key];$('count').textContent=partners.length+' aktive Partner geladen';const trades=[...new Set(partners.map(p=>p.trade).filter(Boolean))].sort();$('trade').replaceChildren(new Option('Alle Gewerke',''),...trades.map(t=>new Option(t,t)));if(trades.includes(selectedTrade))$('trade').value=selectedTrade;msg(partners.length+' Partner geladen.');if(visible)render()}
window.partnerfinderSetPartners=data=>{visible=true;setPartners(data)};
$('file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{setPartners(parseCSV(await f.text()))}catch(err){msg('CSV konnte nicht gelesen werden: '+err.message)}});
async function loadSheet(){const url=$('sheet').value.trim();if(!url)return;try{const u=new URL(url);if(u.protocol!=='https:')throw Error('Nur HTTPS-Links erlaubt');msg('Google Sheets wird geladen …');const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);setPartners(parseCSV(await response.text()))}catch(e){msg('Sheets-Laden fehlgeschlagen (ggf. Freigabe/CORS): '+e.message+'. Alternativ CSV-Datei auswählen.')}}
$('save').addEventListener('click',()=>{put('key',$('key').value.trim());put('sheet',$('sheet').value.trim());location.reload()});
function distance(a,b){const toRad=x=>x*Math.PI/180,lat1=toRad(a.lat()),lat2=toRad(b.lat()),dl=lat2-lat1,dlo=toRad(b.lng()-a.lng());return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dl/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlo/2)**2)))}
localStorage.removeItem(storageKey+'coords');
const coordsCache=Object.create(null);
let renderVersion=0;
async function getPosition(p){const lat=Number(String(p.lat).replace(',','.')),lng=Number(String(p.lng).replace(',','.'));if(p.lat&&p.lng&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)return new google.maps.LatLng(lat,lng);const address=[p.street,p.zip,p.city,'Deutschland'].filter(Boolean).join(', ');if(!p.street&&!p.city)throw Error('Adresse fehlt');if(coordsCache[address])return new google.maps.LatLng(...coordsCache[address]);const pos=await geo(address);coordsCache[address]=[pos.lat(),pos.lng()];return pos}
async function render(){const version=++renderVersion;if(!site){msg('Bitte zuerst Baustelle anzeigen.');return}partnerMarkers.forEach(m=>m.setMap(null));partnerMarkers=[];$('results').replaceChildren();const trade=$('trade').value,radius=Number($('radius').value);const subset=partners.filter(p=>!trade||p.trade===trade);let rows=[],failed=0;msg('Partnerstandorte werden ermittelt …');for(let i=0;i<subset.length;i++){const p=subset[i];try{const position=await getPosition(p);if(version!==renderVersion)return;const km=distance(site,position);if(!radius||km<=radius)rows.push({...p,position,km})}catch{failed++}if(i%5===0)msg('Standorte geprüft: '+(i+1)+' / '+subset.length)}if(version!==renderVersion)return;rows.sort((a,b)=>a.km-b.km);const bounds=new google.maps.LatLngBounds();bounds.extend(site);for(const p of rows){const marker=new google.maps.Marker({map,position:p.position,title:p.name,icon:{url:'https://maps.google.com/mapfiles/ms/icons/green-dot.png'}});partnerMarkers.push(marker);bounds.extend(p.position);const card=document.createElement('article');card.className='card';const name=document.createElement('strong');name.textContent=p.name;const info=document.createElement('small');info.textContent=p.km.toFixed(1)+' km Luftlinie · '+(p.trade||'Ohne Gewerk')+' · '+[p.zip,p.city].filter(Boolean).join(' ');card.append(name,info);if(p.contact){const c=document.createElement('div');c.textContent=p.contact;card.append(c)}if(p.email){const a=document.createElement('a');a.href='mailto:'+encodeURIComponent(p.email);a.textContent=p.email;card.append(a)}if(p.phone){const a=document.createElement('a');a.href='tel:'+p.phone.replace(/[^\d+]/g,'');a.textContent='📞 '+p.phone;card.append(a)}const route=document.createElement('a');route.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent([p.street,p.zip,p.city].filter(Boolean).join(', '));route.target='_blank';route.rel='noopener';route.textContent='Route';card.append(route);card.addEventListener('click',()=>{map.panTo(p.position);map.setZoom(13)});$('results').append(card)}if(rows.length)map.fitBounds(bounds,70);$('count').textContent=rows.length+' Partner im Ergebnis';msg(failed?failed+' Partner konnten nicht lokalisiert werden. Bitte Adressen prüfen.':'Alle Standorte geladen.');}
$('show').addEventListener('click',async()=>{if(!map){msg('Karte noch nicht geladen.');return}if(!partners.length&&$('sheet').value.trim())await loadSheet();if(!partners.length){msg('Bitte mit Google verbinden oder eine CSV-Datei laden.');return}visible=true;await render()});$('trade').addEventListener('change',()=>{if(visible)render()});$('radius').addEventListener('change',()=>{if(visible)render()});
if(get('key')){loadMap()}else{$('setup').open=true;msg('Einmalig API-Schlüssel eintragen und speichern.')}
})();
