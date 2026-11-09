// Inspector en tres pestañas y vistas del riel izquierdo (etapa 3, decisión D3).
//
//   Libro      estructura, página y grilla, foliado, cornisa y titulillo
//   Página     la página activa y sus excepciones
//   Selección  objeto (posición, alineación, orden) y, si es una caja de texto, tipografía y
//              párrafo; sin selección, un estado vacío
//
// Capas e Índice dejan el inspector: son vistas del riel izquierdo, junto a Páginas.
//
// Los módulos siguen dibujando por pestaña interna (tab = 'structure', 'design', 'pages', 'text',
// 'object', 'index', 'layers') con registerInspectorPanel y decorateInspector, como antes. Este
// módulo arma cada pestaña visible juntando esas pasadas en orden, y dibuja la vista del riel con
// la misma cadena del inspector. showTab acepta los nombres viejos y los lleva a la vista nueva
// (showTab('text') → Selección; showTab('index') → Índice del riel). La pestaña elegida se
// recuerda en localStorage.
//
// Tiene que cargar después de todo lo que registra paneles o decoradores del inspector (va al
// final de src/entries/app.ts): su extensión de inspector envuelve a todas las anteriores.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { AnyFunction } from './extend.ts';
import { notifyEditorState } from './react/editor-state.ts';

/** Pestaña visible del inspector. */
type InspectorView = 'book' | 'page' | 'selection';
/** Vista del riel izquierdo. */
type RailView = 'pages' | 'index' | 'layers';

declare global {
  /** Pestaña (o vista del riel) que corresponde a un nombre de pestaña, viejo o nuevo. */
  var inspectorTabFor: (name: string) => string;
  /** Muestra una vista del riel izquierdo: pages (miniaturas), index o layers. */
  var showRailView: (name: RailView) => void;
  /** Vista del riel que se ve ahora. */
  var currentRailView: () => RailView;
  /** Pestaña visible del inspector. */
  var currentInspectorView: () => InspectorView;
}

const VIEW_STORE = 'maquetario-inspector-view';
const TIP_STORE = 'maquetario-inspector-tip-hidden';
const SECTION_STORES = ['maquetario-inspector-order', 'maquetario-inspector-collapsed'];

/** Nombre de pestaña (viejo o nuevo) → pestaña visible. */
const VIEWS: Record<string, InspectorView> = {
  book: 'book',
  structure: 'book',
  design: 'book',
  page: 'page',
  pages: 'page',
  selection: 'selection',
  text: 'selection',
  object: 'selection',
};
const isRailTab = (name: string): name is 'index' | 'layers' =>
  name === 'index' || name === 'layers';

const readStore = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: vale hasta cerrar la app.
  }
};

// El orden y el plegado de las secciones se guardaban por pestaña vieja: pasan a la nueva.
function migrateSectionStores(): void {
  const groups: Record<InspectorView, string[]> = {
    book: ['structure', 'design'],
    page: ['pages'],
    selection: ['object', 'text'],
  };
  for (const key of SECTION_STORES) {
    let stored: Record<string, string[]>;
    try {
      stored = JSON.parse(readStore(key)!) || {};
    } catch {
      continue;
    }
    let changed = false;
    for (const [target, sources] of Object.entries(groups)) {
      if (stored[target]) continue;
      const merged = sources.flatMap((s) => stored[s] || []);
      if (!merged.length) continue;
      stored[target] = [...new Set(merged)];
      changed = true;
    }
    if (changed) writeStore(key, JSON.stringify(stored));
  }
}
migrateSectionStores();

let view: InspectorView = VIEWS[readStore(VIEW_STORE) || ''] || 'book';
let rail: RailView = 'pages';
/** Mientras se dibuja la vista del riel, la cadena del inspector dibuja una sola pestaña. */
let railPass = false;

