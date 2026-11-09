// Modelo del libro: formatos, libro de muestra, cálculos de páginas, folios, índice y validación
// de proyectos. No toca la pantalla. Se publica como window.LibroModel (en la app, M).
// Fuente TypeScript: se compila a build/model.js (desktop/scripts/build.mjs).

import { CURRENT_VERSION, migrateProject } from './model-migrations.ts';

export type AutoType = 'header' | 'titulillo' | 'folio';
const AUTO_TYPES: AutoType[] = ['header', 'titulillo', 'folio'];

/** Cornisa, titulillo o folio. Otros módulos le agregan campos (líneas, ejes, dirección…). */
export interface AutoElement {
  enabled: boolean;
  pos: string;
  odd: string;
  even: string;
  size: number;
  font: string;
  align: string;
  distance: number;
  offsetX: number;
  offsetY: number;
  rule: boolean;
  vertical: boolean;
  scope: 'all' | 'odd' | 'even' | string;
  [extra: string]: any;
}

/** Objeto sobre la página. Cada tipo y cada módulo suma sus campos. */
export interface BookObject {
  id: string;
  type: 'text' | 'image' | 'frame' | string;
  x: number;
  y: number;
  w: number;
  h: number;
  [extra: string]: any;
}

export interface Page {
  id: string;
  section: string;
  hideHeader: boolean;
  hideTitle: boolean;
  hideFolio: boolean;
  objects: BookObject[];
  [extra: string]: any;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TocConfig {
  title: string;
  includeSections: boolean;
  includeHeadings: boolean;
  entries: { id: string; label: string; pageId: string }[];
}

export interface TocEntry {
  id: string;
  label: string;
  pageId: string;
  page: number;
  folio: string;
  source: 'section' | 'heading' | 'manual';
}

/**
 * Roles de texto (pedido de la cátedra de Tipografía I, planilla "Pauta de uso tipográfico"): un
 * estilo de párrafo puede ser el de un rol (style.role), uno por rol en cada libro. Los nombres
 * están en src/roles.ts.
 */
export const ROLE_IDS = [
  'title',
  'subtitle',
  'body',
  'secondary-a',
  'secondary-b',
  'highlight-a',
  'highlight-b',
  'highlight-c',
  'list-a',
  'list-b',
  'list-c',
  'other',
] as const;
export type RoleId = (typeof ROLE_IDS)[number];

/**
 * Notas al pie del libro: formato y contenido. La llamada en el texto es un carácter de uso privado
 * (U+E000…U+F8FF) dentro de o.text; su clave es el código en hexadecimal ('e000'). Ver
 * src/footnote-model.ts.
 */
export interface FootnoteSettings {
  font: string;
  /** Cuerpo, en pt. */
  size: number;
  /** Interlineado, en pt. */
  leading: number;
  /** Espacio entre el texto y las notas, en mm. */
  space: number;
  /** Filete corto sobre las notas. */
  rule: boolean;
  /** Dónde vuelve a empezar la numeración. */
  restart: 'book' | 'section' | 'page';
  notes: Record<string, string>;
}

export interface Book {
  version: number;
  title: string;
  width: number;
  height: number;
  format: string;
  facing: boolean;
  margins: { top: number; bottom: number; inside: number; outside: number };
  grid: {
    enabled: boolean;
    rows: number;
    cols: number;
    gapX: number;
    gapY: number;
    fit: 'margins' | 'page' | string;
  };
  folio: AutoElement & { start: number; format: string };
  header: AutoElement;
  titulillo: AutoElement;
  chapter: string;
  pages: Page[];
  toc?: TocConfig;
  footnotes?: FootnoteSettings;
  [extra: string]: any;
}

const formats: Record<string, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
  Carta: [215.9, 279.4],
  Oficio: [216, 330],
  '17 × 24': [170, 240],
  '20 × 20': [200, 200],
};
const uid = (): string => Math.random().toString(36).slice(2, 11);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="620" viewBox="0 0 800 620"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#b4b9bb"/><stop offset="1" stop-color="#e9e8df"/></linearGradient><linearGradient id="street" x2="0" y2="1"><stop stop-color="#969b99"/><stop offset="1" stop-color="#252b2c"/></linearGradient><linearGradient id="facade"><stop stop-color="#20272b"/><stop offset="1" stop-color="#737a7c"/></linearGradient><pattern id="windows" width="38" height="48" patternUnits="userSpaceOnUse"><rect width="38" height="48" fill="#42494c"/><rect x="8" y="7" width="17" height="29" fill="#1e282d"/><path d="M8 22h17M17 7v29" stroke="#8c9391" stroke-width="2"/></pattern><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .15"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><rect width="800" height="620" fill="url(#sky)"/><g opacity=".25" fill="#7b8588"><path d="M295 0h73v390h-73zM422 80h85v310h-85zM370 134h45v248h-45z"/></g><path d="M0 0h230l102 412L0 620Z" fill="url(#facade)"/><path d="M0 0h183l44 303 65 130L0 594Z" fill="url(#windows)"/><path d="M0 151l223 56M0 267l249 34M0 382l285 14M80 0l68 506M165 0l74 460" stroke="#879091" stroke-width="7" opacity=".5"/><path d="M800 0H576L474 412l326 208Z" fill="#303a40"/><path d="M800 10H620l-76 416 256 177Z" fill="url(#windows)"/><path d="M800 170l-232 58M800 286l-253 32M800 393l-275 8M704 0l-64 505M624 0l-72 452" stroke="#8a9495" stroke-width="7" opacity=".45"/><path d="M332 401h142l326 219H0Z" fill="url(#street)"/><g stroke="#e1e0d4" opacity=".42"><path d="M350 420L97 620M454 420l244 200M382 424l-74 196M425 421l67 199"/><path d="M256 478h283M211 511h377M144 552h500M40 602h723" stroke-width="3"/></g><path d="M0 0h800v620H0Z" fill="#3c4548" opacity=".08" filter="url(#grain)"/><g fill="#141d21"><ellipse cx="399" cy="401" rx="12" ry="15"/><path d="M387 414q11-9 24 0l16 72-15 8-3 72h-10l-5-67-6 67h-10l5-81-12-5Z"/><path d="M377 404q23-9 43 0v4h-43Z"/><ellipse cx="397" cy="579" rx="29" ry="6" opacity=".6"/></g><g stroke="#b4c0c1" opacity=".23"><path d="M278 0v440M293 0v461M525 0v429M511 0v458M313 98v381M484 60v391M367 0v380M429 0v384"/></g></svg>`;
function master(pos: string, odd: string, even: string, size: number): AutoElement {
  return {
    enabled: true,
    pos,
    odd,
    even,
    size,
    font: 'Georgia',
    align: 'center',
    distance: 8,
    offsetX: 0,
    offsetY: 0,
    rule: false,
    vertical: false,
    scope: 'all',
  };
}
function page(): Page {
  return {
    id: uid(),
    section: '',
    hideHeader: false,
    hideTitle: false,
    hideFolio: false,
    objects: [],
  };
}
function text(content: string, x = 20, y = 35, w = 108, h = 55, size = 12): BookObject {
  return {
    id: uid(),
    type: 'text',
    text: content,
    x,
    y,
    w,
    h,
    size,
    leading: size * 1.4,
    font: 'Georgia',
    align: 'left',
    color: '#202125',
    bold: false,
    italic: false,
  };
}
function create(): Book {
  let b: Book = {
    version: CURRENT_VERSION,
    title: 'La caída',
    width: 148,
    height: 210,
    format: 'A5',
    facing: true,
    margins: { top: 20, bottom: 20, inside: 20, outside: 20 },
    grid: { enabled: true, rows: 6, cols: 3, gapX: 5, gapY: 0, fit: 'margins' },
    folio: { ...master('bottom-outer', '{page}', '{page}', 9), start: 1, format: 'arabic' },
    header: { ...master('top', '{section} | {book}', '{book} | {section}', 8), rule: true },
    titulillo: { ...master('outer', '{section}', '{book}', 8), enabled: false },
    chapter: 'Capítulo 1',
    pages: Array.from({ length: 6 }, page),
  };
  b.pages[0].objects = [
    text('La caída', 20, 38, 108, 23, 36),
    text(
      'En el silencio de la mañana, el mundo parecía distinto. No era la misma ciudad, ni las mismas calles, ni siquiera el mismo aire. Todo estaba suspendido, como si algo invisible hubiera cambiado de lugar sin que nadie lo notara.\n\nÉl caminó sin rumbo, guiado más por la costumbre que por la certeza. Las sombras de los edificios se alargaban sobre el pavimento, y en cada esquina creía ver un reflejo de lo que alguna vez fue.',
      20,
      68,
      108,
      113,
      14,
    ),
  ];
  b.pages[1].objects = [
    {
      id: uid(),
      type: 'image',
      x: 20,
      y: 38,
      w: 108,
      h: 85,
      src: (globalThis as any).LibroSampleImage || 'data:image/svg+xml;base64,' + btoa(scene),
      name: 'Fotografía editorial · calle',
    },
    text(
      'No sabía si era el principio o el final, pero algo en su interior le decía que estaba por comenzar una etapa diferente. Quizás era solo una ilusión, o tal vez, una última oportunidad.',
      25,
      135,
      98,
      48,
      13,
    ),
  ];
  b.pages[1].objects[1].align = 'center';
  return b;
}
function margins(b: Book, index: number): { left: number; right: number } {
  return {
    left: index % 2 === 0 ? b.margins.outside : b.margins.inside,
    right: index % 2 === 0 ? b.margins.inside : b.margins.outside,
  };
}
function gridRect(b: Book, index: number): Rect {
  const m = margins(b, index);
  return b.grid.fit === 'page'
    ? { x: 0, y: 0, w: b.width, h: b.height }
    : {
        x: m.left,
        y: b.margins.top,
        w: b.width - m.left - m.right,
        h: b.height - b.margins.top - b.margins.bottom,
      };
}
function validateGrid(b: Book): boolean {
  const r = gridRect(b, 0),
    g = b.grid;
  return r.w - g.gapX * (g.cols - 1) >= g.cols * 1 && r.h - g.gapY * (g.rows - 1) >= g.rows * 1;
}
/** El texto sin las llamadas de nota al pie (los caracteres de uso privado que son notas). */
function withoutNoteMarks(b: Book, text: string): string {
  const notes = b.footnotes?.notes;
  return notes
    ? text.replace(/[\uE000-\uF8FF]/g, (mark) =>
        notes[mark.charCodeAt(0).toString(16)] === undefined ? mark : '',
      )
    : text;
}
function sectionAt(b: Book, index: number): string {
  for (let i = index; i >= 0; i--) if (b.pages[i].section) return b.pages[i].section;
  return b.chapter;
}
function roman(n: number): string {
  if (n > 3999) return String(n);
  const a: [number, string][] = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  for (const [v, s] of a)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}
