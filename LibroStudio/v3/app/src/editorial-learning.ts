// Aprender: glosario editorial (la sección "Glosario" del centro de Ayuda, con búsqueda y
// categorías), ayudas "?" junto a los términos del inspector (abren el término en la Ayuda) y
// "Glosario editorial" en la bienvenida. También suma la orientación del lomo a la cubierta.
//
// editorialTerms, glossaryMatches, renderGlossary y showGlossary son globales: los usan
// tests/learning-tests.js y scripts/style-snapshot.js.
//
// Fuente TypeScript: se compila a build/editorial-learning.js (desktop/scripts/build.mjs).
'use strict';
import type { CoverDesign } from './publications.ts';
import { glossaryHelpSection, renderGlossary } from './components/help/Glossary.tsx';
import { bw } from './i18n/language.ts';
import { closeSheet } from './components/dialog/dialogs.tsx';
import { foldEditorial } from './text-fold.ts';

/** Texto en castellano, inglés y portugués. */
type Words = [string, string, string];

export type GlossaryCategory = 'layout' | 'type' | 'production';

/** Término del glosario: id, categoría, nombre, definición, ejemplo y pestaña (o 'cover', 'output') donde se usa. */
export type EditorialTerm = [
  id: string,
  category: GlossaryCategory,
  name: Words,
  definition: Words,
  example: Words,
  target: string,
];

declare global {
  /** Los términos del glosario. */
  var editorialTerms: EditorialTerm[];
  /** Texto sin tildes y en minúsculas, para buscar. */
  var foldEditorial: (s: string) => string;
  /** Abre el glosario en un término (si no existe, en "grid"). */
  var showGlossary: (term?: string) => void;
  /** Términos que coinciden con la búsqueda, en una categoría o en todas ('all'). */
  var glossaryMatches: (query: string, category: string) => EditorialTerm[];
  /** Vuelve a dibujar la lista y la definición del glosario abierto. */
  var renderGlossary: () => void;
}

