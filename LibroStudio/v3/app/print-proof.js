'use strict';

function coverFontFamily() {
  const face = chooseDefaultFace('Georgia');
  return face ? '"MQT_'+face.id+'",Georgia,serif' : 'Georgia,serif';
}

const coverControlsBeforeWrap = coverEditor;
coverEditor = function() {
  coverControlsBeforeWrap();
  const fields = $('[data-cover-size="spine"]')?.closest('.cover-fields');
  if (!fields) return;
  const controls = document.createElement('section');
  controls.className = 'cover-measures';
  controls.innerHTML = `<h3>${bw('Solapas y forrado','Flaps and wrap','Orelhas e revestimento')}</h3>
    <div class="page-action">
      <label class="check-line"><input type="checkbox" data-flap="leftFlap">${bw('Solapa trasera','Back flap','Orelha traseira')}</label>
      <label class="check-line"><input type="checkbox" data-flap="rightFlap">${bw('Solapa delantera','Front flap','Orelha dianteira')}</label>
    </div>
    <label class="field-row">${bw('Demasía para doblar · mm por lado','Wrap allowance · mm per edge','Margem de dobra · mm por lado')}
      <input id="coverWrap" type="number" min="0" max="50" step=".5" value="${coverDraft.wrap||0}"></label>
    <p class="help">${bw('La demasía se dobla hacia adentro del cartón. El sangrado va por fuera de esa demasía. Las marcas indican el corte del material, incluido lo que se dobla.',
      'The wrap folds over the board edges. Bleed extends beyond it. Crop marks indicate where to cut the material, including the wrap.',
      'A sobra dobra para dentro do cartão. A sangria fica além dela. As marcas indicam o corte do material, incluindo a sobra.')}</p>`;
  $('#coverDimensions').after(controls);
  for (const toggle of controls.querySelectorAll('[data-flap]')) {
    const key = toggle.dataset.flap, field = $(`[data-cover-size="${key}"]`);
    let previousWidth = coverDraft[key] || 70;
    toggle.checked = coverDraft[key] > 0;
    toggle.onchange = () => {
      if (!toggle.checked && coverDraft[key] > 0) previousWidth = coverDraft[key];
      field.value = toggle.checked ? previousWidth : 0;
      field.dispatchEvent(new Event('change',{bubbles:true}));
    };
  }
  $('#coverWrap').onchange = event => {
    const field = event.target;
    if (field.value === '' || !field.validity.valid) { field.value = coverDraft.wrap || 0; return; }
    coverDraft.wrap = Number(field.value);
    updateCoverPreview();
  };
  updateCoverPreview();
};

const coverPreviewBeforeFlaps = updateCoverPreview;
updateCoverPreview = function() {
  if (coverDraft && !coverGeometry(coverDraft).parts.some(part => part.id === coverPart)) coverPart = 'front';
  coverPreviewBeforeFlaps();
  for (const toggle of $$('[data-flap]')) toggle.checked = coverDraft[toggle.dataset.flap] > 0;
  if ($('#coverPreview')) {
    const parts = new Set(coverGeometry(coverDraft).parts.map(part => part.id));
    for (const button of $$('[data-cover-edit]')) button.hidden = !parts.has(button.dataset.coverEdit);
    if (coverDraft.wrap) $('#coverDimensions').textContent += ' · '+bw(
      `+${displayMeasure(coverDraft.wrap)} ${documentUnit()} de demasía por lado`,`+${displayMeasure(coverDraft.wrap)} ${documentUnit()} wrap per edge`,`+${displayMeasure(coverDraft.wrap)} ${documentUnit()} de dobra por lado`);
  }
};

function sheetSizeStatus(art, paper, ratio) {
  const size = displayDimensions;
  const scale = ratio >= .9999 ? bw('Tamaño real · 100%','Actual size · 100%','Tamanho real · 100%')
    : bw(`Reducido al ${(ratio*100).toFixed(1)}%`,`Reduced to ${(ratio*100).toFixed(1)}%`,`Reduzido a ${(ratio*100).toFixed(1)}%`);
  return bw('Pieza','Artwork','Peça')+' '+size(...art)+' · '+bw('Hoja','Sheet','Folha')+' '+size(...paper)+' · '+scale;
}

const interiorPreviewBeforeStatus = outputPreview;
outputPreview = function() {
  const checkbox = $('#outFit');
  if (!checkbox || !$('#outputPreview')) return interiorPreviewBeforeStatus();
  const config = outputConfigFromDialog();
  try {
    const trial = outputGeometry({...config,fit:true});
    const artwork = outputGeometry({...config,paper:'book',fit:false});
    const status = sheetSizeStatus([artwork.width,artwork.height],[trial.width,trial.height],trial.ratio);
    const tooLarge = !config.fit && trial.ratio < .999;
    if (tooLarge) checkbox.checked = true;
    try { interiorPreviewBeforeStatus(); } finally { checkbox.checked = config.fit; }
    $('#outputSummary').textContent += ' · '+status;
    if (tooLarge) {
      $('#outputError').textContent = bw('La simulación está reducida. Activá la reducción o elegí una hoja mayor para exportar.',
        'The simulation is scaled down. Enable shrinking or choose a larger sheet to export.',
        'A simulação está reduzida. Ative a redução ou escolha uma folha maior para exportar.');
      $('#modalApply').disabled = true;
    }
  } catch {
    interiorPreviewBeforeStatus();
    $('#outputPreview').replaceChildren();
  }
};

