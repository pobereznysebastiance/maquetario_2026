// Globales que define el JavaScript de la interfaz (studio.js, paragraphs.js, fonts.js…) y usan
// las fuentes de src/. Sólo los ve el chequeo estricto de src/: en el chequeo del JS se ven las
// definiciones reales. Cuando un archivo pasa a src/, sus globales salen de acá.
import type { Book, BookObject, LibroModelApi } from './model.ts';
import type { NovelSample } from './novel-sample.ts';

/** Una lección del tutorial (title, body y task: castellano, inglés y portugués). */
interface GuideLesson {
  id: string;
  tab: string;
  target: string;
  title: string[];
  body: string[];
  task: string[];
  action: string;
}

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

  // ── studio.js ──
  /** Índice de la página activa. */
  var active: number;
  /** Elemento de texto que se está editando en el lienzo, o null. */
  var editing: HTMLElement | null;
  function toast(msg: string, type?: string): void;
  function showTab(name: string): void;
  function saveProject(): Promise<boolean>;

  // ── welcome.js ──
  function hideWelcome(): void;

  // ── tutorial.js ──
  const guideLessons: GuideLesson[];
  function lesson(
    id: string,
    tab: string,
    target: string,
    title: string[],
    body: string[],
    task: string[],
    action?: string,
  ): void;
  function closeTutorial(): void;

  // ── book-workflow.js ──
  function goToBookPage(index: number): void;
  function composeNovel(data: NovelSample): Book;
  function installNovel(b: Book): void;
  /** Revisión del libro: objetos fuera de la página y cajas de texto desbordadas. */
  function preflightBook(): { page: number; kind: 'bounds' | 'overflow' }[];

  // ── output.js ──
  function prepareOutput(config: Record<string, unknown>): {
    width: number;
    height: number;
    faces: number;
    scale: number;
  };

  // ── paragraphs.js ──
  function paragraphPatch(values: Record<string, unknown>): void;

  // ── panel-resize.js ──
  function applyPanelSizes(): void;

  // ── font-browser.js ──
  const fontBrowser: HTMLDialogElement;
}

export {};

export {};
