// Ventanas de salida (organismos, D4: Ventana de trabajo): imprimir o exportar el interior
// (OutputWindow) y la cubierta sobre una hoja (CoverSheetWindow). Se abren con modal.workspace
// desde output.ts (outputDialog) y print-proof.ts (coverSheetDialog).
//
// Es sólo el marco y el formulario. Lo que se ve de las páginas (la simulación de la hoja) lo
// arman outputPreview y sus extensiones (review-workspace: caras; print-proof: estado de la hoja;
// output-review: zoom) dentro de #outputPreview y #coverSheetPreview, con el mismo motor que el
// PDF: React no dibuja nada del libro.
//
// Los campos no son controlados: la salida los lee del DOM por id (outputConfigFromDialog, la
// cubierta y las pruebas, que también los cambian a mano y llaman a outputPreview). Los cambios
// se escuchan en captura sobre la ventana (onFormChange), así llegan también los "change" que no
// burbujean (los que disparan las pruebas).
//
// Ids que usan otros módulos, las pruebas y la autoprueba (no cambiarlos sin revisarlos):
// #outPrinter #refreshPrinters #outMode #outPaper #outCopies #outDuplex #outCrop #outStaples
// #outGrid #outGuides #outMargins #outHeaders #outFolios #outFit #outputPreview #outputSummary
// #outputError #reviewFaces #outputReviewZoom #outputReviewFactor #outputReviewExpand,
// .output-review-layout (.preview-expanded), #coverSheetPaper #coverSheetCrop #coverSheetFit
// #coverSheetCopies #coverSheetPreview #coverSheetSummary. La acción de la ventana es #outputApply.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Icon } from '../Icon.tsx';
import { useLanguage } from '../../react/mount.tsx';
import { printersSnapshot, subscribePrinters } from './printers.ts';
import { bw, i18n } from '../../i18n/language.ts';
import { ow } from '../../output-words.ts';

/** Escucha los "change" de la ventana en captura (también los que no burbujean). */
function useFormChange(onFormChange: (target: HTMLElement) => void) {
  const root = useRef<HTMLDivElement | null>(null);
  const handler = useRef(onFormChange);
  handler.current = onFormChange;
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const listener = (event: Event) => handler.current(event.target as HTMLElement);
    element.addEventListener('change', listener, true);
    return () => element.removeEventListener('change', listener, true);
  }, []);
  return root;
}

/**
 * Molécula: impresora de Windows (selector + volver a buscar). Las opciones salen de la lista que
 * carga readPrinters; mientras busca, muestra loadingLabel (si viene).
 */
const PrinterSelect = ({ loadingLabel }: { loadingLabel?: string }) => {
  const printers = useSyncExternalStore(subscribePrinters, printersSnapshot);
  const w = ow();
  return (
    <div className="printer-row">
      <select id="outPrinter" key={printers.version} defaultValue={printers.selected}>
        {printers.list === null ? (
          loadingLabel !== undefined ? (
            <option value="">{loadingLabel}</option>
          ) : null
        ) : printers.list.length ? (
          printers.list.map((printer) => (
            <option key={printer.name} value={printer.name}>
              {printer.name}
            </option>
          ))
        ) : (
          <option value="">{w.none}</option>
        )}
      </select>
      <button
        type="button"
        id="refreshPrinters"
        className="btn"
        title={bw('Volver a buscar', 'Refresh', 'Atualizar')}
        onClick={() => void readPrinters()}
      >
        <Icon name="refresh" />
      </button>
    </div>
  );
};

export interface OutputWindowProps {
  /** 'print' (Imprimir) o 'pdf' (Exportar PDF). */
  destination: string;
  /** Cambió un campo de la ventana (opciones o zoom). */
  onFormChange: (target: HTMLElement) => void;
  /** Se amplió o se volvió a mostrar las opciones. */
  onExpand: (expanded: boolean) => void;
  /** Sólo PDF: "PDF para imprenta (PDF/X-4)" arranca marcado (la última elección). */
  pdfx?: boolean;
}

