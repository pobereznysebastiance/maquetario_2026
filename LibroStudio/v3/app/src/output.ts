// Salida del interior: diálogo de imprimir o exportar PDF (orden de páginas, papel, marcas de
// corte y de plegado, guías, copias y doble faz), armado de las hojas en #printRoot para que el
// anfitrión las imprima o las pase a PDF, vista previa de la primera cara, lista de impresoras y
// envío. Suma el botón Imprimir a la barra y el atajo Ctrl+P.
//
// Publica sus funciones (globalThis + declare global) porque las usan otros archivos, las pruebas
// y el anfitrión (window.prepareOutput), y porque varias se extienden por nombre: prepareOutput
// (cubierta, fuentes, figuras), outputPreview y outputDialog. Por eso se definen directamente
// sobre globalThis y adentro se llaman por el global: así cada llamada pasa por las extensiones,
// igual que cuando eran funciones de un script clásico.
//
// La ventana de salida es React (components/output/OutputWindow.tsx, Ventana de trabajo): acá se
// abre (outputDialog), se escuchan sus campos y se arma la simulación (outputPreview).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { createElement } from 'react';
import type { Language } from './i18n.ts';
import { OutputWindow } from './components/output/OutputWindow.tsx';
import { setPrinters, type InstalledPrinter } from './components/output/printers.ts';

/** Opciones de una salida. El diálogo las trae todas; la autoprueba y la cubierta (kind = 'cover') piden sólo algunas. */
export interface OutputConfig {
  kind?: string;
  mode?: string;
  paper?: string;
  fit?: boolean;
  crop?: boolean;
  staples?: boolean;
  grid?: boolean;
  guides?: boolean;
  margins?: boolean;
  headers?: boolean;
  folios?: boolean;
}

/** Opciones tal como salen del diálogo de salida. */
export interface OutputDialogConfig extends OutputConfig {
  mode: string;
  paper: string;
  fit: boolean;
  crop: boolean;
  grid: boolean;
  guides: boolean;
  margins: boolean;
  headers: boolean;
  folios: boolean;
}

/** Medidas de la hoja de salida (mm) y qué páginas van en cada cara. */
export interface OutputGeometry {
  width: number;
  height: number;
  ratio: number;
  faces: number[][];
  vertical: boolean;
  columns: number;
  rows: number;
  booklet: boolean;
}

/** Lo que devuelve prepareOutput: medidas de la hoja (mm), cantidad de caras y escala. */
export interface OutputInfo {
  width: number;
  height: number;
  faces: number;
  scale: number;
}

/** Pedido de salida al anfitrión (type y no interface: nativeCall pide un objeto indexable). */
export type OutputJob = {
  options: OutputConfig;
  printer?: string;
  copies: number;
  duplex: string;
  /** Sólo PDF: PDF/X-4 para imprenta (docs/IMPRENTA_09-nov_pdfx.md → "Contrato"). */
  pdfx?: boolean;
  /** Título del documento PDF/X (XMP e Info). */
  title?: string;
};

/** La elección "PDF para imprenta" se recuerda en el programa (no en el libro). */
const PDFX_STORE = 'maquetario-output-pdfx';
function pdfxPreferred(): boolean {
  try {
    return localStorage.getItem(PDFX_STORE) === '1';
  } catch {
    return false;
  }
}
function rememberPdfx(on: boolean): void {
  try {
    localStorage.setItem(PDFX_STORE, on ? '1' : '0');
  } catch {
    // Sin almacenamiento: vale hasta cerrar la app.
  }
}

