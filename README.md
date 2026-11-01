# Princess Morning

Сайт на HTML, CSS и JavaScript. Для общего дневника нужен сервер Node.js 24; зависимости устанавливать не требуется.

## Локальный запуск

Откройте Terminal и выполните:

```sh
cd '/Users/revakorova/Documents/Codex/2026-10-22/build-the-first-working-page-of-2/outputs/princess-morning'
node backend/local-server.mjs
```

Откройте http://127.0.0.1:8000/ в браузере. Остановить сервер: Ctrl+C.
Если порт 8000 уже занят текущим предпросмотром, используйте его или замените порт на 8001.
Также можно открыть index.html напрямую: ссылки и локальные GIF работают без сервера.

## Файлы

- index.html — главная страница.
- styles.css — расположение элементов и оформление.
- script.js — масштабирование и навигация.
- my-bedroom.html, coffee.html, screenshots.html, mirror.html, guestbook.html — страницы-заглушки.
- assets/gifs/ — исходные bear-roses.gif и flyangel.gif, скопированные без изменений из ~/Desktop/myhome.
- assets/images/ — оригинальные изображения из Figma, включая сохранённые статические версии медведя и ангела.

## Макет и навигация

Основа — Figma frame 168:2, 1440 × 900. Вся композиция пропорционально вписывается в окно по ширине и высоте, без прокрутки. По последующей просьбе медведь поднят с y=394.805 до y=300. По следующей просьбе текст «here is my links» удалён, фотография закреплена слева с отступами 24 px сверху и слева; меню поднято на 24 px от нижнего края.

Навигация повторяет подход из исходника https://mouchette.org/indextop.php?Nav=DOM: стандартный HTML select с начальным пунктом «browse me» и переходом при выборе страницы. Оформление нативное, зависит от браузера и ОС. Меню закреплено внизу окна по центру, вне Figma-композиции.

Клавиатура: Tab переводит фокус на список; раскрытие, выбор стрелками, подтверждение Enter и закрытие Escape обрабатываются браузером.

Проверено: шесть переходов, возврат домой из каждой заглушки, открытие меню клавиатурой, отсутствие прокрутки при 1440 × 900 и 1366 × 768. Оба GIF сохраняют прозрачность и исходное бесконечное повторение.

## Interactive bedroom — added 1 November 2026

Open `my-bedroom.html` (or choose “my bedroom” in browse me).
The page uses the 1440 × 900 Figma frame `186:1360`, with all 15 visual object slots kept separate, including the two different crops of the original trash/bottle image. The composition scales uniformly and does not scroll.

Files copied unchanged from `~/Desktop/myhome`:

| File | Bedroom object |
| --- | --- |
| `chandelier.gif` | Chandelier |
| `planta1.gif` | Plant on the desk |
| `Nicci1001.gif` | Woman in a red dress |
| `noplacelikehome.gif` | Ruby slippers |

Ten original Figma images are stored in `assets/bedroom/`: rug, window, desk, gold frame, sign, computer screen, bed, trash/bottle, piano lettering and butterfly. No matching originals for those objects were present in the local collection. No unlit chandelier asset was available; the original GIF is retained and dimmed. The unrelated bear and angel GIFs are not added to the bedroom.

Interactions:

- Click the bed (or focus it and press Enter/Space) to move it left and reveal “dear diary...”. Click again to restore it. `diary.html` links back to the bedroom.
- Click the chandelier to toggle lighting. The window and computer screen stay brighter; animations continue.
- Click the blue trash bag to open `trash`. Double-click `poem.txt`, or focus it and press Enter/Space, to open Notepad. Download links to the actual UTF-8 file in `assets/text/poem.txt`.
- Drag either window by its title bar. The title bars also accept arrow keys; Shift increases the step. Close with × or Escape.
- The music player uses a single audio element so bed/light/window interactions do not reset it. Playback requires Play; previous/next preserve playing or paused state.

### Add songs

No `.mp3`, `.wav`, `.ogg` or `.m4a` files were found in `~/Desktop/myhome` (including subfolders). Add songs to `assets/audio/` and list them in `assets/audio/playlist.js`:

```js
window.BEDROOM_TRACKS = [
  { title: "Your track title", file: "assets/audio/your-file.mp3" }
];
```

Alternatively, use the player’s ⏏ control to choose local audio for the current visit. These files stay in the browser and are not uploaded. With an empty playlist, playback controls are disabled.

### Verification

Verified local asset existence, identical GIF bytes, exact poem contents and successful HTTP retrieval of the poem. Browser checks covered image loading, all 15 object geometries at a measured 1440 × 900 CSS viewport, a smaller approximately 1024 × 768 viewport, diary navigation/toggling, both light states, trash and Notepad opening/closing, mouse dragging of both windows, keyboard movement, and navigation home and back. Keyboard focus on the partially clipped chandelier no longer scrolls the composition.

Limits: the embedded browser timed out waiting for its download event, so the operating-system download completion was not confirmed; the native download link and served file were verified. Actual audio playback, previous/next switching, and playback continuity have not been tested with music because no audio files were supplied. No synthetic test audio or music was created.

Implementation: `bedroom.css`, `bedroom.js`, `my-bedroom.html`, `diary.html`. The existing homepage and native browse-me navigation are retained.


### Updated navigation and trash behavior

`browse me` is now present only in `index.html`. The blue trash bag is a direct native download link to `assets/text/poem.txt`; clicking it or pressing Enter while focused starts the download immediately. The intermediate Explorer and Notepad windows have been removed. These changes supersede the earlier window/navigation description.


The bedroom music player now uses macOS-style window chrome, decorative traffic-light dots, a light track display and compact transport controls. Its audio behavior and local-file selection are unchanged.


Lights-off now uses one near-black multiply overlay across the completed collage, with soft pools of light at the screen and window and a very faint warm glow at the chandelier. Individual images are no longer filtered separately, avoiding rectangular background seams. The player is dimmed too; the overlay does not capture pointer events or pause GIFs.


## Shared diary

Read DIARY.md for the SQLite server, anonymous diary, admin access, protections and pending production setup. The earlier direct-file/static-server preview is suitable only for visual pages; the diary requires the Node server.

## Latest diary experiment: please correct me.

The diary is now a collaborative editor for five statements, with independent append-only histories. This supersedes the earlier Q&A/name-field descriptions. Existing diary records are retained, not converted into fictional edits. See DIARY.md for current behavior, storage, admin access and verification. The bedroom and other artwork were not changed.
