// Espacio de revisión: pantalla "sin documento", revisión de las caras de salida, página activa,
// selección múltiple con Shift y alineación de objetos. Extiende al cargar hideWelcome,
// settingsNew, loadProject, startTutorial, outputPreview, outputDialog, paper, thumbs, objectDown,
// pageDown, render y updateStatus.
//
// Estado compartido: hasDocument, multiSelection, objectAlignReference y reviewFace viven en
// globalThis (antes eran `let` globales del script) porque otros archivos y las pruebas los leen y
// los reasignan. Acá se usan siempre por su nombre global, nunca con una copia local.
//
// Fuente TypeScript: se compila a build/review-workspace.js (desktop/scripts/build.mjs).

import { noBookReason } from './react/no-book.ts';
import type { Book, BookObject } from './model.ts';

const reviewText = {
  es: {
    preview: 'Revisar todas las caras',
    face: 'Cara',
    of: 'de',
    previous: 'Anterior',
    next: 'Siguiente',
    first: 'Primera',
    last: 'Última',
    pages: 'Páginas',
    blank: 'Blanco',
    emptyTitle: 'Tu próximo libro empieza acá',
    emptyBody: 'Creá un libro o abrí un proyecto para comenzar.',
    create: 'Crear libro',
    open: 'Abrir proyecto',
    active: 'Página activa',
    selected: 'Los cambios de esta sección afectan solo esta página.',
    left: 'izquierda',
    right: 'derecha',
    alignObjects: 'Alinear objetos',
    relative: 'Alinear con',
    margins: 'Márgenes de página',
    page: 'Página completa',
    selection: 'Selección de objetos',
    xLeft: 'Izquierda',
    xCenter: 'Centro horizontal',
    xRight: 'Derecha',
    yTop: 'Arriba',
    yCenter: 'Centro vertical',
    yBottom: 'Abajo',
    tip: 'Shift + clic para seleccionar varios objetos. Los objetos bloqueados no se modifican.',
    done: 'Objetos alineados.',
  },
  en: {
    preview: 'Review all output sides',
    face: 'Side',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    first: 'First',
    last: 'Last',
    pages: 'Pages',
    blank: 'Blank',
    emptyTitle: 'Your next book starts here',
    emptyBody: 'Create a book or open a project to begin.',
    create: 'Create book',
    open: 'Open project',
    active: 'Active page',
    selected: 'Changes in this section affect only this page.',
    left: 'left',
    right: 'right',
    alignObjects: 'Align objects',
    relative: 'Align to',
    margins: 'Page margins',
    page: 'Whole page',
    selection: 'Object selection',
    xLeft: 'Left',
    xCenter: 'Horizontal center',
    xRight: 'Right',
    yTop: 'Top',
    yCenter: 'Vertical center',
    yBottom: 'Bottom',
    tip: 'Shift-click to select multiple objects. Locked objects are not changed.',
    done: 'Objects aligned.',
  },
  pt: {
    preview: 'Revisar todas as faces',
    face: 'Face',
    of: 'de',
    previous: 'Anterior',
    next: 'Próxima',
    first: 'Primeira',
    last: 'Última',
    pages: 'Páginas',
    blank: 'Branco',
    emptyTitle: 'Seu próximo livro começa aqui',
    emptyBody: 'Crie um livro ou abra um projeto para começar.',
    create: 'Criar livro',
    open: 'Abrir projeto',
    active: 'Página ativa',
    selected: 'As alterações nesta seção afetam somente esta página.',
    left: 'esquerda',
    right: 'direita',
    alignObjects: 'Alinhar objetos',
    relative: 'Alinhar com',
    margins: 'Margens da página',
    page: 'Página inteira',
    selection: 'Seleção de objetos',
    xLeft: 'Esquerda',
    xCenter: 'Centro horizontal',
    xRight: 'Direita',
    yTop: 'Acima',
    yCenter: 'Centro vertical',
    yBottom: 'Abaixo',
    tip: 'Shift + clique seleciona vários objetos. Objetos bloqueados não são alterados.',
    done: 'Objetos alinhados.',
  },
};
export type ReviewWords = (typeof reviewText)['es'];

const rw = (): ReviewWords => reviewText[LibroI18n.language || 'es'];

