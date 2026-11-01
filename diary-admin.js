const login=document.querySelector('#admin-login'),tools=document.querySelector('#admin-tools'),message=document.querySelector('#admin-message'),entries=document.querySelector('#admin-entries'),more=document.querySelector('#admin-more');
more.hidden=true;
async function api(path,options){const response=await fetch(path,{cache:'no-store',...options});const data=await response.json();if(!response.ok)throw new Error(data.error||'please try again');return data;}
function dateLabel(value){const date=new Date(value);return [date.getDate(),date.getMonth()+1,date.getFullYear()].map((n,i)=>String(n).padStart(i===2?4:2,'0')).join('.');}
async function loadAdmin(){
 const data=await api('/api/diary/admin/statements');entries.replaceChildren();
 await loadAdsAdmin();
 for(const statement of data.statements){
  const section=document.createElement('section');section.className='admin-statement';
  const heading=document.createElement('h2');heading.textContent=statement.current.text;
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='previous versions';
  const history=document.createElement('ol');history.className='version-history';
  const older=document.createElement('button');older.type='button';older.textContent='older versions';older.hidden=true;
  const original=document.createElement('p');original.className='original-version';original.textContent='original: '+statement.original;
  let cursor=null;
  async function versions(append=false){
   const data=await api(`/api/diary/admin/statements/${statement.id}/versions`+(append&&cursor?'?before='+cursor:''));if(!append)history.replaceChildren();
   for(const version of data.versions){
    const item=document.createElement('li'),text=document.createElement('p'),date=document.createElement('time');text.textContent=version.text;date.dateTime=version.created_at;date.textContent=dateLabel(version.created_at);item.append(text,date);
    if(version.removed_at){const removed=document.createElement('small');removed.textContent=' — removed from public view';item.append(removed);}
    else{const remove=document.createElement('button');remove.type='button';remove.textContent='remove this version';remove.addEventListener('click',async()=>{if(!confirm('Remove this version from public view?'))return;remove.disabled=true;try{await api('/api/diary/versions/'+version.id,{method:'DELETE'});await loadAdmin();message.textContent='version removed; its stored history is preserved';}catch(error){message.textContent=error.message;remove.disabled=false;}});item.append(remove);}
    history.append(item);
   }
   cursor=data.next;older.hidden=!cursor;
  }
  details.addEventListener('toggle',()=>{if(details.open)versions().catch(error=>message.textContent=error.message);});older.addEventListener('click',()=>versions(true).catch(error=>message.textContent=error.message));
  details.append(summary,history,older,original);section.append(heading,details);entries.append(section);
 }
}
async function signedIn(){const data=await api('/api/diary/admin/session');login.hidden=data.authenticated;tools.hidden=!data.authenticated;if(data.authenticated)await loadAdmin();}
login.addEventListener('submit',async event=>{event.preventDefault();const button=login.querySelector('button');button.disabled=true;try{await api('/api/diary/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.querySelector('#admin-password').value})});login.reset();message.textContent='';await signedIn();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
document.querySelector('#admin-logout').addEventListener('click',async()=>{try{await api('/api/diary/admin/logout',{method:'POST'});entries.replaceChildren();await signedIn();}catch(error){message.textContent=error.message;}});
signedIn().catch(()=>message.textContent='admin is temporarily unavailable');

async function loadAdsAdmin(){
 const data=await api('/api/diary/admin/ads');
 const section=document.createElement('section'),heading=document.createElement('h2');heading.textContent='your ad here';section.append(heading);
 for(const entry of [...data.texts,...data.images]){
  const row=document.createElement('div');
  if(entry.text){const text=document.createElement('p');text.textContent=entry.text;row.append(text);}
  else{const image=document.createElement('img');image.src='/api/diary/ads/image/'+entry.id;image.alt='Ad space '+(entry.slot+1);image.style.cssText='max-width:140px;max-height:140px;object-fit:contain';row.append(image);}
  const remove=document.createElement('button');remove.textContent='remove';remove.addEventListener('click',async()=>{remove.disabled=true;try{await api('/api/diary/ads/'+entry.id,{method:'DELETE'});await loadAdmin();message.textContent='removed from public view';}catch(error){message.textContent=error.message;remove.disabled=false;}});row.append(remove);section.append(row);
 }
 entries.append(section);
}
