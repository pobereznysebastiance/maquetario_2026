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
      const badge = el.querySelector('.object-badge');
      if (badge) badge.textContent = bw(...shapeNames[o.shape]);
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
  modal(
    bw('Figuras y contenedores', 'Shapes and containers', 'Figuras e contêineres'),
    `<p class="builder-intro">${bw('Elegí una figura y arrastrá sobre la página para dibujarla. Con Shift conserva proporciones iguales. Después ajustá relleno y trazo en Objeto.', 'Choose a shape and drag on the page to draw it. Hold Shift for equal proportions. Then set fill and stroke in Object.', 'Escolha uma figura e arraste na página para desenhar. Com Shift mantém proporções iguais. Depois ajuste preenchimento e traço em Objeto.')}</p><div class="shape-choices">${Object.entries(
      shapeNames,
    )
      .map(
        ([key, labels]) =>
          `<button type="button" data-shape-kind="${key}" class="shape-choice"><div>${shapeSvg({ id: 'pick-' + key, shape: key, type: 'frame', w: 50, h: 35, fill: '#3CD1BB', stroke: '#E4B16C', strokeWidth: 1.2 })}</div><strong>${bw(...labels)}</strong></button>`,
      )
      .join('')}</div>`,
    () => true,
    bw('Cerrar', 'Close', 'Fechar'),
  );
  $$('[data-shape-kind]').forEach(
    (b) =>
      (b.onclick = () => {
        shapeKind = b.dataset.shapeKind!;
        $('#modal').close();
        finishEditing();
        selected = null;
        tool = 'shape';
        showTab('object');
        $('#spread').style.cursor = 'crosshair';
        toast(
          bw(
            'Arrastrá en una página para crear la figura.',
            'Drag on a page to create the shape.',
            'Arraste numa página para criar a figura.',
          ),
          'info',
        );
      }),
  );
}
const shapeTool = document.createElement('button');
shapeTool.type = 'button';
shapeTool.className = 'tool';
shapeTool.id = 'shapeTool';
shapeTool.dataset.tool = 'shape';
shapeTool.innerHTML = icon('frame') + '<span>' + bw('Figuras', 'Shapes', 'Figuras') + '</span>';
shapeTool.title = bw('Figuras y contenedores', 'Shapes and containers', 'Figuras e contêineres');
shapeTool.onclick = shapeChooser;
$('[data-tool="frame"]').after(shapeTool);
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
      $('#spread').style.cursor = 'default';
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
function shapeAppearance(): void {
  if (tab !== 'object') return;
  const o = selectObject(),
    host = $('#inspectorContent');
  if (!o || !['frame', 'image'].includes(o.type)) return;
  const box = document.createElement('section');
  box.className = 'section shape-appearance';
  box.innerHTML = `<div class="section-heading">${icon('frame')} ${bw('Figura · relleno y trazo', 'Shape · fill and stroke', 'Figura · preenchimento e traço')}</div>${row(
    bw('Forma', 'Shape', 'Forma'),
    `<select data-shape-prop="shape">${Object.entries(shapeNames)
      .map(
        ([key, labels]) =>
          `<option value="${key}" ${(o.shape || 'rect') === key ? 'selected' : ''}>${bw(...labels)}</option>`,
      )
      .join('')}</select>`,
  )}<div class="shape-color-control"><label>${bw('Relleno', 'Fill', 'Preenchimento')}</label><input type="color" data-shape-prop="fill" value="${o.fill && o.fill !== 'none' ? o.fill : '#D8EBE5'}"><label class="check-line"><input type="checkbox" data-shape-none="fill" ${o.fill === 'none' || !o.shape ? 'checked' : ''}>${bw('Sin relleno', 'No fill', 'Sem preenchimento')}</label></div><div class="shape-color-control"><label>${bw('Trazo', 'Stroke', 'Traço')}</label><input type="color" data-shape-prop="stroke" value="${o.stroke && o.stroke !== 'none' ? o.stroke : '#153D42'}"><label class="check-line"><input type="checkbox" data-shape-none="stroke" ${o.stroke === 'none' ? 'checked' : ''}>${bw('Sin trazo', 'No stroke', 'Sem traço')}</label></div>${row(bw('Grosor · mm', 'Weight · mm', 'Espessura · mm'), `<input type="number" min="0" max="10" step="0.1" data-shape-prop="strokeWidth" value="${o.strokeWidth ?? 0.5}">`)}${row(
    bw('Tipo de trazo', 'Stroke style', 'Tipo de traço'),
    `<select data-shape-prop="strokeStyle">${[
      ['solid', bw('Continuo', 'Solid', 'Contínuo')],
      ['dashed', bw('Guiones', 'Dashed', 'Tracejado')],
      ['dotted', bw('Punteado', 'Dotted', 'Pontilhado')],
    ]
      .map(
        ([key, label]) =>
          `<option value="${key}" ${o.strokeStyle === key ? 'selected' : ''}>${label}</option>`,
      )
      .join('')}</select>`,
  )}${row(bw('Opacidad · %', 'Opacity · %', 'Opacidade · %'), `<input type="number" min="0" max="100" step="1" data-shape-prop="opacity" value="${o.opacity ?? 100}">`)}${o.shape === 'round' ? row(bw('Radio · mm', 'Radius · mm', 'Raio · mm'), `<input type="number" min="0" max="100" step="0.5" data-shape-prop="cornerRadius" value="${o.cornerRadius ?? 5}">`) : ''}${o.shape === 'polygon' ? row(bw('Lados', 'Sides', 'Lados'), `<input type="number" min="3" max="12" step="1" data-shape-prop="sides" value="${o.sides ?? 6}">`) : ''}<div class="page-action"><button type="button" class="btn" id="shapeSwapColors">⇄ ${bw('Intercambiar', 'Swap', 'Trocar')}</button><button type="button" class="btn" id="shapePlaceImage">${bw('Colocar imagen…', 'Place image…', 'Inserir imagem…')}</button></div><p class="help">${bw('La figura puede ser fondo o contenedor de una imagen. Usá Al fondo para ubicarla detrás de un texto.', 'The shape can be a background or an image container. Use To back to put it behind text.', 'A figura pode ser fundo ou contêiner de imagem. Use Para trás para colocá-la atrás do texto.')}</p>`;
  host.querySelector('.section')?.after(box);
  box
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
      'input,select,button',
    )
    .forEach((el) => (el.disabled = !!o.locked));
  function init() {
    if (!o!.shape) {
      o!.shape = 'rect';
      o!.fill = 'none';
      o!.stroke = '#153D42';
      o!.strokeWidth = 0.5;
    }
  }
  // Campos numéricos, de color y selectores: type, value, min y max alcanzan para los tres.
  box.querySelectorAll<HTMLInputElement>('[data-shape-prop]').forEach(
    (el) =>
      (el.onchange = () => {
        const v = el.type === 'number' ? Number(el.value) : el.value;
        if (
          el.type === 'number' &&
          (!Number.isFinite(v) ||
            (v as number) < Number(el.min) ||
            (v as number) > Number(el.max) ||
            (el.dataset.shapeProp === 'sides' && !Number.isInteger(v)))
        ) {
          inspector();
          return;
        }
        commit(() => {
          init();
          o[el.dataset.shapeProp!] = v;
        }, false);
      }),
  );
  box.querySelectorAll<HTMLInputElement>('[data-shape-none]').forEach(
    (el) =>
      (el.onchange = () =>
        commit(() => {
          init();
          o[el.dataset.shapeNone!] = el.checked
            ? 'none'
            : el.dataset.shapeNone === 'fill'
              ? '#D8EBE5'
              : '#153D42';
        }, false)),
  );
  $('#shapeSwapColors').onclick = () =>
    commit(() => {
      init();
      [o.fill, o.stroke] = [o.stroke || 'none', o.fill || 'none'];
    }, false);
  $('#shapePlaceImage').onclick = () => {
    if (!o.shape) {
      commit(init, false);
    }
    chooseImage({ frame: o, page: active });
  };
  if (o.shape) {
    const label = host.querySelector('.selection-chip');
    if (label) label.innerHTML = icon('frame') + esc(bw(...shapeNames[o.shape]));
  }
}
decorateInspector(() => {
  shapeAppearance();
  shapeTool.querySelector('span')!.textContent = bw('Figuras', 'Shapes', 'Figuras');
}, 'shapes');

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
