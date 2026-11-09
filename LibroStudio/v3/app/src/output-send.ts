// Salida: las impresoras instaladas y el envío al anfitrión (imprimir o guardar el PDF). No tiene
// efectos al cargar: se importa. La ventana y el armado de las hojas están en output.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { setPrinters, type InstalledPrinter } from './components/output/printers.ts';
import { ow } from './output-words.ts';
import { i18n } from './i18n/language.ts';
import { notifyEditorState } from './react/editor-state.ts';
import type { OutputJob } from './output.ts';

/** Impresoras que devolvió el anfitrión la última vez. */
export let installedPrinters: InstalledPrinter[] = [];

/** Pide las impresoras al anfitrión y las pasa al selector de la ventana. */
export async function readPrinters(): Promise<void> {
  const selectedPrinter = $('#outPrinter')?.value;
  try {
    const result: InstalledPrinter[] = await nativeCall('printers');
    installedPrinters = result;
    if (!$('#outPrinter')) return;
    setPrinters({
      list: result,
      selected:
        result.find((p) => p.name === selectedPrinter)?.name ||
        (!selectedPrinter && result.find((p) => p.defaultPrinter)?.name) ||
        '',
    });
  } catch (error) {
    if ($('#outputError')) $('#outputError').textContent = (error as Error).message;
  }
}
/** Manda la salida al anfitrión. Con report, el error también se le pasa a quien llamó. */
export async function sendOutput(
  destination: string,
  config: OutputJob,
  report?: (message: string) => void,
): Promise<void> {
  const w = ow();
  if (busy) return;
  busy = true;
  document.querySelector('main')!.inert = true;
  // La barra superior (React) deshabilita Imprimir, Vista previa y Exportar mientras dura.
  notifyEditorState();
  toast(w.wait, 'info');
  try {
    if (!native) throw Error('Esta función requiere la app de escritorio de Maquetario.');
    const result = await nativeCall(destination === 'print' ? 'print' : 'outputPdf', config);
    if (destination === 'print') toast(w.done);
    else {
      const saved = await nativeCall('savePdf', {
        base64: result.base64,
        name:
          book.title +
          (config.options.kind === 'cover'
            ? ' - Cubierta'
            : config.options.mode === 'booklet'
              ? ' - booklet'
              : ' - Interior') +
          (result.pdfx ? ' - PDFX4' : ''),
      });
      toast(
        saved.saved ? i18n.tr('PDF guardado correctamente.') : i18n.tr('Exportación cancelada.'),
        saved.saved ? 'success' : 'info',
      );
    }
  } catch (error) {
    const message = w.error + (error as Error).message;
    // Quien llamó también lo muestra (la ventana de salida, en #outputError).
    report?.(message);
    toast(message, 'error');
  } finally {
    busy = false;
    document.querySelector('main')!.inert = false;
    notifyEditorState();
  }
}
