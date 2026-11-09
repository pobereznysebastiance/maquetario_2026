// Inspector: los módulos declaran qué le agregan, en lugar de envolver inspector().
//   decorateInspector(fn, 'módulo')  →  fn corre después de dibujar el inspector, en orden de carga.
//   registerInspectorPanel(tab, render, 'módulo')  →  esa pestaña dibuja su propio panel.
//   registerInspectorPanel('tab:sección', () => <Panel />, 'módulo')  →  una sección de React.
//   pauseInspectorWhile(cond, 'módulo')  →  mientras cond() sea verdadera, inspector() no redibuja.
// Por fuera de todo, inspector() conserva el scroll y los <details> abiertos una sola vez.
//
// Paneles de React (etapa 3, D2): conviven con los de HTML en la misma cadena.
// - Una sección: la pestaña en HTML deja su lugar con inspectorSlot(nombre, título, clave) de
//   studio.ts (un <section class="section"> vacío, en su orden). Apenas se dibuja la pestaña, y
//   antes que cualquier decorador, React monta el panel registrado como 'pestaña:nombre' dentro de
//   ese <section> (sincrónico: al volver de inspector() el DOM ya está completo). Así el orden, el
//   plegado y el reordenamiento de inspector-sections.ts, los <details> abiertos y los
//   decoradores que buscan nodos con $() siguen funcionando igual.
// - Una pestaña entera: registerInspectorPanel(tab, render) con un render que devuelve un
//   elemento de React en vez de escribir el HTML.
// Cada dibujo del inspector reemplaza el contenido: los paneles de React se vuelven a montar con
// él (como el HTML) y los anteriores se desmontan cuando su nodo sale de la página.
//
// La envoltura de extend.around se registra al cargar: tiene que quedar antes que la de
// editorial.js, que va por fuera de esta (index.html carga este archivo justo después de studio.js).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { isValidElement, type ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import type { AnyFunction } from './extend.ts';
import { mount } from './react/mount.tsx';

declare global {
  /** fn corre después de dibujar el inspector, en orden de carga. */
  var decorateInspector: (fn: AnyFunction, origin?: string) => void;
  /**
   * Con la pestaña panelTab activa, render dibuja el panel en lugar del contenido base (HTML, o un
   * elemento de React si lo devuelve). Con 'pestaña:sección', render devuelve el panel de React de
   * esa sección (el lugar lo deja inspectorSlot en el HTML de la pestaña).
   */
  var registerInspectorPanel: (
    panelTab: string,
    render: AnyFunction | (() => ReactNode),
    origin?: string,
  ) => void;
  /** Mientras cond() sea verdadera, inspector() no redibuja. Devuelve la cantidad de pausas. */
  var pauseInspectorWhile: (cond: () => unknown, origin?: string) => number;
  /**
   * Monta en el acto el panel de React de un lugar (data-inspector-slot) que agregó un decorador,
   * después de la pasada de montaje: misceláneas (book-workflow) y fuentes del equipo (fonts).
   */
  var mountInspectorSlot: (slot: HTMLElement) => void;
}

/** Raíces de React montadas en el inspector, con el nodo que las contiene. */
let roots: { container: Element; root: Root }[] = [];
/** Paneles de React por sección: 'pestaña:sección' → render. */
const sectionPanels = new Map<string, () => ReactNode>();

/**
 * Desmonta los paneles cuyo nodo salió de la página. Mientras la pestaña se arma por pasadas
 * (inspector-views.ts), lo ya dibujado espera en un fragmento: eso no cuenta como salir.
 */
function sweepRoots(): void {
  roots = roots.filter(({ container, root }) => {
    if (container.isConnected || container.getRootNode() instanceof DocumentFragment) return true;
    // Fuera del dibujo en curso: React no admite desmontar mientras dibuja.
    queueMicrotask(() => root.unmount());
    return false;
  });
}
function mountPanel(container: Element, node: ReactNode): void {
  roots.push({ container, root: mount(container, node, { sync: true }) });
}
/** Monta los paneles de React de las secciones (inspectorSlot) de la pestaña que se acaba de dibujar. */
function mountSectionPanels(): void {
  sweepRoots();
  for (const slot of $('#inspectorContent').querySelectorAll<HTMLElement>('[data-inspector-slot]'))
    mountSlot(slot);
}

globalThis.decorateInspector = (fn, origin = '') => extend.after('inspector', fn, origin);
// Una pestaña con panel propio dibuja ese panel en lugar del contenido base del inspector.
globalThis.registerInspectorPanel = (panelTab, render, origin = '') => {
  if (panelTab.includes(':')) {
    sectionPanels.set(panelTab, render as () => ReactNode);
    return;
  }
  extend.instead(
    'inspector',
    () => tab === panelTab,
    function (this: unknown, ...args: unknown[]) {
      const out = (render as AnyFunction).apply(this, args);
      if (!isValidElement(out)) {
        // Una pestaña en HTML con secciones de React (inspectorSlot): la extensión de abajo no
        // corre para esta pestaña (este panel reemplaza la cadena), así que se montan acá.
        mountSectionPanels();
        return out;
      }
      const host = $('#inspectorContent'),
        box = document.createElement('div');
      box.className = 'inspector-panel';
      host.replaceChildren(box);
      sweepRoots();
      mountPanel(box, out);
    },
    origin,
  );
};

/** Monta el panel registrado para el lugar (pestaña actual), si no está montado ya. */
function mountSlot(slot: HTMLElement): void {
  if (slot.hasAttribute('data-react')) return;
  const render = sectionPanels.get(tab + ':' + slot.dataset.inspectorSlot);
  if (render) mountPanel(slot, render());
}

// Secciones de React: se montan apenas se dibuja la pestaña, antes que los decoradores (esta
// extensión se registra primero).
extend.after(
  'inspector',
  function () {
    mountSectionPanels();
  },
  'inspector-registry',
);
// Un decorador que agrega su sección (en su lugar de siempre) la monta en el acto.
globalThis.mountInspectorSlot = (slot) => mountSlot(slot);

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
