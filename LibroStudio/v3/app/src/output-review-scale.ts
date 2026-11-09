// Zoom de la revisión de la salida: 'fit' (ajustar a ventana) o un factor ('1', '1.5', '2', '3').
// No tiene efectos al cargar: se importa (output.ts lo cambia, output-review.ts lo aplica).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

let scale = 'fit';
/** Zoom elegido para la revisión. */
export const reviewScale = (): string => scale;
/** Cambia el zoom de la revisión (lo aplica el próximo outputPreview). */
export function setOutputReviewScale(value: string): void {
  scale = value;
}
