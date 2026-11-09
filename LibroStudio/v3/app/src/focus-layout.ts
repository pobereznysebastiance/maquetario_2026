// Modo ampliado: el botón #fullscreen esconde los paneles y deja el lienzo a todo el ancho.
// Escape vuelve a los paneles (salvo con un diálogo o el explorador de fuentes abiertos).
//
// updateFocusControl es global porque lo llaman shapes.js y las pruebas (focus-layout-tests,
// navigation-tests).
//
// Fuente TypeScript: se compila a build/focus-layout.js (desktop/scripts/build.mjs).

import { refreshCanvasBar } from './components/canvas-bar/canvas-bar-state.ts';

declare global {
  /** Pone al día el botón Ampliar área (texto, título y estado) según el modo ampliado. */
  var updateFocusControl: () => void;
  /** Entra o sale del modo ampliado (el botón #fullscreen de la barra del lienzo). */
  var toggleFocusLayout: () => void;
}

// El botón (#fullscreen) lo dibuja la barra del lienzo (React, components/canvas-bar/) a partir
// de la clase focused del body: acá sólo se le avisa que cambió.
function updateFocusControl(): void {
  refreshCanvasBar(true);
}
globalThis.updateFocusControl = updateFocusControl;
extend.after(
  'applyPanelSizes',
  function () {
    requestAnimationFrame(renderPages);
  },
  'focus-layout',
);
globalThis.toggleFocusLayout = () => {
  finishEditing();
  document.body.classList.toggle('focused');
  applyPanelSizes();
  updateFocusControl();
  requestAnimationFrame(renderPages);
};
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('focused') && !fontBrowser.open) {
      e.preventDefault();
      document.body.classList.remove('focused');
      applyPanelSizes();
      updateFocusControl();
    }
  },
  true,
);
updateFocusControl();

export {};
