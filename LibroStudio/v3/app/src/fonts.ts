// Fuentes del equipo: catálogo nativo (lo lee el proceso principal), carga de cada cara con
// FontFace, elección de familia, estilo y ejes variables en el inspector, y aplicación de las
// caras en la página, los elementos automáticos y la salida. Las caras del paquete del proyecto
// (portableFontFaces) van antes que las del sistema.
//
// Casi todo es global porque lo usan los demás archivos: font-browser.js, paragraphs.js,
// font-glyphs.ts, project-package.ts, settings-panel.ts, editorial-rules.ts y las pruebas.
// ensureBookFonts y applyFace las extienden font-browser.js y paragraphs.js por nombre: las
// llamadas de acá que corren después de cargar pasan por globalThis para incluir esas
// extensiones. El estado que se lee o se reasigna desde afuera (nativeFaces, portableFontFaces,
// fontFolders, fontCatalogPromise, fontLoadErrors, fontLibraryReady) vive en globalThis.
//
// Fuente TypeScript: se compila a build/fonts.js (desktop/scripts/build.mjs).

import type { BookObject } from './model.ts';

/** Lo que mira selectedFace: un objeto de texto, un formato de párrafo o un elemento automático. */
interface FontRef {
  font?: string;
  fontFaceId?: string;
  fontStyleName?: string;
  fontWeight?: number;
  fontItalic?: boolean;
  [extra: string]: any;
}

