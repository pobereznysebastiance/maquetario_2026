// Salida: PDF, impresión y lista de impresoras.
import { dialog, type WebContentsPrintOptions } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appVersion } from '../env.ts';
import { applyPdfX, pdfxHeader } from '../pdfx.ts';
import {
  applyPrintBoxes,
  openPdf,
  savePdf as savePdfDocument,
  type TrimSpec,
} from '../print-boxes.ts';
import { delay, exec, exclusive, waitFor, type Session } from '../session.ts';

const MM_PER_INCH = 25.4;

export interface PageGeometry {
  width: number;
  height: number;
  /** Escala del libro en la hoja (1 = tamaño real), como la informa prepareOutput. */
  scale?: number;
}

/** PDF de la página actual de la ventana, al tamaño indicado en milímetros, sin márgenes. */
export function pdf(session: Session, page: PageGeometry): Promise<Buffer> {
  return session.win.webContents.printToPDF({
    printBackground: true,
    displayHeaderFooter: false,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    pageSize: { width: page.width / MM_PER_INCH, height: page.height / MM_PER_INCH },
    scale: 1,
  });
}

/** Pedido de PDF/X-4 (pdfx.ts). El título va en el XMP y en el Info. */
export interface PdfXRequest {
  title: string;
}

/** Perfiles ICC de PDF/X (dist/icc, los copia scripts/build.mjs desde assets/icc). */
async function iccProfiles(): Promise<{ outputProfile: Buffer; rgbProfile: Buffer }> {
  const dir = join(__dirname, 'icc');
  const [outputProfile, rgbProfile] = await Promise.all([
    readFile(join(dir, 'FOGRA39L_coated.icc')),
    readFile(join(dir, 'sRGB.icc')),
  ]);
  return { outputProfile, rgbProfile };
}

/**
 * PDF con las cajas de imprenta exactas (print-boxes.ts): MediaBox de la hoja pedida y, si se
 * conoce, TrimBox y BleedBox del corte. Sin corte, el corte es la hoja entera.
 * Con `pdfx`, además PDF/X-4 con RGB etiquetado (pdfx.ts). Se abre y se guarda una sola vez.
 */
export async function exactPdf(
  session: Session,
  page: PageGeometry,
  trim?: TrimSpec | null,
  pdfx?: PdfXRequest | null,
): Promise<Buffer> {
  const raw = await pdf(session, page);
  try {
    const doc = await openPdf(raw);
    applyPrintBoxes(doc, page, trim);
    if (pdfx)
      applyPdfX(doc, {
        ...(await iccProfiles()),
        title: pdfx.title,
        creator: `Maquetario ${appVersion()}`,
      });
    const saved = await savePdfDocument(doc);
    return Buffer.from(pdfx ? pdfxHeader(saved) : saved);
  } catch (error) {
    // Con PDF/X pedido no se entrega otra cosa: la persona lo pidió para la imprenta.
    if (pdfx) throw new Error(`No se pudo armar el PDF/X-4: ${(error as Error).message}`);
    // Las cajas son una mejora: si pdf-lib no puede con el archivo, sale el PDF de Chromium.
    console.warn('[salida] no se pudieron fijar las cajas del PDF:', error);
    return raw;
  }
}

/** Título del libro abierto (para el PDF/X), si la ventana no lo manda. */
export async function bookTitle(session: Session): Promise<string> {
  const title = await exec<unknown>(session, 'book.title').catch(() => '');
  return typeof title === 'string' && title.trim() ? title.trim() : 'Maquetario';
}

/**
 * Corte y sangrado de una salida, en mm y a la escala de la hoja. Los datos salen de la interfaz
 * con la misma cuenta que usa prepareOutput: el interior es el libro (una o dos páginas por
 * cara, sin sangrado); la cubierta es el desplegado más la demasía (wrap), con su sangrado,
 * que es donde la interfaz pone las marcas de corte (src/publications.ts → coverArtwork).
 */
export async function printTrim(
  session: Session,
  options: unknown,
  scale = 1,
): Promise<TrimSpec | null> {
  const expression = `(()=>{try{const o=${JSON.stringify(options ?? {})}||{};
if(o.kind==='cover'){if(!book.cover)return null;const c=book.cover,g=coverGeometry(c),wrap=c.wrap||0;
return{width:g.width+2*wrap,height:g.height+2*wrap,bleed:c.bleed||0};}
const g=outputGeometry(o);return{width:book.width*g.columns,height:book.height*g.rows,bleed:0};
}catch{return null}})()`;
  const trim = await exec<TrimSpec | null>(session, expression).catch(() => null);
  if (!trim || ![trim.width, trim.height, trim.bleed].every(Number.isFinite)) return null;
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return { width: trim.width * k, height: trim.height * k, bleed: trim.bleed * k };
}

/**
 * Le pide a la interfaz que arme el DOM de impresión y espera a que imágenes,
 * fuentes y figuras estén listas. Devuelve el tamaño de página en mm.
 */
