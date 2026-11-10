// Flechitas de los campos numéricos (pedido de la BETA 0.2): las mismas en todo el programa, en
// lugar de las del sistema, que se veían distintas en cada computadora.
//
// - Aparecen al pasar el puntero por un campo numérico o al editarlo, dentro del borde del campo (a
//   la izquierda de la unidad, si tiene). Es una sola pieza para toda la página: no hace falta
//   tocar cada panel, y lo que dibuja React no se entera (vive en la capa superior como popover,
//   dentro del <dialog> del campo si está en uno, para no quedar debajo ni inerte).
// - Cada clic cambia 0,1 (de 22 a 22,1) y con Mayúscula, 1. En los campos de enteros (columnas,
//   número de página, peso) cambia de a uno, y con Mayúscula de a diez. Lo mismo con las flechas
//   del teclado y con la rueda, con el campo enfocado.
// - Apretada, la flechita repite el paso. Lo que se cambia mientras está apretada (o mientras se
//   mantiene una flecha del teclado) se deshace de una sola vez: editor.historyGroup, que el
//   historial mira sólo mientras corre el cambio de la flechita.
// - Cada paso dispara input y change, como si se escribiera el valor: el campo lo aplica con su
//   manejador de siempre. Si el inspector vuelve a crear el campo (cambió el valor), se sigue con
//   el nuevo, y se le devuelve el foco.
// - Los campos con paso fraccionario pasan a step="any": 22,1 es un valor válido aunque el campo
//   tuviera paso 0,5 (si no, el navegador lo daba por inválido).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { editor } from './core-api.ts';
import { anyCommandKey } from './keys.ts';

const native = (property: 'value') =>
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, property)!;
/** El valor como se ve (los campos de longitud en cm lo convierten al leerlo: length-fields.ts). */
const shownValue = (field: HTMLInputElement): string => native('value').get!.call(field);
const setShownValue = (field: HTMLInputElement, value: string): void =>
  native('value').set!.call(field, value);
const attributeNumber = (field: HTMLInputElement, name: 'min' | 'max', fallback: number) => {
  const value = field.getAttribute(name);
  return value === null || value === '' || !Number.isFinite(Number(value))
    ? fallback
    : Number(value);
};

const isNumberField = (target: EventTarget | null): target is HTMLInputElement =>
  target instanceof HTMLInputElement && target.type === 'number';
const usable = (field: HTMLInputElement): boolean =>
  !field.disabled && !field.readOnly && field.isConnected && !field.closest('[inert]');

/**
 * Cuánto cambia un paso: 0,1 (o el paso del campo, si es más fino) y diez veces más con Mayúscula;
 * en los campos de enteros, su paso y diez pasos. El paso original se guarda la primera vez y el
 * campo fraccionario pasa a step="any".
 */
function deltaFor(field: HTMLInputElement, big: boolean): number {
  if (field.dataset.stepperStep === undefined) {
    field.dataset.stepperStep = field.getAttribute('step') ?? '';
    const step = Number(field.dataset.stepperStep);
    if (
      field.dataset.stepperStep !== 'any' &&
      field.dataset.stepperStep !== '' &&
      step > 0 &&
      step < 1
    )
      field.setAttribute('step', 'any');
  }
  const original = field.dataset.stepperStep,
    step = original === '' ? 1 : original === 'any' ? 0 : Number(original);
  const whole = step >= 1 && Number.isInteger(step);
  const small = whole ? step : step > 0 && step < 0.1 ? step : 0.1;
  return big ? small * 10 : small;
}
const decimals = (n: number): number => {
  const text = String(n);
  return text.includes('e-') ? Number(text.split('e-')[1]) : (text.split('.')[1] || '').length;
};

/** Dónde buscar el mismo campo si el inspector lo vuelve a crear. */
interface FieldTrace {
  id: string;
  keys: string;
  root: ParentNode;
  index: number;
}
const traceOf = (field: HTMLInputElement): FieldTrace => {
  const root: ParentNode = field.closest('#inspectorContent, dialog') ?? document;
  return {
    id: field.id,
    keys: JSON.stringify(field.dataset),
    root,
    index: [...root.querySelectorAll('input[type=number]')].indexOf(field),
  };
};
/** El campo vivo: el mismo, o el que lo reemplazó (mismo id, o mismo lugar y mismos data-*). */
function liveField(field: HTMLInputElement, trace: FieldTrace): HTMLInputElement | null {
  if (field.isConnected) return field;
  const candidate = trace.id
    ? document.getElementById(trace.id)
    : trace.root.querySelectorAll<HTMLInputElement>('input[type=number]')[trace.index];
  if (!isNumberField(candidate)) return null;
  const { stepperStep: _, ...keys } = candidate.dataset;
  const { stepperStep: __, ...wanted } = JSON.parse(trace.keys) as Record<string, string>;
  return JSON.stringify(keys) === JSON.stringify(wanted) ? candidate : null;
}

