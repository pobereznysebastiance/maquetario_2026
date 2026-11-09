// Rutas y medidas del libro: leer y escribir por ruta con puntos ('header.font'), el objeto
// elegido, la unidad del documento y cómo se muestran las medidas, y las posiciones de cornisas y
// folios. No tiene efectos al cargar. Lo publica core-wiring.ts.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { BookObject } from '../model.ts';

/** Valor del libro en una ruta con puntos ('header.font'…). */
export function get(path: string): any {
  return path.split('.').reduce((a: any, k) => a?.[k], book);
}
/** Escribe un valor del libro por ruta con puntos ('header.rule', 'folio.ruleWidth'…). */
export function set(path: string, value: unknown): void {
  let keys = path.split('.'),
    last = keys.pop()!,
    obj = keys.reduce((a: any, k) => a[k], book);
  obj[last] = value;
}
/** El objeto elegido en la página activa, si hay. */
export const selectObject = (): BookObject | undefined =>
  book.pages[active]?.objects.find((o) => o.id === selected);
/** Unidad de medida del documento. */
export function documentUnit(): 'mm' | 'cm' {
  return book.measurementUnit === 'cm' ? 'cm' : 'mm';
}
/** Una medida (en mm) en la unidad del documento, sin ceros de más. */
export function displayMeasure(value: number): string {
  return Number((Number(value) / (documentUnit() === 'cm' ? 10 : 1)).toFixed(4)).toString();
}
/** Ancho × alto en la unidad del documento ("148 × 210 mm"). */
export function displayDimensions(width: number, height: number): string {
  return `${displayMeasure(width)} × ${displayMeasure(height)} ${documentUnit()}`;
}
/** Posiciones de las cornisas y titulillos: valor y nombre. */
export const positions = [
  ['top', 'Margen superior'],
  ['bottom', 'Margen inferior'],
  ['outer', 'Lateral exterior'],
  ['inner', 'Lateral interior'],
  ['left', 'Lateral izquierdo'],
  ['right', 'Lateral derecho'],
];
/** Posiciones del folio: valor y nombre. */
export const folioPositions = [
  ['bottom-outer', 'Inferior exterior'],
  ['bottom-center', 'Inferior centrado'],
  ['bottom-inner', 'Inferior interior'],
  ['top-outer', 'Superior exterior'],
  ['top-center', 'Superior centrado'],
  ['top-inner', 'Superior interior'],
  ['outer', 'Lateral exterior'],
  ['inner', 'Lateral interior'],
];
