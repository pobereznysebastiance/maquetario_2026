'use strict';

registerNavigationTest(async function(report){
  const verify = (condition,message) => {
    if (!condition) throw Error(message);
    report.checks.push(message);
  };
  const previous = {book,active,spread,selected,dirty};
  try {
    book = M.create();
    book.width = book.height = 200;
    active = spread = 0;
    const text = M.text('Maquetación extraordinaria',10,30,45,50);
    text.paragraphMap = [{overrides:{hyphenate:true,hyphenLanguage:'es',align:'justify'}}];
    book.pages[0].objects = [text];
    selected = text.id;
    render(true);
    const paragraph = $('#spread .mqt-paragraph');
    verify(paragraph.textContent.includes('\u00ad') && !text.text.includes('\u00ad'), 'La composición separa palabras sin alterar el manuscrito');
    verify(paper(0,4,true).querySelector('.mqt-paragraph').textContent === paragraph.textContent,'El PDF usa la misma separación silábica');
    showTab('text');
    verify($('#paragraphHyphenEnabled').checked,'El control muestra la separación activa');
    $('#paragraphHyphenEnabled').click();
    verify(!$('#spread .mqt-paragraph').textContent.includes('\u00ad'),'La separación se puede apagar por caja');
    const output = outputGeometry({mode:'spreads',paper:'A3',fit:false});
    verify(output.width===420 && output.height===297 && output.ratio===1,'El pliego de 400 × 200 entra al 100 % en A3');
    book.cover = defaultCover();
    coverEditor();
    $('[data-flap="leftFlap"]').click();
    $('[data-flap="rightFlap"]').click();
    verify(coverGeometry(coverDraft).parts.map(p=>p.id).join(',')==='back,spine,front','Se pueden desactivar las dos solapas sin borrar sus diseños');
    $('#coverWrap').value='15';
    $('#coverWrap').dispatchEvent(new Event('change'));
    book.cover = M.clone(coverDraft);
    $('#modal').close();
    await new Promise(resolve=>setTimeout(resolve,20));
    coverOutputDialog();
    $('#coverSheetPaper').value = 'A3';
    $('#coverSheetPaper').dispatchEvent(new Event('change'));
    verify(!!$('#coverSheetPreview .print-page') && $('#modalApply').disabled,'La cubierta muestra una simulación y avisa si A3 no alcanza');
    $('#coverSheetFit').click();
    verify(!$('#modalApply').disabled,'Aceptar reducción habilita salida de cubierta en A3');
    const exact = prepareOutput({kind:'cover',paper:'actual',crop:true});
    verify(exact.width===462 && exact.height===250,'El PDF de cubierta reserva demasía, sangrado y margen de marcas');
    return report;
  } finally {
    if ($('#modal').open) $('#modal').close();
    clearPrint();
    ({book,active,spread,selected,dirty}=previous);
    render(true);
  }
},'package-proof-tests');

window.preparePackageProof = function(faceId) {
  book = M.create();
  book.title = 'Prueba de paquete';
  book.pages = book.pages.slice(0,2);
  book.pages[0].objects = [
    {...M.text('Texto de prueba',20,20,80,25),font:'DM Sans',fontFaceId:faceId},
    {id:M.uid(),type:'image',x:20,y:60,w:30,h:30,src:'data:image/svg+xml;base64,'+
      btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>')}
  ];
  book.cover = defaultCover();
  return JSON.stringify({project:JSON.stringify(book),copyFonts:true,fonts:{[faceId]:'DM Sans Regular'}});
};
