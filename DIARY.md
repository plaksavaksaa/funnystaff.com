# dear diary, — please correct me.

The existing diary page now presents five collaborative statements. Click any sentence to open an editor containing its latest server-published version; `change it` appends a new version immediately. No visitor registration, names or email addresses are requested.

## Run locally

Requires Node.js 24. In this project folder:

```sh
node backend/local-server.mjs
```

Open `http://127.0.0.1:8000/diary.html`. The existing hidden bedroom link and link back to the bedroom are preserved. The same server serves the rest of the site. A static Python server cannot save edits.

The SQLite database remains `.runtime/diary.sqlite`. Keep the whole `.runtime` directory when restarting or moving the local server. It is ignored by Git and never served publicly. Stop the server before copying the whole runtime directory, or use SQLite's backup facility.

## Statements and complete history

The exact originals are stored once in `diary_statements`:

1. love should have no limits.
2. some people deserve to be forgotten.
3. privacy is just another form of loneliness.
4. being loved is better than being understood.
5. everyone has something they should be ashamed of.

Each visitor version is a separate immutable row in `diary_statement_versions`. An atomic AUTOINCREMENT sequence gives concurrent submissions distinct revisions. The highest visible sequence is current; previous versions are ordered newest first. No current-version pointer is overwritten, so simultaneous edits cannot discard one another. The original is always accessible at the bottom of each expandable history and cannot be removed through the interface. Originals have no invented visitor publication date. Visitor versions show DD.MM.YYYY dates.

Long histories are paginated in batches of 50, with the original still accessible below the history. Public text is built with textContent, never HTML interpretation. Other visible diary tabs poll the shared server every two seconds; reopening a hidden tab refreshes it. Polling never replaces an unsaved editor draft. Reopening an editor explicitly fetches the latest version.

Earlier Q&A diary records, including the previously submitted real answer, remain unchanged in `diary_entries`. They are not copied into this experiment. The optional-name column from the previous work is retained for data preservation; the new interface and new version tables do not collect names.

## Protected owner interface

Open `http://127.0.0.1:8000/diary-admin.html`. Read the generated password only in your private Terminal:

```sh
node scripts/admin-password.mjs
```

The existing password and session system are reused. Admin history contains visible and removed versions. `remove this version` hides abusive content from visitors and recomputes the current sentence from the newest remaining version. It does not delete the stored historical row or the original sentence. There is no pre-publication approval queue.

Admin passwords use PBKDF2-SHA256. Sessions use signed HttpOnly, SameSite=Strict cookies, Secure on HTTPS. Mutations require the same origin. Admin endpoints reject unauthenticated clients.

## Existing basic protection

Empty/whitespace-only versions and versions longer than 1,000 Unicode characters are rejected server-side. SQL uses bound parameters. A hidden honeypot, signed per-statement form token, minimum two-second form age, one-use nonce protection and an 8 KB request limit remain in use. Edits are limited to two per minute and ten per day for a daily-rotating keyed digest of the connecting address. Raw addresses are not stored in the application database or shown publicly. Infrastructure necessarily processes network addresses to deliver requests. Login attempts have a separate rate limit.

No localStorage is used for shared content. Server restarts preserve the database. Technical expired counters can be cleaned up; statement histories do not expire.

## Implementation

- `diary.html`, `diary.css`, `diary.js`: existing page, simple editors and histories.
- `backend/statements.mjs`: collaborative API integrated with the existing `backend/diary-api.mjs` authentication and safeguards.
- `diary-admin.js`: protected version removal interface.
- `drizzle/0002_collaborative_statements.sql`: additive tables and history index; earlier migrations are unchanged.
- `backend/sqlite.mjs`: local persistent storage adapter; new migrations preserve old tables.
- `scripts/build-worker.mjs`: prepares the same no-framework API for hosted D1 storage. Runtime secrets/data files are excluded.

## Verification

Seventeen isolated server tests pass (`node --test tests/*.test.mjs`). They cover all five originals and edits, latest-version editors, simultaneous submissions from stale editors, independent clients, persistence after reopening SQLite, complete paginated history, immutable originals, owner-only non-destructive removal, validation, markup treated as plain text, rate limiting and one-use tokens.

Browser QA used a separate test database on port 8001. It checked editing/saving, reopening with the latest version, refresh persistence, a second observer tab, date formatting, original-at-bottom history, and opening all five editors. That temporary test server has been stopped. No invented visitor versions were placed in the real archive on port 8000. All pre-existing real diary records were compared to their baseline and preserved unchanged. All eight website pages still return HTTP 200.

## Public hosting status

The reserved Sites project remains `appgprj_6ae740832f1881919b48ae1ab3f402e0`. Expected origin is `https://princess-morning-diary.brightactor2.chatgpt.site`, not a verified live deployment. Internet publication is still pending the previously requested explicit permission to store DIARY_SECRET and ADMIN_HASH in Sites' server-side secret environment. No such transfer or publication was attempted during this update. Local and hosted databases are separate. The current working preview is the local server.
