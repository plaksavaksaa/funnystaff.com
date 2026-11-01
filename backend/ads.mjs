const SLOTS = 12;
const LIMIT = 3 * 1024 * 1024;
function imageType(bytes) {
 if (bytes.length<16) return null;
 if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255) return 'image/jpeg';
 const head=new TextDecoder('ascii').decode(bytes.slice(0,16));
 if(head.startsWith('GIF87a')||head.startsWith('GIF89a'))return 'image/gif';
 if(head.startsWith('RIFF')&&head.slice(8,12)==='WEBP')return 'image/webp';
 return null;
}
function encode(bytes) {let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
export async function handleAds(request,env,h) {
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/diary/ads')&&!path.startsWith('/api/diary/admin/ads'))return null;
 const {json,token,readToken,rateLimit,adminSession,clientKey,now}=h;
 await env.DB.prepare(`CREATE TABLE IF NOT EXISTS diary_ads (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,slot INTEGER,text TEXT,mime TEXT,image TEXT,created_at TEXT NOT NULL,removed_at TEXT)`).run();
 const admin=path.startsWith('/api/diary/admin/ads')||request.method==='DELETE';
 if(admin&&!await adminSession(request,env,now))return json({error:'sign in first'},401);
 if(path==='/api/diary/ads/form'&&request.method==='GET')return json({token:await token({kind:'ad',issued:now,nonce:crypto.randomUUID(),client:clientKey},env.DIARY_SECRET)});
 if((path==='/api/diary/ads'||path==='/api/diary/admin/ads')&&request.method==='GET'){
  const {results:texts}=await env.DB.prepare("SELECT id,text,created_at FROM diary_ads WHERE kind='text' AND removed_at IS NULL ORDER BY seq DESC LIMIT 500").all();
  const {results:images}=await env.DB.prepare("SELECT id,slot,created_at FROM diary_ads WHERE kind='image' AND removed_at IS NULL AND seq IN (SELECT MAX(seq) FROM diary_ads WHERE kind='image' AND removed_at IS NULL GROUP BY slot) ORDER BY slot").all();
  return json({texts,images,slots:SLOTS});
 }
 const imageMatch=path.match(/^\/api\/diary\/ads\/image\/([0-9a-f-]{36})$/);
 if(imageMatch&&request.method==='GET'){
  const row=await env.DB.prepare("SELECT mime,image FROM diary_ads WHERE id=? AND kind='image' AND removed_at IS NULL").bind(imageMatch[1]).first();
  if(!row)return json({error:'image not found'},404);
  const bytes=Uint8Array.from(atob(row.image),c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{'Content-Type':row.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 if(path==='/api/diary/ads'&&request.method==='POST'){
  const data=await request.formData();
  if(data.get('website'))return json({error:'please try again'},400);
  const proof=await readToken(String(data.get('token')||''),env.DIARY_SECRET);
  if(!proof||proof.kind!=='ad'||proof.client!==clientKey||now-proof.issued<1000||now-proof.issued>86400000)return json({error:'please wait a moment and try again'},400);
  const kind=String(data.get('kind')||'');let text=null,mime=null,image=null,slot=null;
  if(kind==='text'){
   text=String(data.get('text')||'').trim();
   if(!text||[...text].length>1000)return json({error:'write between 1 and 1,000 characters'},400);
  }else if(kind==='image'){
   const rawSlot=String(data.get('slot')||'');slot=Number(rawSlot);
   if(!/^\d+$/.test(rawSlot)||slot<0||slot>=SLOTS)return json({error:'choose an image space'},400);
   const file=data.get('image');
   if(!file||typeof file.arrayBuffer!=='function'||file.size===0||file.size>LIMIT)return json({error:'choose an image up to 3 MB'},400);
   const bytes=new Uint8Array(await file.arrayBuffer());mime=imageType(bytes);
   if(!mime)return json({error:'use a PNG, JPG, WEBP or GIF image'},400);
   image=encode(bytes);
  }else return json({error:'invalid submission'},400);
  if(!await rateLimit(env.DB,'ads:'+clientKey,now,3,30))return json({error:'too many submissions — please try later'},429,{'Retry-After':'60'});
  const nonce=await env.DB.prepare('INSERT OR IGNORE INTO diary_nonces(nonce,expires_at) VALUES(?,?) RETURNING nonce').bind(proof.nonce,now+86400000).first();
  if(!nonce)return json({error:'already submitted — please try again'},409);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO diary_ads(id,kind,slot,text,mime,image,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,kind,slot,text,mime,image,new Date(now).toISOString()).run();
  return json({id},201);
 }
 const removal=path.match(/^\/api\/diary\/ads\/([0-9a-f-]{36})$/);
 if(removal&&request.method==='DELETE'){
  const result=await env.DB.prepare('UPDATE diary_ads SET removed_at=? WHERE id=? AND removed_at IS NULL').bind(new Date(now).toISOString(),removal[1]).run();
  return result.meta.changes?json({ok:true}):json({error:'entry not found'},404);
 }
 return json({error:'not found'},404);
}
