import http from 'node:http';
import { sqliteAdapter } from './sqlite.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { handleDiary } from './diary-api.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = process.env.DIARY_DATA_DIR || path.join(root, '.runtime');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const configPath = path.join(dataDir, 'secrets.json');
if (!existsSync(configPath)) {
  const password = randomBytes(24).toString('base64url'), salt = randomBytes(16);
  const config = { DIARY_SECRET: randomBytes(32).toString('hex'), ADMIN_HASH: `100000:${salt.toString('base64url')}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('base64url')}` };
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  writeFileSync(path.join(dataDir, 'admin-password.txt'), password + '\n', { mode: 0o600 });
}
const secrets = JSON.parse(readFileSync(configPath, 'utf8'));
const db = sqliteAdapter(path.join(dataDir, 'diary.sqlite'));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.gif':'image/gif', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.m4a':'audio/mp4', '.txt':'text/plain; charset=utf-8' };
export function publicPath(pathname) {
  if (pathname === '/') return 'index.html';
  const relative = pathname.replace(/^\//, '');
  if (relative.includes('..') || relative.includes('\\') || relative.includes('\0')) return null;
  if (/^[a-z0-9-]+\.(html|css|js)$/.test(relative)) return relative;
  if (/^assets\/(?:[a-z0-9_-]+\/)*[^/.][^/]*\.(png|gif|jpg|jpeg|svg|mp3|wav|ogg|m4a|txt|js)$/i.test(relative)) return relative;
  return null;
}
const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || '127.0.0.1:8000';
    const origin = `http://${host}`;
    const url = new URL(req.url, origin);
    const parts = []; let size = 0;
    for await (const part of req) { size += part.length; if (size > (url.pathname === '/api/diary/ads' ? 4 * 1024 * 1024 : 8192)) { res.writeHead(413); res.end('request too large'); return; } parts.push(part); }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    const request = new Request(url, { method: req.method, headers, body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(parts) });
    let response = await handleDiary(request, { ...secrets, DB: db }, req.socket.remoteAddress || 'unknown');
    if (!response) {
      if (!['GET','HEAD'].includes(req.method)) response = new Response('not found', { status: 404 });
      else {
        let relative;
        try { relative = publicPath(decodeURIComponent(url.pathname)); } catch { relative = null; }
        if (!relative || !existsSync(path.join(root, relative))) response = new Response('not found', { status: 404 });
        else response = new Response(readFileSync(path.join(root, relative)), { headers: { 'Content-Type': types[path.extname(relative)] || 'application/octet-stream', 'Cache-Control':'no-cache' } });
      }
    }
    response.headers.set('X-Content-Type-Options','nosniff');
    response.headers.set('Referrer-Policy','same-origin');
    response.headers.set('X-Frame-Options','DENY');
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500, { 'Content-Type':'text/plain' }); res.end('server error'); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(Number(process.env.PORT || 8000), process.env.HOST || '127.0.0.1', () => console.log(`Princess Morning: http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 8000}\nShared SQLite diary ready. Run npm run admin:password in a private terminal for the admin password.`));
}
