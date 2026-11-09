// Motor de composición (etapa 4) dentro de la app: módulo ES aparte que se carga a pedido, sólo
// con la llave prendida (src/compose-loader.ts). Trae packages/compose y HarfBuzz (WASM): por eso
// no va en build/app.js, que es un script clásico y se carga siempre.
//
// Con la llave prendida dibuja los párrafos que puede componer (composePage, extendiendo paper)
// y describe la salida armada para el PDF propio (composePdfLayout). composeReport mide la
// paridad con Chromium: compone cada párrafo del libro con el motor, al ancho de su caja, y
// compara sus cortes de línea con los del DOM de la página (Range.getClientRects sobre el mismo
// paper() que usan la salida y la revisión del libro, fuera de la pantalla).
// Plan: docs/MOTOR_09-nov_composicion.md.
//
// Fuente TypeScript: se compila a build/compose.mjs (desktop/scripts/build.mjs); harfbuzz.wasm
// se copia al lado.
import type { BookObject } from '../model.ts';
import type {
  PdfFont,
  PdfImage,
  PdfLayout,
  PdfRect,
  PdfSheet,
  PdfText,
} from '../contract/pdf-layout.ts';
import {
  breakLines,
  type ComposeFont,
  createParagraph,
  createRunParagraph,
  type Hyphenator,
  type HyphenLanguage,
  type Line,
  loadFont,
  type Paragraph,
  shape,
  SOFT_HYPHEN,
  withVariations,
} from '../../../../../packages/compose/src/browser.ts';

export interface ComposeReportOptions {
  /** Páginas a medir (índices desde 0). Por defecto, todas. */
  pages?: number[];
  /** Píxeles por milímetro del DOM que se compara. Por defecto 96/25,4, como la salida. */
  px?: number;
  /**
   * Fuentes para medir cuando no hay catálogo (navegador sin escritorio): "familia|peso|estilo"
   * → dirección del archivo, por ejemplo { "Georgia|400|normal": "/fonts/georgia.ttf" }. En una
   * colección, la cara va después de "#": "/fonts/cambria.ttc#0".
   */
  fonts?: Record<string, string>;
  /** Incluir el detalle por párrafo (rows). */
  details?: boolean;
}

export interface AlgorithmParity {
  /** Párrafos con exactamente los mismos cortes que Chromium. */
  identical: number;
  /** Líneas del motor que coinciden con una línea de Chromium (mismo comienzo y mismo final). */
  equalLines: number;
  lines: number;
  /** Párrafos según la diferencia de cantidad de líneas con Chromium (motor − Chromium). */
  lineCountDifference: Record<string, number>;
  /**
   * Párrafos distintos en los que Chromium corta donde las reglas del castellano no dejan (después
   * de una raya pegada, junto a una raya suelta…): ahí el motor hace otra cosa a propósito.
   */
  expected: number;
  /** Párrafos distintos sin esa explicación. */
  unexpected: number;
}

export interface ParagraphRow {
  page: number;
  object: string;
  paragraph: number;
  font: string;
  size: number;
  /** Ancho de composición en puntos. */
  width: number;
  align: string;
  hyphenate: boolean;
  chromium: number;
  greedy: { lines: number; equal: number };
  greedyChromiumSize: { lines: number; equal: number };
  knuthPlass: { lines: number; equal: number };
  /** Si el voraz con el cuerpo de Chromium difiere: el texto de cada línea de los dos. */
  greedyMismatch?: { chromium: string[]; greedy: string[] };
}

export interface ComposeReport {
  paragraphs: { measured: number; empty: number; skipped: Record<string, number> };
  chromiumLines: number;
  /** Corte voraz del motor: lo más parecido a lo que hace Chromium; mide si las medidas coinciden. */
  greedy: AlgorithmParity;
  /**
   * El mismo corte voraz con el cuerpo como lo usa Chromium: el tamaño en px truncado a centésimas
   * (11 pt = 14,666… px se mide como 14,66 px; medido en Chrome 14x con Windows, ver
   * docs/MOTOR_09-nov_composicion.md).
   */
  greedyChromiumSize: AlgorithmParity;
  /** Knuth-Plass: lo que cambiaría al dibujar con el motor. */
  knuthPlass: AlgorithmParity;
  /** Cajas de texto con todos sus párrafos medidos: desborde según Chromium y según el motor. */
  boxes: {
    measured: number;
    overflowChromium: number;
    overflowGreedy: number;
    overflowKnuthPlass: number;
    /** Cajas en que el motor (voraz / Knuth-Plass) no coincide con Chromium sobre el desborde. */
    disagreeGreedy: number;
    disagreeKnuthPlass: number;
  };
  /** Comienzos de línea de Chromium donde el castellano no deja cortar, por motivo. */
  chromiumForbiddenBreaks: Record<string, number>;
  milliseconds: number;
  rows?: ParagraphRow[];
}

const PT_PER_MM = 72 / 25.4;

const fontCache = new Map<string, Promise<ComposeFont>>();
/** Lee una fuente por dirección; "archivo.ttc#2" es la cara 2 de una colección. */
function fontFrom(url: string): Promise<ComposeFont> {
  let font = fontCache.get(url);
  if (!font) {
    const [path, index] = url.split('#');
    font = fetch(path!).then(async (response) => {
      if (!response.ok) throw new Error(`No se pudo leer la fuente ${url} (${response.status})`);
      return loadFont(await response.arrayBuffer(), Number(index) || 0);
    });
    fontCache.set(url, font);
  }
  return font;
}

/**
 * Los ejes con que dibuja Chromium una cara variable: el peso de font-weight, el ancho normal
 * (100) y el tamaño óptico igual al cuerpo en px (font-optical-sizing: auto); encima, lo que el
 * objeto pide en font-variation-settings (fontAxes). Los ejes que la fuente no tiene se ignoran.
 */
function cssVariations(f: Record<string, any>, weight: number, sizePx: number) {
  return { wght: weight, wdth: 100, opsz: sizePx, ...(f.fontAxes || {}) };
}

/** Por qué Chromium cortó en `start` aunque el castellano no deja (null: el motor también puede). */
function forbiddenBreak(text: string, start: number, paragraph: Paragraph): string | null {
  if (start === 0 || paragraph.breakStarts.includes(start)) return null;
  const before = text.slice(0, start);
  if (/[\u2013\u2014]$/.test(before)) return 'después de una raya o un guion de rango pegados';
  if (/(^|\s)[\u2013\u2014]+\s*$/.test(before) || /^[\u2013\u2014]+(\s|$)/.test(text.slice(start)))
    return 'junto a una raya suelta';
  if (/\/$/.test(before)) return 'después de una barra';
  return 'otro';
}

