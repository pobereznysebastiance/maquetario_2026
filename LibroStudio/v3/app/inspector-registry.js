// Inspector: los módulos declaran qué le agregan, en lugar de envolver inspector().
//   decorateInspector(fn, 'módulo')  →  fn corre después de dibujar el inspector, en orden de carga.
//   registerInspectorPanel(tab, render, 'módulo')  →  esa pestaña dibuja su propio panel.
//   pauseInspectorWhile(cond, 'módulo')  →  mientras cond() sea verdadera, inspector() no redibuja.
// Por fuera de todo, inspector() conserva el scroll y los <details> abiertos una sola vez.
(function () {
  'use strict';
  window.decorateInspector = (fn, origin = '') => extend.after('inspector', fn, origin);
  // Una pestaña con panel propio dibuja ese panel en lugar del contenido base del inspector.
  window.registerInspectorPanel = (panelTab, render, origin = '') =>
    extend.instead('inspector', () => tab === panelTab, render, origin);

  const pauses = [];
  window.pauseInspectorWhile = (cond, origin = '') => pauses.push({ cond, origin });
  window.inspectorPaused = () => pauses.some((p) => p.cond());

  // Clave estable de un <details>: su primer campo, su id o su título (no la posición,
  // que cambia cuando un decorador agrega secciones).
  window.inspectorDetailKey = (d) => {
    const field = d.querySelector('[data-bind]');
    if (field) return tab + ':' + field.dataset.bind;
    const id = d.id || d.querySelector('[id]')?.id;
    return tab + ':' + (id || d.querySelector('summary')?.textContent.trim() || 'details');
  };

  extend.around(
    'inspector',
    (draw) =>
      function () {
        if (inspectorPaused()) return;
        const host = $('#inspectorContent'),
          scroll = host.scrollTop,
          open = new Map([...host.querySelectorAll('details')].map((d) => [inspectorDetailKey(d), d.open]));
        draw();
        for (const d of host.querySelectorAll('details')) {
          const key = inspectorDetailKey(d);
          if (open.has(key)) d.open = open.get(key);
        }
        host.scrollTop = scroll;
      },
    'inspector-registry',
  );
})();