const outputWords = {
  es: {
    print: 'Imprimir',
    title: 'Preparar impresión',
    pdf: 'Preparar PDF',
    printer: 'Impresora de Windows',
    refresh: 'Actualizar impresoras',
    none: 'No hay impresoras instaladas en Windows.',
    loading: 'Buscando impresoras…',
    mode: 'Orden de páginas',
    reading: 'Páginas individuales',
    booklet: 'Cuadernillo para abrochado',
    paper: 'Papel de salida',
    custom: 'Tamaño del libro',
    trim: 'Marcas de corte',
    grid: 'Grilla de filas y columnas',
    guides: 'Guías individuales',
    margins: 'Líneas de márgenes',
    header: 'Cornisas y titulillos',
    folio: 'Foliado',
    copies: 'Copias',
    duplex: 'Impresión doble faz',
    one: 'Una cara',
    short: 'Doble faz · borde corto',
    long: 'Doble faz · borde largo',
    send: 'Imprimir ahora',
    save: 'Guardar PDF',
    fit: 'Reducir si no entra en el papel',
    safe: 'Sin enviar nada hasta pulsar Imprimir ahora.',
    note: 'Las marcas de corte necesitan espacio alrededor del formato final. Se reserva un margen de 7 mm. Algunas impresoras tienen bordes no imprimibles: revisá el papel y sus capacidades.',
    preview: 'Vista previa de la primera cara',
    done: 'Trabajo enviado a la impresora.',
    wait: 'Preparando salida…',
    error: 'No se pudo completar la salida: ',
    unavailable: 'Seleccioná una impresora disponible.',
    sizeError:
      'El formato no entra en el papel con las opciones elegidas. Permití reducir o elegí un papel mayor.',
    sheets: 'caras de salida',
    noDuplex: 'Esta impresora no informa soporte de doble faz automática.',
    guidesNote: 'La grilla se puede imprimir aunque esté oculta en el editor.',
  },
  en: {
    print: 'Print',
    title: 'Prepare printing',
    pdf: 'Prepare PDF',
    printer: 'Windows printer',
    refresh: 'Refresh printers',
    none: 'No printers are installed in Windows.',
    loading: 'Finding printers…',
    mode: 'Page order',
    reading: 'Individual pages',
    booklet: 'Saddle-stitch booklet',
    paper: 'Output paper',
    custom: 'Book size',
    trim: 'Crop marks',
    grid: 'Row and column grid',
    guides: 'Individual guides',
    margins: 'Margin guides',
    header: 'Headers and running titles',
    folio: 'Page numbers',
    copies: 'Copies',
    duplex: 'Two-sided printing',
    one: 'One side',
    short: 'Two sides · short edge',
    long: 'Two sides · long edge',
    send: 'Print now',
    save: 'Save PDF',
    fit: 'Shrink if needed to fit paper',
    safe: 'Nothing is sent until you click Print now.',
    note: 'Crop marks need space around the trim size. A 7 mm margin is reserved. Some printers have unprintable edges: check the paper and printer capabilities.',
    preview: 'First side preview',
    done: 'Job sent to the printer.',
    wait: 'Preparing output…',
    error: 'Could not complete output: ',
    unavailable: 'Select an available printer.',
    sizeError:
      'The book does not fit on the selected paper. Allow shrinking or choose larger paper.',
    sheets: 'output sides',
    noDuplex: 'This printer does not report automatic duplex support.',
    guidesNote: 'The grid can be printed even when hidden in the editor.',
  },
  pt: {
    print: 'Imprimir',
    title: 'Preparar impressão',
    pdf: 'Preparar PDF',
    printer: 'Impressora do Windows',
    refresh: 'Atualizar impressoras',
    none: 'Não há impressoras instaladas no Windows.',
    loading: 'Buscando impressoras…',
    mode: 'Ordem das páginas',
    reading: 'Páginas individuais',
    booklet: 'Livreto para grampo central',
    paper: 'Papel de saída',
    custom: 'Tamanho do livro',
    trim: 'Marcas de corte',
    grid: 'Grade de linhas e colunas',
    guides: 'Guias individuais',
    margins: 'Linhas de margens',
    header: 'Cabeçalhos e títulos correntes',
    folio: 'Numeração',
    copies: 'Cópias',
    duplex: 'Impressão frente e verso',
    one: 'Um lado',
    short: 'Frente e verso · borda curta',
    long: 'Frente e verso · borda longa',
    send: 'Imprimir agora',
    save: 'Salvar PDF',
    fit: 'Reduzir se necessário para caber',
    safe: 'Nada é enviado antes de clicar em Imprimir agora.',
    note: 'As marcas de corte precisam de espaço ao redor do formato final. Uma margem de 7 mm é reservada. Algumas impressoras têm bordas não imprimíveis: confira o papel e seus recursos.',
    preview: 'Prévia da primeira face',
    done: 'Trabalho enviado à impressora.',
    wait: 'Preparando saída…',
    error: 'Não foi possível concluir a saída: ',
    unavailable: 'Selecione uma impressora disponível.',
    sizeError:
      'O formato não cabe no papel selecionado. Permita reduzir ou escolha um papel maior.',
    sheets: 'faces de saída',
    noDuplex: 'Esta impressora não informa suporte automático a frente e verso.',
    guidesNote: 'A grade pode ser impressa mesmo quando está oculta no editor.',
  },
};
export type OutputWords = (typeof outputWords)['es'];

