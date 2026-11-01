const bed = document.querySelector('#bed');
const diary = document.querySelector('.diary-link');
bed.addEventListener('click', () => {
  const moved = bed.classList.toggle('is-moved');
  bed.setAttribute('aria-expanded', String(moved));
  bed.setAttribute('aria-label', moved ? 'Move bed back and hide diary' : 'Move bed to reveal diary');
  diary.hidden = !moved;
});

const chandelier = document.querySelector('#chandelier');
chandelier.addEventListener('click', () => {
  const off = document.body.classList.toggle('lights-off');
  chandelier.setAttribute('aria-pressed', String(off));
  chandelier.setAttribute('aria-label', off ? 'Turn lights on' : 'Turn lights off');
});

// Local audio only. Object interactions never replace or restart this element.
const audio = document.querySelector('#room-audio');
const display = document.querySelector('#track-name');
const play = document.querySelector('#play-pause');
const previous = document.querySelector('#previous-track');
const next = document.querySelector('#next-track');
const files = document.querySelector('#song-files');
let tracks = Array.isArray(window.BEDROOM_TRACKS) ? [...window.BEDROOM_TRACKS] : [];
let trackIndex = 0;
let objectURLs = [];
const playlist = document.querySelector('#playlist');
function fillPlaylist() {
 playlist.replaceChildren(...tracks.map((track,index)=>{const option=document.createElement('option');option.value=index;option.textContent=track.title;return option;}));
}
fillPlaylist();
playlist.addEventListener('change',()=>selectTrack(Number(playlist.value), !audio.paused));
function updatePlayer() {
  playlist.value=String(trackIndex);
  for (const button of [play, previous, next]) button.disabled = tracks.length === 0;
  const playing = !audio.paused;
  play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  play.setAttribute('aria-pressed', String(playing));
  display.textContent = tracks.length ? tracks[trackIndex].title : 'no songs loaded';
}
async function startPlayback() {
  try { await audio.play(); } catch (error) {
    display.textContent = error.name === 'NotAllowedError' ? 'press play to listen' : 'could not play this file';
  }
}
function selectTrack(index, shouldPlay) {
  if (!tracks.length) return;
  trackIndex = (index + tracks.length) % tracks.length;
  audio.src = tracks[trackIndex].file;
  updatePlayer();
  if (shouldPlay) startPlayback();
}
play.addEventListener('click', () => audio.paused ? startPlayback() : audio.pause());
previous.addEventListener('click', () => selectTrack(trackIndex - 1, !audio.paused));
next.addEventListener('click', () => selectTrack(trackIndex + 1, !audio.paused));
audio.addEventListener('play', updatePlayer);
audio.addEventListener('pause', updatePlayer);
audio.addEventListener('ended', () => selectTrack(trackIndex + 1, true));
audio.addEventListener('error', () => { display.textContent = 'could not play this file'; });
files.addEventListener('change', () => {
  const chosen = [...files.files].filter(file => /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name) || file.type.startsWith('audio/'));
  if (!chosen.length) return;
  audio.pause();
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  objectURLs = chosen.map(file => URL.createObjectURL(file));
  tracks = chosen.map((file, i) => ({ title: file.name.replace(/\.[^.]+$/, ''), file: objectURLs[i] }));
  fillPlaylist();
  // The file chooser is a user gesture, but playback still waits for Play.
  selectTrack(0, false);
});
if (tracks.length) selectTrack(0, false);
updatePlayer();
