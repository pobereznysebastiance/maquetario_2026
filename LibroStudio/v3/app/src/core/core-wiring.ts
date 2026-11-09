// Cableado de lo que salió de studio.ts (grupo 5): publica los nombres que todavía leen studio.ts
// (un script, no puede importar), los módulos de app, las pruebas y scripts/style-snapshot.js;
// registra como extensibles las funciones que otros extienden por nombre (toast: Toast.tsx;
// syncNative: react/editor-state-wiring.ts; commit: paragraphs.ts; inspector: inspector-registry,
// tutorial, review-workspace, inspector-views), y escucha las respuestas del anfitrión.
//
// Lo importa src/entries/core.ts al final: core corre antes que build/studio.js, así studio.ts
// encuentra todo publicado y registrado. Cada corte del grupo 5 suma acá lo suyo, y cuando un
// nombre deja de leerse por global, se saca.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { LibroModelApi } from '../model.ts';
import { $, $$, esc, M } from './utils.ts';
import { icon, icons, paths } from './icons.ts';
import {
  nativeCall,
  nativeReply,
  pendingToasts,
  syncNative as syncNativeBase,
  toast as toastBase,
} from './host-bridge.ts';
import { changed, commitChange, redo, snapshot, undo } from './history.ts';
import { recoveryDb } from './recovery.ts';
import {
  displayDimensions,
  displayMeasure,
  documentUnit,
  folioPositions,
  get,
  positions,
  selectObject,
  set,
} from './book-paths.ts';
import { commitBinding, commitObjectField, inspectorFacade } from './inspector.ts';
import type { BookObject } from '../model.ts';

declare global {
  /** El primer elemento que coincide con el selector (src/core/utils.ts). */
  var $: (s: string) => UIElement;
  /** Todos los elementos que coinciden con el selector. */
  var $$: (s: string) => UIElement[];
  /** Texto escapado para HTML. */
  var esc: (s: unknown) => string;
  /** El modelo del libro (LibroModel). */
  var M: LibroModelApi;
  /** Trazos SVG de los íconos, por nombre (src/core/icons.ts). */
  var paths: Record<string, string>;
  var icon: (name: string) => string;
  var icons: () => void;
  /** Pedido al proceso principal (src/core/host-bridge.ts). */
  var nativeCall: (action: string, payload?: Record<string, unknown>) => Promise<any>;
  /** Aviso del sistema (lo reemplaza components/toast/Toast.tsx al cargar). */
  var toast: (msg: string, type?: string) => void;
  /** Avisos pedidos antes de que cargue el componente de avisos. */
  var pendingToasts: [message: string, type: string][];
  /** Avisa al anfitrión si hay cambios sin guardar. */
  var syncNative: () => void;
  /** Deshacer y cambios (src/core/history.ts). */
  var snapshot: () => void;
  var changed: () => void;
  /** Cambio en el libro con deshacer y redibujo (extensible). */
  var commit: (fn: () => void, full?: boolean) => void;
  var undo: () => void;
  var redo: () => void;
  /** La base de la copia de recuperación (src/core/recovery.ts). */
  var recoveryDb: () => Promise<IDBDatabase>;
  /** Rutas y medidas del libro (src/core/book-paths.ts). */
  var get: (path: string) => any;
  var set: (path: string, value: unknown) => void;
  var selectObject: () => BookObject | undefined;
  var documentUnit: () => 'mm' | 'cm';
  var displayMeasure: (value: number) => string;
  var displayDimensions: (width: number, height: number) => string;
  var positions: string[][];
  var folioPositions: string[][];
  /** La fachada del inspector (extensible) y cómo graban sus campos (src/core/inspector.ts). */
  var inspector: () => void;
  var commitBinding: (el: UIElement) => void;
  var commitObjectField: (el: UIElement) => void;
}

globalThis.$ = $;
globalThis.$$ = $$;
globalThis.esc = esc;
globalThis.M = M;
globalThis.paths = paths;
globalThis.icon = icon;
globalThis.icons = icons;
globalThis.nativeCall = nativeCall;
globalThis.pendingToasts = pendingToasts;
globalThis.toast = extensible('toast', toastBase);
globalThis.syncNative = extensible('syncNative', syncNativeBase);
globalThis.snapshot = snapshot;
globalThis.changed = changed;
globalThis.commit = extensible('commit', commitChange);
globalThis.undo = undo;
globalThis.redo = redo;
globalThis.recoveryDb = recoveryDb;
globalThis.get = get;
globalThis.set = set;
globalThis.selectObject = selectObject;
globalThis.documentUnit = documentUnit;
globalThis.displayMeasure = displayMeasure;
globalThis.displayDimensions = displayDimensions;
globalThis.positions = positions;
globalThis.folioPositions = folioPositions;
globalThis.inspector = extensible('inspector', inspectorFacade);
globalThis.commitBinding = commitBinding;
globalThis.commitObjectField = commitObjectField;

MaquetarioHost.onMessage(nativeReply);
