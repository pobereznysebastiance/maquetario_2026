// Explorador visual de tipografías: reemplaza los selectores de fuente del inspector y de los
// diálogos por un botón que abre un diálogo con la lista de familias (con muestra de cada una,
// dibujada sólo en las filas visibles), los estilos e instancias de la familia elegida y una
// muestra grande editable. Aplicar es lo único que cambia el documento.
// También pinta cornisas, titulillos y folios con la cara elegida y la carga antes de imprimir.
//
// Son globales:
// - fontBrowser (el diálogo): lo cierran font-glyphs, shapes, inspector-organization,
//   focus-layout y las pruebas.
// - fontBrowserFamily, fontBrowserVariant y fontBrowserMatches: estado que viven en globalThis
//   porque tests/font-browser-tests.js los lee y los cambia.
// - browserCurrentVariant (font-glyphs.js), openFontBrowser y filterFontBrowser (pruebas,
//   review-workspace.js y las capturas de estilo).
// - decorateFontBrowsers: page-priority.ts la extiende, así que acá se llama por su nombre global
//   (no por uno local) para pasar por esa extensión, como antes.
//
// Fuente TypeScript: se compila a build/font-browser.js (desktop/scripts/build.mjs).

/** Instancia con nombre de una fuente variable. */
export interface UIFontInstance {
  name: string;
  coordinates: Record<string, number>;
}

/** Cara tipográfica del catálogo (lo que manda el anfitrión: desktop/src/main/fonts/opentype.ts → FontFace). */
export interface UIFontFace {
  id: string;
  family: string;
  style: string;
  weight: number;
  italic: boolean;
  axes: { tag: string; name: string; min: number; max: number; normal: number }[];
  instances: UIFontInstance[];
}

/** Una opción de estilo del explorador: una cara, o una instancia de una cara variable. */
export interface BrowserVariant {
  key: string;
  label: string;
  face: UIFontFace;
  instance: UIFontInstance | null;
}

declare global {
  /** Diálogo del explorador de tipografías. */
  var fontBrowser: HTMLDialogElement;
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
  /** Cambia los selectores de fuente de root por el botón que abre el explorador. */
  var decorateFontBrowsers: (root?: ParentNode) => void;
}

let fontBrowserTarget: HTMLSelectElement | null = null,
  fontBrowserSearch = '',
  fontBrowserGeneration = 0;
