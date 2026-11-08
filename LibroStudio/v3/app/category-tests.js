'use strict';
registerNavigationTest(async function(result){
  const check = (value,label)=>{if(!value) throw Error(label);result.checks.push(label);};
  const original = {book,active,spread,selected,tab,dirty};
  try {
    book = M.create();
    active = spread = 0;
    selected = null;
    book.folio.enabled = true;
    book.folio.pos = 'outer';
    book.folio.offsetX = 45;
    book.folio.offsetY = 10;
    render(true);
    for (const page of [0,1]) {
      const folio = autoElement(page,'folio',1,true);
      const x = parseFloat(folio.style.left), half = parseFloat(folio.style.width)/2;
      const margins = M.margins(book,page);
      check(page===0 ? x+half<=margins.left+.01 : x-half>=book.width-margins.right-.01,
        'El folio lateral queda fuera del área de texto en página '+(page+1));
    }
    showTab('design');
    const slider = $('.folio-placement input[type=range][aria-label^="Vertical"]');
    slider.value='20';
    slider.dispatchEvent(new Event('input',{bubbles:true}));
    check(book.folio.offsetY===10 && parseFloat($('#spread .auto-folio').style.top)>scale*(book.height/2+19.9),
      'El deslizador previsualiza el desplazamiento sin grabar durante el arrastre');
    slider.dispatchEvent(new Event('change',{bubbles:true}));
    check(book.folio.offsetY===20,'Soltar el deslizador guarda el desplazamiento');
    refreshCategoryTabs();
    if (!moreCategories.hidden) {
      moreCategories.click();
      const option = [...categoryMenu.querySelectorAll('button')].find(button=>/capas|layers|camadas/i.test(button.textContent));
      check(!!option,'Capas queda accesible desde el menú de categorías');
      option.click();
      check(tab==='layers' && categoryMenu.hidden,'Una categoría del menú abre el panel correcto');
    }
    const rules = collectEditorialRules();
    check(rules.length>0 && rules[0].examples.length>0 && rules[0].columns.size>0,'La pauta vincula las variantes con sus cajas y grillas reales');
    return result;
  } finally {
    closeCategoryMenu();
    ({book,active,spread,selected,tab,dirty}=original);
    render(true);
  }
},'category-tests');

window.prepareFolioPositionPreview = function() {
  window.prepareNavigationPreview();
  book.folio.pos='outer';
  book.pages[active].hideFolio=false;
  selected=null;
  showTab('design');
  render(true);
  $('[data-bind="folio.pos"]').closest('.section').scrollIntoView({block:'nearest'});
};
window.prepareTypographyGuidePreview = function() {
  if ($('#modal').open) $('#modal').close();
  editorialRulesDialog();
};
