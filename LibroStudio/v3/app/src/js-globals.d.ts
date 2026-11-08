// Globales que define el JavaScript de la interfaz (studio.js, paragraphs.js, fonts.js…) y usan
// las fuentes de src/. Sólo los ve el chequeo estricto de src/: en el chequeo del JS se ven las
// definiciones reales. Cuando un archivo pasa a src/, sus globales salen de acá.
import type { Book, BookObject, LibroModelApi } from './model.ts';

declare global {
  // ── studio.js ──
  /** Alias de LibroModel. */
  const M: LibroModelApi;
  var book: Book;
  var tab: string;
  const $: (selector: string) => UIElement;
  const $$: (selector: string) => UIElement[];
  const esc: (value: unknown) => string;
  const selectObject: () => BookObject | undefined;
  function icon(name: string): string;
  function documentUnit(): 'mm' | 'cm';
  function displayMeasure(value: number): string;
  function displayDimensions(width: number, height: number): string;
  function modal(
    title: string,
    body: string,
    apply: () => unknown,
    label?: string,
    eyebrow?: string,
  ): void;
  function commit(fn: () => void, full?: boolean): void;
  function finishEditing(): void;
  function renderPages(): void;
  /** Si la interfaz corre dentro de la app de escritorio (pasa a true cuando el anfitrión responde a "ready"). */
  var native: boolean;
  /** Pedido al proceso principal de Electron; rechaza fuera de la app de escritorio. */
  function nativeCall(action: string, payload?: Record<string, unknown>): Promise<any>;

  // ── review-workspace.js ──
  var hasDocument: boolean;

  // ── book-workflow.js: texto en el idioma de la interfaz ──
  const bw: (es: string, en: string, pt: string) => string;

  // ── paragraphs.js ──
  /** Palabras de la interfaz de párrafos en el idioma actual (l, r, c, j: alineaciones). */
  const pw: () => Record<string, string>;
  const paragraphKeys: string[];
  /** Formato efectivo de un párrafo: base del objeto + estilo + ajustes locales. */
  function paragraphFormat(b: Book, o: BookObject, index: number): Record<string, any>;

  // ── fonts.js ──
  function selectedFace(o: object): { weight?: number; style?: string } | undefined;
}

export {};
