// Pruebas de output-review.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const check = (v, m) => {
    if (!v) throw Error(m);
    r.checks.push(m);
  };
  outputDialog('pdf');
  check(
    !!$('.output-review-layout') && !!$('#outputReviewZoom'),
    'Revisión amplia con opciones laterales y zoom',
  );
  const box = $('#outputPreview').getBoundingClientRect();
  check(box.height > 350 && box.width > 450, 'Área de revisión mayor a 450 × 350 px');
  $('#outputReviewZoom').value = '2';
  $('#outputReviewZoom').dispatchEvent(new Event('change'));
  check(
    $('#outputPreview .output-sheet').style.transform === 'scale(2)',
    'Zoom 200% en revisión de salida',
  );
  $('#outputReviewExpand').click();
  check($('#modal').classList.contains('preview-expanded'), 'Revisión ampliada oculta opciones');
  $('#reviewNext').click();
  check($('#reviewFaceInput').value === '2', 'Navegación conserva zoom y revisión ampliada');
  $('#modal').close();
  return r;
}, 'output-review');
