// Prueba de impresión: solapas y demasía de forrado en el editor de cubierta, tamaño de la pieza
// frente a la hoja en la salida del interior, y el diálogo para imprimir o exportar la cubierta
// sobre una hoja (con marcas de corte y reducción).
//
// coverFontFamily y coverSheetDialog son globales: los usan publications.js y cover-actions.js.
// La ventana de la cubierta sobre una hoja es React (components/output/OutputWindow.tsx,
// CoverSheetWindow); acá se abre y se arma su simulación con el motor de salida.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { createElement } from 'react';
import { CoverSheetWindow } from './components/output/OutputWindow.tsx';
import { setPrinters } from './components/output/printers.ts';
import { bw } from './i18n/language.ts';

declare global {
  /** Familia CSS por defecto para los textos de la cubierta (Georgia o su cara más cercana). */
  var coverFontFamily: () => string;
  /** Diálogo para imprimir o exportar la cubierta sobre una hoja. */
  var coverSheetDialog: (destination: string) => void;
}

function coverFontFamily(): string {
  const face = chooseDefaultFace('Georgia');
  return face ? '"MQT_' + face.id + '",Georgia,serif' : 'Georgia,serif';
}
globalThis.coverFontFamily = coverFontFamily;

extend.before(
  'updateCoverPreview',
  function () {
    if (coverDraft && !coverGeometry(coverDraft).parts.some((part) => part.id === coverPart))
      coverPart = 'front';
  },
  'print-proof',
);
extend.after(
  'updateCoverPreview',
  function () {
    for (const toggle of $$('[data-flap]')) toggle.checked = coverDraft![toggle.dataset.flap!] > 0;
    if ($('#coverPreview')) {
      const parts = new Set(coverGeometry(coverDraft!).parts.map((part) => part.id));
      for (const button of $$('[data-cover-edit]'))
        button.hidden = !parts.has(button.dataset.coverEdit!);
      if (coverDraft!.wrap)
        $('#coverDimensions').textContent +=
          ' · ' +
          bw(
            `+${displayMeasure(coverDraft!.wrap)} ${documentUnit()} de demasía por lado`,
            `+${displayMeasure(coverDraft!.wrap)} ${documentUnit()} wrap per edge`,
            `+${displayMeasure(coverDraft!.wrap)} ${documentUnit()} de dobra por lado`,
          );
    }
  },
  'print-proof',
);

function sheetSizeStatus(art: [number, number], paper: [number, number], ratio: number): string {
  const size = displayDimensions;
  const scale =
    ratio >= 0.9999
      ? bw('Tamaño real · 100%', 'Actual size · 100%', 'Tamanho real · 100%')
      : bw(
          `Reducido al ${(ratio * 100).toFixed(1)}%`,
          `Reduced to ${(ratio * 100).toFixed(1)}%`,
          `Reduzido a ${(ratio * 100).toFixed(1)}%`,
        );
  return (
    bw('Pieza', 'Artwork', 'Peça') +
    ' ' +
    size(...art) +
    ' · ' +
    bw('Hoja', 'Sheet', 'Folha') +
    ' ' +
    size(...paper) +
    ' · ' +
    scale
  );
}

// Estado de la hoja en la simulación del interior: antes se calcula (y, si no entra, la
// simulación se arma reducida); después se escribe y se vuelve a dejar la casilla como estaba.
// La simulación (review-workspace) atrapa sus propios errores, así que la de después siempre corre.
let sheetCheck: { fit: boolean; status: string; tooLarge: boolean } | 'failed' | null = null;
extend.before(
  'outputPreview',
  function () {
    sheetCheck = null;
    const checkbox = $('#outFit');
    if (!checkbox || !$('#outputPreview')) return;
    const config = outputConfigFromDialog();
    try {
      const trial = outputGeometry({ ...config, fit: true });
      const artwork = outputGeometry({ ...config, paper: 'book', fit: false });
      const status = sheetSizeStatus(
        [artwork.width, artwork.height],
        [trial.width, trial.height],
        trial.ratio,
      );
      const tooLarge = !config.fit && trial.ratio < 0.999;
      if (tooLarge) checkbox.checked = true;
      sheetCheck = { fit: config.fit, status, tooLarge };
    } catch {
      sheetCheck = 'failed';
    }
  },
  'print-proof',
);
extend.after(
  'outputPreview',
  function () {
    const check = sheetCheck;
    sheetCheck = null;
    if (!check) return;
    if (check === 'failed') {
      $('#outputPreview').replaceChildren();
      return;
    }
    $('#outFit').checked = check.fit;
    $('#outputSummary').textContent += ' · ' + check.status;
    if (check.tooLarge) {
      $('#outputError').textContent = bw(
        'La simulación está reducida. Activá la reducción o elegí una hoja mayor para exportar.',
        'The simulation is scaled down. Enable shrinking or choose a larger sheet to export.',
        'A simulação está reduzida. Ative a redução ou escolha uma folha maior para exportar.',
      );
      setOutputApplyDisabled(true);
    }
  },
  'print-proof',
);

