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
  const original = M.clone(book),
    previousActive = active,
    previousSpread = spread,
    previousSelected = selected;
  active = spread = 0;
  selected = book.pages[0].objects.find((o) => o.type === 'text').id;
  renderPages();
  assert(
    $$('#spread .paper-object.selected > .frame-handle').length === 8,
    'Ocho controladores visibles en la caja',
  );
  const o = selectObject(),
    oldSize = o.size,
    oldText = o.text;
  Object.assign(o, frameGeometry(o, 'e', 20, 0, { width: book.width, height: book.height }));
  assert(o.size === oldSize && o.text === oldText, 'Redimensionar conserva cuerpo y contenido');
  const printed = paper(0, 96 / 25.4, true);
  assert(!printed.querySelector('.frame-handle'), 'Los controladores no se imprimen');
  book = original;
  active = previousActive;
  spread = previousSpread;
  selected = previousSelected;
  render(true);
  return result;
}, 'frame-handles');