function coverSheetDialog(destination) {
  const printing = destination === 'print', w = ow();
  const title = printing ? bw('Imprimir cubierta','Print cover','Imprimir capa') : bw('Exportar cubierta','Export cover','Exportar capa');
  const config = () => ({
    kind:'cover',paper:$('#coverSheetPaper').value,crop:$('#coverSheetCrop').checked,fit:$('#coverSheetFit').checked
  });
  modal(title,`<div class="cover-sheet-layout"><aside>
    ${printing ? `<label for="outPrinter">${w.printer}</label><div class="printer-row"><select id="outPrinter"></select><button id="refreshPrinters" type="button" class="btn">↻</button></div>
      ${control(w.copies,'coverSheetCopies',1,'number',1,99)}` : ''}
    <div class="control"><label for="coverSheetPaper">${w.paper}</label>
      <select id="coverSheetPaper">
        <option value="actual">${bw('Tamaño de la pieza','Artwork size','Tamanho da peça')}</option>
        ${['A3','A4','A5','Letter'].map(paper=>`<option value="${paper}" ${printing && paper==='A3'?'selected':''}>${paper}</option>`).join('')}
      </select>
    </div>
    <label class="check-line"><input id="coverSheetCrop" type="checkbox" checked>${w.trim}</label>
    <label class="check-line"><input id="coverSheetFit" type="checkbox">${w.fit}</label>
    <p class="help">${bw('La vista previa incluye el sangrado y la demasía. Si imprimís, revisá también el área imprimible del equipo.',
      'The preview includes bleed and wrap. Check your printer’s printable area before printing.',
      'A prévia inclui a sangria e a dobra. Antes de imprimir, confira a área imprimível do equipamento.')}</p>
    <p id="outputError" class="inline-error"></p>
    </aside><div><div id="coverSheetPreview"></div><p id="coverSheetSummary" class="help" aria-live="polite"></p></div></div>`,()=>{
    const options = config(), copies = printing ? Number($('#coverSheetCopies').value) : 1;
    const printer = printing ? $('#outPrinter').value : '';
    if (printing && !printer) throw Error(w.unavailable);
    if (!Number.isInteger(copies)||copies<1||copies>99) throw Error('1–99');
    if (coverOverflow(book.cover)) throw Error(bw('Hay texto que no cabe en la cubierta.','Some cover text does not fit.','Há texto que não cabe na capa.'));
    prepareOutput(options);
    clearPrint();
    $('#modal').close();
    void sendOutput(destination,{options,copies,printer,duplex:'one'});
    return false;
  },printing?w.send:w.save);
  const dialog = $('#modal');
  dialog.classList.add('cover-sheet-dialog');
  dialog.addEventListener('close',()=>dialog.classList.remove('cover-sheet-dialog'),{once:true});
  function refresh() {
    const box = $('#coverSheetPreview'), options = config();
    $('#outputError').textContent = '';
    try {
      const actual = prepareOutput({...options,paper:'actual'});
      const trial = prepareOutput({...options,fit:true});
      const sheet = $('#printRoot .print-page').cloneNode(true), px = 96/25.4;
      const k = Math.min((box.clientWidth-24)/(trial.width*px),(box.clientHeight-24)/(trial.height*px));
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style,{width:trial.width*px*k+'px',height:trial.height*px*k+'px'});
      Object.assign(sheet.style,{transform:`scale(${k})`,transformOrigin:'top left'});
      wrapper.append(sheet);
      box.replaceChildren(wrapper);
      $('#coverSheetSummary').textContent = sheetSizeStatus([actual.width,actual.height],[trial.width,trial.height],trial.scale);
      const tooLarge = !options.fit && trial.scale < .999;
      if (tooLarge) $('#outputError').textContent = bw('La simulación está reducida. Para exportarla así, activá la reducción o elegí una hoja mayor.', 'The simulation is scaled down. Enable shrinking or select a larger sheet to export.', 'A simulação está reduzida. Ative a redução ou escolha uma folha maior para exportar.');
      $('#modalApply').disabled = tooLarge;
    } catch (error) {
      box.replaceChildren();
      $('#outputError').textContent = error.message;
      $('#modalApply').disabled = true;
    } finally { clearPrint(); }
  }
  for (const id of ['coverSheetPaper','coverSheetCrop','coverSheetFit']) $('#'+id).onchange = refresh;
  if (printing) { $('#refreshPrinters').onclick = readPrinters; void readPrinters(); }
  refresh();
}
