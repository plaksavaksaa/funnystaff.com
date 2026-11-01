import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
try { process.stdout.write(readFileSync(path.join(process.env.DIARY_DATA_DIR || path.join(root,'.runtime'),'admin-password.txt'),'utf8')); }
catch { console.error('Start the diary server once with npm start, then run this command in your private terminal.'); process.exitCode=1; }