/**
 * Sube (direction 1) o baja (-1) el campo un paso, dentro de su mínimo y su máximo, y lo aplica.
 * Devuelve el campo vivo después del cambio (el inspector puede haberlo reemplazado).
 */
export function stepField(
  field: HTMLInputElement,
  direction: 1 | -1,
  big = false,
): HTMLInputElement | null {
  if (!usable(field)) return field;
  const delta = deltaFor(field, big),
    current = Number(shownValue(field)) || 0,
    places = Math.min(6, Math.max(decimals(delta), decimals(current)));
  const next = Math.min(
    attributeNumber(field, 'max', Infinity),
    Math.max(attributeNumber(field, 'min', -Infinity), current + direction * delta),
  );
  // String() da el mismo texto que el campo al recibir un número.
  const text = String(Number(next.toFixed(places)));
  if (text === shownValue(field)) return field;
  const trace = traceOf(field),
    focused = document.activeElement === field;
  setShownValue(field, text);
  // El grupo de deshacer vale sólo mientras corre este cambio: ningún otro cambio se suma a él.
  editor.historyGroup = group;
  try {
    field.dispatchEvent(new Event('input', { bubbles: true }));
    if (field.isConnected) field.dispatchEvent(new Event('change', { bubbles: true }));
  } finally {
    editor.historyGroup = null;
  }
  const live = liveField(field, trace);
  if (live && live !== field && focused) live.focus({ preventScroll: true });
  return live;
}

// ── Deshacer de una vez ──

// Mientras una flechita está apretada (o una flecha del teclado se repite), los pasos comparten un
// grupo: sólo el primero guarda el estado para deshacer. stepField lo presta al historial nada más
// durante su propio cambio, así un grupo que quedó abierto (un keyup que no llegó) no se traga
// cambios de otro lado. Sin grupo, cada paso es un cambio aparte.
let group: { snapshotTaken: boolean } | null = null;
const beginGroup = (): void => {
  group = { snapshotTaken: false };
};
const endGroup = (): void => {
  group = null;
};
window.addEventListener('blur', endGroup);

// ── Teclado y rueda ──

document.addEventListener(
  'keydown',
  (event) => {
    if (event.altKey || anyCommandKey(event) || !['ArrowUp', 'ArrowDown'].includes(event.key))
      return;
    if (!isNumberField(event.target) || !usable(event.target)) return;
    event.preventDefault();
    // La flecha mantenida repite keydown (repeat): todo hasta soltarla se deshace junto.
    if (!event.repeat) beginGroup();
    stepper.show(stepField(event.target, event.key === 'ArrowUp' ? 1 : -1, event.shiftKey));
  },
  true,
);
document.addEventListener(
  'keyup',
  (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') endGroup();
  },
  true,
);
document.addEventListener(
  'wheel',
  (event) => {
    if (anyCommandKey(event) || !event.deltaY || !isNumberField(event.target)) return;
    if (event.target !== document.activeElement || !usable(event.target)) return;
    event.preventDefault();
    stepField(event.target, event.deltaY < 0 ? 1 : -1, event.shiftKey);
  },
  { capture: true, passive: false },
);

// ── Las flechitas ──

const ARROW_UP = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 5 5 1l4 4"/></svg>';
const ARROW_DOWN = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>';
/** Antes de repetir, y cada cuánto repite mientras está apretada (ms). */
const REPEAT_DELAY = 400;
const REPEAT_EVERY = 60;

