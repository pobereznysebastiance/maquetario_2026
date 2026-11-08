// Pruebas de inspector-organization.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const prior = M.clone(book),
    check = (ok, msg) => {
      if (!ok) throw Error(msg);
      r.checks.push(msg);
    };
  try {
    showTab('design');
    check(!$('#inspectorContent [data-object="font"]'), 'Diseño sin tipografía de cajas duplicada');
    check(
      !!$('#inspectorContent [data-bind="header.font"]'),
      'Cornisas conservan tipografía propia en Diseño',
    );
    showTab('text');
    check(
      !$('#inspectorContent [data-object="x"]') && !$('#alignReference'),
      'Texto sin geometría ni alineación de objetos',
    );
    check(
      !!$('#inspectorContent [data-object="font"]') && !!$('.paragraph-panel'),
      'Texto mantiene tipografía y párrafos',
    );
    active = 0;
    const image = { id: M.uid(), type: 'frame', x: 10, y: 30, w: 20, h: 20 };
    book.pages[0].objects.push(image);
    selected = image.id;
    showTab('object');
    check(
      !!$('#object-w') && !!$('#alignReference'),
      'Objeto ofrece medidas y alineación para marcos',
    );
    $('#object-w').value = '25';
    $('#object-w').dispatchEvent(new Event('change'));
    check(image.w === 25, 'Cambiar ancho desde Objeto funciona');
    $('#objectLocked').checked = true;
    $('#objectLocked').dispatchEvent(new Event('change'));
    check(image.locked && $('#object-w').disabled, 'Objeto bloqueado impide cambiar dimensiones');
    const a = M.text('A', 10, 10, 10, 10),
      b = M.text('B', 32, 10, 10, 10),
      c = M.text('C', 70, 10, 10, 10);
    book.pages[0].objects.push(a, b, c);
    multiSelection = new Set([a.id, b.id, c.id]);
    selected = b.id;
    distributeObjects('x');
    check(Math.abs(b.x - 40) < 1e-6, 'Distribución iguala los espacios entre objetos');
  } finally {
    book = prior;
    selected = null;
    multiSelection.clear();
    showTab('design');
    render(true);
  }
  return r;
}, 'inspector-organization');
