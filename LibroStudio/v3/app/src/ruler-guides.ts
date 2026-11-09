// Guías desde las reglas, como en los programas de maquetación:
// - arrastrar desde la regla de arriba (#rulerX) saca una guía horizontal, y desde la de la
//   izquierda (#rulerY), una vertical; se suelta sobre una página y queda en book.guides (todas
//   las páginas, como las de "Agregar guía");
// - con Seleccionar, una guía se agarra con el puntero encima (a 4 px o menos) y se mueve;
//   soltada fuera de las páginas, se quita.
// Mientras se arrastra se ve la línea con su medida. Escape cancela. Cada cambio es un paso de
// deshacer (commit). Las guías no se imprimen (sólo las dibuja la pantalla: CanvasGuides.tsx).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { BookGuide } from './editorial.ts';

type Axis = 'h' | 'v';
/** Distancia en pantalla a la que el puntero agarra una guía. */
const NEAR_PX = 4;

interface GuideDrag {
  axis: Axis;
  /** La guía que se mueve, o null si sale de la regla. */
  index: number | null;
  line: HTMLElement;
  label: HTMLElement;
}
let dragGuide: GuideDrag | null = null;

/** La página del lienzo bajo el punto, con su escala (px por mm). */
function pageAt(x: number, y: number): { rect: DOMRect; px: number } | null {
  for (const page of $$('#spread .page')) {
    const rect = page.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
      return { rect, px: rect.width / book.width };
  }
  return null;
}
/** Posición en mm sobre la página, en el eje de la guía, redondeada a décimas. */
function mmAt(axis: Axis, hit: { rect: DOMRect; px: number }, x: number, y: number): number {
  const raw = axis === 'h' ? (y - hit.rect.top) / hit.px : (x - hit.rect.left) / hit.px,
    max = axis === 'h' ? book.height : book.width;
  return Math.round(Math.min(Math.max(raw, 0), max) * 10) / 10;
}
const guides = (): BookGuide[] => (book.guides || []) as BookGuide[];

/** La guía propia que está bajo el puntero (a NEAR_PX o menos), si hay. */
function guideNear(x: number, y: number): { axis: Axis; index: number } | null {
  const hit = pageAt(x, y);
  if (!hit) return null;
  let best: { axis: Axis; index: number; distance: number } | null = null;
  guides().forEach((guide, index) => {
    const at =
      guide.axis === 'h'
        ? hit.rect.top + guide.position * hit.px
        : hit.rect.left + guide.position * hit.px;
    const distance = Math.abs((guide.axis === 'h' ? y : x) - at);
    if (distance <= NEAR_PX && (!best || distance < best.distance))
      best = { axis: guide.axis, index, distance };
  });
  return best;
}

function place(e: PointerEvent): void {
  if (!dragGuide) return;
  const { axis, line, label, index } = dragGuide,
    hit = pageAt(e.clientX, e.clientY);
  line.style.setProperty('--guide-at', (axis === 'h' ? e.clientY : e.clientX) + 'px');
  line.classList.toggle('is-outside', !hit);
  label.textContent = hit
    ? `${displayMeasure(mmAt(axis, hit, e.clientX, e.clientY))} ${documentUnit()}`
    : index === null
      ? bw('Soltá sobre una página', 'Drop on a page', 'Solte sobre uma página')
      : bw('Soltá para quitar', 'Release to remove', 'Solte para remover');
}

function stop(): void {
  if (!dragGuide) return;
  dragGuide.line.remove();
  dragGuide = null;
  window.removeEventListener('pointermove', place);
  window.removeEventListener('pointerup', drop);
  window.removeEventListener('pointercancel', stop);
  document.body.classList.remove('guide-dragging');
}

function drop(e: PointerEvent): void {
  if (!dragGuide) return;
  const { axis, index } = dragGuide,
    hit = pageAt(e.clientX, e.clientY);
  stop();
  if (hit) {
    const position = mmAt(axis, hit, e.clientX, e.clientY);
    commit(() => {
      if (!book.guides) book.guides = [];
      if (index === null) book.guides.push({ axis, position });
      else book.guides[index] = { axis, position };
    }, false);
  } else if (index !== null) commit(() => book.guides.splice(index, 1), false);
}

/** Empieza a arrastrar una guía nueva (index null) o la guía index. */
function begin(axis: Axis, index: number | null, e: PointerEvent): void {
  finishEditing();
  const area = ($('#workarea') || $('#spread')).getBoundingClientRect(),
    line = document.createElement('div'),
    label = document.createElement('span');
  line.className = 'guide-drag ' + axis;
  line.style.setProperty('--guide-start', (axis === 'h' ? area.left : area.top) + 'px');
  line.style.setProperty('--guide-length', (axis === 'h' ? area.width : area.height) + 'px');
  line.append(label);
  document.body.append(line);
  document.body.classList.add('guide-dragging');
  dragGuide = { axis, index, line, label };
  place(e);
  window.addEventListener('pointermove', place);
  window.addEventListener('pointerup', drop);
  window.addEventListener('pointercancel', stop);
}

// Desde las reglas: la de arriba da guías horizontales; la de la izquierda, verticales.
for (const [id, axis] of [
  ['#rulerX', 'h'],
  ['#rulerY', 'v'],
] as const)
  $(id).addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0 || !hasDocument || preview) return;
    e.preventDefault();
    begin(axis, null, e);
  });

// Una guía existente: con Seleccionar y el puntero sobre ella, el toque en la página la agarra.
extend.instead(
  'pageDown',
  (e: PointerEvent) =>
    tool === 'select' &&
    e.button === 0 &&
    !(e.target as Element).closest('.paper-object') &&
    !!guideNear(e.clientX, e.clientY),
  function (e: PointerEvent) {
    const near = guideNear(e.clientX, e.clientY)!;
    e.preventDefault();
    begin(near.axis, near.index, e);
  },
  'ruler-guides',
);

// El puntero avisa cuándo está sobre una guía que se puede agarrar.
$('#spread').addEventListener('pointermove', (e: PointerEvent) => {
  const near =
    !dragGuide && tool === 'select' && !(e.target as Element).closest('.paper-object')
      ? guideNear(e.clientX, e.clientY)
      : null;
  const spread = $('#spread');
  spread.classList.toggle('guide-hover-h', near?.axis === 'h');
  spread.classList.toggle('guide-hover-v', near?.axis === 'v');
});

// Escape suelta la guía sin cambiar nada.
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key !== 'Escape' || !dragGuide) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    stop();
  },
  true,
);

export {};
