// Herramientas de maquetación: imán (ajuste magnético a grilla, márgenes y guías al mover o
// redimensionar), y capas (vista del riel para ordenar, ocultar, bloquear y nombrar objetos:
// components/rail/LayersView.tsx).
// Los objetos ocultos no se dibujan y los bloqueados no se seleccionan ni se editan.
//
// snapLines y snappedFrame son globales porque las usa tests/layout-tools-tests.js;
// updateSnapButton, porque la llama inspector-organization.js. El botón del imán lo dibuja la
// barra del documento en React (src/components/documentbar/DocumentBar.tsx) con snapButtonState()
// y toggleSnap(); updateSnapButton() sólo le avisa que se redibuje.
//
// Fuente TypeScript: se compila a build/layout-tools.js (desktop/scripts/build.mjs).
import type { Book, BookObject, Rect } from './model.ts';
import { notifyEditorState } from './react/editor-state.ts';
import { registerRailView } from './components/rail/rail-views.ts';
import { layersViewFor } from './components/rail/LayersView.tsx';

/** Posiciones (mm) a las que se ajusta el imán, por eje. */
export interface SnapLines {
  x: number[];
  y: number[];
}

/** Resultado del imán: el rectángulo ajustado y las líneas que tocó. */
export interface SnapResult {
  rect: Rect;
  hits: { axis: 'x' | 'y'; value: number }[];
}

declare global {
  /** Líneas de ajuste de una página: bordes, márgenes, columnas y filas de la grilla, y guías. */
  var snapLines: (b: Book, index: number) => SnapLines;
  /**
   * Ajusta un rectángulo a las líneas más cercanas dentro de la tolerancia. Con direction
   * (n, s, e, w o combinaciones) ajusta esos bordes al redimensionar; sin ella, lo mueve entero.
   */
  var snappedFrame: (
    rect: Rect,
    direction: string | false,
    lines: SnapLines,
    tolerance: number,
    bounds: { width: number; height: number },
  ) => SnapResult;
  /** Redibuja el botón del imán (estado y textos). */
  var updateSnapButton: () => void;
}