/** Pasadas (pestañas internas) de la pestaña visible y la que queda en tab al terminar. */
function planFor(v: InspectorView): { passes: string[]; primary: string } {
  if (v === 'book') return { passes: ['structure', 'design'], primary: 'design' };
  if (v === 'page') return { passes: ['pages'], primary: 'pages' };
  const o = selectObject();
  if (multiSelection.size > 1) return { passes: ['object'], primary: 'object' };
  if (!o) return { passes: [], primary: 'selection' };
  // Como el panel Propiedades: primero el objeto, después el texto y el párrafo.
  if (o.type === 'text') return { passes: ['object', 'text'], primary: 'text' };
  return { passes: ['object'], primary: 'object' };
}

// ── Ajustes de cada pasada ──

/** Libro: el formato del libro se configura desde la estructura. */
function addBookSettings(host: HTMLElement): void {
  const build = host.querySelector('#structureBuild');
  if (!build || host.querySelector('#structureSettings')) return;
  build.insertAdjacentHTML(
    'afterend',
    UI.button({
      id: 'structureSettings',
      label: 'Formato y configuración',
      icon: 'settings',
      wide: true,
    }),
  );
  host.querySelector('#structureSettings')!.addEventListener('click', () => command('settings'));
}

const UNIT_SUFFIX = /\s·\s(mm|cm|pt|%|px|‰)\s*$/;

/** La unidad va dentro del campo, no en la etiqueta ("Grosor · mm" → "Grosor" + campo con mm). */
function unitsInsideFields(root: ParentNode): void {
  for (const label of root.querySelectorAll<HTMLLabelElement>('label')) {
    const text = [...label.childNodes]
      .reverse()
      .find((n) => n.nodeType === Node.TEXT_NODE && UNIT_SUFFIX.test(n.textContent || ''));
    if (!text) continue;
    const control = label.control;
    const field =
      control instanceof HTMLInputElement
        ? control
        : label.closest('.field-row, .pair > div, .control')?.querySelector('input');
    if (!field || field.type !== 'number' || field.closest('.unit-wrap')) continue;
    const unit = text.textContent!.match(UNIT_SUFFIX)![1];
    text.textContent = text.textContent!.replace(UNIT_SUFFIX, '');
    const wrap = document.createElement('span');
    wrap.className = 'unit-wrap';
    const mark = document.createElement('span');
    mark.className = 'unit';
    mark.textContent = unit;
    field.replaceWith(wrap);
    wrap.append(field, mark);
  }
}

function emptySelection(host: HTMLElement): void {
  host.innerHTML = `<div class="inspector-empty" data-pass="selection"><p class="inspector-empty-title">Nada seleccionado</p><p class="help">Hacé clic en una caja, una imagen o un marco de la página para ver sus propiedades. Con doble clic en una caja de texto, escribís.</p></div>`;
}

// ── Pestaña visible: varias pasadas de la cadena del inspector, una debajo de la otra ──
extend(
  'inspector',
  (draw: AnyFunction) =>
    function (this: unknown, ...args: unknown[]) {
      if (railPass) return draw.apply(this, args);
      const host = $('#inspectorContent'),
        { passes, primary } = planFor(view);
      if (!passes.length) {
        // La cadena corre igual (sin contenido): los decoradores que actualizan otras partes de
        // la interfaz (etiquetas de herramientas, imán…) no dependen de que haya selección.
        host.replaceChildren();
        tab = primary;
        draw.apply(this, args);
        emptySelection(host);
        return;
      }
      const parts = document.createDocumentFragment();
      for (const pass of passes) {
        tab = pass;
        draw.apply(this, args);
        if (pass === 'structure') addBookSettings(host);
        host.firstElementChild?.setAttribute('data-pass', pass);
        parts.append(...host.childNodes);
      }
      host.replaceChildren(parts);
      tab = primary;
      unitsInsideFields(host);
    },
  'inspector-views',
);

