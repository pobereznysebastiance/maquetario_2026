// Pruebas de src/inspector-organization.ts: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const prior = M.clone(book),
    check = (ok, msg) => {
      if (!ok) throw Error(msg);
      r.checks.push(msg);
    };
  try {
    showTab('design');
    check(!$('#inspectorContent [data-object="font"]'), 'Libro sin tipografía de cajas duplicada');
    check(
      !!$('#inspectorContent [data-bind="header.font"]'),
      'Cornisas conservan tipografía propia en Libro',
    );
    active = 0;
    selected = null;
    multiSelection.clear();
    showTab('text');
    check(
      !!$('#inspectorContent .inspector-empty') && !$('#inspectorContent .section'),
      'Selección sin nada elegido muestra el estado vacío',
    );
    selected = book.pages[0].objects.find((o) => o.type === 'text').id;
    showTab('text');
    check(
      !$('#inspectorContent [data-object="x"]') &&
        $$('#inspectorContent #alignReference').length === 1 &&
        !!$('#object-w'),
      'Selección de texto: una sola geometría y una sola alineación de objetos',
    );
    check(
      !!$('#inspectorContent [data-object="font"]') && !!$('.paragraph-panel'),
      'Selección de texto mantiene tipografía y párrafos',
    );
    const image = { id: M.uid(), type: 'frame', x: 10, y: 30, w: 20, h: 20 };
    book.pages[0].objects.push(image);
    selected = image.id;
    showTab('object');
    check(
      !!$('#object-w') && !!$('#alignReference') && !$('#inspectorContent .paragraph-panel'),
      'Selección de un marco: medidas y alineación, sin párrafos',
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
