import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pbkdf2Sync} from 'node:crypto';
import {sqliteAdapter} from '../backend/sqlite.mjs';
import {handleDiary} from '../backend/diary-api.mjs';
import {ORIGINAL_STATEMENTS} from '../backend/statements.mjs';
const dir=mkdtempSync(path.join(tmpdir(),'statements-test-')),file=path.join(dir,'test.sqlite');
let db=sqliteAdapter(file);
const salt=Buffer.from('test-only-salt'),env={DB:db,DIARY_SECRET:'test-secret-only',ADMIN_HASH:`100000:${salt.toString('base64url')}:${pbkdf2Sync('test-password',salt,100000,32,'sha256').toString('base64url')}`};
async function api(route,method='GET',data,client='reader',headers={}){const response=await handleDiary(new Request('https://diary.test/api/diary'+route,{method,headers:{...(method==='GET'?{}:{Origin:'https://diary.test','Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)}),env,client);return{response,data:await response.json()};}
async function editor(id,client){const real=Date.now;try{Date.now=()=>real()-3000;return(await api(`/statements/${id}/form`,'GET',undefined,client)).data;}finally{Date.now=real;}}
async function edit(id,text,client){const form=await editor(id,client);return api(`/statements/${id}/versions`,'POST',{text,token:form.token},client);}
test('five exact originals are stored once, with no invented visitor versions',async()=>{
 const data=(await api('/statements')).data;assert.deepEqual(data.statements.map(s=>s.original),ORIGINAL_STATEMENTS.map(s=>s.text));assert.ok(data.statements.every(s=>s.current.id===null&&s.current.text===s.original));
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM diary_statement_versions').first()).n,0);
 await api('/statements');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM diary_statements').first()).n,5);
});
test('each statement saves independently and its editor loads the latest version',async()=>{
 for(const [i,s] of ORIGINAL_STATEMENTS.entries()){
  const text=`test version ${i}`;const result=await edit(s.id,text,`editor-${i}`);assert.equal(result.response.status,201);
  const form=await editor(s.id,`other-session-${i}`);assert.equal(form.current.text,text);
  const history=(await api(`/statements/${s.id}/versions`)).data;assert.equal(history.versions[0].text,text);assert.equal(history.original,s.text);
 }
});
test('concurrent submissions from stale editors append every version',async()=>{
 const id=ORIGINAL_STATEMENTS[0].id;
 const forms=[await editor(id,'parallel-a'),await editor(id,'parallel-b')];assert.equal(forms[0].current.id,forms[1].current.id);
 const results=await Promise.all(forms.map((f,i)=>api(`/statements/${id}/versions`,'POST',{text:`parallel ${i}`,token:f.token},i?'parallel-b':'parallel-a')));assert.ok(results.every(r=>r.response.status===201));
 const versions=(await api(`/statements/${id}/versions`)).data.versions;for(const result of results)assert.ok(versions.some(v=>v.id===result.data.version.id));
 const current=(await editor(id,'independent')).current;assert.equal(current.id,versions[0].id);assert.equal(versions.length,3);
});
test('history and current versions survive database reopening and separate clients',async()=>{
 db.close();db=sqliteAdapter(file);env.DB=db;const state=(await api('/statements','GET',undefined,'new-device')).data.statements;assert.ok(state.every(s=>s.current.id));
 assert.equal((await api(`/statements/${ORIGINAL_STATEMENTS[0].id}/versions`)).data.versions.length,3);
});
test('empty, overlong, cross-origin and mismatched-form edits fail; markup remains text',async()=>{
 const id=ORIGINAL_STATEMENTS[1].id;assert.equal((await edit(id,' \n ','empty')).response.status,400);assert.equal((await edit(id,'a'.repeat(1001),'long')).response.status,400);
 const form=await editor(id,'wrong');assert.equal((await api(`/statements/${ORIGINAL_STATEMENTS[2].id}/versions`,'POST',{text:'wrong statement',token:form.token},'wrong')).response.status,400);
 assert.equal((await api(`/statements/${id}/versions`,'POST',{},'wrong',{Origin:'https://other.test'})).response.status,403);
 const markup='<img src=x onerror=alert(1)> <script>alert(2)</script>';assert.equal((await edit(id,markup,'markup')).data.version.text,markup);
 const source=readFileSync(new URL('../diary.js',import.meta.url),'utf8');assert.ok(!source.includes('innerHTML'));assert.ok(source.includes('text.textContent=version.text'));
});
test('edit rate limit and one-use tokens are enforced',async()=>{
 const id=ORIGINAL_STATEMENTS[2].id,f=await editor(id,'replay');const data={text:'once',token:f.token};assert.equal((await api(`/statements/${id}/versions`,'POST',data,'replay')).response.status,201);assert.equal((await api(`/statements/${id}/versions`,'POST',data,'replay')).response.status,409);
 assert.equal((await edit(id,'one','limited')).response.status,201);assert.equal((await edit(id,'two','limited')).response.status,201);assert.equal((await edit(id,'three','limited')).response.status,429);
});
test('owner can hide abusive versions without deleting rows or the immutable original',async()=>{
 const id=ORIGINAL_STATEMENTS[3].id,changed=await edit(id,'abusive test version','moderation-test');const versionId=changed.data.version.id;
 assert.equal((await api('/versions/'+versionId,'DELETE')).response.status,401);
 const login=await api('/admin/login','POST',{password:'test-password'},'owner');const cookie=login.response.headers.get('Set-Cookie').split(';')[0];
 assert.equal((await api('/versions/'+versionId,'DELETE',undefined,'owner',{Cookie:cookie})).response.status,200);
 assert.ok(!(await api(`/statements/${id}/versions`)).data.versions.some(v=>v.id===versionId));
 assert.ok((await db.prepare('SELECT removed_at FROM diary_statement_versions WHERE id=?').bind(versionId).first()).removed_at);
 assert.equal((await editor(id,'reader')).current.text,'test version 3');
 const history=(await api(`/admin/statements/${id}/versions`,'GET',undefined,'owner',{Cookie:cookie})).data;assert.ok(history.versions.some(v=>v.id===versionId&&v.removed_at));assert.equal(history.original,ORIGINAL_STATEMENTS[3].text);
 assert.equal((await api('/versions/'+id,'DELETE',undefined,'owner',{Cookie:cookie})).response.status,404);
});
test('all historical versions are paginated without modifying legacy diary records',async()=>{
 const id=ORIGINAL_STATEMENTS[4].id;for(let i=0;i<55;i++)await db.prepare('INSERT INTO diary_statement_versions(id,statement_id,text,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(),id,`pagination ${i}`,'2026-01-01T00:00:00.000Z').run();
 const first=(await api(`/statements/${id}/versions`)).data,second=(await api(`/statements/${id}/versions?before=${first.next}`)).data;
 assert.equal(first.versions.length+second.versions.length,56);assert.equal(new Set([...first.versions,...second.versions].map(v=>v.id)).size,56);assert.equal(first.original,ORIGINAL_STATEMENTS[4].text);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM diary_entries').first()).n,0);
});
test.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
