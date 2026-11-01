CREATE TABLE diary_statements (id TEXT PRIMARY KEY NOT NULL, ordinal INTEGER NOT NULL UNIQUE, original_text TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE diary_statement_versions (seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, id TEXT NOT NULL UNIQUE, statement_id TEXT NOT NULL REFERENCES diary_statements(id), text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 1000), created_at TEXT NOT NULL, removed_at TEXT);
--> statement-breakpoint
CREATE INDEX diary_statement_versions_history ON diary_statement_versions(statement_id, seq DESC);
