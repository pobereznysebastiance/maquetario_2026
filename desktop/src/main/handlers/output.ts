// Salida: PDF, impresión y lista de impresoras.
// Port de HostPrinting.cs y de Export/savePdf en Host.cs.
import { dialog, type WebContentsPrintOptions } from 'electron';
import { writeFile } from 'node:fs/promises';
import { delay, exec, exclusive, waitFor, type Session } from '../session.ts';

const MM_PER_INCH = 25.4;

export interface PageGeometry {
  width: number;
  height: number;
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
    'window.outputReady===true && window.fontOutputReady!==false && window.shapeOutputReady!==false',
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
      return { base64: (await pdf(session, page)).toString('base64') };
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
      const bytes = await pdf(session, {
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