declare global {
  /** Deja la app con un libro en blanco (pantalla sin libro). La usa scripts/style-snapshot.js. */
  var activateBlankDocument: () => void;
  /** Textos del espacio de revisión en el idioma actual (los usa inspector-organization.js). */
  var rw: () => ReviewWords;
  /** Cara de salida que muestra la revisión (la cambia tests/review-tests.js). */
  var reviewFace: number;
  /** Hay un documento abierto (lo leen y lo asignan muchos archivos y las pruebas). */
  var hasDocument: boolean;
  /** Ids de los objetos seleccionados con Shift (inspector-organization.js, book-workflow.js, pruebas). */
  var multiSelection: Set<string>;
  /** Referencia de "Alinear con": 'margins' | 'page' | 'selection' (inspector-organization.js, pruebas). */
  var objectAlignReference: string;
  var refreshEmptyCanvas: () => void;
  var updateActivePage: () => void;
  var alignSelection: (axis: string) => void;
}
globalThis.rw = rw;

let reviewSignature = '';
globalThis.reviewFace = 0;
globalThis.hasDocument = false;
globalThis.multiSelection = new Set();
globalThis.objectAlignReference = 'margins';
const emptyCanvas = document.createElement('div');
emptyCanvas.id = 'emptyCanvas';
$('#workarea').append(emptyCanvas);
function refreshEmptyCanvas(): void {
  const w = rw();
  document.body.classList.toggle('no-document', !hasDocument);
  emptyCanvas.hidden = hasDocument;
  // Sin libro, el riel vuelve a Páginas (Índice y Capas mostrarían el libro en blanco de atrás) y
  // "Agregar página" no aplica. Las barras (React) se arreglan solas con el aviso de abajo.
  if (!hasDocument && globalThis.currentRailView && currentRailView() !== 'pages')
    showRailView('pages');
  const addPage = $('#addPage');
  if (addPage) {
    addPage.disabled = !hasDocument;
    addPage.title = hasDocument ? LibroI18n.tr('Agregar página') : noBookReason();
  }
  globalThis.notifyEditorState?.();
  emptyCanvas.innerHTML = `<div>${icon('pages')}<h2>${w.emptyTitle}</h2><p>${w.emptyBody}</p>${UI.button({ id: 'emptyNew', variant: 'primary', label: w.create })}${UI.button({ id: 'emptyOpen', label: w.open })}</div>`;
  $('#emptyNew').onclick = () => settings(true);
  $('#emptyOpen').onclick = openBook;
}
globalThis.refreshEmptyCanvas = refreshEmptyCanvas;
// Al cambiar de idioma, la mesa vacía y el motivo de "Agregar página" van en el idioma nuevo.
document.addEventListener('maquetario:language', refreshEmptyCanvas);
extend.after(
  'hideWelcome',
  function () {
    refreshEmptyCanvas();
  },
  'review-workspace',
);
window.hideWelcome = hideWelcome;
// Al crear un libro (o aplicar el formato), ya hay documento.
let bookBeforeSettings: Book | null = null;
extend.before(
  'applyBookSettings',
  function () {
    bookBeforeSettings = book;
  },
  'review-workspace',
);
extend.result(
  'applyBookSettings',
  function (applied: boolean, isNew: boolean) {
    if (book !== bookBeforeSettings || (!isNew && applied)) {
      hasDocument = true;
      multiSelection.clear();
      refreshEmptyCanvas();
      render(true);
    }
    return applied;
  },
  'review-workspace',
);
extend.after(
  'loadProject',
  function (content: string) {
    hasDocument = true;
    multiSelection.clear();
    refreshEmptyCanvas();
  },
  'review-workspace',
);
const previousDemo = new MutationObserver(() => {
  const button = $('#welcomeDemo');
  if (button && !button.dataset.blankHook) {
    button.dataset.blankHook = '1';
    button.addEventListener('click', () => {
      hasDocument = true;
      refreshEmptyCanvas();
    });
  }
  const resume = $('#welcomeResume');
  if (resume && !resume.dataset.blankHook) {
    resume.dataset.blankHook = '1';
    resume.addEventListener('click', () => {
      if (!hasDocument) settings(true);
    });
  }
  const recover = $('#welcomeRecover');
  if (recover && !recover.dataset.blankHook) {
    recover.dataset.blankHook = '1';
    recover.addEventListener('click', () => {
      hasDocument = true;
      refreshEmptyCanvas();
    });
  }
});
previousDemo.observe(welcome, { childList: true, subtree: true });
// Starting the tour does not load the demo. Users create their own blank document first.
extend.instead(
  'startTutorial',
  () => !hasDocument,
  function (index?: number) {
    hideWelcome();
    // Cuando se cierra la Hoja de libro nuevo: si se creó el libro, sigue el tutorial (ya con
    // documento, esta ruta no vuelve a entrar).
    void Promise.resolve(settings(true)).then(() => {
      if (hasDocument) startTutorial(index);
    });
  },
  'review-workspace',
);
window.startTutorial = startTutorial;
extend.replace(
  'outputPreview',
  function () {
    if (!$('#outputSummary')) return;
    try {
      const config = outputConfigFromDialog(),
        signature = JSON.stringify(config);
      if (signature !== reviewSignature) {
        reviewFace = 0;
        reviewSignature = signature;
      }
      const info = prepareOutput(config as unknown as Record<string, unknown>),
        sheets = [...$('#printRoot').querySelectorAll('.output-sheet')];
      reviewFace = Math.max(0, Math.min(reviewFace, sheets.length - 1));
      const sheet = sheets[reviewFace].cloneNode(true) as HTMLElement,
        box = $('#outputPreview'),
        px = 96 / 25.4,
        k = Math.min((box.clientWidth - 10) / (info.width * px), 210 / (info.height * px));
      sheet.style.transform = `scale(${k})`;
      sheet.style.left = (box.clientWidth - info.width * px * k) / 2 + 'px';
      sheet.style.top = (box.clientHeight - info.height * px * k) / 2 + 'px';
      box.replaceChildren(sheet);
      let controls: HTMLElement = $('#reviewFaces');
      if (!controls) {
        controls = document.createElement('div');
        controls.id = 'reviewFaces';
        box.before(controls);
      }
      const w = rw();
      const first = reviewFace === 0,
        last = reviewFace === sheets.length - 1;
      controls.innerHTML = `${UI.textButton({ id: 'reviewFirst', label: '|‹', aria: { label: w.first }, disabled: first })}${UI.textButton({ id: 'reviewPrev', label: '‹', aria: { label: w.previous }, disabled: first })}<label>${w.face} <input id="reviewFaceInput" type="number" min="1" max="${sheets.length}" value="${reviewFace + 1}"> ${w.of} ${sheets.length}</label>${UI.textButton({ id: 'reviewNext', label: '›', aria: { label: w.next }, disabled: last })}${UI.textButton({ id: 'reviewLast', label: '›|', aria: { label: w.last }, disabled: last })}`;
      const faces = outputGeometry(config).faces,
        pages = faces[reviewFace]
          .map((i) => (i < book.pages.length ? M.folio(book, i) : w.blank))
          .join(' | ');
      $('#outputSummary').textContent =
        `${w.pages}: ${pages} · ${displayDimensions(info.width, info.height)} · ${Math.round(info.scale * 100)}%`;
      $('.output-preview-title').textContent = w.preview;
      $('#reviewFirst').onclick = () => {
        reviewFace = 0;
        outputPreview();
      };
      $('#reviewPrev').onclick = () => {
        reviewFace--;
        outputPreview();
      };
      $('#reviewNext').onclick = () => {
        reviewFace++;
        outputPreview();
      };
      $('#reviewLast').onclick = () => {
        reviewFace = sheets.length - 1;
        outputPreview();
      };
      $('#reviewFaceInput').onchange = (e: Event) => {
        reviewFace = Math.floor(Number((e.target as HTMLInputElement).value)) - 1;
        if (!Number.isFinite(reviewFace)) reviewFace = 0;
        outputPreview();
      };
      $('#outputError').textContent = '';
      setOutputApplyDisabled(false);
    } catch (error) {
      $('#outputError').textContent = (error as Error).message;
      setOutputApplyDisabled(true);
    } finally {
      clearPrint();
    }
  },
  'review-workspace',
);
extend.before(
  'outputDialog',
  function () {
    reviewFace = 0;
    reviewSignature = '';
  },
  'review-workspace',
);
extend.result(
  'paper',
  function (page: HTMLElement, index: number, px: number, print = false) {
    if (!print) {
      page.classList.toggle('is-page-active', index === active);
      const badge = document.createElement('span');
      badge.className = 'page-active-badge';
      badge.textContent = `${rw().active} ${index + 1}`;
      page.append(badge);
      for (const o of book.pages[index].objects)
        if (multiSelection.has(o.id)) {
          const el = page.querySelector(`[data-id="${o.id}"]`);
          if (el) el.classList.add('multi-selected');
        }
    }
    return page;
  },
  'review-workspace',
);
function updateActivePage(): void {
  const w = rw();
  $$('#spread .page').forEach((page) => {
    const chosen = Number(page.dataset.page) === active;
    page.classList.toggle('is-page-active', chosen);
  });
  $$('.thumb-paper').forEach((page) =>
    page.classList.toggle('thumb-page-active', Number(page.dataset.individualPage) === active),
  );
  let badge: HTMLElement = $('#activePageStatus');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'activePageStatus';
    $('.documentbar').prepend(badge);
  }
  badge.textContent = `${w.active} ${active + 1}`;
}
globalThis.updateActivePage = updateActivePage;
extend.after(
  'thumbs',
  function () {
    let i = 0;
    $$('.thumb-paper').forEach((page) => {
      const index = i++;
      page.dataset.individualPage = String(index);
      page.title = rw().active + ' ' + (index + 1);
      page.onclick = (e) => {
        e.stopPropagation();
        finishEditing();
        active = index;
        spread = Math.floor(index / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
        selected = null;
        multiSelection.clear();
        render(true);
      };
    });
    updateActivePage();
  },
  'review-workspace',
);
extend.before(
  'objectDown',
  function (e: MouseEvent, o: BookObject, index: number, el: HTMLElement, resize = false) {
    if (!resize && !multiSelection.has(o.id)) multiSelection.clear();
  },
  'review-workspace',
);
extend.after(
  'objectDown',
  function () {
    updateActivePage();
  },
  'review-workspace',
);
extend.instead(
  'objectDown',
  (e: MouseEvent, o: BookObject, index: number, el: HTMLElement, resize = false) =>
    e.shiftKey && !resize && !editing && !o.locked && !o.hidden,
  function (e: MouseEvent, o: BookObject, index: number) {
    e.stopPropagation();
    e.preventDefault();
    if (active !== index) multiSelection.clear();
    active = index;
    if (multiSelection.size === 0 && selected && selected !== o.id) multiSelection.add(selected);
    multiSelection.has(o.id) ? multiSelection.delete(o.id) : multiSelection.add(o.id);
    selected = o.id;
    render(false);
  },
  'review-workspace',
);
extend.before(
  'pageDown',
  function (e: MouseEvent) {
    if (!(e.target as Element).closest('.paper-object')) multiSelection.clear();
  },
  'review-workspace',
);
extend.after(
  'pageDown',
  function () {
    updateActivePage();
  },
  'review-workspace',
);
function alignSelection(axis: string): void {
  const objects = book.pages[active].objects.filter(
    (o) =>
      (multiSelection.size ? multiSelection.has(o.id) : o.id === selected) &&
      !o.locked &&
      !o.hidden,
  );
  if (!objects.length) return;
  const margins = M.margins(book, active);
  let ref = { x: 0, y: 0, w: book.width, h: book.height };
  if (objectAlignReference === 'margins')
    ref = {
      x: margins.left,
      y: book.margins.top,
      w: book.width - margins.left - margins.right,
      h: book.height - book.margins.top - book.margins.bottom,
    };
  if (objectAlignReference === 'selection') {
    if (objects.length < 2) return;
    const x = Math.min(...objects.map((o) => o.x)),
      y = Math.min(...objects.map((o) => o.y));
    ref = {
      x,
      y,
      w: Math.max(...objects.map((o) => o.x + o.w)) - x,
      h: Math.max(...objects.map((o) => o.y + o.h)) - y,
    };
  }
  commit(() => {
    for (const o of objects) {
      if (axis === 'left') o.x = ref.x;
      if (axis === 'hcenter') o.x = ref.x + (ref.w - o.w) / 2;
      if (axis === 'right') o.x = ref.x + ref.w - o.w;
      if (axis === 'top') o.y = ref.y;
      if (axis === 'vcenter') o.y = ref.y + (ref.h - o.h) / 2;
      if (axis === 'bottom') o.y = ref.y + ref.h - o.h;
      o.x = Math.max(0, Math.min(book.width - o.w, o.x));
      o.y = Math.max(0, Math.min(book.height - o.h, o.y));
    }
  }, false);
  toast(rw().done);
}
globalThis.alignSelection = alignSelection;
// La alineación de objetos está en el panel del objeto (ObjectPanel.tsx).
decorateInspector(() => {
  updateActivePage();
}, 'review-workspace');
extend.after(
  'render',
  function (full = true) {
    updateActivePage();
    refreshEmptyCanvas();
  },
  'review-workspace',
);
extend.after(
  'updateStatus',
  function () {
    updateActivePage();
  },
  'review-workspace',
);
function activateBlankDocument(): void {
  const empty = M.create();
  empty.title = { es: 'Mi libro', en: 'My book', pt: 'Meu livro' }[LibroI18n.language];
  empty.chapter = '';
  empty.pages = [M.page(), M.page()];
  empty.grid.cols = 1;
  empty.grid.rows = 1;
  book = empty;
  active = spread = 0;
  selected = null;
  multiSelection.clear();
  dirty = false;
  hasDocument = false;
  syncNative();
  refreshEmptyCanvas();
  render(true);
}
globalThis.activateBlankDocument = activateBlankDocument;
// The example is loaded only through its explicit welcome action.
(async () => {
  for (let n = 0; n < 100 && !native; n++) await new Promise((r) => setTimeout(r, 100));
  if (native) {
    const info = await nativeCall('appInfo');
    if (info.selftest) {
      hasDocument = true;
      refreshEmptyCanvas();
    } else if (!hasDocument) activateBlankDocument();
  }
})();
