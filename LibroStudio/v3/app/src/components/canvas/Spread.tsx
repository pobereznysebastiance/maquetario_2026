// El pliego del lienzo (etapa 3, D2, lienzo paso 5): React decide qué páginas o filas se ven y
// llena cada lugar con el papel.
//
//   pliego           las páginas del pliego actual, directo en #spread (como siempre)
//   vista continua   una <section class="continuous-row"> por pliego, en una sola columna; sólo se
//                    llenan las filas cercanas a la vista (al desplazarse, se llenan y se vacían)
//
// El papel (paper + screenPage, studio.ts) sigue siendo una isla imperativa: cada lugar lo llena en
// un useLayoutEffect, y cada dibujo arma páginas nuevas, como antes. renderPages() de studio.ts es
// una fachada: canvas-layer.ts la engancha a drawSpread(), que calcula la escala y el ancla del
// zoom y dibuja en el acto (al volver, el DOM ya está al día).
//
// Absorbe lo que hacían alrededor de renderPages canvas-navigation (el ancla del zoom antes del
// dibujo, el tamaño de la superficie, la posición del pliego y el desplazamiento después) y
// continuous-canvas (la vista continua en lugar del pliego, la clase canvas-continuous, la página
// visible al desplazarse y el llenado de filas).
//
// Este archivo no tiene efectos al cargar: la raíz se monta con el primer dibujo.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { editor } from '../../core-api.ts';
import type { CanvasAnchor, ContinuousRow } from '../../continuous-canvas.ts';
import { refreshCanvasBar } from '../canvas-bar/canvas-bar-state.ts';
import { mount } from '../../react/mount.tsx';
import { drawingPages, ensureSelectionLayer } from './SelectionLayer.tsx';

/** Separación entre filas de la vista continua (px). */
const canvasGap = 38;

/** Un pliego a dibujar. */
interface SpreadPlan {
  mode: 'spread';
  revision: number;
  first: number;
  count: number;
  vertical: boolean;
  scale: number;
  /** Punto del lienzo que estaba en el centro, para volver a ponerlo ahí. */
  anchor: CanvasAnchor | null;
  key: string;
}
/** La vista continua a dibujar. */
interface ContinuousPlan {
  mode: 'continuous';
  revision: number;
  rows: { start: number; count: number; height: number; offset: number }[];
  vertical: boolean;
  scale: number;
  width: number;
  height: number;
  anchor: CanvasAnchor | null;
  key: string;
}
type Plan = SpreadPlan | ContinuousPlan;

let plan: Plan | null = null;
let revision = 0;
/** Parte visible de la mesa (vista continua): las filas cercanas se llenan. */
let viewport: { top: number; bottom: number; height: number } | null = null;
/** Página de la vista continua que quedó marcada como visible. */
let continuousSpread = -1;

let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  version += 1;
  for (const listener of listeners) listener();
};
let mounted = false;
/** Un dibujo pedido durante un arrastre, que espera a que termine. */
let postponed = false;

// ── Antes de dibujar: escala, filas y ancla ──

/** Pliego: el ancla y la clave son las de canvas-navigation; la escala, calculateScale(). */
function planSpread(): SpreadPlan {
  const stageRect = canvasStage.getBoundingClientRect();
  const anchor = canvasSpreadKey
    ? canvasAnchor(
        stageRect.left + canvasStage.clientWidth / 2,
        stageRect.top + canvasStage.clientHeight / 2,
      )
    : null;
  const key =
    String(verticalSpread()) +
    ':' +
    editor.book.pages
      .slice(editor.spread, editor.spread + (editor.book.facing ? 2 : 1))
      .map((p) => p.id)
      .join('|');
  calculateScale();
  return {
    mode: 'spread',
    revision,
    first: editor.spread,
    count: Math.min(editor.book.pages.length - editor.spread, editor.book.facing ? 2 : 1),
    vertical: verticalSpread(),
    scale: editor.scale,
    anchor,
    key,
  };
}

/** Vista continua: todas las filas en una columna, con la escala de un pliego entero. */
function planContinuous(): ContinuousPlan {
  const book = editor.book,
    stage = canvasStage.getBoundingClientRect(),
    key = [book.pages[0]?.id, book.facing, verticalSpread()].join(':');
  const anchor =
    continuousKey === key && continuousRows.length && continuousSpread === editor.spread
      ? canvasAnchor(
          stage.left + canvasStage.clientWidth / 2,
          stage.top + canvasStage.clientHeight / 2,
        )
      : null;
  const step = book.facing ? 2 : 1,
    vertical = verticalSpread(),
    referenceWidth = book.width * (vertical ? 1 : step),
    referenceHeight = book.height * (vertical ? step : 1);
  editor.scale =
    Math.max(
      0.15,
      Math.min(
        (canvasStage.clientWidth - 58) / referenceWidth,
        (canvasStage.clientHeight - 56) / referenceHeight,
      ),
    ) * editor.zoom;
  const scale = editor.scale,
    rows: ContinuousPlan['rows'] = [];
  let height = 0;
  for (let start = 0; start < book.pages.length; start += step) {
    const count = Math.min(step, book.pages.length - start),
      rowHeight = book.height * scale * (vertical ? count : 1) + (vertical && count === 2 ? 2 : 0);
    rows.push({ start, count, height: rowHeight, offset: height + (start ? canvasGap : 0) });
    height += rowHeight + (start ? canvasGap : 0);
  }
  return {
    mode: 'continuous',
    revision,
    rows,
    vertical,
    scale,
    width: referenceWidth * scale + (!vertical && step === 2 ? 2 : 0),
    height,
    anchor,
    key,
  };
}

