// Cajas de imprenta exactas (etapa 4). printToPDF redondea el tamaño de la hoja: el PDF puede
// diferir 0,1–0,3 mm del pedido. Acá se reescriben, en cada página, MediaBox (la hoja pedida),
// CropBox (= MediaBox), TrimBox (el corte final) y BleedBox (corte + sangrado), en puntos y sin
// redondear.
//
// La hoja se ancla arriba a la izquierda, como la arma la interfaz: el contenido queda donde lo
// puso el CSS y lo que sobra (o falta) por el redondeo de Chromium queda abajo y a la derecha.
// El corte va centrado en la hoja (marcas de corte o papel más grande), igual que en
// src/output.ts → prepareOutput y en la cubierta (src/publications.ts).
//
// Usa la copia de pdf-lib que ya trae la interfaz (LibroStudio/v3/app/pdf-lib.min.js, MIT):
// esbuild la empaqueta en dist/main.cjs. Sin Electron: se prueba con node --test
// (desktop/test/print-boxes.test.ts).
// @ts-expect-error La copia minificada no trae tipos: se usan los de PdfLib, más abajo.
import * as vendored from '../../../LibroStudio/v3/app/pdf-lib.min.js';

/** Lo que se usa de pdf-lib. */
interface PdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface PdfPage {
  getMediaBox(): PdfBox;
  getCropBox(): PdfBox;
  getTrimBox(): PdfBox;
  getBleedBox(): PdfBox;
  setMediaBox(x: number, y: number, width: number, height: number): void;
  setCropBox(x: number, y: number, width: number, height: number): void;
  setTrimBox(x: number, y: number, width: number, height: number): void;
  setBleedBox(x: number, y: number, width: number, height: number): void;
}
export interface PdfDocument {
  getPages(): PdfPage[];
  addPage(size: [number, number]): PdfPage;
  save(options?: {
    useObjectStreams?: boolean;
    updateFieldAppearances?: boolean;
  }): Promise<Uint8Array>;
}
interface PdfLib {
  PDFDocument: {
    load(bytes: Uint8Array, options?: { updateMetadata?: boolean }): Promise<PdfDocument>;
    create(): Promise<PdfDocument>;
  };
}
// En el paquete (esbuild) el módulo viene con sus nombres; en Node, dentro de default.
const ns = vendored as Partial<PdfLib> & { default?: PdfLib };
export const pdfLib: PdfLib = (ns.PDFDocument ? ns : ns.default) as PdfLib;
/** El módulo completo, para las piezas de bajo nivel (pdfx.ts las tipa por su cuenta). */
export const pdfLibModule: unknown = pdfLib;

export const POINTS_PER_MM = 72 / 25.4;

/** Medidas en mm. */
export interface Size {
  width: number;
  height: number;
}

/** Corte final dentro de la hoja (mm, ya a la escala de la salida) y sangrado alrededor. */
export interface TrimSpec extends Size {
  bleed: number;
}

/** Rectángulo en puntos, como lo escribe el PDF: [izquierda, abajo, derecha, arriba]. */
export type Box = [number, number, number, number];

export interface PageBoxes {
  media: Box;
  crop: Box;
  trim: Box;
  bleed: Box;
}

const finite = (n: number) => Number.isFinite(n) && n > 0;

/**
 * Cajas de una página. `current` es la MediaBox que escribió Chromium (para anclar arriba a la
 * izquierda); `sheet` la hoja pedida; `trim` el corte (sin él, el corte es la hoja entera).
 */
export function boxesFor(current: Box, sheet: Size, trim?: TrimSpec | null): PageBoxes {
  if (!finite(sheet.width) || !finite(sheet.height)) throw new Error('Hoja inválida.');
  const w = sheet.width * POINTS_PER_MM;
  const h = sheet.height * POINTS_PER_MM;
  const left = current[0];
  const top = current[3];
  const media: Box = [left, top - h, left + w, top];
  if (!trim || !finite(trim.width) || !finite(trim.height))
    return { media, crop: media, trim: media, bleed: media };
  // El corte nunca más grande que la hoja; el sangrado, hasta el borde de la hoja.
  const tw = Math.min(trim.width, sheet.width) * POINTS_PER_MM;
  const th = Math.min(trim.height, sheet.height) * POINTS_PER_MM;
  const x = left + (w - tw) / 2;
  const y = top - h + (h - th) / 2;
  const trimBox: Box = [x, y, x + tw, y + th];
  const b = Math.max(0, Number.isFinite(trim.bleed) ? trim.bleed : 0) * POINTS_PER_MM;
  const bleedBox: Box = [
    Math.max(media[0], x - b),
    Math.max(media[1], y - b),
    Math.min(media[2], x + tw + b),
    Math.min(media[3], y + th + b),
  ];
  return { media, crop: media, trim: trimBox, bleed: bleedBox };
}

const toBox = (b: PdfBox): Box => [b.x, b.y, b.x + b.width, b.y + b.height];
const set = (fn: (x: number, y: number, w: number, h: number) => void, b: Box) =>
  fn(b[0], b[1], b[2] - b[0], b[3] - b[1]);

/** Fija las cajas de todas las páginas de un documento ya abierto. */
export function applyPrintBoxes(doc: PdfDocument, sheet: Size, trim?: TrimSpec | null): void {
  for (const page of doc.getPages()) {
    const boxes = boxesFor(toBox(page.getMediaBox()), sheet, trim);
    set(page.setMediaBox.bind(page), boxes.media);
    set(page.setCropBox.bind(page), boxes.crop);
    set(page.setTrimBox.bind(page), boxes.trim);
    set(page.setBleedBox.bind(page), boxes.bleed);
  }
}

/** Abre un PDF sin tocar sus metadatos (conserva Producer y fechas del original). */
export const openPdf = (bytes: Uint8Array): Promise<PdfDocument> =>
  pdfLib.PDFDocument.load(bytes, { updateMetadata: false });

/** Guarda sin flujos de objetos: más compatible con los flujos de preimpresión. */
export const savePdf = (doc: PdfDocument): Promise<Uint8Array> =>
  doc.save({ useObjectStreams: false });

/** Reescribe las cajas de todas las páginas del PDF. Devuelve el PDF nuevo. */
export async function fixPrintBoxes(
  bytes: Uint8Array,
  sheet: Size,
  trim?: TrimSpec | null,
): Promise<Uint8Array> {
  const doc = await openPdf(bytes);
  applyPrintBoxes(doc, sheet, trim);
  return savePdf(doc);
}

/** Lee las cajas de cada página (para las pruebas y para revisar una salida). */
export async function readPrintBoxes(bytes: Uint8Array): Promise<PageBoxes[]> {
  const doc = await pdfLib.PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map((page) => ({
    media: toBox(page.getMediaBox()),
    crop: toBox(page.getCropBox()),
    trim: toBox(page.getTrimBox()),
    bleed: toBox(page.getBleedBox()),
  }));
}
