// Motor de composición (etapa 4) dentro de la app: módulo ES aparte que se carga a pedido, sólo
// con la llave prendida (src/compose-loader.ts). Trae packages/compose y HarfBuzz (WASM): por eso
// no va en build/app.js, que es un script clásico y se carga siempre.
//
// Por ahora no dibuja nada. composeReport mide la paridad con lo que hace hoy Chromium: compone
// cada párrafo del libro con el motor, al ancho de su caja, y compara sus cortes de línea con los
// del DOM de la página (Range.getClientRects sobre el mismo paper() que usan la salida y la
// revisión del libro, fuera de la pantalla). Plan: docs/MOTOR_09-nov_composicion.md.
//
// Fuente TypeScript: se compila a build/compose.mjs (desktop/scripts/build.mjs); harfbuzz.wasm
// se copia al lado.
import type { BookObject } from '../model.ts';
import {
  breakLines,
  type ComposeFont,
  createParagraph,
  type Hyphenator,
  type HyphenLanguage,
  loadFont,
  SOFT_HYPHEN,
} from '../../../../../packages/compose/src/browser.ts';

export interface ComposeReportOptions {
  /** Páginas a medir (índices desde 0). Por defecto, todas. */
  pages?: number[];
  /** Píxeles por milímetro del DOM que se compara. Por defecto 96/25,4, como la salida. */
  px?: number;
  /**
   * Fuentes para medir cuando no hay catálogo (navegador sin escritorio): "familia|peso|estilo"
   * → dirección del archivo, por ejemplo { "Georgia|400|normal": "/fonts/georgia.ttf" }.
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
  knuthPlass: { lines: number; equal: number };
  /** Si algún corte voraz difiere de Chromium: el texto de cada línea de los dos. */
  greedyMismatch?: { chromium: string[]; greedy: string[] };
}

export interface ComposeReport {
  paragraphs: { measured: number; empty: number; skipped: Record<string, number> };
  chromiumLines: number;
  /** Corte voraz del motor: lo más parecido a lo que hace Chromium; mide si las medidas coinciden. */
  greedy: AlgorithmParity;
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
  milliseconds: number;
  rows?: ParagraphRow[];
}

const PT_PER_MM = 72 / 25.4;

const fontCache = new Map<string, Promise<ComposeFont>>();
function fontFrom(url: string): Promise<ComposeFont> {
  let font = fontCache.get(url);
  if (!font) {
    font = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`No se pudo leer la fuente ${url} (${response.status})`);
      return loadFont(await response.arrayBuffer());
    });
    fontCache.set(url, font);
  }
  return font;
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
});

function tally(parity: AlgorithmParity, engine: number[], chromium: number[], length: number) {
  const equal = equalLines(engine, chromium, length);
  parity.lines += engine.length;
  parity.equalLines += equal;
  if (equal === engine.length && engine.length === chromium.length) parity.identical++;
  const difference = String(engine.length - chromium.length);
  parity.lineCountDifference[difference] = (parity.lineCountDifference[difference] ?? 0) + 1;
  return equal;
}

/** Por qué un párrafo no se puede comparar todavía (null: se puede). */
function unsupported(text: string, f: Record<string, any>): string | null {
  if (f.tracking) return 'interletraje (tracking)';
  if (f.fontAxes && Object.keys(f.fontAxes).length) return 'ejes variables';
  if (/[\t]|\s{2}|^\s|\s$/.test(text))
    return 'espacios múltiples, tabulaciones o blancos en los bordes';
  return null;
}

export async function composeReport(options: ComposeReportOptions = {}): Promise<ComposeReport> {
  const started = performance.now();
  finishEditing();
  await ensureBookFonts();
  await document.fonts.ready;
  const px = options.px ?? 96 / 25.4;
  const report: ComposeReport = {
    paragraphs: { measured: 0, empty: 0, skipped: {} },
    chromiumLines: 0,
    greedy: emptyParity(),
    knuthPlass: emptyParity(),
    boxes: {
      measured: 0,
      overflowChromium: 0,
      overflowGreedy: 0,
      overflowKnuthPlass: 0,
      disagreeGreedy: 0,
      disagreeKnuthPlass: 0,
    },
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
          const reason = element ? unsupported(text, f) : 'sin párrafo en el DOM';
          const italic = !!(f.fontItalic || f.italic);
          let url: string | undefined;
          let problem = reason;
          if (!problem && options.fonts) {
            const weight = f.fontWeight ?? (f.bold ? 700 : 400);
            url = options.fonts[`${f.font}|${weight}|${italic ? 'italic' : 'normal'}`];
            if (!url) problem = 'sin archivo de fuente para medir';
          } else if (!problem) {
            const face = selectedFace(f);
            const weight = f.fontWeight ?? (f.bold ? 700 : face?.weight || 400);
            if (!face) problem = 'sin cara del catálogo';
            else if (fontLoadErrors.has(face.id)) problem = 'la cara no se pudo cargar';
            else if (Math.abs(weight - face.weight) >= 200 || (italic && !face.italic))
              problem = 'negrita o cursiva inventada por el navegador';
            else url = MaquetarioHost.fontUrl(face.id);
          }
          const chromium = !problem && element ? chromiumLineStarts(element) : null;
          if (problem || !url || !chromium) {
            skip(problem ?? 'no se pudieron leer las líneas');
            boxMeasured = false;
            continue;
          }
          const font = await fontFrom(url);
          const language = (
            ['es', 'en', 'pt'].includes(f.hyphenLanguage) ? f.hyphenLanguage : 'es'
          ) as HyphenLanguage;
          const paragraph = createParagraph(font, text, {
            size: f.size,
            language,
            hyphenate: !!f.hyphenate,
            hyphenator: pageHyphenator(language),
            // Los puntos de corte los decide el separador, como en la página.
            leftMin: 1,
            rightMin: 1,
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
          const knuthPlass = starts(breakLines(paragraph, width, layout).lines);
          report.paragraphs.measured++;
          report.chromiumLines += chromium.length;
          const equalGreedy = tally(report.greedy, greedy, chromium, text.length);
          const equalKnuthPlass = tally(report.knuthPlass, knuthPlass, chromium, text.length);
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
            knuthPlass: { lines: knuthPlass.length, equal: equalKnuthPlass },
            ...(equalGreedy !== chromium.length || greedy.length !== chromium.length
              ? {
                  greedyMismatch: {
                    chromium: slices(text, chromium),
                    greedy: slices(text, greedy),
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
