// Revisión de la salida: zoom de la simulación (ajustar a ventana, 100–300 %). Las dos columnas
// (opciones | revisión), el selector de zoom y el botón para ampliar la revisión los dibuja la
// ventana de React (components/output/OutputWindow.tsx); acá se escala la hoja dentro de
// #outputPreview después de cada outputPreview.
//
// El zoom elegido vive en output-review-scale.ts (sin efectos): lo cambia output.ts cuando cambia
// el selector o se amplía la revisión.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { reviewScale, setOutputReviewScale } from './output-review-scale.ts';

extend.after(
  'outputPreview',
  function () {
    const box = $('#outputPreview'),
      sheet = box?.querySelector<HTMLElement>('.output-sheet');
    if (!sheet) return;
    const config = outputConfigFromDialog(),
      geometry = outputGeometry(config),
      px = 96 / 25.4,
      fit = Math.min(
        (box.clientWidth - 36) / (geometry.width * px),
        (box.clientHeight - 36) / (geometry.height * px),
      ),
      k = reviewScale() === 'fit' ? fit : Number(reviewScale()),
      w = geometry.width * px * k,
      h = geometry.height * px * k;
    const canvas = document.createElement('div');
    canvas.className = 'output-review-canvas';
    Object.assign(canvas.style, {
      position: 'relative',
      width: Math.max(box.clientWidth, w + 36) + 'px',
      height: Math.max(box.clientHeight, h + 36) + 'px',
    });
    Object.assign(sheet.style, {
      transform: `scale(${k})`,
      transformOrigin: 'top left',
      position: 'absolute',
      left: Math.max(18, (box.clientWidth - w) / 2) + 'px',
      top: Math.max(18, (box.clientHeight - h) / 2) + 'px',
    });
    canvas.append(sheet);
    box.replaceChildren(canvas);
    if ($('#outputReviewZoom')) $('#outputReviewZoom').value = reviewScale();
    if ($('#outputReviewFactor')) $('#outputReviewFactor').textContent = Math.round(k * 100) + '%';
  },
  'output-review',
);
// Cada ventana nueva arranca ajustada a la ventana; cuando ya tiene su tamaño, se vuelve a ajustar.
extend.before(
  'outputDialog',
  function () {
    setOutputReviewScale('fit');
  },
  'output-review',
);
extend.after(
  'outputDialog',
  function () {
    if ($('#outputPreview')) requestAnimationFrame(outputPreview);
  },
  'output-review',
);
window.addEventListener('resize', () => {
  if ($('#outputPreview')) outputPreview();
});

export {};
