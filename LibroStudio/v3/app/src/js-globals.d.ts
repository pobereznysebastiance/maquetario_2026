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
import type { Book, BookObject, LibroModelApi } from './model.ts';
import type { NovelSample } from './novel-sample.ts';
import type { CoverDesign, CoverGeometryPart } from './cover-measurements.ts';
import type { CanvasAnchor } from './continuous-canvas.ts';

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

  function bookBuilder(sample?: boolean): void;

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

  // ── fonts.js ──
  /** Carpetas de fuentes agregadas por el usuario. */
  var fontFolders: string[];
  function obtainFonts(action?: string): Promise<void>;

  /** Una cara de fuente del catálogo nativo (fonts.js). */
  interface NativeFontFace {
    id: string;
    family: string;
    style: string;
    weight: number;
    italic: boolean;
    axes: { tag: string; normal: number; min: number; max: number }[];
    instances: { name: string }[];
    [extra: string]: any;
  }

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
    /** false: mover; true o una dirección (nw, n, ne…): redimensionar. */
    resize: boolean | string;
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

  // ── fonts.js ──
  var nativeFaces: NativeFontFace[];
  function chooseDefaultFace(family: string): NativeFontFace | undefined;
  function ensureFace(face: NativeFontFace | undefined): Promise<unknown>;
  function variations(face: NativeFontFace): Record<string, number>;

  // ── paragraphs.js ──
  /** Párrafo elegido en el inspector (index -1: todo el cuadro). */
  var paragraphScope: { id: string | null; index: number };
  var paragraphOperation: boolean;
  function paragraphMeta(
    o: BookObject,
    index: number,
  ): { styleId: string | null; overrides: Record<string, any> };
  function currentParagraph(o: BookObject): number;

  function browserCurrentVariant():
    | { key: string; label: string; face: NativeFontFace; instance: { name: string } | null }
    | undefined;

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

  // ── canvas-navigation.js ──
  var canvasStage: HTMLElement;
  var canvasSurface: HTMLDivElement;
  var canvasSpreadKey: string;
  var canvasPadding: number;
  function handEnabled(): boolean;
  function updateCanvasCursor(): void;
  function canvasAnchor(clientX: number, clientY: number): CanvasAnchor;
  function restoreCanvasAnchor(anchor: CanvasAnchor): void;
  function updateCanvasZoomDisplay(): void;

  // ── fonts.js ──
  function ensureBookFonts(): Promise<unknown>;

  function startTutorial(index?: number): void;

  // ── project-package.js ──

  // ── review-workspace.js ──
  var rw: () => Record<string, string>;
  /** Ids de los objetos seleccionados con Shift + clic. */
  var multiSelection: Set<string>;
  /** Referencia de la alineación de objetos: 'margins' | 'page' | 'selection'. */
  var objectAlignReference: string;
  function updateActivePage(): void;
  function alignSelection(axis: string): void;

  // ── layout-tools.js ──
  function updateSnapButton(): void;

  // ── output.js ──
  var ow: () => Record<string, string>;
  function readPrinters(): Promise<void>;
  function sendOutput(destination: string, config: Record<string, any>): Promise<void>;

  function coverOverflow(c: any): boolean;
}

export {};

export {};

export {};

export {};

export {};

export {};
