'use strict';
registerNavigationTest(async function (result) {
  const check = (value, label) => {
    if (!value) throw Error(label);
    result.checks.push(label);
  };
  const original = {
    book: maquetarioEditor.book,
    active: maquetarioEditor.active,
    spread: maquetarioEditor.spread,
    selected: maquetarioEditor.selected,
    tab: maquetarioEditor.tab,
    dirty: maquetarioEditor.dirty,
  };
  try {
    maquetarioEditor.book = M.create();
    maquetarioEditor.active = maquetarioEditor.spread = 0;
    maquetarioEditor.selected = null;
    maquetarioEditor.book.folio.enabled = true;
    maquetarioEditor.book.folio.pos = 'outer';
    maquetarioEditor.book.folio.offsetX = 45;
    maquetarioEditor.book.folio.offsetY = 10;
    render(true);
    for (const page of [0, 1]) {
      const folio = autoElement(page, 'folio', 1, true);
      const x = parseFloat(folio.style.left),
        half = parseFloat(folio.style.width) / 2;
      const margins = M.margins(maquetarioEditor.book, page);
      check(
        page === 0
          ? x + half <= margins.left + 0.01
          : x - half >= maquetarioEditor.book.width - margins.right - 0.01,
        'El folio lateral queda fuera del área de texto en página ' + (page + 1),
      );
    }
    showTab('design');
    const slider = $('.folio-placement input[type=range][aria-label^="Vertical"]');
    slider.value = '20';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    check(
      maquetarioEditor.book.folio.offsetY === 10 &&
        parseFloat($('#spread .auto-folio').style.top) >
          maquetarioEditor.scale * (maquetarioEditor.book.height / 2 + 19.9),
      'El deslizador previsualiza el desplazamiento sin grabar durante el arrastre',
    );
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    check(
      maquetarioEditor.book.folio.offsetY === 20,
      'Soltar el deslizador guarda el desplazamiento',
    );
    refreshCategoryTabs();
    if (!moreCategories.hidden) {
      moreCategories.click();
      const option = [...categoryMenu.querySelectorAll('button')].find((button) =>
        /capas|layers|camadas/i.test(button.textContent),
      );
      check(!!option, 'Capas queda accesible desde el menú de categorías');
      option.click();
      check(
        maquetarioEditor.tab === 'layers' && categoryMenu.hidden,
        'Una categoría del menú abre el panel correcto',
      );
    }
    const rules = collectEditorialRules();
    check(
      rules.length > 0 && rules[0].examples.length > 0 && rules[0].columns.size > 0,
      'La pauta vincula las variantes con sus cajas y grillas reales',
    );
    return result;
  } finally {
    closeCategoryMenu();
    ({
      book: maquetarioEditor.book,
      active: maquetarioEditor.active,
      spread: maquetarioEditor.spread,
      selected: maquetarioEditor.selected,
      tab: maquetarioEditor.tab,
      dirty: maquetarioEditor.dirty,
    } = original);
    render(true);
  }
}, 'category-tests');
