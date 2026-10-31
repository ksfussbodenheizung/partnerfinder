/* Shared normalization for authenticated Sheets and local CSV. No partner data is persisted. */
(function(root){
'use strict';
const normalize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]/g,'');
const fields={id:['Partner-ID','Partner ID'],name:['Firmenname','Firma','Name'],street:['Straße und Hausnummer','Straße','Adresse'],zip:['PLZ','Postleitzahl'],city:['Ort','Stadt'],trade:['Gewerk'],contact:['Ansprechpartner'],phone:['Telefon','Telefonnummer'],email:['E-Mail','Email'],radius:['Einsatzradius (km)','Einsatzradius'],status:['Status'],notes:['Notizen'],lat:['Breitengrad','Latitude'],lng:['Längengrad','Longitude']};
function fromRows(rows){
 if(!rows.length)return [];
 const header=rows[0].map(normalize),indexes={};
 for(const [field,names] of Object.entries(fields)){
  const matches=header.map((h,i)=>names.map(normalize).includes(h)?i:-1).filter(i=>i>=0);
  if(matches.length>1)throw Error('Doppelte Spalte: '+names[0]);
  indexes[field]=matches[0]??-1;
 }
 for(const f of ['name','status'])if(indexes[f]<0)throw Error('Spalte fehlt: '+fields[f][0]);
 return rows.slice(1).map(row=>Object.fromEntries(Object.entries(indexes).map(([field,i])=>[field,String(row[i]??'').trim()]))).filter(p=>p.name&&normalize(p.status)==='aktiv');
}
function fromCSV(text){
 text=String(text).replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/)[0];
 const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(c===delimiter&&!quoted){row.push(cell);cell=''}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}
  else cell+=c;
 }
 if(quoted)throw Error('Nicht geschlossenes Anführungszeichen in CSV');
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return fromRows(rows);
}
root.PartnerData={fromRows,fromCSV};
})(globalThis);
