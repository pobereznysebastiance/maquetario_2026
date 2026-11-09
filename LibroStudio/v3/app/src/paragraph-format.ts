// Formato de los párrafos de una caja de texto: base del objeto + estilo de párrafo + ajustes
// locales, el párrafo elegido en el inspector y las palabras del panel. No tiene efectos al
// cargar: se importa. El panel, los estilos y el dibujo en la página están en paragraphs.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { Book, BookObject, RoleId } from './model.ts';
import { i18n } from './i18n/language.ts';
import { M } from './core-api.ts';

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
  /** Rol de texto de la planilla de la cátedra (src/roles.ts): uno por libro. */
  role?: RoleId;
  /** Ancho de caja del rol, en columnas de la grilla. */
  columns?: number;
}

const paragraphWords = {
  es: {
    panel: 'Párrafo y estilos',
    scope: 'Aplicar a',
    all: 'Toda la caja',
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
    all: 'Whole frame',
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
    all: 'Toda a caixa',
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
/** Palabras del panel de párrafos en el idioma actual (l, r, c, j: alineaciones). */
export const pw = (): ParagraphWords => paragraphWords[i18n.language || 'es'];
/** Propiedades que puede tener un párrafo (las que se copian del objeto y del estilo). */
export const paragraphKeys: string[] = [
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
  'textCase',
  'indentLeft',
  'indentRight',
  'firstIndent',
  'spaceBefore',
  'spaceAfter',
];
/** Formato que da la caja misma, sin estilo ni ajustes locales. */
export function paragraphBase(o: BookObject): ParagraphFormat {
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
/** Formato efectivo de un párrafo: base del objeto + estilo + ajustes locales. */
export function paragraphFormat(b: Book, o: BookObject, index: number): ParagraphFormat {
  const meta = o.paragraphMap?.[index] || {},
    style = (b.paragraphStyles || []).find((s: ParagraphStyle) => s.id === meta.styleId);
  return { ...paragraphBase(o), ...(style?.properties || {}), ...(meta.overrides || {}) };
}
export function paragraphIndices(o: BookObject): number[] {
  return paragraphScope.id === o.id && paragraphScope.index >= 0
    ? [Math.min(paragraphScope.index, o.text.split('\n').length - 1)]
    : o.text.split('\n').map((_: string, i: number) => i);
}
/** Datos del párrafo index (los crea si no existen). */
export function paragraphMeta(o: BookObject, index: number): ParagraphMeta {
  if (!o.paragraphMap) o.paragraphMap = [];
  if (!o.paragraphMap[index]) o.paragraphMap[index] = { styleId: null, overrides: {} };
  return o.paragraphMap[index];
}
/** Párrafo elegido en el inspector, o 0. */
export function currentParagraph(o: BookObject): number {
  return paragraphScope.id === o.id && paragraphScope.index >= 0
    ? Math.min(paragraphScope.index, o.text.split('\n').length - 1)
    : 0;
}

/** Mientras es true, commit no copia los cambios del objeto a los párrafos (paragraphs.ts). */
let paragraphOperation = false;
/** Hay un cambio de párrafos en curso (asParagraphOperation). */
export const inParagraphOperation = (): boolean => paragraphOperation;
/** Hace algo sin que commit copie los cambios del objeto a los párrafos. */
export function asParagraphOperation(fn: () => void): void {
  paragraphOperation = true;
  try {
    fn();
  } finally {
    paragraphOperation = false;
  }
}
