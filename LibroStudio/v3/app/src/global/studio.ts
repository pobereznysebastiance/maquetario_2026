// Núcleo de la interfaz: estado del libro y del editor, dibujo de páginas, inspector, toolbar,
// diálogos de formato, guardar/abrir y exportación.
//
// Es un script global, no un módulo (sin import/export): sus let/const/function de nivel
// superior son globales, como en el studio.js original. Otros archivos asignan sus estados
// (book = …, active = …) y extienden sus funciones por nombre (extend('render', …)), así que
// tienen que seguir siendo globales con el mismo orden de carga. En TypeScript, sus
// declaraciones las ven todos los src/*.ts sin declare global.
// Las funciones más extendidas se declaran con extensible('nombre', function …) (src/extend.ts):
// quedan registradas por nombre sin pasar por window y cualquier llamada, también las de este
// archivo, corre la cadena con sus extensiones. Son const: no se pueden usar antes de su línea.
// Los tipos del modelo se toman con import('../model.ts').X (en un script no hay import).
//
// Fuente TypeScript: se compila sin envoltorio a build/studio.js (desktop/scripts/build.mjs,
// carpeta src/global/).
'use strict';

/** Arrastre en curso de una caja (frame-handles lo arma con resize = dirección). */
interface ObjectDrag {
  o: import('../model.ts').BookObject;
  el: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** false: mover; una dirección (nw, n, ne…): redimensionar (objectDown de frame-handles convierte true en "se"). */
  resize: string | false;
  moved: boolean;
}

const M = LibroModel,
  $ = (s: string) => document.querySelector(s) as UIElement,
  $$ = (s: string) => [...document.querySelectorAll(s)] as UIElement[];
/** Trazos SVG de los íconos, por nombre. */
const paths: Record<string, string> = {
  file: 'M6 3h8l4 4v14H6z M14 3v5h5',
  folder: 'M3 7h7l2-3h7v5 M2 9h20l-3 12H3z',
  save: 'M4 3h14l3 3v15H3V3z M7 3v6h10V3 M7 21v-8h10v8',
  undo: 'M8 5L3 10l5 5 M3 10h10a7 7 0 0 1 7 7',
  redo: 'M16 5l5 5-5 5 M21 10h-10a7 7 0 0 0-7 7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:
    'M3 3l18 18 M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.2 3.9 M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 5-1.4 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.5-1.9',
  export: 'M8 8V3h9l3 3v15H8v-5 M3 12h10 M10 9l3 3-3 3 M16 3v5h4',
  select: 'M5 2l15 12-8 1-3 7z',
  text: 'M3 4h18 M12 4v17 M8 21h8 M3 4v3 M21 4v3',
  image: 'M3 3h18v18H3z M3 17l6-6 5 5 3-3 4 4 M14 7h.01',
  frame: 'M3 3h18v18H3z M3 3l18 18 M21 3L3 21',
  grid: 'M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18',
  folio: 'M10 2L6 22 M18 2l-4 20 M3 8h19 M2 16h19',
  header: 'M12 2v20 M2 12h20 M5 5l14 14 M19 5L5 19',
  box: 'M3 3h18v18H3z M7 7h10 M12 7v10 M9 17h6 M2 2h2v2H2z M20 20h2v2h-2z',
  plus: 'M12 5v14 M5 12h14',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  expand: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M16 21h5v-5',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  print: 'M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 13h12v8H6z M17 10h1',
  left: 'M4 5h16 M4 10h10 M4 15h16 M4 20h10',
  center: 'M4 5h16 M7 10h10 M4 15h16 M7 20h10',
  right: 'M4 5h16 M10 10h10 M4 15h16 M10 20h10',
  justify: 'M4 5h16 M4 10h16 M4 15h16 M4 20h16',
  pages: 'M4 5h12v16H4z M8 2h12v16',
  toc: 'M9 6h11 M9 12h11 M9 18h11 M4 6h1 M4 12h1 M4 18h1',
  layers: 'M12 4 3 9l9 5 9-5z M3 14l9 5 9-5',
  trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  link: 'M9 9L6 12a4 4 0 0 0 6 6l3-3 M15 15l3-3a4 4 0 0 0-6-6L9 9 M8 16l8-8',
  chevron: 'M6 9l6 6 6-6',
  // Paginadores (revisión de salida, glifos): primera, anterior, siguiente y última.
  first: 'M7 6v12 M17 6l-6 6 6 6',
  previous: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  last: 'M17 6v12 M7 6l6 6-6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  alert:
    'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  error: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M15 9l-6 6 M9 9l6 6',
  layout: 'M3 3h18v18H3z M9 3v18 M9 9h12',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4 M12 17h.01',
  grip: 'M9 6h.01 M9 12h.01 M9 18h.01 M15 6h.01 M15 12h.01 M15 18h.01',
  hand: 'M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8-4a2 2 0 0 1 3 0v7c0 4-3 6-7 6h-2c-3 0-5-2-7-5l-3-4c-1-2 1-3 2-2l2 2Z',
};
function icon(name: string): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
}
/** Dibuja los íconos de los [data-icon]. */
function icons(): void {
  $$('[data-icon]').forEach((e) => (e.innerHTML = icon(e.dataset.icon!)));
}
const esc = (s: unknown): string =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<
          string,
          string
        >
      )[c],
  );
// El estado del editor (book, active, spread, selected, tool, tab, zoom, scale, preview, dirty,
// busy, fontList, native, undoStack, redoStack, editing, drag) vive en src/state/editor.ts: acá
// se lo sigue usando por su nombre, que es un accesor sobre ese objeto.
let pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >(),
  recoveryTimer: number | undefined,
  /** Cajas de texto con texto sobrante en el pliego visible (la cuenta checkOverflow). */
  overflowCount = 0;