/** Ventana de salida del interior: opciones a la izquierda, revisión de la salida a la derecha. */
export const OutputWindow = ({ destination, onFormChange, onExpand, pdfx }: OutputWindowProps) => {
  useLanguage();
  const [expanded, setExpanded] = useState(false);
  const root = useFormChange(onFormChange);
  const w = ow(),
    print = destination === 'print';
  const checks: [string, string, boolean][] = [
    ['Crop', w.trim, false],
    ['Staples', bw('Puntos de abrochado', 'Staple dots', 'Pontos de grampeamento'), false],
    ['Grid', w.grid, false],
    ['Guides', w.guides, false],
    ['Margins', w.margins, false],
    ['Headers', w.header, true],
    ['Folios', w.folio, true],
    ['Fit', w.fit, true],
  ];
  return (
    <div
      ref={root}
      className={expanded ? 'output-review-layout preview-expanded' : 'output-review-layout'}
    >
      <aside className="output-review-options">
        {print ? (
          <div className="control">
            <label>{w.printer}</label>
            <PrinterSelect loadingLabel={w.loading} />
          </div>
        ) : null}
        <div className="modal-grid output-grid">
          <div className="control">
            <label>{w.mode}</label>
            <select id="outMode" defaultValue="reading">
              <option value="reading">{w.reading}</option>
              <option value="spreads">
                {bw(
                  'Pliegos en orden de lectura',
                  'Spreads in reading order',
                  'Duplas na ordem de leitura',
                )}
              </option>
              <option value="booklet">{w.booklet}</option>
            </select>
          </div>
          <div className="control">
            <label>{w.paper}</label>
            <select id="outPaper" defaultValue={print ? 'A4' : 'book'}>
              <option value="book">{w.custom}</option>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          {print ? (
            <>
              <div className="control">
                <label>{w.copies}</label>
                <input id="outCopies" type="number" min="1" max="99" defaultValue="1" />
              </div>
              <div className="control">
                <label>{w.duplex}</label>
                <select id="outDuplex" defaultValue="one">
                  <option value="one">{w.one}</option>
                  <option value="short">{w.short}</option>
                  <option value="long">{w.long}</option>
                </select>
              </div>
            </>
          ) : null}
        </div>
        <div className="output-options">
          {checks.map(([id, label, on]) => (
            // Los puntos de abrochado sólo valen para el cuadernillo: arrancan escondidos.
            <label key={id} className="check-line" hidden={id === 'Staples'}>
              <input
                id={'out' + id}
                type="checkbox"
                defaultChecked={on}
                disabled={id === 'Staples'}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="help">{w.guidesNote}</p>
        {print ? null : (
          // PDF/X-4 con RGB etiquetado (desktop/src/main/pdfx.ts): la imprenta convierte a CMYK.
          <div className="output-pdfx">
            <label className="check-line">
              <input id="outPdfx" type="checkbox" defaultChecked={!!pdfx} />
              {i18n.tr('PDF para imprenta (PDF/X-4)')}
            </label>
            <p className="help">
              {i18n.tr(
                'El color queda en RGB etiquetado (sRGB) con la condición de impresión FOGRA39 (offset, papel estucado): la imprenta lo convierte a CMYK. Si te piden CMYK o PDF/X-1a, consultá antes.',
              )}
            </p>
          </div>
        )}
        <p id="outputError" className="inline-error"></p>
        <div className="notice">
          {w.note}
          {print ? (
            <>
              <br />
              {w.safe}
            </>
          ) : null}
        </div>
      </aside>
      <section className="output-review-pane">
        <div className="output-review-toolbar">
          <label htmlFor="outputReviewZoom">
            Zoom{' '}
            <select id="outputReviewZoom" defaultValue="fit">
              <option value="fit">
                {bw('Ajustar a ventana', 'Fit to window', 'Ajustar à janela')}
              </option>
              <option value="1">100%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
              <option value="3">300%</option>
            </select>
          </label>
          <span id="outputReviewFactor"></span>
          <button
            type="button"
            className="btn"
            id="outputReviewExpand"
            onClick={() => {
              flushSync(() => setExpanded(!expanded));
              onExpand(!expanded);
            }}
          >
            {expanded
              ? bw('Mostrar opciones', 'Show options', 'Mostrar opções')
              : bw('Ampliar revisión', 'Expand preview', 'Ampliar revisão')}
          </button>
        </div>
        <div className="output-preview-title">{w.preview}</div>
        {/* Navegación por caras: la arma review-workspace (outputPreview). */}
        <div id="reviewFaces"></div>
        {/* La simulación de la hoja: la arma outputPreview con el motor de salida. */}
        <div id="outputPreview"></div>
        <p id="outputSummary" className="help"></p>
      </section>
    </div>
  );
};

export interface CoverSheetWindowProps {
  /** Imprimir (true) o exportar PDF (false). */
  printing: boolean;
  /** Cambió el papel, las marcas o la reducción. */
  onFormChange: (target: HTMLElement) => void;
}

/** Ventana de salida de la cubierta: la pieza sobre una hoja, con marcas de corte y reducción. */
export const CoverSheetWindow = ({ printing, onFormChange }: CoverSheetWindowProps) => {
  useLanguage();
  const root = useFormChange(onFormChange);
  const w = ow();
  return (
    <div ref={root} className="cover-sheet-layout">
      <aside>
        {printing ? (
          <>
            <label htmlFor="outPrinter">{w.printer}</label>
            <PrinterSelect />
            <div className="control">
              <label htmlFor="coverSheetCopies">{w.copies}</label>
              <input
                id="coverSheetCopies"
                type="number"
                defaultValue="1"
                min="1"
                max="99"
                step=".1"
              />
            </div>
          </>
        ) : null}
        <div className="control">
          <label htmlFor="coverSheetPaper">{w.paper}</label>
          <select id="coverSheetPaper" defaultValue={printing ? 'A3' : 'actual'}>
            <option value="actual">
              {bw('Tamaño de la pieza', 'Artwork size', 'Tamanho da peça')}
            </option>
            {['A3', 'A4', 'A5', 'Letter'].map((paper) => (
              <option key={paper} value={paper}>
                {paper}
              </option>
            ))}
          </select>
        </div>
        <label className="check-line">
          <input id="coverSheetCrop" type="checkbox" defaultChecked />
          {w.trim}
        </label>
        <label className="check-line">
          <input id="coverSheetFit" type="checkbox" />
          {w.fit}
        </label>
        <p className="help">
          {bw(
            'La vista previa incluye el sangrado y la demasía. Si imprimís, revisá también el área imprimible del equipo.',
            'The preview includes bleed and wrap. Check your printer’s printable area before printing.',
            'A prévia inclui a sangria e a dobra. Antes de imprimir, confira a área imprimível do equipamento.',
          )}
        </p>
        <p id="outputError" className="inline-error"></p>
      </aside>
      <div>
        {/* La simulación de la hoja: la arma print-proof con el motor de salida. */}
        <div id="coverSheetPreview"></div>
        <p id="coverSheetSummary" className="help" aria-live="polite"></p>
      </div>
    </div>
  );
};
