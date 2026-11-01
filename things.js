const fly = document.querySelector('#fly');
let x = innerWidth * .6, y = innerHeight * .3;
let tx = x, ty = y, last = 0, hoverUntil = 0, hovering = true;
let audio, buzz, volume, squashed = false;
function startBuzz() {
  if (squashed) return;
  try {
    if (audio) { audio.resume().catch(() => {}); return; }
    audio = new (window.AudioContext || window.webkitAudioContext)();
    buzz = audio.createOscillator(); volume = audio.createGain();
    const filter = audio.createBiquadFilter();
    buzz.type = 'sawtooth'; buzz.frequency.value = 145;
    filter.type = 'lowpass'; filter.frequency.value = 650;
    volume.gain.value = .018;
    buzz.connect(filter).connect(volume).connect(audio.destination);
    buzz.start(); audio.resume().catch(() => {});
  } catch { /* The collection still works when audio is unavailable. */ }
}
// Attempt playback on arrival; retry if browser autoplay policy suspends audio.
startBuzz();
document.addEventListener('pointerdown', startBuzz);
document.addEventListener('keydown', startBuzz);
fly.addEventListener('click', event => {
  if (squashed) return;
  squashed = true;
  const rect = fly.getBoundingClientRect();
  const note = document.createElement('span');
  note.textContent = 'squashed fly';
  note.className = 'squashed-fly';
  note.setAttribute('role', 'status');
  note.style.left = `${event.detail ? event.pageX : rect.left + scrollX + rect.width / 2}px`;
  note.style.top = `${event.detail ? event.pageY : rect.top + scrollY + rect.height / 2}px`;
  fly.replaceWith(note);
  if (volume) volume.gain.setValueAtTime(0, audio.currentTime);
  buzz?.stop();
  audio?.close().catch(() => {});
});
function move(now) {
  if (squashed) return;
  const dt = Math.min((now - last) / 1000 || .016, .04); last = now;
  const maxX = Math.max(0, document.documentElement.clientWidth - fly.offsetWidth - 8);
  const maxY = Math.max(0, document.documentElement.scrollHeight - fly.offsetHeight - 8);
  if (!hoverUntil) hoverUntil = now + 1300;
  if (hovering && now >= hoverUntil) {
    hovering = false;
    // Choose direction independently of the page's tall aspect ratio.
    // Reflect at boundaries so upward darts near the top remain possible.
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() < .18 ? 650 + Math.random() * 1050 : 90 + Math.random() * 480;
    function reflect(value, maximum) {
      if (maximum <= 8) return 0;
      const span = maximum - 8;
      const folded = ((value - 8) % (span * 2) + span * 2) % (span * 2);
      return 8 + (folded <= span ? folded : span * 2 - folded);
    }
    tx = reflect(x + Math.cos(angle) * distance, maxX);
    ty = reflect(y + Math.sin(angle) * distance, maxY);
  }
  if (!hovering) {
    const distance = Math.hypot(tx - x, ty - y);
    const step = Math.min(distance, dt * 1900);
    if (distance) { x += (tx - x) / distance * step; y += (ty - y) / distance * step; }
    if (distance < 12) { hovering = true; hoverUntil = now + 1100 + Math.random() * 1900; }
  }
  const jitterX = Math.sin(now * .065) * 4 + Math.sin(now * .119) * 2;
  const jitterY = Math.cos(now * .081) * 3 + Math.sin(now * .137) * 2;
  const px = Math.max(0, Math.min(maxX, x + jitterX));
  const py = Math.max(0, Math.min(maxY, y + jitterY));
  fly.style.transform = `translate(${px}px, ${py}px)`;
  if (buzz && audio.state === 'running') {
    buzz.frequency.setTargetAtTime((hovering ? 140 : 175) + Math.sin(now * .03) * 20, audio.currentTime, .04);
    volume.gain.setTargetAtTime(document.hidden ? 0 : .018, audio.currentTime, .08);
  }
  requestAnimationFrame(move);
}
document.addEventListener('visibilitychange', () => {
  if (audio && !squashed) (document.hidden ? audio.suspend() : audio.resume()).catch(() => {});
});
requestAnimationFrame(move);
