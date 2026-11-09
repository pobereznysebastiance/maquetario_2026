// Salida: textos de la ventana en el idioma actual, papel estándar y marcas de corte. No tiene
// efectos al cargar: se importa. El armado de las hojas, la ventana y el envío están en output.ts.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { Language } from './i18n.ts';
import { i18n } from './i18n/language.ts';

const outputWords = {
  es: {
    print: 'Imprimir',
    title: 'Preparar impresión',
    pdf: 'Preparar PDF',
    printer: 'Impresora de Windows',
    refresh: 'Actualizar impresoras',
    none: 'No hay impresoras instaladas en Windows.',
    loading: 'Buscando impresoras…',
    mode: 'Orden de páginas',
    reading: 'Páginas individuales',
    booklet: 'Cuadernillo para abrochado',
    paper: 'Papel de salida',
    custom: 'Tamaño del libro',
    trim: 'Marcas de corte',
    grid: 'Grilla de filas y columnas',
    guides: 'Guías individuales',
    margins: 'Líneas de márgenes',
    header: 'Cornisas y titulillos',
    folio: 'Foliado',
    copies: 'Copias',
    duplex: 'Impresión doble faz',
    one: 'Una cara',
    short: 'Doble faz · borde corto',
    long: 'Doble faz · borde largo',
    send: 'Imprimir ahora',
    save: 'Guardar PDF',
    fit: 'Reducir si no entra en el papel',
    safe: 'Sin enviar nada hasta pulsar Imprimir ahora.',
    note: 'Las marcas de corte necesitan espacio alrededor del formato final. Se reserva un margen de 7 mm. Algunas impresoras tienen bordes no imprimibles: revisá el papel y sus capacidades.',
    preview: 'Vista previa de la primera cara',
    done: 'Trabajo enviado a la impresora.',
    wait: 'Preparando salida…',
    error: 'No se pudo completar la salida: ',
    unavailable: 'Seleccioná una impresora disponible.',
    sizeError:
      'El formato no entra en el papel con las opciones elegidas. Permití reducir o elegí un papel mayor.',
    sheets: 'caras de salida',
    noDuplex: 'Esta impresora no informa soporte de doble faz automática.',
    guidesNote: 'La grilla se puede imprimir aunque esté oculta en el editor.',
  },
  en: {
    print: 'Print',
    title: 'Prepare printing',
    pdf: 'Prepare PDF',
    printer: 'Windows printer',
    refresh: 'Refresh printers',
    none: 'No printers are installed in Windows.',
    loading: 'Finding printers…',
    mode: 'Page order',
    reading: 'Individual pages',
    booklet: 'Saddle-stitch booklet',
    paper: 'Output paper',
    custom: 'Book size',
    trim: 'Crop marks',
    grid: 'Row and column grid',
    guides: 'Individual guides',
    margins: 'Margin guides',
    header: 'Headers and running titles',
    folio: 'Page numbers',
    copies: 'Copies',
    duplex: 'Two-sided printing',
    one: 'One side',
    short: 'Two sides · short edge',
    long: 'Two sides · long edge',
    send: 'Print now',
    save: 'Save PDF',
    fit: 'Shrink if needed to fit paper',
    safe: 'Nothing is sent until you click Print now.',
    note: 'Crop marks need space around the trim size. A 7 mm margin is reserved. Some printers have unprintable edges: check the paper and printer capabilities.',
    preview: 'First side preview',
    done: 'Job sent to the printer.',
    wait: 'Preparing output…',
    error: 'Could not complete output: ',
    unavailable: 'Select an available printer.',
    sizeError:
      'The book does not fit on the selected paper. Allow shrinking or choose larger paper.',
    sheets: 'output sides',
    noDuplex: 'This printer does not report automatic duplex support.',
    guidesNote: 'The grid can be printed even when hidden in the editor.',
  },
  pt: {
    print: 'Imprimir',
    title: 'Preparar impressão',
    pdf: 'Preparar PDF',
    printer: 'Impressora do Windows',
    refresh: 'Atualizar impressoras',
    none: 'Não há impressoras instaladas no Windows.',
    loading: 'Buscando impressoras…',
    mode: 'Ordem das páginas',
    reading: 'Páginas individuais',
    booklet: 'Livreto para grampo central',
    paper: 'Papel de saída',
    custom: 'Tamanho do livro',
    trim: 'Marcas de corte',
    grid: 'Grade de linhas e colunas',
    guides: 'Guias individuais',
    margins: 'Linhas de margens',
    header: 'Cabeçalhos e títulos correntes',
    folio: 'Numeração',
    copies: 'Cópias',
    duplex: 'Impressão frente e verso',
    one: 'Um lado',
    short: 'Frente e verso · borda curta',
    long: 'Frente e verso · borda longa',
    send: 'Imprimir agora',
    save: 'Salvar PDF',
    fit: 'Reduzir se necessário para caber',
    safe: 'Nada é enviado antes de clicar em Imprimir agora.',
    note: 'As marcas de corte precisam de espaço ao redor do formato final. Uma margem de 7 mm é reservada. Algumas impressoras têm bordas não imprimíveis: confira o papel e seus recursos.',
    preview: 'Prévia da primeira face',
    done: 'Trabalho enviado à impressora.',
    wait: 'Preparando saída…',
    error: 'Não foi possível concluir a saída: ',
    unavailable: 'Selecione uma impressora disponível.',
    sizeError:
      'O formato não cabe no papel selecionado. Permita reduzir ou escolha um papel maior.',
    sheets: 'faces de saída',
    noDuplex: 'Esta impressora não informa suporte automático a frente e verso.',
    guidesNote: 'A grade pode ser impressa mesmo quando está oculta no editor.',
  },
};
export type OutputWords = (typeof outputWords)['es'];
/** Textos de la salida en el idioma actual. */
export const ow = (): OutputWords => outputWords[(i18n.language || 'es') as Language];

/** Papel estándar (mm), girado para que la pieza entre a mayor escala. */
export function outputPaperDimensions(
  format: string,
  artworkWidth: number,
  artworkHeight: number,
  pad = 0,
): [number, number] {
  const [width, height] = (
    {
      A5: [148, 210],
      A4: [210, 297],
      A3: [297, 420],
      Letter: [215.9, 279.4],
    } as Record<string, [number, number]>
  )[format] || [210, 297];
  const scale = (w: number, h: number) =>
    Math.min((w - 2 * pad) / artworkWidth, (h - 2 * pad) / artworkHeight);
  return scale(height, width) > scale(width, height) ? [height, width] : [width, height];
}

/** Marcas de corte alrededor del formato final (mm). */
export function cropSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  pw: number,
  ph: number,
): string {
  let lines: string[] = [];
  const length = 4,
    gap = 1.5;
  for (const a of [x, x + w])
    for (const b of [y, y + h]) {
      const left = a === x,
        top = b === y;
      lines.push(
        `M${a + (left ? -gap - length : gap)} ${b}h${length}`,
        `M${a} ${b + (top ? -gap - length : gap)}v${length}`,
      );
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="crop-marks" viewBox="0 0 ${pw} ${ph}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><path d="${lines.join(' ')}" fill="none" stroke="#111" stroke-width=".15"/></svg>`;
}
