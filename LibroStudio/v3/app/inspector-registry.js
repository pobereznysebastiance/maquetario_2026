// Inspector: los módulos declaran qué le agregan, en lugar de envolver inspector().
//   decorateInspector(fn, 'módulo')  →  fn corre después de dibujar el inspector, en orden de carga.
//   registerInspectorPanel(tab, render, 'módulo')  →  esa pestaña dibuja su propio panel.
(function () {
  'use strict';
  window.decorateInspector = (fn, origin = '') =>
    extend(
      'inspector',
      (previous) =>
        function () {
          previous();
          fn();
        },
      origin,
    );
  // Una pestaña con panel propio dibuja ese panel en lugar del contenido base del inspector.
  window.registerInspectorPanel = (panelTab, render, origin = '') =>
    extend(
      'inspector',
      (previous) =>
        function () {
          if (tab === panelTab) {
            render();
            return;
          }
          previous();
        },
      origin,
    );
})();
