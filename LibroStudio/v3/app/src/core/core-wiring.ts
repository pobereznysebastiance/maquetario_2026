// Cableado del núcleo (lo que era studio.ts, grupo 5): publica los nombres que todavía leen por
// global los módulos de app, el lienzo, las pruebas y scripts/style-snapshot.js;
// registra como extensibles las funciones que otros extienden por nombre (toast: Toast.tsx;
// syncNative: react/editor-state-wiring.ts; commit: paragraphs.ts; inspector: inspector-registry,
// tutorial, review-workspace, inspector-views; applyBookSettings, saveProject, loadProject y
// preparePrint), y escucha las respuestas del anfitrión.
//
// Lo importa src/entries/core.ts antes que studio-wiring.ts (el arranque), que ya encuentra todo
// publicado y registrado. Cuando un nombre deja de leerse por global, se saca de acá.
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
import { applyBookSettingsBase, settings, type BookSettingsValues } from './book-settings.ts';
import {
  confirmChanges,
  download,
  loadProjectBase,
  openBook,
  saveProjectBase,
  type UnsavedIntent as Intent,
} from './project-file.ts';
import { clearPrint, preparePrintBase } from './print.ts';
import { renderTemplatesBase, thumbsBase } from './templates.ts';
import {
  autoElementBase,
  calculateScale,
  checkOverflowBase,
  paperBase,
  renderBase,
  renderPagesBase,
  screenPageBase,
  updateStatusBase,
  verticalSpread,
} from './canvas.ts';
import {
  chooseImage,
  finishEditingBase,
  moveObjectBase,
  objectDownBase,
  pageDownBase,
  startEditingBase,
  upObjectBase,
} from './editing.ts';
import { commandBase, setToolBase, setZoomBase, showTabBase, togglePreview } from './tools.ts';
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
  /** Formato del libro (src/core/book-settings.ts); applyBookSettings es extensible. */
  var settings: (isNew?: boolean) => Promise<void> | undefined;
  var applyBookSettings: (isNew: boolean, values: BookSettingsValues) => boolean;
  /** Para qué se pregunta por los cambios sin guardar (src/core/project-file.ts). */
  type UnsavedIntent = Intent;
  var confirmChanges: (proceed: () => unknown, intent?: UnsavedIntent) => void;
  /** Guardar (extensible). */
  var saveProject: () => Promise<boolean>;
  var download: (blob: Blob, name: string) => void;
  var openBook: () => void;
  /** Carga un proyecto (extensible). */
  var loadProject: (content: string) => void;
  /** Salida de lectura en #printRoot (src/core/print.ts); preparePrint es extensible. */
  var preparePrint: () => boolean;
  var clearPrint: () => void;
  /** Plantillas y miniaturas (src/core/templates.ts), extensibles. */
  var renderTemplates: () => void;
  var thumbs: () => void;
  /** El dibujo (src/core/canvas.ts); autoElement, paper, screenPage, renderPages, render,
   * updateStatus y checkOverflow son extensibles. */
  var verticalSpread: () => boolean;
  var calculateScale: () => void;
  var autoElement: typeof autoElementBase;
  var paper: (i: number, px: number, print?: boolean) => HTMLElement;
  var screenPage: (page: HTMLElement, i: number, px: number) => HTMLElement;
  var renderPages: () => void;
  var render: (full?: boolean) => void;
  var updateStatus: () => void;
  var checkOverflow: () => void;
  /** Edición y arrastre (src/core/editing.ts), extensibles salvo chooseImage. */
  var startEditing: (el: HTMLElement) => void;
  var finishEditing: () => void;
  var objectDown: typeof objectDownBase;
  var moveObject: (e: PointerEvent) => void;
  var upObject: (e: PointerEvent) => void;
  var pageDown: (e: PointerEvent, i: number, el: HTMLElement) => void;
  var chooseImage: (target: Record<string, unknown>) => void;
  /** Pestañas, herramientas, vista previa, zoom y comandos (src/core/tools.ts). */
  var showTab: (name: string) => void;
  var setTool: (name: string) => void;
  var togglePreview: () => void;
  var setZoom: (z: number) => void;
  var command: (name: string) => void;
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
globalThis.settings = settings;
globalThis.applyBookSettings = extensible('applyBookSettings', applyBookSettingsBase);
globalThis.confirmChanges = confirmChanges;
globalThis.saveProject = extensible('saveProject', saveProjectBase);
globalThis.download = download;
globalThis.openBook = openBook;
globalThis.loadProject = extensible('loadProject', loadProjectBase);
globalThis.preparePrint = extensible('preparePrint', preparePrintBase);
globalThis.clearPrint = clearPrint;
globalThis.renderTemplates = extensible('renderTemplates', renderTemplatesBase);
globalThis.thumbs = extensible('thumbs', thumbsBase);
globalThis.verticalSpread = verticalSpread;
globalThis.calculateScale = calculateScale;
globalThis.autoElement = extensible('autoElement', autoElementBase);
globalThis.paper = extensible('paper', paperBase);
globalThis.screenPage = extensible('screenPage', screenPageBase);
globalThis.renderPages = extensible('renderPages', renderPagesBase);
globalThis.render = extensible('render', renderBase);
globalThis.updateStatus = extensible('updateStatus', updateStatusBase);
globalThis.checkOverflow = extensible('checkOverflow', checkOverflowBase);
globalThis.startEditing = extensible('startEditing', startEditingBase);
globalThis.finishEditing = extensible('finishEditing', finishEditingBase);
globalThis.objectDown = extensible('objectDown', objectDownBase);
globalThis.moveObject = extensible('moveObject', moveObjectBase);
globalThis.upObject = extensible('upObject', upObjectBase);
globalThis.pageDown = extensible('pageDown', pageDownBase);
globalThis.chooseImage = chooseImage;
globalThis.showTab = extensible('showTab', showTabBase);
globalThis.setTool = extensible('setTool', setToolBase);
globalThis.togglePreview = togglePreview;
globalThis.setZoom = extensible('setZoom', setZoomBase);
globalThis.command = extensible('command', commandBase);

MaquetarioHost.onMessage(nativeReply);
