// Paleta de glifos: muestra los caracteres que trae de verdad el archivo de fuente (los lee el
// proceso principal con "fontGlyphs"), con búsqueda Unicode, filtros y páginas, y permite insertar
// uno al final del párrafo elegido con la fuente de la paleta. Es una Ventana de trabajo en React
// (modal.workspace → openWorkWindow).
//
// showFontGlyphs, renderGlyphGrid y glyphPoints son globales porque los usa la prueba de
// tests/font-glyphs-tests.js (que también cambia glyphPoints y escribe en #glyphSearch antes de
// llamar a renderGlyphGrid) y scripts/style-snapshot.js. Mismos ids que la versión en HTML:
// #glyphFontFace, #glyphUseCurrent, #glyphSearch, #glyphRange, #fontGlyphGrid [data-real-glyph],
// #glyphPrev, #glyphNext, #glyphPageInfo, #glyphSelectedLarge, #glyphSelectedCode, #glyphInsert.
//
// La familia de la muestra va en línea (style fontFamily): es la cara elegida, un dato del
// usuario, no una medida ni un color del sistema de diseño (igual que en el explorador de fuentes).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { useLanguage } from './react/mount.tsx';
import { Select } from './components/form/Form.tsx';
import { Icon } from './components/Icon.tsx';

declare global {
  /** Códigos Unicode que tiene la fuente elegida en la paleta. */
  var glyphPoints: number[];
  /** Vuelve a dibujar la grilla de glifos (toma la búsqueda y el filtro de sus campos). */
  var renderGlyphGrid: () => void;
  /** Abre la paleta de glifos (con initialFace, o la fuente del texto seleccionado). */
  var showFontGlyphs: (initialFace?: NativeFontFace) => Promise<void>;
}

const PAGE_SIZE = 120;

globalThis.glyphPoints = [];
let glyphFace: NativeFontFace | null = null,
  glyphTargetId: string | null = null,
  glyphTargetPage: string | null = null,
  glyphPage = 0,
  glyphSelected: number | null = null,
  /** Cara del texto seleccionado al abrir (para "Fuente del texto seleccionado"). */
  currentFace: NativeFontFace | null = null,
  /** Búsqueda y filtro (los campos no son controlados: renderGlyphGrid los vuelve a leer). */
  glyphQuery = '',
  glyphRange = 'all',
  /** Mientras se leen los caracteres, o el error al leerlos (va en el lugar de la cuenta). */
  glyphStatus = '';
const glyphCache = new Map<string, number[]>();

// Versión del estado: cada cambio redibuja la paleta en el acto (las pruebas leen el DOM).
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

const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');

function filteredGlyphs(): number[] {
  const query = glyphQuery.trim().toUpperCase();
  return glyphPoints.filter((cp) => {
    if (
      glyphRange === 'private' &&
      !((cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0x10fffd))
    )
      return false;
    if (glyphRange === 'latin' && cp > 0x024f) return false;
    if (glyphRange === 'symbols' && !((cp >= 0x2000 && cp <= 0x2bff) || cp >= 0x1f000))
      return false;
    return (
      !query ||
      ('U+' + hex(cp)).includes(query) ||
      String.fromCodePoint(cp).toUpperCase().includes(query)
    );
  });
}

function renderGlyphGrid(): void {
  const search = document.getElementById('glyphSearch') as HTMLInputElement | null,
    range = document.getElementById('glyphRange') as HTMLSelectElement | null;
  if (search) glyphQuery = search.value;
  if (range) glyphRange = range.value;
  refresh();
}
globalThis.renderGlyphGrid = renderGlyphGrid;

/** Lee los caracteres reales de la cara (una vez por cara) y los muestra. */
async function readGlyphFace(id: string): Promise<void> {
  const face = nativeFaces.find((f) => f.id === id);
  if (!face) return;
  glyphFace = face;
  glyphSelected = null;
  glyphPage = 0;
  glyphStatus = bw(
    'Leyendo caracteres reales…',
    'Reading actual characters…',
    'Lendo caracteres reais…',
  );
  refresh();
  try {
    await ensureFace(face);
    let points = glyphCache.get(id);
    if (!points) {
      const result = await nativeCall('fontGlyphs', { fontId: id });
      points = (result.points || []) as number[];
      glyphCache.set(id, points);
    }
    // Si mientras tanto se eligió otra cara, ésta ya no se muestra.
    if (glyphFace?.id !== id) return;
    glyphPoints = points;
    glyphStatus = '';
    refresh();
  } catch (e) {
    glyphStatus = (e as Error).message;
    refresh();
  }
}

