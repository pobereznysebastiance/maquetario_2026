// Catálogo de fuentes del sistema y de carpetas elegidas por la persona.
// Port de HostFonts.cs + la parte de fuentes de HostPackage.cs.
import { readdir, lstat, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { dataDir } from '../env.ts';
import { readJson, writeJson } from '../files.ts';
import { publicFace, readFaces, type FontFace, type FontRecord } from './opentype.ts';

const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc']);
export const PACKAGE_MANIFEST = 'maquetario-paquete.json';

let catalog: FontRecord[] = [];
let loaded = false;
let scanning: Promise<void> | null = null;
let folders: string[] = [];
let packageFaces: FontRecord[] = [];

const foldersFile = () => join(dataDir(), 'font-folders.json');

/** Carpetas de fuentes del sistema operativo. */
function systemFolders(): { path: string; recursive: boolean }[] {
  if (process.platform === 'win32') {
    const windir = process.env.WINDIR ?? 'C:\\Windows';
    const local = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
    return [
      { path: join(windir, 'Fonts'), recursive: false },
      { path: join(local, 'Microsoft', 'Windows', 'Fonts'), recursive: false },
    ];
  }
  if (process.platform === 'darwin') {
    return [
      { path: '/System/Library/Fonts', recursive: true },
      { path: '/Library/Fonts', recursive: true },
      { path: join(homedir(), 'Library', 'Fonts'), recursive: true },
    ];
  }
  return [
    { path: '/usr/share/fonts', recursive: true },
    { path: '/usr/local/share/fonts', recursive: true },
    { path: join(homedir(), '.local', 'share', 'fonts'), recursive: true },
    { path: join(homedir(), '.fonts'), recursive: true },
  ];
}

async function walk(folder: string, recursive: boolean, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(folder, entry.name);
    if (entry.isFile() && FONT_EXTENSIONS.has(extname(entry.name).toLowerCase())) out.push(full);
    else if (recursive && entry.isDirectory()) {
      try {
        if (!(await lstat(full)).isSymbolicLink()) await walk(full, true, out);
      } catch {
        // Carpeta sin permiso: se omite.
      }
    }
  }
}

async function scan(): Promise<void> {
  folders = await readJson<string[]>(foldersFile(), []);
  const paths = new Map<string, string>();
  const add = (list: string[]) =>
    list.forEach((p) => paths.has(p.toLowerCase()) || paths.set(p.toLowerCase(), p));
  for (const { path, recursive } of systemFolders()) {
    const found: string[] = [];
    await walk(path, recursive, found);
    add(found);
  }
  for (const folder of folders) {
    const found: string[] = [];
    await walk(folder, true, found);
    add(found);
  }
  const all: FontRecord[] = [];
  // De a varios archivos a la vez: rápido sin abrir cientos de archivos juntos.
  const queue = [...paths.values()];
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        try {
          all.push(...(await readFaces(path)));
        } catch {
          // Archivo ilegible: se omite.
        }
      }
    }),
  );
  const unique = new Map<string, FontRecord>();
  for (const face of all.sort((a, b) => a.path.localeCompare(b.path))) {
    const key = `${face.family}|${face.style}|${face.weight}|${face.italic}`;
    if (!unique.has(key)) unique.set(key, face);
  }
  catalog = [...unique.values()].sort(
    (a, b) =>
      a.family.localeCompare(b.family, undefined, { sensitivity: 'base' }) || a.weight - b.weight,
  );
  loaded = true;
}

/** Empieza a leer las fuentes en segundo plano (se llama al abrir la app). */
export function warmFontCatalog(): Promise<void> {
  scanning ??= scan().finally(() => (scanning = null));
  return scanning;
}

export interface CatalogReply {
  faces: FontFace[];
  folders: string[];
  files: number;
  variableFaces: number;
}

export async function fontCatalog(refresh: boolean): Promise<CatalogReply> {
  // Si ya hay una lectura en curso se espera esa; si no, se lee de nuevo.
  if (refresh || !loaded) await warmFontCatalog();
  return {
    faces: catalog.map(publicFace),
    folders: [...folders],
    files: new Set(catalog.map((f) => f.path)).size,
    variableFaces: catalog.filter((f) => f.axes.length > 0).length,
  };
}

export async function familyNames(): Promise<string[]> {
  await warmFontCatalog();
  return [...new Set(catalog.map((f) => f.family))];
}

export async function addFontFolder(folder: string): Promise<void> {
  folders = await readJson<string[]>(foldersFile(), []);
  if (!folders.some((f) => f.toLowerCase() === folder.toLowerCase())) folders.push(folder);
  await writeJson(foldersFile(), folders);
}

/** Todas las caras disponibles: primero las del paquete abierto, después las del sistema. */
export function availableFaces(): FontRecord[] {
  const seen = new Set<string>();
  return [...packageFaces, ...catalog].filter((f) => !seen.has(f.id) && seen.add(f.id));
}

export const findFace = (id: string): FontRecord | undefined =>
  availableFaces().find((f) => f.id === id);

export const getPackageFaces = (): FontFace[] => packageFaces.map(publicFace);
export const replacePackageFaces = (faces: FontRecord[]): FontRecord[] => {
  const previous = packageFaces;
  packageFaces = faces;
  return previous;
};

/** Si el proyecto está dentro de un paquete de Maquetario, carga sus fuentes. */
export async function setPackageFonts(project: string | null): Promise<void> {
  const faces: FontRecord[] = [];
  if (project) {
    try {
      const folder = dirname(project);
      const manifestPath = join(folder, PACKAGE_MANIFEST);
      if ((await stat(manifestPath)).size < 1_000_000) {
        const data = await readJson<{ project?: string; fonts?: string[] }>(manifestPath, {});
        if (data.project === basename(project) && Array.isArray(data.fonts)) {
          for (const file of data.fonts.slice(0, 500)) {
            if (!/^[0-9A-F]{24}\.(otf|ttf)$/.test(file)) continue;
            try {
              const path = join(folder, 'Fuentes', file);
              if ((await stat(path)).size > 40_000_000) continue;
              const [face] = await readFaces(path);
              if (face) faces.push({ ...face, id: basename(file, extname(file)) });
            } catch {
              // Fuente faltante en el paquete: se omite.
            }
          }
        }
      }
    } catch {
      // Sin manifiesto: no es un paquete.
    }
  }
  packageFaces = faces;
}
