// Formato del libro: abrir la Hoja (settings) y aplicar lo elegido (applyBookSettings). No tiene
// efectos al cargar. core-wiring.ts publica settings y registra
// applyBookSettings como extensible (review-workspace, publications y las pruebas la extienden).
// Lo que llama del resto (commit, confirmChanges, settingsNew) va por el nombre global.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { M } from './utils.ts';

/**
 * Hoja de formato del libro (nuevo o existente; src/components/book-setup/). Con cambios sin
 * guardar, antes pregunta. Devuelve la promesa de la Hoja (se cumple al cerrarla), si la abrió.
 */
export function settings(isNew = false): Promise<void> | undefined {
  if (isNew && dirty) {
    confirmChanges(() => settingsNew(), 'new');
    return;
  }
  return settingsNew(isNew);
}
/** Lo que se eligió en la Hoja de formato del libro (src/components/book-setup/), tal como está escrito. */
export interface BookSettingsValues {
  title: string;
  /** Ancho y alto en la unidad elegida (unit). */
  width: string;
  height: string;
  /** Cantidad de páginas (sólo libro nuevo). */
  count: string;
  unit: 'mm' | 'cm';
  /** 'single' | 'horizontal' | 'vertical'. */
  arrangement: string;
  /** Nombre del formato (A5, Carta…) o 'Personalizado'. */
  format: string;
  /** Producto editorial elegido (libro nuevo; lo usa publications.ts). */
  publicationType?: string;
}
/**
 * Aplica la Hoja de formato del libro: un libro nuevo (isNew) o el formato del actual. Si los
 * valores no sirven, tira el error que muestra la Hoja. Otros módulos la extienden por nombre
 * (review-workspace: ya hay documento; publications: la grilla del producto editorial). La Hoja
 * la abre settingsNew (src/components/book-setup/BookSetup.tsx). Se publica extensible como
 * applyBookSettings (core-wiring.ts): no llamarla por este nombre.
 */
export function applyBookSettingsBase(isNew: boolean, values: BookSettingsValues): boolean {
  const measureUnit = values.unit,
    unit = measureUnit === 'cm' ? 10 : 1,
    w = Number((Number(values.width) * unit).toFixed(8)),
    h = Number((Number(values.height) * unit).toFixed(8)),
    count = isNew ? Number(values.count) : book.pages.length;
  if (
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w < 60 ||
    w > 420 ||
    h < 60 ||
    h > 594 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 200
  )
    throw Error('Ingresá medidas válidas y entre 1 y 200 páginas.');
  const title = values.title.trim().slice(0, 250) || 'Mi libro',
    arrangement = values.arrangement,
    facing = arrangement !== 'single',
    format = values.format;
  commit(() => {
    if (isNew) {
      book = M.create();
      book.pages = Array.from({ length: count }, M.page);
      book.grid.cols = 1;
      book.grid.rows = 1;
      book.chapter = '';
      selected = null;
      active = spread = 0;
    }
    const resized = isNew || Math.abs(book.width - w) > 1e-7 || Math.abs(book.height - h) > 1e-7;
    book.measurementUnit = measureUnit;
    if (resized) {
      book.width = w;
      book.height = h;
    }
    if (resized && book.guides)
      book.guides = book.guides.map((g: { axis: string; position: number }) => ({
        ...g,
        position: Math.min(g.position, g.axis === 'v' ? w : h),
      }));
    book.title = title;
    book.facing = facing;
    book.spreadDirection = arrangement === 'vertical' ? 'vertical' : 'horizontal';
    book.format = format;
    if (resized) {
      const maxMargin = Math.min(w, h) / 4;
      for (const k of Object.keys(book.margins) as (keyof typeof book.margins)[])
        book.margins[k] = Math.min(book.margins[k], maxMargin);
      if (!M.validateGrid(book)) {
        book.grid.gapX = book.grid.gapY = 0;
      }
      for (const p of book.pages)
        for (const o of p.objects) {
          o.w = Math.min(o.w, w);
          o.h = Math.min(o.h, h);
          o.x = Math.min(o.x, w - o.w);
          o.y = Math.min(o.y, h - o.h);
        }
    }
    spread = Math.floor(active / (facing ? 2 : 1)) * (facing ? 2 : 1);
  }, true);
  return true;
}
