// El arrastre de los objetos del papel: mover y redimensionar desde los ocho controladores
// (esquinas y bordes). Arma objectDown y moveObject (en studio.ts sólo está su nombre). Escape o
// pointercancel devuelven la caja a su lugar (y la dejan elegida). Los controladores los dibuja la
// capa de selección y no se imprimen. El ciclo del arrastre y de la edición: docs/arquitectura.md,
// "El lienzo", paso 6.
//
// frameDirections y frameGeometry son globales porque los usa tests/frame-handles-tests.js;
// showHandlePreview lo llama la autoprueba (desktop/src/main/selftest.ts).
//
// Fuente TypeScript: se compila a build/frame-handles.js (desktop/scripts/build.mjs).

import type { BookObject, Rect } from './model.ts';
import { frameDirections, refreshSelection } from './components/canvas/SelectionLayer.tsx';

declare global {
  /** Direcciones de los controladores: esquinas y bordes (nw, n, ne, e, se, s, sw, w). */
  var frameDirections: string[];
  /** Caja resultante de arrastrar el controlador direction (dx, dy en mm), dentro de bounds. */
  var frameGeometry: (
    start: Rect,
    direction: string,
    dx: number,
    dy: number,
    bounds: { width: number; height: number },
  ) => Rect;
  /** Autoprueba: deja seleccionada una caja de texto con sus controladores visibles. */
  var showHandlePreview: () => void;
}

// Los controladores los dibuja la capa de selección (components/canvas/SelectionLayer.tsx).
globalThis.frameDirections = frameDirections;
function frameGeometry(
  start: Rect,
  direction: string,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
): Rect {
  const min = Math.min(3, bounds.width, bounds.height);
  let left = start.x,
    right = start.x + start.w,
    top = start.y,
    bottom = start.y + start.h;
  if (direction.includes('w')) left = Math.max(0, Math.min(right - min, start.x + dx));
  if (direction.includes('e'))
    right = Math.min(bounds.width, Math.max(left + min, start.x + start.w + dx));
  if (direction.includes('n')) top = Math.max(0, Math.min(bottom - min, start.y + dy));
  if (direction.includes('s'))
    bottom = Math.min(bounds.height, Math.max(top + min, start.y + start.h + dy));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
globalThis.frameGeometry = frameGeometry;
extend.replace(
  'objectDown',
  function (
    e: PointerEvent,
    o: BookObject,
    index: number,
    el: HTMLElement,
    resize: boolean | string = false,
  ) {
    if (preview || busy || e.button !== 0) return;
    const direction = resize === true ? 'se' : resize;
    if (editing === el && !direction) return;
    e.stopPropagation();
    if (direction) e.preventDefault();
    finishEditing();
    active = index;
    selected = o.id;
    if (tool === 'image' && o.type === 'frame') {
      chooseImage({ frame: o, page: index });
      return;
    }
    tool = 'select';
    snapshot();
    drag = {
      o,
      el,
      startX: e.clientX,
      startY: e.clientY,
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      resize: direction,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
    el.addEventListener('pointermove', moveObject);
    el.addEventListener('pointerup', upObject, { once: true });
    el.addEventListener('pointercancel', cancelFrameDrag, { once: true });
    // Selección, controladores y página activa: la capa de selección, en el acto.
    refreshSelection();
    inspector();
    updateStatus();
  },
  'frame-handles',
);
extend.replace(
  'moveObject',
  function (e: PointerEvent) {
    if (!drag) return;
    const d = drag,
      o = d.o,
      dx = (e.clientX - d.startX) / scale,
      dy = (e.clientY - d.startY) / scale;
    d.moved = d.moved || Math.abs(dx) + Math.abs(dy) > 0.3;
    if (d.resize)
      Object.assign(
        o,
        frameGeometry(d, d.resize as string, dx, dy, { width: book.width, height: book.height }),
      );
    else {
      o.x = Math.max(0, Math.min(book.width - o.w, d.x + dx));
      o.y = Math.max(0, Math.min(book.height - o.h, d.y + dy));
    }
    Object.assign(d.el.style, {
      left: o.x * scale + 'px',
      top: o.y * scale + 'px',
      width: o.w * scale + 'px',
      height: o.h * scale + 'px',
    });
    updateStatus();
    checkOverflow();
  },
  'frame-handles',
);
function cancelFrameDrag(e: PointerEvent): void {
  if (!drag) return;
  const d = drag;
  Object.assign(d.o, { x: d.x, y: d.y, w: d.w, h: d.h });
  d.moved = false;
  upObject(e);
  render(false);
}
extend.before(
  'upObject',
  function () {
    if (drag) {
      drag.el.removeEventListener('pointercancel', cancelFrameDrag);
      drag.el.removeEventListener('pointerup', upObject);
    }
  },
  'frame-handles',
);
// Escape a mitad de un arrastre (mover o redimensionar) lo cancela: la caja vuelve a su lugar y a
// su tamaño, y sigue elegida. Va en captura y antes que el Escape general del editor (studio.ts),
// que deselecciona: sin esto, aquel redibujaba la página a mitad del arrastre, la caja quedaba con
// el tamaño nuevo y el arrastre seguía abierto (el pointerup llegaba a un nodo que ya no estaba).
window.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Escape' || !drag) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cancelFrameDrag(e as unknown as PointerEvent);
  },
  true,
);
globalThis.showHandlePreview = function () {
  active = spread = 0;
  selected = book.pages[0].objects.filter((o) => o.type === 'text').slice(-1)[0].id;
  showTab('text');
  render(true);
};
renderPages();
