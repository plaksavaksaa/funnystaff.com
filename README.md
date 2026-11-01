# funnystaff.com — Princess Morning

Experimental personal website: HTML, CSS, vanilla JavaScript, and Node.js 24 with shared SQLite storage. No npm dependencies are required.

## Run locally

From this repository's folder with Node.js 24, run `npm start`, then open http://127.0.0.1:8000/. Stop with Ctrl+C. Use `PORT=8001 npm start` for a different port.

## Current pages

- `index.html`: the bedroom homepage starts dark. The chandelier toggles light; the bed reveals the hidden `your ad here...` link. The computer downloads the poem; the trash bag opens screenshots; the mug opens coffee. Navigation opens additional tabs, leaving the room and music open.
- The existing bedroom player includes all five supplied tracks, selection, play/pause, previous/next, and automatic advancement. Two AAC originals also have losslessly remuxed M4A copies. Music starts after interaction.
- `screenshots.html`, titled `paper for recycling`: all 57 original phone screenshots scattered on white. The buzzing fly darts and hovers; clicking it leaves `squashed fly` at the click position. Screenshots do not enlarge.
- `coffee.html`: original Figma images and local match/drinking recordings. The ashtray and cup change independently, without movement, once per page load.
- `diary.html`, titled `your ad here`: twelve scattered image spaces, a central text form and shared archive. See `ADS.md` for storage, protections, image limits and administration.
- `my-bedroom.html` and `my-things.html` redirect old URLs to the current pages.

## Private data

The server creates private files in `.runtime/`, including the database and admin credentials. These are excluded from Git. Old diary records and statement histories remain in that local database; visitor submissions are not included in this repository.

Use `diary-admin.html` for protected administration. Run `npm run admin:password` in your own terminal to display the local administrator password. Keep it private. Never upload `.runtime/`, databases, credentials or `.env` files.

## Tests

Run `node --test tests/*.test.mjs`. Tests use isolated temporary databases.

## Hosting

A private GitHub repository stores source; it does not make the website public by itself. GitHub Pages alone cannot run the shared database and upload backend.

Use a Node.js 24 host with persistent storage. Run `npm start`, configure `HOST=0.0.0.0` and the host's `PORT`, and set `DIARY_DATA_DIR` to a private persistent directory. Back up that directory separately. Static assets are served by the application; private files are not exposed by its path allowlist.

The old experimental single-file Worker build is not a production asset pipeline for this large image/music collection. Serve the assets as files rather than embedding them in a Worker. The local `.openai` hosting configuration is intentionally excluded from Git.

All images and recordings are local in `assets/`; runtime pages do not depend on Desktop paths or temporary Figma URLs. `SCREENSHOTS.md` lists the screenshot files. `DIARY.md` contains notes about preserved earlier diary versions.
