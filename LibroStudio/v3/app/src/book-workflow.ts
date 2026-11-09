// Recorrido del libro y armador de novelas. Registra la sección "Recorrido del libro" del centro
// de Ayuda (los cinco pasos, con el actual marcado), el panel de estructura de la pestaña Libro
// (ir al comienzo de cada parte), los controles de misceláneas y líneas, el armador de novelas
// (manuscrito con # por capítulo → libro A5 con preliminares, índice y estilos, medido con el mismo
// motor de párrafos que el editor y el PDF)
// y la revisión del libro completo. También define bw(es, en, pt), el texto en el idioma de la
// interfaz que usa casi toda la app: por eso este archivo carga antes que los que lo llaman.
//
// Fuente TypeScript: se compila a build/book-workflow.js (desktop/scripts/build.mjs).
import type { Book, BookObject, Page } from './model.ts';
import type { NovelSample } from './novel-sample.ts';
import { bookBuilderForm } from './components/book-builder/BookBuilder.tsx';
import { routeHelpSection } from './components/help/sections.tsx';
import { openPreflight } from './components/preflight/PreflightSheet.tsx';
import { structurePanelFor } from './components/inspector/StructurePanel.tsx';
import { M, UI } from './core-api.ts';
import { closeSheet } from './components/dialog/dialogs.tsx';
import { bw } from './i18n/language.ts';
import { registerInspectorPanel } from './inspector-registry.ts';

/** Datos del armador de novelas: título, autoría y manuscrito; lo demás es opcional. */
export type NovelData = Pick<NovelSample, 'title' | 'author' | 'source'> & Partial<NovelSample>;

/** Una parte del manuscrito: el título de su "# Título" y sus párrafos. */
export interface ManuscriptPart {
  title: string;
  paragraphs: string[];
}

/** Estilo de párrafo vinculado a un párrafo de la caja (paragraphMap). */
interface ParagraphRef {
  styleId: string;
  overrides: Record<string, number>;
}

/** Caja de texto del armador: siempre tiene su paragraphMap. */
type NovelTextObject = BookObject & { paragraphMap: ParagraphRef[] };

/** Un problema de la revisión del libro: página (desde 0) y tipo. */
export interface PreflightIssue {
  page: number;
  kind: 'bounds' | 'overflow';
}

// bw vive en src/i18n/language.ts. Se sigue publicando enseguida: studio.ts y las pruebas lo leen
// como global.
globalThis.bw = bw;
const titleOfPart = (p: Page): string =>
  p.partName || p.section || bw('Página sin título', 'Untitled page', 'Página sem título');
