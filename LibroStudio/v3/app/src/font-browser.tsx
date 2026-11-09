// Explorador visual de tipografías: reemplaza los selectores de fuente del inspector y de los
// diálogos por un botón que abre una Ventana de trabajo (React, openWorkWindow) con la lista de
// familias (con muestra de cada una, dibujada sólo en las filas visibles), los estilos e
// instancias de la familia elegida y una muestra grande editable. Aplicar es lo único que cambia
// el documento.
// También pinta cornisas, titulillos y folios con la cara elegida y la carga antes de imprimir.
//
// Son globales:
// - fontBrowser: abierto o no y cerrar ({ open, close() }). Lo usan font-glyphs, focus-layout y
//   las pruebas. El <dialog> mantiene el id #fontBrowser (lo cierra la autoprueba).
// - fontBrowserFamily, fontBrowserVariant y fontBrowserMatches: estado que vive en globalThis
//   porque tests/font-browser-tests.js lo lee y lo cambia.
// - browserCurrentVariant (font-glyphs), openFontBrowser, filterFontBrowser y applyFontBrowser
//   (pruebas, review-workspace y las capturas de estilo).
// - decorateFontBrowsers: page-priority.ts la extiende, así que acá se llama por su nombre global
//   (no por uno local) para pasar por esa extensión, como antes.
//
// Los textos van con bw() y fw() (el traductor del DOM no entra en lo que dibuja React).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useEffect, useLayoutEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useLanguage } from './react/mount.tsx';
import { bw } from './i18n/language.ts';
import { openWorkWindow } from './components/dialog/dialogs.tsx';
import { editor } from './core-api.ts';

/** Cara tipográfica del catálogo y sus instancias: los tipos son los de fonts.ts (NativeFontFace). */
export type UIFontInstance = NativeFontInstance;
export type UIFontFace = NativeFontFace;

/** Una opción de estilo del explorador: una cara, o una instancia de una cara variable. */
export interface BrowserVariant {
  key: string;
  label: string;
  face: UIFontFace;
  instance: UIFontInstance | null;
}

/** Lo que el resto de la app necesita del explorador. */
export interface FontBrowserHandle {
  readonly open: boolean;
  close(): void;
}

declare global {
  /** Explorador de tipografías: si está abierto y cómo cerrarlo. */
  var fontBrowser: FontBrowserHandle;
  /** Familia elegida en el explorador. */
  var fontBrowserFamily: string;
  /** Clave del estilo elegido (id de la cara, o id@n para una instancia). */
  var fontBrowserVariant: string;
  /** Familias que coinciden con la búsqueda. */
  var fontBrowserMatches: string[];
  /** Estilo elegido en el explorador (o el estilo por defecto de la familia). */
  var browserCurrentVariant: () => BrowserVariant | undefined;
  /** Aplica la búsqueda del explorador a la lista de familias. */
  var filterFontBrowser: () => void;
  /** Abre el explorador para un selector de fuente. */
  var openFontBrowser: (select: HTMLSelectElement) => void;
  /** Aplica la tipografía elegida al selector de origen y cierra (false si no pudo). */
  var applyFontBrowser: () => Promise<boolean>;
  /** Cambia los selectores de fuente de root por el botón que abre el explorador. */
  var decorateFontBrowsers: (root?: ParentNode) => void;
}

const ROW_HEIGHT = 68;
const DEFAULT_SAMPLE = 'Aa Bb Gg · Maquetario 0123456789';

let fontBrowserTarget: HTMLSelectElement | null = null;
/** Desplazamiento y alto de la lista: deciden qué filas se dibujan. */
let listScroll = 0;
let listHeight = 0;
/** Texto de la muestra grande (se conserva entre aperturas, como el textarea de antes). */
let sampleText = DEFAULT_SAMPLE;
/** Error al aplicar o al cargar la cara elegida (si no, la ayuda de siempre). */
let notice = '';
/** Caras de la lista que no se pudieron cargar. */
const failedPreviews = new Set<string>();
let applying = false;
globalThis.fontBrowserFamily = '';
globalThis.fontBrowserVariant = '';
globalThis.fontBrowserMatches = [];

