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

import type { BookObject } from './model.ts';

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
  $('#export').disabled =
    $('#printButton').disabled =
    $('#preview').disabled =
      !hasDocument || busy;
  emptyCanvas.innerHTML = `<div>${icon('pages')}<h2>${w.emptyTitle}</h2><p>${w.emptyBody}</p><button id="emptyNew" class="btn primary">${w.create}</button><button id="emptyOpen" class="btn">${w.open}</button></div>`;
  $('#emptyNew').onclick = () => settings(true);
  $('#emptyOpen').onclick = openBook;
}
globalThis.refreshEmptyCanvas = refreshEmptyCanvas;
extend.after(
  'hideWelcome',
  function () {
    refreshEmptyCanvas();
  },
  'review-workspace',
);
window.hideWelcome = hideWelcome;
// Al crear un libro (o aplicar el formato), ya hay documento.
extend(
  'applyBookSettings',
  (applyBeforeBlank) =>
    function (isNew: boolean, values: unknown) {
      const previous = book;
      const applied = applyBeforeBlank(isNew, values);
      if (book !== previous || (!isNew && applied)) {
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
extend(
  'startTutorial',
  (tutorialBeforeBlank) =>
    function (index?: number) {
      if (!hasDocument) {
        hideWelcome();
        // Cuando se cierra la Hoja de libro nuevo: si se creó el libro, sigue el tutorial.
        void Promise.resolve(settings(true)).then(() => {
          if (hasDocument) tutorialBeforeBlank(index);
        });
        return;
      }
      tutorialBeforeBlank(index);
    },
  'review-workspace',
);
window.startTutorial = startTutorial;
extend(
  'outputPreview',
  (oldOutputPreview) =>
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
        sheet.style.transformOrigin = 'top left';
        sheet.style.position = 'absolute';
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
        controls.innerHTML = `<button type="button" id="reviewFirst" aria-label="${w.first}" ${reviewFace === 0 ? 'disabled' : ''}>|‹</button><button type="button" id="reviewPrev" aria-label="${w.previous}" ${reviewFace === 0 ? 'disabled' : ''}>‹</button><label>${w.face} <input id="reviewFaceInput" type="number" min="1" max="${sheets.length}" value="${reviewFace + 1}"> ${w.of} ${sheets.length}</label><button type="button" id="reviewNext" aria-label="${w.next}" ${reviewFace === sheets.length - 1 ? 'disabled' : ''}>›</button><button type="button" id="reviewLast" aria-label="${w.last}" ${reviewFace === sheets.length - 1 ? 'disabled' : ''}>›|</button>`;
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
extend(
  'objectDown',
  (objectBeforeMulti) =>
    function (e: MouseEvent, o: BookObject, index: number, el: HTMLElement, resize = false) {
      if (e.shiftKey && !resize && !editing && !o.locked && !o.hidden) {
        e.stopPropagation();
        e.preventDefault();
        if (active !== index) multiSelection.clear();
        active = index;
        if (multiSelection.size === 0 && selected && selected !== o.id)
          multiSelection.add(selected);
        multiSelection.has(o.id) ? multiSelection.delete(o.id) : multiSelection.add(o.id);
        selected = o.id;
        render(false);
        return;
      }
      if (!resize && !multiSelection.has(o.id)) multiSelection.clear();
      objectBeforeMulti(e, o, index, el, resize);
      updateActivePage();
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
decorateInspector(() => {
  const w = rw();
  if (tab === 'pages') {
    let banner = document.createElement('div');
    banner.className = 'active-page-notice';
    banner.innerHTML = `<strong>${w.active} ${active + 1} · ${active % 2 === 0 ? w.left : w.right}</strong><span>${w.selected}</span>`;
    $('#inspectorContent').prepend(banner);
  }
  if (tab === 'text' || tab === 'layers') {
    const block = document.createElement('section');
    block.className = 'section';
    block.innerHTML = `<div class="section-heading">${icon('frame')} ${w.alignObjects}</div><div class="field-row"><label>${w.relative}</label><select id="alignReference"><option value="margins">${w.margins}</option><option value="page">${w.page}</option><option value="selection">${w.selection}</option></select></div><div class="object-alignment">${[
      ['left', w.xLeft],
      ['hcenter', w.xCenter],
      ['right', w.xRight],
      ['top', w.yTop],
      ['vcenter', w.yCenter],
      ['bottom', w.yBottom],
    ]
      .map(
        ([axis, label]) =>
          `<button data-object-align="${axis}" ${!selectObject() ? 'disabled' : ''}>${label}</button>`,
      )
      .join('')}</div><p class="help">${w.tip}</p>`;
    $('#inspectorContent').append(block);
    $('#alignReference').value = objectAlignReference;
    $('#alignReference').onchange = (e: Event) =>
      (objectAlignReference = (e.target as HTMLSelectElement).value);
    block
      .querySelectorAll<HTMLElement>('[data-object-align]')
      .forEach((b) => (b.onclick = () => alignSelection(b.dataset.objectAlign!)));
  }
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
