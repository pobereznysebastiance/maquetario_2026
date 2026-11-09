// Salida de lectura: armar las páginas en #printRoot para imprimir o pasar a PDF y sacarlas. No
// tiene efectos al cargar. Salió de studio.ts (grupo 5); core-wiring.ts las publica (el contrato
// con el proceso principal las llama). paper() va por el nombre global.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { $ } from './utils.ts';

/**
 * Arma la salida de lectura en #printRoot: todas las páginas a tamaño real. Se publica extensible
 * como preparePrint (core-wiring.ts; compose-loader la extiende).
 */
export function preparePrintBase(): boolean {
  finishEditing();
  const root = $('#printRoot');
  root.replaceChildren();
  const px = 96 / 25.4;
  const style = document.createElement('style');
  style.textContent = `@page{size:${book.width}mm ${book.height}mm;margin:0}`;
  root.append(style);
  for (let i = 0; i < book.pages.length; i++) root.append(paper(i, px, true));
  return true;
}
/** Saca la salida de #printRoot. */
export function clearPrint(): void {
  $('#printRoot').replaceChildren();
}
