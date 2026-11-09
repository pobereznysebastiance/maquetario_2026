// "Empaquetar proyecto": carpeta con el .mqt, imágenes, fuentes y PDF.
import { dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { appVersion } from '../env.ts';
import { cleanName, exists, MAX_PROJECT_BYTES } from '../files.ts';
import { availableFaces, PACKAGE_MANIFEST } from '../fonts/catalog.ts';
import { canPackage, faceBytes, isOpenTypeCff } from '../fonts/opentype.ts';
import { exclusive, type Session } from '../session.ts';
import { callMain } from '../page.ts';
import { exactPdf, prepareOutput, printTrim } from './output.ts';

const IMAGE_TYPES: Record<string, string> = {
  'data:image/png;base64': '.png',
  'data:image/jpeg;base64': '.jpg',
  'data:image/webp;base64': '.webp',
  'data:image/svg+xml;base64': '.svg',
};

function collectImages(value: unknown, images: Set<string>): void {
  if (Array.isArray(value)) value.forEach((item) => collectImages(item, images));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (
        (key === 'src' || key === 'image') &&
        typeof item === 'string' &&
        item.startsWith('data:image/')
      )
        images.add(item);
      else collectImages(item, images);
    }
  }
}

export interface PackageRequest {
  project?: unknown;
  copyFonts?: unknown;
  fonts?: unknown;
}

async function writePackagePdf(session: Session, file: string, options: unknown) {
  const page = await prepareOutput(session, options);
  const trim = await printTrim(session, options, page.scale);
  await writeFile(file, await exactPdf(session, page, trim));
}

export async function createProjectPackage(
  session: Session,
  parent: string,
  payload: PackageRequest,
) {
  const content = String(payload.project ?? '');
  if (content.length > MAX_PROJECT_BYTES) throw new Error('El proyecto supera 80 MB.');
  const project = JSON.parse(content) as Record<string, unknown>;
  let name = cleanName(String(project.title ?? 'Proyecto'))
    .trim()
    .replace(/\.+$/, '');
  if (name.length > 72) name = name.slice(0, 72).replace(/\.+$/, '');
  const filename = `Maquetario - ${name}`;
  const stage = join(parent, `.maquetario-${randomUUID().replaceAll('-', '')}`);
  let final = join(parent, filename);
  for (let n = 2; await exists(final); n++) final = join(parent, `${filename} (${n})`);

  const fontNames: string[] = [];
  const omitted: string[] = [];
  let imageCount = 0;
  const hasCover = project.cover != null;
  const copyFonts = Boolean(payload.copyFonts);
  const faces = new Map(availableFaces().map((f) => [f.id, f]));
  const wanted = Object.entries((payload.fonts ?? {}) as Record<string, string>).slice(0, 500);
  const projectFile = `${filename}.mqt`;

  await mkdir(stage, { recursive: true });
  try {
    await writeFile(join(stage, projectFile), content, 'utf8');
    const pictures = join(stage, 'Imágenes');
    const fontFolder = join(stage, 'Fuentes');
    await mkdir(pictures);
    await mkdir(fontFolder);
    const images = new Set<string>();
    collectImages(project, images);
    for (const image of images) {
      const separator = image.indexOf(',');
      const extension = separator < 0 ? undefined : IMAGE_TYPES[image.slice(0, separator)];
      if (!extension) continue;
      imageCount++;
      await writeFile(
        join(pictures, `Imagen-${String(imageCount).padStart(3, '0')}${extension}`),
        Buffer.from(image.slice(separator + 1), 'base64'),
      );
    }
    for (const [id, label] of wanted) {
      const face = faces.get(id);
      if (!copyFonts || !face) {
        omitted.push(label);
        continue;
      }
      try {
        const bytes = await faceBytes(face);
        if (bytes.length > 40_000_000 || !canPackage(bytes)) {
          omitted.push(label);
          continue;
        }
        const file = `${face.id}${isOpenTypeCff(bytes) ? '.otf' : '.ttf'}`;
        await writeFile(join(fontFolder, file), bytes);
        fontNames.push(file);
      } catch {
        omitted.push(label);
      }
    }
    await writePackagePdf(session, join(stage, 'Interior.pdf'), {
      mode: 'reading',
      paper: 'book',
      fit: false,
      headers: true,
      folios: true,
    });
    if (hasCover)
      await writePackagePdf(session, join(stage, 'Cubierta.pdf'), {
        kind: 'cover',
        paper: 'actual',
        crop: true,
        fit: false,
      });
    await writeFile(
      join(stage, PACKAGE_MANIFEST),
      JSON.stringify({ project: projectFile, fonts: fontNames }),
      'utf8',
    );
    const missing = [...new Set(omitted)];
    await writeFile(
      join(stage, 'LEEME.txt'),
      [
        'Maquetario',
        `Abrí ${projectFile} con Maquetario ${appVersion()} o posterior. Llevá esta carpeta completa.`,
        'Las imágenes del proyecto están incorporadas en el .mqt. La carpeta Imágenes guarda copias reutilizables.',
        'Las fuentes incluidas se cargan al abrir el .mqt de esta carpeta.',
        `Fuentes sin copia en el paquete: ${missing.length === 0 ? 'ninguna' : missing.join(', ')}.`,
        '',
      ].join('\r\n'),
      'utf8',
    );
    await rename(stage, final);
  } finally {
    await callMain(session, 'clearPrint').catch(() => undefined);
    // Sólo se borra la carpeta temporal que creó esta operación.
    if (dirname(resolve(stage)) === resolve(parent))
      await rm(stage, { recursive: true, force: true });
  }
  return {
    path: final,
    images: imageCount,
    fonts: fontNames.length,
    omitted: [...new Set(omitted)],
    cover: hasCover,
  };
}

export function packageProject(session: Session, payload: PackageRequest) {
  return exclusive(session, 'Hay otra salida en curso.', async () => {
    const picked = await dialog.showOpenDialog(session.win, {
      title: 'Elegí dónde crear la carpeta del paquete de Maquetario',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (picked.canceled || !picked.filePaths[0]) return null;
    return createProjectPackage(session, resolve(picked.filePaths[0]), payload);
  });
}