// Short original definitions; glossary knowledge does not imply automatic correction features.
const editorialTerms: EditorialTerm[] = [
  [
    'grid',
    'layout',
    ['Retícula / grilla', 'Grid', 'Grade / retícula'],
    [
      'Estructura de columnas y filas que ordena la composición de una página.',
      'A system of columns and rows that organizes page composition.',
      'Estrutura de colunas e linhas que organiza a composição da página.',
    ],
    [
      'Una grilla de 5 × 10 permite agrupar módulos para combinar texto e imágenes.',
      'A 5 × 10 grid lets you group modules to combine text and images.',
      'Uma grade 5 × 10 permite agrupar módulos para combinar texto e imagens.',
    ],
    'design',
  ],
  [
    'gutter',
    'layout',
    ['Medianil', 'Gutter', 'Espaço entre colunas'],
    [
      'Espacio entre columnas o módulos. En encuadernación, también puede nombrar la zona interior entre páginas.',
      'Space between columns or modules. In binding, gutter can also mean the inner space between facing pages.',
      'Espaço entre colunas ou módulos. Na encadernação, também pode indicar a área interna entre páginas.',
    ],
    [
      'Separá dos columnas con un medianil de 4 mm.',
      'Separate two columns with a 4 mm gutter.',
      'Separe duas colunas com um espaço de 4 mm.',
    ],
    'design',
  ],
  [
    'margin',
    'layout',
    ['Márgenes', 'Margins', 'Margens'],
    [
      'Espacios entre el contenido principal y los bordes de la página. El interior queda junto a la encuadernación.',
      'Spaces between main content and page edges. The inside margin is next to the binding.',
      'Espaços entre conteúdo principal e bordas. A margem interna fica junto à encadernação.',
    ],
    [
      'Un margen interior amplio puede mejorar la lectura cerca del lomo.',
      'A wider inside margin can help reading near the spine.',
      'Uma margem interna maior pode ajudar a leitura perto da lombada.',
    ],
    'design',
  ],
  [
    'module',
    'layout',
    ['Módulo', 'Module', 'Módulo'],
    [
      'Unidad rectangular formada por la intersección de columnas y filas de la grilla.',
      'A rectangular unit formed by intersecting grid columns and rows.',
      'Unidade retangular formada pelo encontro de colunas e linhas da grade.',
    ],
    [
      'Una imagen puede ocupar dos columnas y tres filas de módulos.',
      'An image can span two columns and three rows of modules.',
      'Uma imagem pode ocupar duas colunas e três linhas de módulos.',
    ],
    'design',
  ],
  [
    'guide',
    'layout',
    ['Guías', 'Guides', 'Guias'],
    [
      'Líneas de referencia para alinear elementos; normalmente no forman parte del diseño impreso.',
      'Reference lines used to align elements; normally not part of the printed design.',
      'Linhas de referência para alinhar elementos; normalmente não fazem parte do impresso.',
    ],
    [
      'Una guía vertical ayuda a alinear pies de imagen en varias páginas.',
      'A vertical guide helps align captions across pages.',
      'Uma guia vertical ajuda a alinhar legendas entre páginas.',
    ],
    'design',
  ],
  [
    'folio',
    'layout',
    ['Folio y foliado', 'Folio and pagination', 'Fólio e paginação'],
    [
      'El folio es el número de página; el foliado es el sistema que lo asigna y presenta a lo largo del libro.',
      'A folio is a page number; pagination is the system for assigning and presenting page numbers.',
      'O fólio é o número da página; a paginação é o sistema que o atribui e apresenta.',
    ],
    [
      'Ocultá el folio de una portada sin quitar esa página del libro.',
      'Hide a title-page folio without removing the page.',
      'Oculte o fólio da folha de rosto sem remover a página.',
    ],
    'design',
  ],
  [
    'header',
    'layout',
    ['Cornisa / titulillo', 'Running header / title', 'Cabeçalho / título corrente'],
    [
      'Texto recurrente que orienta al lector, como el título del libro o del capítulo. Los nombres varían según la tradición editorial.',
      'Recurring text that guides readers, such as a book or chapter title. Terminology varies between editorial traditions.',
      'Texto recorrente que orienta o leitor, como o título do livro ou capítulo. A terminologia varia conforme a tradição editorial.',
    ],
    [
      'Libro en páginas pares y capítulo en impares.',
      'Book title on even pages and chapter title on odd pages.',
      'Título do livro nas páginas pares e capítulo nas ímpares.',
    ],
    'design',
  ],
  [
    'rule',
    'layout',
    ['Miscelánea / filete', 'Ornament / rule', 'Ornamento / fio'],
    [
      'Recurso gráfico decorativo o de separación. Un filete es una línea; no toda miscelánea tiene forma de línea.',
      'A decorative or separating graphic device. A rule is a line; ornaments can take other shapes.',
      'Recurso gráfico decorativo ou de separação. Um fio é uma linha; ornamentos podem ter outras formas.',
    ],
    [
      'Un filete fino puede separar la cornisa del cuerpo de texto.',
      'A thin rule can separate a header from body text.',
      'Um fio fino pode separar o cabeçalho do corpo do texto.',
    ],
    'design',
  ],
  [
    'leading',
    'type',
    ['Interlineado', 'Leading', 'Entrelinha'],
    [
      'Distancia entre las líneas base de dos líneas de texto consecutivas.',
      'Distance between the baselines of consecutive text lines.',
      'Distância entre as linhas de base de linhas de texto consecutivas.',
    ],
    [
      '11/15 indica cuerpo de 11 puntos e interlineado de 15 puntos.',
      '11/15 means 11-point type with 15-point leading.',
      '11/15 indica corpo 11 e entrelinha 15 pontos.',
    ],
    'text',
  ],
  [
    'size',
    'type',
    ['Cuerpo tipográfico', 'Type size', 'Corpo tipográfico'],
    [
      'Tamaño nominal de la tipografía, expresado habitualmente en puntos; no equivale a la altura visible exacta de sus letras.',
      'Nominal type size, usually in points; it is not the exact visible letter height.',
      'Tamanho nominal da fonte, geralmente em pontos; não é a altura visível exata das letras.',
    ],
    [
      'Dos familias en 11 puntos pueden parecer de distinto tamaño.',
      'Two families at 11 points can look different in size.',
      'Duas famílias em 11 pontos podem parecer de tamanhos diferentes.',
    ],
    'text',
  ],
  [
    'tracking',
    'type',
    ['Tracking', 'Tracking', 'Tracking'],
    [
      'Ajuste uniforme del espaciado entre caracteres de un tramo de texto.',
      'Uniform spacing adjustment across characters in a text range.',
      'Ajuste uniforme do espaço entre caracteres de um trecho de texto.',
    ],
    [
      'Usá pequeños ajustes y comprobá la legibilidad del párrafo.',
      'Use small adjustments and check paragraph legibility.',
      'Use ajustes pequenos e confira a legibilidade do parágrafo.',
    ],
    'text',
  ],
  [
    'kerning',
    'type',
    ['Kerning', 'Kerning', 'Kerning'],
    [
      'Ajuste de espacio entre pares concretos de caracteres, distinto del tracking de un conjunto.',
      'Spacing adjustment between specific character pairs, unlike tracking across a range.',
      'Ajuste entre pares específicos de caracteres, diferente do tracking de um conjunto.',
    ],
    [
      'El par AV puede necesitar una compensación óptica. Maquetario todavía no ofrece ajuste manual por par.',
      'The AV pair may need optical compensation. Maquetario does not yet offer manual pair adjustment.',
      'O par AV pode precisar de compensação óptica. O Maquetario ainda não oferece ajuste manual por par.',
    ],
    'text',
  ],
  [
    'indent',
    'type',
    ['Sangría', 'Indent', 'Recuo'],
    [
      'Desplazamiento de una línea o de los bordes de un párrafo respecto de la caja de texto.',
      'Offset of a line or paragraph edges relative to its text frame.',
      'Deslocamento de uma linha ou bordas de um parágrafo em relação à caixa de texto.',
    ],
    [
      'Una primera línea de 4 mm distingue párrafos sin líneas vacías.',
      'A 4 mm first-line indent distinguishes paragraphs without blank lines.',
      'Um recuo inicial de 4 mm distingue parágrafos sem linhas em branco.',
    ],
    'text',
  ],
  [
    'style',
    'type',
    ['Estilo de párrafo', 'Paragraph style', 'Estilo de parágrafo'],
    [
      'Conjunto guardado de atributos tipográficos y de párrafo que puede aplicarse de forma consistente.',
      'A saved set of type and paragraph attributes for consistent application.',
      'Conjunto salvo de atributos tipográficos e de parágrafo para aplicação consistente.',
    ],
    [
      'Al cambiar Cuerpo de novela, se actualizan los párrafos vinculados.',
      'Editing Novel body updates linked paragraphs.',
      'Alterar Corpo do romance atualiza os parágrafos vinculados.',
    ],
    'text',
  ],
  [
    'overset',
    'type',
    ['Texto desbordado', 'Overset text', 'Texto excedente'],
    [
      'Texto que existe en una caja pero no entra en el espacio visible disponible.',
      'Text that exists in a frame but does not fit in its available visible space.',
      'Texto existente em uma caixa que não cabe no espaço visível disponível.',
    ],
    [
      'El signo + rojo avisa: ampliá la caja o revisá cuerpo e interlineado.',
      'A red + warns you: enlarge the frame or review type size and leading.',
      'O sinal + vermelho avisa: aumente a caixa ou revise corpo e entrelinha.',
    ],
    'text',
  ],
  [
    'justification',
    'type',
    ['Justificación', 'Justification', 'Justificação'],
    [
      'Alineación del párrafo a ambos lados mediante ajustes de espaciado. Puede producir huecos si la columna es estrecha.',
      'Paragraph alignment to both edges by spacing adjustments. Narrow columns can produce gaps.',
      'Alinhamento do parágrafo às duas bordas por ajustes de espaçamento. Colunas estreitas podem gerar espaços excessivos.',
    ],
    [
      'Revisá los blancos del párrafo, no solo sus bordes.',
      'Review spaces inside the paragraph, not only its edges.',
      'Revise os espaços no parágrafo, não apenas suas bordas.',
    ],
    'text',
  ],
  [
    'bleed',
    'production',
    ['Sangrado', 'Bleed', 'Sangria'],
    [
      'Extensión de fondos e imágenes más allá del corte final para tolerar pequeñas variaciones de guillotinado.',
      'Extension of backgrounds and images beyond trim to allow small cutting variations.',
      'Extensão de fundos e imagens além do corte final para tolerar pequenas variações de corte.',
    ],
    [
      'En la cubierta, el sangrado se añade al contorno exterior del desplegado.',
      'On the cover, bleed is added around the outer spread.',
      'Na capa, a sangria vai no contorno externo da peça aberta.',
    ],
    'cover',
  ],
  [
    'trim',
    'production',
    ['Corte y marcas de corte', 'Trim and crop marks', 'Corte e marcas de corte'],
    [
      'El corte define el tamaño final. Las marcas externas indican dónde recortar el impreso.',
      'Trim defines the finished size. External crop marks indicate where to cut the print.',
      'O corte define o tamanho final. Marcas externas indicam onde cortar o impresso.',
    ],
    [
      'Las marcas deben quedar fuera del diseño final.',
      'Marks should remain outside the finished design.',
      'As marcas devem ficar fora do desenho final.',
    ],
    'cover',
  ],
  [
    'safety',
    'production',
    ['Zona de seguridad', 'Safe area', 'Área de segurança'],
    [
      'Área interior de reserva para mantener textos y detalles importantes lejos de cortes y pliegues.',
      'Interior clearance that keeps text and important details away from cuts and folds.',
      'Reserva interna que mantém textos e detalhes importantes longe de cortes e dobras.',
    ],
    [
      'Dejá espacio entre la biografía de una solapa y su pliegue.',
      'Leave space between flap biography text and the fold.',
      'Deixe espaço entre a biografia na orelha e a dobra.',
    ],
    'cover',
  ],
  [
    'spine',
    'production',
    ['Lomo', 'Spine', 'Lombada'],
    [
      'Parte de la cubierta que une tapa y contratapa. Su ancho depende de la encuadernación y del bloque de papel.',
      'Cover section joining front and back. Its width depends on binding and the paper block.',
      'Parte da capa que une frente e verso. Sua largura depende da encadernação e do bloco de papel.',
    ],
    [
      'Pedí a la imprenta la medida final antes de cerrar el diseño.',
      'Ask the printer for the final width before finishing the design.',
      'Peça à gráfica a largura final antes de finalizar o desenho.',
    ],
    'cover',
  ],
  [
    'flap',
    'production',
    ['Solapa', 'Cover flap', 'Orelha'],
    [
      'Extensión de la cubierta que se pliega hacia el interior; puede contener biografía, reseñas u otros datos.',
      'Cover extension folded inward; it can hold biography, reviews or other information.',
      'Extensão da capa dobrada para dentro; pode conter biografia, resenhas ou outros dados.',
    ],
    [
      'Una solapa de 70 mm forma parte del ancho total desplegado.',
      'A 70 mm flap contributes to the total spread width.',
      'Uma orelha de 70 mm faz parte da largura total aberta.',
    ],
    'cover',
  ],
  [
    'imposition',
    'production',
    ['Imposición', 'Imposition', 'Imposição'],
    [
      'Orden y orientación de páginas en pliegos para que queden en secuencia después de imprimir, plegar y encuadernar.',
      'Page order and orientation on sheets so pages read in sequence after printing, folding and binding.',
      'Ordem e orientação das páginas nas folhas para ficarem em sequência após impressão, dobra e encadernação.',
    ],
    [
      'Una imprenta puede pedir páginas consecutivas y hacer ella la imposición.',
      'A printer may ask for sequential pages and handle imposition itself.',
      'Uma gráfica pode pedir páginas consecutivas e fazer a imposição.',
    ],
    'output',
  ],
  [
    'resolution',
    'production',
    ['Resolución · ppp', 'Resolution · ppi', 'Resolução · ppp'],
    [
      'Cantidad de píxeles de imagen por pulgada al tamaño colocado. Cambia si se agranda o reduce la imagen.',
      'Image pixels per inch at placed size. It changes when the image is enlarged or reduced.',
      'Pixels de imagem por polegada no tamanho aplicado. Muda ao ampliar ou reduzir a imagem.',
    ],
    [
      '300 ppp es una referencia frecuente, no una garantía universal de calidad.',
      '300 ppi is a common reference, not a universal guarantee of quality.',
      '300 ppp é referência comum, não garantia universal de qualidade.',
    ],
    'cover',
  ],
  [
    'contents',
    'layout',
    ['Índice de contenidos', 'Table of contents', 'Sumário'],
    [
      'Listado de partes y capítulos con referencias a las páginas donde comienzan.',
      'A list of parts and chapters with references to their starting pages.',
      'Lista de partes e capítulos com referências às páginas iniciais.',
    ],
    [
      'En Maquetario las entradas vinculadas siguen a sus páginas si se reordenan.',
      'Linked entries in Maquetario follow their pages when reordered.',
      'Entradas vinculadas no Maquetario acompanham as páginas ao reordenar.',
    ],
    'index',
  ],
];
globalThis.editorialTerms = editorialTerms;
const glossaryCategory: Record<GlossaryCategory, Words> = {
  layout: ['Composición', 'Layout', 'Composição'],
  type: ['Tipografía', 'Typography', 'Tipografia'],
  production: ['Producción', 'Production', 'Produção'],
};
/** Sección "Glosario" del centro de Ayuda (React, components/help/Glossary.tsx). */
registerHelpSection(
  glossaryHelpSection({
    categories: glossaryCategory,
    openTool: (t) => {
      // El glosario está en el centro de Ayuda (Ventana de React): se cierra antes de ir.
      closeSheet();
      if (!hasDocument) {
        toast(
          bw(
            'Creá o abrí un libro para usar las herramientas.',
            'Create or open a book to use the tools.',
            'Crie ou abra um livro para usar as ferramentas.',
          ),
          'info',
        );
        return;
      }
      setTimeout(() => {
        if (t[5] === 'cover') coverEditor();
        else if (t[5] === 'output') outputDialog('pdf');
        else showTab(t[5]);
      }, 30);
    },
  }),
);
/** Abre el glosario del centro de Ayuda en un término (si no existe, en "grid"). */
function showGlossary(term = 'grid'): void {
  openHelp('glossary', term);
}
globalThis.showGlossary = showGlossary;
function glossaryMatches(query: string, category: string): EditorialTerm[] {
  const q = foldEditorial(query);
  return editorialTerms.filter(
    (t) =>
      (category === 'all' || t[1] === category) &&
      foldEditorial([...t[2], ...t[3]].join(' ')).includes(q),
  );
}
globalThis.glossaryMatches = glossaryMatches;
globalThis.renderGlossary = renderGlossary;
globalThis.showWelcome = showWelcome;
// The direction is cover data, so preview, save/open and PDF share the same value.
extend.result(
  'validateCover',
  function (_: unknown, c: CoverDesign) {
    if (c.parts.spine.direction !== undefined && !['down', 'up'].includes(c.parts.spine.direction))
      throw Error(
        bw(
          'Orientación de lomo inválida.',
          'Invalid spine direction.',
          'Orientação de lombada inválida.',
        ),
      );
    return c;
  },
  'editorial-learning',
);
extend.result(
  'coverArtwork',
  function (art: HTMLElement, c: CoverDesign, px: number, guides = false, crop = false) {
    const spine = art.querySelector<HTMLElement>('[data-cover-part="spine"] .cover-text');
    if (spine)
      spine.style.transform = `translate(-50%,-50%) rotate(${c.parts.spine.direction === 'up' ? -90 : 90}deg)`;
    return art;
  },
  'editorial-learning',
);
