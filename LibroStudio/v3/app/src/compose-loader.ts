// Motor de composición (etapa 4, en desarrollo): llave para cargarlo y dibujar con él.
//
//   localStorage.setItem('maquetario-compose', '1')    y recargar (Ctrl+R)
//   await composeReport()                              paridad con los cortes de Chromium
//   await composeReady()                               fuentes cargadas (antes de un PDF)
//   composeAlgorithm('greedy' | 'knuth-plass')         ajuste de desarrollo (por defecto K-P)
//   composeActivate()                                  prende el dibujo sólo por esta sesión
//
// Con la llave prendida, los párrafos que el motor puede componer (cara del catálogo resuelta)
// se dibujan con sus líneas: extend.result('paper', …) → composePage en src/modules/compose.ts.
// Al editar un cuadro, ese cuadro vuelve al texto de siempre (CSS) y al terminar se recompone.
//
// Con la llave apagada (lo normal) no se carga ni se instala nada: ni build/compose.mjs ni
// HarfBuzz (WASM), ni extensiones de paper o startEditing. Sólo existen estas funciones, que
// explican cómo prenderla. El módulo es aparte (ES, con import dinámico) porque usa await de
// nivel superior y WASM; la CSP le permite sólo eso: compilar WASM y leer build/harfbuzz.wasm y
// /__fonts/ (desktop/src/main/protocol.ts). Plan: docs/MOTOR_09-nov_composicion.md.
//
// Fuente TypeScript: entra en build/app.js (src/entries/app.ts).
import type {
  ComposeAlgorithm,
  ComposeDrawOptions,
  ComposeReport,
  ComposeReportOptions,
} from './modules/compose.ts';

type ComposeModule = typeof import('./modules/compose.ts');

const KEY = 'maquetario-compose';

function composeEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let engine: Promise<ComposeModule> | null = null;
let loaded: ComposeModule | null = null;
let active = false;

function importEngine(): Promise<ComposeModule> {
  // Dirección armada en tiempo de ejecución: esbuild no lo mete en build/app.js.
  const url = new URL('build/compose.mjs', document.baseURI).href;
  engine ??= (import(url) as Promise<ComposeModule>).then((module) => (loaded = module));
  return engine;
}

function loadComposeEngine(): Promise<ComposeModule> {
  if (!composeEnabled() && !active)
    return Promise.reject(
      new Error(
        `El motor de composición está apagado: localStorage.setItem('${KEY}', '1') y recargá.`,
      ),
    );
  return importEngine();
}

/** Instala el dibujo con el motor (una vez) y carga el módulo y las fuentes del libro. */
function activate(options?: ComposeDrawOptions): Promise<void> {
  if (!active) {
    active = true;
    extend.result(
      'paper',
      function (page: HTMLElement, index: number, px: number) {
        // Hasta que llega el módulo, la página queda como siempre; al llegar se redibuja.
        return loaded ? loaded.composePage(page, index, px) : page;
      },
      'compose-loader',
    );
    extend.after(
      'startEditing',
      function (element: HTMLElement) {
        loaded?.restoreForEditing(element);
      },
      'compose-loader',
    );
  }
  return importEngine().then((module) => {
    if (options) module.configureDrawing(options);
    return module.composeReady();
  });
}

declare global {
  /** Herramienta de desarrollo: compara los cortes de línea del motor con los de Chromium. */
  var composeReport: (options?: ComposeReportOptions) => Promise<ComposeReport>;
  /** Fuentes del libro cargadas en el motor y página redibujada (esperar antes de un PDF). */
  var composeReady: () => Promise<void>;
  /** Ajuste de desarrollo: corte voraz o Knuth-Plass (queda guardado en este equipo). */
  var composeAlgorithm: (name: ComposeAlgorithm) => Promise<void>;
  /**
   * Prende el dibujo con el motor sólo por esta sesión, sin la llave guardada (la autoprueba con
   * --compose). `fonts`, como en composeReport, para el navegador sin catálogo.
   */
  var composeActivate: (options?: ComposeDrawOptions) => Promise<void>;
}
globalThis.composeReport = async (options) => (await loadComposeEngine()).composeReport(options);
globalThis.composeReady = async () => (await loadComposeEngine()).composeReady();
globalThis.composeAlgorithm = async (name) => (await loadComposeEngine()).setComposeAlgorithm(name);
globalThis.composeActivate = (options) => activate(options);

// Con la llave prendida, el motor se instala y se carga al arrancar.
if (composeEnabled())
  activate().catch((error: unknown) => console.warn('[motor de composición]', error));

export {};