// El mismo separador que usa la página (hyphenation-controls.ts: createHyphenator con los
// valores por defecto), así los puntos de corte son los mismos que tiene el DOM.
const PATTERNS: Record<HyphenLanguage, () => unknown> = {
  es: () => hyphenationPatternsEs,
  en: () => hyphenationPatternsEnUs,
  pt: () => hyphenationPatternsPt,
};
const pageHyphenators = new Map<HyphenLanguage, Hyphenator>();
function pageHyphenator(language: HyphenLanguage): Hyphenator {
  let hyphenator = pageHyphenators.get(language);
  if (!hyphenator) {
    hyphenator = createHyphenator(PATTERNS[language]()) as Hyphenator;
    pageHyphenators.set(language, hyphenator);
  }
  return hyphenator;
}

/**
 * Dónde empieza cada línea del párrafo según Chromium, en índices del texto sin guiones
 * discrecionales. Mide el primer carácter de cada palabra, el que sigue a cada guion discrecional
 * y el que sigue a cada raya o barra (Chromium también corta ahí).
 */
function chromiumLineStarts(paragraph: HTMLElement): number[] | null {
  const node = paragraph.firstChild;
  if (!(node instanceof Text) || paragraph.childNodes.length !== 1) return null;
  const marked = node.data;
  const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight);
  const range = document.createRange();
  const starts: number[] = [];
  let original = 0;
  let lastTop = -Infinity;
  for (let k = 0; k < marked.length; k++) {
    const char = marked[k]!;
    if (char === SOFT_HYPHEN) continue;
    const previous = k > 0 ? marked[k - 1]! : ' ';
    if (
      !/\s/.test(char) &&
      (/\s/.test(previous) || previous === SOFT_HYPHEN || /[-–—/]/.test(previous))
    ) {
      range.setStart(node, k);
      range.setEnd(node, k + 1);
      // Después de un corte con guion discrecional, el carácter puede traer además un rectángulo
      // vacío al final de la línea anterior: vale el último con ancho.
      const rect = [...range.getClientRects()].filter((r) => r.width > 0).at(-1);
      if (rect && rect.top > lastTop + lineHeight / 2) {
        starts.push(original);
        lastTop = rect.top;
      }
    }
    original++;
  }
  return starts;
}

/** Cuántas líneas del motor coinciden con una de Chromium (mismo comienzo y mismo final). */
function equalLines(engine: number[], chromium: number[], length: number): number {
  const key = (starts: number[], i: number) => `${starts[i]}-${starts[i + 1] ?? length}`;
  const known = new Set(chromium.map((_, i) => key(chromium, i)));
  return engine.filter((_, i) => known.has(key(engine, i))).length;
}

/** El texto de cada línea, a partir de sus comienzos. */
const slices = (text: string, starts: number[]): string[] =>
  starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length).trimEnd());

const emptyParity = (): AlgorithmParity => ({
  identical: 0,
  equalLines: 0,
  lines: 0,
  lineCountDifference: {},
  expected: 0,
  unexpected: 0,
});

function tally(
  parity: AlgorithmParity,
  engine: number[],
  chromium: number[],
  length: number,
  explained: boolean,
) {
  const equal = equalLines(engine, chromium, length);
  parity.lines += engine.length;
  parity.equalLines += equal;
  if (equal === engine.length && engine.length === chromium.length) parity.identical++;
  else if (explained) parity.expected++;
  else parity.unexpected++;
  const difference = String(engine.length - chromium.length);
  parity.lineCountDifference[difference] = (parity.lineCountDifference[difference] ?? 0) + 1;
  return equal;
}

/** Por qué un párrafo no se puede componer todavía con el motor (null: se puede). */
function unsupported(text: string): string | null {
  if (/[\t]|\s{2}|^\s|\s$/.test(text))
    return 'espacios múltiples, tabulaciones o blancos en los bordes';
  return null;
}

/**
 * La fuente con que el motor puede componer el párrafo (dirección y peso CSS), o por qué no. Con
 * `fonts` (navegador sin catálogo) busca "familia|peso|estilo"; si no, la cara del catálogo que
 * resuelve selectedFace, como la página. Lo que el navegador inventa (negrita o cursiva sintética)
 * el motor no lo puede medir.
 */
function resolveFace(
  f: Record<string, any>,
  fonts?: Record<string, string>,
): { url: string; weight: number } | string {
  const italic = !!(f.fontItalic || f.italic);
  if (fonts) {
    const weight = f.fontWeight ?? (f.bold ? 700 : 400);
    const url = fonts[`${f.font}|${weight}|${italic ? 'italic' : 'normal'}`];
    return url ? { url, weight: f.fontAxes?.wght ?? weight } : 'sin archivo de fuente para medir';
  }
  const face = selectedFace(f);
  if (!face) return 'sin cara del catálogo';
  if (fontLoadErrors.has(face.id)) return 'la cara no se pudo cargar';
  // El peso que pide el CSS de la página (paragraphs.ts).
  const weight = f.fontAxes?.wght ?? f.fontWeight ?? (f.bold ? 700 : face.weight || 400);
  const variableWeight = face.axes.some((axis) => axis.tag === 'wght');
  if ((!variableWeight && Math.abs(weight - face.weight) >= 200) || (italic && !face.italic))
    return 'negrita o cursiva inventada por el navegador';
  return { url: MaquetarioHost.fontUrl(face.id), weight };
}

/** Opciones del motor para un párrafo con el formato f (las mismas que el DOM de la página). */
function engineOptions(f: Record<string, any>) {
  const language = (
    ['es', 'en', 'pt'].includes(f.hyphenLanguage) ? f.hyphenLanguage : 'es'
  ) as HyphenLanguage;
  return {
    size: f.size as number,
    language,
    hyphenate: !!f.hyphenate,
    hyphenator: pageHyphenator(language),
    // Los puntos de corte los decide el separador, como en la página.
    leftMin: 1,
    rightMin: 1,
    // Interletraje del párrafo: milésimas de eme (paragraphs.ts → letter-spacing).
    letterSpacing: ((f.tracking || 0) / 1000) * f.size,
  };
}

