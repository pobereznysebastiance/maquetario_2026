// Pruebas de frame-handles.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (result) {
  const checks = result.checks,
    assert = (v, m) => {
      if (!v) throw Error(m);
      checks.push(m);
    };
  const rect = { x: 20, y: 30, w: 70, h: 90 },
    bounds = { width: 148, height: 210 };
  for (const direction of frameDirections) {
    const resized = frameGeometry(rect, direction, 5, 6, bounds);
    assert(resized.w >= 3 && resized.h >= 3, 'Controlador ' + direction + ' válido');
    if (!direction.includes('n') && !direction.includes('s'))
      assert(
        resized.y === rect.y && resized.h === rect.h,
        'Control lateral conserva altura ' + direction,
      );
    if (!direction.includes('e') && !direction.includes('w'))
      assert(
        resized.x === rect.x && resized.w === rect.w,
        'Control vertical conserva ancho ' + direction,
      );
    if (direction.includes('w'))
      assert(resized.x + resized.w === rect.x + rect.w, 'Borde opuesto fijo ' + direction);
    if (direction.includes('n'))
      assert(resized.y + resized.h === rect.y + rect.h, 'Borde inferior fijo ' + direction);
  }
  const min = frameGeometry(rect, 'nw', 1000, 1000, bounds),
    max = frameGeometry(rect, 'se', 1000, 1000, bounds);
  assert(min.w === 3 && min.h === 3, 'Tamaño mínimo de caja');
  assert(max.x + max.w === 148 && max.y + max.h === 210, 'Caja limitada a la página');
  const original = M.clone(maquetarioEditor.book),
    previousActive = maquetarioEditor.active,
    previousSpread = maquetarioEditor.spread,
    previousSelected = maquetarioEditor.selected;
  maquetarioEditor.active = maquetarioEditor.spread = 0;
  maquetarioEditor.selected = maquetarioEditor.book.pages[0].objects.find(
    (o) => o.type === 'text',
  ).id;
  renderPages();
  assert(
    $$('#spread .paper-object.selected > .frame-handle').length === 8,
    'Ocho controladores visibles en la caja',
  );
  const o = selectObject(),
    oldSize = o.size,
    oldText = o.text;
  Object.assign(
    o,
    frameGeometry(o, 'e', 20, 0, {
      width: maquetarioEditor.book.width,
      height: maquetarioEditor.book.height,
    }),
  );
  assert(o.size === oldSize && o.text === oldText, 'Redimensionar conserva cuerpo y contenido');
  const printed = paper(0, 96 / 25.4, true);
  assert(!printed.querySelector('.frame-handle'), 'Los controladores no se imprimen');
  // Escape a mitad de un redimensionado: vuelve al tamaño de antes, sigue elegida y sin arrastre.
  // Parte de una caja chica conocida: otra prueba pudo dejarla pegada al borde de la página, y
  // entonces no crecería al arrastrar.
  const box = selectObject();
  Object.assign(box, { x: 20, y: 20, w: 30, h: 30 });
  renderPages();
  const before = { x: box.x, y: box.y, w: box.w, h: box.h },
    el = $(`#spread .paper-object[data-id="${box.id}"]`),
    undoDepth = maquetarioEditor.undoStack.length,
    pointer = { button: 0, pointerId: 1, clientX: 100, clientY: 100 };
  el.setPointerCapture = el.releasePointerCapture = () => {};
  el.hasPointerCapture = () => false;
  objectDown(
    { ...pointer, stopPropagation() {}, preventDefault() {} },
    box,
    maquetarioEditor.active,
    el,
    'se',
  );
  try {
    moveObject({ ...pointer, clientX: 160, clientY: 150 });
    assert(
      box.w > before.w && !!maquetarioEditor.drag,
      'Redimensionar agranda la caja mientras se arrastra',
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  } finally {
    // Si algo falla, que el arrastre no quede abierto para las pruebas siguientes.
    if (maquetarioEditor.drag)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
  assert(
    !maquetarioEditor.drag &&
      box.x === before.x &&
      box.y === before.y &&
      box.w === before.w &&
      box.h === before.h &&
      maquetarioEditor.selected === box.id &&
      maquetarioEditor.undoStack.length === undoDepth,
    'Escape cancela el redimensionado: tamaño de antes, caja elegida y sin paso de deshacer',
  );
  maquetarioEditor.book = original;
  maquetarioEditor.active = previousActive;
  maquetarioEditor.spread = previousSpread;
  maquetarioEditor.selected = previousSelected;
  render(true);
  return result;
}, 'frame-handles');