/** Paso del recorrido del libro: id, nombre, qué hace y la herramienta que abre. */
type RouteStep = [id: string, label: string, description: string, open: () => unknown];
const routeSteps: RouteStep[] = [
  [
    'build',
    'Armar libro',
    'Desde un manuscrito, con partes, índice y estilos.',
    () => globalThis.bookBuilder(),
  ],
  ['structure', 'Estructura', 'Ir al comienzo de cada parte.', () => showTab('structure')],
  ['cover', 'Cubierta', 'Tapa, lomo, contratapa y solapas.', () => coverEditor()],
  [
    'review',
    'Revisar libro',
    'Texto que no entra y objetos fuera de página.',
    () => preflightDialog(),
  ],
  ['output', 'PDF / Imprimir', 'Vista previa y salida final.', () => outputDialog('pdf')],
];
/** Último paso abierto desde el recorrido (en esta sesión). */
let routeStep: string | null = null;
/** "Estás acá": sin libro, armarlo; si no, el último paso que se abrió (o Estructura). */
const currentRouteStep = (): string => (!hasDocument ? 'build' : routeStep || 'structure');
// El recorrido vive en el centro de Ayuda (sección de React, components/help/sections.tsx): una
// lista sobria con el paso actual marcado. renderBookRoute la vuelve a dibujar si la Ayuda está
// abierta (la llaman render y las pruebas).
function renderBookRoute(): void {
  refreshHelp();
}
registerHelpSection(
  routeHelpSection({
    steps: routeSteps.map(([id, label, description]): [string, string, string] => [
      id,
      label,
      description,
    ]),
    current: currentRouteStep,
    open: (id) => {
      const step = routeSteps.find(([stepId]) => stepId === id)!;
      routeStep = step[0];
      closeSheet();
      setTimeout(step[3], 30);
    },
  }),
);
// Estructura del libro: la sección de la pestaña Libro (components/inspector/StructurePanel.tsx).
registerInspectorPanel('structure:structure', structurePanelFor(titleOfPart), 'book-workflow');
extend.after(
  'render',
  function (full = true) {
    renderBookRoute();
  },
  'book-workflow',
);
extend.result(
  'autoElement',
  function (el, i, type, px, print = false) {
    const c = book[type];
    if (!el) return null;
    el.classList.remove('rule');
    el.style.borderBottom = 'none';
    el.style.paddingBottom = '0';
    if (c.rule) {
      const line = document.createElement('span');
      line.className = 'mqt-rule';
      Object.assign(line.style, {
        position: 'absolute',
        display: 'block',
        left: (100 - (c.ruleLength ?? 100)) / 2 + '%',
        width: (c.ruleLength ?? 100) + '%',
        height: '0',
        top: `calc(100% + ${(c.ruleGap ?? 1.5) * px}px)`,
        borderTop: `${(c.ruleWidth ?? 0.25) * px}px ${c.ruleStyle || 'solid'} ${c.ruleColor || '#77716C'}`,
      });
      el.append(line);
    }
    return el;
  },
  'book-workflow',
);
extend.result(
  'paper',
  function (page: HTMLElement, i: number, px: number, print = false) {
    for (const o of book.pages[i].objects)
      if (o.decoration === 'line') {
        const el = page.querySelector<HTMLElement>(`[data-id="${o.id}"]`);
        if (el) {
          el.classList.remove('frame');
          el.style.background = 'transparent';
          el.style.border = 'none';
          el.querySelectorAll('.icon').forEach((x) => x.remove());
          const line = document.createElement('span');
          Object.assign(line.style, {
            position: 'absolute',
            top: '50%',
            left: '0',
            width: '100%',
            borderTop: `${(o.lineWidth ?? 0.35) * px}px ${o.lineStyle || 'solid'} ${o.lineColor || '#77716C'}`,
            pointerEvents: 'none',
          });
          el.append(line);
        }
      }
    return page;
  },
  'book-workflow',
);
// Layout is measured with the very same paragraph renderer used by the editor and PDF.
function measureBookText(b: Book, o: BookObject): boolean {
  const prior = book;
  let page: HTMLElement | undefined;
  try {
    book = b;
    const p = M.page();
    p.objects = [o];
    b.pages.push(p);
    page = paper(b.pages.length - 1, 96 / 25.4, true);
    Object.assign(page.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      display: 'block',
      visibility: 'hidden',
    });
    document.body.append(page);
    const t = page.querySelector('.text-content')!;
    return t.scrollHeight <= t.clientHeight + 1;
  } finally {
    page?.remove();
    if (b.pages.at(-1)?.objects[0] === o) b.pages.pop();
    book = prior;
  }
}
function novelText(
  b: Book,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  style = 'body',
): NovelTextObject {
  const o = M.text(text, x, y, w, h, 11) as NovelTextObject;
  o.leading = 15;
  o.color = '#29252A';
  o.paragraphMap = text.split('\n').map(() => ({ styleId: style, overrides: {} }));
  return o;
}
function manuscriptParts(source: string): ManuscriptPart[] {
  const parts: ManuscriptPart[] = [];
  let current: ManuscriptPart | null = null;
  for (const line of source.replace(/\r/g, '').split('\n')) {
    if (/^#\s+/.test(line)) {
      current = { title: line.replace(/^#\s+/, '').trim(), paragraphs: [] };
      parts.push(current);
    } else if (line.trim()) {
      if (!current) {
        current = { title: bw('Capítulo 1', 'Chapter 1', 'Capítulo 1'), paragraphs: [] };
        parts.push(current);
      }
      current.paragraphs.push(line.trim());
    }
  }
  return parts.filter((p) => p.paragraphs.length);
}
function composeNovel(data: NovelData): Book {
  const parts = manuscriptParts(data.source);
  if (!parts.length)
    throw Error(
      bw(
        'Pegá el texto de al menos un capítulo.',
        'Paste at least one chapter.',
        'Cole o texto de pelo menos um capítulo.',
      ),
    );
  if (data.source.length > 500000)
    throw Error(
      bw(
        'El manuscrito supera 500.000 caracteres.',
        'The manuscript exceeds 500,000 characters.',
        'O manuscrito supera 500.000 caracteres.',
      ),
    );
  const b = M.create();
  b.title = data.title;
  b.chapter = '';
  b.author = data.author;
  b.pages = [];
  b.grid = { enabled: false, rows: 1, cols: 1, gapX: 0, gapY: 0, fit: 'margins' };
  b.margins = { top: 22, bottom: 22, inside: 23, outside: 20 };
  b.header.rule = !!data.rule;
  b.header.size = 8;
  b.header.distance = 12;
  b.header.font = 'Georgia';
  b.header.odd = '{section}';
  b.header.even = '{book}';
  b.folio.distance = 12;
  b.titulillo.enabled = false;
  b.paragraphStyles = [
    {
      id: 'body',
      name: bw('Cuerpo de novela', 'Novel body', 'Corpo do romance'),
      properties: {
        font: 'Georgia',
        size: 11,
        leading: 15,
        align: 'justify',
        lastAlign: 'left',
        firstIndent: 4,
        spaceAfter: 1.3,
      },
    },
    {
      id: 'chapter',
      name: bw('Título de capítulo', 'Chapter title', 'Título de capítulo'),
      properties: {
        font: 'Georgia',
        size: 25,
        leading: 30,
        align: 'left',
        firstIndent: 0,
        spaceAfter: 0,
      },
    },
    {
      id: 'front',
      name: bw('Preliminares', 'Front matter', 'Preliminares'),
      properties: {
        font: 'Georgia',
        size: 11,
        leading: 16,
        align: 'center',
        firstIndent: 0,
        spaceAfter: 2,
      },
    },
  ];
  const front = (label: string, content: string, y = 65, size = 18): Page => {
    const p = M.page();
    p.partName = label;
    p.hideHeader = p.hideTitle = p.hideFolio = true;
    const o = novelText(b, content, 23, y, 102, 110, 'front');
    o.paragraphMap.forEach((m) => (m.overrides = { size, leading: size * 1.5 }));
    p.objects = [o];
    b.pages.push(p);
    return p;
  };
  front(bw('Portadilla', 'Half title', 'Falsa folha de rosto'), data.title, 75, 21);
  if (data.blanks) front(bw('Blanco de cortesía', 'Blank verso', 'Verso em branco'), '');
  front(
    bw('Portada', 'Title page', 'Folha de rosto'),
    data.title + '\n\n' + data.author + '\n\n' + bw('NOVELA', 'NOVEL', 'ROMANCE'),
    48,
    19,
  );
  front(
    bw('Legales', 'Copyright', 'Créditos'),
    data.legal ||
      bw(
        'Edición de prueba\nTexto de demostración. Revisá y completá los datos editoriales antes de publicar.',
        'Proof edition\nSample text. Review and complete publication details before publishing.',
        'Edição de prova\nTexto de demonstração. Revise e complete os dados editoriais antes de publicar.',
      ),
    100,
    9,
  );
  if (data.dedication)
    front(bw('Dedicatoria', 'Dedication', 'Dedicatória'), data.dedication, 80, 12);
  if (data.epigraph) front(bw('Epígrafe', 'Epigraph', 'Epígrafe'), data.epigraph, 70, 12);
  let tocPage: Page;
  if (data.toc) {
    tocPage = front(bw('Índice', 'Contents', 'Sumário'), '');
    const o = M.text('', 23, 28, 102, 155, 11);
    o.leading = 20;
    o.toc = true;
    tocPage.objects = [o];
  }
  b.toc = {
    title: bw('Índice', 'Contents', 'Sumário'),
    includeSections: false,
    includeHeadings: false,
    entries: [],
  };
  const startPart = (part: ManuscriptPart): Page => {
    const p = M.page();
    p.partName = p.section = part.title;
    b.pages.push(p);
    b.toc!.entries.push({ id: M.uid(), label: part.title, pageId: p.id });
    const heading = novelText(b, part.title, 23, 35, 102, 33, 'chapter');
    p.objects = [heading];
    return p;
  };
  for (const part of parts) {
    let p = startPart(part),
      first = true,
      queue = [...part.paragraphs],
      continuation = false;
    while (queue.length) {
      const y = first ? 76 : 22,
        h = 210 - 22 - y - 1,
        texts: string[] = [],
        maps: ParagraphRef[] = [];
      while (queue.length) {
        const para = queue[0],
          candidate = novelText(b, [...texts, para].join('\n'), 23, y, 102, h);
        candidate.paragraphMap = [
          ...maps,
          { styleId: 'body', overrides: continuation ? { firstIndent: 0 } : {} },
        ];
        if (measureBookText(b, candidate)) {
          texts.push(para);
          maps.push(candidate.paragraphMap.at(-1)!);
          queue.shift();
          continuation = false;
          continue;
        }
        if (texts.length) break;
        const words = para.split(/\s+/);
        let low = 1,
          high = words.length,
          best = 0;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2),
            test = novelText(b, words.slice(0, mid).join(' '), 23, y, 102, h);
          test.paragraphMap = [
            { styleId: 'body', overrides: continuation ? { firstIndent: 0 } : {} },
          ];
          if (measureBookText(b, test)) {
            best = mid;
            low = mid + 1;
          } else high = mid - 1;
        }
        if (!best)
          throw Error(
            bw(
              'Una palabra no cabe en la caja. Revisá el manuscrito.',
              'A word does not fit. Review the manuscript.',
              'Uma palavra não cabe. Revise o manuscrito.',
            ),
          );
        texts.push(words.slice(0, best).join(' '));
        maps.push({ styleId: 'body', overrides: continuation ? { firstIndent: 0 } : {} });
        queue[0] = words.slice(best).join(' ');
        if (!queue[0]) queue.shift();
        continuation = true;
        break;
      }
      const o = novelText(b, texts.join('\n'), 23, y, 102, h);
      o.paragraphMap = maps;
      p.objects.push(o);
      if (queue.length) {
        p = M.page();
        b.pages.push(p);
        first = false;
      }
      if (b.pages.length > 198)
        throw Error(
          bw(
            'El libro supera el límite de 200 páginas. Dividí el manuscrito.',
            'The book exceeds 200 pages. Split the manuscript.',
            'O livro supera 200 páginas. Divida o manuscrito.',
          ),
        );
    }
  }
  if (data.thanks)
    front(bw('Agradecimientos', 'Acknowledgements', 'Agradecimentos'), data.thanks, 45, 11);
  if (data.colophon) front(bw('Colofón', 'Colophon', 'Colofão'), data.colophon, 100, 9);
  if (b.pages.length % 2 && data.blanks)
    front(bw('Blanco final', 'Final blank', 'Branco final'), '');
  return M.validate(b);
}
function installNovel(b: Book): void {
  finishEditing();
  commit(() => {
    book = b;
    active = spread = 0;
    selected = null;
    hasDocument = true;
    multiSelection.clear();
    paragraphScope = { id: null, index: -1 };
  }, true);
  refreshEmptyCanvas();
  if (native) nativeCall('newProject').catch(() => {});
  showTab('structure');
}
function bookBuilder(sample = false): void {
  const run = () => {
    hideWelcome();
    const d: NovelData = sample ? novelSample() : { title: '', author: '', source: '' };
    modal.workspace(
      bw('Dale estructura a tu libro', 'Give your book a structure', 'Dê estrutura ao seu livro'),
      bookBuilderForm(d),
      {
        id: 'bookBuilder',
        action: {
          id: 'createNovel',
          label: bw('Crear libro', 'Create book', 'Criar livro'),
          // Mientras compone, el botón lo dice y la Ventana no se cierra (Sheet.tsx).
          busyLabel: bw('Componiendo…', 'Composing…', 'Compondo…'),
          run: async () => {
            const data: NovelData = {
              title: $('#novelTitle').value.trim(),
              author: $('#novelAuthor').value.trim(),
              source: $('#novelSource').value,
              toc: $('#novelToc').checked,
              blanks: $('#novelBlanks').checked,
              rule: $('#novelRule').checked,
            };
            for (const key of ['dedication', 'epigraph', 'legal', 'thanks', 'colophon'] as const)
              data[key] = $('#novel-' + key).value.trim();
            if (!data.title || data.title.length > 250 || data.author.length > 250)
              throw Error(
                bw(
                  'Completá un título de hasta 250 caracteres.',
                  'Enter a title up to 250 characters.',
                  'Informe um título de até 250 caracteres.',
                ),
              );
            // Un respiro para que se vea "Componiendo…" antes de que la composición ocupe el hilo.
            await new Promise((r) => setTimeout(r, 30));
            const b = composeNovel(data);
            installNovel(b);
            toast(
              bw(
                'Libro creado. Revisá cada parte desde Libro.',
                'Book created. Review every part in Book.',
                'Livro criado. Revise cada parte em Livro.',
              ),
            );
          },
        },
      },
    );
  };
  if (dirty) {
    confirmChanges(run, 'build');
  } else run();
}
function preflightBook(): PreflightIssue[] {
  finishEditing();
  const issues: PreflightIssue[] = [],
    prior = book;
  for (let i = 0; i < book.pages.length; i++) {
    let p: HTMLElement | undefined;
    try {
      p = paper(i, 96 / 25.4, true);
      Object.assign(p.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        display: 'block',
        visibility: 'hidden',
      });
      document.body.append(p);
      for (const o of book.pages[i].objects) {
        if (o.hidden) continue;
        if (o.x + o.w > book.width + 0.1 || o.y + o.h > book.height + 0.1)
          issues.push({ page: i, kind: 'bounds' });
        if (o.type === 'text') {
          const el = p.querySelector(`[data-id="${o.id}"] .text-content`);
          if (el && el.scrollHeight > el.clientHeight + 2)
            issues.push({ page: i, kind: 'overflow' });
        }
      }
    } finally {
      p?.remove();
    }
  }
  return issues;
}
/** "Revisar libro": la Hoja de React con lo que revisa preflightBook (components/preflight/). */
function preflightDialog(): void {
  openPreflight();
}
extend.result(
  'showWelcome',
  async function (pending: Promise<void>) {
    await pending;
    if ($('#welcomeNew')) {
      const b = UI.element(
        UI.button({
          id: 'welcomeNovel',
          label: bw(
            'Armar desde un manuscrito',
            'Build from a manuscript',
            'Montar a partir de um manuscrito',
          ),
        }),
      );
      b.onclick = () => bookBuilder();
      $('.welcome-actions').append(b);
    }
  },
  'book-workflow',
);
// La bienvenida es React (data-react) y el traductor del DOM no entra: este botón, que se agrega
// desde acá, se traduce solo cuando cambia el idioma.
document.addEventListener('maquetario:language', () => {
  const button = $('#welcomeNovel');
  if (button)
    button.lastChild!.textContent = bw(
      'Armar desde un manuscrito',
      'Build from a manuscript',
      'Montar a partir de um manuscrito',
    );
});
// Publicado a propósito. bw: casi toda la interfaz. composeNovel, installNovel y preflightBook: book-proof y sus
// pruebas (installNovel también scripts/style-snapshot.js). bookBuilder: cover-measurements.
// preflightDialog: la barra del documento (DocumentBar.tsx).
// manuscriptParts: tests/book-proof-tests.js.
declare global {
  /** Texto en el idioma de la interfaz (castellano, inglés, portugués). */
  var bw: (es: string, en: string, pt: string) => string;
  var composeNovel: (data: NovelData) => Book;
  var installNovel: (b: Book) => void;
  /** Revisión del libro: objetos fuera de la página y cajas de texto desbordadas. */
  var preflightBook: () => PreflightIssue[];
  var bookBuilder: (sample?: boolean) => void;
  /** "Revisar libro": texto sobrante y objetos fuera de página (Hoja de React). */
  var preflightDialog: () => void;
  var manuscriptParts: (source: string) => ManuscriptPart[];
}
globalThis.composeNovel = composeNovel;
globalThis.installNovel = installNovel;
globalThis.preflightBook = preflightBook;
globalThis.bookBuilder = bookBuilder;
globalThis.preflightDialog = preflightDialog;
globalThis.manuscriptParts = manuscriptParts;
globalThis.showWelcome = showWelcome;
renderBookRoute();
