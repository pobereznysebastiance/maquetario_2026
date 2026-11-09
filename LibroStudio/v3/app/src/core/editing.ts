// Edición de texto, arrastre y lo que pasa al tocar la página: empezar y terminar de editar, mover y
// soltar un objeto, crear con la herramienta activa (pageDown), qué hay bajo un evento del lienzo
// (canvasHit) y las imágenes nuevas. No tiene efectos al cargar. Salió de studio.ts (grupo 5):
// core-wiring.ts registra las funciones del lienzo como extensibles (frame-handles, layout-tools,
// review-workspace, editorial…) y las publica; studio-wiring.ts engancha los oyentes.
//
// Las llamadas entre estas funciones y al resto del núcleo van por el nombre global (startEditing,
// finishEditing, moveObject, checkOverflow, render…), así pasan por sus extensiones; upObject
// saca el oyente de pointermove con el mismo moveObject que puso frame-handles.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { BookObject } from '../model.ts';
import { $, M } from './utils.ts';

/** Empieza a editar el texto de una caja. Se publica extensible como startEditing. */
export function startEditingBase(el: HTMLElement): void {
  if (preview || busy) return;
  finishEditing();
  snapshot();
  editing = el;
  el.classList.add('editing');
  el.querySelector<HTMLElement>('.text-content')!.contentEditable = 'true';
  el.querySelector<HTMLElement>('.text-content')!.focus();
  inspector();
}
/** Termina la edición de texto en curso. Se publica extensible como finishEditing. */
export function finishEditingBase(): void {
  if (!editing) return;
  const el = editing;
  editing = null;
  const t = el.querySelector<HTMLElement>('.text-content');
  if (t) {
    t.contentEditable = 'false';
  }
  el.classList.remove('editing');
  checkOverflow();
}
/**
 * Empieza a mover o a redimensionar un objeto del papel (pointerdown, desde #spread). Lo arma
 * frame-handles.ts (extend.replace), que conoce los ocho controladores: elige el objeto, guarda el
 * arrastre en drag y captura el puntero en el nodo del objeto.
 */
export function objectDownBase(
  e: PointerEvent,
  o: BookObject,
  i: number,
  el: HTMLElement,
  resize: boolean | string = false,
): void {}
/**
 * Un movimiento del arrastre (pointermove en el nodo que tiene la captura). Lo arma frame-handles.ts
 * (extend.replace); layout-tools.ts le suma el imán.
 */
export function moveObjectBase(e: PointerEvent): void {}
/** Fin del arrastre (pointerup). Se publica extensible como upObject. */
export function upObjectBase(e: PointerEvent): void {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.el.removeEventListener('pointermove', moveObject);
  if (d.el.hasPointerCapture(e.pointerId)) d.el.releasePointerCapture(e.pointerId);
  if (d.moved) {
    changed();
    render(false);
  } else {
    undoStack.pop();
    updateStatus();
    checkOverflow();
  }
}
/** pointerdown en la página (no en un objeto): crea con la herramienta activa o deselecciona. */
export function pageDownBase(e: PointerEvent, i: number, el: HTMLElement): void {
  if ((e.target as Element).closest('.paper-object') || preview || busy || e.button !== 0) return;
  finishEditing();
  active = i;
  selected = null;
  let r = el.getBoundingClientRect(),
    pos = {
      x: Math.max(0, (e.clientX - r.left) / scale),
      y: Math.max(0, (e.clientY - r.top) / scale),
    };
  if (tool === 'text' || tool === 'box' || tool === 'frame') {
    commit(() => {
      const o =
        tool === 'frame'
          ? {
              id: M.uid(),
              type: 'frame',
              ...pos,
              w: Math.min(80, book.width - pos.x),
              h: Math.min(50, book.height - pos.y),
            }
          : M.text(
              'Escribí aquí tu texto',
              pos.x,
              pos.y,
              Math.min(90, book.width - pos.x),
              Math.min(50, book.height - pos.y),
            );
      o.w = Math.max(1, o.w);
      o.h = Math.max(1, o.h);
      book.pages[i].objects.push(o);
      selected = o.id;
      tool = 'select';
    }, true);
    if (selectObject()?.type === 'text')
      requestAnimationFrame(() => {
        const target = $(`#spread [data-id="${selected}"]`);
        if (target) startEditing(target);
      });
  } else if (tool === 'image') chooseImage({ pos, page: i });
  else render(false);
}
/** La página del lienzo (con su índice) y el objeto del libro bajo un evento, si lo hay. */
export function canvasHit(target: EventTarget | null): {
  page: HTMLElement;
  i: number;
  el: HTMLElement | null;
  o: BookObject | null;
} | null {
  const node = target instanceof Element ? target : null,
    page = node?.closest<HTMLElement>('#spread .page');
  if (!page) return null;
  const i = Number(page.dataset.page),
    el = node!.closest<HTMLElement>('.paper-object'),
    o =
      (el && page.contains(el) && book.pages[i]?.objects.find((x) => x.id === el.dataset.id)) ||
      null;
  return { page, i, el: o ? el : null, o };
}
let imageTarget: Record<string, any> | null = null;
/** Elegir una imagen para un marco o una posición (abre #imageInput). */
export function chooseImage(target: Record<string, unknown>): void {
  imageTarget = target;
  $('#imageInput').value = '';
  $('#imageInput').click();
}
/** La imagen elegida en #imageInput: va al marco o a una caja nueva (studio-wiring.ts lo engancha). */
export const imageInputChange = async (e: Event): Promise<void> => {
  const file = (e.target as HTMLInputElement).files![0],
    target = imageTarget;
  if (!file || !target) return;
  try {
    if (file.size > 25000000) throw Error('La imagen supera 25 MB. Usá una versión más liviana.');
    const url = URL.createObjectURL(file),
      img = new Image();
    img.src = url;
    try {
      await img.decode();
      const ratio = Math.min(1, 2600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * ratio);
      c.height = Math.round(img.height * ratio);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const src = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
      commit(() => {
        let o = target.frame;
        if (o) {
          o.type = 'image';
          o.src = src;
          o.name = file.name;
        } else {
          const w = Math.max(3, Math.min(108, book.width - target.pos.x));
          o = {
            id: M.uid(),
            type: 'image',
            x: target.pos.x,
            y: target.pos.y,
            w,
            h: Math.max(1, Math.min(book.height - target.pos.y, (w * img.height) / img.width)),
            src,
            name: file.name,
          };
          book.pages[target.page].objects.push(o);
        }
        active = target.page;
        selected = o.id;
        tool = 'select';
      }, true);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    toast('No se pudo cargar la imagen: ' + (error as Error).message, 'error');
  }
};