/** Agrega el glifo elegido al párrafo de destino con la fuente de la paleta (se puede deshacer). */
function insertGlyph(): void {
  const page = book.pages.find((p) => p.id === glyphTargetPage),
    target = page?.objects.find((o) => o.id === glyphTargetId);
  if (!target || target.locked || glyphSelected === null) return;
  const lines = target.text.split('\n'),
    index =
      paragraphScope.id === target.id && paragraphScope.index >= 0
        ? Math.min(paragraphScope.index, lines.length - 1)
        : lines.length - 1;
  paragraphOperation = true;
  try {
    commit(() => {
      lines[index] += String.fromCodePoint(glyphSelected!);
      target.text = lines.join('\n');
      const meta = paragraphMeta(target, index);
      meta.overrides = {
        ...(meta.overrides || {}),
        font: glyphFace!.family,
        fontFaceId: glyphFace!.id,
        fontStyleName: glyphFace!.style,
        fontWeight: glyphFace!.weight,
        fontItalic: glyphFace!.italic,
        fontAxes: variations(glyphFace!),
      };
    }, false);
  } finally {
    paragraphOperation = false;
  }
  toast(bw('Carácter insertado.', 'Character inserted.', 'Caractere inserido.'));
}

const GlyphWindow = () => {
  useSyncExternalStore(subscribe, () => version);
  useLanguage();
  const matches = filteredGlyphs(),
    pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  glyphPage = Math.max(0, Math.min(glyphPage, pages - 1));
  const family = glyphFace ? 'MQT_' + glyphFace.id : 'Georgia';
  return (
    <>
      <p className="builder-intro">
        {bw(
          'Explorá los caracteres disponibles en el archivo de fuente. Seleccioná uno para ampliarlo y ver su código.',
          'Explore characters available in the font file. Select one to enlarge it and see its code.',
          'Explore os caracteres disponíveis no arquivo de fonte. Selecione um para ampliar e ver o código.',
        )}
      </p>
      <div className="glyph-font-controls">
        <label>
          {bw('Familia y estilo', 'Family and style', 'Família e estilo')}
          <Select
            id="glyphFontFace"
            value={glyphFace?.id}
            options={nativeFaces.map((face) => ({
              value: face.id,
              label: face.family + ' · ' + face.style,
            }))}
            onChange={(id) => void readGlyphFace(id)}
          />
        </label>
        <button
          type="button"
          className="btn"
          id="glyphUseCurrent"
          disabled={!currentFace}
          onClick={() => currentFace && void readGlyphFace(currentFace.id)}
        >
          {bw('Fuente del texto seleccionado', 'Selected text font', 'Fonte do texto selecionado')}
        </button>
      </div>
      <div className="glyph-filters">
        <input
          id="glyphSearch"
          defaultValue={glyphQuery}
          placeholder={bw(
            'Buscar carácter o U+…',
            'Search character or U+…',
            'Buscar caractere ou U+…',
          )}
          aria-label="Unicode"
          onInput={(e) => {
            glyphQuery = e.currentTarget.value;
            glyphPage = 0;
            refresh();
          }}
        />
        <Select
          id="glyphRange"
          defaultValue={glyphRange}
          options={[
            {
              value: 'all',
              label: bw('Todos los caracteres', 'All characters', 'Todos os caracteres'),
            },
            {
              value: 'latin',
              label: bw('Latín y acentos', 'Latin and accents', 'Latim e acentos'),
            },
            { value: 'symbols', label: bw('Símbolos', 'Symbols', 'Símbolos') },
            {
              value: 'private',
              label: bw(
                'Uso privado · adornos',
                'Private use · ornaments',
                'Uso privado · ornamentos',
              ),
            },
          ]}
          onChange={(value) => {
            glyphRange = value;
            glyphPage = 0;
            refresh();
          }}
        />
      </div>
      <div className="glyph-view-layout">
        <div>
          <div id="fontGlyphGrid" style={{ fontFamily: family }}>
            {matches.slice(glyphPage * PAGE_SIZE, (glyphPage + 1) * PAGE_SIZE).map((cp) => {
              const char = String.fromCodePoint(cp),
                preview = /\p{Mark}/u.test(char) ? '◌' + char : char;
              return (
                <button
                  key={cp}
                  type="button"
                  data-real-glyph={cp}
                  className={glyphSelected === cp ? 'active' : ''}
                  title={'U+' + hex(cp)}
                  onClick={() => {
                    glyphSelected = cp;
                    refresh();
                  }}
                >
                  <span className="user-content">{preview}</span>
                  <small>{hex(cp)}</small>
                </button>
              );
            })}
          </div>
          <div className="glyph-pages">
            <button
              type="button"
              className="btn"
              id="glyphPrev"
              aria-label={bw('Página anterior', 'Previous page', 'Página anterior')}
              disabled={glyphPage === 0}
              onClick={() => {
                glyphPage--;
                refresh();
              }}
            >
              <Icon name="previous" />
            </button>
            <span id="glyphPageInfo">
              {glyphStatus ||
                `${matches.length} ${bw('caracteres', 'characters', 'caracteres')} · ${glyphPage + 1} / ${pages}`}
            </span>
            <button
              type="button"
              className="btn"
              id="glyphNext"
              aria-label={bw('Página siguiente', 'Next page', 'Próxima página')}
              disabled={glyphPage >= pages - 1}
              onClick={() => {
                glyphPage++;
                refresh();
              }}
            >
              <Icon name="next" />
            </button>
          </div>
        </div>
        <aside>
          <div
            id="glyphSelectedLarge"
            className="user-content"
            style={glyphSelected === null ? undefined : { fontFamily: family }}
          >
            {glyphSelected === null ? 'Aa' : String.fromCodePoint(glyphSelected)}
          </div>
          <p id="glyphSelectedCode">{glyphSelected === null ? '' : 'U+' + hex(glyphSelected)}</p>
          <button
            type="button"
            className="btn primary"
            id="glyphInsert"
            disabled={glyphSelected === null || !glyphTargetId}
            onClick={insertGlyph}
          >
            {bw('Insertar en el párrafo', 'Insert into paragraph', 'Inserir no parágrafo')}
          </button>
          <p className="help">
            {glyphTargetId
              ? bw(
                  'Se agrega al final del párrafo elegido —o del cuadro— y aplica a ese párrafo la fuente de esta paleta.',
                  'Appends to the chosen paragraph—or the frame—and applies this palette font to that paragraph.',
                  'Adiciona ao fim do parágrafo escolhido—ou da caixa—e aplica a fonte desta paleta ao parágrafo.',
                )
              : bw(
                  'Seleccioná una caja de texto para insertar. Podés explorar sin modificar el libro.',
                  'Select a text frame to insert. You can browse without changing the book.',
                  'Selecione uma caixa para inserir. Você pode explorar sem alterar o livro.',
                )}
          </p>
        </aside>
      </div>
      <p className="help">
        {bw(
          'Muestra los caracteres Unicode codificados, incluidos los de uso privado. No incluye alternativos OpenType sin código propio ni la activación de funciones estilísticas.',
          'Shows encoded Unicode characters, including private-use characters. Does not include unencoded OpenType alternates or stylistic feature activation.',
          'Mostra caracteres Unicode codificados, incluindo uso privado. Não inclui alternativos OpenType sem código próprio nem ativação de recursos estilísticos.',
        )}
      </p>
    </>
  );
};

