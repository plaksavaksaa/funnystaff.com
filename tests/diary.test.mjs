import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pbkdf2Sync} from 'node:crypto';
import {sqliteAdapter} from '../backend/sqlite.mjs';
import {handleDiary,PERMANENT_QUESTION} from '../backend/diary-api.mjs';
const folder=mkdtempSync(path.join(tmpdir(),'princess-diary-test-')),filename=path.join(folder,'db.sqlite');
let db=sqliteAdapter(filename);
const salt=Buffer.from('test-salt-only');
const env={DB:db,DIARY_SECRET:'test-only-secret',ADMIN_HASH:`100000:${salt.toString('base64url')}:${pbkdf2Sync('test-password',salt,100000,32,'sha256').toString('base64url')}`};
async function api(route,method='GET',data,client='visitor',headers={}){
 const request=new Request('https://diary.test/api/diary'+route,{method,headers:{...(method==='GET'?{}:{Origin:'https://diary.test','Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
 const response=await handleDiary(request,env,client);return{response,data:await response.json()};
}
async function form(client){const real=Date.now;try{Date.now=()=>real()-3000;return(await api('/form','GET',undefined,client)).data;}finally{Date.now=real;}}
async function note(answer,client='visitor'){const f=await form(client);return api('/entries','POST',{answer,token:f.token,website:''},client);}
let firstId;
test('instant publication shared with another visitor',async()=>{
 const result=await note('shared note','writer');assert.equal(result.response.status,201);assert.equal(result.data.message,'your note is here ♡');firstId=result.data.entry.id;
 const archive=await api('/entries','GET',undefined,'other-browser');assert.equal(archive.data.entries[0].id,firstId);assert.deepEqual(Object.keys(archive.data.entries[0]).sort(),['answer','created_at','id','name','question']);assert.ok(Date.parse(archive.data.entries[0].created_at));
});
test('database survives reopening; newer entries appear first',async()=>{
 db.close();db=sqliteAdapter(filename);env.DB=db;assert.equal((await api('/entries')).data.entries[0].id,firstId);
 const newer=await note('newer note','writer-2');assert.equal((await api('/entries')).data.entries[0].id,newer.data.entry.id);
});
test('validates content, question, honeypot and origin',async()=>{
 assert.equal((await note(' \n ','blank')).response.status,400);assert.equal((await note('a'.repeat(1001),'long')).response.status,400);
 const f=await form('bad');assert.equal((await api('/entries','POST',{questionId:'unknown',answer:'hi',token:f.token},'bad')).response.status,400);
 assert.equal((await api('/entries','POST',{answer:'hi',token:f.token,website:'spam'},'bad')).response.status,400);
 assert.equal((await api('/entries','POST',{},'bad',{Origin:'https://other.test'})).response.status,403);
});
test('1000 Unicode characters work; script markup stays text',async()=>{
 assert.equal((await note('♡'.repeat(1000),'unicode')).response.status,201);
 const payload='<img src=x onerror=alert(1)> <script>alert(2)</script>';assert.equal((await note(payload,'html')).data.entry.answer,payload);
 const source=readFileSync(new URL('../diary.js',import.meta.url),'utf8');assert.ok(source.includes('text.textContent=version.text'));assert.ok(!source.includes('innerHTML'));
});
test('rate limit and replay protection',async()=>{
 const f=await form('replay'),data={answer:'once',token:f.token};assert.equal((await api('/entries','POST',data,'replay')).response.status,201);assert.equal((await api('/entries','POST',data,'replay')).response.status,409);
 assert.equal((await note('one','limited')).response.status,201);assert.equal((await note('two','limited')).response.status,201);const blocked=await note('three','limited');assert.equal(blocked.response.status,429);assert.equal(blocked.response.headers.get('Retry-After'),'60');
});
test('protected deletion and secure admin session',async()=>{
 assert.equal((await api('/entries/'+firstId,'DELETE')).response.status,401);assert.equal((await api('/admin/login','POST',{password:'wrong'},'admin')).response.status,401);
 const login=await api('/admin/login','POST',{password:'test-password'},'admin');assert.equal(login.response.status,200);const cookie=login.response.headers.get('Set-Cookie');for(const flag of ['HttpOnly','SameSite=Strict','Secure'])assert.ok(cookie.includes(flag));
 const headers={Cookie:cookie.split(';')[0]};assert.equal((await api('/admin/session','GET',undefined,'admin',headers)).data.authenticated,true);
 assert.equal((await api('/entries/'+firstId,'DELETE',undefined,'admin',{...headers,Origin:'https://other.test'})).response.status,403);
 assert.equal((await api('/entries/'+firstId,'DELETE',undefined,'admin',headers)).response.status,200);assert.ok(!(await api('/entries')).data.entries.some(e=>e.id===firstId));
 assert.ok((await api('/admin/logout','POST',undefined,'admin')).response.headers.get('Set-Cookie').includes('Max-Age=0'));
});
test('pagination does not lose equal-timestamp notes',async()=>{
 for(let i=0;i<55;i++)await db.prepare('INSERT INTO diary_entries(id,question,answer,created_at) VALUES(?,?,?,?)').bind(`page-${String(i).padStart(3,'0')}`,PERMANENT_QUESTION.text,'note','2026-01-01T00:00:00.000Z').run();
 const first=await api('/entries');const second=await api('/entries?before='+encodeURIComponent(first.data.next));const ids=[...first.data.entries,...second.data.entries].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.filter(id=>id.startsWith('page-')).length,55);
});
test('permanent question; legacy answers are preserved but hidden from public archive',async()=>{
 const f=await form('permanent');assert.equal(f.question.text,'what is the worst thing a person can do and still be loved?');assert.ok(!('questions' in f));
 const oldId=crypto.randomUUID();await db.prepare('INSERT INTO diary_entries(id,question,answer,created_at) VALUES(?,?,?,?)').bind(oldId,'previous question','old answer','2099-01-01T00:00:00.000Z').run();
 assert.ok(!(await api('/entries')).data.entries.some(e=>e.id===oldId));
 assert.equal((await db.prepare('SELECT answer FROM diary_entries WHERE id=?').bind(oldId).first()).answer,'old answer');
 assert.equal((await api('/admin/entries')).response.status,401);
 const login=await api('/admin/login','POST',{password:'test-password'},'owner-legacy');const cookie=login.response.headers.get('Set-Cookie').split(';')[0];
 assert.ok((await api('/admin/entries','GET',undefined,'owner-legacy',{Cookie:cookie})).data.entries.some(e=>e.id===oldId));
});
test('optional names are stored safely, anonymous answers remain allowed, and invalid names are rejected',async()=>{
 const f=await form('named');const result=await api('/entries','POST',{answer:'named note',name:'  <b>name</b>  ',token:f.token},'named');assert.equal(result.response.status,201);assert.equal(result.data.entry.name,'<b>name</b>');
 assert.equal((await api('/entries')).data.entries[0].name,'<b>name</b>');
 const anonymous=await note('anonymous answer','anonymous-name');assert.equal(anonymous.response.status,201);assert.equal(anonymous.data.entry.name,null);
 const invalid=await form('invalid-name');assert.equal((await api('/entries','POST',{answer:'note',name:'a'.repeat(81),token:invalid.token},'invalid-name')).response.status,400);
 const source=readFileSync(new URL('../diary.js',import.meta.url),'utf8');assert.ok(!source.includes('visitor-name'));
});
test.after(()=>{db.close();rmSync(folder,{recursive:true,force:true});});
