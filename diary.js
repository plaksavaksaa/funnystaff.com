const container = document.querySelector('#statements');
const message = document.querySelector('#diary-message');
const views = new Map();
let refreshing = false;
async function api(path,options){
  const response=await fetch(path,{cache:'no-store',...options});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'please try again');
  return data;
}
function dateLabel(value){const date=new Date(value);return [date.getDate(),date.getMonth()+1,date.getFullYear()].map((part,i)=>String(part).padStart(i===2?4:2,'0')).join('.');}
function originalNode(text){const item=document.createElement('li');item.className='original-version';const label=document.createElement('small');label.textContent='original';const content=document.createElement('p');content.textContent=text;item.append(label,content);return item;}
function versionNode(version){const item=document.createElement('li');const text=document.createElement('p');text.textContent=version.text;const date=document.createElement('time');date.dateTime=version.created_at;date.textContent=dateLabel(version.created_at);item.append(text,date);return item;}
async function loadHistory(view,append=false){
  view.older.disabled=true;
  try{
    const data=await api(`/api/diary/statements/${view.state.id}/versions`+(append&&view.cursor?'?before='+view.cursor:''));
    if(!append)view.history.replaceChildren();
    for(const version of data.versions)if(version.id!==view.state.current.id)view.history.append(versionNode(version));
    view.cursor=data.next;view.older.hidden=!data.next;view.historyMessage.textContent='';
  }catch(error){view.historyMessage.textContent=error.message;}finally{view.older.disabled=false;}
}
function updateStates(statements){
  for(const state of statements){
    const view=views.get(state.id);
    if(!view){createStatement(state);continue;}
    const changed=view.state.current.id!==state.current.id;
    view.state=state;view.current.textContent=state.current.text;
    // Update the public sentence and history, never replace someone's unsaved draft.
    if(changed&&view.details.open)loadHistory(view);
  }
}
async function refresh(){if(refreshing)return;refreshing=true;try{const data=await api('/api/diary/statements');updateStates(data.statements);message.textContent='';}catch(error){message.textContent='could not load the statements';}finally{refreshing=false;}}
function createStatement(state){
  const item=document.createElement('li');item.className='statement';item.dataset.statementId=state.id;
  const current=document.createElement('button');current.className='statement-current';current.type='button';current.textContent=state.current.text;current.setAttribute('aria-expanded','false');current.setAttribute('aria-controls','editor-'+state.id);
  const form=document.createElement('form');form.id='editor-'+state.id;form.className='statement-editor';form.hidden=true;
  const textarea=document.createElement('textarea');textarea.rows=3;textarea.required=true;textarea.setAttribute('aria-label','your version');textarea.setAttribute('aria-describedby','count-'+state.id);
  const count=document.createElement('small');count.id='count-'+state.id;count.className='version-count';
  const honeypot=document.createElement('input');honeypot.name='website';honeypot.className='honeypot';honeypot.tabIndex=-1;honeypot.autocomplete='off';honeypot.setAttribute('aria-hidden','true');honeypot.setAttribute('aria-label','leave this empty');
  const submit=document.createElement('button');submit.type='submit';submit.textContent='change it';submit.disabled=true;
  const status=document.createElement('p');status.className='edit-status';status.setAttribute('role','status');form.append(textarea,count,honeypot,submit,status);
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='previous versions';
  const history=document.createElement('ol');history.className='version-history';const historyMessage=document.createElement('p');historyMessage.className='history-status';
  const older=document.createElement('button');older.type='button';older.textContent='older versions';older.hidden=true;
  const originals=document.createElement('ol');originals.className='version-history';originals.append(originalNode(state.original));details.append(summary,history,historyMessage,older,originals);
  const view={state,current,form,textarea,count,submit,status,details,history,historyMessage,older,cursor:null,proof:null};views.set(state.id,view);
  function countCharacters(){const length=[...textarea.value].length;count.textContent=`${length} / 1,000`;textarea.setCustomValidity(length>1000?'keep your version to 1,000 characters':'');}
  textarea.addEventListener('input',countCharacters);
  current.addEventListener('click',async()=>{
    if(!form.hidden){form.hidden=true;current.setAttribute('aria-expanded','false');return;}
    form.hidden=false;current.setAttribute('aria-expanded','true');textarea.disabled=true;submit.disabled=true;status.textContent='';view.proof=null;
    try{
      const data=await api(`/api/diary/statements/${state.id}/form`);
      textarea.value=data.current.text;view.proof=data.token;textarea.disabled=false;submit.disabled=false;countCharacters();textarea.focus({preventScroll:true});
    }catch(error){status.textContent=error.message;}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();const text=textarea.value.trim();if(!text||[...text].length>1000){status.textContent='write between 1 and 1,000 characters';return;}
    submit.disabled=true;status.textContent='';
    try{
      const data=await api(`/api/diary/statements/${state.id}/versions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,token:view.proof,website:honeypot.value})});
      updateStates(data.statements);status.textContent='saved.';
      const fresh=await api(`/api/diary/statements/${state.id}/form`);view.proof=fresh.token;
    }catch(error){status.textContent=error.message;}finally{submit.disabled=false;}
  });
  details.addEventListener('toggle',()=>{if(details.open)loadHistory(view);});
  older.addEventListener('click',()=>loadHistory(view,true));
  item.append(current,form,details);container.append(item);
}
refresh();
// Shared state is fetched from the server, never localStorage. Other open
// visitors see changes within two seconds without disturbing their drafts.
setInterval(()=>{if(!document.hidden)refresh();},2000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
