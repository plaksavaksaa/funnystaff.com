import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pbkdf2Sync} from 'node:crypto';
import {sqliteAdapter} from '../backend/sqlite.mjs';
import {handleDiary} from '../backend/diary-api.mjs';
test('ads shared persistence, safe content, validation and protected removal',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'princess-ads-')),filename=path.join(dir,'db.sqlite');
 let db=sqliteAdapter(filename);const realNow=Date.now;let now=realNow();Date.now=()=>now;
 const salt=Buffer.from('test-ad-salt'),password='test-only-password';
 const env={DB:db,DIARY_SECRET:'isolated-test-secret',ADMIN_HASH:`100000:${salt.toString('base64url')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url')}`};
 const request=(suffix,options={},address='visitor-a')=>handleDiary(new Request('http://localhost/api/diary/'+suffix,{...options,headers:{Origin:'http://localhost',...options.headers}}),env,address);
 async function publish(kind,extra,ip='visitor-a'){
  const proof=await (await request('ads/form',{},ip)).json();now+=1100;
  const form=new FormData();form.set('kind',kind);form.set('token',proof.token);
  for(const [key,value]of Object.entries(extra))form.set(key,value);
  return request('ads',{method:'POST',body:form},ip);
 }
 try{
  await db.prepare("INSERT INTO diary_entries(id,question,answer,created_at) VALUES('legacy-ad-test','old','keep me','2020-01-01')").run();
  assert.equal((await publish('text',{text:'   '})).status,400);
  assert.equal((await publish('text',{text:'x'.repeat(1001)})).status,400);
  const response=await publish('text',{text:'<script>alert(1)</script>'});assert.equal(response.status,201);const textId=(await response.json()).id;
  const raw=readFileSync(new URL('../assets/coffee/clean.png',import.meta.url));
  const upload=await publish('image',{slot:'2',image:new Blob([raw],{type:'image/png'})});assert.equal(upload.status,201);const imageId=(await upload.json()).id;
  const state=await (await request('ads',{},'visitor-b')).json();assert.equal(state.texts[0].text,'<script>alert(1)</script>');assert.equal(state.images[0].slot,2);
  const served=await request('ads/image/'+imageId);assert.equal(served.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await served.arrayBuffer()),raw);
  assert.equal((await publish('image',{slot:'0',image:new Blob(['<svg onload="alert(1)">'],{type:'image/png'})},'visitor-c')).status,400);
  assert.equal((await request('ads/'+textId,{method:'DELETE'})).status,401);
  db.close();db=sqliteAdapter(filename);env.DB=db;
  assert.equal((await (await request('ads')).json()).texts[0].id,textId);
  assert.equal((await db.prepare("SELECT answer FROM diary_entries WHERE id='legacy-ad-test'").first()).answer,'keep me');
  const login=await request('admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);
  const cookie=login.headers.get('Set-Cookie').split(';')[0];
  for(const id of [textId,imageId])assert.equal((await request('ads/'+id,{method:'DELETE',headers:{Cookie:cookie}})).status,200);
  const empty=await (await request('ads')).json();assert.equal(empty.texts.length,0);assert.equal(empty.images.length,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM diary_ads').first()).n,2);
 }finally{Date.now=realNow;db.close();rmSync(dir,{recursive:true,force:true});}
});
