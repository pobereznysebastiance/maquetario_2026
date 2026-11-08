'use strict';
function coverMeasurementRows(c) {
  return coverGeometry(c).parts.map((p) => ({
    ...p,
    height: book.height,
    pixelW: Math.round((p.w / 25.4) * 300),
    pixelH: Math.round((book.height / 25.4) * 300),
  }));
}
function coverMeasurementText(c) {
  const g = coverGeometry(c);
  return [
    'MAQUETARIO · ' + book.title,
    bw('FICHA DE CUBIERTA', 'COVER SPECIFICATION', 'FICHA DE CAPA'),
    ...coverMeasurementRows(c).map(
      (p) =>
        `${coverNames()[p.id]}: ${displayDimensions(p.w, p.height)} · ${p.pixelW} × ${p.pixelH} px (300 ppp)`,
    ),
    `${bw('Desplegado final', 'Trimmed spread', 'Peça final')}: ${displayDimensions(g.width, g.height)}`,
    `${bw('Con sangrado y demasía', 'With bleed and wrap', 'Com sangria e dobra')}: ${displayDimensions(g.width + 2 * coverExtension(c), g.height + 2 * coverExtension(c))}`,
    `${bw('Sangrado exterior', 'Outer bleed', 'Sangria externa')}: ${displayMeasure(c.bleed)} ${documentUnit()}`,
    `${bw('Demasía por lado', 'Wrap allowance per edge', 'Dobra por lado')}: ${displayMeasure(c.wrap || 0)} ${documentUnit()}`,
    `${bw('Seguridad de texto', 'Text safety', 'Segurança do texto')}: ${displayMeasure(c.safe)} ${documentUnit()}`,
    bw(
      'Las partes se colocan al tamaño final indicado. El sangrado se añade al contorno exterior del desplegado, no a cada pliegue. Los píxeles son una referencia a 300 ppp, no una comprobación de la calidad de la imagen. Confirmar lomo y troquel con la imprenta.',
      'Place parts at the stated trim sizes. Bleed is added around the outer spread, not at each fold. Pixel values are a 300 ppi reference, not an image quality check. Confirm spine and dieline with the printer.',
      'Insira as partes nos tamanhos finais. A sangria vai no contorno externo, não em cada dobra. Os pixels são referência a 300 ppp, não uma verificação de qualidade. Confirme lombada e faca com a gráfica.',
    ),
  ].join('\n');
}
function refreshCoverMeasurements() {
  if (!$('#coverMeasureTable')) return;
  const c = coverDraft,
    g = coverGeometry(c);
  $('#coverMeasureTable').innerHTML =
    `<thead><tr><th>${bw('Zona', 'Area', 'Área')}</th><th>${bw('Tamaño final', 'Trim size', 'Tamanho final')} · ${documentUnit()}</th><th>${bw('Imagen a 300 ppp · px', 'Image at 300 ppi · px', 'Imagem a 300 ppp · px')}</th></tr></thead><tbody>${coverMeasurementRows(
      c,
    )
      .map(
        (p) =>
          `<tr class="${p.id === coverPart ? 'selected' : ''}"><td>${coverNames()[p.id]}</td><td>${displayMeasure(p.w)} × ${displayMeasure(p.height)}</td><td>${p.pixelW} × ${p.pixelH}</td></tr>`,
      )
      .join('')}</tbody>`;
  $('#coverMeasureSummary').textContent =
    bw('Desplegado final: ', 'Trimmed spread: ', 'Peça final: ') +
    `${displayDimensions(g.width, g.height)} · ` +
    bw('Con sangrado y demasía: ', 'With bleed and wrap: ', 'Com sangria e dobra: ') +
    `${displayDimensions(g.width + 2 * coverExtension(c), g.height + 2 * coverExtension(c))}`;
  if ($('#coverImageFit')) $('#coverImageFit').value = c.parts[coverPart].imageFit || 'cover';
}
extend.after(
  'updateCoverPreview',
  function () {
    refreshCoverMeasurements();
  },
  'cover-measurements',
);
extend.after(
  'coverEditor',
  function () {
    if (!$('#coverPreview')) return;
    const panel = document.createElement('section');
    panel.className = 'cover-measures';
    panel.innerHTML = `<h3>${bw('Medidas para diseñar cada parte', 'Dimensions for designing each part', 'Medidas para criar cada parte')}</h3><table id="coverMeasureTable"></table><p id="coverMeasureSummary"></p><p class="help">${bw('Ancho × alto. Prepará cada imagen con la proporción de su zona. El sangrado corresponde al contorno exterior del desplegado; los pliegues no llevan sangrado adicional. Píxeles de referencia a 300 ppp.', 'Width × height. Prepare each image in the aspect ratio of its area. Bleed applies to the outer spread; folds need no extra bleed. Pixel reference at 300 ppi.', 'Largura × altura. Prepare cada imagem na proporção da área. Sangria no contorno externo; dobras não precisam de sangria extra. Referência em pixels a 300 ppp.')}</p><button type="button" class="btn" id="downloadCoverSpecs">${bw('Descargar ficha de medidas', 'Download dimension sheet', 'Baixar ficha de medidas')}</button>`;
    $('#coverDimensions').after(panel);
    $('#downloadCoverSpecs').onclick = () =>
      download(
        new Blob(['\ufeff' + coverMeasurementText(coverDraft)], {
          type: 'text/plain;charset=utf-8',
        }),
        book.title + ' - medidas cubierta.txt',
      );
    const fit = document.createElement('label');
    fit.className = 'cover-image-fit';
    fit.innerHTML = `${bw('Ajuste de imagen', 'Image fit', 'Ajuste de imagem')} <select id="coverImageFit"><option value="cover">${bw('Cubrir zona · recorta excedente', 'Cover area · crop excess', 'Cobrir área · cortar excesso')}</option><option value="contain">${bw('Mostrar imagen completa', 'Show entire image', 'Mostrar imagem inteira')}</option></select>`;
    $('.cover-image-actions').append(fit);
    $('#coverImageFit').onchange = (e) => {
      coverDraft.parts[coverPart].imageFit = e.target.value;
      updateCoverPreview();
    };
    refreshCoverMeasurements();
  },
  'cover-measurements',
);
extend.result(
  'coverArtwork',
  function (art, c, px, guides = false, crop = false) {
    art.querySelectorAll('[data-cover-part]').forEach((region) => {
      const img = region.querySelector('img');
      if (img) img.style.objectFit = c.parts[region.dataset.coverPart].imageFit || 'cover';
    });
    return art;
  },
  'cover-measurements',
);
window.preparePromoScene = async function (scene) {
  hideWelcome();
  closeTutorial();
  if ($('#modal').open) $('#modal').close();
  $('#toast').classList.remove('visible');
  if (scene === 'start') {
    await showWelcome();
    return;
  }
  if (scene === 'new') {
    dirty = false;
    settingsNew(true);
    $('#newTitle').value = 'El atlas de las casas vacías';
    $('[data-format="A5"]').click();
    return;
  }
  if (scene === 'manuscript') {
    dirty = false;
    bookBuilder(true);
    return;
  }
  if (scene === 'grid') {
    gridGallery();
    return;
  }
  if (scene === 'cover') {
    book.cover = defaultCover();
    const img = new Image();
    img.src = 'assets/welcome-editorial-glass.png';
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    book.cover.parts.front.image = canvas.toDataURL('image/png');
    book.cover.parts.front.text = book.title;
    book.cover.parts.front.color = '#153D42';
    book.cover.parts.front.size = 24;
    book.cover.parts.front.y = 20;
    coverEditor();
    return;
  }
  if (scene === 'export') {
    coverOutputDialog();
    return;
  }
  if (scene === 'pages') {
    window.prepareNovelProof();
    goToBookPage(book.pages.findIndex((p) => p.section.startsWith('I ·')));
    showTab('structure');
    return;
  }
};
