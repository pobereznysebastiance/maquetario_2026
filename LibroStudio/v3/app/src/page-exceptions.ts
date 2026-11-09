// Excepciones por página: una marca en las miniaturas de las páginas que tienen algún elemento
// automático (número, cornisa, titulillo) oculto. Qué se oculta en la página activa se elige en la
// pestaña Página del inspector (src/components/inspector/PagePanel.tsx).
//
// No publica globales: se engancha con extend.after('thumbs').
//
// Fuente TypeScript: se compila a build/page-exceptions.js (desktop/scripts/build.mjs).

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

export {};