// Versión del estado: cada cambio redibuja el explorador en el acto (las pruebas leen el DOM).
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function refresh(): void {
  version += 1;
  if (listeners.size) flushSync(() => listeners.forEach((listener) => listener()));
}

const dialogElement = () => document.getElementById('fontBrowser') as HTMLDialogElement | null;
const fontBrowser: FontBrowserHandle = {
  get open() {
    return !!dialogElement()?.open;
  },
  close() {
    const dialog = dialogElement();
    if (dialog?.open) dialog.close();
  },
};
globalThis.fontBrowser = fontBrowser;

function browserVariants(family: string): BrowserVariant[] {
  return familyFaces(family).flatMap((f) => [
    { key: f.id, label: f.style, face: f, instance: null },
    ...f.instances.map((i, n) => ({ key: f.id + '@' + n, label: i.name, face: f, instance: i })),
  ]);
}
function browserCurrentVariant(): BrowserVariant | undefined {
  const variants = browserVariants(fontBrowserFamily);
  return (
    variants.find((v) => v.key === fontBrowserVariant) ||
    variants.find((v) => v.face.id === chooseDefaultFace(fontBrowserFamily)?.id) ||
    variants[0]
  );
}
globalThis.browserCurrentVariant = browserCurrentVariant;
/** Si el estilo elegido no es de la familia, pasa al estilo por defecto. */
function syncVariant(): void {
  const variants = browserVariants(fontBrowserFamily);
  if (!variants.some((v) => v.key === fontBrowserVariant))
    fontBrowserVariant =
      variants.find((v) => v.face.id === chooseDefaultFace(fontBrowserFamily)?.id)?.key ||
      variants[0]?.key ||
      '';
}

function filterFontBrowser(): void {
  const search = (document.getElementById('fontBrowserSearch') as HTMLInputElement | null)?.value;
  fontBrowserMatches = editor.fontList.filter((f) =>
    foldEditorial(f).includes(foldEditorial(search || '')),
  );
  listScroll = 0;
  const list = document.getElementById('fontBrowserList');
  if (list) list.scrollTop = 0;
  refresh();
}
globalThis.filterFontBrowser = filterFontBrowser;

/** Una familia de la lista, con su muestra en la cara por defecto. */
const FamilyRow = ({ family, top }: { family: string; top: number }) => {
  const face = chooseDefaultFace(family),
    count = familyFaces(family).length,
    active = family === fontBrowserFamily;
  return (
    <button
      type="button"
      className={`font-browser-row ${active ? 'active' : ''}`}
      style={{ top }}
      data-browser-family={family}
      role="option"
      aria-selected={active}
      onClick={() => {
        fontBrowserFamily = family;
        fontBrowserVariant = '';
        notice = '';
        syncVariant();
        refresh();
      }}
    >
      <span className="font-browser-name">
        {family}
        <small>
          {count || 1} {(count || 1) === 1 ? fw().face : fw().faces}
        </small>
      </span>
      <span
        className="font-browser-row-sample user-content"
        data-preview-face={face?.id}
        style={{ fontFamily: face ? `"MQT_${face.id}"` : `'${family}'` }}
      >
        {face && failedPreviews.has(face.id)
          ? bw('Sin vista previa', 'Preview unavailable', 'Sem prévia')
          : 'Aa Bb Gg'}
      </span>
    </button>
  );
};

