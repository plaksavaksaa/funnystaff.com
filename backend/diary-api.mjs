import { handleAds } from './ads.mjs';
import { handleStatements } from './statements.mjs';
// Shared by the local SQLite server and the deployed Cloudflare/D1 Worker.
export const PERMANENT_QUESTION = Object.freeze({ id: 'still-loved', text: 'what is the worst thing a person can do and still be loved?' });
const encoder = new TextEncoder();
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const to64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
function from64(text) { return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)); }
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return to64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function token(payload, secret) { const data = to64(encoder.encode(JSON.stringify(payload))); return `${data}.${await sign(data, secret)}`; }
async function readToken(value, secret) {
  try {
    const [data, signature, more] = value.split('.');
    if (!data || !signature || more) return null;
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, from64(signature), encoder.encode(data))) return null;
    return JSON.parse(new TextDecoder().decode(from64(data)));
  } catch { return null; }
}
async function verifyPassword(password, encoded) {
  try {
    const [rounds, salt, expected] = encoded.split(':');
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: from64(salt), iterations: Number(rounds), hash: 'SHA-256' }, key, 256));
    const comparison = from64(expected);
    return comparison.length === bits.length && bits.reduce((n, x, i) => n | (x ^ comparison[i]), 0) === 0;
  } catch { return false; }
}
async function bodyJSON(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('content-type');
  if (Number(request.headers.get('Content-Length') || 0) > 8192) throw new Error('body-size');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  let size = 0; const chunks = [];
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new Error('body-size'); } chunks.push(value); }
  const all = new Uint8Array(size); let offset = 0; for (const part of chunks) { all.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(all));
}
async function rateLimit(db, clientKey, now, perMinute = 2, perDay = 10) {
  const minute = now - 60000, day = Math.floor(now / 86400000) * 86400000;
  const row = await db.prepare(`INSERT INTO diary_rate_limits (client_key,minute_start,minute_count,day_start,day_count,expires_at) VALUES(?,?,1,?,1,?)
    ON CONFLICT(client_key) DO UPDATE SET
    minute_start=CASE WHEN minute_start<=? THEN ? ELSE minute_start END,
    minute_count=CASE WHEN minute_start<=? THEN 1 ELSE minute_count+1 END,
    day_start=?, day_count=CASE WHEN day_start<? THEN 1 ELSE day_count+1 END, expires_at=?
    WHERE (minute_start<=? OR minute_count<?) AND (day_start<? OR day_count<?) RETURNING client_key`)
    .bind(clientKey, now, day, day + 172800000, minute, now, minute, day, day, day + 172800000, minute, perMinute, day, perDay).first();
  return !!row;
}
async function adminSession(request, env, now) {
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)diary_admin=([^;]+)/)?.[1];
  const session = cookie ? await readToken(cookie, env.DIARY_SECRET) : null;
  return session?.kind === 'admin' && session.expires > now;
}
function sessionCookie(value, request, maxAge) {
  return `diary_admin=${value}; Path=/api/diary; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function handleDiary(request, env, clientAddress = 'unknown') {
  const url = new URL(request.url), path = url.pathname, now = Date.now();
  if (!path.startsWith('/api/diary')) return null;
  if (!env.DB || !env.DIARY_SECRET) return json({ error: 'diary is temporarily unavailable' }, 503);
  try {
    if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) return json({ error: 'request not allowed' }, 403);
    const day = Math.floor(now / 86400000);
    // Only a keyed, daily-rotating digest is stored. Never store or return raw IPs.
    const clientKey = await sign(`${day}:${clientAddress}`, env.DIARY_SECRET);
    const adsResponse = await handleAds(request, env, { json, token, readToken, rateLimit, adminSession, clientKey, now });
    if (adsResponse) return adsResponse;
    const statementResponse = await handleStatements(request, env, { json, token, readToken, bodyJSON, rateLimit, adminSession, clientKey, now });
    if (statementResponse) return statementResponse;
    if (path === '/api/diary/form' && request.method === 'GET') {
      return json({ question: PERMANENT_QUESTION, token: await token({ kind: 'form', question: PERMANENT_QUESTION.id, issued: now, nonce: crypto.randomUUID(), client: clientKey }, env.DIARY_SECRET) });
    }
    if ((path === '/api/diary/entries' || path === '/api/diary/admin/entries') && request.method === 'GET') {
      const adminArchive = path === '/api/diary/admin/entries';
      if (adminArchive && !await adminSession(request, env, now)) return json({ error: 'sign in first' }, 401);
      const [beforeDate, beforeId] = (url.searchParams.get('before') || '').split('|');
      const conditions = [], parameters = [];
      // Old records remain intact and accessible to the owner, but never mix
      // into the public archive for this permanent question.
      if (!adminArchive) { conditions.push('question = ?'); parameters.push(PERMANENT_QUESTION.text); }
      if (beforeDate && beforeId) {
        conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
        parameters.push(beforeDate, beforeDate, beforeId);
      }
      const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
      const { results } = await env.DB.prepare('SELECT id,question,answer,created_at,name FROM diary_entries' + where + ' ORDER BY created_at DESC,id DESC LIMIT 51').bind(...parameters).all();
      const entries = results.slice(0, 50);
      return json({ entries, next: results.length > 50 ? `${entries.at(-1).created_at}|${entries.at(-1).id}` : null });
    }
    if (path === '/api/diary/entries' && request.method === 'POST') {
      const data = await bodyJSON(request);
      if (data.website) return json({ error: 'please try again' }, 400);
      const staleQuestion = data.questionId !== undefined && data.questionId !== PERMANENT_QUESTION.id;
      const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
      if (data.name !== undefined && data.name !== null && typeof data.name !== 'string') return json({ error: 'please enter a name or leave it empty' }, 400);
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if ([...name].length > 80 || /[\u0000-\u001F\u007F]/.test(name)) return json({ error: 'keep your name to 80 characters' }, 400);
      if (staleQuestion || !answer || [...answer].length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(answer)) return json({ error: 'write a note between 1 and 1,000 characters' }, 400);
      const proof = typeof data.token === 'string' ? await readToken(data.token, env.DIARY_SECRET) : null;
      if (!proof || proof.kind !== 'form' || proof.question !== PERMANENT_QUESTION.id || proof.client !== clientKey || now - proof.issued < 2000 || now - proof.issued > 86400000) return json({ error: 'please wait a moment, then try again' }, 400);
      if (!await rateLimit(env.DB, `note:${clientKey}`, now)) return json({ error: 'too many notes — please try later' }, 429, { 'Retry-After': '60' });
      const used = await env.DB.prepare('INSERT OR IGNORE INTO diary_nonces(nonce,expires_at) VALUES(?,?) RETURNING nonce').bind(proof.nonce, now + 86400000).first();
      if (!used) return json({ error: 'this note was already submitted; refresh the form' }, 409);
      const entry = { id: crypto.randomUUID(), question: PERMANENT_QUESTION.text, answer, name: name || null, created_at: new Date(now).toISOString() };
      await env.DB.prepare('INSERT INTO diary_entries(id,question,answer,created_at,name) VALUES(?,?,?,?,?)').bind(entry.id, entry.question, entry.answer, entry.created_at, entry.name).run();
      // Only expired technical counters are removed; public entries never expire.
      await env.DB.batch([env.DB.prepare('DELETE FROM diary_rate_limits WHERE expires_at < ?').bind(now), env.DB.prepare('DELETE FROM diary_nonces WHERE expires_at < ?').bind(now)]).catch(() => {});
      return json({ message: 'your note is here ♡', entry }, 201);
    }
    if (path === '/api/diary/admin/login' && request.method === 'POST') {
      if (!env.ADMIN_HASH) return json({ error: 'admin is not configured' }, 503);
      if (!await rateLimit(env.DB, `login:${clientKey}`, now, 5, 30)) return json({ error: 'too many attempts — please try later' }, 429, { 'Retry-After': '60' });
      const data = await bodyJSON(request);
      if (typeof data.password !== 'string' || data.password.length > 256 || !await verifyPassword(data.password, env.ADMIN_HASH)) return json({ error: 'incorrect password' }, 401);
      const value = await token({ kind: 'admin', expires: now + 28800000, nonce: crypto.randomUUID() }, env.DIARY_SECRET);
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(value, request, 28800) });
    }
    if (path === '/api/diary/admin/session' && request.method === 'GET') return json({ authenticated: await adminSession(request, env, now) });
    if (path === '/api/diary/admin/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', request, 0) });
    const match = path.match(/^\/api\/diary\/entries\/([0-9a-f-]{36})$/);
    if (match && request.method === 'DELETE') {
      if (!await adminSession(request, env, now)) return json({ error: 'sign in first' }, 401);
      const result = await env.DB.prepare('DELETE FROM diary_entries WHERE id=?').bind(match[1]).run();
      return result.meta.changes ? json({ ok: true }) : json({ error: 'entry not found' }, 404);
    }
    return json({ error: 'not found' }, 404);
  } catch (error) {
    if (error instanceof SyntaxError || ['content-type','body-size','body'].includes(error.message)) return json({ error: 'invalid submission' }, 400);
    return json({ error: 'could not save your note; please try again' }, 503);
  }
}
