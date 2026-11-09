// Pruebas de los roles de texto (src/roles.ts y components/inspector/RolePanel.tsx): sólo se
// cargan en la autoprueba (test-loader.js).

registerIntegrationTest(function (result) {
  const checks = result.checks,
    assert = (v, m) => {
      if (!v) throw Error(m);
      checks.push(m);
    };
  const ed = maquetarioEditor,
    original = M.clone(ed.book),
    previous = { active: ed.active, spread: ed.spread, selected: ed.selected };
  const change = (selector, value) => {
    const el = document.querySelector(selector);
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const select = (o, page = 0) => {
    ed.active = ed.spread = page;
    ed.selected = o.id;
    ed.paragraphScope = { id: o.id, index: -1 };
    showTab('text');
    render(false);
  };
  try {
    const b = ed.book,
      page = b.pages[0],
      first = page.objects.find((o) => o.type === 'text' && !o.toc);
    b.paragraphStyles = [];
    first.text = 'Uno\nDos\nTres';
    first.paragraphMap = [];
    // Otras dos cajas en la misma página para comparar.
    const second = M.text('Otra caja', 10, 150, 40, 20),
      third = M.text('Tercera caja', 60, 150, 40, 20);
    page.objects.push(second, third);
    const styleOf = (o, i = 0) =>
      b.paragraphStyles.find((s) => s.id === o.paragraphMap?.[i]?.styleId);

    select(first);
    assert(!!document.querySelector('#textRole'), 'Selección muestra el rol de la caja');
    change('#textRole', 'body');
    const body = b.paragraphStyles.find((s) => s.role === 'body');
    assert(
      body && body.name === 'Texto principal' && [0, 1, 2].every((i) => styleOf(first, i) === body),
      'Elegir un rol crea su estilo y vincula los párrafos de la caja',
    );
    select(second);
    change('#textRole', 'body');
    assert(
      b.paragraphStyles.length === 1 && styleOf(second) === body,
      'Otra caja con el mismo rol usa el mismo estilo',
    );

    // Un estilo que ya comparten los párrafos pasa a ser el del rol, sin cambiar el libro.
    b.paragraphStyles.push({ id: 'novela', name: 'Cuerpo de novela', properties: { size: 11 } });
    third.paragraphMap = [{ styleId: 'novela', overrides: {} }];
    select(third);
    change('#textRole', 'secondary-a');
    assert(
      b.paragraphStyles.length === 2 && styleOf(third).role === 'secondary-a',
      'El estilo que ya tenía la caja pasa a ser el del rol',
    );
    assert(
      [...document.querySelectorAll('#paragraphStyle option')].some((op) =>
        op.textContent.includes('Cuerpo de novela · Texto secundario A'),
      ),
      'La lista de estilos muestra el rol de cada estilo',
    );

    // ¿Sólo acá o en todo el rol?
    select(first);
    paragraphPatch({ size: 20 });
    assert(
      !!document.querySelector('[data-role-deviation]') &&
        document.querySelector('[data-role-deviation]').textContent.includes('cuerpo'),
      'Un cambio sobre un texto con rol pregunta si es sólo acá o en todo el rol',
    );
    document.querySelector('#roleApplyAll').click();
    assert(
      body.properties.size === 20 &&
        first.paragraphMap.every((m) => m.overrides.size === undefined) &&
        paragraphFormat(b, second, 0).size === 20,
      '"En todo el rol" cambia el rol y todas sus cajas',
    );
    assert(!document.querySelector('[data-role-deviation]'), 'Sin diferencias, no pregunta');
    paragraphPatch({ leading: 30 });
    document.querySelector('#roleBack').click();
    assert(
      first.paragraphMap.every((m) => !Object.keys(m.overrides).length) &&
        paragraphFormat(b, first, 0).leading === body.properties.leading,
      '"Volver al rol" quita los ajustes de acá',
    );

    // Ancho de caja en columnas del rol.
    change('#roleColumns', '2');
    const area = M.gridRect(b, 0),
      g = b.grid,
      column = (area.w - g.gapX * (g.cols - 1)) / g.cols;
    assert(
      body.columns === 2 && Math.abs(first.w - (2 * column + g.gapX)) < 0.05,
      'El ancho del rol en columnas ajusta la caja',
    );
    select(second);
    assert(
      !!document.querySelector('[data-role-columns-mismatch]'),
      'Otra caja del rol con otro ancho lo avisa',
    );
    document.querySelector('#roleFitColumns').click();
    assert(Math.abs(second.w - first.w) < 0.05, 'Ajustar la caja la lleva al ancho del rol');

    // Sin rol: se desvincula conservando el formato.
    select(first);
    change('#textRole', '');
    assert(
      !styleOf(first) && paragraphFormat(b, first, 0).size === 20,
      'Sacar el rol conserva el formato',
    );

    // Validación al abrir.
    const twice = M.clone(b);
    twice.paragraphStyles.push({ id: 'x', name: 'Otro', role: 'body', properties: {} });
    const bad = M.clone(b);
    bad.paragraphStyles[0].role = 'inventado';
    let rejected = 0;
    for (const project of [twice, bad])
      try {
        M.validate(project);
      } catch {
        rejected++;
      }
    assert(rejected === 2, 'Un rol repetido o desconocido no se abre');
    assert(!!M.validate(M.clone(b)), 'Un libro con roles válidos se valida');
  } finally {
    ed.book = original;
    Object.assign(ed, previous);
    ed.paragraphScope = { id: null, index: -1 };
    render(true);
  }
  return result;
}, 'roles-tests');
