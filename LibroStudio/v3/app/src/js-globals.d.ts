// Globales que define el JavaScript de la interfaz (studio.js, paragraphs.js, fonts.js…) y usan
// las fuentes de src/. Sólo los ve el chequeo estricto de src/: en el chequeo del JS se ven las
// definiciones reales. Cuando un archivo pasa a src/, sus globales salen de acá.

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
import type { Book, BookObject, LibroModelApi } from './model.ts';
import type { NovelSample } from './novel-sample.ts';
import type { CoverDesign, CoverGeometryPart } from './cover-measurements.ts';

/** Cara tipográfica tal como la manda el anfitrión (desktop/src/main/fonts/opentype.ts → FontFace). */
interface NativeFontFace {
  id: string;
  family: string;
  style: string;
  [key: string]: any;
}

/** Opciones del diálogo de salida (output.js → outputConfigFromDialog). */
interface OutputDialogConfig {
  mode: string;
  paper: string;
  fit: boolean;
  crop: boolean;
  staples?: boolean;
  grid: boolean;
  guides: boolean;
  margins: boolean;
  headers: boolean;
  folios: boolean;
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
  function selectedFace(o: object): { id?: string; weight?: number; style?: string } | undefined;

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

  // ── publications.js: cubierta ──
  var coverDraft: CoverDesign | null;
  /** Zona de la cubierta elegida en el editor (backFlap, back, spine, front, frontFlap). */
  var coverPart: string;
  function defaultCover(): CoverDesign;
  /** Nombre de cada zona de la cubierta en el idioma actual. */
  function coverNames(): Record<string, string>;
  /** Sangrado más demasía, en mm. */
  function coverExtension(c: CoverDesign): number;
  function coverGeometry(c: CoverDesign): {
    parts: CoverGeometryPart[];
    width: number;
    height: number;
  };
  function updateCoverPreview(): void;
  function coverEditor(): void;
  function coverOutputDialog(): void;

  // ── canvas-navigation.js ──
  /** El lienzo no acepta acciones (bienvenida, sin documento, ocupado o con un diálogo abierto). */
  function canvasUnavailable(): boolean;
  /** Si el evento viene de un campo de texto (input, textarea, select o contenteditable). */
  function canvasInputTarget(target: EventTarget | null): boolean;

  function showWelcome(): Promise<void>;
  function bookBuilder(sample?: boolean): void;
  function gridGallery(): void;
  function openSettings(focusSection?: string): Promise<void>;

  // ── studio.js ──
  /** Hay una salida o un paquete en curso. */
  var busy: boolean;
  /** Valida el contenido de un proyecto y lo carga como libro actual. */
  function loadProject(content: string): void;
  function clearPrint(): void;

  // ── output.js ──
  function outputConfigFromDialog(): OutputDialogConfig;
  function outputPaperDimensions(
    format: string,
    artworkWidth: number,
    artworkHeight: number,
    pad?: number,
  ): [number, number];
  function outputGeometry(config: OutputDialogConfig): {
    width: number;
    height: number;
    ratio: number;
    faces: number[][];
    vertical: boolean;
    columns: number;
    rows: number;
    booklet: boolean;
  };
  function outputPreview(): void;
  function outputDialog(destination: string): Promise<void>;

  // ── fonts.js ──
  /** Caras que trae el paquete del proyecto abierto (van antes que las del sistema). */
  var portableFontFaces: NativeFontFace[];
  function updatePortableFontCatalog(): void;
  /** Carga del catálogo de fuentes del sistema (null hasta que arranca). */
  var fontCatalogPromise: Promise<unknown> | null;

  var tutorialIndex: number;
  const tutorialCard: HTMLElement;

  /** Lanza un error legible si la cubierta tiene medidas fuera de rango. */
  function validateCover(c: Record<string, any>): void;

  // ── print-proof.js ──
  function coverSheetDialog(destination: string): void;
}

export {};

export {};

export {};

export {};
