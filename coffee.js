const scene=document.querySelector('.scene');
function fit(){scene.style.setProperty('--scale',Math.min(innerWidth/1440,innerHeight/900));}
fit();addEventListener('resize',fit);
const ready=Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));
for(const [id,state,sound] of [['cigarette','smoked','match-sound'],['coffee','drunk','coffee-sound']]){
 const button=document.getElementById(id);let used=false;
 button.addEventListener('click',()=>{
  if(used)return;used=true;button.setAttribute('aria-disabled','true');
  document.getElementById(sound).play().catch(()=>{});
  ready.then(()=>scene.classList.add(state));
 });
}
