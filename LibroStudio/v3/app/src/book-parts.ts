// Partes del libro (pedido de la cátedra de Tipografía I): la lista de partes para tildar en la vista
// Estructura (components/inspector/StructurePanel.tsx). No tiene efectos al cargar: se importa.
//
// Cada página que empieza una parte puede guardar cuál es (page.part). Los libros que ya existen no
// la tienen: la parte se reconoce por el nombre (page.partName o page.section, en cualquiera de los
// tres idiomas, como los arma el armado desde manuscrito de book-workflow.ts). Las páginas con
// sección que no son preliminares ni finales son el cuerpo.
//
// Tildar una parte agrega una página en su lugar (antes de la primera parte presente que va después
// en la lista; a doble página, con su blanco detrás para no cambiar de lado lo que sigue);
// destildarla quita sus páginas, con confirmación. Las dos cosas se deshacen.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { Book, Page } from './model.ts';
import { bw } from './i18n/language.ts';
import { M, editor } from './core-api.ts';
import { confirmAction } from './components/dialog/dialogs.tsx';
import { goToBookPage } from './book-navigation.ts';

type Names = [string, string, string];
interface PartDef {
  id: string;
  names: Names;
  /** Otros nombres con que puede venir (libros armados antes). */
  aliases?: string[];
  /** Preliminar sin cornisa ni folio. */
  plain?: boolean;
  /** Texto de partida de la página nueva (title: el título del libro). */
  sample: (b: Book) => string;
}

const lines = (...rows: string[]) => rows.join('\n');

/** Las partes, en el orden en que van en el libro. */
export const BOOK_PARTS: PartDef[] = [
  {
    id: 'half-title',
    names: ['Portadilla', 'Half title', 'Falsa folha de rosto'],
    plain: true,
    sample: (b) => b.title,
  },
  {
    id: 'title-page',
    names: ['Portada', 'Title page', 'Folha de rosto'],
    plain: true,
    sample: (b) => lines(b.title, '', b.author || bw('Autor', 'Author', 'Autor')),
  },
  {
    id: 'copyright',
    names: ['Créditos', 'Copyright', 'Créditos'],
    aliases: ['legales'],
    plain: true,
    sample: (b) =>
      lines(
        `© ${new Date().getFullYear()} ${b.author || bw('Autor', 'Author', 'Autor')}`,
        bw('Edición: ', 'Edition: ', 'Edição: '),
        'ISBN: ',
        bw('Impreso en ', 'Printed in ', 'Impresso em '),
      ),
  },
  {
    id: 'dedication',
    names: ['Dedicatoria', 'Dedication', 'Dedicatória'],
    plain: true,
    sample: () => bw('A…', 'To…', 'Para…'),
  },
  {
    id: 'epigraph',
    names: ['Epígrafe', 'Epigraph', 'Epígrafe'],
    plain: true,
    sample: () => lines(bw('Texto del epígrafe.', 'Epigraph text.', 'Texto da epígrafe.'), '— '),
  },
  {
    id: 'contents',
    names: ['Índice', 'Contents', 'Sumário'],
    aliases: ['sumario'],
    plain: true,
    sample: () => '',
  },
  {
    id: 'prologue',
    names: ['Prólogo', 'Foreword', 'Prefácio'],
    aliases: ['prefacio', 'preface'],
    sample: () => bw('Texto del prólogo.', 'Foreword text.', 'Texto do prefácio.'),
  },
  {
    id: 'introduction',
    names: ['Introducción', 'Introduction', 'Introdução'],
    sample: () => bw('Texto de la introducción.', 'Introduction text.', 'Texto da introdução.'),
  },
  {
    id: 'body',
    names: ['Cuerpo', 'Body', 'Corpo'],
    sample: () => bw('Texto del capítulo.', 'Chapter text.', 'Texto do capítulo.'),
  },
  {
    id: 'appendix',
    names: ['Apéndice', 'Appendix', 'Apêndice'],
    sample: () => bw('Texto del apéndice.', 'Appendix text.', 'Texto do apêndice.'),
  },
  {
    id: 'bibliography',
    names: ['Bibliografía', 'Bibliography', 'Bibliografia'],
    sample: () =>
      bw(
        'Apellido, Nombre (año). Título. Ciudad: Editorial.',
        'Surname, Name (year). Title. City: Publisher.',
        'Sobrenome, Nome (ano). Título. Cidade: Editora.',
      ),
  },
  {
    id: 'acknowledgements',
    names: ['Agradecimientos', 'Acknowledgements', 'Agradecimentos'],
    sample: () => bw('A quienes…', 'To those who…', 'A quem…'),
  },
  {
    id: 'colophon',
    names: ['Colofón', 'Colophon', 'Colofão'],
    plain: true,
    sample: (b) =>
      lines(
        bw(
          'Este libro se compuso en Maquetario.',
          'This book was set in Maquetario.',
          'Este livro foi composto no Maquetario.',
        ),
        `${b.format} · ${b.pages.find((p) => p.objects.some((o) => o.type === 'text'))?.objects.find((o) => o.type === 'text')?.font || 'Georgia'}`,
      ),
  },
];

/** Nombre de una parte en el idioma de la interfaz. */
export const partName = (id: string): string => {
  const part = BOOK_PARTS.find((p) => p.id === id);
  return part ? bw(...part.names) : id;
};