async function measureParity(options: ComposeReportOptions): Promise<ComposeReport> {
  const started = performance.now();
  finishEditing();
  await ensureBookFonts();
  await document.fonts.ready;
  const px = options.px ?? 96 / 25.4;
  const report: ComposeReport = {
    paragraphs: { measured: 0, empty: 0, skipped: {} },
    chromiumLines: 0,
    greedy: emptyParity(),
    greedyChromiumSize: emptyParity(),
    knuthPlass: emptyParity(),
    boxes: {
      measured: 0,
      overflowChromium: 0,
      overflowGreedy: 0,
      overflowKnuthPlass: 0,
      disagreeGreedy: 0,
      disagreeKnuthPlass: 0,
    },
    chromiumForbiddenBreaks: {},
    milliseconds: 0,
    ...(options.details ? { rows: [] } : {}),
  };
  const skip = (reason: string) =>
    (report.paragraphs.skipped[reason] = (report.paragraphs.skipped[reason] ?? 0) + 1);
  const pages = options.pages ?? book.pages.map((_, i) => i);

  for (const pageIndex of pages) {
    const page = paper(pageIndex, px, true);
    // Fuera de la pantalla, como preflightBook: tiene que tener caja para medir.
    Object.assign(page.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      display: 'block',
      visibility: 'hidden',
    });
    document.body.append(page);
    try {
      for (const o of book.pages[pageIndex].objects as BookObject[]) {
        if (o.type !== 'text' || o.toc || o.hidden) continue;
        const box = page.querySelector<HTMLElement>(`[data-id="${o.id}"] .text-content`);
        if (!box) continue;
        let boxMeasured = true;
        // Alto del contenido según el motor, en mm.
        let heightGreedy = 0;
        let heightKnuthPlass = 0;
        const texts = o.text.split('\n');
        for (let index = 0; index < texts.length; index++) {
          const text = texts[index]!;
          const f = paragraphFormat(book, o, index);
          const lineMm = (f.leading * 25.4) / 72;
          const spacing = (f.spaceBefore || 0) + (f.spaceAfter || 0);
          if (!text.trim()) {
            report.paragraphs.empty++;
            heightGreedy += spacing + lineMm;
            heightKnuthPlass += spacing + lineMm;
            continue;
          }
          const element = box.querySelector<HTMLElement>(`[data-paragraph-index="${index}"]`);
          const resolved = element
            ? (unsupported(text) ?? resolveFace(f, options.fonts))
            : 'sin párrafo en el DOM';
          const chromium =
            typeof resolved !== 'string' && element ? chromiumLineStarts(element) : null;
          if (typeof resolved === 'string' || !chromium) {
            skip(typeof resolved === 'string' ? resolved : 'no se pudieron leer las líneas');
            boxMeasured = false;
            continue;
          }
          const file = await fontFrom(resolved.url);
          const sizePx = ((f.size * 25.4) / 72) * px;
          const font = withVariations(file, cssVariations(f, resolved.weight, sizePx));
          const paragraphOptions = engineOptions(f);
          const paragraph = createParagraph(font, text, paragraphOptions);
          // El cuerpo como lo usa Chromium: px truncado a centésimas, vuelto a puntos.
          const chromiumSize = ((Math.floor(sizePx * 100) / 100) * f.size) / sizePx;
          const chromiumParagraph = createParagraph(font, text, {
            ...paragraphOptions,
            size: chromiumSize,
          });
          const width = (o.w - (f.indentLeft || 0) - (f.indentRight || 0)) * PT_PER_MM;
          const layout = {
            indent: (f.firstIndent || 0) * PT_PER_MM,
            justify: f.align === 'justify',
          };
          const starts = (lines: { start: number }[]) => lines.map((line) => line.start);
          const greedy = starts(
            breakLines(paragraph, width, { ...layout, algorithm: 'greedy' }).lines,
          );
          const greedyChromiumSize = starts(
            breakLines(chromiumParagraph, width, { ...layout, algorithm: 'greedy' }).lines,
          );
          const knuthPlass = starts(breakLines(paragraph, width, layout).lines);
          report.paragraphs.measured++;
          report.chromiumLines += chromium.length;
          let explained = false;
          for (const start of chromium) {
            const why = forbiddenBreak(text, start, paragraph);
            if (!why) continue;
            explained = true;
            report.chromiumForbiddenBreaks[why] = (report.chromiumForbiddenBreaks[why] ?? 0) + 1;
          }
          const equalGreedy = tally(report.greedy, greedy, chromium, text.length, explained);
          const equalChromiumSize = tally(
            report.greedyChromiumSize,
            greedyChromiumSize,
            chromium,
            text.length,
            explained,
          );
          const equalKnuthPlass = tally(
            report.knuthPlass,
            knuthPlass,
            chromium,
            text.length,
            explained,
          );
          heightGreedy += spacing + greedy.length * lineMm;
          heightKnuthPlass += spacing + knuthPlass.length * lineMm;
          report.rows?.push({
            page: pageIndex,
            object: o.id,
            paragraph: index,
            font: f.font,
            size: f.size,
            width: Math.round(width * 100) / 100,
            align: f.align,
            hyphenate: !!f.hyphenate,
            chromium: chromium.length,
            greedy: { lines: greedy.length, equal: equalGreedy },
            greedyChromiumSize: { lines: greedyChromiumSize.length, equal: equalChromiumSize },
            knuthPlass: { lines: knuthPlass.length, equal: equalKnuthPlass },
            ...(equalChromiumSize !== chromium.length ||
            greedyChromiumSize.length !== chromium.length
              ? {
                  greedyMismatch: {
                    chromium: slices(text, chromium),
                    greedy: slices(text, greedyChromiumSize),
                  },
                }
              : {}),
          });
        }
        if (!boxMeasured) continue;
        const overflowChromium = box.scrollHeight > box.clientHeight + 2;
        // Mismo margen que preflightBook (2 px), en mm.
        const tolerance = 2 / px;
        const overflowGreedy = heightGreedy > o.h + tolerance;
        const overflowKnuthPlass = heightKnuthPlass > o.h + tolerance;
        const boxes = report.boxes;
        boxes.measured++;
        if (overflowChromium) boxes.overflowChromium++;
        if (overflowGreedy) boxes.overflowGreedy++;
        if (overflowKnuthPlass) boxes.overflowKnuthPlass++;
        if (overflowGreedy !== overflowChromium) boxes.disagreeGreedy++;
        if (overflowKnuthPlass !== overflowChromium) boxes.disagreeKnuthPlass++;
      }
    } finally {
      page.remove();
    }
  }
  report.milliseconds = Math.round(performance.now() - started);
  return report;
}