/** Contenido de la Ventana: búsqueda y lista a la izquierda, estilo y muestra a la derecha. */
const FontBrowser = ({ hosted }: { hosted: boolean }) => {
  useLanguage();
  useSyncExternalStore(subscribe, () => version);
  const list = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const [, remeasure] = useReducer((n: number) => n + 1, 0);

  // Al abrir: la familia elegida a la vista (con el alto real de la lista) y el foco en la búsqueda.
  useLayoutEffect(() => {
    const apply = () => {
      if (!list.current) return;
      list.current.scrollTop = listScroll;
      listHeight = list.current.clientHeight;
      remeasure();
    };
    // Este efecto corre antes de que la ref del <dialog> lo abra (los hijos van primero): con el
    // diálogo cerrado la lista no tiene alto y el desplazamiento se ignora. En ese caso, en el
    // cuadro siguiente, que igual llega antes de pintar.
    if (list.current?.clientHeight) apply();
    else requestAnimationFrame(apply);
  }, []);
  useEffect(() => {
    search.current?.focus();
  }, []);

  const first = Math.max(0, Math.floor(listScroll / ROW_HEIGHT) - 2),
    last = Math.min(
      fontBrowserMatches.length,
      first + Math.ceil((listHeight || 420) / ROW_HEIGHT) + 5,
    ),
    visible = fontBrowserMatches.slice(first, last);

  // Carga las caras de las filas visibles (de a tres a la vez); si una falla, lo dice su fila.
  const visibleKey = visible.join('\n');
  useEffect(() => {
    let cancelled = false;
    const faces = visible
      .map((family) => chooseDefaultFace(family))
      .filter((face): face is UIFontFace => !!face);
    let cursor = 0;
    const loadVisible = async (): Promise<void> => {
      while (!cancelled && cursor < faces.length) {
        const face = faces[cursor++];
        try {
          await ensureFace(face);
        } catch {
          if (!cancelled && !failedPreviews.has(face.id)) {
            failedPreviews.add(face.id);
            refresh();
          }
        }
      }
    };
    for (let i = 0; i < 3; i++) void loadVisible();
    return () => {
      cancelled = true;
    };
    // visibleKey resume las familias visibles.
  }, [visibleKey]);

  const variants = browserVariants(fontBrowserFamily),
    variant = browserCurrentVariant(),
    selectedKey = variants.some((v) => v.key === fontBrowserVariant)
      ? fontBrowserVariant
      : variant?.key || '';

  // La muestra grande usa el archivo real de la cara elegida en cuanto está cargado.
  const loadedKey = useRef('');
  const variantKey = variant ? `${fontBrowserFamily}|${variant.key}` : '';
  useEffect(() => {
    if (!variant) return;
    let cancelled = false;
    ensureFace(variant.face)
      .then(() => {
        if (cancelled) return;
        loadedKey.current = variantKey;
        refresh();
      })
      .catch(() => {
        if (cancelled) return;
        notice = fw().fail + fontBrowserFamily;
        refresh();
      });
    return () => {
      cancelled = true;
    };
    // variantKey resume la familia y el estilo.
  }, [variantKey]);
  const large = {
    fontFamily:
      variant && loadedKey.current === variantKey
        ? `"MQT_${variant.face.id}"`
        : `"${fontBrowserFamily.replaceAll('"', '')}"`,
    fontWeight: String(variant?.instance?.coordinates?.wght ?? variant?.face.weight ?? 400),
    fontStyle: variant?.face.italic ? 'italic' : 'normal',
    fontVariationSettings: Object.entries(variant?.instance?.coordinates || {})
      .map(([k, v]) => `"${k}" ${v}`)
      .join(','),
  };

  return (
    <div className="font-browser-body" data-react="">
      <input
        type="search"
        id="fontBrowserSearch"
        ref={search}
        placeholder={fw().search}
        aria-label={fw().search}
        defaultValue=""
        onInput={filterFontBrowser}
      />
      <div className="font-browser-columns">
        <div>
          <p id="fontBrowserCount" className="help">
            {fontBrowserMatches.length} {fw().families}
          </p>
          <div
            id="fontBrowserList"
            role="listbox"
            tabIndex={0}
            ref={list}
            onScroll={(event) => {
              listScroll = event.currentTarget.scrollTop;
              listHeight = event.currentTarget.clientHeight;
              refresh();
            }}
          >
            <div id="fontBrowserRows" style={{ height: fontBrowserMatches.length * ROW_HEIGHT }}>
              {visible.map((family, n) => (
                <FamilyRow key={family} family={family} top={(first + n) * ROW_HEIGHT} />
              ))}
            </div>
          </div>
        </div>
        <section className="font-browser-detail">
          <h2 id="fontBrowserFamily">{fontBrowserFamily}</h2>
          <label id="fontBrowserWeightLabel" htmlFor="fontBrowserStyle">
            {fw().weight}
          </label>
          <select
            id="fontBrowserStyle"
            value={selectedKey}
            disabled={!variants.length}
            onChange={(event) => {
              fontBrowserVariant = event.target.value;
              notice = '';
              refresh();
            }}
          >
            {variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
                {v.face.axes.length ? ' · ' + fw().variable : ''}
              </option>
            ))}
          </select>
          <textarea
            id="fontBrowserSample"
            spellCheck={false}
            value={sampleText}
            onChange={(event) => {
              sampleText = event.target.value;
              refresh();
            }}
          />
          <div id="fontBrowserLarge" className="user-content" style={large}>
            {sampleText}
          </div>
          <p className="help" id="fontBrowserNotice">
            {notice ||
              bw(
                'Explorá sin modificar tu libro. Aplicar confirma la elección.',
                'Browse without changing your book. Apply confirms your choice.',
                'Explore sem alterar o livro. Aplicar confirma a escolha.',
              )}
          </p>
          {/* Desde una Hoja no: abriría otra pantalla en lugar de la Hoja. */}
          {hosted ? null : (
            <button
              type="button"
              id="openGlyphsFromBrowser"
              className="btn wide"
              onClick={() => {
                const face = browserCurrentVariant()?.face;
                fontBrowser.close();
                setTimeout(() => showFontGlyphs(face), 30);
              }}
            >
              {bw(
                'Ver glifos de esta fuente',
                'View glyphs of this font',
                'Ver glifos desta fonte',
              )}
            </button>
          )}
        </section>
      </div>
    </div>
  );
};

