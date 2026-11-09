// Cableado de lo que salió de studio.ts (grupo 5): publica los nombres que todavía leen studio.ts
// (un script, no puede importar), los módulos de app, las pruebas y scripts/style-snapshot.js;
// registra como extensibles las funciones que otros extienden por nombre (toast: Toast.tsx;
// syncNative: react/editor-state-wiring.ts), y escucha las respuestas del anfitrión.
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

MaquetarioHost.onMessage(nativeReply);