/** Compara los cortes del motor con los de Chromium (no dibuja con el motor mientras mide). */
export async function composeReport(options: ComposeReportOptions = {}): Promise<ComposeReport> {
  suspended++;
  try {
    return await measureParity(options);
  } finally {
    suspended--;
  }
}

// ── Dibujo con el motor (paso 4 del plan; sólo con la llave prendida) ──
//
// La página la sigue armando paper() con el DOM de siempre. Después, composePage (lo instala
// src/compose-loader.ts con extend.result('paper', …)) reemplaza el texto de cada párrafo que el
// motor puede componer por sus líneas: un bloque por línea con el texto que decidió el motor, el
// guion si corta y el espacio entre palabras de la justificación (word-spacing). Chromium sigue
// conformando las palabras con la misma fuente; ya no decide los cortes ni la justificación.
// Pantalla, vista continua y PDF usan el mismo paper(), así que tienen los mismos cortes.
//
// Los cortes no dependen del zoom: el motor compone con el cuerpo como lo usa Chromium a la escala
// de la salida (96/25,4 px por mm), igual en pantalla que en el PDF.
//
// El alto del párrafo queda fijo en líneas × interlineado, así que el desborde (checkOverflow y
// preflightBook comparan el alto del contenido con el de la caja) sale de la cantidad de líneas
// del motor.

export type ComposeAlgorithm = 'knuth-plass' | 'greedy';

export interface ComposeDrawOptions {
  /** Como en composeReport: "familia|peso|estilo" → archivo, para el navegador sin catálogo. */
  fonts?: Record<string, string>;
}

const ALGORITHM_KEY = 'maquetario-compose-algorithm';
const OUTPUT_PX = 96 / 25.4;
let suspended = 0;
let drawFonts: Record<string, string> | undefined;

/** Ajuste de desarrollo: localStorage['maquetario-compose-algorithm'] = 'greedy' para el voraz. */
function algorithm(): ComposeAlgorithm {
  try {
    return localStorage.getItem(ALGORITHM_KEY) === 'greedy' ? 'greedy' : 'knuth-plass';
  } catch {
    return 'knuth-plass';
  }
}

export function setComposeAlgorithm(name: ComposeAlgorithm): void {
  try {
    localStorage.setItem(ALGORITHM_KEY, name);
  } catch {}
  composed.clear();
  redrawSoon();
}

export function configureDrawing(options: ComposeDrawOptions = {}): void {
  drawFonts = options.fonts;
  composed.clear();
}

// Fuentes ya cargadas, para usarlas sin esperar dentro de paper(); las que faltan se piden y,
// cuando llegan, se redibuja.
const readyFonts = new Map<string, ComposeFont>();
const failedFonts = new Set<string>();
function fontNow(url: string): ComposeFont | undefined {
  const font = readyFonts.get(url);
  if (!font && !failedFonts.has(url))
    fontFrom(url)
      .then((loaded) => {
        if (readyFonts.has(url)) return;
        readyFonts.set(url, loaded);
        redrawSoon();
      })
      .catch(() => failedFonts.add(url));
  return font;
}

let redrawTimer: number | undefined;
function redrawSoon(): void {
  if (redrawTimer !== undefined) return;
  redrawTimer = window.setTimeout(() => {
    redrawTimer = undefined;
    // Mientras se edita no se redibuja: al terminar de editar la página se vuelve a armar.
    if (!editing) render(true);
  }, 0);
}

/**
 * Tramos de un párrafo (estilos de carácter), PROVISORIO: la app todavía no tiene estilos dentro
 * de un párrafo ni una interfaz para crearlos. El motor lee, sólo con la llave prendida,
 * o.paragraphMap[i].runs = [{ start, end, overrides }], con los mismos campos de formato que un
 * párrafo (font, fontFaceId, fontWeight, fontItalic, bold, italic, size, tracking, fontAxes…).
 * Lo que no cubre ningún tramo va con el formato del párrafo. El dibujo de siempre (CSS) no los
 * muestra: el formato definitivo se decide al sumar la función al editor.
 */
interface RunSpec {
  start: number;
  end: number;
  overrides: Record<string, any>;
}

/** Los tramos del párrafo como formatos completos que cubren todo el texto (uno solo si no hay). */
function paragraphRuns(
  o: BookObject,
  index: number,
  text: string,
  f: Record<string, any>,
): { start: number; end: number; format: Record<string, any>; styled: boolean }[] {
  const specs: RunSpec[] = (o.paragraphMap?.[index]?.runs ?? [])
    .filter(
      (r: RunSpec) =>
        r &&
        Number.isInteger(r.start) &&
        Number.isInteger(r.end) &&
        r.start < r.end &&
        r.start >= 0 &&
        r.end <= text.length,
    )
    .sort((a: RunSpec, b: RunSpec) => a.start - b.start);
  const runs: { start: number; end: number; format: Record<string, any>; styled: boolean }[] = [];
  let at = 0;
  for (const spec of specs) {
    if (spec.start < at) continue; // tramos encimados: vale el primero
    if (spec.start > at) runs.push({ start: at, end: spec.start, format: f, styled: false });
    runs.push({
      start: spec.start,
      end: spec.end,
      format: { ...f, ...(spec.overrides || {}) },
      styled: true,
    });
    at = spec.end;
  }
  if (at < text.length) runs.push({ start: at, end: text.length, format: f, styled: false });
  return runs;
}

/** CSS de un tramo, como paragraphs.ts arma el del párrafo; el cuerpo, relativo al del párrafo. */
function runStyle(
  format: Record<string, any>,
  weight: number,
  paragraphSize: number,
): Record<string, string> {
  const face = drawFonts ? undefined : selectedFace(format);
  return {
    fontFamily: face ? `"MQT_${face.id}", "${format.font}"` : format.font,
    // En la página se escala con el resto: el cuerpo va en em del párrafo.
    fontSize: format.size / paragraphSize + 'em',
    fontWeight: String(weight),
    fontStyle: format.fontItalic || format.italic ? 'italic' : 'normal',
    fontVariationSettings: Object.entries(format.fontAxes || {})
      .map(([tag, value]) => `"${tag}" ${value}`)
      .join(','),
    letterSpacing: (format.tracking || 0) / 1000 + 'em',
  };
}