const selectObject = () => book.pages[active]?.objects.find((o) => o.id === selected);
/** Pedido al proceso principal de Electron; rechaza fuera de la app de escritorio. */
function nativeCall(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (!MaquetarioHost.available)
    return Promise.reject(Error('Esta función requiere la app de escritorio de Maquetario.'));
  if (action === 'newProject' && typeof updatePortableFontCatalog === 'function') {
    portableFontFaces = [];
    updatePortableFontCatalog();
  }
  const id = M.uid();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    MaquetarioHost.postMessage({ id, action, payload });
  });
}
window.nativeCall = nativeCall;
MaquetarioHost.onMessage((data) => {
  const p = pending.get(data.id);
  if (p) {
    pending.delete(data.id);
    data.error ? p.reject(Error(data.error)) : p.resolve(data.result);
  }
});
/** Avisos pedidos antes de que cargue el componente de avisos (build/app.js): [mensaje, tipo]. */
const pendingToasts: [message: string, type: string][] = [];
/**
 * Aviso del sistema: toast(mensaje, tipo), tipo 'success' (por defecto) | 'info' | 'warning' |
 * 'error'. Lo muestra el componente React de src/components/toast/, que reemplaza esta función al
 * cargar (extend.replace); hasta entonces, los avisos esperan en pendingToasts.
 */
function toast(msg: string, type = 'success'): void {
  pendingToasts.push([msg, type]);
}
/**
 * Avisa al anfitrión si hay cambios sin guardar y marca body.has-unsaved-changes (color del punto
 * del nombre y del estado). Una sola fuente, la variable dirty: el texto del indicador de guardado
 * lo dibuja la barra de estado en React, que se redibuja después de esta función
 * (src/react/editor-state.ts).
 */
function syncNative(): void {
  if (native) nativeCall('dirty', { dirty, title: book.title }).catch(() => {});
  document.body.classList.toggle('has-unsaved-changes', dirty);
}
/** Guarda el estado para deshacer. */
function snapshot(): void {
  undoStack.push(JSON.stringify(book));
  let sum = undoStack.reduce((a, b) => a + b.length, 0);
  while (undoStack.length > 1 && (sum > 40000000 || undoStack.length > 40))
    sum -= undoStack.shift()!.length;
  redoStack = [];
}
/** Marca cambios sin guardar y programa la copia de recuperación. */
function changed(): void {
  dirty = true;
  syncNative();
  clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(() => storeRecovery(), 900);
  updateStatus();
}
function commit(fn: () => void, full = true): void {
  if (busy) return;
  snapshot();
  try {
    fn();
    changed();
    render(full);
  } catch (error) {
    book = JSON.parse(undoStack.pop()!);
    toast((error as Error).message, 'error');
    render(true);
  }
}
function undo(): void {
  if (busy || !undoStack.length) return;
  finishEditing();
  redoStack.push(JSON.stringify(book));
  book = JSON.parse(undoStack.pop()!);
  selected = null;
  active = Math.min(active, book.pages.length - 1);
  spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
  changed();
  render(true);
}
function redo(): void {
  if (busy || !redoStack.length) return;
  finishEditing();
  undoStack.push(JSON.stringify(book));
  book = JSON.parse(redoStack.pop()!);
  selected = null;
  active = Math.min(active, book.pages.length - 1);
  spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
  changed();
  render(true);
}
/** Sección del inspector; enabled es la ruta del interruptor, si tiene. */
function section(
  title: string,
  key: string,
  body: string,
  enabled: string | null = null,
  badge = '',
): string {
  return `<section class="section" data-section="${esc(title)}" data-key="${key}"><div class="section-heading">${icon(key)}<span${enabled !== null ? ` id="switchLabel-${enabled}"` : ''}>${title}</span>${badge ? `<span class="tiny">${badge}</span>` : ''}${enabled !== null ? toggle(enabled) : ''}</div>${body}</section>`;
}
function toggle(path: string): string {
  return `<label class="switch"><input type="checkbox" data-bind="${path}" ${get(path) ? 'checked' : ''} aria-labelledby="switchLabel-${path}"><span></span></label>`;
}
function documentUnit(): 'mm' | 'cm' {
  return book.measurementUnit === 'cm' ? 'cm' : 'mm';
}
function displayMeasure(value: number): string {
  return Number((Number(value) / (documentUnit() === 'cm' ? 10 : 1)).toFixed(4)).toString();
}
function displayDimensions(width: number, height: number): string {
  return `${displayMeasure(width)} × ${displayMeasure(height)} ${documentUnit()}`;
}

function row(label: string, content: string): string {
  return `<div class="field-row"><label>${label}</label>${content}</div>`;
}
function number(path: string, min = 0, max = 100, step = 0.5, unit = 'mm'): string {
  return `<span class="unit-wrap"><input aria-label="${esc(path)}" data-bind="${path}" type="number" min="${min}" max="${max}" step="${step}" value="${get(path)}">${unit ? `<span class="unit">${unit}</span>` : ''}</span>`;
}
function options(path: string, items: string[][]): string {
  return `<select aria-label="${esc(path)}" data-bind="${path}">${items.map(([v, l]) => `<option value="${v}" ${get(path) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
}
/** Valor del libro en una ruta con puntos ('header.font'…). */
function get(path: string): any {
  return path.split('.').reduce((a: any, k) => a?.[k], book);
}
/** Escribe un valor del libro por ruta con puntos ('header.rule', 'folio.ruleWidth'…). */
function set(path: string, value: unknown): void {
  let keys = path.split('.'),
    last = keys.pop()!,
    obj = keys.reduce((a: any, k) => a[k], book);
  obj[last] = value;
}
const positions = [
  ['top', 'Margen superior'],
  ['bottom', 'Margen inferior'],
  ['outer', 'Lateral exterior'],
  ['inner', 'Lateral interior'],
  ['left', 'Lateral izquierdo'],
  ['right', 'Lateral derecho'],
];
const folioPositions = [
  ['bottom-outer', 'Inferior exterior'],
  ['bottom-center', 'Inferior centrado'],
  ['bottom-inner', 'Inferior interior'],
  ['top-outer', 'Superior exterior'],
  ['top-center', 'Superior centrado'],
  ['top-inner', 'Superior interior'],
  ['outer', 'Lateral exterior'],
  ['inner', 'Lateral interior'],
];
/**
 * Redibuja el inspector. Es una fachada: el inspector es un componente de React
 * (src/components/inspector/Inspector.tsx, montado por inspector-views.tsx) que se entera por el
 * aviso del estado del editor y cambia sólo lo que cambió. Extensible: inspector-registry.ts la
 * pausa (pauseInspectorWhile) y otros módulos hacen algo después (extend.after).
 */
const inspector = extensible('inspector', function (): void {
  // Antes de que cargue la entrada de la app (editor-state.ts) no hay nada que avisar.
  globalThis.notifyEditorState?.();
});
/**
 * Graba en el libro el valor de un control con data-bind (casilla, número o texto), con la misma
 * validación para todos. La usan los paneles de React del inspector.
 */
function commitBinding(el: UIElement): void {
  let value =
    el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  const key = el.dataset.bind!;
  if (
    el.type === 'number' &&
    (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max))
  ) {
    toast('Revisá el valor ingresado.', 'warning');
    inspector();
    return;
  }
  commit(() => {
    set(key, value);
    if (key.startsWith('grid.') || key.startsWith('margins.')) {
      if (
        !M.validateGrid(book) ||
        book.margins.inside + book.margins.outside > book.width - 10 ||
        book.margins.top + book.margins.bottom > book.height - 10
      )
        throw Error('La grilla no cabe: reducí márgenes, medianiles o cantidad de módulos.');
    }
  }, false);
}
/**
 * Graba en el objeto seleccionado el valor de un control con data-object (medidas, cuerpo,
 * interlineado, color…), con el aviso de rango. La usan los paneles de React.
 */
