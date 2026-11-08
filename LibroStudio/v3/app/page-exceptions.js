'use strict';
decorateInspector(() => {
  if (tab !== 'pages') return;
  const host = $('#inspectorContent'),
    page = book.pages[active];
  host.querySelector('.active-page-notice')?.remove();
  host.querySelectorAll('input[data-page]').forEach((input) => input.closest('label')?.remove());
  const section = document.createElement('section');
  section.className = 'section individual-page-settings';
  section.innerHTML = `<div class="section-heading active-page-notice">${icon('pages')} <strong>${bw('Página', 'Page', 'Página')} ${active + 1}</strong></div><span class="page-only-tag">${bw('SOLO ESTA PÁGINA', 'THIS PAGE ONLY', 'SOMENTE ESTA PÁGINA')}</span><p class="help">${bw('Elegí qué elementos automáticos aparecen en la página seleccionada. Las demás no se modifican.', 'Choose which automatic elements appear on the selected page. Other pages are unchanged.', 'Escolha quais elementos automáticos aparecem na página selecionada. As demais não mudam.')}</p>${[
    [
      'hideFolio',
      bw('Mostrar número de página', 'Show page number', 'Mostrar número da página'),
      'folio',
    ],
    ['hideHeader', bw('Mostrar cornisa', 'Show running header', 'Mostrar cabeçalho'), 'header'],
    [
      'hideTitle',
      bw('Mostrar titulillo', 'Show running title', 'Mostrar título corrente'),
      'titulillo',
    ],
  ]
    .map(
      ([key, label, global]) =>
        `<label class="check-line page-visibility-control"><input type="checkbox" data-page-visible="${key}" ${page[key] ? '' : 'checked'}><span>${label}${!book[global].enabled ? `<small>${bw('Desactivado en todo el libro desde Diseño.', 'Disabled for the whole book in Design.', 'Desativado no livro inteiro em Design.')}</small>` : ''}</span></label>`,
    )
    .join(
      '',
    )}<div class="page-action"><button type="button" class="btn" id="pageHideAutomatic">${bw('Ocultar los tres', 'Hide all three', 'Ocultar os três')}</button><button type="button" class="btn" id="pageShowAutomatic">${bw('Mostrar los tres', 'Show all three', 'Mostrar os três')}</button></div><p class="help">${bw('Ocultar un número no elimina la página ni reinicia la numeración. Para ver un elemento, también debe estar activado globalmente en Diseño.', 'Hiding a number does not remove the page or restart numbering. To display an element, it must also be globally enabled in Design.', 'Ocultar um número não remove a página nem reinicia a numeração. Para mostrar um elemento, ele também deve estar ativado em Design.')}</p>`;
  host.prepend(section);
  section
    .querySelectorAll('[data-page-visible]')
    .forEach(
      (input) =>
        (input.onchange = () =>
          commit(() => (book.pages[active][input.dataset.pageVisible] = !input.checked), true)),
    );
  $('#pageHideAutomatic').onclick = () =>
    commit(() => {
      const p = book.pages[active];
      p.hideFolio = p.hideHeader = p.hideTitle = true;
    }, true);
  $('#pageShowAutomatic').onclick = () =>
    commit(() => {
      const p = book.pages[active];
      p.hideFolio = p.hideHeader = p.hideTitle = false;
    }, true);
}, 'page-exceptions');
extend.after(
  'thumbs',
  function () {
    $$('.thumb-paper').forEach((el) => {
      el.querySelector('.page-exception-mark')?.remove();
      const index = Number(el.dataset.individualPage),
        p = book.pages[index];
      if (!p || (!p.hideFolio && !p.hideHeader && !p.hideTitle)) return;
      const mark = document.createElement('span');
      mark.className = 'page-exception-mark';
      mark.textContent = [
        p.hideFolio ? '#−' : '',
        p.hideHeader ? 'C−' : '',
        p.hideTitle ? 'T−' : '',
      ]
        .filter(Boolean)
        .join(' ');
      mark.title = [
        p.hideFolio ? bw('Sin número', 'No page number', 'Sem número') : '',
        p.hideHeader ? bw('Sin cornisa', 'No header', 'Sem cabeçalho') : '',
        p.hideTitle ? bw('Sin titulillo', 'No running title', 'Sem título corrente') : '',
      ]
        .filter(Boolean)
        .join(' · ');
      el.append(mark);
    });
  },
  'page-exceptions',
);
