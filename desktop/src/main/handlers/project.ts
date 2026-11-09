// Proyectos: abrir, guardar, recientes y estado de la ventana.
// Port de Host.cs (save/open/dirty/close) y HostWelcome.cs (recientes).
import { dialog } from 'electron';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { APP_CREATOR, appVersion, dataDir, isSelfTest } from '../env.ts';
import {
  cleanName,
  exists,
  MAX_PROJECT_BYTES,
  readJson,
  readProject,
  writeAtomic,
  writeJson,
} from '../files.ts';
import { getPackageFaces, setPackageFonts } from '../fonts/catalog.ts';
import { licenseSummary } from '../license.ts';
import { takeRequestedProject } from '../open-file.ts';
import type { Session } from '../session.ts';
// Las reglas de versión del .mqt son las mismas que en la interfaz (una sola fuente).
import { checkProjectVersion } from '../../../../LibroStudio/v3/app/src/model-migrations.ts';

interface RecentProject {
  path: string;
  name: string;
  modified: string;
  pages: number;
  missing?: boolean;
}

const recentFile = () =>
  join(dataDir(), isSelfTest ? 'recent-selftest.json' : 'recent-projects.json');
const samePath = (a: string, b: string) =>
  process.platform === 'win32' || process.platform === 'darwin'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;

export const readRecents = () => readJson<RecentProject[]>(recentFile(), []);

export async function recordRecent(path: string, content: string): Promise<void> {
  try {
    const root = JSON.parse(content) as { title?: unknown; pages?: unknown };
    const full = resolve(path);
    const recent: RecentProject = {
      path: full,
      name: typeof root.title === 'string' ? root.title : basename(path, extname(path)),
      modified: new Date().toISOString(),
      pages: Array.isArray(root.pages) ? root.pages.length : 0,
    };
    const list = (await readRecents()).filter((r) => !samePath(r.path, full));
    await writeJson(recentFile(), [recent, ...list].slice(0, 12));
  } catch {
    // Los recientes son una comodidad: un error acá no debe impedir guardar.
  }
}

export async function appInfo() {
  const recents = await readRecents();
  for (const recent of recents) recent.missing = !(await exists(recent.path));
  return {
    version: appVersion(),
    creator: APP_CREATOR,
    recents,
    selftest: isSelfTest,
    license: licenseSummary(),
  };
}

const PROJECT_FILTERS = [
  { name: 'Proyectos Maquetario', extensions: ['mqt', 'maquetario', 'librostudio', 'json'] },
  { name: 'Proyecto Maquetario (*.mqt)', extensions: ['mqt'] },
];

/**
 * Antes de tomar el archivo como proyecto actual: si no es un proyecto o es de una versión más
 * nueva de Maquetario, se rechaza acá. Si llegara a la interfaz, quedaría como destino de Guardar y
 * se podría pisar con el libro que estaba abierto.
 */
function checkOpened(content: string): void {
  let root: unknown;
  try {
    root = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('El archivo no es un proyecto de Maquetario.');
  }
  checkProjectVersion(root);
}

async function loaded(session: Session, path: string, content: string) {
  checkOpened(content);
  session.projectPath = path;
  await setPackageFonts(path);
  await recordRecent(path, content);
  return { content, path, packageFaces: getPackageFaces() };
}

export async function openProject(session: Session) {
  const picked = await dialog.showOpenDialog(session.win, {
    properties: ['openFile'],
    filters: PROJECT_FILTERS,
  });
  if (picked.canceled || !picked.filePaths[0]) return null;
  const path = picked.filePaths[0];
  return loaded(session, path, await readProject(path));
}

/** El proyecto que pidió el sistema (doble clic en un .mqt): la ruta la guarda el proceso principal. */
export async function openRequested(session: Session) {
  const path = takeRequestedProject();
  if (!path) return null;
  if (!(await exists(path))) throw new Error('El archivo se movió o ya no está disponible.');
  return loaded(session, path, await readProject(path));
}

export async function openRecent(session: Session, path: string) {
  const record = (await readRecents()).find((r) => samePath(r.path, path));
  if (!record) throw new Error('El archivo no está en la lista de recientes.');
  if (!(await exists(record.path)))
    throw new Error('El archivo se movió o ya no está disponible. Usá Abrir para buscarlo.');
  return loaded(session, record.path, await readProject(record.path));
}

export async function saveProject(
  session: Session,
  content: string,
  name: string,
  saveAs: boolean,
): Promise<boolean> {
  if (content.length > MAX_PROJECT_BYTES) throw new Error('El proyecto supera 80 MB.');
  let target = session.projectPath;
  if (saveAs || !target || extname(target).toLowerCase() !== '.mqt') {
    const suggested =
      saveAs && target
        ? join(dirname(target), `${basename(target, extname(target))} - copia.mqt`)
        : target
          ? join(dirname(target), `${basename(target, extname(target))}.mqt`)
          : `${cleanName(name)}.mqt`;
    const picked = await dialog.showSaveDialog(session.win, {
      defaultPath: suggested,
      filters: [{ name: 'Proyecto Maquetario (*.mqt)', extensions: ['mqt'] }],
    });
    if (picked.canceled || !picked.filePath) return false;
    target = picked.filePath;
  }
  await writeAtomic(target, content);
  session.projectPath = target;
  await recordRecent(target, content);
  session.dirty = false;
  return true;
}

export async function newProject(session: Session) {
  session.projectPath = null;
  await setPackageFonts(null);
  return true;
}

export function setDirty(session: Session, payload: { dirty?: unknown; title?: unknown }) {
  session.dirty = Boolean(payload.dirty);
  session.win.setTitle(`${String(payload.title ?? '')}${session.dirty ? ' *' : ''} · Maquetario`);
  if (process.platform === 'darwin') session.win.setDocumentEdited(session.dirty);
  return true;
}
