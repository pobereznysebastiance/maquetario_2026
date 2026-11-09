// Fuentes del equipo: catálogo nativo (lo lee el proceso principal), carga de cada cara con
// FontFace, elección de familia, estilo y ejes variables en el inspector, y aplicación de las
// caras en la página, los elementos automáticos y la salida. Las caras del paquete del proyecto
// (portableFontFaces) van antes que las del sistema.
//
// Casi todo es global porque lo usan los demás archivos: font-browser.js, paragraphs.js,
// font-glyphs.ts, project-package.ts, settings-panel.ts, editorial-rules.ts y las pruebas.
// ensureBookFonts y applyFace las extienden font-browser.js y paragraphs.js por nombre: las
// llamadas de acá que corren después de cargar pasan por globalThis para incluir esas
// extensiones. El estado que se lee o se reasigna desde afuera (portableFontFaces,
// fontCatalogPromise, fontLoadErrors) vive en globalThis; nativeFaces es un accesor sobre el
// catálogo (font-catalog.ts, que también tiene las funciones del catálogo sin efectos al cargar).
//
// Fuente TypeScript: se compila a build/fonts.js (desktop/scripts/build.mjs).

import type { BookObject } from './model.ts';
import {
  chooseDefaultFace,
  catalogFaces,
  setCatalogFaces,
  obtainFonts,
  selectedFace,
  updatePortableFontCatalog,
  variations,
} from './font-catalog.ts';

import type { FontRef } from './font-catalog.ts';

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

  /** Catálogo efectivo: caras del paquete del proyecto y después las del sistema. */
  var nativeFaces: NativeFontFace[];
  /** Ids de las caras que no se pudieron cargar. */
  var fontLoadErrors: Set<string>;
  /** Carga del catálogo de fuentes del sistema (null hasta que arranca). */
  var fontCatalogPromise: Promise<void> | null;
  /** Caras que trae el paquete del proyecto abierto (van antes que las del sistema). */
  var portableFontFaces: NativeFontFace[];
  /** Rearma nativeFaces y fontList con las caras del paquete y las del sistema. */
  var updatePortableFontCatalog: () => void;
  /** La cara más cercana a Regular (peso 400, no cursiva) de la familia. */
  var chooseDefaultFace: (family: string | undefined) => NativeFontFace | undefined;
  /** La cara guardada en o (id, estilo, instancia o peso) o, si no está, la de la familia. */
  var selectedFace: (o: FontRef) => NativeFontFace | undefined;
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
}

// nativeFaces vive en font-catalog.ts: el global es un accesor (lo leen otros módulos y las pruebas).
Object.defineProperty(globalThis, 'nativeFaces', {
  get: catalogFaces,
  set: setCatalogFaces,
  configurable: true,
  enumerable: true,
});
globalThis.fontLoadErrors = new Set();
const loadedFaces = new Map<string, Promise<FontFace>>();
globalThis.fontCatalogPromise = null;
globalThis.portableFontFaces = [];
globalThis.updatePortableFontCatalog = updatePortableFontCatalog;
globalThis.chooseDefaultFace = chooseDefaultFace;
// El motor de composición (src/modules/compose.ts) es otro bundle: lo lee del global.
globalThis.selectedFace = selectedFace;
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
async function startFontLibrary(): Promise<void> {
  for (let n = 0; n < 100 && !native; n++) await new Promise((r) => setTimeout(r, 100));
  if (native) await obtainFonts();
}
fontCatalogPromise = startFontLibrary();

export {};
