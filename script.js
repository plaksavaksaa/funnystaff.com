// Fit the entire Figma coordinate space inside the viewport without scrolling.
// The scene scales uniformly; individual image proportions stay unchanged.
function fitScene() {
  const scale = Math.min(window.innerWidth / 1440, window.innerHeight / 900);
  document.documentElement.style.setProperty('--scene-scale', scale);
}
fitScene();
window.addEventListener('resize', fitScene);

// Mouchette uses a native <select> and navigates on change.
// Keep the handler separate so the HTML remains easy to edit.
const menu = document.querySelector('.browse select');
if (menu) {
  menu.addEventListener('change', () => {
    if (menu.value) window.location.assign(menu.value);
  });
  // Restore the label when returning through browser history.
  window.addEventListener('pageshow', () => { menu.selectedIndex = 0; });
}
