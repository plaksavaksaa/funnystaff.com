# your ad here

The former diary.html is now a shared image and text page. All existing diary entries and statement revisions remain in the same SQLite database. The hidden bedroom link uses the new title.

Twelve scattered image spaces initially show black squares with “your ad here”. Click a square to upload or replace an image. Supported formats: PNG, JPEG, WEBP, GIF, up to 3 MB. Original bytes are stored in the database and displayed without cropping. The center column contains a text form followed by newest-first messages (up to 1,000 characters each). Rendering uses textContent. No accounts or approval queue. Other open pages refresh the shared content every 15 seconds.

Storage: diary_ads in the existing .runtime/diary.sqlite database. The existing private diary-admin.html interface lists current images and texts with protected removal controls. Removal hides records from public view and preserves their stored contents. Existing old diary administration remains available.

Safeguards: same-origin submissions, signed single-use form tokens, honeypot, server-side size/type validation, rate limits, no public visitor identifiers. File signatures accept raster formats only; HTML and SVG uploads are rejected. Start using the existing npm start command (Node 24). Database and secrets must remain private and persisted on the hosting server. The local version is running at http://127.0.0.1:8000/diary.html; internet publication is a separate hosting step.

Verification: existing diary tests passed. An isolated database test checked text and image publication, cross-visitor reads, database reopening, byte-identical image retrieval, invalid input rejection, admin authentication, reversible removal and preservation of legacy records. Browser tests checked posting, refresh persistence, viewing the post in a second tab, and uploading an image by clicking a square. Both temporary browser test submissions were removed from public view.
