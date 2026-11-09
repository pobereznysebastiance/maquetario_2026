// Capa de selección del lienzo (components/canvas/SelectionLayer.tsx): la engancha al dibujo.
// - Cada página que arma screenPage (pliego o vista continua) se le avisa a la capa, que se dibuja
//   sobre ella en el acto (grilla y guías, selección, rótulo) y pone las marcas de las reglas.
// - checkOverflow mide las cajas con texto sobrante; la marca + la dibuja la capa (sólo se
//   redibuja si cambió qué cajas desbordan: durante un arrastre se mide en cada movimiento).
//
// Carga después de review-workspace.ts y shapes.ts (la capa usa sus textos: rw, shapeNames) y de
// canvas-navigation.ts y continuous-canvas.ts (la mesa, la superficie y la vista continua).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { setOverflowing, trackPage } from './components/canvas/SelectionLayer.tsx';
import { drawSpread, onCanvasScroll } from './components/canvas/Spread.tsx';

// El pliego (components/canvas/Spread.tsx): renderPages() lo dibuja, y en la vista continua el
// desplazamiento llena las filas cercanas.
extend.after('renderPages', () => drawSpread(), 'canvas-layer');
canvasStage.addEventListener('scroll', onCanvasScroll, { passive: true });

extend.result(
  'screenPage',
  function (page: HTMLElement, _drawn: HTMLElement, index: number, px: number) {
    trackPage(page, index, px);
    return page;
  },
  'canvas-layer',
);

extend.replace(
  'checkOverflow',
  function () {
    const ids: string[] = [];
    for (const el of $$('#spread .paper-object.text')) {
      const t = el.querySelector('.text-content')!;
      if (t.scrollHeight > t.clientHeight + 2 || t.scrollWidth > t.clientWidth + 2)
        ids.push(el.dataset.id!);
    }
    // La barra de estado (React) muestra la cuenta: se redibuja después de esta función.
    overflowCount = ids.length;
    setOverflowing(ids);
  },
  'canvas-layer',
);

// El primer dibujo (hasta acá, renderPages no dibujaba nada).
renderPages();

export {};
