// Abrir un proyecto desde el sistema: doble clic en un .mqt, "Abrir con" o arrastrarlo al ícono.
// - Windows/Linux: la ruta llega en argv (al arrancar, o en el argv de la segunda instancia).
// - macOS: llega por el evento open-file (antes o después de ready).
// El proceso principal guarda la ruta y la interfaz la pide con la acción "openRequested", por el
// mismo camino que Abrir y los recientes: respeta la confirmación de cambios sin guardar.
// Sin Electron: se prueba con node --test (desktop/test/open-file.test.ts).
import { extname, resolve } from 'node:path';

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
 * Lo que corre la interfaz para abrir el proyecto pedido. Es el mismo recorrido que un reciente
 * (src/components/welcome/welcome-service.tsx → openRecentProject): con cambios sin guardar pregunta antes (confirmChanges),
 * cierra la bienvenida y carga con loadOpenedProject, como Abrir (src/global/studio.ts → openBook).
 */
export const OPEN_REQUESTED_SCRIPT = `(() => {
  const run = async () => {
    try {
      const result = await nativeCall('openRequested', {});
      if (!result) return;
      globalThis.hideWelcome?.();
      loadOpenedProject(result);
    } catch (error) {
      toast(error.message, 'error');
    }
  };
  if (dirty) {
    globalThis.hideWelcome?.();
    confirmChanges(run);
  } else run();
})()`;

/** La interfaz ya puede abrir proyectos: respondió "ready" y cargó el puente de proyectos. */
export const RENDERER_READY =
  "typeof native!=='undefined'&&native===true&&typeof loadOpenedProject==='function'&&typeof confirmChanges==='function'";
