// Catálogo de fuentes: las caras del sistema y del paquete del proyecto, la cara de cada texto,
// las carpetas agregadas, el pedido del catálogo al proceso principal y los textos de la
// interfaz de fuentes. No tiene efectos al cargar: se importa. Cargar las caras (FontFace), las
// extensiones del dibujo y el arranque de la biblioteca están en fonts.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { i18n } from './i18n/language.ts';

/** Lo que mira selectedFace: un objeto de texto, un formato de párrafo o un elemento automático. */
export interface FontRef {
  font?: string;
  fontFaceId?: string;
  fontStyleName?: string;
  fontWeight?: number;
  fontItalic?: boolean;
  [extra: string]: any;
}

const fontWords: Record<string, Record<string, string>> = {
  es: {
    library: 'Fuentes de tu equipo',
    folder: 'Agregar carpeta de fuentes',
    refresh: 'Volver a leer fuentes',
    weight: 'Peso / estilo',
    axes: 'Ejes variables',
    loading: 'Leyendo fuentes del equipo…',
    hint: 'Lee TTF, OTF y TTC de Windows y de tus carpetas. Las subcarpetas también se incluyen.',
    search: 'Buscar familia…',
    preview: 'Vista previa de la familia',
    empty: 'Seleccioná un cuadro de texto para elegir un peso o una variable.',
    missing: 'La fuente guardada no está disponible: agregá su carpeta o elegí otra familia.',
    fail: 'No se pudo cargar la fuente: ',
    saved:
      'Los proyectos guardan la familia, el estilo y los ejes. Para editarlos en otra PC, necesitás las mismas fuentes.',
    variable: 'Variable',
    families: 'familias',
    faces: 'estilos',
    face: 'estilo',
    folders: 'Carpetas adicionales',
    noFolders: 'Sin carpetas adicionales.',
    manage: 'Administrar carpetas',
  },
  en: {
    library: 'Fonts on your computer',
    folder: 'Add font folder',
    refresh: 'Rescan fonts',
    weight: 'Weight / style',
    axes: 'Variable axes',
    loading: 'Reading fonts on your computer…',
    hint: 'Reads Windows TTF, OTF and TTC fonts and your folders, including subfolders.',
    search: 'Search families…',
    preview: 'Family preview',
    empty: 'Select a text frame to choose a weight or variation.',
    missing: 'The saved font is unavailable: add its folder or choose another family.',
    fail: 'Could not load font: ',
    saved:
      'Projects save the family, style and axes. To edit on another PC, you need the same fonts.',
    variable: 'Variable',
    families: 'families',
    faces: 'styles',
    face: 'style',
    folders: 'Additional folders',
    noFolders: 'No additional folders.',
    manage: 'Manage folders',
  },
  pt: {
    library: 'Fontes do seu computador',
    folder: 'Adicionar pasta de fontes',
    refresh: 'Reler fontes',
    weight: 'Peso / estilo',
    axes: 'Eixos variáveis',
    loading: 'Lendo fontes do computador…',
    hint: 'Lê fontes TTF, OTF e TTC do Windows e das suas pastas, incluindo subpastas.',
    search: 'Buscar família…',
    preview: 'Prévia da família',
    empty: 'Selecione uma caixa de texto para escolher um peso ou variação.',
    missing: 'A fonte salva não está disponível: adicione sua pasta ou escolha outra família.',
    fail: 'Não foi possível carregar a fonte: ',
    saved:
      'Os projetos salvam a família, o estilo e os eixos. Para editar em outro PC, você precisa das mesmas fontes.',
    variable: 'Variável',
    families: 'famílias',
    faces: 'estilos',
    face: 'estilo',
    folders: 'Pastas adicionais',
    noFolders: 'Nenhuma pasta adicional.',
    manage: 'Gerenciar pastas',
  },
};
/** Textos de la interfaz de fuentes en el idioma actual. */
export const fw = (): Record<string, string> => fontWords[i18n.language || 'es'];

/**
 * Catálogo efectivo: caras del paquete del proyecto y después las del sistema. Vive acá; el
 * global nativeFaces es un accesor sobre esta variable (lo publica fonts.ts).
 */