interface ComposedSegment {
  text: string;
  /** Espacio que se suma a cada espacio del trozo (justificación), en puntos. */
  extra: number;
  /** CSS del tramo, o null si es el del párrafo. */
  style: Record<string, string> | null;
}

/** Un tramo ya resuelto: lo que el PDF propio necesita para escribir sus glifos. */
interface ComposedRun {
  font: ComposeFont;
  url: string;
  variations: Record<string, number>;
  /** Cuerpo con que se compuso (el de Chromium), en puntos. */
  size: number;
  color: string;
  italic: boolean;
}

/** Lo que se guarda de cada párrafo compuesto: las filas para el DOM y las líneas del motor. */
interface ComposedEntry {
  text: string;
  rows: ComposedSegment[][];
  lines: Line[];
  runs: ComposedRun[];
}

const composed = new Map<string, ComposedEntry>();

/** Qué composición dibujó cada párrafo del DOM (la lee composePdfLayout para el PDF propio). */
const drawnParagraphs = new WeakMap<HTMLElement, ComposedEntry>();

/** Las líneas del motor para un párrafo (en caché por texto, formato, fuentes y ancho). */
function composeParagraph(
  o: BookObject,
  index: number,
  text: string,
  f: Record<string, any>,
): ComposedEntry | null {
  if (unsupported(text)) return null;
  const sizePx = (size: number) => ((size * 25.4) / 72) * OUTPUT_PX;
  // El cuerpo como lo usa Chromium (px truncado a centésimas): así el ancho de cada palabra en
  // pantalla coincide con el del motor y el borde derecho queda parejo.
  const chromiumSize = (size: number) =>
    ((Math.floor(sizePx(size) * 100) / 100) * size) / sizePx(size);
  const runs = [];
  for (const run of paragraphRuns(o, index, text, f)) {
    const resolved = resolveFace(run.format, drawFonts);
    if (typeof resolved === 'string') return null;
    const file = fontNow(resolved.url);
    if (!file) return null;
    const variations = cssVariations(run.format, resolved.weight, sizePx(run.format.size));
    runs.push({
      ...run,
      url: resolved.url,
      weight: resolved.weight,
      variations,
      font: withVariations(file, variations),
      size: chromiumSize(run.format.size),
      letterSpacing: ((run.format.tracking || 0) / 1000) * run.format.size,
    });
  }
  const width = (o.w - (f.indentLeft || 0) - (f.indentRight || 0)) * PT_PER_MM;
  const indent = (f.firstIndent || 0) * PT_PER_MM;
  const justify = f.align === 'justify';
  const options = engineOptions(f);
  const method = algorithm();
  const key = JSON.stringify([
    text,
    runs.map((r) => [r.start, r.end, r.url, r.variations, r.size, r.letterSpacing, r.styled]),
    width,
    indent,
    justify,
    options.hyphenate,
    options.language,
    method,
  ]);
  let entry = composed.get(key);
  if (!entry) {
    const paragraph = createRunParagraph(
      runs.map((r) => ({
        text: text.slice(r.start, r.end),
        font: r.font,
        size: r.size,
        letterSpacing: r.letterSpacing,
      })),
      { ...options, size: runs[0]!.size },
    );
    const styles = runs.map((r) => (r.styled ? runStyle(r.format, r.weight, f.size) : null));
    const lines = breakLines(paragraph, width, { algorithm: method, indent, justify }).lines;
    entry = {
      text,
      lines,
      rows: lines.map((line) =>
        line.segments.map((segment) => ({
          text: segment.text,
          extra: segment.spaceExtra,
          style: styles[segment.run] ?? null,
        })),
      ),
      runs: runs.map((r) => ({
        font: r.font,
        url: r.url,
        variations: r.variations,
        size: r.size,
        color: r.format.color || '#000000',
        italic: !!(r.format.fontItalic || r.format.italic),
      })),
    };
    composed.set(key, entry);
  }
  return entry;
}

const NBSP = String.fromCharCode(0xa0);

/**
 * El texto de un trozo de línea. El espacio duro va en su propio elemento sin word-spacing: el
 * navegador le sumaría la justificación (CSS lo trata como separador de palabras) y el motor no.
 */
function fillText(target: HTMLElement, text: string, justified: boolean): void {
  if (!justified || !text.includes(NBSP)) {
    target.append(text);
    return;
  }
  text.split(NBSP).forEach((part, i) => {
    if (i > 0) {
      const hard = document.createElement('span');
      hard.className = 'mqt-nbsp';
      hard.textContent = NBSP;
      target.append(hard);
    }
    if (part) target.append(part);
  });
}

/** El objeto que se está editando: ése se queda con el texto de siempre. */
const isEditing = (o: BookObject) => editing?.dataset.id === o.id;

/** extend.result('paper', …): dibuja con el motor los párrafos que puede componer. */
export function composePage(page: HTMLElement, pageIndex: number, px: number): HTMLElement {
  if (suspended || !page) return page;
  const pxPerPt = (px * 25.4) / 72;
  for (const o of book.pages[pageIndex]?.objects ?? []) {
    if (o.type !== 'text' || o.toc || isEditing(o)) continue;
    const box = page.querySelector<HTMLElement>(`[data-id="${o.id}"] .text-content`);
    if (!box) continue;
    o.text.split('\n').forEach((text: string, index: number) => {
      if (!text.trim()) return;
      const element = box.querySelector<HTMLElement>(`[data-paragraph-index="${index}"]`);
      const f = paragraphFormat(book, o, index);
      const entry = element && composeParagraph(o, index, text, f);
      if (!element || !entry) return;
      const lines = entry.rows;
      drawnParagraphs.set(element, entry);
      element.classList.add('mqt-composed');
      element.replaceChildren(
        ...lines.map((segments) => {
          const row = document.createElement('div');
          row.className = 'mqt-line';
          const plain = segments.length === 1 && !segments[0]!.style;
          for (const segment of segments) {
            // Un trozo con el estilo del párrafo va directo en la línea; un tramo, en su elemento.
            const target = plain ? row : document.createElement('span');
            if (segment.style) Object.assign(target.style, segment.style);
            const justified = Math.abs(segment.extra) > 1e-6;
            if (justified) target.style.wordSpacing = segment.extra * pxPerPt + 'px';
            fillText(target, segment.text, justified);
            if (target !== row) row.append(target);
          }
          return row;
        }),
      );
      // Alto fijo: líneas del motor × interlineado (de esto sale el desborde).
      element.style.height = lines.length * ((f.leading * 25.4) / 72) * px + 'px';
    });
  }
  return page;
}

