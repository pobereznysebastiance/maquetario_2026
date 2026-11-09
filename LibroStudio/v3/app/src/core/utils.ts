// Utilidades del núcleo: buscar en la página ($, $$), escapar texto para HTML (esc) y el modelo
// del libro con su nombre corto (M). No tiene efectos al cargar. Salieron de studio.ts
// (grupo 5 de la etapa 2, parte B); los publica core-wiring.ts mientras los usen studio.ts y
// las pruebas.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { LibroModelApi } from '../model.ts';

/** El primer elemento que coincide con el selector (como document.querySelector). */
export const $ = (s: string) => document.querySelector(s) as UIElement;
/** Todos los elementos que coinciden con el selector, en un arreglo. */
export const $$ = (s: string) => [...document.querySelectorAll(s)] as UIElement[];
/** Texto con &, <, >, " y ' escapados para HTML. */
export const esc = (s: unknown): string =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      (
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<
          string,
          string
        >
      )[c],
  );
/** El modelo del libro (LibroModel: model.ts carga antes en core). */
export const M: LibroModelApi = globalThis.LibroModel;