/**
 * Dibuja el lienzo (la fachada renderPages de studio.ts): calcula qué se ve y lo dibuja en el
 * acto.
 */
export function drawSpread(): void {
  // Durante un arrastre no se redibuja: el nodo que se mueve tiene la captura del puntero y el
  // dibujo lo reemplazaría. Se dibuja al terminar el arrastre.
  if (editor.drag) {
    if (!postponed) {
      postponed = true;
      const retry = () => {
        if (editor.drag) requestAnimationFrame(retry);
        else {
          postponed = false;
          drawSpread();
        }
      };
      requestAnimationFrame(retry);
    }
    return;
  }
  // El nodo editable es del papel: el dibujo lo reemplaza, así que la edición se cierra antes.
  if (editor.editing) finishEditing();
  if (!mounted) {
    mounted = true;
    const host = document.createElement('div');
    host.hidden = true;
    host.className = 'spread-root';
    document.body.append(host);
    mount(host, <Spread />, { sync: true });
  }
  // La capa de selección se monta antes (montarla dentro de un dibujo de React no es en el acto).
  ensureSelectionLayer();
  const spreadHost = $('#spread');
  // Antes de cada dibujo, con o sin vista continua.
  refreshCanvasBar();
  spreadHost.classList.toggle('canvas-continuous', continuousCanvas);
  if (!continuousCanvas) {
    continuousRows = [];
    continuousKey = '';
  }
  revision += 1;
  plan = continuousCanvas ? planContinuous() : planSpread();
  viewport = null;
  flushSync(notify);
  requestAnimationFrame(checkOverflow);
}

// ── Al desplazarse (vista continua): la página visible y las filas cercanas ──

function markVisiblePage(): void {
  const center = canvasStage.scrollTop + canvasStage.clientHeight / 2 - canvasPadding;
  const visible = continuousRows.findLast((row) => row.offset <= center) || continuousRows[0];
  if (
    !visible ||
    visible.start === editor.spread ||
    editor.editing ||
    editor.drag ||
    editor.selected
  )
    return;
  editor.active = editor.spread = visible.start;
  continuousSpread = editor.spread;
  // La página activa la marca la capa de selección, con el aviso de updateStatus de abajo.
  $$('#thumbnails .thumb').forEach((thumb, index) =>
    thumb.classList.toggle(
      'active',
      index === Math.floor(editor.spread / (editor.book.facing ? 2 : 1)),
    ),
  );
  updateStatus();
  if (editor.tab === 'pages') inspector();
}

const readViewport = () => ({
  top: canvasStage.scrollTop,
  bottom: canvasStage.scrollTop + canvasStage.clientHeight,
  height: canvasStage.clientHeight,
});

let scrollFrame = 0;
/** El desplazamiento de la mesa (canvas-layer.ts lo escucha). */
export function onCanvasScroll(): void {
  if (!continuousCanvas || !continuousRows.length || scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (!continuousCanvas) return;
    markVisiblePage();
    viewport = readViewport();
    flushSync(notify);
    requestAnimationFrame(checkOverflow);
  });
}

// ── Dibujo ──

/** Llena #spread con las páginas del pliego (el lugar es #spread mismo). */
const SpreadPages = ({ plan }: { plan: SpreadPlan }) => {
  useLayoutEffect(() => {
    const host = $('#spread');
    drawingPages(() => {
      host.classList.toggle('spread-vertical', plan.vertical);
      host.replaceChildren();
      for (let i = plan.first; i < plan.first + plan.count; i++)
        host.append(screenPage(paper(i, plan.scale), i, plan.scale));
    });
    const width = editor.book.width * (plan.vertical ? 1 : plan.count),
      height = editor.book.height * (plan.vertical ? plan.count : 1);
    host.style.width = width * plan.scale + (!plan.vertical && plan.count === 2 ? 2 : 0) + 'px';
    host.style.height = height * plan.scale + (plan.vertical && plan.count === 2 ? 2 : 0) + 'px';
    // Al cambiar a la vista continua (o al volver a dibujar), el pliego se va.
    return () => host.replaceChildren();
  }, [plan]);
  return null;
};