const layoutWords: Record<string, Record<string, string>> = {
  es: {
    layers: 'Capas',
    snap: 'Imán',
    snapHint:
      'Imán: al mover o cambiar el tamaño de un objeto, sus bordes se ajustan a la grilla, los márgenes y las guías. Mantené Alt mientras arrastrás para moverlo libremente.',
    show: 'Mostrar / ocultar',
    lock: 'Bloquear / desbloquear',
    up: 'Subir',
    down: 'Bajar',
    rename: 'Nombre de la capa',
    hint: 'Las capas de arriba se dibujan delante. Arrastrá una fila para cambiar el orden. El ojo oculta y el candado bloquea.',
    empty: 'Esta página no tiene objetos.',
    width: 'Ancho',
    height: 'Alto',
  },
  en: {
    layers: 'Layers',
    snap: 'Snap',
    snapHint:
      'Snap: when you move or resize an object, its edges snap to the grid, margins and guides. Hold Alt while dragging to move it freely.',
    show: 'Show / hide',
    lock: 'Lock / unlock',
    up: 'Move up',
    down: 'Move down',
    rename: 'Layer name',
    hint: 'Top layers are drawn in front. Drag a row to reorder. The eye hides and the lock prevents editing.',
    empty: 'This page has no objects.',
    width: 'Width',
    height: 'Height',
  },
  pt: {
    layers: 'Camadas',
    snap: 'Ímã',
    snapHint:
      'Ímã: ao mover ou redimensionar um objeto, as bordas se ajustam à grade, às margens e às guias. Segure Alt ao arrastar para movê-lo livremente.',
    show: 'Mostrar / ocultar',
    lock: 'Bloquear / desbloquear',
    up: 'Subir',
    down: 'Descer',
    rename: 'Nome da camada',
    hint: 'As camadas de cima ficam à frente. Arraste uma linha para reordenar. O olho oculta e o cadeado bloqueia.',
    empty: 'Esta página não tem objetos.',
    width: 'Largura',
    height: 'Altura',
  },
};
const lw = () => layoutWords[globalThis.LibroI18n?.language || 'es'];
function snapLines(b: Book, index: number): SnapLines {
  const m = M.margins(b, index),
    x = [0, b.width, m.left, b.width - m.right],
    y = [0, b.height, b.margins.top, b.height - b.margins.bottom];
  if (b.grid.enabled) {
    const r = M.gridRect(b, index),
      g = b.grid,
      w = (r.w - g.gapX * (g.cols - 1)) / g.cols,
      h = (r.h - g.gapY * (g.rows - 1)) / g.rows;
    for (let c = 0; c < g.cols; c++) x.push(r.x + c * (w + g.gapX), r.x + c * (w + g.gapX) + w);
    for (let a = 0; a < g.rows; a++) y.push(r.y + a * (h + g.gapY), r.y + a * (h + g.gapY) + h);
  }
  for (const guide of b.guides || []) (guide.axis === 'v' ? x : y).push(guide.position);
  return {
    x: [...new Set(x.map((v) => +v.toFixed(8)))],
    y: [...new Set(y.map((v) => +v.toFixed(8)))],
  };
}
globalThis.snapLines = snapLines;
function nearestSnap(
  value: number,
  lines: number[],
  tolerance: number,
  valid: (line: number) => boolean = () => true,
): { line: number; delta: number } | null {
  let result: { line: number; delta: number } | null = null;
  for (const line of lines) {
    let delta = line - value;
    if (
      Math.abs(delta) <= tolerance &&
      valid(line) &&
      (!result || Math.abs(delta) < Math.abs(result.delta))
    )
      result = { line, delta };
  }
  return result;
}
function snappedFrame(
  rect: Rect,
  direction: string | false,
  lines: SnapLines,
  tolerance: number,
  bounds: { width: number; height: number },
): SnapResult {
  const r = { ...rect },
    hits: SnapResult['hits'] = [],
    min = 3;
  if (direction) {
    if (direction.includes('w')) {
      const fixed = r.x + r.w,
        s = nearestSnap(r.x, lines.x, tolerance, (line) => line >= 0 && fixed - line >= min);
      if (s) {
        r.x = s.line;
        r.w = fixed - s.line;
        hits.push({ axis: 'x', value: s.line });
      }
    }
    if (direction.includes('e')) {
      const s = nearestSnap(
        r.x + r.w,
        lines.x,
        tolerance,
        (line) => line - r.x >= min && line <= bounds.width,
      );
      if (s) {
        r.w = s.line - r.x;
        hits.push({ axis: 'x', value: s.line });
      }
    }
    if (direction.includes('n')) {
      const fixed = r.y + r.h,
        s = nearestSnap(r.y, lines.y, tolerance, (line) => line >= 0 && fixed - line >= min);
      if (s) {
        r.y = s.line;
        r.h = fixed - s.line;
        hits.push({ axis: 'y', value: s.line });
      }
    }
    if (direction.includes('s')) {
      const s = nearestSnap(
        r.y + r.h,
        lines.y,
        tolerance,
        (line) => line - r.y >= min && line <= bounds.height,
      );
      if (s) {
        r.h = s.line - r.y;
        hits.push({ axis: 'y', value: s.line });
      }
    }
  } else {
    for (const [axis, pos, size, limit] of [
      ['x', 'x', 'w', 'width'],
      ['y', 'y', 'h', 'height'],
    ] as const) {
      let a = nearestSnap(
          r[pos],
          lines[axis],
          tolerance,
          (line) => line >= 0 && line + r[size] <= bounds[limit],
        ),
        b = nearestSnap(
          r[pos] + r[size],
          lines[axis],
          tolerance,
          (line) => line - r[size] >= 0 && line <= bounds[limit],
        ),
        hit = !a ? b : !b ? a : Math.abs(a.delta) <= Math.abs(b.delta) ? a : b;
      if (hit) {
        r[pos] += hit.delta;
        hits.push({ axis, value: hit.line });
      }
    }
  }
  return { rect: r, hits };
}
globalThis.snappedFrame = snappedFrame;
/** Estado y textos del botón del imán (lo dibuja la barra del documento). */
export function snapButtonState(): { on: boolean; label: string; hint: string } {
  return { on: book.snap?.enabled !== false, label: lw().snap, hint: lw().snapHint };
}
/** Prende o apaga el imán (se puede deshacer). */
export function toggleSnap(): void {
  finishEditing();
  commit(() => {
    book.snap = { enabled: book.snap?.enabled === false, tolerance: book.snap?.tolerance || 7 };
  }, false);
}
function updateSnapButton(): void {
  notifyEditorState();
}
globalThis.updateSnapButton = updateSnapButton;
extend.after(
  'moveObject',
  function (e: PointerEvent) {
    $$('.snap-indicator').forEach((n) => n.remove());
    if (!drag) return;
    const d = drag;
    if (book.snap?.enabled === false || e.altKey) return;
    const out = snappedFrame(
      d.o,
      d.resize,
      snapLines(book, active),
      (book.snap?.tolerance || 7) / scale,
      { width: book.width, height: book.height },
    );
    Object.assign(d.o, out.rect);
    Object.assign(d.el.style, {
      left: d.o.x * scale + 'px',
      top: d.o.y * scale + 'px',
      width: d.o.w * scale + 'px',
      height: d.o.h * scale + 'px',
    });
    const page = d.el.closest('.page')!;
    for (const hit of out.hits) {
      let line = document.createElement('div');
      line.className = 'snap-indicator ' + hit.axis;
      line.style[hit.axis === 'x' ? 'left' : 'top'] = hit.value * scale + 'px';
      page.append(line);
    }
    updateStatus();
  },
  'layout-tools',
);
extend.after(
  'upObject',
  function (e: PointerEvent) {
    $$('.snap-indicator').forEach((n) => n.remove());
  },
  'layout-tools',
);
extend.instead(
  'objectDown',
  (e: PointerEvent, o: BookObject) => o.locked || o.hidden,
  () => {},
  'layout-tools',
);
extend.instead(
  'startEditing',
  () => selectObject()?.locked || selectObject()?.hidden,
  () => {},
  'layout-tools',
);
extend.instead(
  'command',
  (name: string) =>
    ['deleteObject', 'front', 'back', 'editText'].includes(name) && selectObject()?.locked,
  () => {},
  'layout-tools',
);
// Los objetos ocultos no se dibujan (tampoco en lo impreso).
extend.result(
  'paper',
  function (page: HTMLElement, index: number) {
    for (const o of book.pages[index].objects)
      if (o.hidden) page.querySelector(`[data-id="${o.id}"]`)?.remove();
    return page;
  },
  'layout-tools',
);
// En el lienzo, los bloqueados se marcan y no llevan controladores.
extend.result(
  'screenPage',
  function (page: HTMLElement, _drawn: HTMLElement, index: number) {
    for (const o of book.pages[index].objects) {
      const node = page.querySelector(`[data-id="${o.id}"]`);
      if (!node) continue;
      node.classList.toggle('locked', !!o.locked);
      if (o.locked) node.querySelectorAll('.frame-handle').forEach((n) => n.remove());
    }
    return page;
  },
  'layout-tools',
);
// La vista Capas del riel es un componente de React (components/rail/LayersView.tsx).
registerRailView('layers', layersViewFor({ words: lw, reorder: reorderLayer, move: moveLayer }));
function reorderLayer(source: string, target: string): void {
  let list = book.pages[active].objects,
    from = list.findIndex((o) => o.id === source),
    to = list.findIndex((o) => o.id === target);
  if (from < 0 || to < 0 || list[from].locked) return;
  const item = list.splice(from, 1)[0];
  list.splice(to, 0, item);
  selected = source;
}
function moveLayer(direction: number): void {
  const o = selectObject();
  if (!o || o.locked) return;
  const list = book.pages[active].objects,
    index = list.indexOf(o),
    next = index + direction;
  if (next < 0 || next >= list.length) return;
  commit(() => {
    [list[index], list[next]] = [list[next], list[index]];
  }, false);
}
registerTool({
  id: 'layersTool',
  icon: 'layers',
  label: () => lw().layers,
  shortcut: null,
  onSelect: () => {
    finishEditing();
    showTab('layers');
  },
});
document.addEventListener('maquetario:language', () => {
  updateSnapButton();
});
updateSnapButton();