function commitObjectField(el: UIElement): void {
  const o = selectObject();
  if (!o) return;
  let value = el.type === 'number' ? Number(el.value) : el.value;
  if (
    el.type === 'number' &&
    (!Number.isFinite(value) || value < Number(el.min) || value > Number(el.max))
  ) {
    toast('El valor está fuera del rango permitido.', 'warning');
    inspector();
    return;
  }
  commit(() => {
    o[el.dataset.object!] = value;
    if (['x', 'y', 'w', 'h'].includes(el.dataset.object!)) {
      o.x = Math.max(0, Math.min(o.x, book.width - 3));
      o.y = Math.max(0, Math.min(o.y, book.height - 3));
      o.w = Math.min(o.w, book.width - o.x);
      o.h = Math.min(o.h, book.height - o.y);
    }
  }, false);
}
function templateMini(cols: number, lines = false): string {
  return Array.from(
    { length: 2 },
    () =>
      `<div class="mini-page">${Array.from({ length: cols }, () => '<div class="mini-col"></div>').join('')}</div>`,
  ).join('');
}
const templates: [string, number, number][] = [
  ['Libro (3 columnas)', 3, 6],
  ['Revista (2 columnas)', 2, 5],
  ['Folleto (2 columnas)', 2, 3],
  ['Simple (1 columna)', 1, 1],
  ['Cuaderno (1 columna)', 1, 12],
];
function renderTemplates(): void {
  const host = $('#templates');
  host.innerHTML =
    templates
      .map(([name, c, r], i) =>
        UI.templateCard({
          active: book.grid.cols === c && book.grid.rows === r,
          data: { template: i },
          art: templateMini(c),
          label: name,
        }),
      )
      .join('') +
    '<div class="template-tip"><strong>ⓘ &nbsp; Diseñá con intención</strong>La grilla ordena el espacio.<br>Tu composición le da carácter.</div>';
  host.querySelectorAll<UIElement>('[data-template]').forEach(
    (el) =>
      (el.onclick = () => {
        const [, cols, rows] = templates[Number(el.dataset.template)];
        commit(() => {
          book.grid.cols = cols;
          book.grid.rows = rows;
          if (!M.validateGrid(book)) {
            book.grid.gapX = 0;
            book.grid.gapY = 0;
          }
        }, true);
        toast('Grilla aplicada. Tus objetos conservan su posición.');
      }),
  );
}
function thumbs(): void {
  const host = $('#thumbnails'),
    savedScroll = host.scrollTop;
  host.innerHTML = '';
  host.classList.toggle('thumbs-vertical', verticalSpread());
  let step = book.facing ? 2 : 1;
  for (let i = 0; i < book.pages.length; i += step) {
    const b = UI.element(
      UI.pageThumb({
        active: spread === i,
        title:
          'Ir a páginas ' +
          (i + 1) +
          (step === 2 && i + 1 < book.pages.length ? '–' + (i + 2) : ''),
        pages: Array.from(
          { length: Math.min(step, book.pages.length - i) },
          (_, j) =>
            `<div class="thumb-paper"><div class="thumb-grid"></div>${book.pages[i + j].objects.length ? `<div class="thumb-lines"></div><div class="thumb-head">${esc(M.sectionAt(book, i + j))}</div>` : ''}</div>`,
        ).join(''),
        label: `${i + 1}${step === 2 && i + 1 < book.pages.length ? ' - ' + (i + 2) : ''}`,
      }),
    );
    b.onclick = () => {
      finishEditing();
      active = spread = i;
      selected = null;
      render(true);
    };
    host.append(b);
  }
  host.scrollTop = savedScroll;
}
/** Pliego en vertical (una página arriba de la otra). */
function verticalSpread(): boolean {
  return book.facing && book.spreadDirection === 'vertical';
}
function calculateScale(): void {
  const area = $('#spreadStage'),
    availableW = area.clientWidth - 58,
    availableH = area.clientHeight - 56,
    count = book.facing && spread + 1 < book.pages.length ? 2 : 1;
  scale =
    Math.max(
      0.15,
      Math.min(
        availableW / (book.width * (verticalSpread() ? 1 : count)),
        availableH / (book.height * (verticalSpread() ? count : 1)),
      ),
    ) * zoom;
}
function gridSvg(i: number, px: number): string {
  const m = M.margins(book, i),
    g = book.grid,
    r = M.gridRect(book, i),
    cw = (r.w - g.gapX * (g.cols - 1)) / g.cols,
    rh = (r.h - g.gapY * (g.rows - 1)) / g.rows;
  let rects = '';
  for (let c = 0; c < g.cols; c++)
    for (let row = 0; row < g.rows; row++)
      rects += `<rect x="${r.x + c * (cw + g.gapX)}" y="${r.y + row * (rh + g.gapY)}" width="${cw}" height="${rh}"/>`;
  return `<svg class="grid-svg" viewBox="0 0 ${book.width} ${book.height}"><g fill="none" stroke="#65cee3" stroke-width="${0.65 / px}" opacity=".58">${g.enabled ? rects : ''}</g><rect x="${m.left}" y="${book.margins.top}" width="${book.width - m.left - m.right}" height="${book.height - book.margins.top - book.margins.bottom}" fill="none" stroke="#e282d6" stroke-width="${0.7 / px}" opacity=".7"/></svg>`;
}
const autoElement = extensible(
  'autoElement',
  function (
    i: number,
    type: import('../model.ts').AutoType,
    px: number,
    print = false,
  ): HTMLElement | null {
    const cfg = M.auto(book, i, type);
    if (!cfg) return null;
    const el = document.createElement('div'),
      m = M.margins(book, i),
      font = ((cfg.size * 25.4) / 72) * px;
    el.className = 'auto-element auto-' + type;
    el.style.fontFamily = cfg.font;
    el.style.fontSize = font + 'px';
    let x = 0,
      y = 0,
      w = 0,
      h = font * 1.3,
      alignment = cfg.align,
      side = cfg.pos;
    const outer = i % 2 === 0 ? 'left' : 'right',
      inner = i % 2 === 0 ? 'right' : 'left';
    if (side === 'top' || side === 'bottom') {
      x = m.left * px;
      w = (book.width - m.left - m.right) * px;
      y =
        (side === 'top' ? cfg.distance : book.height - cfg.distance) * px -
        (side === 'bottom' ? h : 0);
    } else if (side.includes('-')) {
      let [v, a] = side.split('-');
      let horizontal = a === 'outer' ? outer : a === 'inner' ? inner : 'center';
      w = 30 * px;
      x =
        (horizontal === 'left'
          ? cfg.distance
          : horizontal === 'right'
            ? book.width - cfg.distance - 30
            : book.width / 2 - 15) * px;
      y = (v === 'top' ? cfg.distance : book.height - cfg.distance) * px - (v === 'bottom' ? h : 0);
      alignment = horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center';
    } else {
      let s = side === 'outer' ? outer : side === 'inner' ? inner : side;
      x = (s === 'left' ? cfg.distance : book.width - cfg.distance) * px;
      y = (book.height / 2) * px;
      w = 70 * px;
      el.style.transform = `translate(${s === 'left' ? '0' : '-100%'},-50%)${cfg.vertical ? ' rotate(-90deg)' : ''}`;
      el.style.transformOrigin = s === 'left' ? 'left center' : 'right center';
    }
    if (cfg.vertical && (side === 'top' || side === 'bottom' || side.includes('-')))
      el.style.transform = 'rotate(-90deg)';
    el.style.left = x + cfg.offsetX * px + 'px';
    el.style.top = y + cfg.offsetY * px + 'px';
    el.style.width = w + 'px';
    el.style.textAlign = alignment;
    if (cfg.text.includes('|')) {
      el.classList.add('auto-header');
      cfg.text.split('|').forEach((s) => {
        const span = document.createElement('span');
        span.textContent = s.trim();
        el.append(span);
      });
    } else el.textContent = cfg.text;
    if (type === 'header' && cfg.rule) el.classList.add('rule');
    return el;
  },
);
/** Dibuja la página i a px píxeles por milímetro. */
const paper = extensible('paper', function (i: number, px: number, print = false): HTMLElement {
  const page = document.createElement('div');
  page.className = print ? 'print-page' : 'page' + (active === i ? ' active-page' : '');
  page.dataset.page = String(i);
  page.style.width = book.width * px + 'px';
  page.style.height = book.height * px + 'px';
  const objects = document.createElement('div');
  objects.className = 'objects';
  page.append(objects);
  for (const o of book.pages[i].objects) {
    let el = document.createElement('div');
    el.className = 'paper-object ' + o.type + (!print && selected === o.id ? ' selected' : '');
    el.dataset.id = o.id;
    Object.assign(el.style, {
      left: o.x * px + 'px',
      top: o.y * px + 'px',
      width: o.w * px + 'px',
      height: o.h * px + 'px',
    });
    if (o.type === 'text') {
      Object.assign(el.style, {
        fontFamily: o.font,
        fontSize: ((o.size * 25.4) / 72) * px + 'px',
        lineHeight: ((o.leading * 25.4) / 72) * px + 'px',
        textAlign: o.align,
        color: o.color,
        fontWeight: o.bold ? '700' : '400',
        fontStyle: o.italic ? 'italic' : 'normal',
      });
      let t = document.createElement('div');
      t.className = 'text-content';
      t.textContent = o.text;
      el.append(t);
      if (!print) {
        t.addEventListener('blur', () => finishEditing());
        t.addEventListener('input', () => {
          o.text = t.innerText.replace(/\r/g, '');
          changed();
        });
        el.ondblclick = (e) => {
          e.stopPropagation();
          active = i;
          selected = o.id;
          startEditing(el);
        };
      }
    } else if (o.type === 'image') {
      let img = new Image();
      img.src = o.src;
      img.alt = o.name || 'Imagen';
      el.append(img);
    } else el.innerHTML = icon('frame');
    if (!print) {
      el.addEventListener('pointerdown', (e) => objectDown(e, o, i, el));
      if (selected === o.id) {
        const badge = document.createElement('span');
        badge.className = 'object-badge';
        badge.textContent =
          o.type === 'text' ? 'Cuadro de texto' : o.type === 'image' ? 'Imagen' : 'Marco';
        el.append(badge);
        const handle = document.createElement('span');
        handle.className = 'resize-handle';
        handle.addEventListener('pointerdown', (e) => objectDown(e, o, i, el, true));
        el.append(handle);
      }
    }
    objects.append(el);
  }
  for (const type of ['header', 'titulillo', 'folio'] as const) {
    const auto = autoElement(i, type, px, print);
    if (auto) page.append(auto);
  }
  if (!print) {
    const guides = document.createElement('div');
    guides.className = 'guides';
    guides.innerHTML = gridSvg(i, px);
    page.append(guides);
    page.addEventListener('pointerdown', (e) => pageDown(e, i, page));
  }
  return page;
});
const renderPages = extensible('renderPages', function (): void {
  calculateScale();
  const host = $('#spread'),
    vertical = verticalSpread();
  const count = Math.min(book.pages.length - spread, book.facing ? 2 : 1);
  host.classList.toggle('spread-vertical', vertical);
  host.replaceChildren();
  for (let i = spread; i < spread + count; i++) host.append(paper(i, scale));
  const width = book.width * (vertical ? 1 : count),
    height = book.height * (vertical ? count : 1);
  host.style.width = width * scale + (!vertical && count === 2 ? 2 : 0) + 'px';
  host.style.height = height * scale + (vertical && count === 2 ? 2 : 0) + 'px';
  $('#rulerX').innerHTML = Array.from(
    { length: 10 },
    (_, i) =>
      `<span>${Number(((i * width) / 10 / (book.measurementUnit === 'cm' ? 10 : 1)).toFixed(1))}</span>`,
  ).join('');
  $('#rulerY').innerHTML = Array.from(
    { length: 8 },
    (_, i) =>
      `<span>${Number(((i * height) / 8 / (book.measurementUnit === 'cm' ? 10 : 1)).toFixed(1))}</span>`,
  ).join('');
  requestAnimationFrame(checkOverflow);
});
/** Redibuja la pantalla. Nombre y formato del libro: barra del documento (React), vía updateStatus. */
const render = extensible('render', function (full = true): void {
  renderPages();
  inspector();
  if (full) {
    thumbs();
    renderTemplates();
  }
  updateStatus();
});
/**
 * Estado de la pantalla después de un cambio. Las barras superior, de estado y del documento
 * (React) se redibujan después de esta función (src/react/editor-state.ts), que otros módulos
 * extienden.
 */