export async function prepareOutput(session: Session, options: unknown): Promise<PageGeometry> {
  const geometry = await exec<Partial<PageGeometry> | null>(
    session,
    `window.prepareOutput(${JSON.stringify(options)})`,
  );
  if (!geometry || !Number.isFinite(geometry.width) || !Number.isFinite(geometry.height)) {
    throw new Error('No se pudo preparar la salida.');
  }
  const ready = await waitFor(
    session,
    // composeOutputReady: con el motor de composición prendido, todos los párrafos compuestos.
    'window.outputReady===true && window.fontOutputReady!==false && window.shapeOutputReady!==false && window.composeOutputReady!==false',
    100,
    100,
  );
  if (!ready) throw new Error('Las imágenes no terminaron de preparar la salida.');
  return geometry as PageGeometry;
}

const clearPrint = (session: Session) =>
  exec(session, 'window.clearPrint()').catch(() => undefined);

export interface PrinterReply {
  name: string;
  defaultPrinter: boolean;
  duplex: boolean;
}

export async function printers(session: Session): Promise<PrinterReply[]> {
  const list = await session.win.webContents.getPrintersAsync();
  return list.map((p) => {
    const info = p as typeof p & { isDefault?: boolean };
    const options = (p.options ?? {}) as Record<string, string>;
    return {
      name: p.name,
      defaultPrinter: info.isDefault === true || options['is-default'] === 'true',
      // Chromium no informa si la impresora tiene doble faz: se ofrece y, si no puede, falla al imprimir.
      duplex: true,
    };
  });
}

function print(session: Session, options: WebContentsPrintOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    session.win.webContents.print(options, (success, reason) =>
      success
        ? resolve()
        : reject(new Error(`No se pudo imprimir: ${reason || 'error desconocido'}`)),
    );
  });
}

interface OutputPayload {
  options?: unknown;
  printer?: unknown;
  copies?: unknown;
  duplex?: unknown;
  /** Sólo outputPdf: true pide PDF/X-4 (docs/IMPRENTA_09-nov_pdfx.md → "Contrato"). */
  pdfx?: unknown;
  /** Título del documento para el PDF/X (si falta, el del libro). */
  title?: unknown;
}

/** outputPdf (physical=false) e print (physical=true). */
export function outputDocument(session: Session, payload: OutputPayload, physical: boolean) {
  return exclusive(session, 'Hay otra salida en curso.', async () => {
    try {
      const printer = physical ? String(payload.printer ?? '') : '';
      const copies = physical ? Number(payload.copies) : 1;
      const duplex = physical ? String(payload.duplex ?? 'one') : 'one';
      if (physical) {
        const available = await session.win.webContents.getPrintersAsync();
        if (!available.some((p) => p.name === printer))
          throw new Error('La impresora no está disponible.');
        if (!Number.isInteger(copies) || copies < 1 || copies > 99)
          throw new Error('Copias: 1–99.');
      }
      const page = await prepareOutput(session, payload.options);
      if (physical) {
        await print(session, {
          silent: true,
          deviceName: printer,
          copies,
          duplexMode: duplex === 'short' ? 'shortEdge' : duplex === 'long' ? 'longEdge' : 'simplex',
          printBackground: true,
          margins: { marginType: 'none' },
          // print() mide el papel en micrones.
          pageSize: {
            width: Math.round(page.width * 1000),
            height: Math.round(page.height * 1000),
          },
        });
        return { printed: true, printer };
      }
      const trim = await printTrim(session, payload.options, page.scale);
      const pdfx =
        payload.pdfx === true
          ? {
              title:
                typeof payload.title === 'string' && payload.title.trim()
                  ? payload.title.trim()
                  : await bookTitle(session),
            }
          : null;
      return {
        base64: (await exactPdf(session, page, trim, pdfx)).toString('base64'),
        pdfx: !!pdfx,
      };
    } finally {
      await clearPrint(session);
    }
  });
}

/** Exportación anterior (preparePrint), que todavía usa la interfaz. */
export function legacyExport(session: Session, payload: { width?: unknown; height?: unknown }) {
  return exclusive(session, 'Ya hay una exportación en curso.', async () => {
    try {
      await exec(session, 'window.preparePrint()');
      await delay(350);
      if (!(await waitFor(session, 'window.composeOutputReady!==false', 100, 100)))
        throw new Error('El motor de composición no terminó de preparar la salida.');
      const bytes = await exactPdf(session, {
        width: Number(payload.width),
        height: Number(payload.height),
      });
      return { base64: bytes.toString('base64') };
    } finally {
      await clearPrint(session);
    }
  });
}

/** Un PDF de libro con imágenes puede ser grande, pero no infinito: límite en base64 (~300 MB). */
const MAX_PDF_BASE64 = 400_000_000;

export async function savePdf(session: Session, payload: { name?: unknown; base64?: unknown }) {
  const base64 = String(payload.base64 ?? '');
  if (base64.length > MAX_PDF_BASE64) throw new Error('El PDF es demasiado grande para guardarlo.');
  const picked = await dialog.showSaveDialog(session.win, {
    defaultPath: `${String(payload.name ?? 'Maquetario')}.pdf`,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
  });
  if (picked.canceled || !picked.filePath) return { saved: false };
  await writeFile(picked.filePath, Buffer.from(base64, 'base64'));
  return { saved: true, path: picked.filePath };
}
