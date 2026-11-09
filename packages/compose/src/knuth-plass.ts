// Cortes de línea de Knuth y Plass ("Breaking Paragraphs into Lines", 1981), el de TeX: el
// párrafo es una lista de cajas (texto que no se estira), pegamentos (espacios que se estiran o
// se encogen) y penalizaciones (lugares de corte con un costo, como un guion). En vez de llenar
// cada línea lo más posible (corte voraz), elige el conjunto de cortes que minimiza la suma de
// "deméritos" de todo el párrafo: líneas parejas, pocos guiones y nunca dos líneas seguidas muy
// distintas en holgura.

export interface Box {
  type: 'box';
  width: number;
}
export interface Glue {
  type: 'glue';
  width: number;
  stretch: number;
  shrink: number;
}
export interface Penalty {
  type: 'penalty';
  /** Ancho si se corta acá (el guion). */
  width: number;
  /** Costo de cortar acá; INFINITY_PENALTY prohíbe, -INFINITY_PENALTY obliga. */
  penalty: number;
  /** Corte con guion: dos seguidos suman flaggedDemerits. */
  flagged: boolean;
}
export type Item = Box | Glue | Penalty;

export const INFINITY_PENALTY = 10000;

export interface BreakOptions {
  /** Ancho de cada línea; con una función, puede variar por línea (sangría, capitular). */
  lineWidth: number | ((line: number) => number);
  /** Máxima maldad aceptable (TeX: \tolerance). Si no hay solución, se reintenta más alto. */
  tolerance?: number;
  /** Se suma a cada línea (TeX: \linepenalty): prefiere menos líneas. */
  linePenalty?: number;
  /** Dos líneas seguidas terminadas en guion (TeX: \doublehyphendemerits). */
  flaggedDemerits?: number;
  /** Dos líneas seguidas de clases muy distintas: una apretada y otra floja (TeX: \adjdemerits). */
  fitnessDemerits?: number;
  /**
   * Tope de líneas seguidas terminadas en guion (como en InDesign; TeX sólo las encarece). Sin
   * definir, no hay tope.
   */
  maxConsecutiveHyphens?: number;
  /**
   * Largo mínimo de la última línea, en la misma unidad que el ancho (sin contar la sangría). Un
   * párrafo de una sola línea no se mide. Sin definir o 0, no hay mínimo.
   */
  minLastLine?: number;
}

/** Un corte elegido: índice del ítem donde termina la línea y medidas de la línea. */
export interface Break {
  position: number;
  /** Relación de ajuste: >0 se estiraron los espacios, <0 se encogieron (en múltiplos de stretch/shrink). */
  ratio: number;
  /** Maldad de la línea: 100·|ratio|³ (0 perfecta, 100 ya muy floja o muy apretada). */
  badness: number;
  demerits: number;
}

interface Node {
  position: number;
  line: number;
  fitness: number;
  totalWidth: number;
  totalStretch: number;
  totalShrink: number;
  demerits: number;
  ratio: number;
  badness: number;
  /** Líneas seguidas terminadas en guion hasta este corte. */
  hyphens: number;
  previous: Node | null;
}

/** Maldad de una línea según su relación de ajuste (la fórmula de TeX). */
export function badnessOf(ratio: number): number {
  if (ratio < -1) return Infinity;
  return Math.min(100 * Math.abs(ratio) ** 3, INFINITY_PENALTY);
}

function fitnessClass(ratio: number): number {
  if (ratio < -0.5) return 0; // apretada
  if (ratio <= 0.5) return 1; // normal
  if (ratio <= 1) return 2; // floja
  return 3; // muy floja
}

/**
 * Los cortes óptimos para los ítems. El último ítem tiene que ser una penalización
 * -INFINITY_PENALTY (fin de párrafo), normalmente precedida por un pegamento que se estira sin
 * límite para que la última línea quede corta. Devuelve null si no hay solución con la tolerancia.
 */
