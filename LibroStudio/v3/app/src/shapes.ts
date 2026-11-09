// Figuras: rectángulo, rectángulo redondeado, elipse y polígono, que sirven de fondo o de
// contenedor de una imagen. Herramienta Figuras (elegir y arrastrar sobre la página, con Shift
// para proporciones iguales), dibujo en el lienzo y en la salida, panel de relleno y trazo en
// Objeto, y validación de sus campos en el modelo.
//
// Publica shapeKind, shapeNames y newShape (los usa tests/shapes-tests.js, que también cambia
// shapeKind: por eso vive en globalThis) y shapeOutputReady (lo espera el proceso principal antes
// de imprimir).
//
// Ojo con el orden: este archivo reemplaza M.validate envolviendo al anterior, al cargar (después
// de master-refinement, que lo envolvió antes).
//
// Fuente TypeScript: se compila a build/shapes.js (desktop/scripts/build.mjs).
import type { Book, BookObject, LibroModelApi } from './model.ts';
import type { OutputConfig, OutputInfo } from './output.ts';
import { shapeGallery } from './components/shape-gallery/ShapeGallery.tsx';
import { bw } from './i18n/language.ts';
import { M } from './core-api.ts';
import { closeSheet } from './components/dialog/dialogs.tsx';

/** Nombre de cada figura: castellano, inglés y portugués. */
type ShapeLabels = [string, string, string];

/** Lo que hace falta para dibujar una figura (la del selector no tiene posición). */
type ShapeObject = Pick<BookObject, 'id' | 'type' | 'w' | 'h'> & { [extra: string]: any };

declare global {
  /** Figura que dibuja la herramienta Figuras (rect, round, ellipse o polygon). */
  var shapeKind: string;
  var shapeNames: Record<string, ShapeLabels>;
  /** Figura nueva del tipo shapeKind, con relleno y trazo por defecto. */
  var newShape: (x: number, y: number, w: number, h: number) => BookObject;
  /** Las imágenes dentro de figuras terminaron de cargar (lo espera el anfitrión). */
  var shapeOutputReady: boolean;
}

