// Excepciones por página: una marca junto al número de cada miniatura cuyo pliego tiene alguna
// página con un elemento automático (número, cornisa, titulillo) oculto. Qué se oculta en la página
// activa se elige en la pestaña Página del inspector (src/components/inspector/PagePanel.tsx).
//
// La marca es de la interfaz, no del libro: va en el rótulo de la miniatura (<small>, "1 - 2"), con
// el ícono eyeOff y el detalle como ayuda emergente y como texto para lectores de pantalla. Antes
// era un código ("#− C− T−") pintado sobre el papel de la miniatura (ui/book/page.css).
//
// No publica globales: se engancha con extend.after('thumbs'), después de review-workspace.ts, que
// numera las páginas de cada miniatura (data-individual-page).
//
// Fuente TypeScript: se compila a build/page-exceptions.js (desktop/scripts/build.mjs).

import { bw } from './i18n/language.ts';

/** Qué oculta una página, en el idioma actual ("Sin número · Sin cornisa"); vacío si nada. */
function hiddenParts(index: number): string {
  const p = book.pages[index];
  if (!p) return '';
  return [
    p.hideFolio ? bw('Sin número', 'No page number', 'Sem número') : '',
    p.hideHeader ? bw('Sin cornisa', 'No header', 'Sem cabeçalho') : '',
    p.hideTitle ? bw('Sin titulillo', 'No running title', 'Sem título corrente') : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Pone (o actualiza) la marca en cada miniatura. */
function markExceptions(): void {
  $$('#thumbnails .thumb').forEach((thumb) => {
    thumb.querySelector('.thumb-exception')?.remove();
    const hidden = [...thumb.querySelectorAll<HTMLElement>('.thumb-paper')].flatMap((paper) => {
      const index = Number(paper.dataset.individualPage),
        parts = hiddenParts(index);
      return parts ? [{ page: index + 1, parts }] : [];
    });
    const label = thumb.querySelector('small');
    if (!hidden.length || !label) return;
    // Las dos páginas del pliego con lo mismo oculto van juntas ("Páginas 1–2: …").
    const text =
      hidden.length === 2 && hidden[0].parts === hidden[1].parts
        ? `${bw('Páginas', 'Pages', 'Páginas')} ${hidden[0].page}–${hidden[1].page}: ${hidden[0].parts}`
        : hidden.map((h) => `${bw('Página', 'Page', 'Página')} ${h.page}: ${h.parts}`).join(' / ');
    const mark = document.createElement('span');
    mark.className = 'thumb-exception';
    mark.title = text;
    mark.innerHTML = icon('eyeOff');
    const spoken = document.createElement('span');
    spoken.className = 'thumb-exception-text';
    // Con un espacio adelante: se lee después del número ("1 - 2 Páginas 1–2: …").
    spoken.textContent = ' ' + text;
    mark.append(spoken);
    label.append(mark);
  });
}
extend.after('thumbs', markExceptions, 'page-exceptions');
// Al cambiar de idioma, la ayuda y el texto de la marca se vuelven a escribir sin redibujar la tira.
document.addEventListener('maquetario:language', markExceptions);

export {};
