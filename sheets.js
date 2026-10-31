(()=>{'use strict';
const CLIENT_ID='105285009467-kmdb5vsfte5606vts0qvrtrn2dshi010.apps.googleusercontent.com';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEET='1JjjakO6xFNbP0zEXXRcnHQhSeQsF79crtNjn2znZv4I';
const $=id=>document.getElementById(id),status=t=>$('google-status').textContent=t;
let client,token='',expires=0,generation=0,controller,timer;
let pending=false;
function authReady(){pending=false;$('google-connect').disabled=!client;}
function apiError(response,body){
 const error=body?.error||{},details=error.details||[];
 const reasons=[...(error.errors||[]).map(e=>e.reason),...details.map(e=>e.reason)].filter(Boolean);
 const reason=reasons.join(' '),message=error.message||'',diagnostic=' (HTTP '+response.status+(reason?' · '+reason:'')+').';
 if(response.status===401)return 'Sitzung abgelaufen oder ungültig. Bitte erneut mit Google verbinden.';
 if(/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/.test(reason)||/insufficient.*scope/i.test(message))return 'Google hat die Sheets-Leseberechtigung nicht erteilt. Erneut verbinden und den Zugriff auf Google Sheets erlauben.'+diagnostic;
 if(/SERVICE_DISABLED|accessNotConfigured/.test(reason)||/has not been used|disabled/i.test(message))return 'Google Sheets API ist im verwendeten Cloud-Projekt nicht aktiviert. Projekt 105285009467 (OAuth-Client) und gegebenenfalls das in der Google-Fehlermeldung genannte Projekt prüfen.'+diagnostic;
 if(/API_KEY|REFERER|IP_ADDRESS/.test(reason)||/api key|referer/i.test(message))return 'Google lehnt den API-Schlüssel oder dessen Beschränkungen ab. Private Sheets-Abfragen dieser App verwenden ausschließlich OAuth; Maps-Schlüssel und vorgeschaltete Konfiguration prüfen.'+diagnostic;
 if(response.status===403)return 'Google verweigert den Tabellenzugriff. Tabellen-ID und Zugriffsrichtlinien prüfen. Google: '+(message||error.status||'PERMISSION_DENIED')+diagnostic;
 if(response.status===404)return 'Tabelle nicht gefunden oder für diese Anmeldung nicht sichtbar. Tabellen-ID prüfen.'+diagnostic;
 return 'Sheets-Abfrage fehlgeschlagen: '+(message||error.status||'Unbekannter Fehler')+diagnostic;
}
function clear(){generation++;controller?.abort();clearTimeout(timer);token='';expires=0;window.partnerfinderSetPartners([]);$('google-reload').disabled=true;$('google-disconnect').disabled=true;}
function fail(message){clear();status(message);authReady();}
async function load(){
 if(!token||Date.now()>=expires){fail('Sitzung abgelaufen. Bitte erneut mit Google verbinden.');return}
 const current=++generation;controller?.abort();controller=new AbortController();
 window.partnerfinderSetPartners([]);$('google-reload').disabled=true;status('Aktuelle Partnerliste wird geladen …');
 try{
  // Resolve the configured numeric gid without requiring write scopes.
  const request=async path=>{
   const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET+path,{
    method:'GET',headers:{Authorization:'Bearer '+token},cache:'no-store',signal:controller.signal
   });
   const body=await response.json().catch(()=>({}));
   if(current!==generation)throw Object.assign(new Error('Superseded'),{name:'AbortError'});
   if(!response.ok){const message=apiError(response,body);if(response.status===401)fail(message);throw Error(message)}
   return body;
  };
  const metadata=await request('?fields=sheets.properties(sheetId,title)');
  const sheet=metadata.sheets?.find(s=>s.properties?.sheetId===49701269);
  if(!sheet)throw Error('Tabellenblatt mit gid 49701269 wurde nicht gefunden.');
  const range="'"+sheet.properties.title.replace(/'/g,"''")+"'";
  const body=await request('/values:batchGet?ranges='+encodeURIComponent(range)+'&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE');
  if(!Array.isArray(body.valueRanges)||!body.valueRanges.length)throw Error('Google hat keinen Tabellenbereich zurückgegeben.');
  const data=PartnerData.fromRows(body.valueRanges[0].values||[]);
  window.partnerfinderSetPartners(data);status(data.length+' aktive Partner geladen · '+new Date().toLocaleTimeString('de-DE'));
 }catch(e){if(current!==generation||e.name==='AbortError')return;status(e.message||'Netzwerkfehler beim Laden der Tabelle. Bitte erneut versuchen.');}
 finally{if(current===generation)$('google-reload').disabled=!token;}
}
function initialize(){
 if(!window.google?.accounts?.oauth2){status('Google-Anmeldung nicht verfügbar. CSV kann weiterhin verwendet werden.');return}
 client=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
 callback:result=>{
  if(!pending)return;
  authReady();
  if(result.error||!result.access_token){fail('Google-Zugriff wurde nicht erteilt. Bitte erneut verbinden.');return}
  if(!google.accounts.oauth2.hasGrantedAllScopes(result,SCOPE)){fail('Leseberechtigung für Google Sheets fehlt.');return}
  token=result.access_token;expires=Date.now()+Number(result.expires_in||3600)*1000;
  $('google-disconnect').disabled=false;$('google-connect').disabled=false;
  clearTimeout(timer);timer=setTimeout(()=>fail('Sitzung abgelaufen. Bitte erneut mit Google verbinden.'),Math.max(0,expires-Date.now()));load();
 },error_callback:error=>{if(!pending)return;authReady();status(error.type==='popup_failed_to_open'?'Google-Popup konnte nicht geöffnet werden. Popups für diese Seite erlauben und erneut auf „Mit Google verbinden“ klicken.':error.type==='popup_closed'?'Google-Anmeldung wurde geschlossen. Zum Fortfahren erneut verbinden.':'Google-Anmeldung fehlgeschlagen. Bitte erneut verbinden.');}});
 $('google-connect').disabled=false;status('Mit einem für die Tabelle berechtigten Google-Konto verbinden.');
 // OAuth popups must be opened synchronously by an explicit user click.
}
$('google-connect').onclick=()=>{
 if(!client||pending)return;
 clear();pending=true;$('google-connect').disabled=true;status('Google-Anmeldung läuft …');
 try{client.requestAccessToken({prompt:'consent'});}catch{authReady();status('Google-Anmeldung konnte nicht gestartet werden. Popups erlauben und erneut verbinden.');}
};
$('google-reload').onclick=load;
$('google-disconnect').onclick=()=>{const previous=token;pending=false;clear();authReady();localStorage.removeItem('pf3_authorized');if(previous)google.accounts.oauth2.revoke(previous,()=>{});status('Verbindung getrennt. Partnerdaten wurden aus der Ansicht entfernt.');};
// Switching to CSV invalidates any in-flight Sheets response.
$('file').addEventListener('change',e=>{if(!e.target.files?.length)return;pending=false;clearTimeout(timer);generation++;controller?.abort();token='';expires=0;$('google-reload').disabled=true;$('google-disconnect').disabled=true;authReady();});
const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=initialize;script.onerror=()=>status('Google-Anmeldung konnte nicht geladen werden. CSV ist weiterhin verfügbar.');document.head.append(script);
})();
