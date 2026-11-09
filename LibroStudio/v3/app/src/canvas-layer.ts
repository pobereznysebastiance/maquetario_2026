// Capa de selección del lienzo (components/canvas/SelectionLayer.tsx): la engancha al dibujo.
// - Cada página que arma screenPage (pliego o vista continua) se le avisa a la capa, que se dibuja
//   sobre ella en el acto.
// - checkOverflow mide las cajas con texto sobrante; la marca + la dibuja la capa (sólo se
//   redibuja si cambió qué cajas desbordan: durante un arrastre se mide en cada movimiento).
//
// Carga después de review-workspace.ts y shapes.ts: la capa usa sus textos (rw, shapeNames).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { setOverflowing, trackPage } from './components/canvas/SelectionLayer.tsx';

extend.result(
  'screenPage',
  function (page: HTMLElement, _drawn: HTMLElement, index: number) {
    trackPage(page, index);
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

// Lo que ya estaba dibujado al cargar este módulo.
for (const page of $$('#spread .page')) trackPage(page, Number(page.dataset.page));

export {};
