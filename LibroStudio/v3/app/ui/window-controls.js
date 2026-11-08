// Área real de los botones de la ventana (minimizar, maximizar, cerrar / semáforos de macOS).
// La lee de la API del navegador (Window Controls Overlay) y la deja en --window-controls-left/right,
// que usa ui/templates/window.css. Se recalcula al cambiar tamaño o escala de pantalla.
(function () {
  'use strict';
  const overlay = navigator.windowControlsOverlay;
  if (!overlay) return;
  const root = document.documentElement;

  function update() {
    if (!overlay.visible) return;
    const area = overlay.getTitlebarAreaRect();
    if (!area || !area.width) return;
    const right = Math.max(0, Math.round(window.innerWidth - (area.x + area.width)));
    const left = Math.max(0, Math.round(area.x));
    root.style.setProperty('--window-controls-right', `${right}px`);
    root.style.setProperty('--window-controls-left', `${left}px`);
  }

  overlay.addEventListener('geometrychange', update);
  window.addEventListener('resize', update);
  update();
})();
