// Controles del editor: las flechas arriba y abajo (y la rueda, con el campo enfocado) suben o
// bajan los campos numéricos respetando mínimo, máximo y paso, y conservan el foco si el
// inspector se redibuja. También ilumina el objetivo de cada paso del tutorial (oscurece el resto
// de la ventana) y aparta la tarjeta del tutorial si lo tapa.
//
// spotlight es global porque tests/feedback-tests.js revisa la iluminación.
//
// Fuente TypeScript: se compila a build/editor-controls.js (desktop/scripts/build.mjs).

declare global {
  /** Capa que oscurece la ventana y deja a la vista el objetivo del tutorial. */
  var spotlight: SVGSVGElement;
}

function stepNumberField(event: Event, direction: number): void {
  const field = event.target;
  if (
    !(field instanceof HTMLInputElement) ||
    field.type !== 'number' ||
    field.disabled ||
    field.readOnly
  )
    return;
  event.preventDefault();
  const previous = field.value;
  const container = field.closest('#inspectorContent');
  const index = container
    ? Array.from(container.querySelectorAll('input[type=number]')).indexOf(field)
    : -1;
  const fieldKeys = JSON.stringify(field.dataset);
  // stepUp and stepDown retain the field's min, max and configured precision.
  if (field.step === 'any') {
    const delta = (Number(field.value) || 0) + direction * 0.1;
    // String() da el mismo texto que el campo al recibir un número.
    field.value = String(
      Math.min(
        field.max === '' ? Infinity : Number(field.max),
        Math.max(field.min === '' ? -Infinity : Number(field.min), Number(delta.toFixed(8))),
      ),
    );
  } else if (direction > 0) field.stepUp();
  else field.stepDown();
  if (previous === field.value) return;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  if (field.isConnected) field.dispatchEvent(new Event('change', { bubbles: true }));
  if (!field.isConnected) {
    const replacement = field.id
      ? document.getElementById(field.id)
      : container?.querySelectorAll<HTMLInputElement>('input[type=number]')[index];
    if (replacement && JSON.stringify(replacement.dataset) === fieldKeys)
      replacement.focus({ preventScroll: true });
  }
}
document.addEventListener(
  'keydown',
  (event) => {
    if (
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      ['ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      stepNumberField(event, event.key === 'ArrowUp' ? 1 : -1);
    }
  },
  true,
);
document.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey && event.target === document.activeElement && event.deltaY) {
      stepNumberField(event, event.deltaY < 0 ? 1 : -1);
    }
  },
  { capture: true, passive: false },
);

const spotlight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
spotlight.id = 'tutorialSpotlight';
spotlight.setAttribute('aria-hidden', 'true');
spotlight.innerHTML = '<path fill-rule="evenodd"/><rect rx="6"/>';
spotlight.style.display = 'none';
document.body.append(spotlight);
globalThis.spotlight = spotlight;

let spotlightFrame!: number;
function updateTutorialSpotlight(): void {
  const step = guideLessons[tutorialIndex];
  let target = step && $(step.target);
  if (!target?.getClientRects().length && step) {
    target = step.id === 'templates' ? $('#toggleGridStrip') : $(`[data-tab="${step.tab}"]`);
  }
  const blocked =
    tutorialCard.hidden ||
    !!document.querySelector('dialog[open]') ||
    !target?.getClientRects().length;
  spotlight.style.display = blocked ? 'none' : '';
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
      tutorialCard.style.left =
        left / (parseFloat(getComputedStyle(tutorialCard).zoom) || 1) + 'px';
    }
  }
  if (!tutorialCard.hidden) spotlightFrame = requestAnimationFrame(updateTutorialSpotlight);
}
extend.after(
  'showTutorialStep',
  function (index: number) {
    tutorialCard.style.left = '';
    cancelAnimationFrame(spotlightFrame);
    updateTutorialSpotlight();
  },
  'editor-controls',
);
extend.after(
  'closeTutorial',
  function () {
    cancelAnimationFrame(spotlightFrame);
    spotlight.style.display = 'none';
    tutorialCard.style.left = '';
  },
  'editor-controls',
);

export {};
