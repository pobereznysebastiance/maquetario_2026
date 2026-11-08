// Pruebas de layout-tools.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (result) {
  const check = (ok, msg) => {
    if (!ok) throw Error(msg);
    result.checks.push(msg);
  };
  let test = M.create(),
    lines = snapLines(test, 0),
    r = { x: 20, y: 30, w: 32.86666667, h: 40 };
  let out = snappedFrame(r, 'e', lines, 0.8, { width: 148, height: 210 });
  check(
    Math.abs(out.rect.x + out.rect.w - lines.x.find((x) => Math.abs(x - 52.86666667) < 0.8)) < 1e-6,
    'Imán ajusta al borde de columna',
  );
  out = snappedFrame({ x: 20.4, y: 40.3, w: 50, h: 40 }, false, lines, 0.8, {
    width: 148,
    height: 210,
  });
  check(out.rect.x === 20 && out.rect.w === 50, 'Imán mueve sin cambiar dimensiones');
  out = snappedFrame({ x: 20, y: 40, w: 15, h: 25 }, 'e', lines, 0.01, { width: 148, height: 210 });
  check(out.rect.w === 15, 'Imán no actúa fuera de tolerancia');
  const original = M.clone(book),
    o = book.pages[0].objects[0];
  o.hidden = true;
  check(!paper(0, 1, true).querySelector(`[data-id="${o.id}"]`), 'Capas ocultas no se imprimen');
  o.hidden = false;
  o.locked = true;
  selected = o.id;
  check(
    !paper(0, 1, false).querySelector(`[data-id="${o.id}"] .frame-handle`),
    'Capas bloqueadas no tienen controladores',
  );
  book = original;
  selected = null;
  render(true);
  return result;
}, 'layout-tools');
