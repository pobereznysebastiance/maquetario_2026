// Editorial: la vista Índice del riel (tabla de contenidos dibujada en el papel y en el PDF), los
// controles extra de texto (tracking, sangría, espacio entre párrafos, glifos) y las guías
// individuales del libro. Agrega el botón Índice a la barra de herramientas.
//
// ensureToc es global porque la usa tests/editorial-tests.js; prepareIndexPrint, porque la
// llama la autoprueba (desktop/src/main/selftest.ts).
//
// La envoltura de inspector (extend.around) tiene que registrarse después de la de
// inspector-registry, para quedar por fuera: index.html carga este archivo justo después.
//
// Fuente TypeScript: se compila a build/editorial.js (desktop/scripts/build.mjs).
'use strict';
import type { BookObject, TocConfig } from './model.ts';

declare global {
  /** Configuración del índice del libro; la crea con los valores por defecto si no existe. */
  var ensureToc: () => TocConfig;
  /** Prepara la impresión de prueba con un índice en la tercera página (autoprueba). */
  var prepareIndexPrint: () => void;
}

function ensureToc(): TocConfig {
  if (!book.toc) book.toc = M.clone(M.tocConfig(book));
  return book.toc;
}
globalThis.ensureToc = ensureToc;
function tocPanel(): string {
  const config = M.tocConfig(book),
    entries = M.tocEntries(book),
    o = selectObject();
  return (
    section(
      'Índice del libro',
      'pages',
      `<p class="help">Generá una tabla de contenidos con secciones, títulos marcados y entradas propias. Los folios se actualizan automáticamente.</p><div class="sub-label" id="tocTitleLabel">Título del índice</div><input id="tocTitle" aria-labelledby="tocTitleLabel" class="field-full" maxlength="250" value="${esc(config.title)}"><label class="check-line"><input id="tocSections" type="checkbox" ${config.includeSections ? 'checked' : ''}> Incluir comienzos de sección</label><label class="check-line"><input id="tocHeadings" type="checkbox" ${config.includeHeadings ? 'checked' : ''}> Incluir títulos marcados</label><button class="btn wide" id="markHeading" ${!o || o.type !== 'text' || o.toc ? 'disabled' : ''}>${o?.heading ? 'Quitar título del índice' : 'Marcar texto como título'}</button><button class="btn wide primary" id="insertToc">${icon('plus')} Colocar índice en página activa</button><p class="help">La tabla se actualiza también en el PDF. Si el contenido no entra, ampliá la caja o reducí el cuerpo.</p>`,
    ) +
    section(
      'Entradas del índice',
      'pages',
      `<div class="toc-list">${entries.length ? entries.map((e) => `<div class="toc-entry"><span class="user-content">${esc(e.label)}</span><strong>${esc(e.folio)}</strong>${e.source === 'manual' ? `<button class="icon-btn" data-remove-entry="${e.id}" aria-label="Quitar entrada">${icon('close')}</button>` : ''}</div>`).join('') : '<p class="help">Todavía no hay entradas. Marcá un título o definí una sección.</p>'}</div><button class="btn wide" id="addTocEntry">${icon('plus')} Agregar entrada manual</button>`,
    )
  );
}
// La pestaña Índice dibuja su propio panel; las otras suman controles al final. Va por fuera de
// toda la cadena del inspector (se registra después de la envoltura de inspector-registry).
extend.around(
  'inspector',
  (draw) =>
    function () {
      if (tab !== 'index') {
        draw();
        if (tab === 'text') extraTextControls();
        if (tab === 'design') extraGuideControls();
        return;
      }
      const host = $('#inspectorContent'),
        scroll = host.scrollTop;
      host.innerHTML = tocPanel();
      host.scrollTop = scroll;
      $('#tocTitle').onchange = (e) =>
        commit(() => (ensureToc().title = (e.target as HTMLInputElement).value), false);
      $('#tocSections').onchange = (e) =>
        commit(() => (ensureToc().includeSections = (e.target as HTMLInputElement).checked), false);
      $('#tocHeadings').onchange = (e) =>
        commit(() => (ensureToc().includeHeadings = (e.target as HTMLInputElement).checked), false);
      $('#markHeading').onclick = () =>
        commit(() => (selectObject()!.heading = !selectObject()!.heading), false);
      $('#insertToc').onclick = () =>
        commit(() => {
          let existing = book.pages[active].objects.find((o) => o.toc);
          if (existing) {
            selected = existing.id;
            return;
          }
          let m = M.margins(book, active),
            o = M.text(
              '',
              m.left,
              book.margins.top,
              book.width - m.left - m.right,
              book.height - book.margins.top - book.margins.bottom,
              12,
            );
          o.toc = true;
          book.pages[active].objects.push(o);
          selected = o.id;
        }, true);
      $('#addTocEntry').onclick = () => {
        modal.sheet(
          'Nueva entrada del índice',
          `<div class="modal-grid">${control('Texto de la entrada', 'entryLabel', '', 'text', '', '', true)}<div class="control full"><label>Página de referencia</label><select id="entryPage">${book.pages.map((p, i) => `<option value="${p.id}" ${i === active ? 'selected' : ''}>${i + 1} · ${esc(M.sectionAt(book, i))}</option>`).join('')}</select></div></div>`,
          () => {
            const label = $('#entryLabel').value.trim().slice(0, 500),
              pageId = $('#entryPage').value;
            if (!label) throw Error('Escribí el texto de la entrada.');
            commit(() => ensureToc().entries.push({ id: M.uid(), label, pageId }), false);
          },
          'Agregar entrada',
          { size: 'sm' },
        );
      };
      $$('[data-remove-entry]').forEach(
        (el) =>
          (el.onclick = () =>
            commit(() => {
              ensureToc().entries = ensureToc().entries.filter(
                (e) => e.id !== el.dataset.removeEntry,
              );
            }, false)),
      );
    },
  'editorial',
);
function renderToc(el: HTMLElement, o: BookObject, px: number): void {
  const content = el.querySelector('.text-content');
  if (!content) return;
  content.replaceChildren();
  const title = document.createElement('div');
  title.className = 'toc-title user-content';
  title.textContent = M.tocConfig(book).title;
  title.style.marginBottom = ((o.leading * 25.4) / 72) * px + 'px';
  title.style.fontWeight = 'bold';
  content.append(title);
  for (const entry of M.tocEntries(book)) {
    const row = document.createElement('div');
    row.className = 'toc-paper-row';
    const label = document.createElement('span');
    label.textContent = entry.label;
    const dots = document.createElement('i');
    const folio = document.createElement('span');
    folio.textContent = entry.folio;
    row.append(label, dots, folio);
    content.append(row);
  }
  el.ondblclick = (e) => {
    e.stopPropagation();
    showTab('index');
  };
}
// Índice dibujado en el papel; tracking, sangría y espacio entre párrafos de los textos.
extend.result(
  'paper',
  (page: HTMLElement, i: number, px: number) => {
    for (const o of book.pages[i].objects) {
      const el = page.querySelector<HTMLElement>(`[data-id="${o.id}"]`)!;
      if (o.toc) renderToc(el, o, px);
      if (o.type === 'text' && !o.toc) {
        const content = el.querySelector<HTMLElement>('.text-content')!;
        content.style.letterSpacing =
          ((((o.tracking || 0) / 1000) * o.size * 25.4) / 72) * px + 'px';
        if (o.spaceAfter) {
          content.replaceChildren();
          for (const line of o.text.split('\n')) {
            const p = document.createElement('div');
            p.textContent = line || ' ';
            p.style.marginBottom = o.spaceAfter * px + 'px';
            p.style.textIndent = (o.indent || 0) * px + 'px';
            content.append(p);
          }
        } else content.style.textIndent = (o.indent || 0) * px + 'px';
      }
    }
    return page;
  },
  'editorial',
);
// El índice no se edita en el papel: abre su pestaña.
extend.instead(
  'startEditing',
  () => !!selectObject()?.toc,
  () => {
    showTab('index');
  },
  'editorial',
);
function extraTextControls(): void {
  const h = $('#inspectorContent'),
    o = selectObject();
  const extra = document.createElement('div');
  extra.innerHTML = section(
    'Carácter y párrafo',
    'text',
    row(
      'Tracking',
      `<span class="unit-wrap"><input data-extra="tracking" type="number" min="-100" max="500" value="${o?.tracking || 0}" ${!o || o.type !== 'text' || o.toc ? 'disabled' : ''}><span class="unit">‰</span></span>`,
    ) +
      row(
        'Sangría inicial',
        `<span class="unit-wrap"><input data-extra="indent" type="number" min="0" max="30" step=".5" value="${o?.indent || 0}" ${!o || o.type !== 'text' || o.toc ? 'disabled' : ''}><span class="unit">mm</span></span>`,
      ) +
      row(
        'Espacio entre párrafos',
        `<span class="unit-wrap"><input data-extra="spaceAfter" type="number" min="0" max="30" step=".5" value="${o?.spaceAfter || 0}" ${!o || o.type !== 'text' || o.toc ? 'disabled' : ''}><span class="unit">mm</span></span>`,
      ) +
      `<button class="btn wide" id="glyphPanel" ${!o || o.type !== 'text' || o.toc ? 'disabled' : ''}>Glifos y caracteres especiales</button><button class="btn wide" id="openIndexFromText">Abrir Índice</button>`,
  );
  h.append(extra);
  extra.querySelectorAll<HTMLInputElement>('[data-extra]').forEach(
    (el) =>
      (el.onchange = () => {
        const n = Number(el.value);
        if (!Number.isFinite(n) || n < Number(el.min) || n > Number(el.max)) return;
        commit(() => (selectObject()![el.dataset.extra!] = n), false);
      }),
  );
  $('#openIndexFromText').onclick = () => showTab('index');
  $('#glyphPanel').onclick = () => {
    const target = selectObject()!;
    modal.info(
      'Glifos y caracteres especiales',
      `<p class="help">Elegí un carácter para agregarlo al final del cuadro seleccionado. Su disponibilidad depende de la tipografía.</p><div class="glyph-grid">${[...'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØŒÙÚÛÜÝŸàáâãäåæçèéêëìíîïðñòóôõöøœùúûüýÿß¿¡«»“”‘’—–…•·©®™€£¥¢§¶†‡±×÷¼½¾¹²³←↑→↓'].map((c) => `<button type="button" data-glyph="${esc(c)}" style="font-family:${esc(target.font)}">${esc(c)}</button>`).join('')}</div>`,
      'Cerrar',
    );
    $$('[data-glyph]').forEach(
      (el) =>
        (el.onclick = () => {
          snapshot();
          target.text += el.dataset.glyph;
          changed();
          renderPages();
        }),
    );
  };
}
function extraGuideControls(): void {
  // En Libro, la estructura va primero: las guías acompañan a la grilla.
  const host = $('#inspectorContent'),
    first = host.querySelector('.section[data-key="grid"]') || host.querySelector('.section');
  if (!first) return;
  const box = document.createElement('div');
  box.innerHTML = `<details class="guide-controls"><summary>Guías individuales</summary><p class="help">Guías horizontales y verticales en todas las páginas. No se imprimen.</p><button class="btn wide" id="addGuide">Agregar guía</button><div class="guide-list">${(book.guides || []).map((g: BookGuide, i: number) => `<div class="field-row"><span>${g.axis === 'v' ? 'Vertical' : 'Horizontal'} · ${displayMeasure(g.position)} ${documentUnit()}</span><button class="icon-btn" data-remove-guide="${i}" aria-label="Quitar guía">${icon('close')}</button></div>`).join('')}</div></details>`;
  first.append(box);
  $('#addGuide').onclick = () => {
    modal.sheet(
      'Nueva guía',
      `<div class="modal-grid"><div class="control"><label>Orientación</label><select id="guideAxis"><option value="v">Vertical</option><option value="h">Horizontal</option></select></div>${control('Posición desde el borde · mm', 'guidePosition', 20, 'number', 0, Math.max(book.width, book.height))}</div>`,
      () => {
        const axis = $('#guideAxis').value,
          n = Number($('#guidePosition').value);
        if (!Number.isFinite(n) || n < 0 || n > (axis === 'v' ? book.width : book.height))
          throw Error('La guía debe estar dentro de la página.');
        commit(() => {
          if (!book.guides) book.guides = [];
          book.guides.push({ axis, position: n });
        }, false);
      },
      'Agregar guía',
      { size: 'sm' },
    );
  };
  $$('[data-remove-guide]').forEach(
    (el) =>
      (el.onclick = () =>
        commit(() => book.guides.splice(Number(el.dataset.removeGuide), 1), false)),
  );
}
/** Guía propia del libro: vertical (v) u horizontal (h), a position mm del borde. */
interface BookGuide {
  axis: 'v' | 'h';
  position: number;
}
// Guías propias del libro, sobre la grilla.
extend.result(
  'gridSvg',
  (svg: string, i: number, px: number) => {
    const lines = (book.guides || [])
      .map((g: BookGuide) =>
        g.axis === 'v'
          ? `<line x1="${g.position}" x2="${g.position}" y1="0" y2="${book.height}"/>`
          : `<line y1="${g.position}" y2="${g.position}" x1="0" x2="${book.width}"/>`,
      )
      .join('');
    return svg.replace(
      '</svg>',
      `<g stroke="#b7a2ff" fill="none" stroke-width="${0.8 / px}" stroke-dasharray="1 1">${lines}</g></svg>`,
    );
  },
  'editorial',
);
const indexButton = document.createElement('button');
indexButton.className = 'tool';
indexButton.id = 'indexTool';
indexButton.innerHTML = icon('pages') + '<span>Índice</span>';
indexButton.onclick = () => {
  finishEditing();
  showTab('index');
};
$('#tools').append(indexButton);
globalThis.prepareIndexPrint = function () {
  const original = M.clone(book),
    o = M.text('', 20, 20, book.width - 40, book.height - 40);
  o.toc = true;
  book.pages[Math.min(2, book.pages.length - 1)].objects.push(o);
  preparePrint();
  book = original;
};
render(true);