function openFontBrowser(select: HTMLSelectElement): void {
  if (select.disabled) return;
  fontBrowserTarget = select;
  fontBrowserFamily = select.value || editor.fontList[0];
  const o =
    select.dataset.object === 'font'
      ? selectObject()
      : select.dataset.bind
        ? get(select.dataset.bind.replace(/\.font$/, ''))
        : null;
  const f = o?.type === 'text' ? paragraphFormat(editor.book, o, currentParagraph(o)) : o,
    fontFace = f ? (selectedFace(f) as UIFontFace | undefined) : null;
  fontBrowserVariant = fontFace ? fontFace.id : '';
  syncVariant();
  fontBrowserMatches = [...editor.fontList];
  notice = '';
  const index = fontBrowserMatches.indexOf(fontBrowserFamily);
  listScroll = Math.max(0, index * ROW_HEIGHT - 100);
  listHeight = 0;
  // Nada de diálogo sobre diálogo: abierto desde una Hoja (por ejemplo, el estilo de párrafo),
  // ocupa su lugar en vez de apilarse. La Hoja toma el tamaño de una Ventana y esconde su contenido;
  // el explorador queda encima, sin velo propio. Al cerrarlo vuelve el contenido de la Hoja.
  // La Hoja que lo aloja (dialogs.tsx la deja montada debajo mientras tanto).
  const host = document.querySelector<HTMLDialogElement>(
    '#dialogLayer dialog[data-kind="sheet"][open]',
  );
  const hosted = !!host;
  void openWorkWindow(<FontBrowser hosted={hosted} />, {
    id: 'fontBrowser',
    title: bw('Elegí una tipografía', 'Choose a typeface', 'Escolha uma tipografia'),
    keepModal: hosted,
    action: {
      id: 'fontBrowserApply',
      label: bw('Aplicar tipografía', 'Apply typeface', 'Aplicar tipografia'),
      run: applyFontBrowser,
    },
  });
  const dialog = dialogElement();
  if (!host || !dialog) return;
  host.dataset.hosting = 'font-browser';
  dialog.dataset.hosted = '';
  dialog.addEventListener('beforetoggle', (event) => {
    if ((event as ToggleEvent).newState === 'closed') delete host.dataset.hosting;
  });
  // Si la Hoja se cierra por su cuenta, el explorador se va con ella (lo hace dialogs.tsx).
}
globalThis.openFontBrowser = openFontBrowser;