/** Una fila de la vista continua: se llena cuando está cerca de la vista y se vacía lejos. */
const Row = ({
  row,
  plan,
  rowRef,
}: {
  row: ContinuousPlan['rows'][number];
  plan: ContinuousPlan;
  rowRef: (start: number, el: HTMLElement | null) => void;
}) => {
  const y = canvasPadding + row.offset,
    keep =
      !!viewport &&
      y < viewport.bottom + viewport.height &&
      y + row.height > viewport.top - viewport.height;
  const own = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const element = own.current;
    if (!element) return;
    if (keep && !element.children.length)
      drawingPages(() => {
        for (let i = row.start; i < row.start + row.count; i++)
          element.append(screenPage(paper(i, plan.scale), i, plan.scale));
      });
    else if (!keep && !editor.drag && !(editor.editing && element.contains(editor.editing)))
      element.replaceChildren();
  });
  return (
    <section
      className={'continuous-row' + (plan.vertical ? ' continuous-row-vertical' : '')}
      style={{ height: row.height + 'px' }}
      ref={(el) => {
        own.current = el;
        rowRef(row.start, el);
      }}
    />
  );
};

/** La vista continua: las filas (portal en #spread), su tamaño y el ancla. */
const Continuous = ({ plan }: { plan: ContinuousPlan }) => {
  const elements = new Map<number, HTMLElement>();
  const rowRef = (start: number, el: HTMLElement | null) => {
    if (el) elements.set(start, el);
  };
  useLayoutEffect(() => {
    const host = $('#spread');
    host.classList.remove('spread-vertical');
    continuousRows = plan.rows.map((row) => ({ ...row, element: elements.get(row.start)! }));
    const surfaceWidth = Math.max(canvasStage.clientWidth, plan.width) + 2 * canvasPadding;
    Object.assign(canvasSurface.style, {
      width: surfaceWidth + 'px',
      height: Math.max(canvasStage.clientHeight, plan.height) + 2 * canvasPadding + 'px',
    });
    Object.assign(host.style, {
      width: plan.width + 'px',
      height: plan.height + 'px',
      left: (surfaceWidth - plan.width) / 2 + 'px',
      top: canvasPadding + 'px',
    });
    continuousKey = plan.key;
    continuousSpread = editor.spread;
    if (plan.anchor) restoreCanvasAnchor(plan.anchor);
    else {
      canvasStage.scrollLeft = (surfaceWidth - canvasStage.clientWidth) / 2;
      const row = continuousRows.find((item) => item.start === editor.spread) || continuousRows[0];
      canvasStage.scrollTop =
        canvasPadding + (row?.offset || 0) + ((row?.height || 0) - canvasStage.clientHeight) / 2;
    }
    // Con la vista ya en su lugar, se llenan las filas cercanas (en el acto).
    viewport = readViewport();
    notify();
    updateCanvasZoomDisplay();
    updateCanvasCursor();
  }, [plan]);
  return createPortal(
    plan.rows.map((row) => (
      <Row key={plan.revision + ':' + row.start} row={row} plan={plan} rowRef={rowRef} />
    )),
    $('#spread'),
  );
};

/** El pliego: tamaño de la superficie, posición y desplazamiento (antes, canvas-navigation). */
const SpreadView = ({ plan }: { plan: SpreadPlan }) => {
  useLayoutEffect(() => {
    const art = $('#spread'),
      width = parseFloat(art.style.width) || 1,
      height = parseFloat(art.style.height) || 1,
      surfaceWidth = Math.max(canvasStage.clientWidth, width) + canvasPadding * 2,
      surfaceHeight = Math.max(canvasStage.clientHeight, height) + canvasPadding * 2;
    Object.assign(canvasSurface.style, {
      width: surfaceWidth + 'px',
      height: surfaceHeight + 'px',
    });
    Object.assign(art.style, {
      position: 'absolute',
      left: (surfaceWidth - width) / 2 + 'px',
      top: (surfaceHeight - height) / 2 + 'px',
    });
    if (plan.anchor && plan.key === canvasSpreadKey) restoreCanvasAnchor(plan.anchor);
    else {
      canvasStage.scrollLeft = (surfaceWidth - canvasStage.clientWidth) / 2;
      canvasStage.scrollTop = (surfaceHeight - canvasStage.clientHeight) / 2;
    }
    canvasSpreadKey = plan.key;
    updateCanvasZoomDisplay();
    updateCanvasCursor();
  }, [plan]);
  return <SpreadPages key={plan.revision} plan={plan} />;
};

const Spread = () => {
  useSyncExternalStore(subscribe, () => version);
  if (!plan) return null;
  return plan.mode === 'spread' ? (
    <SpreadView plan={plan} />
  ) : (
    <Continuous key={plan.revision} plan={plan} />
  );
};
