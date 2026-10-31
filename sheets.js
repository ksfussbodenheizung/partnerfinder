(()=>{'use strict';
const CLIENT_ID='105285009467-kmdb5vsfte5606vts0qvrtrn2dshi010.apps.googleusercontent.com';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const SHEET='1JjjakO6xFNbP0zEXXRcnHQhSeQsF79crtNjn2znZv4I';
const $=id=>document.getElementById(id),status=t=>$('google-status').textContent=t;
let client,token='',expires=0,generation=0,controller,timer;
const remembered=()=>localStorage.getItem('pf3_authorized')==='yes';
function clear(){generation++;controller?.abort();clearTimeout(timer);token='';expires=0;window.partnerfinderSetPartners([]);$('google-reload').disabled=true;$('google-disconnect').disabled=true;}
function fail(message){clear();status(message);$('google-connect').disabled=false;}
async function load(){
 if(!token||Date.now()>=expires){fail('Sitzung abgelaufen. Bitte erneut mit Google verbinden.');return}
 const current=++generation;controller?.abort();controller=new AbortController();
 window.partnerfinderSetPartners([]);$('google-reload').disabled=true;status('Aktuelle Partnerliste wird geladen …');
 try{
  const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET+'/values:batchGetByDataFilter',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,
   body:JSON.stringify({dataFilters:[{gridRange:{sheetId:49701269}}],majorDimension:'ROWS',valueRenderOption:'FORMATTED_VALUE'})
  });
  if(current!==generation)return;
  if(!response.ok){if(response.status===401)throw Error('Sitzung abgelaufen. Bitte erneut verbinden.');if(response.status===403)throw Error('Kein Tabellenzugriff. Google-Konto, Tabellenfreigabe und aktivierte Sheets API prüfen.');if(response.status===404)throw Error('Tabelle nicht gefunden oder nicht freigegeben.');throw Error('Sheets konnte nicht geladen werden (HTTP '+response.status+').');}
  const body=await response.json();if(current!==generation)return;
  if(!Array.isArray(body.valueRanges)||!body.valueRanges.length)throw Error('Tabellenblatt mit gid 49701269 wurde nicht gefunden.');
  const data=PartnerData.fromRows(body.valueRanges[0].valueRange?.values||[]);
  window.partnerfinderSetPartners(data);status(data.length+' aktive Partner geladen · '+new Date().toLocaleTimeString('de-DE'));
 }catch(e){if(current!==generation||e.name==='AbortError')return;fail(e.message||'Verbindung fehlgeschlagen. Bitte erneut versuchen.');}
 finally{if(current===generation)$('google-reload').disabled=!token;}
}
function initialize(){
 if(!window.google?.accounts?.oauth2){status('Google-Anmeldung nicht verfügbar. CSV kann weiterhin verwendet werden.');return}
 client=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
 callback:result=>{
  if(result.error||!result.access_token){fail('Google-Zugriff wurde nicht erteilt. Bitte erneut verbinden.');return}
  if(!google.accounts.oauth2.hasGrantedAllScopes(result,SCOPE)){fail('Leseberechtigung für Google Sheets fehlt.');return}
  token=result.access_token;expires=Date.now()+Number(result.expires_in||3600)*1000;
  localStorage.setItem('pf3_authorized','yes');$('google-disconnect').disabled=false;$('google-connect').disabled=false;
  clearTimeout(timer);timer=setTimeout(()=>fail('Sitzung abgelaufen. Bitte erneut mit Google verbinden.'),Math.max(0,expires-Date.now()));load();
 },error_callback:()=>fail('Anmeldung wurde geschlossen oder vom Browser blockiert. Bitte „Mit Google verbinden“ anklicken.')});
 $('google-connect').disabled=false;status('Mit einem für die Tabelle berechtigten Google-Konto verbinden.');
 // Best effort on reopening; browsers may require a click to allow the OAuth popup.
 if(remembered())client.requestAccessToken({prompt:''});
}
$('google-connect').onclick=()=>{if(client)client.requestAccessToken({prompt:remembered()?'':'consent'})};
$('google-reload').onclick=load;
$('google-disconnect').onclick=()=>{const previous=token;clear();localStorage.removeItem('pf3_authorized');if(previous)google.accounts.oauth2.revoke(previous,()=>{});status('Verbindung getrennt. Partnerdaten wurden aus der Ansicht entfernt.');};
// Switching to CSV invalidates any in-flight Sheets response.
$('file').addEventListener('change',()=>{generation++;controller?.abort()});
const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=initialize;script.onerror=()=>status('Google-Anmeldung konnte nicht geladen werden. CSV ist weiterhin verfügbar.');document.head.append(script);
})();
