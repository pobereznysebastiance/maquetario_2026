// Notas al pie en la página: dibuja las llamadas en el texto y las notas al pie de la caja
// tipográfica, y atiende lo que pasa mientras se escribe (atajo, copiar y cortar, limpieza al
// terminar). El modelo y las acciones están en footnote-model.ts; los paneles, en
// components/inspector/FootnotePanels.tsx.
//
// Las notas de una página son las que llaman sus cajas de texto, en orden de lectura. Van en un
// bloque (.footnotes) apoyado en el margen inferior, con el ancho de la caja tipográfica; las cajas
// de texto que se le superponen se achican en el dibujo (no cambia o.h), y lo que deja de entrar
// queda como texto sobrante, que marca la revisión de siempre. Un libro sin notas se dibuja igual
// que antes: este módulo no toca nada.
//
// Carga después de paragraphs.ts (dibuja sobre sus párrafos) y de hyphenation-controls.ts (al
// empezar a editar, ése vuelve a poner el texto de los párrafos: acá se decora de nuevo).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import {
  bookNotes,
  decorateNotes,
  footnoteSettings,
  hasFootnotes,
  insertFootnote,
  noteKeysIn,
  noteNumbers,
  pruneDetachedNotes,
  readingOrder,
  withNoteSource,
} from './footnote-model.ts';
import { M, editor } from './core-api.ts';
import type { BookObject } from './model.ts';

/** Contenedor fuera de la vista donde se mide el alto del bloque de notas. */
let measureHost: HTMLElement | null = null;
function measuredHeight(block: HTMLElement): number {
  if (!measureHost?.isConnected) {
    measureHost = document.createElement('div');
    measureHost.className = 'footnote-measure';
    measureHost.setAttribute('aria-hidden', 'true');
    document.body.append(measureHost);
  }
  measureHost.append(block);
  const height = block.getBoundingClientRect().height;
  block.remove();
  return height;
}

/** El bloque de notas de la página index, a px píxeles por milímetro. */
function footnoteBlock(
  keys: string[],
  index: number,
  px: number,
  numbers: Map<string, number>,
): HTMLElement {
  const b = editor.book,
    s = footnoteSettings(b),
    side = M.margins(b, index),
    pt = (value: number) => ((value * 25.4) / 72) * px + 'px',
    block = document.createElement('div');
  block.className = 'footnotes' + (s.numberStyle === 'superscript' ? ' raised-numbers' : '');
  if (s.rule) {
    const rule = document.createElement('div');
    rule.className = 'footnote-rule';
    block.append(rule);
  }
  for (const [name, value] of [
    ['--footnote-left', side.left * px + 'px'],
    ['--footnote-width', (b.width - side.left - side.right) * px + 'px'],
    ['--footnote-bottom', b.margins.bottom * px + 'px'],
    ['--footnote-space', s.space * px + 'px'],
    ['--footnote-size', pt(s.size)],
    ['--footnote-leading', pt(s.leading)],
    ['--footnote-rule', pt(0.5)],
    ['--footnote-font', `"${s.font.replace(/"/g, '')}"`],
  ])
    block.style.setProperty(name!, value!);
  for (const key of keys) {
    const note = document.createElement('div'),
      number = document.createElement('span');
    note.className = 'footnote';
    note.dataset.note = key;
    number.className = 'footnote-number';
    number.textContent = String(numbers.get(key) ?? '');
    note.append(number, s.notes[key] || ' ');
    block.append(note);
  }
  return block;
}

extend.result(
  'paper',
  function (page: HTMLElement, index: number, px: number) {
    const b = editor.book;
    if (!hasFootnotes(b) || !b.pages[index]) return page;
    const notes = bookNotes(b)!,
      keys: string[] = [],
      boxes: { o: BookObject; el: HTMLElement }[] = [];
    let numbers: Map<string, number> | undefined;
    for (const o of readingOrder(b.pages[index])) {
      const el = page.querySelector<HTMLElement>(`[data-id="${o.id}"]`),
        content = el?.querySelector<HTMLElement>('.text-content');
      if (!el || !content) continue;
      boxes.push({ o, el });
      const called = noteKeysIn(o.text, notes);
      if (!called.length) continue;
      numbers ??= noteNumbers();
      decorateNotes(content, numbers);
      for (const key of called) if (!keys.includes(key)) keys.push(key);
    }
    if (!keys.length) return page;
    const block = footnoteBlock(keys, index, px, numbers!),
      height = measuredHeight(block) / px,
      top = b.height - b.margins.bottom - height,
      side = M.margins(b, index);
    page.append(block);
    // Las cajas que bajan hasta las notas terminan donde empiezan (sólo en el dibujo).
    for (const { o, el } of boxes)
      if (o.y < top && o.y + o.h > top && o.x < b.width - side.right && o.x + o.w > side.left)
        el.style.height = Math.max(1, top - o.y) * px + 'px';
    return page;
  },
  'footnotes',
);

// Al empezar a editar, hyphenation-controls.ts vuelve a poner el texto de los párrafos: las
// llamadas se dibujan otra vez.
extend.after(
  'startEditing',
  function (element: HTMLElement) {
    if (editor.editing !== element) return;
    const content = element.querySelector<HTMLElement>('.text-content');
    if (content) decorateNotes(content);
  },
  'footnotes',
);

// Al terminar de editar se olvidan las notas que se quedaron sin llamada (el texto ya está al día:
// paragraphs.ts lo pasa a o.text con cada "input").
extend.before(
  'finishEditing',
  () => {
    if (editor.editing) pruneDetachedNotes();
  },
  'footnotes',
);

// Ctrl+Alt+F (⌘⌥F) mientras se escribe: nota al pie donde está el cursor.
document.addEventListener(
  'keydown',
  (e) => {
    if (!editor.editing || !e.altKey || !(e.ctrlKey || e.metaKey) || e.code !== 'KeyF') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    insertFootnote();
  },
  true,
);

// Copiar o cortar texto con llamadas: al portapapeles van las marcas, no los números (al pegar,
// paragraphs.ts las adopta con adoptPastedNotes).
for (const type of ['copy', 'cut'] as const)
  document.addEventListener(type, (e) => {
    const content = editor.editing?.querySelector<HTMLElement>('.text-content'),
      selection = getSelection();
    if (!content || !selection?.rangeCount || !content.contains(selection.anchorNode)) return;
    if (!selection.getRangeAt(0).cloneContents().querySelector('.note-ref')) return;
    e.preventDefault();
    e.clipboardData?.setData(
      'text/plain',
      withNoteSource(content, () => selection.toString()),
    );
    if (type === 'cut') document.execCommand('delete');
  });

export {};