globalThis.fontBrowserFamily = '';
globalThis.fontBrowserVariant = '';
globalThis.fontBrowserMatches = [];
const fontBrowser = document.createElement('dialog');
fontBrowser.id = 'fontBrowser';
fontBrowser.innerHTML = `<div class="modal-header"><div><span class="eyebrow">MAQUETARIO · Aa</span><h1 id="fontBrowserTitle"></h1></div><button type="button" id="fontBrowserClose" class="icon-btn" aria-label="Cerrar">${icon('close')}</button></div><div class="font-browser-body"><input type="search" id="fontBrowserSearch"><div class="font-browser-columns"><div><p id="fontBrowserCount" class="help"></p><div id="fontBrowserList" role="listbox" tabindex="0"><div id="fontBrowserRows"></div></div></div><section class="font-browser-detail"><h2 id="fontBrowserFamily"></h2><label id="fontBrowserWeightLabel" for="fontBrowserStyle"></label><select id="fontBrowserStyle"></select><textarea id="fontBrowserSample" spellcheck="false">Aa Bb Gg · Maquetario 0123456789</textarea><div id="fontBrowserLarge" class="user-content"></div><p class="help" id="fontBrowserNotice"></p></section></div></div><div class="modal-actions"><button type="button" id="fontBrowserCancel" class="btn"></button><button type="button" id="fontBrowserApply" class="btn primary"></button></div>`;
document.body.append(fontBrowser);
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
function updateFontBrowserDetail(): void {
  const generation = ++fontBrowserGeneration,
    variants = browserVariants(fontBrowserFamily);
  if (!variants.some((v) => v.key === fontBrowserVariant))
    fontBrowserVariant =
      variants.find((v) => v.face.id === chooseDefaultFace(fontBrowserFamily)?.id)?.key ||
      variants[0]?.key ||
      '';
  $('#fontBrowserFamily').textContent = fontBrowserFamily;
  $('#fontBrowserStyle').innerHTML = variants
    .map(
      (v) =>
        `<option value="${v.key}" ${v.key === fontBrowserVariant ? 'selected' : ''}>${esc(v.label)}${v.face.axes.length ? ' · ' + fw().variable : ''}</option>`,
    )
    .join('');
  $('#fontBrowserStyle').disabled = !variants.length;
  const variant = browserCurrentVariant(),
    sample = $('#fontBrowserLarge');
  sample.textContent = $('#fontBrowserSample').value;
  Object.assign(sample.style, {
    fontFamily: `"${fontBrowserFamily.replaceAll('"', '')}"`,
    fontWeight: String(variant?.instance?.coordinates?.wght ?? variant?.face.weight ?? 400),
    fontStyle: variant?.face.italic ? 'italic' : 'normal',
    fontVariationSettings: Object.entries(variant?.instance?.coordinates || {})
      .map(([k, v]) => `"${k}" ${v}`)
      .join(','),
  });
  $('#fontBrowserNotice').textContent = bw(
    'Explorá sin modificar tu documento. Aplicar confirma la elección.',
    'Browse without changing your document. Apply confirms your choice.',
    'Explore sem alterar o documento. Aplicar confirma a escolha.',
  );
  if (variant)
    ensureFace(variant.face)
      .then(() => {
        if (generation === fontBrowserGeneration)
          sample.style.fontFamily = `"MQT_${variant.face.id}"`;
      })
      .catch(() => {
        if (generation === fontBrowserGeneration)
          $('#fontBrowserNotice').textContent = fw().fail + fontBrowserFamily;
      });
}
function renderFontBrowserRows(): void {
  const list = $('#fontBrowserList'),
    rowHeight = 68,
    first = Math.max(0, Math.floor(list.scrollTop / rowHeight) - 2),
    last = Math.min(
      fontBrowserMatches.length,
      first + Math.ceil((list.clientHeight || 420) / rowHeight) + 5,
    ),
    rows = $('#fontBrowserRows');
  rows.style.height = fontBrowserMatches.length * rowHeight + 'px';
  rows.innerHTML = fontBrowserMatches
    .slice(first, last)
    .map((family, n) => {
      const face = chooseDefaultFace(family),
        count = familyFaces(family).length;
      return `<button type="button" class="font-browser-row ${family === fontBrowserFamily ? 'active' : ''}" style="top:${(first + n) * rowHeight}px" data-browser-family="${esc(family)}" role="option" aria-selected="${family === fontBrowserFamily}"><span class="font-browser-name">${esc(family)}<small>${count || 1} ${fw().faces}</small></span><span class="font-browser-row-sample user-content" ${face ? `data-preview-face="${face.id}"` : ''} style="font-family:'${face ? 'MQT_' + face.id : esc(family)}'">Aa Bb Gg</span></button>`;
    })
    .join('');
  rows.querySelectorAll<HTMLElement>('[data-browser-family]').forEach(
    (b) =>
      (b.onclick = () => {
        fontBrowserFamily = b.dataset.browserFamily!;
        fontBrowserVariant = '';
        updateFontBrowserDetail();
        renderFontBrowserRows();
      }),
  );
  const faces = [...rows.querySelectorAll<HTMLElement>('[data-preview-face]')];
  let cursor = 0;
  async function loadVisible(): Promise<void> {
    while (cursor < faces.length) {
      const el = faces[cursor++],
        face = nativeFaces.find((f) => f.id === el.dataset.previewFace);
      if (!face) continue;
      try {
        await ensureFace(face);
        if (el.isConnected) el.style.fontFamily = `"MQT_${face.id}"`;
      } catch {
        if (el.isConnected)
          el.textContent = bw('Sin vista previa', 'Preview unavailable', 'Sem prévia');
      }
    }
  }
  for (let i = 0; i < 3; i++) loadVisible();
}
function filterFontBrowser(): void {
  fontBrowserSearch = $('#fontBrowserSearch').value;
  fontBrowserMatches = fontList.filter((f) =>
    foldEditorial(f).includes(foldEditorial(fontBrowserSearch)),
  );
  $('#fontBrowserCount').textContent = `${fontBrowserMatches.length} ${fw().families}`;
  $('#fontBrowserList').scrollTop = 0;
  renderFontBrowserRows();
}
globalThis.filterFontBrowser = filterFontBrowser;
function openFontBrowser(select: HTMLSelectElement): void {
  if (select.disabled) return;
  fontBrowserTarget = select;
  fontBrowserFamily = select.value || fontList[0];
  const o =
    select.dataset.object === 'font'
      ? selectObject()
      : select.dataset.bind
        ? get(select.dataset.bind.replace(/\.font$/, ''))
        : null;
  const f = o?.type === 'text' ? paragraphFormat(book, o, currentParagraph(o)) : o,
    fontFace = f ? (selectedFace(f) as UIFontFace | undefined) : null;
  fontBrowserVariant = fontFace ? fontFace.id : '';
  $('#fontBrowserTitle').textContent = bw(
    'Elegí una tipografía',
    'Choose a typeface',
    'Escolha uma tipografia',
  );
  $('#fontBrowserSearch').placeholder = fw().search;
  $('#fontBrowserSearch').setAttribute('aria-label', fw().search);
  $('#fontBrowserWeightLabel').textContent = fw().weight;
  $('#fontBrowserCancel').textContent = bw('Cancelar', 'Cancel', 'Cancelar');
  $('#fontBrowserApply').textContent = bw(
    'Aplicar tipografía',
    'Apply typeface',
    'Aplicar tipografia',
  );
  $('#fontBrowserSearch').value = '';
  fontBrowserMatches = [...fontList];
  fontBrowser.showModal();
  filterFontBrowser();
  const index = fontBrowserMatches.indexOf(fontBrowserFamily);
  $('#fontBrowserList').scrollTop = Math.max(0, index * 68 - 100);
  renderFontBrowserRows();
  updateFontBrowserDetail();
  $('#fontBrowserSearch').focus();
}
globalThis.openFontBrowser = openFontBrowser;
$('#fontBrowserClose').onclick = $('#fontBrowserCancel').onclick = () => fontBrowser.close();
$('#fontBrowserSearch').oninput = filterFontBrowser;
$('#fontBrowserList').onscroll = renderFontBrowserRows;
$('#fontBrowserStyle').onchange = (e) => {
  fontBrowserVariant = (e.target as HTMLSelectElement).value;
  updateFontBrowserDetail();
};
$('#fontBrowserSample').oninput = () =>
  ($('#fontBrowserLarge').textContent = $('#fontBrowserSample').value);
$('#fontBrowserApply').onclick = async () => {
  const select = fontBrowserTarget;
  if (!select?.isConnected) {
    fontBrowser.close();
    return;
  }
  const variant = browserCurrentVariant(),
    family = fontBrowserFamily;
  if (!family) return;
  $('#fontBrowserApply').disabled = true;
  try {
    if (variant) await ensureFace(variant.face);
    if (select.dataset.object === 'font') {
      const o = selectObject();
      if (!o || o.locked) return;
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
  } catch (e) {
    $('#fontBrowserNotice').textContent = (e as Error).message;
  } finally {
    $('#fontBrowserApply').disabled = false;
  }
};
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
decorateInspector(() => {
  decorateFontBrowsers($('#inspectorContent'));
}, 'font-browser');
extend.after(
  'modal',
  function (...args) {
    decorateFontBrowsers($('#modal'));
  },
  'font-browser',
);
extend.result(
  'autoElement',
  function (el, i, type, px, print = false) {
    const cfg = book[type],
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
        ensureFace(selectedFace(book[t]) as UIFontFace | undefined).catch(() => {}),
      ),
    );
  },
  'font-browser',
);
decorateFontBrowsers($('#inspectorContent'));
