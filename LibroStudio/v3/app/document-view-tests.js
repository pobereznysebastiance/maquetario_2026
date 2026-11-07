'use strict';
const beforeDocumentViewTests = window.runNavigationTests;
window.runNavigationTests = async function() {
  const report = await beforeDocumentViewTests();
  const check = (condition,message)=>{
    if (!condition) throw Error(message);
    report.checks.push(message);
  };
  const previous = {book,active,spread,selected,zoom,tab,dirty,continuousCanvas};
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  try {
    book = M.create();
    book.width=170;
    book.height=240;
    book.pages = Array.from({length:20},M.page);
    const title = M.text('Título',135,45,50,20);
    book.pages[0].objects=[title];
    active=spread=0;
    selected=title.id;
    render(true);
    const objectBefore = JSON.stringify(title);
    settingsNew(false);
    $('#pageUnits').value='cm';
    $('#pageUnits').dispatchEvent(new Event('change'));
    await $('#modalApply').onclick();
    check(documentUnit()==='cm' && book.width===170 && book.height===240 && JSON.stringify(title)===objectBefore,
      'Cambiar a cm conserva el tamaño real y los objetos');
    check(statusUnit.textContent.endsWith('cm') && M.validate(M.clone(book)).measurementUnit==='cm','La unidad aparece en el estado y queda en el proyecto');
    showTab('design');
    const margin = $('[data-bind="margins.top"]');
    check(nativeValue.get.call(margin)==='2' && margin.value==='20','El campo muestra centímetros y entrega milímetros al modelo');
    nativeValue.set.call(margin,'2.5');
    margin.dispatchEvent(new Event('change',{bubbles:true}));
    check(book.margins.top===25,'Editar en cm actualiza la longitud real en mm');
    coverEditor();
    check(nativeValue.get.call($('[data-cover-size="spine"]'))==='1.2','El lomo de 12 mm se muestra como 1,2 cm');
    $('#modal').close();
    await new Promise(resolve=>setTimeout(resolve,20));
    selected=null;
    continuousCanvas=true;
    render(true);
    check(continuousRows.length===10 && $$('#spread .page').length<20,'El lienzo recorre todos los pliegos y dibuja los cercanos');
    const target=continuousRows[4];
    canvasStage.scrollTop=canvasPadding+target.offset+(target.height-canvasStage.clientHeight)/2;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    check(!!$('#spread .page[data-page="8"]') && active===8,
      'Desplazarse revela y activa un pliego posterior ('+active+', '+canvasStage.scrollTop+' / '+target.offset+')');
    $$('#thumbnails .thumb')[1].click();
    check(active===2 && Math.abs(canvasStage.scrollTop+canvasStage.clientHeight/2-canvasPadding-continuousRows[1].offset-continuousRows[1].height/2)<3,
      'La miniatura salta al pliego correcto en la vista continua');
    book.paragraphStyles=[{id:'titulo',name:'Título',properties:{font:'Georgia',size:20,leading:24,align:'center'}}];
    title.paragraphMap=[{styleId:'titulo',overrides:{size:22}}];
    const rule=collectEditorialRules()[0];
    check(rule.style.name==='Título' && rule.format.size===22 && rule.count===1,'La hoja recoge el tamaño efectivamente aplicado');
    showTab('structure');
    $('#editorialRules').click();
    $('[data-editorial-role="titulo"]').value='Título principal';
    await $('#modalApply').onclick();
    check(book.editorialRoles.titulo==='Título principal','La función editorial se guarda en el proyecto');
    return report;
  } finally {
    if ($('#modal').open) $('#modal').close();
    ({book,active,spread,selected,zoom,tab,dirty,continuousCanvas}=previous);
    continuousKey=canvasSpreadKey='';
    render(true);
  }
};