/** extend.after('startEditing', …): el cuadro que se edita vuelve al texto de siempre (CSS). */
export function restoreForEditing(element: HTMLElement): void {
  if (editing !== element) return;
  const o = selectObject();
  if (!o || o.type !== 'text' || o.id !== element.dataset.id) return;
  const lines = o.text.split('\n');
  element.querySelectorAll<HTMLElement>('.mqt-composed').forEach((paragraph) => {
    paragraph.classList.remove('mqt-composed');
    paragraph.style.removeProperty('height');
    paragraph.textContent = lines[Number(paragraph.dataset.paragraphIndex)] || ' ';
  });
}

/** Las fuentes (direcciones) y caras del catálogo que necesitan los párrafos del libro. */
function bookFontNeeds(): { urls: Set<string>; faces: Set<NativeFontFace> } {
  const urls = new Set<string>();
  const faces = new Set<NativeFontFace>();
  for (const p of book.pages)
    for (const o of p.objects as BookObject[]) {
      if (o.type !== 'text' || o.toc) continue;
      o.text.split('\n').forEach((text: string, index: number) => {
        if (!text.trim() || unsupported(text)) return;
        const f = paragraphFormat(book, o, index);
        for (const run of paragraphRuns(o, index, text, f)) {
          const resolved = resolveFace(run.format, drawFonts);
          if (typeof resolved === 'string') continue;
          urls.add(resolved.url);
          // La cara de un tramo la registra el motor (las de los párrafos, ensureBookFonts).
          const face = run.styled && !drawFonts ? selectedFace(run.format) : undefined;
          if (face) faces.add(face);
        }
      });
    }
  return { urls, faces };
}

/** Si todas las fuentes que el libro le pide al motor ya llegaron (o fallaron). */
export function outputComplete(): boolean {
  return [...bookFontNeeds().urls].every((url) => readyFonts.has(url) || failedFonts.has(url));
}

/** Carga en el motor (y en la página, para los tramos) las fuentes del libro, sin redibujar. */
export async function loadBookFonts(): Promise<void> {
  const { urls, faces } = bookFontNeeds();
  await Promise.all([
    ...[...urls].map((url) =>
      fontFrom(url)
        .then((font) => readyFonts.set(url, font))
        .catch(() => failedFonts.add(url)),
    ),
    ...[...faces].map((face) => ensureFace(face).catch(() => {})),
  ]);
  await document.fonts.ready;
}

/**
 * Carga las fuentes de todos los párrafos que el motor puede componer en el libro abierto y
 * redibuja. La salida (prepareOutput, preparePrint) ya lo espera sola (src/compose-loader.ts).
 */
export async function composeReady(): Promise<void> {
  await loadBookFonts();
  if (!editing) render(true);
}

// ── PDF propio (paso 6 del plan): de la salida armada a una descripción para escribir el PDF ──
//
// composePdfLayout lee #printRoot ya armado (prepareOutput, con la llave prendida) y devuelve,
// por hoja, lo que hay que dibujar en puntos desde la esquina superior izquierda:
// - los párrafos compuestos por el motor, glifo por glifo, con las posiciones del motor (la
//   línea se ubica donde la puso la página y la línea de base sale de una marca en el DOM);
// - el resto del texto (cornisas, folios, índice, párrafos que el motor saltea) palabra por
//   palabra donde lo ubicó Chromium, conformado con el motor en la misma fuente: no se recompone;
// - imágenes PNG y JPEG y filetes (bordes lisos).
// Lo que no sabe dibujar lo cuenta en `notes`. El proceso principal escribe el PDF
// (desktop/src/main/compose-pdf.ts) con las fuentes recortadas; la forma de los datos está en
// src/contract/pdf-layout.ts. Las medidas del DOM sólo valen
// con el medio "print" emulado (el proceso principal lo pide antes de llamar).

const PX_TO_PT = 72 / 96;

const parseColor = (css: string): [number, number, number] => {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = /rgba?\(([^)]+)\)/.exec(css);
  if (rgb) {
    const [r, g, b] = rgb[1]!.split(/[\s,/]+/).map(Number);
    return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255];
  }
  return [0, 0, 0];
};

/** Las fuentes del PDF: una por archivo e instancia, con los glifos que se usan. */
class PdfFonts {
  readonly list = new Map<string, { font: ComposeFont; info: PdfFont }>();
  use(font: ComposeFont, url: string, italic: boolean): string {
    const key = url + JSON.stringify(font.variations);
    if (!this.list.has(key)) {
      let name = 'Fuente';
      try {
        name = font.hbFace.getName(6, 'en') || font.hbFace.getName(4, 'en') || name;
      } catch {}
      this.list.set(key, {
        font,
        info: {
          key,
          url,
          variations: { ...font.variations },
          name: name.replace(/[^A-Za-z0-9-]/g, '') || 'Fuente',
          upem: font.upem,
          ascender: font.ascender,
          descender: font.descender,
          italic,
          widths: {},
          unicode: {},
        },
      });
    }
    return key;
  }
  glyph(key: string, gid: number, text: string): void {
    const entry = this.list.get(key)!;
    if (!(gid in entry.info.widths)) entry.info.widths[gid] = entry.font.hbFont.glyphHAdvance(gid);
    if (text && !(gid in entry.info.unicode)) entry.info.unicode[gid] = text;
  }
  space(key: string): number | undefined {
    return this.list.get(key)!.font.hbFont.glyph(32);
  }
}

/** Línea de base de un elemento de una línea: una marca vacía al final, en px. */
function baselineOf(row: HTMLElement): number {
  const probe = document.createElement('span');
  probe.className = 'mqt-baseline-probe';
  Object.assign(probe.style, { display: 'inline-block', width: '0', height: '0' });
  row.append(probe);
  const y = probe.getBoundingClientRect().bottom;
  probe.remove();
  return y;
}

/** Ascendente con que Chromium ubica el texto de un elemento (para las palabras del DOM), en px. */
const ascents = new Map<string, number>();
function ascentOf(element: HTMLElement): number {
  const key = getComputedStyle(element).font;
  const known = ascents.get(key);
  if (known !== undefined) return known;
  const sample = document.createElement('span');
  Object.assign(sample.style, { whiteSpace: 'nowrap' });
  sample.textContent = 'x';
  element.append(sample);
  const range = document.createRange();
  range.selectNodeContents(sample);
  const top = range.getBoundingClientRect().top;
  const ascent = baselineOf(sample) - top;
  sample.remove();
  ascents.set(key, ascent);
  return ascent;
}

