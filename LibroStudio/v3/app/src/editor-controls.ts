// Controles del editor: ilumina el objetivo de cada paso del tutorial (oscurece el resto de la
// ventana) y aparta la tarjeta del tutorial si lo tapa. Las flechas, la rueda y las flechitas de
// los campos numéricos están en number-stepper.ts.
//
// spotlight es global porque tests/feedback-tests.js revisa la iluminación.
//
// Fuente TypeScript: se compila a build/editor-controls.js (desktop/scripts/build.mjs).

import { inspectorTabFor } from './inspector-tabs.ts';
import { guideLessons, tutorialCard, tutorialIndex } from './tutorial-lessons.ts';

declare global {
  /** Capa que oscurece la ventana y deja a la vista el objetivo del tutorial. */
  var spotlight: SVGSVGElement;
}

const spotlight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
spotlight.id = 'tutorialSpotlight';
spotlight.setAttribute('aria-hidden', 'true');
spotlight.innerHTML = '<path fill-rule="evenodd"/><rect rx="6"/>';
spotlight.toggleAttribute('hidden', true);
document.body.append(spotlight);
globalThis.spotlight = spotlight;

let spotlightFrame!: number;
function updateTutorialSpotlight(): void {
  const step = guideLessons[tutorialIndex];
  let target = step && $(step.target);
  if (!target?.getClientRects().length && step) {
    target =
      step.id === 'templates'
        ? $('#toggleGridStrip')
        : $(`[data-tab="${inspectorTabFor(step.tab)}"]`);
  }
  const blocked =
    tutorialCard.hidden ||
    !!document.querySelector('dialog[open]') ||
    !target?.getClientRects().length;
  spotlight.toggleAttribute('hidden', !!blocked);
  if (!blocked) {
    const rect = target.getBoundingClientRect();
    let x = Math.max(0, rect.left - 5),
      y = Math.max(0, rect.top - 5);
    let right = Math.min(innerWidth, rect.right + 5),
      bottom = Math.min(innerHeight, rect.bottom + 5);
    for (
      let parent = target.parentElement;
      parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent),
        bounds = parent.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
        x = Math.max(x, bounds.left);
        right = Math.min(right, bounds.right);
      }
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
        y = Math.max(y, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
    }
    const width = Math.max(0, right - x),
      height = Math.max(0, bottom - y);
    const hole = width && height ? `M${x} ${y}h${width}v${height}h-${width}z` : '';
    spotlight
      .querySelector('path')!
      .setAttribute('d', `M0 0H${innerWidth}V${innerHeight}H0z${hole}`);
    const outline = spotlight.querySelector('rect')!;
    // String() da el mismo texto que setAttribute al recibir un número.
    for (const [key, value] of Object.entries({ x, y, width, height }))
      outline.setAttribute(key, String(value));
    const card = tutorialCard.getBoundingClientRect();
    if (
      width &&
      height &&
      x < card.right &&
      right > card.left &&
      y < card.bottom &&
      bottom > card.top
    ) {
      const left =
        right + card.width + 20 < innerWidth ? right + 10 : Math.max(10, x - card.width - 10);
      // La posición va en la variable de la tarjeta (ui/organisms/tutorial.css), no en left.
      tutorialCard.style.setProperty(
        '--tutorial-card-left',
        left / (parseFloat(getComputedStyle(tutorialCard).zoom) || 1) + 'px',
      );
    }
  }
  if (!tutorialCard.hidden) spotlightFrame = requestAnimationFrame(updateTutorialSpotlight);
}
extend.after(
  'showTutorialStep',
  function (index: number) {
    tutorialCard.style.removeProperty('--tutorial-card-left');
    cancelAnimationFrame(spotlightFrame);
    updateTutorialSpotlight();
  },
  'editor-controls',
);
extend.after(
  'closeTutorial',
  function () {
    cancelAnimationFrame(spotlightFrame);
    spotlight.toggleAttribute('hidden', true);
    tutorialCard.style.removeProperty('--tutorial-card-left');
  },
  'editor-controls',
);

export {};
