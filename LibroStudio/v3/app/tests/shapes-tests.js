// Pruebas de shapes.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const prior = M.clone(maquetarioEditor.book),
    check = (v, msg) => {
      if (!v) throw Error(msg);
      r.checks.push(msg);
    };
  try {
    check(!!$('#shapeTool'), 'Herramienta Figuras visible');
    maquetarioEditor.active = 0;
    for (const kind of Object.keys(shapeNames)) {
      shapeKind = kind;
      const o = newShape(20, 30, 60, 40);
      maquetarioEditor.book.pages[0].objects.push(o);
      maquetarioEditor.selected = o.id;
      const output = paper(0, 2, true),
        el = output.querySelector(`[data-id="${o.id}"]`);
      check(
        !!el?.querySelector('.editorial-shape-svg') && !el.classList.contains('frame'),
        'Figura vectorial visible en salida: ' + kind,
      );
      check(
        M.validate(JSON.parse(JSON.stringify(maquetarioEditor.book))).pages[0].objects.some(
          (item) => item.id === o.id && item.shape === kind,
        ),
        'Figura guardada: ' + kind,
      );
    }
    showTab('object');
    check(
      !!$('[data-shape-prop="fill"]') && !!$('[data-shape-prop="stroke"]'),
      'Controles de relleno y trazo en Objeto',
    );
    const o = selectObject();
    $('[data-shape-prop="strokeWidth"]').value = '1.2';
    $('[data-shape-prop="strokeWidth"]').dispatchEvent(new Event('change'));
    check(o.strokeWidth === 1.2, 'Grosor de trazo editable');
    $('#shapeSwapColors').click();
    check(o.stroke === '#D8EBE5', 'Intercambio de relleno y trazo');
  } finally {
    maquetarioEditor.book = prior;
    maquetarioEditor.selected = null;
    shapeKind = 'rect';
    showTab('design');
    render(true);
  }
  return r;
}, 'shapes');
