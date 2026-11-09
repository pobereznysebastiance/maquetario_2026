// Inspector en tres pestañas y vistas del riel izquierdo (etapa 3, decisión D3).
//
//   Libro      estructura, misceláneas, grilla, foliado, cornisa, titulillo y fuentes del equipo
//   Página     la página activa y sus excepciones
//   Selección  objeto (posición, alineación, orden) y, si es una caja de texto, tipografía y
//              párrafo; sin selección, un estado vacío
//
// Capas e Índice dejan el inspector: son vistas del riel izquierdo, junto a Páginas.
//
// El inspector es un componente de React (components/inspector/Inspector.tsx), montado acá una
// vez en #inspectorContent. inspector() y showTab() de studio.ts quedan como fachada: inspector()
// avisa que el estado cambió (y React redibuja sólo lo que cambió); showTab acepta los nombres
// viejos y los lleva a la vista nueva (showTab('text') → Selección; showTab('index') → Índice del
// riel). La pestaña elegida se recuerda en localStorage. Las vistas del riel (Índice, Capas) son
// componentes de React (components/rail/RailViews.tsx).
//
// Va al final de src/entries/app.ts: el primer dibujo tiene que ver todos los paneles registrados.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { AnyFunction } from './extend.ts';
import { notifyEditorState } from './react/editor-state.ts';
import { mount } from './react/mount.tsx';
import { mountRailViews } from './components/rail/RailViews.tsx';
import { Inspector, planFor, type InspectorView } from './components/inspector/Inspector.tsx';
import { editor } from './core-api.ts';

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

const content = $('#inspectorContent');

// Después de cada inspector(): tab queda con la pestaña interna de lo que se ve (la usan otros
// módulos: tab === 'pages', tab === 'text'…), y un campo numérico que no se grabó (fuera de rango)
// vuelve a su valor, como cuando el inspector se rehacía entero.
extend.after(
  'inspector',
  function () {
    editor.tab = planFor(view).primary;
    for (const field of content.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      if (field.hasAttribute('value') && Number(field.value) !== Number(field.defaultValue))
        field.value = field.defaultValue;
  },
  'inspector-views',
);

// ── Vista del riel: Índice y Capas son componentes de React (components/rail/RailViews.tsx) ──
const railHost = $('#railView');

// ── Pestañas ──
const tabs = $('.inspector .tabs'),
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
  syncFoot();
}
/** El consejo del pie habla de la grilla: se ve en Libro, con un libro abierto, hasta que se descarta. */
function syncFoot(): void {
  foot.hidden = view !== 'book' || !editor.hasDocument || tipHidden();
}

// ── El inspector: un componente de React, montado una vez. Con cada dibujo (también cuando se
// abre o se cierra un libro) el consejo del pie se ve o no. ──
mount(content, <Inspector host={content} view={() => view} drawn={syncFoot} />, { sync: true });

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
      if (editor.tab === view) editor.tab = planFor(view).primary;
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
  if (name === 'pages') return;
  railHost.setAttribute('aria-labelledby', 'railTab-' + name);
  railHost.scrollTop = 0;
  // La vista se dibuja sola (React): ya se redibujó con el aviso de arriba.
  mountRailViews(railHost);
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
