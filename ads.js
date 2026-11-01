const spaces=document.querySelector('#ad-spaces'),archive=document.querySelector('#ad-texts'),form=document.querySelector('#ad-form'),message=document.querySelector('#message'),picker=document.querySelector('#ad-image');
let proof='', chosenSlot=null, busy=false, previousTexts='';
const buttons=[];
for(let slot=0;slot<12;slot++){
 const button=document.createElement('button');button.type='button';button.className='ad-space '+(slot%2?'right':'left');
 button.style.setProperty('--top',`${180+Math.floor(slot/2)*640+Math.round(Math.random()*160)}px`);
 button.style.setProperty('--size',`${130+Math.round(Math.random()*65)}px`);
 button.style.setProperty('--small',`${58+Math.round(Math.random()*15)}px`);
 button.style.setProperty('--offset',`${3+Math.round(Math.random()*8)}%`);
 button.textContent='your ad here';button.setAttribute('aria-label',`Upload an image to ad space ${slot+1}`);
 button.addEventListener('click',()=>{if(busy)return;chosenSlot=slot;picker.value='';picker.click();});
 buttons.push(button);spaces.append(button);
}
async function api(path,options){const response=await fetch('/api/diary/ads'+path,{cache:'no-store',...options});const data=await response.json();if(!response.ok)throw new Error(data.error||'please try again');return data;}
async function refreshProof(){proof=(await api('/form')).token;}
async function load(){
 const data=await api('');
 const key=JSON.stringify(data.texts);
 if(previousTexts!==key){archive.replaceChildren(...data.texts.map(entry=>{const p=document.createElement('p');p.className='ad-text';p.textContent=entry.text;return p;}));previousTexts=key;}
 for(let slot=0;slot<buttons.length;slot++){
  const button=buttons[slot],entry=data.images.find(image=>image.slot===slot),id=entry?.id||'';
  if(button.dataset.image===id)continue;
  button.dataset.image=id;
  if(!entry){button.textContent='your ad here';continue;}
  const image=document.createElement('img');image.alt='Visitor-submitted image';image.src='/api/diary/ads/image/'+entry.id;image.loading='lazy';
  button.replaceChildren(image);
 }
}
async function submit(data){
 if(busy)return;busy=true;form.querySelector('button').disabled=true;message.textContent='publishing...';
 try{if(!proof)await refreshProof();data.set('token',proof);data.set('website',form.elements.website.value);await api('',{method:'POST',body:data});await load();message.textContent='your ad is here';if(data.get('kind')==='text')form.elements.text.value='';}
 catch(error){message.textContent=error.message;}
 finally{busy=false;form.querySelector('button').disabled=false;await refreshProof().catch(()=>{});}
}
form.addEventListener('submit',event=>{event.preventDefault();const text=form.elements.text.value.trim();if(!text){message.textContent='write something first';return;}const data=new FormData();data.set('kind','text');data.set('text',text);submit(data);});
picker.addEventListener('change',()=>{const file=picker.files[0];if(!file||chosenSlot===null)return;if(file.size>3*1024*1024){message.textContent='choose an image up to 3 MB';return;}const data=new FormData();data.set('kind','image');data.set('slot',chosenSlot);data.set('image',file);submit(data);});
Promise.all([refreshProof(),load()]).catch(()=>message.textContent='temporarily unavailable — please refresh');
setInterval(()=>{if(!busy&&!document.hidden)load().catch(()=>{});},15000);