const normalize = (text: string) => text.trim().toLocaleLowerCase();
const isBlank = (name: string) => /^(blanco|blank|branco|página en blanco)/.test(name);

/** La parte que empieza en una página (null: no empieza una parte conocida). */
export function partOf(page: Page): string | null {
  if (page.part) return page.part;
  const name = normalize(page.partName || page.section || '');
  if (!name || isBlank(name)) return null;
  for (const part of BOOK_PARTS) {
    if (part.id === 'body') continue;
    const names = [...part.names, ...(part.aliases ?? [])].map(normalize);
    // "Prólogo · La llave", "Índice": el nombre o el nombre seguido de algo.
    if (
      names.some(
        (n) => name === n || (name.startsWith(n) && ' ·:.,—-'.includes(name.charAt(n.length))),
      )
    )
      return part.id;
  }
  return page.section ? 'body' : null;
}

/** Las partes que tiene el libro: dónde empiezan y dónde terminan (sin incluir end). */
export function presentParts(b: Book = editor.book): Map<string, { start: number; end: number }> {
  const found = new Map<string, { start: number; end: number }>();
  let current: string | null = null;
  b.pages.forEach((page, i) => {
    const starts = !!(page.part || page.partName || page.section);
    if (starts) current = partOf(page);
    if (!current) return;
    const range = found.get(current);
    if (range && (range.end === i || current === 'body')) range.end = i + 1;
    else if (!range) found.set(current, { start: i, end: i + 1 });
  });
  // Un libro sin partes marcadas es todo cuerpo.
  if (!found.size && b.pages.length) found.set('body', { start: 0, end: b.pages.length });
  return found;
}

/** La página nueva de una parte, con su texto de partida dentro de los márgenes. */
function partPage(b: Book, id: string, at: number): Page {
  const def = BOOK_PARTS.find((p) => p.id === id)!,
    page = M.page(),
    side = M.margins(b, at),
    x = side.left,
    w = b.width - side.left - side.right,
    y = b.margins.top,
    h = b.height - b.margins.top - b.margins.bottom,
    name = bw(...def.names);
  page.part = id;
  page.partName = id === 'body' ? bw('Capítulo 1', 'Chapter 1', 'Capítulo 1') : name;
  if (def.plain) page.hideHeader = page.hideTitle = page.hideFolio = true;
  else page.section = page.partName;
  if (id === 'contents') {
    const toc = M.text('', x, y, w, h, 11);
    toc.toc = true;
    if (!b.toc) b.toc = M.tocConfig(b);
    page.objects = [toc];
    return page;
  }
  const sample = def.sample(b);
  if (def.plain) {
    const box = M.text(
      sample,
      x,
      y + h * 0.3,
      w,
      h * 0.4,
      id === 'copyright' || id === 'colophon' ? 9 : 14,
    );
    box.align = 'center';
    page.objects = [box];
  } else {
    const heading = M.text(page.partName, x, y, w, 20, 22),
      text = M.text(sample, x, y + 30, w, h - 30, 11);
    heading.heading = true;
    page.objects = [heading, text];
  }
  return page;
}

/** Agrega una parte en su lugar y va a ella. */
export function addPart(id: string): void {
  const b = editor.book,
    order = BOOK_PARTS.findIndex((p) => p.id === id),
    present = presentParts(b);
  if (order < 0 || present.has(id)) return;
  // A doble página, la parte entra con su blanco detrás: lo que sigue no cambia de lado (un capítulo
  // que empezaba en impar sigue en impar). El blanco no tiene nombre: es parte de la misma parte.
  const added = b.facing ? 2 : 1;
  if (b.pages.length + added > 200) {
    toast(
      bw(
        'El libro ya tiene 200 páginas.',
        'The book already has 200 pages.',
        'O livro já tem 200 páginas.',
      ),
      'warning',
    );
    return;
  }
  let at = b.pages.length;
  for (const later of BOOK_PARTS.slice(order + 1)) {
    const range = present.get(later.id);
    if (range) {
      at = range.start;
      break;
    }
  }
  commit(() => {
    const pages = [partPage(b, id, at)];
    if (b.facing) {
      const blank = M.page();
      blank.hideHeader = blank.hideTitle = blank.hideFolio = true;
      pages.push(blank);
    }
    b.pages.splice(at, 0, ...pages);
  }, true);
  goToBookPage(at);
}

/** Quita las páginas de una parte (el cuerpo no se quita), después de confirmar. */
export async function removePart(id: string): Promise<void> {
  const b = editor.book,
    range = presentParts(b).get(id);
  if (!range || id === 'body') return;
  const count = range.end - range.start;
  if (count >= b.pages.length) return;
  const ok = await confirmAction({
    title: bw('Quitar ', 'Remove ', 'Remover ') + partName(id),
    message:
      count === 1
        ? bw(
            'Se quita su página, con lo que tenga.',
            'Its page is removed, with its content.',
            'A página é removida, com o conteúdo.',
          )
        : bw(
            `Se quitan sus ${count} páginas, con lo que tengan.`,
            `Its ${count} pages are removed, with their content.`,
            `As ${count} páginas são removidas, com o conteúdo.`,
          ),
    confirmLabel: bw('Quitar', 'Remove', 'Remover'),
    danger: true,
  });
  if (!ok) return;
  commit(() => {
    b.pages.splice(range.start, count);
    editor.active = editor.spread = Math.min(range.start, b.pages.length - 1);
    editor.selected = null;
  }, true);
}
