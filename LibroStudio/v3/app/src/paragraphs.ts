// Párrafos: formato por párrafo dentro de una caja de texto (base del objeto + estilo de párrafo
// + ajustes locales), estilos de párrafo del libro, panel "Párrafo y estilos" del inspector y
// dibujo de cada párrafo en la página (con separación silábica de hyphenation-controls).
//
// Globales (los usan archivos de src/, el JS, tests/review-tests.js y book-workflow.js):
// pw, paragraphKeys, paragraphFormat, paragraphMeta, paragraphPatch, applyParagraphStyle,
// currentParagraph y syncParagraphMap. paragraphScope y paragraphOperation viven en globalThis
// porque otros archivos los asignan.
//
// Fuente TypeScript: se compila a build/paragraphs.js (desktop/scripts/build.mjs).
'use strict';
import type { Book, BookObject } from './model.ts';
import { paragraphStyleForm } from './components/paragraph-style/ParagraphStyleForm.tsx';

/** Formato de un párrafo: font, size, leading, align, sangrías, espacios… (ver paragraphKeys). */
export type ParagraphFormat = Record<string, any>;

/** Párrafo de una caja (o.paragraphMap[i]): estilo vinculado y ajustes locales. */
export interface ParagraphMeta {
  styleId: string | null;
  overrides: ParagraphFormat;
}

/** Estilo de párrafo del libro (book.paragraphStyles). */
export interface ParagraphStyle {
  id: string;
  name: string;
  properties: ParagraphFormat;
}

/** Instancia con nombre de una fuente variable (fonts.js). */
type FontInstance = { name: string; [extra: string]: any };

/** Eje de una fuente variable, como lo muestra el panel. */
interface FontAxis {
  tag: string;
  name?: string;
  normal: number;
  min: number;
  max: number;
}

/** Cara del catálogo de fuentes, con lo que usa este archivo (fonts.js: NativeFontFace). */
interface CatalogFace {
  id: string;
  family: string;
  style: string;
  weight: number;
  italic: boolean;
  axes: FontAxis[];
  instances: FontInstance[];
  [extra: string]: any;
}

declare global {
  /** Palabras del panel de párrafos en el idioma actual (l, r, c, j: alineaciones). */
  var pw: () => ParagraphWords;
  /** Propiedades que puede tener un párrafo (las que se copian del objeto y del estilo). */
  var paragraphKeys: string[];
  /** Párrafo elegido en el inspector (index -1: todo el cuadro). */
  var paragraphScope: { id: string | null; index: number };
  /** Mientras es true, commit no copia los cambios del objeto a los párrafos. */
  var paragraphOperation: boolean;
  /** Formato efectivo de un párrafo: base del objeto + estilo + ajustes locales. */
  var paragraphFormat: (b: Book, o: BookObject, index: number) => ParagraphFormat;
  /** Datos del párrafo index (los crea si no existen). */
  var paragraphMeta: (o: BookObject, index: number) => ParagraphMeta;
  /** Ajustes locales sobre los párrafos elegidos de la caja seleccionada. */
  var paragraphPatch: (values: ParagraphFormat) => void;
  /** Vincula los párrafos elegidos a un estilo; null los desvincula conservando el formato. */
  var applyParagraphStyle: (id: string | null) => void;
  /** Párrafo elegido en el inspector, o 0. */
  var currentParagraph: (o: BookObject) => number;
  /** Mantiene los estilos de los párrafos que no cambiaron al editar el texto. */
  var syncParagraphMap: (
    oldText: string,
    newText: string,
    map: ParagraphMeta[] | undefined,
  ) => ParagraphMeta[];
}