declare global {
  /** Textos de la salida en el idioma actual. */
  var ow: () => OutputWords;
  var outputConfigFromDialog: () => OutputDialogConfig;
  /** Papel estándar (mm), girado para que la pieza entre a mayor escala. */
  var outputPaperDimensions: (
    format: string,
    artworkWidth: number,
    artworkHeight: number,
    pad?: number,
  ) => [number, number];
  /** Lanza un error legible si el libro no entra en el papel con esas opciones. */
  var outputGeometry: (config: OutputConfig) => OutputGeometry;
  /** Marcas de corte alrededor del formato final (mm). */
  var cropSvg: (x: number, y: number, w: number, h: number, pw: number, ph: number) => string;
  /** Arma las hojas de salida en #printRoot. */
  var prepareOutput: (config: OutputConfig) => OutputInfo;
  var outputPreview: () => void;
  var readPrinters: () => Promise<void>;
  var outputDialog: (destination: string) => Promise<void>;
  /** Manda la salida al anfitrión. Con report, el error también se le pasa a quien llamó. */
  var sendOutput: (
    destination: string,
    config: OutputJob,
    report?: (message: string) => void,
  ) => Promise<void>;
  /** Las imágenes de la salida terminaron de cargar (lo espera el anfitrión antes de imprimir). */
  var outputReady: boolean;
  /** Habilita o deshabilita la acción de la ventana de salida abierta (#outputApply). */
  var setOutputApplyDisabled: (disabled: boolean) => void;
  /** Cierra la ventana de salida abierta (interior o cubierta), al instante. */
  var closeOutputWindow: () => void;
}

