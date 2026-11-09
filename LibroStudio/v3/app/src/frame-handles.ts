// Ocho controladores (esquinas y bordes) para redimensionar la caja seleccionada. Reemplaza
// objectDown y moveObject de studio.js para arrastrar desde cualquier controlador, y Escape o
// pointercancel devuelven la caja a su lugar (y la dejan elegida). Los controladores no se imprimen.
//
// frameDirections y frameGeometry son globales porque los usa tests/frame-handles-tests.js;
// showHandlePreview lo llama la autoprueba (desktop/src/main/selftest.ts).
//
// Fuente TypeScript: se compila a build/frame-handles.js (desktop/scripts/build.mjs).

import type { BookObject, Rect } from './model.ts';
import { i18n } from './i18n/language.ts';

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

const frameDirections = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
globalThis.frameDirections = frameDirections;
function frameHandleLabel(direction: string): string {
  const lang = i18n.language || 'es';
  const names: Record<string, Record<string, string>> = {
    es: {
      nw: 'Esquina superior izquierda',
      n: 'Borde superior',
      ne: 'Esquina superior derecha',
      e: 'Borde derecho',
      se: 'Esquina inferior derecha',
      s: 'Borde inferior',
      sw: 'Esquina inferior izquierda',
      w: 'Borde izquierdo',
    },
    en: {
      nw: 'Top-left corner',
      n: 'Top edge',
      ne: 'Top-right corner',
      e: 'Right edge',
      se: 'Bottom-right corner',
      s: 'Bottom edge',
      sw: 'Bottom-left corner',
      w: 'Left edge',
    },
    pt: {
      nw: 'Canto superior esquerdo',
      n: 'Borda superior',
      ne: 'Canto superior direito',
      e: 'Borda direita',
      se: 'Canto inferior direito',
      s: 'Borda inferior',
      sw: 'Canto inferior esquerdo',
      w: 'Borda esquerda',
    },
  };
  return names[lang][direction];
}
function addFrameHandles(el: HTMLElement, o: BookObject, index: number): void {
  el.querySelectorAll(':scope > .resize-handle').forEach((handle) => handle.remove());
  for (const direction of frameDirections) {
    const handle = document.createElement('span');
    handle.className = 'resize-handle frame-handle handle-' + direction;
    handle.dataset.handle = direction;
    handle.title = frameHandleLabel(direction);
    handle.setAttribute('aria-label', handle.title);
    handle.setAttribute('role', 'button');
    // El pointerdown lo atiende #spread (studio.ts): llama a objectDown con data-handle.
    el.append(handle);
  }
}
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
// Sólo en el lienzo: lo impreso no lleva controladores.
extend.result(
  'screenPage',
  function (page: HTMLElement, _drawn: HTMLElement, index: number) {
    for (const o of book.pages[index].objects) {
      if (o.id !== selected) continue;
      const el = page.querySelector<HTMLElement>(`[data-id="${o.id}"]`);
      if (el) addFrameHandles(el, o, index);
    }
    return page;
  },
  'frame-handles',
);
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
    $$('.paper-object.selected').forEach((n) => n.classList.remove('selected'));
    el.classList.add('selected');
    addFrameHandles(el, o, index);
    $$('.page').forEach((n) =>
      n.classList.toggle('active-page', Number(n.dataset.page) === active),
    );
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
