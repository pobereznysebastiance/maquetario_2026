// Inspector: los módulos declaran qué le agregan, en lugar de envolver inspector().
//   decorateInspector(fn, 'módulo')  →  fn corre después de dibujar el inspector, en orden de carga.
// Próximo paso (docs/arquitectura.md): registerInspectorPanel(tab, render) para las rutas.
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
})();