export function knuthPlass(items: Item[], options: BreakOptions): Break[] | null {
  const tolerance = options.tolerance ?? 200;
  const linePenalty = options.linePenalty ?? 10;
  const flaggedDemerits = options.flaggedDemerits ?? 10000;
  const fitnessDemerits = options.fitnessDemerits ?? 10000;
  const maxHyphens = options.maxConsecutiveHyphens;
  const minLastLine = options.minLastLine ?? 0;
  const widthOf = (line: number) =>
    typeof options.lineWidth === 'function' ? options.lineWidth(line) : options.lineWidth;

  // Sumas acumuladas hasta cada ítem: el ancho de una línea es una resta.
  let sumWidth = 0;
  let sumStretch = 0;
  let sumShrink = 0;
  let active: Node[] = [
    {
      position: 0,
      line: 0,
      fitness: 1,
      totalWidth: 0,
      totalStretch: 0,
      totalShrink: 0,
      demerits: 0,
      ratio: 0,
      badness: 0,
      hyphens: 0,
      previous: null,
    },
  ];

  // Lo que se descarta al principio de una línea (pegamentos y penalizaciones tras un corte).
  const totalsAfter = (index: number) => {
    let width = sumWidth;
    let stretch = sumStretch;
    let shrink = sumShrink;
    for (let i = index; i < items.length; i++) {
      const item = items[i]!;
      if (item.type === 'glue') {
        width += item.width;
        stretch += item.stretch;
        shrink += item.shrink;
      } else if (item.type === 'box' || (item.penalty === -INFINITY_PENALTY && i > index)) break;
    }
    return { width, stretch, shrink };
  };

  for (let index = 0; index < items.length; index++) {
    const item = items[index]!;
    const isLegalBreak =
      (item.type === 'penalty' && item.penalty < INFINITY_PENALTY) ||
      (item.type === 'glue' && index > 0 && items[index - 1]!.type === 'box');

    if (isLegalBreak) {
      // El mejor corte por clase de ajuste (y, con tope de guiones, por guiones seguidos: si no,
      // un camino con menos deméritos pero más guiones taparía a uno que respeta el tope).
      const candidates = new Map<number, Node>();
      const penalty = item.type === 'penalty' ? item.penalty : 0;
      const flagged = item.type === 'penalty' && item.flagged;
      const breakWidth = item.type === 'penalty' ? item.width : 0;
      const next: Node[] = [];

      for (const node of active) {
        const width = sumWidth - node.totalWidth + breakWidth;
        const target = widthOf(node.line);
        let ratio: number;
        if (width < target) {
          const stretch = sumStretch - node.totalStretch;
          ratio = stretch > 0 ? (target - width) / stretch : INFINITY_PENALTY;
        } else if (width > target) {
          const shrink = sumShrink - node.totalShrink;
          ratio = shrink > 0 ? (target - width) / shrink : -INFINITY_PENALTY;
        } else ratio = 0;

        // Una línea que ni encogida entra, o un corte obligado: este nodo deja de estar activo.
        const deactivate = ratio < -1 || penalty === -INFINITY_PENALTY;
        if (!deactivate) next.push(node);

        const badness = badnessOf(ratio);
        const hyphens = flagged ? node.hyphens + 1 : 0;
        const tooManyHyphens = maxHyphens !== undefined && hyphens > maxHyphens;
        const shortLastLine = penalty === -INFINITY_PENALTY && node.line > 0 && width < minLastLine;
        if (badness <= tolerance && !tooManyHyphens && !shortLastLine) {
          let demerits = (linePenalty + badness) ** 2;
          if (penalty >= 0) demerits += penalty ** 2;
          else if (penalty > -INFINITY_PENALTY) demerits -= penalty ** 2;
          const previousItem = items[node.position];
          if (flagged && previousItem?.type === 'penalty' && previousItem.flagged)
            demerits += flaggedDemerits;
          const fitness = fitnessClass(ratio);
          if (Math.abs(fitness - node.fitness) > 1) demerits += fitnessDemerits;
          demerits += node.demerits;
          const key = fitness + 4 * (maxHyphens !== undefined ? hyphens : 0);
          const best = candidates.get(key);
          if (!best || demerits < best.demerits) {
            const totals = totalsAfter(index);
            candidates.set(key, {
              position: index,
              line: node.line + 1,
              fitness,
              totalWidth: totals.width,
              totalStretch: totals.stretch,
              totalShrink: totals.shrink,
              demerits,
              ratio,
              badness,
              hyphens,
              previous: node,
            });
          }
        }
      }
      next.push(...candidates.values());
      active = next;
      if (!active.length) return null;
    }

    if (item.type === 'box') sumWidth += item.width;
    else if (item.type === 'glue') {
      sumWidth += item.width;
      sumStretch += item.stretch;
      sumShrink += item.shrink;
    }
  }

  let best: Node | undefined;
  for (const node of active)
    if (node.position === items.length - 1 && (!best || node.demerits < best.demerits)) best = node;
  if (!best) return null;
  const breaks: Break[] = [];
  for (let node: Node | null = best; node?.previous; node = node.previous)
    breaks.unshift({
      position: node.position,
      ratio: node.ratio,
      badness: node.badness,
      demerits: node.demerits - node.previous.demerits,
    });
  return breaks;
}
