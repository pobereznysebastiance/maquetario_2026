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

  // ── book-workflow.js: texto en el idioma de la interfaz ──

  // ── paragraphs.js ──

  // ── studio.js ──
  /** Índice de la página activa. */
  var active: number;
  /** Elemento de texto que se está editando en el lienzo, o null. */
  var editing: HTMLElement | null;
  function toast(msg: string, type?: string): void;
  function showTab(name: string): void;
  function saveProject(): Promise<boolean>;

  // ── welcome.js ──

  // ── book-workflow.js ──

  // ── paragraphs.js ──

  // ── panel-resize.js ──

  /** Primera página del pliego visible. */
  var spread: number;
  /** Id del objeto seleccionado. */
  var selected: string | null;
  /** Herramienta activa ('select', 'hand', 'text'…). */
  var tool: string;
  /** Vista previa (sin guías ni controles). */
  var preview: boolean;
  /** Cambios sin guardar. */
  var dirty: boolean;

  function settingsNew(isNew?: boolean): void;
  function download(blob: Blob, name: string): void;

  // ── studio.js ──
  /** Hay una salida o un paquete en curso. */
  var busy: boolean;
  /** Valida el contenido de un proyecto y lo carga como libro actual. */
  function loadProject(content: string): void;
  function clearPrint(): void;

  // ── print-proof.js ──

  /** Avisa al anfitrión si hay cambios sin guardar y actualiza el indicador. */
  function syncNative(): void;
  /** Diálogo de formato del libro (nuevo o existente). */
  function settings(isNew?: boolean): void;
  /** Sección del inspector; enabled es la ruta del interruptor, si tiene. */
  function section(
    title: string,
    key: string,
    body: string,
    enabled?: string | null,
    badge?: string,
  ): string;
  function row(label: string, content: string): string;
  function control(
    label: string,
    id: string,
    value: string | number,
    type?: string,
    min?: string | number,
    max?: string | number,
    full?: boolean,
  ): string;
  /** Guarda el estado para deshacer. */
  function snapshot(): void;
  /** Marca cambios sin guardar y programa la copia de recuperación. */
  function changed(): void;
  function preparePrint(): void;
  function render(full?: boolean): void;
  function renderTemplates(): void;
  /** Dibuja los íconos de los [data-icon]. */
  function icons(): void;

  // ── welcome.js ──

  /** Arrastre en curso de una caja (studio.js; frame-handles lo arma con resize = dirección). */
  interface ObjectDrag {
    o: BookObject;
    el: HTMLElement;
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
    /** false: mover; una dirección (nw, n, ne…): redimensionar (objectDown convierte true en "se"). */
    resize: string | false;
    moved: boolean;
  }

  // ── studio.js ──
  /** Trazos SVG de los íconos, por nombre. */
  const paths: Record<string, string>;
  var scale: number;
  var drag: ObjectDrag | null;
  function chooseImage(target: Record<string, unknown>): void;
  function objectDown(
    e: PointerEvent,
    o: BookObject,
    i: number,
    el: HTMLElement,
    resize?: boolean | string,
  ): void;
  function moveObject(e: PointerEvent): void;
  function upObject(e: PointerEvent): void;
  function inspector(): void;
  function updateStatus(): void;
  function checkOverflow(): void;

  // ── paragraphs.js ──

  var zoom: number;
  /** Copias del libro (JSON) para deshacer y rehacer. */
  var undoStack: string[];
  var redoStack: string[];
  function verticalSpread(): boolean;
  /** Dibuja la página i a px píxeles por milímetro. */
  function paper(i: number, px: number, print?: boolean): HTMLElement;
  /** Pregunta qué hacer con los cambios sin guardar y, si corresponde, sigue con proceed. */
  function confirmChanges(proceed: () => unknown): void;
  function openBook(): void;
  function command(name: string): void;
  function recoveryDb(): Promise<IDBDatabase>;

  // ── project-package.js ──

  // ── layout-tools.js ──

  // ── output.js ──

  // ── welcome.js ──
  /** Pantalla de bienvenida (#welcomeScreen). */

  function setTool(name: string): void;

  // ── welcome.js ──
  /** La pantalla de bienvenida está a la vista. */

  // ── book-workflow.js ──

  // ── studio.js ──
  /** Familias tipográficas disponibles (las del sistema, o unas básicas). */
  var fontList: string[];
  /** Valor del libro en una ruta con puntos ('header.font'…). */
  function get(path: string): any;

  // ── editorial-learning.js ──

  // ── output.js ──

  // ── print-proof.js ──

  // ── fonts.js ──

  // ── studio.js ──
  /** Escribe un valor del libro por ruta con puntos ('header.rule', 'folio.ruleWidth'…). */
  function set(path: string, value: unknown): void;
}

export {};

export {};