declare global {
  /** Instancia con nombre de una fuente variable (coordenadas de sus ejes). */
  interface NativeFontInstance {
    name: string;
    coordinates?: Record<string, number>;
  }

  /** Una cara de fuente del catálogo nativo. */
  interface NativeFontFace {
    id: string;
    family: string;
    style: string;
    weight: number;
    italic: boolean;
    axes: { tag: string; name?: string; normal: number; min: number; max: number }[];
    instances: NativeFontInstance[];
    [extra: string]: any;
  }

  /** Textos de la interfaz de fuentes en el idioma actual. */
  var fw: () => Record<string, string>;
  /** Se está leyendo el catálogo de fuentes del equipo. */
  var fontCatalogLoading: () => boolean;
  /** Catálogo efectivo: caras del paquete del proyecto y después las del sistema. */
  var nativeFaces: NativeFontFace[];
  /** Carpetas de fuentes agregadas por el usuario. */
  var fontFolders: string[];
  /** Ids de las caras que no se pudieron cargar. */
  var fontLoadErrors: Set<string>;
  /** Carga del catálogo de fuentes del sistema (null hasta que arranca). */
  var fontCatalogPromise: Promise<void> | null;
  /** Caras que trae el paquete del proyecto abierto (van antes que las del sistema). */
  var portableFontFaces: NativeFontFace[];
  /** El catálogo de fuentes ya terminó de cargar (o no hay app de escritorio). */
  var fontLibraryReady: boolean;
  /** Rearma nativeFaces y fontList con las caras del paquete y las del sistema. */
  var updatePortableFontCatalog: () => void;
  var familyFaces: (family: string | undefined) => NativeFontFace[];
  /** La cara más cercana a Regular (peso 400, no cursiva) de la familia. */
  var chooseDefaultFace: (family: string | undefined) => NativeFontFace | undefined;
  /** La cara guardada en o (id, estilo, instancia o peso) o, si no está, la de la familia. */
  var selectedFace: (o: FontRef) => NativeFontFace | undefined;
  /** Valores normales de los ejes variables de la cara. */
  var variations: (face: NativeFontFace) => Record<string, number>;
  /** Carga la cara con FontFace (una sola vez por id). */
  var ensureFace: (face: NativeFontFace | null | undefined) => Promise<FontFace | void>;
  /** Carga las caras que usa el libro. */
  var ensureBookFonts: () => Promise<void>;
  /** Aplica la cara (y la instancia, si hay) al objeto de texto. */
  var applyFace: (
    o: BookObject,
    face: NativeFontFace,
    instance?: NativeFontInstance | null,
  ) => Promise<void>;
  /** Pide el catálogo al proceso principal (fontCatalog, refreshFonts o chooseFontFolder). */
  var obtainFonts: (action?: string) => Promise<void>;
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
const fw = () => fontWords[globalThis.LibroI18n?.language || 'es'];
globalThis.fw = fw;
/** Se está leyendo el catálogo de fuentes del equipo (lo muestra la biblioteca de fuentes). */
globalThis.fontCatalogLoading = () => fontLoading;
globalThis.nativeFaces = [];
globalThis.fontFolders = [];
let fontLoading = true;
globalThis.fontLoadErrors = new Set();
const loadedFaces = new Map<string, Promise<FontFace>>();
globalThis.fontCatalogPromise = null;
let localFontFaces: NativeFontFace[] = nativeFaces;
globalThis.portableFontFaces = [];
function updatePortableFontCatalog(): void {
  const catalog = new Map(localFontFaces.map((face) => [face.id, face]));
  for (const face of portableFontFaces) catalog.delete(face.id);
  nativeFaces = [...portableFontFaces, ...catalog.values()];
  fontList = [...new Set(nativeFaces.map((face) => face.family))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!fontList.length) fontList = ['Georgia', 'Times New Roman', 'Arial'];
}
globalThis.updatePortableFontCatalog = updatePortableFontCatalog;
function familyFaces(family: string | undefined): NativeFontFace[] {
  return nativeFaces.filter((f) => f.family === family);
}
globalThis.familyFaces = familyFaces;
function chooseDefaultFace(family: string | undefined): NativeFontFace | undefined {
  return familyFaces(family)
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.weight - 400) +
        (a.italic ? 1000 : 0) -
        (Math.abs(b.weight - 400) + (b.italic ? 1000 : 0)),
    )[0];
}
globalThis.chooseDefaultFace = chooseDefaultFace;
function selectedFace(o: FontRef): NativeFontFace | undefined {
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
globalThis.selectedFace = selectedFace;
function variations(face: NativeFontFace): Record<string, number> {
  let values = face.axes.map((a) => [a.tag, a.normal]);
  return Object.fromEntries(values);
}
globalThis.variations = variations;
function ensureFace(face: NativeFontFace | null | undefined): Promise<FontFace | void> {
  if (!face) return Promise.resolve();
  if (loadedFaces.has(face.id)) return loadedFaces.get(face.id)!;
  const promise = (async () => {
    const axis = face.axes.find((a) => a.tag === 'wght'),
      font = new FontFace('MQT_' + face.id, `url("${MaquetarioHost.fontUrl(face.id)}")`, {
        weight: axis ? `${Math.max(1, axis.min)} ${Math.min(1000, axis.max)}` : String(face.weight),
        style: face.italic ? 'italic' : 'normal',
      });
    await font.load();
    document.fonts.add(font);
    fontLoadErrors.delete(face.id);
    return font;
  })().catch((error) => {
    fontLoadErrors.add(face.id);
    loadedFaces.delete(face.id);
    throw error;
  });
  loadedFaces.set(face.id, promise);
  return promise;
}
globalThis.ensureFace = ensureFace;
async function ensureBookFonts(): Promise<void> {
  const faces = new Map<string, NativeFontFace>();
  for (const p of book.pages)
    for (const o of p.objects)
      if (o.type === 'text') {
        const face = selectedFace(o);
        if (face) faces.set(face.id, face);
      }
  for (const type of ['header', 'titulillo', 'folio']) {
    const face = chooseDefaultFace(book[type].font);
    if (face) faces.set(face.id, face);
  }
  if (book.cover) {
    const face = chooseDefaultFace('Georgia');
    if (face) faces.set(face.id, face);
  }
  const promises = [...faces.values()].map((f) => ensureFace(f).catch(() => {}));
  await Promise.all(promises);
  await document.fonts.ready;
}
globalThis.ensureBookFonts = ensureBookFonts;
async function applyFace(
  o: BookObject,
  face: NativeFontFace,
  instance?: NativeFontInstance | null,
): Promise<void> {
  await ensureFace(face);
  commit(() => {
    o.font = face.family;
    o.fontFaceId = face.id;
    o.fontStyleName = instance?.name || face.style;
    o.fontAxes = instance ? { ...instance.coordinates } : variations(face);
    o.fontWeight = o.fontAxes.wght ?? face.weight;
    o.fontItalic = face.italic;
    o.bold = false;
    o.italic = false;
  }, false);
}
globalThis.applyFace = applyFace;
async function obtainFonts(action = 'fontCatalog'): Promise<void> {
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
globalThis.obtainFonts = obtainFonts;
extend.result(
  'paper',
  function (result: HTMLElement, i: number, px: number, print = false) {
    for (const o of book.pages[i].objects) {
      if (o.type !== 'text') continue;
      const el = result.querySelector<HTMLElement>(`[data-id="${o.id}"]`),
        face = selectedFace(o);
      if (!el) continue;
      if (face && !fontLoadErrors.has(face.id))
        el.style.fontFamily = `"MQT_${face.id}", "${o.font}"`;
      el.style.fontWeight = String(
        o.fontAxes?.wght ?? o.fontWeight ?? (o.bold ? 700 : face?.weight || 400),
      );
      el.style.fontStyle = o.fontItalic || o.italic ? 'italic' : 'normal';
      el.style.fontVariationSettings = Object.entries(o.fontAxes || {})
        .filter(([k, v]) => /^[\x20-\x7e]{4}$/.test(k) && Number.isFinite(v))
        .map(([k, v]) => `"${k}" ${v}`)
        .join(',');
    }
    return result;
  },
  'fonts',
);
extend.result(
  'autoElement',
  function (result: HTMLElement | null, i: number, type: string, px: number, print = false) {
    const face = chooseDefaultFace(book[type].font);
    if (result && face && !fontLoadErrors.has(face.id))
      result.style.fontFamily = `"MQT_${face.id}", "${book[type].font}"`;
    return result;
  },
  'fonts',
);
extend.result(
  'prepareOutput',
  function (result: unknown, config: unknown) {
    window.outputReady = false;
    window.fontOutputReady = false;
    Promise.all([
      globalThis.ensureBookFonts(),
      ...[...$('#printRoot').querySelectorAll('img')].map((im) => im.decode().catch(() => {})),
    ]).then(() => {
      window.outputReady = true;
      window.fontOutputReady = true;
    });
    return result;
  },
  'fonts',
);
extend.after(
  'loadProject',
  function (content: string) {
    globalThis.ensureBookFonts().then(() => renderPages());
  },
  'fonts',
);
globalThis.fontLibraryReady = false;
async function startFontLibrary(): Promise<void> {
  for (let n = 0; n < 100 && !native; n++) await new Promise((r) => setTimeout(r, 100));
  if (native) await obtainFonts();
  fontLibraryReady = true;
}
fontCatalogPromise = startFontLibrary();

export {};
