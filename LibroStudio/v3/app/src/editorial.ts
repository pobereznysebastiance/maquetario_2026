// Editorial: el índice del libro (tabla de contenidos dibujada en el papel y en el PDF; su vista
// del riel es components/rail/IndexView.tsx), los
// controles extra de texto (tracking, sangría, espacio entre párrafos, glifos) y las guías
// individuales del libro. Agrega el botón Índice a la barra de herramientas.
//
// ensureToc es global porque la usa tests/editorial-tests.js; prepareIndexPrint, porque la
// llama la autoprueba (desktop/src/main/selftest.ts).
//
// La envoltura de inspector (extend.around) tiene que registrarse después de la de
// inspector-registry, para quedar por fuera: index.html carga este archivo justo después.
//
// Fuente TypeScript: se compila a build/editorial.js (desktop/scripts/build.mjs).
'use strict';
import type { BookObject, TocConfig } from './model.ts';
import { guideForm } from './components/guide/GuideForm.tsx';
import { tocEntryForm } from './components/toc-entry/TocEntryForm.tsx';
import { registerRailView } from './components/rail/rail-views.ts';
import { indexViewFor } from './components/rail/IndexView.tsx';
import { i18n } from './i18n/language.ts';
import { M } from './core-api.ts';

declare global {
  /** Configuración del índice del libro; la crea con los valores por defecto si no existe. */
  var ensureToc: () => TocConfig;
  /** Prepara la impresión de prueba con un índice en la tercera página (autoprueba). */
  var prepareIndexPrint: () => void;
}

function ensureToc(): TocConfig {
  if (!book.toc) book.toc = M.clone(M.tocConfig(book));
  return book.toc;
}
globalThis.ensureToc = ensureToc;
/** Coloca el índice en la página activa (o elige el que ya está). */
function insertToc(): void {
  commit(() => {
    let existing = book.pages[active].objects.find((o) => o.toc);
    if (existing) {
      selected = existing.id;
      return;
    }
    let m = M.margins(book, active),
      o = M.text(
        '',
        m.left,
        book.margins.top,
        book.width - m.left - m.right,
        book.height - book.margins.top - book.margins.bottom,
        12,
      );
    o.toc = true;
    book.pages[active].objects.push(o);
    selected = o.id;
  }, true);
}
/** "Agregar entrada manual": su formulario en una Hoja. */
function addTocEntry(): void {
  modal.sheet(
    'Nueva entrada del índice',
    tocEntryForm(),
    () => {
      const label = $('#entryLabel').value.trim().slice(0, 500),
        pageId = $('#entryPage').value;
      if (!label) throw Error(i18n.tr('Escribí el texto de la entrada.'));
      commit(() => ensureToc().entries.push({ id: M.uid(), label, pageId }), false);
    },
    'Agregar entrada',
    { size: 'sm' },
  );
}
// La vista Índice del riel es un componente de React (components/rail/IndexView.tsx).
registerRailView('index', indexViewFor({ ensureToc, insertToc, addEntry: addTocEntry }));
function renderToc(el: HTMLElement, o: BookObject, px: number): void {
  const content = el.querySelector('.text-content');
  if (!content) return;
  content.replaceChildren();
  const title = document.createElement('div');
  title.className = 'toc-title user-content';
  title.textContent = M.tocConfig(book).title;
  title.style.marginBottom = ((o.leading * 25.4) / 72) * px + 'px';
  title.style.fontWeight = 'bold';
  content.append(title);
  for (const entry of M.tocEntries(book)) {
    const row = document.createElement('div');
    row.className = 'toc-paper-row';
    const label = document.createElement('span');
    label.textContent = entry.label;
    const dots = document.createElement('i');
    const folio = document.createElement('span');
    folio.textContent = entry.folio;
    row.append(label, dots, folio);
    content.append(row);
  }
}
// Índice dibujado en el papel; tracking, sangría y espacio entre párrafos de los textos.
extend.result(
  'paper',
  (page: HTMLElement, i: number, px: number) => {
    for (const o of book.pages[i].objects) {
      const el = page.querySelector<HTMLElement>(`[data-id="${o.id}"]`)!;
      if (o.toc) renderToc(el, o, px);
      if (o.type === 'text' && !o.toc) {
        const content = el.querySelector<HTMLElement>('.text-content')!;
        content.style.letterSpacing =
          ((((o.tracking || 0) / 1000) * o.size * 25.4) / 72) * px + 'px';
        if (o.spaceAfter) {
          content.replaceChildren();
          for (const line of o.text.split('\n')) {
            const p = document.createElement('div');
            p.textContent = line || ' ';
            p.style.marginBottom = o.spaceAfter * px + 'px';
            p.style.textIndent = (o.indent || 0) * px + 'px';
            content.append(p);
          }
        } else content.style.textIndent = (o.indent || 0) * px + 'px';
      }
    }
    return page;
  },
  'editorial',
);
// El índice no se edita en el papel: abre su pestaña (también con doble clic en el lienzo).
extend.instead(
  'startEditing',
  () => !!selectObject()?.toc,
  () => {
    showTab('index');
  },
  'editorial',
);
/** "Agregar guía": la Hoja con orientación y posición (la abre el panel de Grilla). */
export function openGuideDialog(): void {
  modal.sheet(
    'Nueva guía',
    guideForm(),
    () => {
      const axis = $('#guideAxis').value,
        n = Number($('#guidePosition').value);
      if (!Number.isFinite(n) || n < 0 || n > (axis === 'v' ? book.width : book.height))
        throw Error(i18n.tr('La guía debe estar dentro de la página.'));
      commit(() => {
        if (!book.guides) book.guides = [];
        book.guides.push({ axis, position: n });
      }, false);
    },
    'Agregar guía',
    { size: 'sm' },
  );
}
/** Guía propia del libro: vertical (v) u horizontal (h), a position mm del borde. */
export interface BookGuide {
  axis: 'v' | 'h';
  position: number;
}
// Guías propias del libro, sobre la grilla: las dibuja el lienzo (components/canvas/CanvasGuides.tsx).
registerTool({
  id: 'indexTool',
  icon: 'index',
  label: () => i18n.tr('Índice'),
  shortcut: null,
  onSelect: () => {
    finishEditing();
    showTab('index');
  },
});
globalThis.prepareIndexPrint = function () {
  const original = M.clone(book),
    o = M.text('', 20, 20, book.width - 40, book.height - 40);
  o.toc = true;
  book.pages[Math.min(2, book.pages.length - 1)].objects.push(o);
  preparePrint();
  book = original;
};
render(true);