// ── Vista del riel: la misma cadena, con su pestaña, y el resultado se pasa al riel ──
const railHost = $('#railView');
extend.around(
  'inspector',
  (draw: AnyFunction) =>
    function (this: unknown, ...args: unknown[]) {
      draw.apply(this, args);
      if (rail === 'pages') return;
      const host = $('#inspectorContent'),
        scroll = host.scrollTop,
        railScroll = railHost.scrollTop,
        kept = document.createDocumentFragment(),
        previous = document.createDocumentFragment(),
        saved = tab;
      kept.append(...host.childNodes);
      // Lo anterior del riel sale del documento mientras se dibuja: los ids no se repiten.
      previous.append(...railHost.childNodes);
      railPass = true;
      tab = rail;
      try {
        draw.apply(this, args);
      } finally {
        railPass = false;
        tab = saved;
      }
      // Sin contenido nuevo (inspector en pausa): queda lo que había.
      if (host.childNodes.length) railHost.replaceChildren(...host.childNodes);
      else railHost.replaceChildren(previous);
      host.replaceChildren(kept);
      host.scrollTop = scroll;
      railHost.scrollTop = railScroll;
      unitsInsideFields(railHost);
    },
  'inspector-views',
);

// ── Pestañas ──
const tabs = $('.inspector .tabs'),
  content = $('#inspectorContent'),
  foot = $('.inspector-foot');
content.setAttribute('role', 'tabpanel');

const tipHidden = (): boolean => readStore(TIP_STORE) === '1';

function syncTabs(): void {
  for (const button of tabs.querySelectorAll<HTMLElement>('.tab')) {
    const on = button.dataset.tab === view;
    button.classList.toggle('active', on);
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
  }
  content.setAttribute('aria-labelledby', 'inspectorTab-' + view);
  // El consejo del pie habla de la grilla: se ve en Libro, hasta que se descarta.
  foot.hidden = view !== 'book' || tipHidden();
}

/** Lleva a la sección de la pasada pedida (p. ej. showTab('text') con un objeto arriba). */
function revealPass(name: string): void {
  const target = content.querySelector<HTMLElement>(`:scope > [data-pass="${name}"]`);
  if (target && target !== content.firstElementChild) target.scrollIntoView({ block: 'start' });
}

// La función base de showTab (y lo que ya la extiende, como las pestañas de category-design)
// sigue corriendo con el nombre de la pestaña visible: marca la pestaña y redibuja.
extend(
  'showTab',
  (base: AnyFunction) =>
    function (this: unknown, name: string) {
      if (isRailTab(name)) {
        showRailView(name);
        return;
      }
      view = VIEWS[name] || 'book';
      writeStore(VIEW_STORE, view);
      base.call(this, view);
      // Si el inspector estaba en pausa, tab quedó con el nombre de la pestaña visible.
      if (tab === view) tab = planFor(view).primary;
      syncTabs();
      revealPass(name);
    },
  'inspector-views',
);

// Flechas entre pestañas (patrón de pestañas de ARIA).
tabs.addEventListener('keydown', (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const list = [
    ...tabs.querySelectorAll<HTMLElement>('.tab:not([hidden]):not([data-workspace-hidden])'),
  ];
  const index = list.findIndex((b) => b.dataset.tab === view);
  if (index < 0 || !list.length) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? list.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
  showTab(list[next].dataset.tab!);
  list[next].focus();
});

// ── Riel izquierdo ──
const thumbnails = $('#thumbnails');

function showRailView(name: RailView): void {
  rail = name;
  // Las pestañas del riel (src/components/rail/Rail.tsx) se redibujan con la vista nueva.
  notifyEditorState();
  thumbnails.hidden = name !== 'pages';
  // Índice y Capas necesitan más ancho que las miniaturas (nombres de capas y entradas).
  const wide = name !== 'pages';
  const changed = document.body.classList.contains('rail-wide') !== wide;
  document.body.classList.toggle('rail-wide', wide);
  if (changed) window.dispatchEvent(new Event('resize'));
  railHost.hidden = name === 'pages';
  if (name === 'pages') {
    railHost.replaceChildren();
    return;
  }
  railHost.setAttribute('aria-labelledby', 'railTab-' + name);
  railHost.scrollTop = 0;
  inspector();
}
globalThis.showRailView = showRailView;
globalThis.currentRailView = () => rail;
globalThis.currentInspectorView = () => view;
globalThis.inspectorTabFor = (name) => (isRailTab(name) ? name : VIEWS[name] || 'book');

// ── Consejo del pie: se puede descartar ──
$('#inspectorTipClose').addEventListener('click', () => {
  writeStore(TIP_STORE, '1');
  syncTabs();
});

showTab(view);

export {};
