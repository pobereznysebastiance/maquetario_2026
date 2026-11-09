// Notas al pie: las llamadas en el texto, la numeración, el formato y las acciones (insertar,
// escribir, quitar). No tiene efectos al cargar: se importa. El dibujo y los oyentes están en
// footnotes.ts; los paneles, en components/inspector/FootnotePanels.tsx.
//
// La llamada es un carácter de uso privado (U+E000…U+F8FF) dentro de o.text, uno por nota; el
// contenido va en book.footnotes.notes con la clave del código en hexadecimal ('e000'). Un
// carácter de uso privado que no está en notes es un glifo común (los ornamentos de algunas
// fuentes viven ahí) y no se toca.
//
// En la página, cada llamada se dibuja como
//   <span class="note-ref" contenteditable="false" data-note="e000">
//     <span class="note-mark"></span><span class="note-number">3</span>
//   </span>
// La marca queda oculta y se ve el número; para leer el texto de la caja (editableText) se invierte
// por un momento (.note-source), así innerText devuelve la marca y no el número. El número es texto
// de verdad (no un ::after), para que salga en los dos PDF.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { Book, BookObject, FootnoteSettings, Page } from './model.ts';
import { bw } from './i18n/language.ts';
import { editor } from './core-api.ts';

const MARKS = /[\uE000-\uF8FF]/g,
  MARK = /[\uE000-\uF8FF]/;
const FIRST = 0xe000,
  LAST = 0xf8ff;

export const FOOTNOTE_DEFAULTS: Omit<FootnoteSettings, 'notes'> = {
  font: 'Georgia',
  size: 8,
  leading: 10,
  space: 4,
  rule: true,
  restart: 'book',
};

/** Clave de una marca ('e000'). */
export const keyOf = (mark: string): string => mark.charCodeAt(0).toString(16);
/** La marca de una clave. */
export const markOf = (key: string): string => String.fromCharCode(parseInt(key, 16));

/** Las notas del libro (null si nunca tuvo). */
export const bookNotes = (b: Book = editor.book): Record<string, string> | null =>
  b.footnotes?.notes ?? null;

/** El libro tiene al menos una nota. */
export const hasFootnotes = (b: Book = editor.book): boolean =>
  !!b.footnotes && Object.keys(b.footnotes.notes).length > 0;

/** Formato de las notas, con los valores por defecto donde falte. */
export const footnoteSettings = (b: Book = editor.book): FootnoteSettings => ({
  ...FOOTNOTE_DEFAULTS,
  ...(b.footnotes ?? {}),
  notes: b.footnotes?.notes ?? {},
});

/** book.footnotes, creado con los valores por defecto si no existía. Se llama dentro de commit. */
export function ensureFootnotes(): FootnoteSettings {
  const b = editor.book;
  if (!b.footnotes) b.footnotes = { ...FOOTNOTE_DEFAULTS, notes: {} };
  return b.footnotes;
}

