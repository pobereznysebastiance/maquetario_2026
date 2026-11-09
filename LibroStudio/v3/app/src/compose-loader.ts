// Motor de composición (etapa 4, en desarrollo): llave para cargarlo.
//
//   localStorage.setItem('maquetario-compose', '1')    y recargar (Ctrl+R)
//   await composeReport()                              paridad con los cortes de Chromium
//
// Con la llave apagada (lo normal) no se carga nada: ni build/compose.mjs ni HarfBuzz (WASM), y
// la página no pide ningún archivo más. composeReport existe igual y explica cómo prenderla.
// El módulo es aparte (ES, con import dinámico) porque usa await de nivel superior y WASM; la
// CSP le permite sólo eso: compilar WASM y leer build/harfbuzz.wasm y /__fonts/
// (desktop/src/main/protocol.ts). Plan: docs/MOTOR_09-nov_composicion.md.
//
// Fuente TypeScript: entra en build/app.js (src/entries/app.ts).
import type { ComposeReport, ComposeReportOptions } from './modules/compose.ts';

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
function loadComposeEngine(): Promise<ComposeModule> {
  if (!composeEnabled())
    return Promise.reject(
      new Error(
        `El motor de composición está apagado: localStorage.setItem('${KEY}', '1') y recargá.`,
      ),
    );
  // Dirección armada en tiempo de ejecución: esbuild no lo mete en build/app.js.
  const url = new URL('build/compose.mjs', document.baseURI).href;
  engine ??= import(url) as Promise<ComposeModule>;
  return engine;
}

declare global {
  /** Herramienta de desarrollo: compara los cortes de línea del motor con los de Chromium. */
  var composeReport: (options?: ComposeReportOptions) => Promise<ComposeReport>;
}
globalThis.composeReport = async (options) => (await loadComposeEngine()).composeReport(options);

// Con la llave prendida, el motor se carga al arrancar (así se ve enseguida si la CSP lo deja).
if (composeEnabled())
  loadComposeEngine().catch((error: unknown) => console.warn('[motor de composición]', error));

export {};