globalThis.shapeKind = 'rect';
const shapeNames: Record<string, ShapeLabels> = {
  rect: ['Rectángulo', 'Rectangle', 'Retângulo'],
  round: ['Rectángulo redondeado', 'Rounded rectangle', 'Retângulo arredondado'],
  ellipse: ['Elipse / círculo', 'Ellipse / circle', 'Elipse / círculo'],
  polygon: ['Polígono', 'Polygon', 'Polígono'],
};
globalThis.shapeNames = shapeNames;
function shapePoints(o: ShapeObject, inset = 0): string {
  const cx = o.w / 2,
    cy = o.h / 2,
    rx = Math.max(0.01, cx - inset),
    ry = Math.max(0.01, cy - inset),
    sides = o.sides || 6;
  return Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / sides;
    return `${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`;
  }).join(' ');
}
function shapePath(o: ShapeObject): string {
  const stroke = o.strokeWidth ?? 0.5,
    inset = stroke / 2,
    w = Math.max(0.01, o.w - stroke),
    h = Math.max(0.01, o.h - stroke);
  if (o.shape === 'ellipse')
    return `<ellipse cx="${o.w / 2}" cy="${o.h / 2}" rx="${Math.max(0.01, w / 2)}" ry="${Math.max(0.01, h / 2)}"/>`;
  if (o.shape === 'polygon') return `<polygon points="${shapePoints(o, inset)}"/>`;
  return `<rect x="${inset}" y="${inset}" width="${w}" height="${h}" rx="${o.shape === 'round' ? Math.min(o.cornerRadius ?? 5, w / 2, h / 2) : 0}"/>`;
}
function shapeSvg(o: ShapeObject): string {
  const path = shapePath(o),
    clip = 'clip-shape-' + o.id;
  return `<svg class="editorial-shape-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none"><defs><clipPath id="${clip}">${path}</clipPath></defs><g fill="${o.fill || 'none'}" stroke="none">${path}</g>${o.type === 'image' ? `<image href="${esc(o.src)}" x="0" y="0" width="${o.w}" height="${o.h}" preserveAspectRatio="${o.imageFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" clip-path="url(#${clip})"/>` : ''}<g fill="none" stroke="${o.stroke || 'none'}" stroke-width="${o.strokeWidth ?? 0.5}" ${o.strokeStyle === 'dashed' ? 'stroke-dasharray="3 2"' : o.strokeStyle === 'dotted' ? 'stroke-dasharray=".2 1.5" stroke-linecap="round"' : ''}>${path}</g></svg>`;
}
extend.result(
  'paper',
  function (page: HTMLElement, index: number, px: number, print = false): HTMLElement {
    for (const o of book.pages[index].objects) {
      if (!o.shape) continue;
      const el = page.querySelector<HTMLElement>(`[data-id="${o.id}"]`);
      if (!el) continue;
      el.classList.remove('frame');
      el.classList.add('editorial-shape');
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.style.display = 'block';
      el.style.opacity = '1';
      el.querySelectorAll(':scope > .icon,:scope > img').forEach((n) => n.remove());
      el.insertAdjacentHTML('afterbegin', shapeSvg(o));
      // String() da el mismo texto que el estilo al recibir un número.
      el.querySelector<SVGElement>('.editorial-shape-svg')!.style.opacity = String(
        (o.opacity ?? 100) / 100,
      );
    }
    return page;
  },
  'shapes',
);
const beforeShapeValidation: LibroModelApi['validate'] = M.validate;
M.validate = function (input: any): Book {
  const b = beforeShapeValidation(input);
  for (const p of b.pages)
    for (const o of p.objects) {
      if (o.shape !== undefined) {
        if (!shapeNames[o.shape] || !['frame', 'image'].includes(o.type))
          throw Error('Figura inválida.');
        for (const key of ['fill', 'stroke'])
          if (o[key] !== undefined && o[key] !== 'none' && !/^#[0-9a-f]{6}$/i.test(o[key]))
            throw Error('Color de figura inválido.');
        for (const [key, min, max] of [
          ['strokeWidth', 0, 10],
          ['cornerRadius', 0, 100],
          ['opacity', 0, 100],
          ['sides', 3, 12],
        ] as const)
          if (
            o[key] !== undefined &&
            (!Number.isFinite(o[key]) ||
              o[key] < min ||
              o[key] > max ||
              (key === 'sides' && !Number.isInteger(o[key])))
          )
            throw Error('Apariencia de figura inválida.');
        if (o.strokeStyle !== undefined && !['solid', 'dashed', 'dotted'].includes(o.strokeStyle))
          throw Error('Trazo inválido.');
      }
    }
  return b;
};
function shapeChooser(): void {
  if (!hasDocument) {
    settings(true);
    return;
  }
  modal.info(
    bw('Figuras y contenedores', 'Shapes and containers', 'Figuras e contêineres'),
    shapeGallery({
      kinds: Object.keys(shapeNames),
      label: (kind) => bw(...shapeNames[kind]),
      preview: (kind) =>
        shapeSvg({
          id: 'pick-' + kind,
          shape: kind,
          type: 'frame',
          w: 50,
          h: 35,
          fill: '#3CD1BB',
          stroke: '#E4B16C',
          strokeWidth: 1.2,
        }),
      pick: (kind) => {
        shapeKind = kind;
        closeSheet();
        finishEditing();
        selected = null;
        tool = 'shape';
        showTab('object');
        $('#spread').dataset.cursor = 'crosshair';
        toast(
          bw(
            'Arrastrá en una página para crear la figura.',
            'Drag on a page to create the shape.',
            'Arraste numa página para criar a figura.',
          ),
          'info',
        );
      },
    }),
    bw('Cerrar', 'Close', 'Fechar'),
  );
}
registerTool({
  tool: 'shape',
  id: 'shapeTool',
  icon: 'frame',
  label: () => bw('Figuras', 'Shapes', 'Figuras'),
  title: () => bw('Figuras y contenedores', 'Shapes and containers', 'Figuras e contêineres'),
  shortcut: null,
  after: 'frame',
  onSelect: shapeChooser,
});
function newShape(x: number, y: number, w: number, h: number): BookObject {
  return {
    id: M.uid(),
    type: 'frame',
    shape: shapeKind,
    x,
    y,
    w,
    h,
    name: bw(...shapeNames[shapeKind]),
    fill: '#D8EBE5',
    stroke: '#153D42',
    strokeWidth: 0.5,
    strokeStyle: 'solid',
    opacity: 100,
    cornerRadius: 5,
    sides: 6,
  };
}
globalThis.newShape = newShape;
extend.instead(
  'pageDown',
  () => tool === 'shape',
  function (e: PointerEvent, index: number, page: HTMLElement) {
    if (preview || busy || e.button !== 0 || (e.target as Element).closest('.paper-object')) return;
    e.preventDefault();
    e.stopPropagation();
    finishEditing();
    const bounds = page.getBoundingClientRect(),
      start = {
        x: Math.max(0, Math.min(book.width - 1, (e.clientX - bounds.left) / scale)),
        y: Math.max(0, Math.min(book.height - 1, (e.clientY - bounds.top) / scale)),
      },
      ghost = document.createElement('div');
    ghost.className = 'shape-draw-ghost';
    page.append(ghost);
    let rect = { x: start.x, y: start.y, w: 1, h: 1 },
      moved = false;
    page.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = Math.max(0, Math.min(book.width, (ev.clientX - bounds.left) / scale)),
        y = Math.max(0, Math.min(book.height, (ev.clientY - bounds.top) / scale));
      let dx = x - start.x,
        dy = y - start.y;
      if (ev.shiftKey) {
        const side = Math.min(Math.abs(dx), Math.abs(dy));
        dx = Math.sign(dx) * side;
        dy = Math.sign(dy) * side;
      }
      rect = {
        x: Math.min(start.x, start.x + dx),
        y: Math.min(start.y, start.y + dy),
        w: Math.max(1, Math.abs(dx)),
        h: Math.max(1, Math.abs(dy)),
      };
      moved = moved || Math.abs(dx) + Math.abs(dy) > 2;
      Object.assign(ghost.style, {
        left: rect.x * scale + 'px',
        top: rect.y * scale + 'px',
        width: rect.w * scale + 'px',
        height: rect.h * scale + 'px',
      });
      ghost.innerHTML = shapeSvg(newShape(0, 0, rect.w, rect.h));
    };
    const end = (ev: PointerEvent) => {
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerup', end);
      page.removeEventListener('pointercancel', cancel);
      if (page.hasPointerCapture(ev.pointerId)) page.releasePointerCapture(ev.pointerId);
      ghost.remove();
      if (!moved)
        rect = {
          x: start.x,
          y: start.y,
          w: Math.min(60, book.width - start.x),
          h: Math.min(40, book.height - start.y),
        };
      commit(() => {
        const o = newShape(rect.x, rect.y, rect.w, rect.h);
        book.pages[index].objects.push(o);
        active = index;
        selected = o.id;
        tool = 'select';
      }, true);
      showTab('object');
      $('#spread').dataset.cursor = 'default';
    };
    const cancel = (ev: PointerEvent) => {
      page.removeEventListener('pointermove', move);
      page.removeEventListener('pointerup', end);
      page.removeEventListener('pointercancel', cancel);
      ghost.remove();
      if (page.hasPointerCapture(ev.pointerId)) page.releasePointerCapture(ev.pointerId);
    };
    page.addEventListener('pointermove', move);
    page.addEventListener('pointerup', end);
    page.addEventListener('pointercancel', cancel);
  },
  'shapes',
);
// "Figura · relleno y trazo" del inspector: src/components/inspector/ShapePanel.tsx.

extend.result(
  'prepareOutput',
  function (result: OutputInfo, config: OutputConfig): OutputInfo {
    window.shapeOutputReady = false;
    const sources = book.pages.flatMap((p) =>
      p.objects.filter((o) => o.shape && o.type === 'image' && !o.hidden).map((o) => o.src),
    );
    Promise.all(
      [...new Set(sources)].map((src) => {
        const im = new Image();
        im.src = src;
        return im.decode().catch(() => {});
      }),
    ).then(() => (window.shapeOutputReady = true));
    return result;
  },
  'shapes',
);

export {};
