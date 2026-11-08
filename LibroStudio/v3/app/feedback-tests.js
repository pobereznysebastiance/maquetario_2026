'use strict';

registerNavigationTest(async function(result){
  const check = (condition, message) => {
    if (!condition) throw Error(message);
    result.checks.push(message);
  };
  const prior = {book, active, spread, selected, zoom, tab, dirty, tool};
  const wasLarge = document.body.classList.contains('ui-large');
  try {
    book = M.create();
    book.pages = Array.from({length:50}, M.page);
    active = spread = 0;
    selected = null;
    render(true);
    settingsNew(false);
    $('#spreadArrangement').value = 'vertical';
    await $('#modalApply').onclick();
    const [top,bottom] = $$('#spread .page').map(el => el.getBoundingClientRect());
    check(bottom.top >= top.bottom && Math.abs(bottom.left - top.left) < 1, 'El pliego vertical coloca una página debajo de la otra');
    check(M.validate(M.clone(book)).spreadDirection === 'vertical', 'El pliego vertical se guarda en el proyecto');

    showTab('design');
    const selector = '[data-bind="grid.cols"]';
    $(selector).focus();
    for (let i=0;i<2;i++) document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
    check(book.grid.cols === 5 && document.activeElement === $(selector), 'Las flechas cambian el valor consecutivamente sin perder el foco');
    document.activeElement.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));
    check(book.grid.cols === 4, 'La rueda modifica el campo numérico enfocado');

    const clipboard = new DataTransfer();
    clipboard.setData('text/plain','<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><path fill="#3CD1BB" d="M0 0h80v40H0z"/></svg>');
    document.activeElement.blur();
    $('#spread').dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));
    for(let i=0;i<30 && !book.pages[0].objects.length;i++) await new Promise(resolve=>setTimeout(resolve,20));
    check(book.pages[0].objects[0]?.src.startsWith('data:image/svg+xml;base64,'), 'Pegar SVG coloca un objeto vectorial');
    const drop = new DataTransfer();
    drop.items.add(new File([clipboard.getData('text/plain')],'Prueba.svg',{type:'image/svg+xml'}));
    const target = $('#spread .page[data-page="1"]'), rect = target.getBoundingClientRect();
    target.dispatchEvent(new DragEvent('drop',{dataTransfer:drop,clientX:rect.left+10,clientY:rect.top+10,bubbles:true,cancelable:true}));
    for(let i=0;i<30 && !book.pages[1].objects.length;i++) await new Promise(resolve=>setTimeout(resolve,20));
    check(book.pages[1].objects.length === 1 && active === 1, 'Soltar una imagen la coloca en la página bajo el puntero');

    const config = {mode:'booklet',paper:'book',fit:false,crop:true,staples:true};
    const info = prepareOutput(config);
    const dots = $$('#printRoot .output-sheet:first-of-type .fold-marks circle');
    check(info.width === 162 && info.height === 434 && info.faces === 26, 'El PDF vertical une las páginas y completa los pliegos');
    check(dots.length === 2 && dots[0].getAttribute('cy') === '217' && dots[1].getAttribute('cy') === '217', 'El doblez horizontal lleva dos puntos de abrochado');
    prepareOutput({...config,mode:'reading'});
    check(!$('#printRoot .fold-marks'), 'El PDF de páginas individuales excluye marcas del doblez');
    clearPrint();

    coverEditor();
    $('#paperCaliper').value = '80';
    $('#paperCaliper').dispatchEvent(new Event('input'));
    check($('#bindingResult').textContent.includes('13') && /2[,.]08/.test($('#bindingResult').textContent), '50 páginas en papel de 80 µm dan 13 pliegos y 2,08 mm de grosor teórico');
    $('#applyBindingSpine').click();
    check(coverDraft.spine === 0, 'El abrochado configura una cubierta sin ancho de lomo');
    $('#bindingMethod').value = 'flat';
    $('#bindingMethod').dispatchEvent(new Event('change'));
    $('#applyBindingSpine').click();
    check(coverDraft.spine === 2, 'El lomo plano aplica la medida estimada al borrador de cubierta');
    $('#modal').close();

    setReadability('standard');
    const label = $('.tools .tool');
    const normal = label.getBoundingClientRect().height;
    setReadability('large');
    check(label.getBoundingClientRect().height > normal && parseFloat(getComputedStyle($('#inspectorContent')).zoom) > 1, 'La escala grande amplía herramientas e inspector');
    startTutorial(0);
    check(spotlight.style.display !== 'none' && Number(spotlight.querySelector('rect').getAttribute('width')) > 0, 'El tutorial ilumina el objetivo y oscurece el entorno');
    closeTutorial();
    check(spotlight.style.display === 'none', 'Al cerrar el tutorial se recupera la iluminación');
    return result;
  } finally {
    closeTutorial();
    if ($('#modal').open) $('#modal').close();
    clearPrint();
    ({book, active, spread, selected, zoom, tab, dirty, tool} = prior);
    setReadability(wasLarge ? 'large' : 'standard');
    render(true);
  }
},'feedback-tests');