async function showFontGlyphs(initialFace?: NativeFontFace): Promise<void> {
  await fontCatalogPromise;
  if (fontBrowser.open) fontBrowser.close();
  const o = selectObject(),
    f = o?.type === 'text' && !o.toc ? paragraphFormat(book, o, currentParagraph(o)) : null;
  glyphTargetId = o?.type === 'text' && !o.toc && !o.locked ? o.id : null;
  glyphTargetPage = book.pages[active].id;
  currentFace = (f && (selectedFace(f) as NativeFontFace | undefined)) || null;
  glyphFace = initialFace || currentFace || chooseDefaultFace('Georgia') || nativeFaces[0];
  // Cada apertura empieza sin búsqueda, sin filtro y sin glifo elegido.
  glyphQuery = '';
  glyphRange = 'all';
  glyphSelected = null;
  glyphPage = 0;
  modal.workspace(
    bw('Glifos de la tipografía', 'Typeface glyphs', 'Glifos da tipografia'),
    <GlyphWindow />,
    { variant: 'glyph-real-modal' },
  );
  if (glyphFace) await readGlyphFace(glyphFace.id);
}
globalThis.showFontGlyphs = showFontGlyphs;
// "Glifos de la tipografía…" del inspector lo dibuja el panel de Carácter (TextPanels.tsx).
// "Ver glifos de esta fuente" vive en el explorador de fuentes (font-browser.tsx).

export {};
