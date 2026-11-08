// Inspector: los módulos declaran qué le agregan, en lugar de envolver inspector().
//   decorateInspector(fn, 'módulo')  →  fn corre después de dibujar el inspector, en orden de carga.
//   registerInspectorPanel(tab, render, 'módulo')  →  esa pestaña dibuja su propio panel.
//   pauseInspectorWhile(cond, 'módulo')  →  mientras cond() sea verdadera, inspector() no redibuja.
// Por fuera de todo, inspector() conserva el scroll y los <details> abiertos una sola vez.
//
// La envoltura de extend.around se registra al cargar: tiene que quedar antes que la de
// editorial.js, que va por fuera de esta (index.html carga este archivo justo después de studio.js).
//
// Fuente TypeScript: se compila a build/inspector-registry.js (desktop/scripts/build.mjs).
import type { AnyFunction } from './extend.ts';

declare global {
  /** fn corre después de dibujar el inspector, en orden de carga. */
  var decorateInspector: (fn: AnyFunction, origin?: string) => void;
  /** Con la pestaña panelTab activa, render dibuja el panel en lugar del contenido base. */
  var registerInspectorPanel: (panelTab: string, render: AnyFunction, origin?: string) => void;
  /** Mientras cond() sea verdadera, inspector() no redibuja. Devuelve la cantidad de pausas. */
  var pauseInspectorWhile: (cond: () => unknown, origin?: string) => number;
}

globalThis.decorateInspector = (fn, origin = '') => extend.after('inspector', fn, origin);
// Una pestaña con panel propio dibuja ese panel en lugar del contenido base del inspector.
globalThis.registerInspectorPanel = (panelTab, render, origin = '') =>
  extend.instead('inspector', () => tab === panelTab, render, origin);

const pauses: { cond: () => unknown; origin: string }[] = [];
globalThis.pauseInspectorWhile = (cond, origin = '') => pauses.push({ cond, origin });
const inspectorPaused = (): boolean => pauses.some((p) => p.cond());

// Clave estable de un <details>: su primer campo, su id o su título (no la posición,
// que cambia cuando un decorador agrega secciones).
const inspectorDetailKey = (d: HTMLDetailsElement): string => {
  const field = d.querySelector<HTMLElement>('[data-bind]');
  if (field) return tab + ':' + field.dataset.bind;
  const id = d.id || d.querySelector('[id]')?.id;
  return tab + ':' + (id || d.querySelector('summary')?.textContent!.trim() || 'details');
};

extend.around(
  'inspector',
  (draw) =>
    function () {
      if (inspectorPaused()) return;
      const host = $('#inspectorContent'),
        scroll = host.scrollTop,
        open = new Map(
          [...host.querySelectorAll('details')].map((d) => [inspectorDetailKey(d), d.open]),
        );
      draw();
      for (const d of host.querySelectorAll('details')) {
        const key = inspectorDetailKey(d);
        if (open.has(key)) d.open = open.get(key)!;
      }
      host.scrollTop = scroll;
    },
  'inspector-registry',
);

export {};
