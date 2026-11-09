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
// Se está mudando por bloques a módulos de src/core/ (etapa 2, parte B, grupo 5: ver
// docs/arquitectura.md); lo que sale se publica desde src/core/core-wiring.ts.
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

// El estado del editor (book, active, spread, selected, tool, tab, zoom, scale, preview, dirty,
// busy, fontList, native, undoStack, redoStack, editing, drag) vive en src/state/editor.ts: acá
// se lo sigue usando por su nombre, que es un accesor sobre ese objeto.
/** Cajas de texto con texto sobrante en el pliego visible (la cuenta checkOverflow). */
let overflowCount = 0;
// En src/core/, publicados por core-wiring.ts (que carga antes):
// - utils.ts: $, $$, esc, M · icons.ts: paths, icon, icons
// - host-bridge.ts: nativeCall, toast, syncNative
// - history.ts: snapshot, changed, commit, undo, redo · recovery.ts: recoveryDb
// - book-paths.ts: get, set, selectObject, documentUnit, displayMeasure, displayDimensions,
//   positions, folioPositions · inspector.ts: inspector, commitBinding, commitObjectField
// - book-settings.ts: settings, applyBookSettings · print.ts: preparePrint, clearPrint
// - project-file.ts: confirmChanges, saveProject, download, openBook, loadProject
// modal() está en app: src/components/dialog/modal.ts (los módulos lo importan).
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
/**
 * Dibuja la página i a px píxeles por milímetro: sólo lo del libro (lo mismo en pantalla y en lo que
 * sale impreso). Lo que es sólo de la pantalla (selección, controladores, guías, oyentes) lo suma
 * screenPage() después, en el lienzo. print: página de impresión (.print-page).
 */
const paper = extensible('paper', function (i: number, px: number, print = false): HTMLElement {
  const page = document.createElement('div');
  page.className = print ? 'print-page' : 'page';
  page.dataset.page = String(i);
  page.style.width = book.width * px + 'px';
  page.style.height = book.height * px + 'px';
  const objects = document.createElement('div');
  objects.className = 'objects';
  page.append(objects);
  for (const o of book.pages[i].objects) {
    let el = document.createElement('div');
    el.className = 'paper-object ' + o.type;
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
    } else if (o.type === 'image') {
      let img = new Image();
      img.src = o.src;
      img.alt = o.name || 'Imagen';
      el.append(img);
    } else el.innerHTML = icon('frame');
    objects.append(el);
  }
  for (const type of ['header', 'titulillo', 'folio'] as const) {
    const auto = autoElement(i, type, px, print);
    if (auto) page.append(auto);
  }
  return page;
});
/**
 * Lo que la página dibujada por paper() lleva sólo en el lienzo: lo dibuja, con React, la capa de
 * selección (components/canvas/SelectionLayer.tsx, enganchada acá en canvas-layer.ts): la grilla y
 * las guías, la etiqueta y los controladores del objeto elegido, la selección múltiple, la página
 * activa, el imán y la marca de texto sobrante. Nunca sale impreso. No pone oyentes: los eventos del
 * lienzo los atiende #spread (ver "Eventos del lienzo", más abajo).
 */
const screenPage = extensible(
  'screenPage',
  function (page: HTMLElement, i: number, px: number): HTMLElement {
    return page;
  },
);
/**
 * Dibuja el lienzo: el pliego, o las filas de la vista continua. Es una fachada: lo dibuja el
 * componente <Spread/> (components/canvas/Spread.tsx), que canvas-layer.ts engancha acá; React
 * decide qué páginas o filas se ven y las llena con paper() y screenPage(). Al volver, el DOM ya
 * está al día.
 */
const renderPages = extensible('renderPages', function (): void {});
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
/**
 * Mide las cajas de texto con texto sobrante del pliego visible (overflowCount). La medición y la
 * marca + son de la capa de selección (canvas-layer.ts); la barra de estado se redibuja después.
 */
function checkOverflow(): void {}
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
    // La etiqueta, los controladores y las clases de selección los dibuja la capa de selección
    // (components/canvas/SelectionLayer.tsx), que se entera con el aviso de abajo.
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
// ── Eventos del lienzo, delegados en #spread ──
// El papel no lleva oyentes propios: un solo oyente por evento en #spread busca la página y el
// objeto, y llama a objectDown, pageDown o startEditing con los mismos argumentos de antes (sus
// extensiones no cambian). Los nodos del papel se rehacen en cada dibujo; #spread queda.
/** La página del lienzo (con su índice) y el objeto del libro bajo un evento, si lo hay. */
function canvasHit(target: EventTarget | null): {
  page: HTMLElement;
  i: number;
  el: HTMLElement | null;
  o: import('../model.ts').BookObject | null;
} | null {
  const node = target instanceof Element ? target : null,
    page = node?.closest<HTMLElement>('#spread .page');
  if (!page) return null;
  const i = Number(page.dataset.page),
    el = node!.closest<HTMLElement>('.paper-object'),
    o =
      (el && page.contains(el) && book.pages[i]?.objects.find((x) => x.id === el.dataset.id)) ||
      null;
  return { page, i, el: o ? el : null, o };
}
{
  const host = $('#spread');
  host.addEventListener('pointerdown', (e) => {
    const hit = canvasHit(e.target);
    if (!hit) return;
    const { page, i, el, o } = hit;
    if (el && o) {
      // Desde una manija: la de tamaño (true) o un controlador con su dirección (frame-handles).
      const handle = (e.target as Element).closest<HTMLElement>('.resize-handle');
      objectDown(e, o, i, el, handle ? handle.dataset.handle || true : false);
      // Como cuando el objeto tenía su oyente: si objectDown no detuvo el evento, sigue a la página.
      if (e.cancelBubble) return;
    }
    pageDown(e, i, page);
  });
  // Doble clic en una caja de texto: editarla (el Índice abre su vista: editorial.ts).
  host.addEventListener('dblclick', (e) => {
    const hit = canvasHit(e.target);
    if (!hit?.el || hit.o?.type !== 'text') return;
    e.stopPropagation();
    active = hit.i;
    selected = hit.o.id;
    startEditing(hit.el);
  });
  // El texto que se escribe en la caja en edición.
  host.addEventListener('input', (e) => {
    const t = e.target instanceof Element ? e.target.closest<HTMLElement>('.text-content') : null,
      hit = canvasHit(t);
    if (!t || !hit?.o || hit.o.type !== 'text') return;
    hit.o.text = t.innerText.replace(/\r/g, '');
    changed();
  });
  // La caja en edición pierde el foco ("blur" no sube: focusout sí).
  host.addEventListener('focusout', (e) => {
    if (e.target instanceof Element && e.target.matches('.paper-object > .text-content'))
      finishEditing();
  });
}
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
