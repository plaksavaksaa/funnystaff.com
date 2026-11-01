import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export function sqliteAdapter(filename) {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  sqlite.exec(readFileSync(path.join(root, 'drizzle/0000_diary.sql'), 'utf8').replace(/CREATE TABLE /g, 'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX /g, 'CREATE INDEX IF NOT EXISTS '));
  if (!sqlite.prepare('PRAGMA table_info(diary_entries)').all().some(column => column.name === 'name')) {
    sqlite.exec(readFileSync(path.join(root, 'drizzle/0001_optional_name.sql'), 'utf8'));
  }
  if (!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='diary_statements'").get()) {
    sqlite.exec('BEGIN IMMEDIATE');
    try { sqlite.exec(readFileSync(path.join(root, 'drizzle/0002_collaborative_statements.sql'), 'utf8')); sqlite.exec('COMMIT'); }
    catch(error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  const adapter = {
    prepare(sql) {
      let args = [];
      const statement = { bind(...values) { args = values; return statement; }, async first() { return sqlite.prepare(sql).get(...args) || null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, _run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; }, async run() { return statement._run(); } };
      return statement;
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try { const results = []; for (const statement of statements) results.push(statement._run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); }
  };
  return adapter;
}
