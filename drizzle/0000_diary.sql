CREATE TABLE diary_entries (id TEXT PRIMARY KEY NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL CHECK(length(answer) BETWEEN 1 AND 1000), created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX diary_entries_newest ON diary_entries(created_at DESC, id DESC);
--> statement-breakpoint
CREATE TABLE diary_rate_limits (client_key TEXT PRIMARY KEY NOT NULL, minute_start INTEGER NOT NULL, minute_count INTEGER NOT NULL, day_start INTEGER NOT NULL, day_count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE diary_nonces (nonce TEXT PRIMARY KEY NOT NULL, expires_at INTEGER NOT NULL);
