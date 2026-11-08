// Rutas y banderas del entorno. Un solo lugar para saber dónde vive cada cosa.
import { app } from 'electron';
import { dirname, join, resolve } from 'node:path';

export const args = process.argv.slice(1);
export const isSelfTest = args.includes('--self-test');
/** Herramientas de desarrollo (F12, recargar). Sólo con --dev. */
export const isDev = args.includes('--dev');

export function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

/** Esquema propio con el que se sirve la interfaz: maquetario://app/index.html */
export const APP_SCHEME = 'maquetario';
export const APP_ORIGIN = `${APP_SCHEME}://app`;
/** Avisos de sistema (desktop/src/notice), servidos aparte de la interfaz. */
export const NOTICE_ORIGIN = `${APP_SCHEME}://notice`;
export const noticeDir = (): string => join(__dirname, 'notice');
export const FONT_ROUTE = '/__fonts/';

/**
 * Carpeta de la interfaz. En desarrollo, la fuente del repo; empaquetada, dentro de app.asar,
 * que está cubierto por la verificación de integridad (no se puede modificar sin que la app lo detecte).
 */
export const rendererDir = (): string =>
  app.isPackaged ? join(app.getAppPath(), 'renderer') : resolve(__dirname, '..', '..', 'LibroStudio', 'v3', 'app');

/** Datos de la app (recientes, carpetas de fuentes, aula). */
export const dataDir = (): string => app.getPath('userData');

/** Carpeta compartida con el launcher de Motiova. */
export const motiovaDir = (): string => join(app.getPath('appData'), 'Motiova');

/** Junto al ejecutable (donde el docente deja maquetario-aula.json). */
export const exeDir = (): string => dirname(app.getPath('exe'));

export const appVersion = (): string => app.getVersion();
export const APP_CREATOR = 'Sebastián Poberezny';