const stepper = (() => {
  const element = document.createElement('div');
  element.className = 'number-stepper';
  element.setAttribute('popover', 'manual');
  // Son un atajo para el puntero: con el teclado están las flechas (y el lector de pantalla las
  // anuncia del campo). No toman el foco.
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML =
    `<span class="number-stepper-arrow" data-direction="1">${ARROW_UP}</span>` +
    `<span class="number-stepper-arrow" data-direction="-1">${ARROW_DOWN}</span>`;

  let field: HTMLInputElement | null = null;
  let trace: FieldTrace | null = null;
  let hovering = false;
  let frame = 0;
  let pressed: { timer: number; direction: 1 | -1; big: boolean } | null = null;

  const place = (): void => {
    if (!field) return;
    const box = field.getBoundingClientRect();
    if (!box.width || !box.height) return hide();
    // A la izquierda de la unidad (mm, pt), dentro del borde del campo.
    const unit = field.parentElement?.querySelector(':scope > .unit');
    const right = unit ? unit.getBoundingClientRect().left : box.right;
    element.style.setProperty('--stepper-right', `${innerWidth - right}px`);
    element.style.setProperty('--stepper-top', `${box.top}px`);
    element.style.setProperty('--stepper-height', `${box.height}px`);
  };
  /** Mientras se ve: sigue al campo (desplazamiento, inspector redibujado) y se va si no está. */
  const follow = (): void => {
    if (!field || !trace) return;
    const live = liveField(field, trace);
    if (!live || !usable(live)) return hide();
    if (live !== field) attach(live);
    else place();
    frame = requestAnimationFrame(follow);
  };
  const attach = (next: HTMLInputElement): void => {
    field = next;
    trace = traceOf(next);
    deltaFor(next, false);
    // En la capa superior, dentro del <dialog> del campo: así no queda debajo ni inerte.
    const container = next.closest('dialog') ?? document.body;
    if (element.parentElement !== container) {
      if (element.matches(':popover-open')) element.hidePopover();
      container.append(element);
    }
    if (!element.matches(':popover-open')) element.showPopover();
    place();
  };
  const show = (next: HTMLInputElement | null): void => {
    if (!next || !usable(next)) return;
    attach(next);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(follow);
  };
  function hide(): void {
    if (pressed) return;
    cancelAnimationFrame(frame);
    field = trace = null;
    if (element.isConnected && element.matches(':popover-open')) element.hidePopover();
  }
  /** Se va si el puntero no está ni en el campo ni en las flechitas y el campo no tiene el foco. */
  const maybeHide = (): void => {
    if (!field || pressed) return;
    if (!hovering && document.activeElement !== field && !field.matches(':hover')) hide();
  };

  const release = (): void => {
    if (!pressed) return;
    clearTimeout(pressed.timer);
    pressed = null;
    element.removeAttribute('data-pressed');
    endGroup();
    maybeHide();
  };
  const repeat = (): void => {
    if (!pressed || !field) return;
    const live = stepField(field, pressed.direction, pressed.big);
    if (!live) return release();
    if (live !== field) attach(live);
    pressed.timer = window.setTimeout(repeat, REPEAT_EVERY);
  };
  element.addEventListener('pointerdown', (event) => {
    const arrow = (event.target as Element).closest<HTMLElement>('[data-direction]');
    // Sin robar el foco al campo (ni cerrar el diálogo).
    event.preventDefault();
    if (!arrow || !field || event.button !== 0) return;
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Un puntero que ya no está (evento sintético): se suelta con pointerup igual.
    }
    if (document.activeElement !== field) field.focus({ preventScroll: true });
    beginGroup();
    const direction = Number(arrow.dataset.direction) as 1 | -1;
    pressed = { timer: 0, direction, big: event.shiftKey };
    element.setAttribute('data-pressed', String(direction));
    const live = stepField(field, direction, event.shiftKey);
    if (!live) return release();
    if (live !== field) attach(live);
    pressed.timer = window.setTimeout(repeat, REPEAT_DELAY);
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
  element.addEventListener('pointerenter', () => (hovering = true));
  element.addEventListener('pointerleave', () => {
    hovering = false;
    maybeHide();
  });

  document.addEventListener(
    'pointerover',
    (event) => {
      if (isNumberField(event.target) && event.target !== field && !pressed) show(event.target);
    },
    true,
  );
  document.addEventListener(
    'pointerout',
    (event) => {
      if (event.target === field && event.relatedTarget !== element) {
        // Lo que se dibuja sobre el campo (las flechitas) no cuenta como salir.
        if (element.contains(event.relatedTarget as Node)) return;
        requestAnimationFrame(maybeHide);
      }
    },
    true,
  );
  document.addEventListener('focusin', (event) => {
    if (isNumberField(event.target)) show(event.target);
  });
  document.addEventListener('focusout', (event) => {
    if (event.target === field) requestAnimationFrame(maybeHide);
  });
  return { show, hide };
})();