let nativeFaces: NativeFontFace[] = [];
/** El catálogo efectivo (para el accesor global nativeFaces). */
export const catalogFaces = (): NativeFontFace[] => nativeFaces;
/** Reemplaza el catálogo efectivo (asignar el global nativeFaces, por ejemplo desde las pruebas). */
export function setCatalogFaces(faces: NativeFontFace[]): void {
  nativeFaces = faces;
}
/** Caras del sistema (sin las del paquete del proyecto). */
let localFontFaces: NativeFontFace[] = nativeFaces;
/** Carpetas de fuentes agregadas por el usuario. */
export let fontFolders: string[] = [];
let fontLoading = true;
/** Se está leyendo el catálogo de fuentes del equipo (lo muestra la biblioteca de fuentes). */
export const fontCatalogLoading = (): boolean => fontLoading;
/** Rearma nativeFaces y fontList con las caras del paquete y las del sistema. */
export function updatePortableFontCatalog(): void {
  const catalog = new Map(localFontFaces.map((face) => [face.id, face]));
  for (const face of portableFontFaces) catalog.delete(face.id);
  nativeFaces = [...portableFontFaces, ...catalog.values()];
  fontList = [...new Set(nativeFaces.map((face) => face.family))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!fontList.length) fontList = ['Georgia', 'Times New Roman', 'Arial'];
}
/** Las caras de una familia en el catálogo. */
export function familyFaces(family: string | undefined): NativeFontFace[] {
  return nativeFaces.filter((f) => f.family === family);
}
/** La cara más cercana a Regular (peso 400, no cursiva) de la familia. */
export function chooseDefaultFace(family: string | undefined): NativeFontFace | undefined {
  return familyFaces(family)
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.weight - 400) +
        (a.italic ? 1000 : 0) -
        (Math.abs(b.weight - 400) + (b.italic ? 1000 : 0)),
    )[0];
}
/** La cara guardada en o (id, estilo, instancia o peso) o, si no está, la de la familia. */
export function selectedFace(o: FontRef): NativeFontFace | undefined {
  const family = familyFaces(o.font),
    savedStyle = o.fontStyleName;
  return (
    family.find((f) => f.id === o.fontFaceId) ||
    family.find((f) => savedStyle && f.style === savedStyle) ||
    family.find((f) => savedStyle && f.instances.some((i) => i.name === savedStyle)) ||
    family.find((f) => o.fontWeight && f.weight === o.fontWeight && f.italic === !!o.fontItalic) ||
    chooseDefaultFace(o.font)
  );
}
/** Valores normales de los ejes variables de la cara. */
export function variations(face: NativeFontFace): Record<string, number> {
  let values = face.axes.map((a) => [a.tag, a.normal]);
  return Object.fromEntries(values);
}
/** Pide el catálogo al proceso principal (fontCatalog, refreshFonts o chooseFontFolder). */
export async function obtainFonts(action = 'fontCatalog'): Promise<void> {
  if (!native) {
    fontLoading = false;
    return;
  }
  fontLoading = true;
  inspector();
  try {
    const result = await nativeCall(action, { refresh: action === 'refreshFonts' });
    if (!result) return;
    localFontFaces = result.faces || [];
    updatePortableFontCatalog();
    fontFolders = result.folders || [];
    fontList = [...new Set(nativeFaces.map((f) => f.family))].sort((a, b) => a.localeCompare(b));
    if (!fontList.length) fontList = ['Georgia', 'Times New Roman', 'Arial'];
    await globalThis.ensureBookFonts();
    renderPages();
  } catch (error) {
    toast(fw().fail + (error as Error).message, 'error');
  } finally {
    fontLoading = false;
    inspector();
  }
}
/** Familia de la cubierta para CSS: Georgia del catálogo (MQT_…) si está, si no la del sistema. */
export function coverFontFamily(): string {
  const face = chooseDefaultFace('Georgia');
  return face ? '"MQT_' + face.id + '",Georgia,serif' : 'Georgia,serif';
}