function updateStatus(): void {}
function checkOverflow(): void {
  let count = 0;
  $$('#spread .paper-object.text').forEach((el) => {
    const t = el.querySelector('.text-content')!;
    el.querySelector('.overflow-mark')?.remove();
    if (t.scrollHeight > t.clientHeight + 2 || t.scrollWidth > t.clientWidth + 2) {
      count++;
      let plus = document.createElement('span');
      plus.className = 'overflow-mark';
      plus.textContent = '+';
      plus.title = 'Texto desbordado';
      el.append(plus);
    }
  });
  // La barra de estado (React) muestra la cuenta: se redibuja después de esta función.
  overflowCount = count;
}
const startEditing = extensible('startEditing', function (el: HTMLElement): void {
  if (preview || busy) return;
  finishEditing();
  snapshot();
  editing = el;
  el.classList.add('editing');
  el.querySelector<HTMLElement>('.text-content')!.contentEditable = 'true';
  el.querySelector<HTMLElement>('.text-content')!.focus();
  inspector();
});
function finishEditing(): void {
  if (!editing) return;
  const el = editing;
  editing = null;
  const t = el.querySelector<HTMLElement>('.text-content');
  if (t) {
    t.contentEditable = 'false';
  }
  el.classList.remove('editing');
  checkOverflow();
}
const objectDown = extensible(
  'objectDown',
  function (
    e: PointerEvent,
    o: import('../model.ts').BookObject,
    i: number,
    el: HTMLElement,
    resize: boolean | string = false,
  ): void {
    if (preview || busy || e.button !== 0) return;
    if (editing === el && !resize) return;
    e.stopPropagation();
    finishEditing();
    active = i;
    selected = o.id;
    if (tool === 'image' && o.type === 'frame') {
      chooseImage({ frame: o, page: i });
      return;
    }
    tool = 'select';
    snapshot();
    drag = {
      o,
      el,
      startX: e.clientX,
      startY: e.clientY,
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      // Esta versión base la reemplaza frame-handles, que guarda la dirección en lugar de true.
      resize: resize as string | false,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    el.addEventListener('pointermove', moveObject);
    el.addEventListener('pointerup', upObject, { once: true });
    el.addEventListener('pointercancel', upObject, { once: true });
    $$('.paper-object.selected').forEach((n) => n.classList.remove('selected'));
    el.classList.add('selected');
    if (!el.querySelector('.resize-handle')) {
      const handle = document.createElement('span');
      handle.className = 'resize-handle';
      handle.onpointerdown = (ev) => objectDown(ev, o, i, el, true);
      el.append(handle);
    }
    $$('.page').forEach((n) =>
      n.classList.toggle('active-page', Number(n.dataset.page) === active),
    );
    inspector();
    updateStatus();
  },
);
function moveObject(e: PointerEvent): void {
  if (!drag) return;
  let d = drag,
    o = d.o,
    dx = (e.clientX - d.startX) / scale,
    dy = (e.clientY - d.startY) / scale;
  d.moved = d.moved || Math.abs(dx) + Math.abs(dy) > 0.3;
  if (d.resize) {
    o.w = Math.max(3, Math.min(book.width - o.x, d.w + dx));
    o.h = Math.max(3, Math.min(book.height - o.y, d.h + dy));
  } else {
    o.x = Math.max(0, Math.min(book.width - o.w, d.x + dx));
    o.y = Math.max(0, Math.min(book.height - o.h, d.y + dy));
  }
  Object.assign(d.el.style, {
    left: o.x * scale + 'px',
    top: o.y * scale + 'px',
    width: o.w * scale + 'px',
    height: o.h * scale + 'px',
  });
  updateStatus();
}
function upObject(e: PointerEvent): void {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.el.removeEventListener('pointermove', moveObject);
  if (d.el.hasPointerCapture(e.pointerId)) d.el.releasePointerCapture(e.pointerId);
  if (d.moved) {
    changed();
    render(false);
  } else {
    undoStack.pop();
    updateStatus();
    checkOverflow();
  }
}
const pageDown = extensible(
  'pageDown',
  function (e: PointerEvent, i: number, el: HTMLElement): void {
    if ((e.target as Element).closest('.paper-object') || preview || busy || e.button !== 0) return;
    finishEditing();
    active = i;
    selected = null;
    let r = el.getBoundingClientRect(),
      pos = {
        x: Math.max(0, (e.clientX - r.left) / scale),
        y: Math.max(0, (e.clientY - r.top) / scale),
      };
    if (tool === 'text' || tool === 'box' || tool === 'frame') {
      commit(() => {
        const o =
          tool === 'frame'
            ? {
                id: M.uid(),
                type: 'frame',
                ...pos,
                w: Math.min(80, book.width - pos.x),
                h: Math.min(50, book.height - pos.y),
              }
            : M.text(
                'Escribí aquí tu texto',
                pos.x,
                pos.y,
                Math.min(90, book.width - pos.x),
                Math.min(50, book.height - pos.y),
              );
        o.w = Math.max(1, o.w);
        o.h = Math.max(1, o.h);
        book.pages[i].objects.push(o);
        selected = o.id;
        tool = 'select';
      }, true);
      if (selectObject()?.type === 'text')
        requestAnimationFrame(() => {
          const target = $(`#spread [data-id="${selected}"]`);
          if (target) startEditing(target);
        });
    } else if (tool === 'image') chooseImage({ pos, page: i });
    else render(false);
  },
);
let imageTarget: Record<string, any> | null = null;
function chooseImage(target: Record<string, unknown>): void {
  imageTarget = target;
  $('#imageInput').value = '';
  $('#imageInput').click();
}
$('#imageInput').onchange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files![0],
    target = imageTarget;
  if (!file || !target) return;
  try {
    if (file.size > 25000000) throw Error('La imagen supera 25 MB. Usá una versión más liviana.');
    const url = URL.createObjectURL(file),
      img = new Image();
    img.src = url;
    try {
      await img.decode();
      const ratio = Math.min(1, 2600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * ratio);
      c.height = Math.round(img.height * ratio);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const src = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
      commit(() => {
        let o = target.frame;
        if (o) {
          o.type = 'image';
          o.src = src;
          o.name = file.name;
        } else {
          const w = Math.max(3, Math.min(108, book.width - target.pos.x));
          o = {
            id: M.uid(),
            type: 'image',
            x: target.pos.x,
            y: target.pos.y,
            w,
            h: Math.max(1, Math.min(book.height - target.pos.y, (w * img.height) / img.width)),
            src,
            name: file.name,
          };
          book.pages[target.page].objects.push(o);
        }
        active = target.page;
        selected = o.id;
        tool = 'select';
      }, true);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    toast('No se pudo cargar la imagen: ' + (error as Error).message, 'error');
  }
};
function showTab(name: string): void {
  tab = name;
  $$('.tab').forEach((e) => {
    e.classList.toggle('active', e.dataset.tab === tab);
    e.setAttribute('aria-selected', String(e.dataset.tab === tab));
  });
  $('#inspectorContent').scrollTop = 0;
  inspector();
}
const setTool = extensible('setTool', function (name: string): void {
  finishEditing();
  if (['grid', 'folio', 'header'].includes(name)) {
    showTab('design');
    const section = [...$('#inspectorContent').querySelectorAll('.section')][
      ({ grid: 0, folio: 2, header: 3 } as Record<string, number>)[name]
    ];
    section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    tool = 'select';
  } else {
    tool = name;
    if (name === 'text' || name === 'box') showTab('text');
  }
  // La herramienta activa la marca el riel (src/components/rail/Rail.tsx) al terminar setTool.
  $('#spread').dataset.cursor = tool === 'select' ? 'default' : 'crosshair';
});
// ── Diálogos: tres tipos (D4, docs/INTERFAZ_08-nov_decisiones-etapa3.md) ──
//
//   modal.sheet(título, <Contenido />, aplicar, 'Verbo', { size })  Hoja: formulario corto, Cancelar + verbo
//   modal.info(título, <Contenido />, 'Listo', { size })            Hoja que sólo informa: un solo botón
//   modal.workspace(título, <Contenido />, { action })              Ventana de trabajo: casi pantalla
//                                                                  completa; su acción va arriba, junto a la cruz
//   modal.confirm(título, <Contenido />, aplicar, 'Verbo', { extra }) Confirmación con contenido propio
//   confirmAction / askChoice (components/dialog/dialogs.tsx)       Confirmación simple
//
// Todas son React: modal() es la fachada de openSheet / openWorkWindow / openConfirmSheet
// (components/dialog/), así se llaman igual que cuando armaban HTML. Nada de diálogo
// sobre diálogo: abrir una reemplaza a la que esté abierta. modal(título, cuerpo, aplicar,
// etiqueta) sin más es una Hoja mediana con Cancelar.

/** Ancho de la Hoja: sm (formularios de dos o tres campos), md (por defecto), lg (dos columnas). */
type SheetSize = 'sm' | 'md' | 'lg';
interface DialogOptions {
  /** Ancho de la Hoja (las otras clases tienen el suyo). */
  size?: SheetSize;
  /** Clase del contenido mientras dure la apertura: estilos propios de esa pantalla, no su tamaño. */
  variant?: string;
  /** Texto del botón secundario en lugar de "Cancelar" (por ejemplo, "Ahora no"). */
  cancelLabel?: string;
}
/** Acción de un diálogo: label, run (false lo deja abierto), id y busyLabel (mientras corre). */
type DialogActionOptions = import('../components/dialog/Sheet.tsx').DialogAction;
interface WorkspaceOptions extends Omit<DialogOptions, 'size' | 'cancelLabel'> {
  /** Acción principal de la ventana (Guardar PDF, Crear libro…), en la barra del título. */
  action?: DialogActionOptions;
  /** id del <dialog> (para las pruebas). */
  id?: string;
}
interface ConfirmOptions extends Omit<DialogOptions, 'size'> {
  /** Otra salida, a la izquierda (Cerrar sin guardar). */
  extra?: DialogActionOptions & { className?: string };
  /** id del botón del verbo. */
  actionId?: string;
}
/** Cuerpo de un diálogo: un elemento de React. */
type DialogBody = import('react').ReactNode;

/** Hoja mediana con Cancelar (la forma de siempre). */
function modal(title: string, body: DialogBody, apply: () => unknown, label = 'Aplicar'): void {
  modal.sheet(title, body, apply, label);
}
/** Hoja: formulario corto con Cancelar y el verbo de la acción. */
modal.sheet = function (
  title: string,
  body: DialogBody,
  apply: () => unknown,
  label: string,
  options: DialogOptions = {},
): void {
  if (busy) return;
  finishEditing();
  void openSheet(body, { title, action: { label, run: apply }, ...options });
};
/** Hoja que sólo informa (o elige y se cierra sola): un único botón, sin Cancelar. */
modal.info = function (
  title: string,
  body: DialogBody,
  label: string,
  options: DialogOptions = {},
): void {
  if (busy) return;
  finishEditing();
  void openSheet(body, { title, single: true, action: { label, run: () => true }, ...options });
};
/** Ventana de trabajo: casi pantalla completa, sin pie; se cierra con la cruz. */
modal.workspace = function (title: string, body: DialogBody, options: WorkspaceOptions = {}): void {
  if (busy) return;
  finishEditing();
  void openWorkWindow(body, { title, ...options });
};
/** Confirmación con contenido propio (el aviso de cierre): sin cruz, el foco en Cancelar. */
modal.confirm = function (
  title: string,
  body: DialogBody,
  apply: () => unknown,
  label: string,
  options: ConfirmOptions = {},
): Promise<void> {
  finishEditing();
  const { extra, actionId, cancelLabel, variant } = options;
  return openConfirmSheet(body, {
    title,
    action: { label, run: apply, id: actionId },
    extra,
    cancelLabel,
    variant,
  });
};
/**
 * Hoja de formato del libro (nuevo o existente; src/components/book-setup/). Con cambios sin
 * guardar, antes pregunta. Devuelve la promesa de la Hoja (se cumple al cerrarla), si la abrió.
 */
function settings(isNew = false): Promise<void> | undefined {
  if (isNew && dirty) {
    confirmChanges(() => settingsNew(), 'new');
    return;
  }
  return settingsNew(isNew);
}
/** Lo que se eligió en la Hoja de formato del libro (src/components/book-setup/), tal como está escrito. */
interface BookSettingsValues {
  title: string;
  /** Ancho y alto en la unidad elegida (unit). */
  width: string;
  height: string;
  /** Cantidad de páginas (sólo libro nuevo). */
  count: string;
  unit: 'mm' | 'cm';
  /** 'single' | 'horizontal' | 'vertical'. */
  arrangement: string;
  /** Nombre del formato (A5, Carta…) o 'Personalizado'. */
  format: string;
  /** Producto editorial elegido (libro nuevo; lo usa publications.ts). */
  publicationType?: string;
}
/**
 * Aplica la Hoja de formato del libro: un libro nuevo (isNew) o el formato del actual. Si los
 * valores no sirven, tira el error que muestra la Hoja. Otros módulos la extienden por nombre
 * (review-workspace: ya hay documento; publications: la grilla del producto editorial). La Hoja
 * la abre settingsNew (src/components/book-setup/BookSetup.tsx).
 */
const applyBookSettings = extensible(
  'applyBookSettings',
  function (isNew: boolean, values: BookSettingsValues): boolean {
    const measureUnit = values.unit,
      unit = measureUnit === 'cm' ? 10 : 1,
      w = Number((Number(values.width) * unit).toFixed(8)),
      h = Number((Number(values.height) * unit).toFixed(8)),
      count = isNew ? Number(values.count) : book.pages.length;
    if (
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w < 60 ||
      w > 420 ||
      h < 60 ||
      h > 594 ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 200
    )
      throw Error('Ingresá medidas válidas y entre 1 y 200 páginas.');
    const title = values.title.trim().slice(0, 250) || 'Mi libro',
      arrangement = values.arrangement,
      facing = arrangement !== 'single',
      format = values.format;
    commit(() => {
      if (isNew) {
        book = M.create();
        book.pages = Array.from({ length: count }, M.page);
        book.grid.cols = 1;
        book.grid.rows = 1;
        book.chapter = '';
        selected = null;
        active = spread = 0;
      }
      const resized = isNew || Math.abs(book.width - w) > 1e-7 || Math.abs(book.height - h) > 1e-7;
      book.measurementUnit = measureUnit;
      if (resized) {
        book.width = w;
        book.height = h;
      }
      if (resized && book.guides)
        book.guides = book.guides.map((g: { axis: string; position: number }) => ({
          ...g,
          position: Math.min(g.position, g.axis === 'v' ? w : h),
        }));
      book.title = title;
      book.facing = facing;
      book.spreadDirection = arrangement === 'vertical' ? 'vertical' : 'horizontal';
      book.format = format;
      if (resized) {
        const maxMargin = Math.min(w, h) / 4;
        for (const k of Object.keys(book.margins) as (keyof typeof book.margins)[])
          book.margins[k] = Math.min(book.margins[k], maxMargin);
        if (!M.validateGrid(book)) {
          book.grid.gapX = book.grid.gapY = 0;
        }
        for (const p of book.pages)
          for (const o of p.objects) {
            o.w = Math.min(o.w, w);
            o.h = Math.min(o.h, h);
            o.x = Math.min(o.x, w - o.w);
            o.y = Math.min(o.y, h - o.h);
          }
      }
      spread = Math.floor(active / (facing ? 2 : 1)) * (facing ? 2 : 1);
    }, true);
    return true;
  },
);
/** Para qué se pregunta por los cambios sin guardar: da el verbo de los botones del aviso. */
type UnsavedIntent = 'close' | 'open' | 'new' | 'build' | 'recover' | 'continue';
/**
 * Pregunta qué hacer con los cambios sin guardar (el aviso de app-notices.tsx, el mismo que al
 * cerrar) y, si corresponde, sigue con proceed: al descartar, en el acto; al guardar, cuando se
 * guardó. intent da el verbo ("Descartar y abrir", "Guardar y abrir"…).
 */
function confirmChanges(proceed: () => unknown, intent: UnsavedIntent = 'continue'): void {
  // La autoprueba no puede contestar avisos: descarta y sigue, como antes.
  if (window.maquetarioSelfTest) {
    proceed();
    return;
  }
  askUnsaved(intent, {
    save: async () => {
      const saved = await saveProject();
      if (saved) setTimeout(proceed, 20);
      return saved;
    },
    discard: () => proceed(),
    cancel: () => {},
  });
}
async function saveProject(): Promise<boolean> {
  finishEditing();
  try {
    M.validate(book);
    if (native) {
      const saved = await nativeCall('save', {
        json: JSON.stringify(book, null, 2),
        name: book.title,
      });
      if (!saved) return false;
    } else
      download(
        new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }),
        book.title + '.mqt',
      );
    dirty = false;
    syncNative();
    toast('Proyecto guardado. Podés seguir editando.');
    return true;
  } catch (error) {
    toast('No se pudo guardar: ' + (error as Error).message, 'error');
    return false;
  }
}
window.saveProject = saveProject;
function download(blob: Blob, name: string): void {
  const a = document.createElement('a'),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openBook(): void {
  const run = async () => {
    try {
      if (native) {
        const r = await nativeCall('open', {});
        if (!r) return;
        loadOpenedProject(r);
      } else $('#openInput').click();
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };
  if (dirty) confirmChanges(run, 'open');
  else run();
}
/** Valida el contenido de un proyecto y lo carga como libro actual. */
function loadProject(content: string): void {
  if (content.length > 80000000) throw Error('El proyecto supera 80 MB.');
  const loaded = M.validate(JSON.parse(content.replace(/^\uFEFF/, '')));
  book = loaded;
  selected = null;
  active = spread = 0;
  undoStack = [];
  redoStack = [];
  dirty = false;
  syncNative();
  render(true);
  toast('Proyecto abierto.');
}
$('#openInput').onchange = async (e: Event) => {
  try {
    const file = (e.target as HTMLInputElement).files![0];
    if (file) loadProject(await file.text());
  } catch (error) {
    toast('No se pudo abrir: ' + (error as Error).message, 'error');
  }
  (e.target as HTMLInputElement).value = '';
};
function command(name: string): void {
  const o = selectObject();
  if (name === 'settings') {
    settings(false);
    return;
  }
  if (name === 'editText') {
    const el = $(`#spread [data-id="${selected}"]`);
    if (el) startEditing(el);
    return;
  }
  if (name === 'addPage') {
    commit(() => {
      book.pages.splice(active + 1, 0, M.page());
      active++;
      spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
      selected = null;
    });
    return;
  }
  if (name === 'duplicate') {
    commit(() => {
      let p = M.clone(book.pages[active]);
      p.id = M.uid();
      p.objects.forEach((o) => (o.id = M.uid()));
      book.pages.splice(active + 1, 0, p);
      active++;
      selected = null;
      spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
    });
    return;
  }
  if (name === 'deletePage' && book.pages.length > 1) {
    confirmAction({
      title: bw(
        '¿Eliminar la página ' + (active + 1) + '?',
        'Delete page ' + (active + 1) + '?',
        'Excluir a página ' + (active + 1) + '?',
      ),
      message: bw(
        'La página y sus objetos se quitan del libro. Podés recuperarlos con Deshacer.',
        'The page and its objects are removed from the book. You can bring them back with Undo.',
        'A página e seus objetos saem do livro. Você pode recuperá-los com Desfazer.',
      ),
      confirmLabel: bw('Eliminar página', 'Delete page', 'Excluir página'),
      danger: true,
    }).then((ok) => {
      if (ok) {
        commit(() => {
          book.pages.splice(active, 1);
          active = Math.min(active, book.pages.length - 1);
          spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
          selected = null;
        });
      }
    });
    return;
  }
  if (name === 'earlier' || name === 'later') {
    const target = active + (name === 'earlier' ? -1 : 1);
    if (target < 0 || target >= book.pages.length) return;
    commit(() => {
      [book.pages[active], book.pages[target]] = [book.pages[target], book.pages[active]];
      active = target;
      spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
    });
    return;
  }
  if (!o) return;
  if (name === 'deleteObject') {
    commit(() => {
      book.pages[active].objects = book.pages[active].objects.filter((n) => n !== o);
      selected = null;
    });
  }
  if (name === 'front' || name === 'back') {
    commit(() => {
      let a = book.pages[active].objects.filter((n) => n !== o);
      name === 'front' ? a.push(o) : a.unshift(o);
      book.pages[active].objects = a;
    });
  }
}
function preparePrint(): boolean {
  finishEditing();
  const root = $('#printRoot');
  root.replaceChildren();
  const px = 96 / 25.4;
  const style = document.createElement('style');
  style.textContent = `@page{size:${book.width}mm ${book.height}mm;margin:0}`;
  root.append(style);
  for (let i = 0; i < book.pages.length; i++) root.append(paper(i, px, true));
  return true;
}
function clearPrint(): void {
  $('#printRoot').replaceChildren();
}
window.preparePrint = preparePrint;
window.clearPrint = clearPrint;
async function recoveryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('LibroStudioRecovery', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('books');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function storeRecovery(): Promise<void> {
  try {
    const db = await recoveryDb(),
      tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').put(JSON.stringify(book), 'last');
    tx.oncomplete = () => db.close();
  } catch {}
}
/**
 * Íconos de lo que quedó en HTML. La barra superior (components/topbar/Topbar.tsx) y las
 * herramientas del riel (components/rail/: registerTool) las dibuja React.
 */
function buildToolbar(): void {
  icons();
}
buildToolbar();
$$('.tab').forEach((el) => (el.onclick = () => showTab(el.dataset.tab!)));
/** Vista previa (sin guías ni controles): la alterna "Vista previa" de la barra superior. */
function togglePreview(): void {
  finishEditing();
  preview = !preview;
  document.body.classList.toggle('preview-mode', preview);
}
$('#addPage').onclick = () => command('addPage');
// La barra del zoom (−, deslizador, +, Ajustar, Ampliar área) es React
// (src/components/canvas-bar/CanvasBar.tsx); el zoom real lo lleva canvas-navigation.ts, que
// reemplaza setZoom.
function setZoom(z: number): void {
  zoom = Math.max(0.4, Math.min(1.6, z));
  renderPages();
}
document.addEventListener('keydown', (e) => {
  // Con un diálogo abierto (todos viven en #dialogLayer), los atajos del editor no corren: Ctrl+S,
  // Ctrl+Z o Supr no tienen que tocar el libro por detrás de una Hoja.
  if (document.querySelector('#dialogLayer dialog[open]')) return;
  const input = (e.target as Element).closest?.('input,textarea,select,[contenteditable="true"]');
  if (e.ctrlKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProject();
    return;
  }
  if (input) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (e.key === 'Delete') {
    e.preventDefault();
    command('deleteObject');
  }
  if (e.key === 'Escape') {
    finishEditing();
    selected = null;
    tool = 'select';
    render(false);
  }
  if (!e.ctrlKey && !e.altKey) {
    const t = { v: 'select', t: 'text', i: 'image', f: 'frame' }[e.key.toLowerCase()];
    if (t) setTool(t);
  }
});
new ResizeObserver(() => {
  if (!editing && !drag) renderPages();
}).observe($('#spreadStage'));
window.addEventListener('beforeunload', (e) => {
  if (dirty && !native) {
    e.preventDefault();
    e.returnValue = '';
  }
});
render(true);
if (MaquetarioHost.available)
  nativeCall('ready', {})
    .then((info) => {
      native = true;
      fontList = [...new Set(['Georgia', 'Times New Roman', 'Garamond', ...(info.fonts || [])])];
      inspector();
    })
    .catch((e) => toast(e.message, 'error'));
