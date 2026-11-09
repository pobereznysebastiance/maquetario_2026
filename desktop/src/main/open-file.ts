// Abrir un proyecto desde el sistema: doble clic en un .mqt, "Abrir con" o arrastrarlo al ícono.
// - Windows/Linux: la ruta llega en argv (al arrancar, o en el argv de la segunda instancia).
// - macOS: llega por el evento open-file (antes o después de ready).
// El proceso principal guarda la ruta y la interfaz la pide con la acción "openRequested", por el
// mismo camino que Abrir y los recientes: respeta la confirmación de cambios sin guardar.
// Sin Electron: se prueba con node --test (desktop/test/open-file.test.ts).
import { extname, resolve } from 'node:path';
import { mainExpression, mainExpressionIfLoaded } from './page.ts';

/** Extensiones de proyecto que se abren desde el sistema (las mismas que acepta Abrir, sin .json). */
export const PROJECT_EXTENSIONS = ['.mqt', '.maquetario', '.librostudio'];

/**
 * Ruta del proyecto que trae una línea de comandos, o null.
 * argv completo (process.argv o el de second-instance): se saltean el ejecutable, las opciones
 * (--algo, también las que agrega Chromium) y lo que no sea un proyecto. Si hay varias, la última.
 */
export function projectPathFromArgv(argv: readonly string[], cwd: string): string | null {
  let found: string | null = null;
  for (const arg of argv.slice(1)) {
    if (!arg || arg.startsWith('-')) continue;
    if (PROJECT_EXTENSIONS.includes(extname(arg).toLowerCase())) found = resolve(cwd, arg);
  }
  return found;
}

let pending: string | null = null;

/** Guarda el proyecto que pidió el sistema hasta que la interfaz lo abra. */
export function requestProject(path: string): void {
  pending = path;
}

export const hasRequestedProject = (): boolean => pending !== null;

/** Entrega la ruta pedida una sola vez (la acción "openRequested" no recibe rutas de la interfaz). */
export function takeRequestedProject(): string | null {
  const path = pending;
  pending = null;
  return path;
}

/**
 * Lo que corre la interfaz para abrir el proyecto pedido (maquetarioMain.openRequested): el mismo
 * recorrido que un reciente, con la confirmación de cambios sin guardar.
 */
export const OPEN_REQUESTED_SCRIPT = mainExpression('openRequested');

/** La interfaz ya puede abrir proyectos: respondió "ready" y cargó el puente de proyectos. */
export const RENDERER_READY = `${mainExpressionIfLoaded('ready')}===true`;