const paragraphWords = {
  es: {
    panel: 'Párrafo y estilos',
    scope: 'Aplicar a',
    all: 'Todos los párrafos de la caja',
    paragraph: 'Párrafo',
    style: 'Estilo de párrafo',
    none: 'Sin estilo',
    mixed: 'Estilos mixtos',
    new: 'Nuevo desde selección',
    edit: 'Editar estilo',
    redefine: 'Redefinir desde selección',
    detach: 'Desvincular conservando formato',
    before: 'Espacio anterior',
    after: 'Espacio posterior',
    left: 'Sangría izquierda',
    right: 'Sangría derecha',
    first: 'Primera línea',
    last: 'Última línea justificada',
    auto: 'Automática',
    l: 'Izquierda',
    c: 'Centrada',
    r: 'Derecha',
    j: 'Justificada',
    name: 'Nombre del estilo',
    size: 'Cuerpo · pt',
    leading: 'Interlineado · pt',
    font: 'Familia tipográfica',
    editTitle: 'Definir estilo de párrafo',
    createTitle: 'Crear estilo de párrafo',
    hint: 'Elegí un párrafo o aplicá a toda la caja. Los cambios de un estilo actualizan todos los párrafos vinculados del libro.',
    empty: 'Seleccioná una caja de texto para trabajar con sus párrafos.',
    reset: 'Quitar ajustes locales',
    styleExists: 'Ya existe un estilo con ese nombre.',
    styleRequired: 'Escribí un nombre para el estilo.',
    base: 'Texto base',
  },
  en: {
    panel: 'Paragraphs and styles',
    scope: 'Apply to',
    all: 'All paragraphs in the frame',
    paragraph: 'Paragraph',
    style: 'Paragraph style',
    none: 'No style',
    mixed: 'Mixed styles',
    new: 'New from selection',
    edit: 'Edit style',
    redefine: 'Redefine from selection',
    detach: 'Unlink and keep formatting',
    before: 'Space before',
    after: 'Space after',
    left: 'Left indent',
    right: 'Right indent',
    first: 'First line',
    last: 'Last justified line',
    auto: 'Automatic',
    l: 'Left',
    c: 'Centered',
    r: 'Right',
    j: 'Justified',
    name: 'Style name',
    size: 'Font size · pt',
    leading: 'Leading · pt',
    font: 'Font family',
    editTitle: 'Define paragraph style',
    createTitle: 'Create paragraph style',
    hint: 'Choose a paragraph or apply to the entire frame. Editing a style updates all linked paragraphs in the book.',
    empty: 'Select a text frame to work with its paragraphs.',
    reset: 'Clear local overrides',
    styleExists: 'A style with this name already exists.',
    styleRequired: 'Enter a style name.',
    base: 'Body text',
  },
  pt: {
    panel: 'Parágrafos e estilos',
    scope: 'Aplicar a',
    all: 'Todos os parágrafos da caixa',
    paragraph: 'Parágrafo',
    style: 'Estilo de parágrafo',
    none: 'Sem estilo',
    mixed: 'Estilos mistos',
    new: 'Novo a partir da seleção',
    edit: 'Editar estilo',
    redefine: 'Redefinir a partir da seleção',
    detach: 'Desvincular mantendo formato',
    before: 'Espaço anterior',
    after: 'Espaço posterior',
    left: 'Recuo esquerdo',
    right: 'Recuo direito',
    first: 'Primeira linha',
    last: 'Última linha justificada',
    auto: 'Automática',
    l: 'Esquerda',
    c: 'Centralizado',
    r: 'Direita',
    j: 'Justificado',
    name: 'Nome do estilo',
    size: 'Corpo · pt',
    leading: 'Entrelinha · pt',
    font: 'Família tipográfica',
    editTitle: 'Definir estilo de parágrafo',
    createTitle: 'Criar estilo de parágrafo',
    hint: 'Escolha um parágrafo ou aplique à caixa inteira. Alterar um estilo atualiza todos os parágrafos vinculados do livro.',
    empty: 'Selecione uma caixa de texto para trabalhar com seus parágrafos.',
    reset: 'Limpar ajustes locais',
    styleExists: 'Já existe um estilo com esse nome.',
    styleRequired: 'Informe um nome para o estilo.',
    base: 'Texto base',
  },
};
export type ParagraphWords = (typeof paragraphWords)['es'];
const pw = (): ParagraphWords => paragraphWords[LibroI18n.language || 'es'];
globalThis.pw = pw;
const paragraphKeys: string[] = [
  'font',
  'fontFaceId',
  'fontStyleName',
  'fontWeight',
  'fontItalic',
  'fontAxes',
  'size',
  'leading',
  'align',
  'lastAlign',
  'hyphenate',
  'hyphenLanguage',
  'color',
  'bold',
  'italic',
  'tracking',
  'indentLeft',
  'indentRight',
  'firstIndent',
  'spaceBefore',
  'spaceAfter',
];
globalThis.paragraphKeys = paragraphKeys;
globalThis.paragraphScope = { id: null, index: -1 };
globalThis.paragraphOperation = false;
/** Último cambio de un control del inspector sobre la caja (lo aplica el próximo commit). */
let directParagraphChange: {
  id: string;
  key: string;
  value: string | number;
  time: number;
} | null = null;
function paragraphBase(o: BookObject): ParagraphFormat {
  return {
    font: o.font,
    size: o.size,
    leading: o.leading,
    align: o.align || 'left',
    color: o.color || '#202125',
    bold: !!o.bold,
    italic: !!o.italic,
    tracking: o.tracking || 0,
    indentLeft: 0,
    indentRight: 0,
    firstIndent: o.indent || 0,
    spaceBefore: 0,
    spaceAfter: o.spaceAfter || 0,
    ...Object.fromEntries(
      paragraphKeys.filter((k) => o[k] !== undefined).map((k) => [k, M.clone(o[k])]),
    ),
  };
}
function paragraphFormat(b: Book, o: BookObject, index: number): ParagraphFormat {
  const meta = o.paragraphMap?.[index] || {},
    style = (b.paragraphStyles || []).find((s: ParagraphStyle) => s.id === meta.styleId);
  return { ...paragraphBase(o), ...(style?.properties || {}), ...(meta.overrides || {}) };
}
globalThis.paragraphFormat = paragraphFormat;
export function paragraphIndices(o: BookObject): number[] {
  return paragraphScope.id === o.id && paragraphScope.index >= 0
    ? [Math.min(paragraphScope.index, o.text.split('\n').length - 1)]
    : o.text.split('\n').map((_: string, i: number) => i);
}
function paragraphMeta(o: BookObject, index: number): ParagraphMeta {
  if (!o.paragraphMap) o.paragraphMap = [];
  if (!o.paragraphMap[index]) o.paragraphMap[index] = { styleId: null, overrides: {} };
  return o.paragraphMap[index];
}
globalThis.paragraphMeta = paragraphMeta;
function paragraphPatch(values: ParagraphFormat): void {
  const o = selectObject();
  if (!o || o.type !== 'text' || o.toc || o.locked) return;
  paragraphOperation = true;
  try {
    commit(() => {
      for (const index of paragraphIndices(o)) {
        const meta = paragraphMeta(o, index);
        meta.overrides = { ...(meta.overrides || {}), ...M.clone(values) };
      }
    }, false);
  } finally {
    paragraphOperation = false;
  }
}
globalThis.paragraphPatch = paragraphPatch;
extend(
  'commit',
  (paragraphCommit) =>
    function (fn: () => void, full = true) {
      // Si no hay objeto, before es null y el callback sale antes de usar o.
      const o = selectObject() as BookObject,
        before = o?.type === 'text' ? M.clone(o) : null,
        pending = directParagraphChange;
      directParagraphChange = null;
      paragraphCommit(() => {
        fn();
        if (paragraphOperation || !before || !book.pages.some((p) => p.objects.includes(o))) return;
        const values: ParagraphFormat = {};
        for (const key of paragraphKeys) {
          if (JSON.stringify(before[key]) !== JSON.stringify(o[key]) && o[key] !== undefined)
            values[key] = M.clone(o[key]);
        }
        if (before.indent !== o.indent && o.indent !== undefined) values.firstIndent = o.indent;
        if (pending?.id === o.id && Date.now() - pending.time < 2000)
          values[pending.key] = pending.value;
        if (Object.keys(values).length) {
          for (const index of paragraphIndices(o)) {
            const meta = paragraphMeta(o, index);
            meta.overrides = { ...(meta.overrides || {}), ...values };
          }
          if (paragraphScope.id === o.id && paragraphScope.index >= 0) {
            for (const key of Object.keys(values)) {
              if (before[key] === undefined) delete o[key];
              else o[key] = M.clone(before[key]);
            }
            if (before.indent === undefined) delete o.indent;
            else o.indent = before.indent;
          }
        }
      }, full);
    },
  'paragraphs',
);
document.addEventListener(
  'change',
  (e) => {
    // Sólo interesa si el control tiene data-object (paragraphKeys no incluye undefined).
    const key = (e.target as HTMLInputElement).dataset.object as string;
    if (paragraphKeys.includes(key) && selectObject())
      directParagraphChange = {
        id: selectObject()!.id,
        key,
        value:
          (e.target as HTMLInputElement).type === 'number'
            ? Number((e.target as HTMLInputElement).value)
            : (e.target as HTMLInputElement).value,
        time: Date.now(),
      };
  },
  true,
);
function applyParagraphStyle(id: string | null): void {
  const o = selectObject();
  if (!o || o.type !== 'text' || o.locked || o.toc) return;
  paragraphOperation = true;
  try {
    commit(() => {
      for (const i of paragraphIndices(o)) {
        const m = paragraphMeta(o, i);
        if (!id) {
          m.overrides = paragraphFormat(book, o, i);
          m.styleId = null;
        } else {
          m.styleId = id;
          m.overrides = {};
        }
      }
    }, false);
  } finally {
    paragraphOperation = false;
  }
}
globalThis.applyParagraphStyle = applyParagraphStyle;
function currentParagraph(o: BookObject): number {
  return paragraphScope.id === o.id && paragraphScope.index >= 0
    ? Math.min(paragraphScope.index, o.text.split('\n').length - 1)
    : 0;
}
globalThis.currentParagraph = currentParagraph;
export function styleDialog(existing: ParagraphStyle | null | undefined): void {
  const o = selectObject();
  if (!o || o.type !== 'text' || o.locked) return;
  const w = pw(),
    properties = existing
      ? M.clone(existing.properties)
      : paragraphFormat(book, o, currentParagraph(o));
  modal.sheet(
    existing ? w.editTitle : w.createTitle,
    paragraphStyleForm({ existing, properties, words: w }),
    async () => {
      const name = $('#paragraphStyleName').value.trim().slice(0, 100);
      if (!name) throw Error(w.styleRequired);
      if (
        (book.paragraphStyles || []).some(
          (s: ParagraphStyle) =>
            s.name.toLocaleLowerCase() === name.toLocaleLowerCase() && s.id !== existing?.id,
        )
      )
        throw Error(w.styleExists);
      for (const input of $$('#paragraphStyleForm input[type=number]'))
        if (
          !Number.isFinite(Number(input.value)) ||
          Number(input.value) < Number(input.min) ||
          Number(input.value) > Number(input.max)
        )
          throw Error('Valor fuera de rango / Value out of range');
      const font = $('#paragraphStyleFont').value,
        face = chooseDefaultFace(font);
      if (face) await ensureFace(face);
      let props: ParagraphFormat = {
        ...properties,
        font,
        size: Number($('#paragraphStyleSize').value),
        leading: Number($('#paragraphStyleLeading').value),
        align: $('#paragraphStyleAlign').value,
        ...readHyphenationFields('styleHyphen'),
        indentLeft: Number($('#paragraphStyleLeft').value),
        indentRight: Number($('#paragraphStyleRight').value),
        firstIndent: Number($('#paragraphStyleFirst').value),
        spaceBefore: Number($('#paragraphStyleBefore').value),
        spaceAfter: Number($('#paragraphStyleAfter').value),
      };
      if (font !== properties.font) {
        delete props.fontAxes;
        delete props.fontFaceId;
        delete props.fontStyleName;
        if (face)
          Object.assign(props, {
            fontFaceId: face.id,
            fontStyleName: face.style,
            fontWeight: face.weight,
            fontItalic: face.italic,
            fontAxes: variations(face),
          });
      }
      paragraphOperation = true;
      try {
        commit(() => {
          if (!book.paragraphStyles) book.paragraphStyles = [];
          if (existing) {
            existing.name = name;
            existing.properties = props;
          } else {
            const style = { id: M.uid(), name, properties: props };
            book.paragraphStyles.push(style);
            for (const index of paragraphIndices(o)) {
              const m = paragraphMeta(o, index);
              m.styleId = style.id;
              m.overrides = {};
            }
          }
        }, false);
      } finally {
        paragraphOperation = false;
      }
      return true;
    },
    existing ? w.edit : w.new,
  );
}
// "Párrafo y estilos" es un panel de React: src/components/inspector/TextPanels.tsx.
extend(
  'applyFace',
  (faceBeforeParagraphs) =>
    async function (o: BookObject, face: CatalogFace, instance: FontInstance | null) {
      await ensureFace(face);
      if (
        o === selectObject() &&
        o.type === 'text' &&
        paragraphScope.id === o.id &&
        paragraphScope.index >= 0
      ) {
        paragraphPatch({
          font: face.family,
          fontFaceId: face.id,
          fontStyleName: instance?.name || face.style,
          fontAxes: instance ? { ...instance.coordinates } : variations(face),
          fontWeight: instance?.coordinates.wght ?? face.weight,
          fontItalic: face.italic,
          bold: false,
          italic: false,
        });
      } else await faceBeforeParagraphs(o, face, instance);
    },
  'paragraphs',
);
function syncParagraphMap(
  oldText: string,
  newText: string,
  map: ParagraphMeta[] | undefined,
): ParagraphMeta[] {
  const a = oldText.split('\n'),
    b = newText.split('\n'),
    old = map || [],
    out: ParagraphMeta[] = [];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    out[prefix] = M.clone(old[prefix] || { styleId: null, overrides: {} });
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    out[b.length - 1 - suffix] = M.clone(
      old[a.length - 1 - suffix] || { styleId: null, overrides: {} },
    );
    suffix++;
  }
  for (let i = prefix; i < b.length - suffix; i++)
    out[i] = M.clone(
      old[Math.min(prefix, old.length - 1)] ||
        old[Math.max(0, prefix - 1)] || { styleId: null, overrides: {} },
    );
  return out;
}
globalThis.syncParagraphMap = syncParagraphMap;
extend.result(
  'paper',
  function (page: HTMLElement, index: number, px: number, print = false) {
    for (const o of book.pages[index].objects) {
      if (o.type !== 'text' || o.toc) continue;
      const el = page.querySelector(`[data-id="${o.id}"]`),
        content = el?.querySelector<HTMLElement>('.text-content');
      if (!content) continue;
      content.replaceChildren();
      o.text.split('\n').forEach((line: string, i: number) => {
        const f = paragraphFormat(book, o, i),
          face = selectedFace(f) as CatalogFace | undefined,
          p = document.createElement('div');
        p.className = 'mqt-paragraph';
        // dataset convierte el número en texto (igual que antes).
        p.dataset.paragraphIndex = i as unknown as string;
        setHyphenatedText(p, line, f);
        Object.assign(p.style, {
          fontFamily:
            face && !fontLoadErrors.has(face.id) ? `"MQT_${face.id}", "${f.font}"` : f.font,
          fontSize: ((f.size * 25.4) / 72) * px + 'px',
          lineHeight: ((f.leading * 25.4) / 72) * px + 'px',
          fontWeight: String(
            f.fontAxes?.wght ?? f.fontWeight ?? (f.bold ? 700 : face?.weight || 400),
          ),
          fontStyle: f.fontItalic || f.italic ? 'italic' : 'normal',
          fontVariationSettings: Object.entries(f.fontAxes || {})
            .map(([tag, value]) => `"${tag}" ${value}`)
            .join(','),
          color: f.color,
          textAlign: f.align,
          textAlignLast: f.lastAlign || 'auto',
          letterSpacing: ((((f.tracking || 0) / 1000) * f.size * 25.4) / 72) * px + 'px',
          paddingLeft: (f.indentLeft || 0) * px + 'px',
          paddingRight: (f.indentRight || 0) * px + 'px',
          textIndent: (f.firstIndent || 0) * px + 'px',
          marginTop: (f.spaceBefore || 0) * px + 'px',
          marginBottom: (f.spaceAfter || 0) * px + 'px',
          minHeight: ((f.leading * 25.4) / 72) * px + 'px',
        });
        content.append(p);
      });
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.textIndent = '0';
      content.style.letterSpacing = 'normal';
      if (!print) {
        content.addEventListener(
          'input',
          (e) => {
            e.stopImmediatePropagation();
            const next = content.innerText.replace(/\r/g, '').replace(/\u00a0/g, '');
            o.paragraphMap = syncParagraphMap(o.text, next, o.paragraphMap);
            o.text = next;
            changed();
          },
          { capture: true },
        );
        content.addEventListener('paste', (e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData!.getData('text/plain'));
        });
      }
    }
    return page;
  },
  'paragraphs',
);
extend.result(
  'ensureBookFonts',
  async function (pending: Promise<unknown>) {
    await pending;
    const wanted = new Map<string, CatalogFace>();
    for (const p of book.pages)
      for (const o of p.objects)
        if (o.type === 'text' && !o.toc)
          for (let i = 0; i < o.text.split('\n').length; i++) {
            const f = selectedFace(paragraphFormat(book, o, i)) as CatalogFace | undefined;
            if (f) wanted.set(f.id, f);
          }
    await Promise.all([...wanted.values()].map((f) => ensureFace(f).catch(() => {})));
    await document.fonts.ready;
  },
  'paragraphs',
);
extend(
  'finishEditing',
  (endParagraphEditing) =>
    function () {
      const was = !!editing;
      endParagraphEditing();
      if (was)
        requestAnimationFrame(() => {
          if (!editing && !drag) renderPages();
        });
    },
  'paragraphs',
);
document.addEventListener('selectionchange', () => {
  if (!editing) return;
  const anchor = window.getSelection()?.anchorNode,
    element = (anchor?.nodeType === 1 ? anchor : anchor?.parentElement) as
      Element | null | undefined,
    paragraph = element?.closest<HTMLElement>('.mqt-paragraph');
  if (paragraph && editing.contains(paragraph)) {
    const index = Number(paragraph.dataset.paragraphIndex),
      id = editing.dataset.id!;
    if (paragraphScope.id !== id || paragraphScope.index !== index) {
      paragraphScope = { id, index };
      queueMicrotask(() => {
        if (editing) inspector();
      });
    }
  }
});
// Los ejes variables del párrafo los dibuja el panel de Tipografía (TextPanels.tsx).