async function applyFontBrowser(): Promise<boolean> {
  if (applying) return false;
  const select = fontBrowserTarget;
  if (!select?.isConnected) {
    fontBrowser.close();
    return true;
  }
  const variant = browserCurrentVariant(),
    family = fontBrowserFamily;
  if (!family) return false;
  applying = true;
  try {
    if (variant) await ensureFace(variant.face);
    if (select.dataset.object === 'font') {
      const o = selectObject();
      if (!o || o.locked) return false;
      if (variant) await applyFace(o, variant.face, variant.instance);
      else {
        select.value = family;
        select.dispatchEvent(new Event('change'));
      }
    } else if (select.dataset.bind?.endsWith('.font')) {
      const c = get(select.dataset.bind.replace(/\.font$/, ''));
      commit(() => {
        c.font = family;
        if (variant) {
          c.fontFaceId = variant.face.id;
          c.fontStyleName = variant.instance?.name || variant.face.style;
          c.fontWeight = variant.instance?.coordinates?.wght ?? variant.face.weight;
          c.fontItalic = variant.face.italic;
          c.fontAxes = variant.instance?.coordinates || variations(variant.face);
        }
      }, false);
    } else {
      if (![...select.options].some((o) => o.value === family))
        select.add(new Option(family, family));
      select.value = family;
      select.dispatchEvent(new Event('change'));
    }
    fontBrowser.close();
    return true;
  } catch (e) {
    notice = (e as Error).message;
    refresh();
    return false;
  } finally {
    applying = false;
  }
}
globalThis.applyFontBrowser = applyFontBrowser;

globalThis.decorateFontBrowsers = function (root: ParentNode = document) {
  for (const select of root.querySelectorAll<HTMLSelectElement>(
    'select[data-object="font"],select[data-bind$=".font"],select#paragraphStyleFont',
  )) {
    if (select.dataset.browserHook) continue;
    select.dataset.browserHook = '1';
    select.classList.add('font-native-hidden');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'font-visual-select';
    button.disabled = select.disabled;
    button.textContent = select.value + ' ▾';
    button.title = bw(
      'Ver diseños de tipografías',
      'Preview typeface designs',
      'Ver desenhos das fontes',
    );
    button.onclick = () => openFontBrowser(select);
    select.after(button);
  }
};
extend.result(
  'autoElement',
  function (el, i, type, px, print = false) {
    const cfg = editor.book[type],
      face = selectedFace(cfg);
    if (el && face) {
      el.style.fontFamily = `"MQT_${face.id}"`;
      el.style.fontWeight = String(cfg.fontAxes?.wght ?? cfg.fontWeight ?? face.weight);
      el.style.fontStyle = cfg.fontItalic ? 'italic' : 'normal';
      el.style.fontVariationSettings = Object.entries(cfg.fontAxes || {})
        .map(([k, v]) => `"${k}" ${v}`)
        .join(',');
    }
    return el;
  },
  'font-browser',
);
extend.result(
  'ensureBookFonts',
  async function (pending) {
    await pending;
    await Promise.all(
      ['header', 'titulillo', 'folio'].map((t) =>
        ensureFace(selectedFace(editor.book[t]) as UIFontFace | undefined).catch(() => {}),
      ),
    );
  },
  'font-browser',
);
