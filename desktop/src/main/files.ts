import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const MAX_PROJECT_BYTES = 80_000_000;

/** Escritura atómica: archivo temporal y reemplazo, para no dejar un .mqt a medias. */
export async function writeAtomic(target: string, content: string | Buffer): Promise<void> {
  const temp = `${target}.${randomUUID().replaceAll('-', '')}.tmp`;
  try {
    await writeFile(temp, content);
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeAtomic(path, JSON.stringify(value));
}

export async function readProject(path: string): Promise<string> {
  const info = await stat(path);
  if (info.size > MAX_PROJECT_BYTES) throw new Error('El proyecto supera 80 MB.');
  return readFile(path, 'utf8');
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Reemplaza caracteres no válidos en nombres de archivo (Windows es el más estricto). */
export function cleanName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
}
