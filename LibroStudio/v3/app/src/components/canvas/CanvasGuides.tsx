// Guías del lienzo (etapa 3, D2, lienzo paso 4): la grilla, los márgenes y las guías propias de
// cada página, las reglas y los indicadores del imán. Las dibuja la capa de selección
// (SelectionLayer.tsx) con portales, con el mismo marcado que antes armaban gridSvg (studio.ts) con
// la extensión de editorial.ts, renderPages / la vista continua (#rulerX, #rulerY) y layout-tools
// (.snap-indicator). Sólo de pantalla: la grilla y las guías del PDF las dibuja output.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { createPortal } from 'react-dom';
import { editor, M } from '../../core-api.ts';
import type { BookGuide } from '../../editorial.ts';

/** Grilla, caja de márgenes y guías propias de la página index, a px píxeles por mm. */
export const PageGrid = ({ index, px }: { index: number; px: number }) => {
  const b = editor.book,
    m = M.margins(b, index),
    g = b.grid,
    r = M.gridRect(b, index),
    cw = (r.w - g.gapX * (g.cols - 1)) / g.cols,
    rh = (r.h - g.gapY * (g.rows - 1)) / g.rows;
  const cells = [];
  if (g.enabled)
    for (let c = 0; c < g.cols; c++)
      for (let row = 0; row < g.rows; row++)
        cells.push(
          <rect
            key={c + ':' + row}
            x={r.x + c * (cw + g.gapX)}
            y={r.y + row * (rh + g.gapY)}
            width={cw}
            height={rh}
          />,
        );
  return (
    <div className="guides">
      <svg className="grid-svg" viewBox={`0 0 ${b.width} ${b.height}`}>
        <g fill="none" stroke="#65cee3" strokeWidth={0.65 / px} opacity=".58">
          {cells}
        </g>
        <rect
          x={m.left}
          y={b.margins.top}
          width={b.width - m.left - m.right}
          height={b.height - b.margins.top - b.margins.bottom}
          fill="none"
          stroke="#e282d6"
          strokeWidth={0.7 / px}
          opacity=".7"
        />
        <g stroke="#b7a2ff" fill="none" strokeWidth={0.8 / px} strokeDasharray="1 1">
          {((b.guides || []) as BookGuide[]).map((guide, i) =>
            guide.axis === 'v' ? (
              <line key={i} x1={guide.position} x2={guide.position} y1="0" y2={b.height} />
            ) : (
              <line key={i} y1={guide.position} y2={guide.position} x1="0" x2={b.width} />
            ),
          )}
        </g>
      </svg>
    </div>
  );
};

/** Una línea del imán: eje y distancia en píxeles desde el borde de la página. */
export interface SnapMark {
  axis: 'x' | 'y';
  offset: number;
}

/** Indicadores del imán durante un arrastre. */
export const SnapMarks = ({ marks }: { marks: SnapMark[] }) => (
  <>
    {marks.map((mark, i) => (
      <div
        key={i}
        className={'snap-indicator ' + mark.axis}
        style={mark.axis === 'x' ? { left: mark.offset + 'px' } : { top: mark.offset + 'px' }}
      />
    ))}
  </>
);

/** Las marcas de las reglas: el ancho y el alto del pliego (o de una fila de la vista continua). */
export const Rulers = () => {
  const b = editor.book,
    vertical = verticalSpread();
  let x: (string | number)[], y: (string | number)[];
  if (globalThis.continuousCanvas) {
    const step = b.facing ? 2 : 1,
      width = b.width * (vertical ? 1 : step),
      height = b.height * (vertical ? step : 1);
    x = Array.from({ length: 10 }, (_, i) => displayMeasure((i * width) / 10));
    y = Array.from({ length: 8 }, (_, i) => displayMeasure((i * height) / 8));
  } else {
    const count = Math.min(b.pages.length - editor.spread, b.facing ? 2 : 1),
      width = b.width * (vertical ? 1 : count),
      height = b.height * (vertical ? count : 1),
      unit = b.measurementUnit === 'cm' ? 10 : 1;
    x = Array.from({ length: 10 }, (_, i) => Number(((i * width) / 10 / unit).toFixed(1)));
    y = Array.from({ length: 8 }, (_, i) => Number(((i * height) / 8 / unit).toFixed(1)));
  }
  return (
    <>
      {createPortal(
        x.map((value, i) => <span key={i}>{value}</span>),
        $('#rulerX'),
      )}
      {createPortal(
        y.map((value, i) => <span key={i}>{value}</span>),
        $('#rulerY'),
      )}
    </>
  );
};