function folio(b: Book, i: number): string {
  let n = i + b.folio.start;
  return b.folio.format === 'roman'
    ? roman(n)
    : b.folio.format === 'ROMAN'
      ? roman(n).toUpperCase()
      : String(n);
}
function fill(b: Book, i: number, value: string): string {
  return value.replace(
    /\{(book|section|page|total)\}/g,
    (_, v: string) =>
      (
        ({
          book: b.title,
          section: sectionAt(b, i),
          page: folio(b, i),
          total: String(b.pages.length),
        }) as Record<string, string>
      )[v],
  );
}
function auto(
  b: Book,
  i: number,
  type: AutoType,
): (AutoElement & { text: string; type: AutoType }) | null {
  const cfg = b[type],
    p = b.pages[i],
    number = i + b.folio.start,
    isOdd = number % 2 === 1;
  if (
    !cfg.enabled ||
    p[({ header: 'hideHeader', titulillo: 'hideTitle', folio: 'hideFolio' } as const)[type]] ||
    (cfg.scope === 'odd' && !isOdd) ||
    (cfg.scope === 'even' && isOdd)
  )
    return null;
  let raw = isOdd ? cfg.odd : cfg.even;
  return { ...cfg, text: fill(b, i, raw), type };
}
function impose(count: number): [number, number][] {
  let n = Math.ceil(count / 4) * 4,
    faces: [number, number][] = [];
  for (let f = 0; f < n / 2; f++) faces.push(f % 2 === 0 ? [n - 1 - f, f] : [f, n - 1 - f]);
  return faces;
}
function tocConfig(b: Book): TocConfig {
  return b.toc || { title: 'Índice', includeSections: true, includeHeadings: true, entries: [] };
}
function tocEntries(b: Book): TocEntry[] {
  const cfg = tocConfig(b),
    out: TocEntry[] = [];
  for (let i = 0; i < b.pages.length; i++) {
    const p = b.pages[i];
    if (cfg.includeSections && (p.section || (i === 0 && b.chapter)))
      out.push({
        id: 'section-' + p.id,
        label: p.section || b.chapter,
        pageId: p.id,
        page: i,
        folio: folio(b, i),
        source: 'section',
      });
    if (cfg.includeHeadings)
      for (const o of p.objects)
        if (o.type === 'text' && o.heading && !o.toc && o.text.trim())
          out.push({
            id: o.id,
            label: withoutNoteMarks(b, o.text).trim().split('\n')[0],
            pageId: p.id,
            page: i,
            folio: folio(b, i),
            source: 'heading',
          });
  }
  for (const e of cfg.entries) {
    const i = b.pages.findIndex((p) => p.id === e.pageId);
    out.push({ ...e, page: i, folio: i < 0 ? '—' : folio(b, i), source: 'manual' });
  }
  return out.sort((a, c) => (a.page < 0 ? 999 : a.page) - (c.page < 0 ? 999 : c.page));
}
function tocText(b: Book): string {
  return (
    tocConfig(b).title +
    '\n\n' +
    tocEntries(b)
      .map((e) => e.label + ' ··· ' + e.folio)
      .join('\n')
  );
}
function validParagraphProperties(p: any): boolean {
  if (
    p &&
    ((p.hyphenate !== undefined && typeof p.hyphenate !== 'boolean') ||
      (p.hyphenLanguage !== undefined && !['es', 'en', 'pt'].includes(p.hyphenLanguage)))
  )
    return false;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const ranges: Record<string, [number, number]> = {
    size: [4, 150],
    leading: [4, 220],
    fontWeight: [1, 1000],
    tracking: [-100, 500],
    indentLeft: [0, 80],
    indentRight: [0, 80],
    firstIndent: [-30, 50],
    spaceBefore: [0, 50],
    spaceAfter: [0, 50],
  };
  for (const [key, [min, max]] of Object.entries(ranges))
    if (
      p[key] !== undefined &&
      (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < min || p[key] > max)
    )
      return false;
  if (p.align !== undefined && !['left', 'center', 'right', 'justify'].includes(p.align))
    return false;
  if (
    p.lastAlign !== undefined &&
    !['auto', 'left', 'center', 'right', 'justify'].includes(p.lastAlign)
  )
    return false;
  if (p.font !== undefined && (typeof p.font !== 'string' || p.font.length > 100)) return false;
  if (p.fontFaceId !== undefined && !/^[A-Fa-f0-9]{24}$/.test(p.fontFaceId)) return false;
  if (
    p.fontAxes !== undefined &&
    (p.fontAxes === null ||
      typeof p.fontAxes !== 'object' ||
      Array.isArray(p.fontAxes) ||
      Object.keys(p.fontAxes).length > 32 ||
      Object.entries(p.fontAxes).some(
        ([k, v]) =>
          !/^.{4}$/.test(k) ||
          typeof v !== 'number' ||
          !Number.isFinite(v) ||
          v < -32768 ||
          v > 32768,
      ))
  )
    return false;
  return true;
}
// Valida un proyecto que viene de afuera (archivo, portapapeles): no se confía en nada.
// Primero lo lleva a la versión actual del formato (model-migrations.ts): un proyecto que no es de
// Maquetario, o de una versión más nueva, se rechaza ahí con un error para mostrar.
function validate(input: any): Book {
  const b: any = clone(migrateProject(input));
  const number = (v: unknown, min: number, max: number): boolean =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const str = (v: unknown, max: number): boolean => typeof v === 'string' && v.length <= max;
  if (
    !str(b.title, 250) ||
    !str(b.chapter, 250) ||
    !number(b.width, 60, 420) ||
    !number(b.height, 60, 594) ||
    !Array.isArray(b.pages) ||
    b.pages.length < 1 ||
    b.pages.length > 200
  )
    throw Error('El tamaño o la estructura del libro no son válidos.');
  if (
    !b.margins ||
    !Object.values(b.margins).every((v) => number(v, 0, 150)) ||
    b.margins.top + b.margins.bottom > b.height - 10 ||
    b.margins.inside + b.margins.outside > b.width - 10
  )
    throw Error('Los márgenes no son válidos.');
  const g = b.grid;
  if (
    !g ||
    !Number.isInteger(g.cols) ||
    !number(g.cols, 1, 12) ||
    !Number.isInteger(g.rows) ||
    !number(g.rows, 1, 40) ||
    !number(g.gapX, 0, 100) ||
    !number(g.gapY, 0, 100) ||
    !['margins', 'page'].includes(g.fit) ||
    !validateGrid(b)
  )
    throw Error('La grilla no cabe en la página.');
  for (const type of AUTO_TYPES) {
    const c = b[type];
    if (
      !c ||
      !str(c.odd, 1000) ||
      !str(c.even, 1000) ||
      !str(c.font, 100) ||
      !number(c.size, 4, 72) ||
      !number(c.distance, 0, 100) ||
      !number(c.offsetX, -200, 200) ||
      !number(c.offsetY, -200, 200) ||
      ![
        'top',
        'bottom',
        'outer',
        'inner',
        'left',
        'right',
        'top-outer',
        'top-center',
        'top-inner',
        'bottom-outer',
        'bottom-center',
        'bottom-inner',
      ].includes(c.pos) ||
      !['all', 'odd', 'even'].includes(c.scope) ||
      !['left', 'center', 'right'].includes(c.align)
    )
      throw Error('La configuración de elementos automáticos no es válida.');
  }
  if (!Number.isInteger(b.folio.start) || !number(b.folio.start, 1, 9999))
    throw Error('La numeración inicial no es válida.');
  for (const type of AUTO_TYPES) {
    const c = b[type];
    const ruleLimits: [string, number, number][] = [
      ['ruleWidth', 0.05, 3],
      ['ruleGap', 0, 20],
      ['ruleLength', 1, 100],
    ];
    for (const [k, min, max] of ruleLimits)
      if (c[k] !== undefined && !number(c[k], min, max))
        throw Error('Línea de miscelánea inválida.');
    if (
      (c.ruleColor !== undefined && !/^#[0-9a-f]{6}$/i.test(c.ruleColor)) ||
      (c.ruleStyle !== undefined && !['solid', 'dashed', 'dotted'].includes(c.ruleStyle))
    )
      throw Error('Trazo inválido.');
  }
  for (const p of b.pages)
    for (const o of p.objects || [])
      if (
        o.decoration !== undefined &&
        (o.decoration !== 'line' ||
          o.type !== 'frame' ||
          (o.lineWidth !== undefined && !number(o.lineWidth, 0.05, 3)) ||
          (o.lineColor !== undefined && !/^#[0-9a-f]{6}$/i.test(o.lineColor)) ||
          (o.lineStyle !== undefined && !['solid', 'dashed', 'dotted'].includes(o.lineStyle)))
      )
        throw Error('Línea libre inválida.');
  if (
    b.paragraphStyles &&
    (!Array.isArray(b.paragraphStyles) ||
      b.paragraphStyles.length > 500 ||
      b.paragraphStyles.some(
        (s: any) => !str(s.id, 60) || !str(s.name, 100) || !validParagraphProperties(s.properties),
      ))
  )
    throw Error('Estilos de párrafo inválidos.');
  const roles = (b.paragraphStyles || []).filter((s: any) => s.role !== undefined);
  if (
    roles.some(
      (s: any) =>
        !ROLE_IDS.includes(s.role) ||
        (s.columns !== undefined && (!Number.isInteger(s.columns) || !number(s.columns, 1, 12))),
    ) ||
    new Set(roles.map((s: any) => s.role)).size !== roles.length
  )
    throw Error('Roles de texto inválidos.');
  for (const p of b.pages)
    for (const o of p.objects || [])
      if (
        o.paragraphMap &&
        (!Array.isArray(o.paragraphMap) ||
          o.paragraphMap.length > 20000 ||
          o.paragraphMap.some(
            (m: any) =>
              m &&
              ((m.styleId !== null && m.styleId !== undefined && !str(m.styleId, 60)) ||
                !validParagraphProperties(m.overrides || {})),
          ))
      )
        throw Error('Formato de párrafo inválido.');
  if (
    b.toc &&
    (!str(b.toc.title, 250) ||
      !Array.isArray(b.toc.entries) ||
      b.toc.entries.length > 1000 ||
      b.toc.entries.some((e: any) => !str(e.id, 60) || !str(e.label, 500) || !str(e.pageId, 60)))
  )
    throw Error('Índice inválido.');
  const notes = b.footnotes;
  if (
    notes !== undefined &&
    (!notes ||
      typeof notes !== 'object' ||
      !str(notes.font, 100) ||
      !number(notes.size, 4, 72) ||
      !number(notes.leading, 4, 100) ||
      !number(notes.space, 0, 50) ||
      typeof notes.rule !== 'boolean' ||
      !['book', 'section', 'page'].includes(notes.restart) ||
      !notes.notes ||
      typeof notes.notes !== 'object' ||
      Array.isArray(notes.notes) ||
      Object.keys(notes.notes).length > 6400 ||
      Object.entries(notes.notes).some(
        ([key, text]) => !/^(e[\da-f]{3}|f[0-8][\da-f]{2})$/.test(key) || !str(text, 20000),
      ))
  )
    throw Error('Notas al pie inválidas.');
  if (b.measurementUnit !== undefined && !['mm', 'cm'].includes(b.measurementUnit))
    throw Error('Unidad de medida inválida.');
  if (b.spreadDirection !== undefined && !['horizontal', 'vertical'].includes(b.spreadDirection))
    throw Error('Disposición de páginas inválida.');
  if (
    b.guides &&
    (!Array.isArray(b.guides) ||
      b.guides.length > 500 ||
      b.guides.some(
        (g: any) =>
          !['h', 'v'].includes(g.axis) ||
          !number(g.position, 0, g.axis === 'v' ? b.width : b.height),
      ))
  )
    throw Error('Guía inválida.');
  for (const p of b.pages)
    for (const o of p.objects || []) {
      if (o.fontWeight !== undefined && !number(o.fontWeight, 1, 1000))
        throw Error('Peso tipográfico inválido.');
      if (o.fontFaceId !== undefined && !/^[A-Fa-f0-9]{24}$/.test(o.fontFaceId))
        throw Error('Identificador de fuente inválido.');
      if (
        o.fontAxes !== undefined &&
        (o.fontAxes === null ||
          typeof o.fontAxes !== 'object' ||
          Array.isArray(o.fontAxes) ||
          Object.keys(o.fontAxes).length > 32 ||
          Object.entries(o.fontAxes).some(
            ([k, v]) => !/^.{4}$/.test(k) || !number(v, -32768, 32768),
          ))
      )
        throw Error('Ejes tipográficos inválidos.');
    }
  const ids = new Set<string>();
  for (const p of b.pages) {
    if (
      !str(p.id, 60) ||
      ids.has(p.id) ||
      !str(p.section, 250) ||
      !Array.isArray(p.objects) ||
      p.objects.length > 300
    )
      throw Error('Página inválida.');
    ids.add(p.id);
    for (const o of p.objects) {
      if (
        !str(o.id, 60) ||
        ids.has(o.id) ||
        !['text', 'image', 'frame'].includes(o.type) ||
        !number(o.x, 0, b.width) ||
        !number(o.y, 0, b.height) ||
        !number(o.w, 1, 1000) ||
        !number(o.h, 1, 1000)
      )
        throw Error('Objeto inválido.');
      ids.add(o.id);
      if (
        o.type === 'text' &&
        (!str(o.text, 500000) ||
          !str(o.font, 100) ||
          !number(o.size, 4, 150) ||
          !number(o.leading, 4, 220) ||
          !['left', 'center', 'right', 'justify'].includes(o.align) ||
          !/^#[\da-f]{6}$/i.test(o.color))
      )
        throw Error('Cuadro de texto inválido.');
      if (
        o.type === 'image' &&
        (!str(o.src, 30000000) ||
          !/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(o.src))
      )
        throw Error('Imagen inválida.');
    }
  }
  return b;
}

const LibroModel = {
  formats,
  uid,
  clone,
  page,
  text,
  create,
  margins,
  gridRect,
  validateGrid,
  sectionAt,
  roman,
  folio,
  fill,
  auto,
  impose,
  tocConfig,
  tocEntries,
  tocText,
  withoutNoteMarks,
  roleIds: ROLE_IDS,
  validate,
};
export type LibroModelApi = typeof LibroModel;

declare global {
  var LibroModel: LibroModelApi;
}
// Objeto común (no un módulo congelado): src/master-refinement.ts y shapes.js reemplazan validate.
globalThis.LibroModel = LibroModel;