/** Las claves de las notas que llama un texto, en orden (una nota llamada dos veces, una vez). */
export function noteKeysIn(text: string, notes = bookNotes()): string[] {
  if (!notes) return [];
  const keys: string[] = [];
  for (const [mark] of text.matchAll(MARKS)) {
    const key = keyOf(mark);
    if (notes[key] !== undefined && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Cajas de texto de una página en orden de lectura: de arriba abajo y de izquierda a derecha. */
export function readingOrder(page: Page): BookObject[] {
  return page.objects
    .filter((o) => o.type === 'text' && !o.toc)
    .sort((a, b) => Math.round(a.y) - Math.round(b.y) || a.x - b.x);
}

/**
 * Número de cada nota: en el orden de lectura (páginas, cajas, texto), y desde 1 en cada sección o
 * página si así lo pide el formato. Recorre el texto de todo el libro: quien dibuja lo pide una vez
 * por página.
 */
export function noteNumbers(): Map<string, number> {
  const b = editor.book,
    notes = bookNotes(b),
    restart = b.footnotes?.restart,
    map = new Map<string, number>();
  if (notes) {
    let n = 0;
    b.pages.forEach((page, index) => {
      if (restart === 'page' || (restart === 'section' && index > 0 && page.section)) n = 0;
      for (const o of readingOrder(page))
        if (MARK.test(o.text))
          for (const key of noteKeysIn(o.text, notes)) if (!map.has(key)) map.set(key, ++n);
    });
  }
  return map;
}

/** Las marcas de uso privado que aparecen en los textos del libro (sean notas o no). */
function marksInBook(): Set<string> {
  const used = new Set<string>();
  for (const page of editor.book.pages)
    for (const o of page.objects)
      if (o.type === 'text') for (const [mark] of o.text.matchAll(MARKS)) used.add(keyOf(mark));
  return used;
}

/**
 * Notas que se quedaron sin llamada (se borró la marca) en esta sesión: si la marca vuelve con un
 * pegado (cortar y pegar en otra caja), la nota vuelve con ella.
 */
const detached = new Map<string, string>();

/** Una clave libre: ni nota, ni marca en algún texto, ni nota recién quitada. */
export function newNoteKey(): string {
  const used = marksInBook();
  for (const key of Object.keys(bookNotes() ?? {})) used.add(key);
  for (let code = FIRST; code <= LAST; code++) {
    const key = code.toString(16);
    if (!used.has(key) && !detached.has(key)) return key;
  }
  throw Error(
    bw(
      'El libro ya tiene el máximo de notas al pie.',
      'The book already has the maximum number of footnotes.',
      'O livro já tem o máximo de notas de rodapé.',
    ),
  );
}

/** Quita las notas cuya marca ya no está en ningún texto (al terminar de editar). */
export function pruneDetachedNotes(): void {
  const notes = bookNotes();
  if (!notes) return;
  const present = marksInBook();
  for (const key of Object.keys(notes))
    if (!present.has(key)) {
      detached.set(key, notes[key]!);
      delete notes[key];
    }
}

/**
 * El texto que se pega, con sus notas: una marca de una nota que ya está en el libro (copiar)
 * pasa a ser una nota nueva con el mismo texto; una marca de una nota que se cortó vuelve a ser
 * esa nota. Las demás marcas de uso privado son glifos y quedan como están.
 */
export function adoptPastedNotes(text: string): string {
  if (!/[\uE000-\uF8FF]/.test(text)) return text;
  const present = marksInBook();
  return text.replace(MARKS, (mark) => {
    const key = keyOf(mark),
      body = bookNotes()?.[key] ?? detached.get(key);
    if (body === undefined) return mark;
    if (!present.has(key)) {
      ensureFootnotes().notes[key] = body;
      detached.delete(key);
      present.add(key);
      return mark;
    }
    const fresh = newNoteKey();
    ensureFootnotes().notes[fresh] = body;
    present.add(fresh);
    return markOf(fresh);
  });
}

// ── Acciones (las usan el panel de Selección y el atajo) ──

/**
 * Inserta una nota en la caja elegida: donde está el cursor si se está escribiendo en ella, si no
 * al final del párrafo elegido (o del último). Termina la edición y lleva al texto de la nota.
 */
export function insertFootnote(): void {
  const o = selectObject();
  if (!o || o.type !== 'text' || o.toc || o.locked) return;
  let key: string;
  try {
    key = newNoteKey();
  } catch (error) {
    toast((error as Error).message, 'warning');
    return;
  }
  const mark = markOf(key),
    content =
      editor.editing?.dataset.id === o.id
        ? editor.editing.querySelector<HTMLElement>('.text-content')
        : null,
    selection = getSelection();
  if (content && selection?.rangeCount && content.contains(selection.focusNode)) {
    // La edición ya guardó cómo estaba el libro (deshacer vuelve a antes de editar).
    ensureFootnotes().notes[key] = '';
    selection.collapseToEnd();
    // Dispara el "input" de la caja: paragraphs.ts pasa el texto a o.text.
    document.execCommand('insertText', false, mark);
    finishEditing();
    render(false);
  } else {
    const lines = o.text.split('\n'),
      scope = editor.paragraphScope,
      index =
        scope.id === o.id && scope.index >= 0
          ? Math.min(scope.index, lines.length - 1)
          : lines.length - 1;
    finishEditing();
    commit(() => {
      lines[index] = lines[index]!.trimEnd() + mark;
      o.text = lines.join('\n');
      ensureFootnotes().notes[key] = '';
    }, false);
  }
  requestAnimationFrame(() =>
    document.querySelector<HTMLTextAreaElement>(`[data-footnote-text="${key}"]`)?.focus(),
  );
}

/** Escribe el texto de una nota. */
export function setFootnoteText(key: string, text: string): void {
  if (bookNotes()?.[key] === undefined || bookNotes()![key] === text) return;
  commit(() => (ensureFootnotes().notes[key] = text.slice(0, 20000)), false);
}

/** Quita una nota: su texto y su llamada. */
export function removeFootnote(key: string): void {
  const mark = markOf(key);
  commit(() => {
    for (const page of editor.book.pages)
      for (const o of page.objects)
        if (o.type === 'text' && o.text.includes(mark)) o.text = o.text.split(mark).join('');
    delete ensureFootnotes().notes[key];
  }, false);
}

/** Cambia una opción del formato de las notas (Libro → Notas al pie). */
export function setFootnoteSetting<K extends keyof typeof FOOTNOTE_DEFAULTS>(
  key: K,
  value: FootnoteSettings[K],
): void {
  commit(() => (ensureFootnotes()[key] = value), false);
}

// ── En la página ──

/** La llamada dibujada de una nota. */
function noteRef(key: string, number: number | undefined): HTMLElement {
  const ref = document.createElement('span'),
    mark = document.createElement('span'),
    shown = document.createElement('span');
  ref.className = 'note-ref';
  ref.contentEditable = 'false';
  ref.dataset.note = key;
  mark.className = 'note-mark';
  mark.textContent = markOf(key);
  shown.className = 'note-number';
  shown.textContent = String(number ?? '');
  ref.append(mark, shown);
  return ref;
}

/** Cambia las marcas de nota de root (texto suelto) por su llamada dibujada. Devuelve cuántas. */
export function decorateNotes(root: HTMLElement, numbers?: Map<string, number>): number {
  const notes = bookNotes();
  if (!notes) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
    found: Text[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null)
    if (!node.parentElement?.closest('.note-ref') && /[\uE000-\uF8FF]/.test(node.data))
      found.push(node);
  let count = 0;
  if (found.length) numbers ??= noteNumbers();
  for (const node of found) {
    let rest: Text = node;
    for (let i = 0; i < rest.data.length; i++) {
      const key = keyOf(rest.data[i]!);
      if (!/[\uE000-\uF8FF]/.test(rest.data[i]!) || notes[key] === undefined) continue;
      const after = rest.splitText(i);
      after.data = after.data.slice(1);
      after.before(noteRef(key, numbers!.get(key)));
      count++;
      rest = after;
      i = -1;
    }
  }
  return count;
}

/** Corre fn con las marcas a la vista y los números ocultos (lo que se lee es el texto real). */
export function withNoteSource<T>(content: HTMLElement, fn: () => T): T {
  if (!content.querySelector('.note-ref')) return fn();
  content.classList.add('note-source');
  try {
    return fn();
  } finally {
    content.classList.remove('note-source');
  }
}

/** El texto de la caja en edición, con las marcas de nota y sin los números. */
export const editableText = (content: HTMLElement): string =>
  withNoteSource(content, () => content.innerText);

/** Cantidad de caracteres de root antes de (node, offset), sin contar los números de nota. */
function caretOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  const fragment = range.cloneContents();
  fragment.querySelectorAll('.note-number').forEach((n) => n.remove());
  return fragment.textContent!.length;
}

/** Decora las marcas de la caja en edición sin mover el cursor (después de pegar). */
export function decorateKeepingCaret(content: HTMLElement): void {
  const selection = getSelection();
  const at =
    selection?.rangeCount && selection.focusNode && content.contains(selection.focusNode)
      ? caretOffset(content, selection.focusNode, selection.focusOffset)
      : -1;
  if (!decorateNotes(content) || at < 0) return;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (node.parentElement?.closest('.note-number')) continue;
    if (seen + node.data.length < at) {
      seen += node.data.length;
      continue;
    }
    const range = document.createRange(),
      ref = node.parentElement?.closest('.note-ref');
    if (ref) range.setStartAfter(ref);
    else range.setStart(node, at - seen);
    range.collapse(true);
    selection!.removeAllRanges();
    selection!.addRange(range);
    return;
  }
}