function coverSheetDialog(destination: string): void {
  const printing = destination === 'print',
    w = ow();
  const title = printing
    ? bw('Imprimir cubierta', 'Print cover', 'Imprimir capa')
    : bw('Exportar cubierta', 'Export cover', 'Exportar capa');
  const config = () => ({
    kind: 'cover',
    paper: $('#coverSheetPaper').value,
    crop: $('#coverSheetCrop').checked,
    fit: $('#coverSheetFit').checked,
  });
  setPrinters({ list: null, selected: '' });
  modal.workspace(
    title,
    createElement(CoverSheetWindow, {
      printing,
      onFormChange: (target) => {
        if (['coverSheetPaper', 'coverSheetCrop', 'coverSheetFit'].includes(target.id)) refresh();
      },
    }),
    {
      variant: 'cover-sheet-dialog',
      action: {
        id: 'outputApply',
        label: printing ? w.send : w.save,
        run: () => {
          const options = config(),
            copies = printing ? Number($('#coverSheetCopies').value) : 1;
          const printer = printing ? $('#outPrinter').value : '';
          if (printing && !printer) throw Error(w.unavailable);
          if (!Number.isInteger(copies) || copies < 1 || copies > 99) throw Error('1–99');
          if (coverOverflow(book.cover))
            throw Error(
              bw(
                'Hay texto que no cabe en la cubierta.',
                'Some cover text does not fit.',
                'Há texto que não cabe na capa.',
              ),
            );
          prepareOutput(options);
          clearPrint();
          closeOutputWindow();
          void sendOutput(destination, { options, copies, printer, duplex: 'one' });
          return false;
        },
      },
    },
  );
  function refresh(): void {
    const box = $('#coverSheetPreview'),
      options = config();
    $('#outputError').textContent = '';
    try {
      const actual = prepareOutput({ ...options, paper: 'actual' });
      const trial = prepareOutput({ ...options, fit: true });
      const sheet = $('#printRoot .print-page').cloneNode(true) as HTMLElement,
        px = 96 / 25.4;
      const k = Math.min(
        (box.clientWidth - 24) / (trial.width * px),
        (box.clientHeight - 24) / (trial.height * px),
      );
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, {
        width: trial.width * px * k + 'px',
        height: trial.height * px * k + 'px',
      });
      Object.assign(sheet.style, { transform: `scale(${k})`, transformOrigin: 'top left' });
      wrapper.append(sheet);
      box.replaceChildren(wrapper);
      $('#coverSheetSummary').textContent = sheetSizeStatus(
        [actual.width, actual.height],
        [trial.width, trial.height],
        trial.scale,
      );
      const tooLarge = !options.fit && trial.scale < 0.999;
      if (tooLarge)
        $('#outputError').textContent = bw(
          'La simulación está reducida. Para exportarla así, activá la reducción o elegí una hoja mayor.',
          'The simulation is scaled down. Enable shrinking or select a larger sheet to export.',
          'A simulação está reduzida. Ative a redução ou escolha uma folha maior para exportar.',
        );
      setOutputApplyDisabled(tooLarge);
    } catch (error) {
      box.replaceChildren();
      $('#outputError').textContent = (error as Error).message;
      setOutputApplyDisabled(true);
    } finally {
      clearPrint();
    }
  }
  if (!$('#coverSheetPreview')) return;
  if (printing) void readPrinters();
  refresh();
}
globalThis.coverSheetDialog = coverSheetDialog;

export {};