/**
 * La cara con que el motor puede dibujar el texto de un elemento según su CSS calculado, y si
 * Chromium la engrosa o la inclina por su cuenta (negrita o cursiva sintéticas: la familia no
 * tiene esa cara). Lo sintético se imita en el PDF (trazo y sesgo), no se cambia de cara.
 */
function cssFace(
  style: CSSStyleDeclaration,
): { url: string; weight: number; fakeBold: boolean; fakeItalic: boolean } | null {
  const first = style.fontFamily
    .split(',')[0]!
    .trim()
    .replace(/^["']|["']$/g, '');
  const weight = Number(style.fontWeight) || 400;
  const italic = style.fontStyle === 'italic';
  const id = /^MQT_(.+)$/.exec(first)?.[1];
  let face: NativeFontFace | undefined;
  let url: string | undefined;
  if (id) {
    face = (globalThis.nativeFaces ?? []).find((f) => f.id === id);
    url = MaquetarioHost.fontUrl(id);
  } else if (drawFonts) {
    url = drawFonts[`${first}|${weight}|${italic ? 'italic' : 'normal'}`];
  } else {
    face = selectedFace({ font: first, fontWeight: weight, fontItalic: italic });
    if (face) url = MaquetarioHost.fontUrl(face.id);
  }
  if (!url) return null;
  const variable = !!face?.axes.some((axis) => axis.tag === 'wght');
  return {
    url,
    weight,
    fakeBold: !!face && !variable && weight - face.weight >= 200,
    fakeItalic: !!face && italic && !face.italic,
  };
}

/** Ejes de font-variation-settings ("wght" 650, "wdth" 85). */
function variationSettings(css: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of css.matchAll(/["']([A-Za-z0-9 ]{4})["']\s+(-?[\d.]+)/g))
    out[m[1]!] = Number(m[2]);
  return out;
}

/** Si el elemento o algún contenedor está girado (una traslación sola no cuenta). */
function rotated(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(node).transform);
    if (!m) continue;
    const [, b, c] = m[1]!.split(',').map(Number);
    if (Math.abs(b!) > 1e-6 || Math.abs(c!) > 1e-6) return true;
  }
  return false;
}

export async function composePdfLayout(): Promise<PdfLayout> {
  const root = document.querySelector<HTMLElement>('#printRoot');
  const sheets = [...(root?.querySelectorAll<HTMLElement>('.output-sheet') ?? [])];
  if (!sheets.length) throw new Error('No hay salida armada (#printRoot).');
  if (!sheets[0]!.getBoundingClientRect().width)
    throw new Error('La salida no tiene medidas: emulá el medio "print" antes.');
  const fonts = new PdfFonts();
  const layout: PdfLayout = { sheets: [], fonts: [], composedLines: 0, domWords: 0, notes: {} };
  const note = (why: string, n = 1) => (layout.notes[why] = (layout.notes[why] ?? 0) + n);
  const range = document.createRange();

  // Las fuentes del texto que queda del DOM se cargan antes (las de los párrafos ya están).
  const domFaces = new Map<string, Promise<ComposeFont | null>>();
  const domFont = (url: string) => {
    let promise = domFaces.get(url);
    if (!promise) domFaces.set(url, (promise = fontFrom(url).catch(() => null)));
    return promise;
  };

  for (const sheetElement of sheets) {
    const box = sheetElement.getBoundingClientRect();
    const sheet: PdfSheet = {
      width: box.width * PX_TO_PT,
      height: box.height * PX_TO_PT,
      texts: [],
      images: [],
      rects: [],
    };
    const xOf = (px: number) => (px - box.left) * PX_TO_PT;
    const yOf = (px: number) => (px - box.top) * PX_TO_PT;

    // ── Párrafos compuestos por el motor ──
    for (const paragraph of sheetElement.querySelectorAll<HTMLElement>('.mqt-composed')) {
      const entry = drawnParagraphs.get(paragraph);
      const page = paragraph.closest<HTMLElement>('.print-page');
      if (!entry || !page) {
        note('párrafo compuesto sin datos del motor');
        continue;
      }
      // Escala de la página en la hoja (pliegos, libritos): px de la página por px del libro.
      const k = page.getBoundingClientRect().width / ((book.width * 96) / 25.4);
      const rows = [...paragraph.querySelectorAll<HTMLElement>(':scope > .mqt-line')];
      rows.forEach((row, index) => {
        const line = entry.lines[index];
        if (!line?.glyphs.length) return;
        range.selectNodeContents(row);
        const first = [...range.getClientRects()].find((r) => r.width > 0);
        if (!first) return;
        layout.composedLines++;
        const baseline = yOf(baselineOf(row));
        const x0 = line.glyphs[0]!.x;
        const left = xOf(first.left);
        let current: PdfText | null = null;
        line.glyphs.forEach((glyph, i) => {
          const run = entry.runs[glyph.run]!;
          const key = fonts.use(run.font, run.url, run.italic);
          if (!current || current.font !== key) {
            current = {
              font: key,
              size: run.size * k,
              color: parseColor(run.color),
              y: baseline,
              glyphs: [],
            };
            sheet.texts.push(current);
          }
          const x = left + (glyph.x - x0) * k;
          // El texto del glifo (ToUnicode): de su carácter al del glifo siguiente, sin pasar el
          // final de la palabra; el guion que agrega el corte es "-".
          const next = line.glyphs[i + 1];
          let end = glyph.cluster + 1;
          while (end < entry.text.length && !/\s/.test(entry.text[end]!)) end++;
          if (next && !next.hyphen && next.cluster > glyph.cluster)
            end = Math.min(end, next.cluster);
          const text = glyph.hyphen
            ? '-'
            : next && next.cluster === glyph.cluster && !next.hyphen
              ? ''
              : entry.text.slice(glyph.cluster, end);
          fonts.glyph(key, glyph.id, text);
          current.glyphs.push({ gid: glyph.id, x });
          // Espacio entre palabras: un glifo de espacio, para que el texto se pueda copiar.
          if (next && !next.hyphen && /\s/.test(entry.text.slice(end, next.cluster))) {
            const space = fonts.space(key);
            if (space !== undefined) {
              fonts.glyph(key, space, ' ');
              current.glyphs.push({ gid: space, x: x + glyph.advance * k });
            }
          }
        });
      });
    }

    // ── El resto del texto: palabra por palabra, donde lo puso Chromium ──
    const walker = document.createTreeWalker(sheetElement, NodeFilter.SHOW_TEXT);
    const words: { node: Text; start: number; end: number; element: HTMLElement }[] = [];
    for (
      let node = walker.nextNode() as Text | null;
      node;
      node = walker.nextNode() as Text | null
    ) {
      const element = node.parentElement;
      if (!element || element.closest('.mqt-composed') || !node.data.trim()) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (rotated(element)) {
        note('texto girado');
        continue;
      }
      for (const m of node.data.matchAll(/[^\s]+/g))
        words.push({ node, start: m.index, end: m.index + m[0].length, element });
    }
    for (const word of words) {
      const style = getComputedStyle(word.element);
      const face = cssFace(style);
      if (!face) {
        note(`texto sin fuente para el motor (${style.fontFamily.split(',')[0]})`);
        continue;
      }
      const file = await domFont(face.url);
      if (!file) {
        note('texto con una fuente que no se pudo leer');
        continue;
      }
      const sizePx = parseFloat(style.fontSize);
      const font = withVariations(file, {
        wght: face.weight,
        wdth: 100,
        opsz: sizePx,
        ...variationSettings(style.fontVariationSettings),
      });
      const key = fonts.use(font, face.url, style.fontStyle === 'italic');
      if (face.fakeBold || face.fakeItalic) note('negrita o cursiva sintética (imitada en el PDF)');
      const spacing = (parseFloat(style.letterSpacing) || 0) * PX_TO_PT;
      const ascent = ascentOf(word.element);
      const color = parseColor(style.color);
      // Una palabra cortada al final de una línea (guion discrecional) se parte donde cambia la línea.
      const raw = word.node.data.slice(word.start, word.end);
      const pieces: { from: number; to: number; rect: DOMRect }[] = [];
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === SOFT_HYPHEN) continue;
        range.setStart(word.node, word.start + i);
        range.setEnd(word.node, word.start + i + 1);
        const rect = [...range.getClientRects()].find((r) => r.width > 0);
        if (!rect) continue;
        const last = pieces.at(-1);
        if (last && Math.abs(last.rect.top - rect.top) < 1) last.to = i + 1;
        else pieces.push({ from: i, to: i + 1, rect });
      }
      pieces.forEach((piece, p) => {
        const text =
          raw.slice(piece.from, piece.to).replaceAll(SOFT_HYPHEN, '') +
          (p < pieces.length - 1 ? '-' : '');
        const shaped = shape(font, text, { size: sizePx * PX_TO_PT, letterSpacing: spacing });
        const item: PdfText = {
          font: key,
          size: sizePx * PX_TO_PT,
          color,
          y: yOf(piece.rect.top + ascent),
          glyphs: [],
          ...(face.fakeBold ? { fakeBold: true } : {}),
          ...(face.fakeItalic ? { fakeItalic: true } : {}),
        };
        let x = xOf(piece.rect.left);
        shaped.glyphs.forEach((glyph, i) => {
          const next = shaped.glyphs[i + 1];
          const end = next && next.cluster > glyph.cluster ? next.cluster : text.length;
          fonts.glyph(
            key,
            glyph.id,
            next?.cluster === glyph.cluster ? '' : text.slice(glyph.cluster, end),
          );
          item.glyphs.push({ gid: glyph.id, x: x + glyph.xOffset });
          x += glyph.advance;
        });
        sheet.texts.push(item);
      });
      if (pieces.length) layout.domWords++;
    }

    // ── Imágenes y filetes ──
    for (const image of sheetElement.querySelectorAll<HTMLImageElement>('img')) {
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (!/^data:image\/(png|jpeg);base64,/.test(image.src)) {
        note('imagen que no es PNG ni JPEG');
        continue;
      }
      const style = getComputedStyle(image);
      const nw = image.naturalWidth || rect.width;
      const nh = image.naturalHeight || rect.height;
      const scale =
        style.objectFit === 'cover'
          ? Math.max(rect.width / nw, rect.height / nh)
          : style.objectFit === 'contain'
            ? Math.min(rect.width / nw, rect.height / nh)
            : style.objectFit === 'none'
              ? 1
              : NaN;
      const w = Number.isNaN(scale) ? rect.width : nw * scale;
      const h = Number.isNaN(scale) ? rect.height : nh * scale;
      if (style.objectPosition && !/^50% 50%$/.test(style.objectPosition))
        note('imagen con object-position (se centra)');
      sheet.images.push({
        src: image.src,
        x: xOf(rect.left + (rect.width - w) / 2),
        y: yOf(rect.top + (rect.height - h) / 2),
        width: w * PX_TO_PT,
        height: h * PX_TO_PT,
        clip: {
          x: xOf(rect.left),
          y: yOf(rect.top),
          width: rect.width * PX_TO_PT,
          height: rect.height * PX_TO_PT,
        },
      });
    }
    for (const element of sheetElement.querySelectorAll<HTMLElement>('*')) {
      const style = getComputedStyle(element);
      if (element.closest('svg')) continue;
      const rect = element.getBoundingClientRect();
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        const width = parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`));
        const kind = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
        if (!width || kind === 'none' || kind === 'hidden') continue;
        if (kind !== 'solid' && kind !== 'dotted') {
          note(`filete ${kind}`);
          continue;
        }
        const color = parseColor(style.getPropertyValue(`border-${side.toLowerCase()}-color`));
        const horizontal = side === 'Top' || side === 'Bottom';
        sheet.rects.push({
          x: xOf(side === 'Right' ? rect.right - width : rect.left),
          y: yOf(side === 'Bottom' ? rect.bottom - width : rect.top),
          width: (horizontal ? rect.width : width) * PX_TO_PT,
          height: (horizontal ? width : rect.height) * PX_TO_PT,
          color,
          ...(kind === 'dotted' ? { dotted: true } : {}),
        });
      }
    }
    const shapes = sheetElement.querySelectorAll('svg').length;
    if (shapes) note('figuras (SVG)', shapes);
    layout.sheets.push(sheet);
  }
  layout.fonts = [...fonts.list.values()].map((entry) => entry.info);
  return layout;
}