globalThis.ow = () => outputWords[(globalThis.LibroI18n?.language || 'es') as Language];
let installedPrinters: InstalledPrinter[] = [];
globalThis.setOutputApplyDisabled = function (disabled) {
  const button = document.querySelector<HTMLButtonElement>('#outputApply');
  if (button) button.disabled = disabled;
};
globalThis.closeOutputWindow = function () {
  document.querySelector('#outputApply')?.closest('dialog')?.close();
};
globalThis.outputConfigFromDialog = function () {
  const config = {
    mode: $('#outMode').value,
    paper: $('#outPaper').value,
    fit: $('#outFit').checked,
    crop: $('#outCrop').checked,
    staples: $('#outStaples')?.checked,
    grid: $('#outGrid').checked,
    guides: $('#outGuides').checked,
    margins: $('#outMargins').checked,
    headers: $('#outHeaders').checked,
    folios: $('#outFolios').checked,
  };
  return config;
};
globalThis.outputPaperDimensions = function (format, artworkWidth, artworkHeight, pad = 0) {
  const [width, height] = (
    {
      A5: [148, 210],
      A4: [210, 297],
      A3: [297, 420],
      Letter: [215.9, 279.4],
    } as Record<string, [number, number]>
  )[format] || [210, 297];
  const scale = (w: number, h: number) =>
    Math.min((w - 2 * pad) / artworkWidth, (h - 2 * pad) / artworkHeight);
  return scale(height, width) > scale(width, height) ? [height, width] : [width, height];
};
globalThis.outputGeometry = function (config) {
  const booklet = config.mode === 'booklet',
    double = booklet || config.mode === 'spreads';
  const vertical = double && verticalSpread();
  const columns = double && !vertical ? 2 : 1,
    rows = vertical ? 2 : 1;
  const pad = config.crop ? 7 : 0;
  const trimWidth = book.width * columns,
    trimHeight = book.height * rows;
  let width = trimWidth + 2 * pad,
    height = trimHeight + 2 * pad;
  // Sin papel indicado, el cuadro de papeles cae en A4, como antes.
  if (config.paper !== 'book')
    [width, height] = outputPaperDimensions(config.paper as string, trimWidth, trimHeight, pad);
  const ratio = Math.min((width - 2 * pad) / trimWidth, (height - 2 * pad) / trimHeight, 1);
  if (ratio <= 0 || (!config.fit && ratio < 0.999)) throw Error(ow().sizeError);
  const pages = book.pages.map((_, i) => [i]);
  const spreads = pages.filter(([i]) => i % 2 === 0).map(([i]) => [i, i + 1]);
  const faces = booklet ? M.impose(book.pages.length) : double ? spreads : pages;
  return { width, height, ratio: config.fit ? ratio : 1, faces, vertical, columns, rows, booklet };
};
function overlaySvg(index: number, config: OutputConfig, px: number): string {
  const b = book,
    g = b.grid,
    m = M.margins(b, index),
    r = M.gridRect(b, index);
  let children = '';
  if (config.grid) {
    const w = (r.w - g.gapX * (g.cols - 1)) / g.cols,
      h = (r.h - g.gapY * (g.rows - 1)) / g.rows;
    for (let c = 0; c < g.cols; c++)
      for (let row = 0; row < g.rows; row++)
        children += `<rect x="${r.x + c * (w + g.gapX)}" y="${r.y + row * (h + g.gapY)}" width="${w}" height="${h}" fill="none" stroke="#59B7CC" stroke-width=".15"/>`;
  }
  if (config.margins)
    children += `<rect x="${m.left}" y="${b.margins.top}" width="${b.width - m.left - m.right}" height="${b.height - b.margins.top - b.margins.bottom}" fill="none" stroke="#79807B" stroke-width=".15"/>`;
  if (config.guides)
    for (const line of b.guides || [])
      children +=
        line.axis === 'v'
          ? `<path d="M${line.position} 0V${b.height}" stroke="#526EB3" stroke-width=".15"/>`
          : `<path d="M0 ${line.position}H${b.width}" stroke="#526EB3" stroke-width=".15"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="output-guides" viewBox="0 0 ${b.width} ${b.height}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">${children}</svg>`;
}
globalThis.cropSvg = function (x, y, w, h, pw, ph) {
  let lines: string[] = [];
  const length = 4,
    gap = 1.5;
  for (const a of [x, x + w])
    for (const b of [y, y + h]) {
      const left = a === x,
        top = b === y;
      lines.push(
        `M${a + (left ? -gap - length : gap)} ${b}h${length}`,
        `M${a} ${b + (top ? -gap - length : gap)}v${length}`,
      );
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="crop-marks" viewBox="0 0 ${pw} ${ph}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><path d="${lines.join(' ')}" fill="none" stroke="#111" stroke-width=".15"/></svg>`;
};
function foldMarks(
  geometry: OutputGeometry,
  x: number,
  y: number,
  w: number,
  h: number,
  config: OutputConfig,
): string {
  if (!geometry.booklet || (!config.crop && !config.staples)) return '';
  const vertical = geometry.vertical;
  const x1 = vertical ? x : x + w / 2;
  const y1 = vertical ? y + h / 2 : y;
  const x2 = vertical ? x + w : x1;
  const y2 = vertical ? y1 : y + h;
  const segment = vertical
    ? 'M' + (x1 - 5.5) + ' ' + y1 + 'h4 M' + (x2 + 1.5) + ' ' + y2 + 'h4'
    : 'M' + x1 + ' ' + (y1 - 5.5) + 'v4 M' + x2 + ' ' + (y2 + 1.5) + 'v4';
  const ticks = config.crop ? '<path d="' + segment + '" stroke="#111" stroke-width=".15"/>' : '';
  const dots = config.staples
    ? [0.25, 0.75]
        .map(
          (t) =>
            '<circle cx="' +
            (x1 + (x2 - x1) * t) +
            '" cy="' +
            (y1 + (y2 - y1) * t) +
            '" r=".38" fill="#555"/>',
        )
        .join('')
    : '';
  return (
    '<svg class="fold-marks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    geometry.width +
    ' ' +
    geometry.height +
    '" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">' +
    ticks +
    dots +
    '</svg>'
  );
}
globalThis.prepareOutput = function (config) {
  finishEditing();
  const geometry = outputGeometry(config),
    px = 96 / 25.4,
    root = $('#printRoot');
  const w = book.width * geometry.ratio,
    h = book.height * geometry.ratio;
  const trimWidth = w * geometry.columns,
    trimHeight = h * geometry.rows;
  const left = (geometry.width - trimWidth) / 2,
    top = (geometry.height - trimHeight) / 2;
  root.replaceChildren();
  const style = document.createElement('style');
  style.textContent = '@page{size:' + geometry.width + 'mm ' + geometry.height + 'mm;margin:0}';
  root.append(style);
  for (const face of geometry.faces) {
    const sheet = document.createElement('div');
    sheet.className = 'print-page output-sheet';
    sheet.style.width = geometry.width * px + 'px';
    sheet.style.height = geometry.height * px + 'px';
    for (const [side, index] of face.entries()) {
      if (index >= book.pages.length) continue;
      const x = left + (geometry.vertical ? 0 : side * w),
        y = top + (geometry.vertical ? side * h : 0);
      const art = paper(index, px * geometry.ratio, true);
      art.className = 'print-artwork';
      Object.assign(art.style, {
        position: 'absolute',
        left: x * px + 'px',
        top: y * px + 'px',
        overflow: 'hidden',
        background: 'white',
      });
      if (!config.headers)
        art.querySelectorAll('.auto-header,.auto-titulillo').forEach((node) => node.remove());
      if (!config.folios) art.querySelectorAll('.auto-folio').forEach((node) => node.remove());
      if (config.grid || config.guides || config.margins)
        art.insertAdjacentHTML('beforeend', overlaySvg(index, config, px));
      sheet.append(art);
    }
    if (config.crop)
      sheet.insertAdjacentHTML(
        'beforeend',
        cropSvg(left, top, trimWidth, trimHeight, geometry.width, geometry.height),
      );
    sheet.insertAdjacentHTML(
      'beforeend',
      foldMarks(geometry, left, top, trimWidth, trimHeight, config),
    );
    root.append(sheet);
  }
  window.outputReady = false;
  Promise.all([
    document.fonts.ready,
    ...Array.from(root.querySelectorAll('img'), (image) => image.decode().catch(() => {})),
  ]).then(() => (window.outputReady = true));
  return {
    width: geometry.width,
    height: geometry.height,
    faces: geometry.faces.length,
    scale: geometry.ratio,
  };
};

globalThis.outputPreview = function () {
  try {
    const info = prepareOutput(outputConfigFromDialog()),
      sheet = $('#printRoot .output-sheet').cloneNode(true) as HTMLElement,
      k = Math.min(430 / ((info.width * 96) / 25.4), 210 / ((info.height * 96) / 25.4));
    sheet.style.transform = `scale(${k})`;
    sheet.style.transformOrigin = 'top left';
    $('#outputPreview').replaceChildren(sheet);
    $('#outputSummary').textContent =
      `${info.width.toFixed(1)} × ${info.height.toFixed(1)} mm · ${info.faces} ${ow().sheets} · ${Math.round(info.scale * 100)}%`;
    $('#outputError').textContent = '';
    setOutputApplyDisabled(false);
  } catch (error) {
    $('#outputError').textContent = (error as Error).message;
    setOutputApplyDisabled(true);
  } finally {
    clearPrint();
  }
};
// Las impresoras las dibuja el selector de la ventana (PrinterSelect) a partir de esta lista: queda
// elegida la que estaba elegida o, si no había, la predeterminada.
globalThis.readPrinters = async function () {
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
};
globalThis.outputDialog = async function (destination) {
  const w = ow(),
    print = destination === 'print';
  /** Los puntos de abrochado sólo valen para el cuadernillo. */
  const syncStaples = () => {
    const box = $('#outStaples');
    box.disabled = $('#outMode').value !== 'booklet';
    box.closest('label')!.hidden = box.disabled;
  };
  setPrinters({ list: null, selected: '' });
  modal.workspace(
    print ? w.title : w.pdf,
    createElement(OutputWindow, {
      destination,
      pdfx: pdfxPreferred(),
      onFormChange: (target) => {
        // El zoom de la revisión (output-review.ts).
        if (target.id === 'outputReviewZoom') {
          setOutputReviewScale((target as HTMLSelectElement).value);
          outputPreview();
          return;
        }
        // PDF para imprenta: no cambia la simulación, sólo se recuerda.
        if (target.id === 'outPdfx') {
          rememberPdfx((target as HTMLInputElement).checked);
          return;
        }
        // Las opciones de salida (no los controles de la revisión, que tienen los suyos).
        if (!target.closest('.output-review-options')) return;
        outputPreview();
        if (target.id === 'outMode') syncStaples();
      },
      onExpand: () => {
        setOutputReviewScale('fit');
        outputPreview();
      },
    }),
    {
      variant: 'output-modal',
      action: {
        id: 'outputApply',
        label: print ? w.send : w.save,
        run: async () => {
          if (print && !$('#outPrinter').value) throw Error(w.unavailable);
          const options = outputConfigFromDialog(),
            printer = print ? $('#outPrinter').value : '',
            copies = print ? Number($('#outCopies').value) : 1,
            duplex = print ? $('#outDuplex').value : 'one',
            pdfx = !print && !!$('#outPdfx')?.checked;
          if (!Number.isInteger(copies) || copies < 1 || copies > 99) throw Error('1–99');
          if (
            print &&
            duplex !== 'one' &&
            !installedPrinters.find((p) => p.name === printer)?.duplex
          )
            throw Error(w.noDuplex);
          outputGeometry(options);
          if (!pdfx) {
            closeOutputWindow();
            sendOutput(destination, { options, printer, copies, duplex });
            return false;
          }
          // PDF/X-4: la ventana queda abierta mientras se arma (no se ve en el PDF: la impresión
          // sólo muestra #printRoot). Si falla, el error queda en la ventana; si sale, se cierra.
          let failure = '';
          setOutputApplyDisabled(true);
          await sendOutput(
            destination,
            { options, printer, copies, duplex, pdfx: true, title: book.title },
            (message) => (failure = message),
          );
          if (!$('#outputApply')) return false;
          setOutputApplyDisabled(false);
          if (failure) {
            $('#outputError').textContent = failure;
            $('#outputError').scrollIntoView({ block: 'nearest' });
          } else closeOutputWindow();
          return false;
        },
      },
    },
  );
  if (!$('#outputPreview')) return;
  if (print) readPrinters();
  outputPreview();
};
globalThis.sendOutput = async function (destination, config, report) {
  const w = ow();
  if (busy) return;
  busy = true;
  document.querySelector('main')!.inert = true;
  $('#printButton').disabled = $('#export').disabled = true;
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
        saved.saved
          ? LibroI18n.tr('PDF guardado correctamente.')
          : LibroI18n.tr('Exportación cancelada.'),
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
    $('#printButton').disabled = $('#export').disabled = false;
  }
};
const printButton = document.createElement('button');
printButton.id = 'printButton';
printButton.className = 'btn';
printButton.innerHTML =
  '<svg class="icon" viewBox="0 0 24 24"><path d="M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 13h12v8H6z M17 10h1"/></svg><span>Imprimir</span>';
printButton.onclick = () => outputDialog('print');
$('#preview').before(printButton);
$('#export').onclick = () => outputDialog('pdf');
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    if (!document.querySelector('#modal[open], #dialogLayer dialog[open]')) outputDialog('print');
  }
});
