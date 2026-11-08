'use strict';
const fontWords = {
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
    folders: 'Pastas adicionais',
    noFolders: 'Nenhuma pasta adicional.',
    manage: 'Gerenciar pastas',
  },
};
const fw = () => fontWords[globalThis.LibroI18n?.language || 'es'];
let nativeFaces = [],
  fontFolders = [],
  fontLoading = true,
  fontLoadErrors = new Set(),
  loadedFaces = new Map(),
  fontCatalogPromise = null;
let localFontFaces = nativeFaces,
  portableFontFaces = [];
function updatePortableFontCatalog() {
  const catalog = new Map(localFontFaces.map((face) => [face.id, face]));
  for (const face of portableFontFaces) catalog.delete(face.id);
  nativeFaces = [...portableFontFaces, ...catalog.values()];
  fontList = [...new Set(nativeFaces.map((face) => face.family))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (!fontList.length) fontList = ['Georgia', 'Times New Roman', 'Arial'];
}
function familyFaces(family) {
  return nativeFaces.filter((f) => f.family === family);
}
function chooseDefaultFace(family) {
  return familyFaces(family)
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.weight - 400) +
        (a.italic ? 1000 : 0) -
        (Math.abs(b.weight - 400) + (b.italic ? 1000 : 0)),
    )[0];
}
function selectedFace(o) {
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
function variations(face) {
  let values = face.axes.map((a) => [a.tag, a.normal]);
  return Object.fromEntries(values);
}
function ensureFace(face) {
  if (!face) return Promise.resolve();
  if (loadedFaces.has(face.id)) return loadedFaces.get(face.id);
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
async function ensureBookFonts() {
  const faces = new Map();
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
async function applyFace(o, face, instance) {
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
async function obtainFonts(action = 'fontCatalog') {
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
    await ensureBookFonts();
    renderPages();
  } catch (error) {
    toast(fw().fail + error.message, 'error');
  } finally {
    fontLoading = false;
    inspector();
  }
}
decorateInspector(() => {
  if (tab !== 'text' && tab !== 'design') return;
  const host = $('#inspectorContent'),
    o = selectObject(),
    w = fw(),
    face = o?.type === 'text' ? selectedFace(o) : null;
  const selector = host.querySelector('[data-object="font"]');
  if (selector) {
    const search = document.createElement('input');
    search.className = 'field-full font-search';
    search.placeholder = w.search;
    search.setAttribute('aria-label', w.search);
    selector.closest('.field-row').before(search);
    search.oninput = () => {
      const filter = search.value.toLocaleLowerCase(),
        matches = fontList.filter((f) => f.toLocaleLowerCase().includes(filter));
      selector.replaceChildren();
      for (const f of matches) {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        option.selected = f === o?.font;
        selector.append(option);
      }
    };
    selector.onchange = async () => {
      const target = selectObject(),
        next = chooseDefaultFace(selector.value);
      if (!target) return;
      try {
        if (next) await applyFace(target, next);
        else
          commit(() => {
            target.font = selector.value;
            delete target.fontFaceId;
            delete target.fontAxes;
            delete target.fontWeight;
            delete target.fontItalic;
          }, false);
      } catch (error) {
        toast(w.fail + error.message, 'error');
      }
    };
    if (o?.type === 'text') {
      const list = familyFaces(o.font),
        variants = [];
      for (const f of list) {
        variants.push({
          key: f.id,
          face: f,
          label: f.style + (f.axes.length ? ' · ' + w.variable : ''),
          instance: null,
        });
        f.instances.forEach((inst, i) =>
          variants.push({
            key: f.id + '@' + i,
            face: f,
            label: inst.name || String(i + 1),
            instance: inst,
          }),
        );
      }
      const block = document.createElement('div');
      block.className = 'font-variant-block';
      block.innerHTML = `<div class="field-row"><label>${w.weight}</label><select id="fontVariant">${variants.map((v) => `<option value="${v.key}" ${o.fontFaceId === v.face.id && o.fontStyleName === (v.instance?.name || v.face.style) ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>${face?.axes.length ? `<div class="sub-label">${w.axes}</div>${face.axes.map((axis) => `<div class="font-axis"><div><label>${esc(axis.name || axis.tag)} <span>${axis.tag}</span></label><output>${Number(o.fontAxes?.[axis.tag] ?? axis.normal).toFixed(1)}</output></div><input type="range" data-axis="${axis.tag}" min="${axis.min}" max="${axis.max}" step="${axis.tag === 'wght' ? 1 : 0.1}" value="${o.fontAxes?.[axis.tag] ?? axis.normal}" aria-label="${esc(axis.name || axis.tag)}"></div>`).join('')}` : ''}${o.fontFaceId && (!nativeFaces.some((f) => f.id === o.fontFaceId) || fontLoadErrors.has(o.fontFaceId)) ? `<p class="font-warning">${w.missing}</p>` : ''}<div class="font-specimen" id="fontSpecimen" style="font-family:${face ? 'MQT_' + face.id : esc(o.font)}">Aa Bb Gg 0123</div>`;
      selector.closest('.field-row').after(block);
      $('#fontVariant').onchange = async (e) => {
        const v = variants.find((v) => v.key === e.target.value);
        if (!v) return;
        try {
          await applyFace(selectObject(), v.face, v.instance);
        } catch (error) {
          toast(w.fail + error.message, 'error');
        }
      };
      block.querySelectorAll('[data-axis]').forEach((input) => {
        input.oninput = () =>
          (input.previousElementSibling.querySelector('output').textContent = Number(
            input.value,
          ).toFixed(1));
        input.onchange = () =>
          commit(() => {
            const target = selectObject();
            if (!target.fontFaceId && face) {
              target.fontFaceId = face.id;
              target.fontStyleName = face.style;
            }
            target.fontAxes = {
              ...variations(face),
              ...(target.fontAxes || {}),
              [input.dataset.axis]: Number(input.value),
            };
            if (input.dataset.axis === 'wght') target.fontWeight = Number(input.value);
          }, false);
      });
      if (face) {
        const specimen = $('#fontSpecimen');
        specimen.style.fontVariationSettings = Object.entries(o.fontAxes || {})
          .map(([k, v]) => `"${k}" ${v}`)
          .join(',');
        specimen.style.fontWeight = String(o.fontWeight || face.weight);
        specimen.style.fontStyle = o.fontItalic ? 'italic' : 'normal';
      }
      const styles = host.querySelector('[data-style="bold"]')?.parentElement;
      if (styles && face) styles.remove();
    }
  }
  if (tab === 'text') {
    const sectionNode = document.createElement('section');
    sectionNode.className = 'section font-library';
    sectionNode.innerHTML = `<div class="section-heading">${icon('text')} ${w.library}</div><p class="help">${fontLoading ? w.loading : `${new Set(nativeFaces.map((f) => f.family)).size} ${w.families} · ${nativeFaces.length} ${w.faces}`}</p>${fontLoading ? UI.skeleton({ lines: 4, label: w.loading }) : ''}<details class="font-library-options"><summary>${w.manage}</summary><button class="btn wide" id="addFontFolder">${icon('folder')} ${w.folder}</button><button class="btn wide" id="refreshFontCatalog">${w.refresh}</button><p class="help">${w.hint}</p><details><summary>${w.folders}</summary><div class="font-folder-list user-content">${fontFolders.length ? fontFolders.map((f) => `<p>${esc(f)}</p>`).join('') : w.noFolders}</div></details><p class="help">${w.saved}</p></details>`;
    host.prepend(sectionNode);
    $('#addFontFolder').disabled = $('#refreshFontCatalog').disabled = fontLoading;
    $('#addFontFolder').onclick = () => obtainFonts('chooseFontFolder');
    $('#refreshFontCatalog').onclick = () => obtainFonts('refreshFonts');
  }
}, 'fonts');
extend.result(
  'paper',
  function (result, i, px, print = false) {
    for (const o of book.pages[i].objects) {
      if (o.type !== 'text') continue;
      const el = result.querySelector(`[data-id="${o.id}"]`),
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
  function (result, i, type, px, print = false) {
    const face = chooseDefaultFace(book[type].font);
    if (result && face && !fontLoadErrors.has(face.id))
      result.style.fontFamily = `"MQT_${face.id}", "${book[type].font}"`;
    return result;
  },
  'fonts',
);
extend.result(
  'prepareOutput',
  function (result, config) {
    window.outputReady = false;
    window.fontOutputReady = false;
    Promise.all([
      ensureBookFonts(),
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
  function (content) {
    ensureBookFonts().then(() => renderPages());
  },
  'fonts',
);
window.fontLibraryReady = false;
async function startFontLibrary() {
  for (let n = 0; n < 100 && !native; n++) await new Promise((r) => setTimeout(r, 100));
  if (native) await obtainFonts();
  fontLibraryReady = true;
}
fontCatalogPromise = startFontLibrary();
