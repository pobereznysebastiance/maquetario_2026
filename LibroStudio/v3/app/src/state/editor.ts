// Estado del editor en un solo objeto (etapa 2, parte B, grupo 3).
//
//   import { editor } from '../state/editor.ts';
//   editor.book.pages[editor.active]
//
// Antes, cada pieza de estado era un `let` del núcleo (studio.ts) o un global que publicaba un
// módulo, y otros archivos, las pruebas y las cadenas de la autoprueba lo leían y lo asignaban por
// su nombre (`book = …`, `({ book, active } = previous)`). Mientras se migra, cada nombre sigue
// existiendo como global: es un accesor sobre este objeto (Object.defineProperty en globalThis),
// así que leer y asignar `book` es leer y asignar `editor.book`, sin cambiar una línea de quien lo
// usa. Los módulos nuevos importan `editor`; el inventario (scripts/globals-report.mjs --state)
// muestra quién sigue usando el nombre suelto.
//
// Carga en core, después del modelo y antes de studio.ts (src/entries/core.ts): los accesores
// tienen que existir antes de que el núcleo o un módulo asigne el valor inicial.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { Book } from '../model.ts';
import type { CoverDesign } from '../publications.ts';

export interface EditorState {
  /** El libro abierto. */
  book: Book;
  /** Índice de la página activa. */
  active: number;
  /** Primera página del pliego visible. */
  spread: number;
  /** Id del objeto seleccionado. */
  selected: string | null;
  /** Herramienta activa ('select', 'hand', 'text'…). */
  tool: string;
  /** Pestaña interna del inspector ('design', 'text', 'object'…). */
  tab: string;
  zoom: number;
  /** Escala efectiva del pliego: px de pantalla por mm. */
  scale: number;
  /** Vista previa (sin guías ni controles). */
  preview: boolean;
  /** Cambios sin guardar. */
  dirty: boolean;
  /** Hay una salida o un paquete en curso. */
  busy: boolean;
  /** Familias tipográficas disponibles (las del sistema, o unas básicas). */
  fontList: string[];
  /** Si la interfaz corre dentro de la app de escritorio (pasa a true cuando el anfitrión responde a "ready"). */
  native: boolean;
  /** Copias del libro (JSON) para deshacer y rehacer. */
  undoStack: string[];
  redoStack: string[];
  /** Elemento de texto que se está editando en el lienzo, o null. */
  editing: HTMLElement | null;
  /** Arrastre en curso de una caja. */
  drag: ObjectDrag | null;
  // Estado que publicaban los módulos (cada uno sigue asignando su valor inicial al cargar).
  /** Hay un libro abierto (review-workspace.ts). */
  hasDocument: boolean;
  /** Objetos elegidos con Mayús (review-workspace.ts). */
  multiSelection: Set<string>;
  /** Párrafo elegido dentro de la caja de texto (paragraphs.ts). */
  paragraphScope: { id: string | null; index: number };
  /** Cubierta que se está editando (publications.ts). */
  coverDraft: CoverDesign | null;
  /** Zona de la cubierta elegida en el editor (publications.ts). */
  coverPart: string;
}

export const editor: EditorState = {
  book: LibroModel.create(),
  active: 0,
  spread: 0,
  selected: null,
  tool: 'select',
  tab: 'design',
  zoom: 1,
  scale: 1,
  preview: false,
  dirty: false,
  busy: false,
  fontList: [
    'Georgia',
    'Times New Roman',
    'Garamond',
    'Arial',
    'Calibri',
    'Cambria',
    'Palatino Linotype',
    'Verdana',
  ],
  native: false,
  undoStack: [],
  redoStack: [],
  editing: null,
  drag: null,
  // Los módulos los inicializan al cargar (por el accesor).
  hasDocument: false,
  multiSelection: new Set(),
  paragraphScope: { id: null, index: -1 },
  coverDraft: null,
  coverPart: 'front',
};

// El estado del núcleo, como globales (los del módulo los declara cada módulo).
declare global {
  var book: Book;
  var active: number;
  var spread: number;
  var selected: string | null;
  var tool: string;
  var tab: string;
  var zoom: number;
  var scale: number;
  var preview: boolean;
  var dirty: boolean;
  var busy: boolean;
  var fontList: string[];
  var native: boolean;
  var undoStack: string[];
  var redoStack: string[];
  var editing: HTMLElement | null;
  var drag: ObjectDrag | null;
  /** El estado del editor (para pruebas y depuración; los módulos lo importan). */
  var maquetarioEditor: EditorState;
}

// Un accesor por nombre: leer o asignar el global es leer o asignar el campo de editor.
for (const key of Object.keys(editor) as (keyof EditorState)[])
  Object.defineProperty(globalThis, key, {
    get: () => editor[key],
    set: (value: never) => {
      editor[key] = value;
    },
    configurable: true,
    enumerable: true,
  });
globalThis.maquetarioEditor = editor;
