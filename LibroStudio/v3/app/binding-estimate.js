'use strict';

const coverBeforeBindingEstimate = coverEditor;
coverEditor = function() {
  coverBeforeBindingEstimate();
  const spine = $('[data-cover-size="spine"]');
  if (!spine) return;
  const estimate = document.createElement('details');
  estimate.className = 'binding-estimate';
  estimate.innerHTML = `
    <summary>${bw('Estimar grosor y lomo', 'Estimate thickness and spine', 'Estimar espessura e lombada')}</summary>
    <div class="modal-grid">
      <div class="control"><label for="bindingMethod">${bw('Encuadernación','Binding','Encadernação')}</label>
        <select id="bindingMethod">
          <option value="stapled">${bw('Abrochado al medio','Saddle stitch','Grampo central')}</option>
          <option value="flat">${bw('Lomo plano encolado','Perfect bound','Lombada quadrada colada')}</option>
        </select>
      </div>
      <div class="control"><label for="paperCaliper">${bw('Espesor de una hoja · µm','Paper caliper · µm','Espessura de uma folha · µm')}</label>
        <input id="paperCaliper" type="number" min="20" max="2000" step="1" placeholder="80">
      </div>
    </div>
    <p class="help">${bw('Usá el espesor de la ficha técnica. Si medís 10 hojas juntas en milímetros, multiplicá el resultado por 100 para obtener los µm de una hoja.','Use the manufacturer’s caliper. If you measure a stack of 10 sheets in millimeters, multiply by 100 for microns per sheet.','Use a espessura da ficha técnica. Se medir 10 folhas juntas em milímetros, multiplique por 100 para obter os µm de uma folha.')}</p>
    <p id="bindingResult" aria-live="polite"></p>
    <p id="bindingHint" class="help"></p>
    <button type="button" id="applyBindingSpine" class="btn" hidden></button>`;
  spine.closest('.cover-fields').after(estimate);
  const method = $('#bindingMethod'), caliper = $('#paperCaliper');
  const result = $('#bindingResult'), hint = $('#bindingHint'), apply = $('#applyBindingSpine');
  const format = number => new Intl.NumberFormat(LibroI18n.language,{maximumFractionDigits:documentUnit()==='cm'?3:2}).format(number);

  function refreshEstimate() {
    const stapled = method.value === 'stapled', pageCount = book.pages.length;
    const sheets = Math.ceil(pageCount / 4), blanks = sheets * 4 - pageCount;
    const leaves = stapled ? sheets * 2 : Math.ceil(pageCount / 2);
    const valid = caliper.value !== '' && caliper.validity.valid;
    const thickness = leaves * Number(caliper.value) / 1000;
    result.textContent = stapled
      ? bw(`${sheets} pliegos · ${blanks} páginas en blanco para completar la imposición`,
        `${sheets} sheets · ${blanks} blank pages added for imposition`,
        `${sheets} folhas · ${blanks} páginas em branco para completar a imposição`)
      : bw(`${leaves} hojas del interior`,`${leaves} interior leaves`,`${leaves} folhas do miolo`);
    if (valid) result.textContent += bw(` · Grosor teórico del interior ≈ ${format(thickness/(documentUnit()==='cm'?10:1))} ${documentUnit()}`,
      ` · Theoretical text block ≈ ${format(thickness/(documentUnit()==='cm'?10:1))} ${documentUnit()}`, ` · Espessura teórica do miolo ≈ ${format(thickness/(documentUnit()==='cm'?10:1))} ${documentUnit()}`);
    hint.textContent = stapled
      ? bw('Usá lomo de 0 mm para una cubierta abrochada al doblez. El grosor estimado excluye la cubierta y no predice cuánto sobresalen las hojas. Plegá una muestra con el papel final para medirlo.',
        'Use a 0 mm spine for a cover stapled through the fold. The estimate excludes the cover and does not predict creep. Fold a proof using the final paper to measure it.',
        'Use lombada de 0 mm para capa grampeada na dobra. A estimativa exclui a capa e não prevê o deslocamento. Dobre uma amostra com o papel final para medir.')
      : bw('Tomá esta medida como punto de partida. Confirmá el lomo final con la imprenta según el papel, el adhesivo y el acabado.',
        'Use this as a starting point. Confirm the final spine with your printer based on paper, adhesive and finishing.',
        'Use a medida como ponto de partida. Confirme a lombada final com a gráfica conforme o papel, a cola e o acabamento.');
    apply.hidden = !stapled && (!valid || thickness > Number(spine.max));
    apply.textContent = stapled
      ? bw('Usar doblez','Use fold','Usar dobra')+' · 0 '+documentUnit()
      : bw('Usar medida estimada', 'Use estimated width', 'Usar largura estimada');
    apply.onclick = () => {
      spine.value = stapled ? '0' : thickness.toFixed(2);
      spine.dispatchEvent(new Event('change',{bubbles:true}));
    };
  }
  method.addEventListener('change', refreshEstimate);
  caliper.addEventListener('input', refreshEstimate);
  refreshEstimate();
};
