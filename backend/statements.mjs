export const ORIGINAL_STATEMENTS = Object.freeze([
  {id:'love-limits',text:'love should have no limits.'},
  {id:'forgotten',text:'some people deserve to be forgotten.'},
  {id:'privacy-loneliness',text:'privacy is just another form of loneliness.'},
  {id:'loved-understood',text:'being loved is better than being understood.'},
  {id:'ashamed',text:'everyone has something they should be ashamed of.'}
]);
const statementInitialization = new WeakMap();
async function initializeStatements(db) {
  if (!statementInitialization.has(db)) {
    const pending = db.batch(ORIGINAL_STATEMENTS.map((item,index)=>db.prepare('INSERT OR IGNORE INTO diary_statements(id,ordinal,original_text) VALUES(?,?,?)').bind(item.id,index,item.text)));
    statementInitialization.set(db,pending);
    pending.catch(()=>statementInitialization.delete(db));
  }
  await statementInitialization.get(db);
}
async function statementStates(db) {
  const {results}=await db.prepare(`SELECT s.id,s.original_text,v.id AS version_id,v.text,v.created_at,v.seq FROM diary_statements s
    LEFT JOIN diary_statement_versions v ON v.seq=(SELECT MAX(seq) FROM diary_statement_versions WHERE statement_id=s.id AND removed_at IS NULL)
    ORDER BY s.ordinal`).all();
  return results.map(row=>({id:row.id,original:row.original_text,current:{id:row.version_id||null,text:row.text??row.original_text,created_at:row.created_at||null,seq:row.seq||0}}));
}
export async function handleStatements(request,env,helpers) {
  const {json,token,readToken,bodyJSON,rateLimit,adminSession,clientKey,now}=helpers;
  const url=new URL(request.url),path=url.pathname;
  if (!path.startsWith('/api/diary/statements') && !path.startsWith('/api/diary/admin/statements') && !path.startsWith('/api/diary/versions/')) return null;
  const isAdmin=path.startsWith('/api/diary/admin/')||request.method==='DELETE';
  if(isAdmin&&!await adminSession(request,env,now))return json({error:'sign in first'},401);
  await initializeStatements(env.DB);
  if((path==='/api/diary/statements'||path==='/api/diary/admin/statements')&&request.method==='GET')return json({statements:await statementStates(env.DB)});
  const match=path.match(/^\/api\/diary\/(admin\/)?statements\/([a-z-]+)\/(form|versions)$/);
  if(match){
    const [,adminPrefix,statementId,action]=match;
    const statement=await env.DB.prepare('SELECT id,original_text FROM diary_statements WHERE id=?').bind(statementId).first();
    if(!statement)return json({error:'statement not found'},404);
    if(action==='form'&&request.method==='GET'&&!adminPrefix){
      const current=(await statementStates(env.DB)).find(item=>item.id===statementId).current;
      return json({statementId,current,token:await token({kind:'edit',statement:statementId,issued:now,nonce:crypto.randomUUID(),client:clientKey},env.DIARY_SECRET)});
    }
    if(action==='versions'&&request.method==='GET'){
      const before=url.searchParams.get('before');
      if(before!==null&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))))return json({error:'invalid history cursor'},400);
      const conditions=['statement_id=?'],args=[statementId];
      if(!adminPrefix)conditions.push('removed_at IS NULL');
      if(before){conditions.push('seq < ?');args.push(Number(before));}
      const fields=adminPrefix?'id,seq,text,created_at,removed_at':'id,seq,text,created_at';
      const {results}=await env.DB.prepare('SELECT '+fields+' FROM diary_statement_versions WHERE '+conditions.join(' AND ')+' ORDER BY seq DESC LIMIT 51').bind(...args).all();
      return json({original:statement.original_text,versions:results.slice(0,50),next:results.length>50?results[49].seq:null});
    }
    if(action==='versions'&&request.method==='POST'&&!adminPrefix){
      const data=await bodyJSON(request);
      if(data.website)return json({error:'please try again'},400);
      const text=typeof data.text==='string'?data.text.trim():'';
      if(!text||[...text].length>1000||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))return json({error:'write between 1 and 1,000 characters'},400);
      const proof=typeof data.token==='string'?await readToken(data.token,env.DIARY_SECRET):null;
      if(!proof||proof.kind!=='edit'||proof.statement!==statementId||proof.client!==clientKey||now-proof.issued<2000||now-proof.issued>86400000)return json({error:'please wait a moment, then try again'},400);
      if(!await rateLimit(env.DB,'edit:'+clientKey,now))return json({error:'too many changes — please try later'},429,{'Retry-After':'60'});
      const unused=await env.DB.prepare('INSERT OR IGNORE INTO diary_nonces(nonce,expires_at) VALUES(?,?) RETURNING nonce').bind(proof.nonce,now+86400000).first();
      if(!unused)return json({error:'this version was already submitted; reopen the editor'},409);
      const id=crypto.randomUUID(),created=new Date(now).toISOString();
      // An atomic append allocates a unique revision sequence. No read/overwrite
      // cycle: concurrent submissions are both retained, with the last sequence current.
      const version=await env.DB.prepare('INSERT INTO diary_statement_versions(id,statement_id,text,created_at) VALUES(?,?,?,?) RETURNING id,seq,text,created_at').bind(id,statementId,text,created).first();
      await env.DB.batch([env.DB.prepare('DELETE FROM diary_rate_limits WHERE expires_at < ?').bind(now),env.DB.prepare('DELETE FROM diary_nonces WHERE expires_at < ?').bind(now)]).catch(()=>{});
      return json({version,statements:await statementStates(env.DB)},201);
    }
  }
  const removal=path.match(/^\/api\/diary\/versions\/([0-9a-f-]{36})$/);
  if(removal&&request.method==='DELETE'){
    // Removal is reversible in storage: abusive text leaves the public archive,
    // while the immutable original and all historical rows are retained.
    const result=await env.DB.prepare('UPDATE diary_statement_versions SET removed_at=? WHERE id=? AND removed_at IS NULL').bind(new Date(now).toISOString(),removal[1]).run();
    return result.meta.changes?json({ok:true}):json({error:'version not found'},404);
  }
  return json({error:'not found'},404);
}
