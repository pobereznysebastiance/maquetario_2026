import { dialog } from 'electron';
import { addFontFolder, findFace, fontCatalog } from '../fonts/catalog.ts';
import { faceBytes, unicodePoints } from '../fonts/opentype.ts';
import type { Session } from '../session.ts';

const FOLDER_TITLE: Record<string, string> = {
  en: 'Choose a folder containing TTF, OTF or TTC fonts',
  pt: 'Escolha uma pasta com fontes TTF, OTF ou TTC',
  es: 'Elegí una carpeta con fuentes TTF, OTF o TTC',
};

export async function chooseFontFolder(session: Session) {
  const picked = await dialog.showOpenDialog(session.win, {
    title: FOLDER_TITLE[session.language] ?? FOLDER_TITLE.es,
    properties: ['openDirectory'],
  });
  if (picked.canceled || !picked.filePaths[0]) return null;
  await addFontFolder(picked.filePaths[0]);
  return fontCatalog(true);
}

export async function fontGlyphs(fontId: string) {
  const face = findFace(fontId);
  if (!face) throw new Error('La fuente no está disponible en el catálogo.');
  const points = unicodePoints(await faceBytes(face));
  return { fontId, points, family: face.family, style: face.style };
}
