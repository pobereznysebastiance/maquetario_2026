// Migraciones del formato de proyecto (.mqt).
//
// Cada proyecto guarda su `version`. Al abrirlo, migrateProject lo lleva paso a paso hasta
// CURRENT_VERSION y recién después se valida. Lo llama M.validate (model.ts) al empezar, así que
// vale para todos los caminos de carga: Abrir, recientes, doble clic, paquete y copia de
// recuperación. El proceso principal (desktop/src/main/handlers/project.ts) usa
// checkProjectVersion antes de tomar el archivo como proyecto actual: un proyecto más nuevo que la
// app se rechaza sin que quede como destino de Guardar, así no se pisa.
//
// Cómo se agrega un cambio de formato:
// 1. Subir CURRENT_VERSION (por ejemplo, de 3 a 4).
// 2. Agregar al final de MIGRATIONS un paso { from: 3, to: 4, describe, migrate }. migrate recibe
//    una copia del proyecto en la versión `from` (se puede modificar en el lugar) y devuelve el
//    proyecto en la versión `to`, o nada si lo modificó en el lugar. No escribe `version`: lo hace
//    migrateProject.
// 3. migrate no valida: la validación corre después, sobre el resultado, con las reglas de la
//    versión actual. Tiene que ser pura (sin pantalla ni globales): también la usan el proceso
//    principal y las pruebas en Node (desktop/test/project-format.test.ts).
// 4. Sumar a esa prueba un proyecto real de la versión anterior.
// Un paso publicado no se borra ni se edita: un .mqt viejo puede aparecer años después.
//
// Fuente TypeScript: entra en build/core.js a través de model.ts.

/** Versión del formato que escribe esta versión de la app. */
export const CURRENT_VERSION = 3;

/** Un proyecto tal como viene del archivo: todavía sin validar. */
export type RawProject = Record<string, any>;

export interface Migration {
  from: number;
  to: number;
  /** Qué cambia, en castellano. */
  describe: string;
  migrate(project: RawProject): RawProject | undefined;
}

/** Pasos en orden. Hoy no hay ninguno: todos los proyectos son de la versión 3. */
export const MIGRATIONS: readonly Migration[] = [];

export const UNKNOWN_PROJECT_ERROR = 'Abrí un proyecto de Maquetario o LibroStudio 3.';
export const NEWER_PROJECT_ERROR =
  'Este proyecto se hizo con una versión más nueva de Maquetario: actualizá el programa para abrirlo.';

function versionOf(input: unknown): number | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const version = (input as RawProject).version;
  return Number.isInteger(version) && version >= 1 ? version : null;
}

/**
 * Los pasos que llevan el proyecto a la versión actual, sin tocarlo. Lanza un error para mostrar
 * si no es un proyecto, si es de una versión más nueva o si no hay camino desde su versión.
 */
export function migrationPath(
  input: unknown,
  steps: readonly Migration[] = MIGRATIONS,
  current: number = CURRENT_VERSION,
): Migration[] {
  const version = versionOf(input);
  if (version === null) throw Error(UNKNOWN_PROJECT_ERROR);
  if (version > current) throw Error(NEWER_PROJECT_ERROR);
  const path: Migration[] = [];
  for (let from = version; from < current;) {
    const step = steps.find((s) => s.from === from);
    if (!step || step.to <= step.from || step.to > current) throw Error(UNKNOWN_PROJECT_ERROR);
    path.push(step);
    from = step.to;
  }
  return path;
}

/** Comprueba que el proyecto se pueda abrir con esta versión de la app (sin migrarlo). */
export function checkProjectVersion(input: unknown): void {
  migrationPath(input);
}

/**
 * Lleva el proyecto a la versión actual. Si ya está en la versión actual devuelve el mismo objeto
 * (validate lo copia después); si hay pasos, trabaja sobre una copia: el original no cambia.
 */
export function migrateProject(
  input: unknown,
  steps: readonly Migration[] = MIGRATIONS,
  current: number = CURRENT_VERSION,
): RawProject {
  const path = migrationPath(input, steps, current);
  if (!path.length) return input as RawProject;
  let project: RawProject = JSON.parse(JSON.stringify(input));
  for (const step of path) {
    project = step.migrate(project) ?? project;
    if (!project || typeof project !== 'object')
      throw Error(`El paso de la versión ${step.from} a la ${step.to} no devolvió un proyecto.`);
    project.version = step.to;
  }
  return project;
}
