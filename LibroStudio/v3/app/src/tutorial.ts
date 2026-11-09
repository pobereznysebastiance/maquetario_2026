// Tutorial guiado: las lecciones (una por sección de la interfaz, en castellano, inglés y
// portugués) y la tarjeta que las recorre: avanzar, volver, saltar a un capítulo y abrir la
// sección de cada lección. El paso actual se recuerda en localStorage.
//
// Son globales:
// - guideLessons y lesson: review-tutorial.ts suma lecciones, inspector-organization.js y
//   editor-controls.ts las leen; las pruebas (welcome-tests) las revisan.
// - tutorialIndex y tutorialCard: los usa el foco del tutorial (editor-controls.ts). El índice
//   vive en globalThis porque lo leen otros archivos.
// - startTutorial, closeTutorial y showTutorialStep: los llaman welcome.js, la autoprueba y las
//   pruebas, y los extienden review-workspace.js (startTutorial) y editor-controls.ts (los otros
//   dos). Por eso closeTutorial y showTutorialStep se llaman acá por su nombre global, no por uno
//   local: así también pasan por esas extensiones, como antes.
//
// También registra la sección "Tutorial guiado" del centro de Ayuda (help-center.ts).
//
// Fuente TypeScript: se compila a build/tutorial.js (desktop/scripts/build.mjs).

import { tutorialHelpSection } from './components/help/sections.tsx';

/** Una lección del tutorial (title, body y task: castellano, inglés y portugués). */
export interface GuideLesson {
  id: string;
  tab: string;
  target: string;
  title: string[];
  body: string[];
  task: string[];
  action: string;
}

declare global {
  /** Lecciones en orden de recorrido. */
  var guideLessons: GuideLesson[];
  /** Suma una lección al final del recorrido. */
  var lesson: (
    id: string,
    tab: string,
    target: string,
    title: string[],
    body: string[],
    task: string[],
    action?: string,
  ) => void;
  /** Índice de la lección que muestra la tarjeta. */
  var tutorialIndex: number;
  /** Tarjeta flotante del tutorial. */
  var tutorialCard: HTMLElement;
  /** Abre el tutorial en la lección index (o en la última vista). */
  var startTutorial: (index?: number) => void;
  /** Pausa el tutorial: esconde la tarjeta y saca el resaltado. */
  var closeTutorial: () => void;
  /** Muestra la lección index: abre su pestaña, resalta el control y arma la tarjeta. */
  var showTutorialStep: (index: number) => void;
}

const guideLessons: GuideLesson[] = [];
function lesson(
  id: string,
  tab: string,
  target: string,
  title: string[],
  body: string[],
  task: string[],
  action = '',
): void {
  guideLessons.push({ id, tab, target, title, body, task, action });
}
globalThis.guideLessons = guideLessons;
globalThis.lesson = lesson;
lesson(
  'intro',
  'design',
  '.brand',
  [
    'Tu primer libro en Maquetario',
    'Your first book in Maquetario',
    'Seu primeiro livro no Maquetario',
  ],
  [
    'Este recorrido te acompaña por todas las secciones. Podés aplicarlo a tu libro actual: el tutorial solo abre paneles y señala controles; vos decidís qué cambios hacer. Usá el selector de capítulos para saltar a un tema y las flechas para continuar. Tu progreso se recuerda en este equipo.',
    'This tour covers every section. Use your current book: the tour opens panels and highlights controls, while you decide what to change. Jump to a topic with the chapter selector or continue with the arrows. Your progress is remembered on this computer.',
    'Este percurso passa por todas as seções. Use seu livro atual: o tutorial abre painéis e destaca controles; você decide o que alterar. Pule para um tema pelo seletor ou continue com as setas. O progresso fica salvo neste computador.',
  ],
  [
    'Empezá con el ejemplo o con un libro propio. No hace falta terminar el recorrido de una vez.',
    'Start with the example or your own book. You can pause and resume at any time.',
    'Comece pelo exemplo ou por seu livro. Você pode pausar e retomar a qualquer momento.',
  ],
);
lesson(
  'format',
  'design',
  '#documentSettings',
  ['1. Crear el formato del libro', '1. Set the book format', '1. Defina o formato do livro'],
  [
    'En Configurar libro elegí A3, A4, A5, A6, Carta, Oficio, 17 × 24, 20 × 20 o medidas personalizadas. Podés trabajar en mm o cm y cambiar la orientación. Las medidas representan el tamaño final de cada página, no el papel donde después vas a imprimir. Activá páginas enfrentadas si querés componer dobles páginas.',
    'Book settings includes A3, A4, A5, A6, Letter, Oficio, 17 × 24, 20 × 20 and custom sizes. Choose millimeters or centimeters and portrait or landscape. These are final page dimensions, not printer paper size. Enable facing pages to design spreads.',
    'Configurar livro oferece A3, A4, A5, A6, Carta, Ofício, 17 × 24, 20 × 20 e medidas personalizadas. Escolha mm ou cm e a orientação. As medidas são da página final, não do papel da impressora. Ative páginas espelhadas para diagramar duplas.',
  ],
  [
    'Probá A5 vertical. Si ya maquetaste contenido, revisá las cajas después de cambiar el formato; podés deshacer.',
    'Try portrait A5. If you already have content, check frames after resizing; you can undo.',
    'Experimente A5 vertical. Se já houver conteúdo, confira as caixas após alterar o formato; você pode desfazer.',
  ],
  'settings',
);
lesson(
  'pages',
  'pages',
  '[data-tab="page"]',
  ['2. Organizar las páginas', '2. Organize pages', '2. Organize as páginas'],
  [
    'Hacé clic en una página para activarla. Las miniaturas permiten cambiar de doble página. En la pestaña Página podés agregar, duplicar, eliminar o mover la página activa antes o después. Los folios se recalculan. Eliminar una página también quita sus objetos; Deshacer permite recuperarla.',
    'Click a page to activate it and use thumbnails to switch spreads. The Page tab lets you add, duplicate, delete or move the active page earlier or later. Page numbers recalculate. Deleting a page removes its objects too; Undo restores it.',
    'Clique em uma página para ativá-la e use as miniaturas para mudar de dupla. Na aba Página, adicione, duplique, exclua ou mova a página ativa. Os números são recalculados. Excluir a página remove seus objetos; Desfazer permite recuperá-la.',
  ],
  [
    'Agregá una página vacía y movela con Antes o Después. Comprobá su nueva numeración.',
    'Add an empty page, move it earlier or later, and check its new number.',
    'Adicione uma página vazia, mova para antes ou depois e confira sua numeração.',
  ],
);
lesson(
  'margins',
  'design',
  '[data-bind="margins.top"]',
  ['3. Definir márgenes', '3. Define margins', '3. Defina as margens'],
  [
    'Los márgenes superior e inferior dejan espacio sobre y bajo la composición. Interior corresponde al lomo; exterior, al borde libre. En páginas enfrentadas se espejan automáticamente. Las líneas de margen son guías y no salen en el PDF salvo que las actives en las opciones de salida.',
    'Top and bottom margins reserve space around the composition. Inside is the spine side, outside the free edge. Facing pages mirror these margins automatically. Margin lines are guides and do not appear in output unless explicitly enabled.',
    'As margens superior e inferior reservam espaço ao redor da composição. Interna é o lado da lombada; externa, o lado livre. Em páginas espelhadas, elas são invertidas automaticamente. As linhas não saem no arquivo, a menos que você as ative na saída.',
  ],
  [
    'Como punto de partida, probá 20 mm de margen y revisá el espacio para cornisas y folios.',
    'Try 20 mm as a starting point and leave room for headers and page numbers.',
    'Experimente 20 mm como ponto de partida e reserve espaço para cabeçalhos e números.',
  ],
);
lesson(
  'grid',
  'design',
  '[data-bind="grid.cols"]',
  ['4. Construir la grilla', '4. Build the grid', '4. Construa a grade'],
  [
    'Columnas divide el ancho y Filas divide el alto. El medianil horizontal separa columnas; el vertical separa filas. Ajustar a los márgenes limita los módulos al área útil; ajustar al borde usa toda la página. La grilla orienta tu composición, pero no divide automáticamente el contenido de una caja de texto.',
    'Columns divide width and rows divide height. Horizontal gutters separate columns; vertical gutters separate rows. Fit to margins uses the content area; fit to page uses the full page. The grid guides your layout but does not automatically split text into columns.',
    'Colunas dividem a largura e linhas dividem a altura. O espaçamento horizontal separa colunas; o vertical separa linhas. Ajustar às margens usa a área útil; ajustar à página usa toda a folha. A grade orienta a composição, mas não divide automaticamente o texto de uma caixa.',
  ],
  [
    'Probá 3 columnas, 6 filas y 5 mm entre columnas. Alterná el ajuste a margen o página para comparar.',
    'Try 3 columns, 6 rows and a 5 mm column gutter. Compare fitting to margins and page.',
    'Experimente 3 colunas, 6 linhas e 5 mm entre colunas. Compare os ajustes às margens e à página.',
  ],
);
lesson(
  'guides',
  'design',
  '#inspectorContent',
  ['5. Agregar guías particulares', '5. Add individual guides', '5. Adicione guias individuais'],
  [
    'En Grilla, abrí Guías individuales y elegí Agregar guía. Indicá orientación y distancia desde el borde superior o izquierdo. Se aplica a todas las páginas y sirve para alinear elementos que no coinciden con la grilla. Quitá una guía con la cruz de su fila.',
    'In Grid, expand Individual guides and choose Add guide. Set orientation and distance from the top or left edge. The guide applies to every page and helps align elements outside the regular grid. Remove one with the cross beside it.',
    'Em Grade, abra Guias individuais e Adicionar guia. Informe a orientação e a distância da borda superior ou esquerda. A guia vale para todas as páginas e ajuda a alinhar elementos fora da grade. Remova pela cruz da linha.',
  ],
  [
    'Agregá una guía horizontal para ubicar el comienzo de los títulos de capítulo.',
    'Add a horizontal guide for the starting position of chapter headings.',
    'Adicione uma guia horizontal para o início dos títulos de capítulo.',
  ],
);
lesson(
  'select',
  'text',
  '[data-tool="select"]',
  ['6. Seleccionar y mover', '6. Select and move', '6. Selecione e mova'],
  [
    'Usá Seleccionar, o V, para trabajar con la flecha. Un clic elige un objeto; arrastrar su interior lo mueve. El contorno azul indica selección. Para escribir necesitás doble clic sobre texto: ahí aparece el cursor de escritura. Escape termina la edición y vuelve a seleccionar.',
    'Use Select, or V, for the arrow tool. Click to select an object and drag inside it to move. A blue outline shows selection. Double-click text to enter typing mode. Escape finishes editing and returns to selection.',
    'Use Selecionar, ou V, para a ferramenta de seta. Clique para selecionar um objeto e arraste seu interior para mover. O contorno azul indica seleção. Clique duas vezes no texto para escrever. Escape termina a edição e volta à seleção.',
  ],
  [
    'Seleccioná una caja y movela sin tocar sus controladores. El ancho y el alto deben conservarse.',
    'Select a frame and move it without touching handles. Width and height stay unchanged.',
    'Selecione uma caixa e mova sem tocar os controladores. A largura e a altura devem permanecer iguais.',
  ],
);
lesson(
  'resize',
  'text',
  '#spread',
  ['7. Cambiar ancho y alto', '7. Resize a frame', '7. Altere largura e altura'],
  [
    'Una caja seleccionada muestra ocho cuadrados: cuatro en las esquinas y cuatro en los lados. Los laterales cambian una dimensión; las esquinas cambian ambas. La caja crece desde el punto que arrastrás y conserva el borde opuesto. El texto se redistribuye sin cambiar su cuerpo. También podés ingresar medidas en Transformar objeto.',
    'A selected frame has eight squares: four corners and four edge centers. Edge handles change one dimension; corners change both. The opposite edge stays fixed. Text reflows without changing font size. You can also enter dimensions under Transform object.',
    'A caixa selecionada tem oito quadrados: quatro cantos e quatro centros dos lados. Os laterais alteram uma dimensão; os cantos alteram ambas. A borda oposta fica fixa. O texto se redistribui sem alterar o corpo. Também é possível informar medidas em Transformar objeto.',
  ],
  [
    'Arrastrá el controlador derecho para cambiar el ancho. Después probá el superior izquierdo.',
    'Drag the right handle to change width, then try the top-left corner.',
    'Arraste o controlador direito para mudar a largura e depois experimente o canto superior esquerdo.',
  ],
);
lesson(
  'snap',
  'design',
  '#snapButton',
  ['8. Alinear con el imán', '8. Align with snapping', '8. Alinhe com o ímã'],
  [
    'Activá Imán en la barra que está sobre el lienzo. Al mover o redimensionar, los bordes cercanos encajan en márgenes, guías y límites de módulos, incluidos ambos lados del medianil. La tolerancia se mide en pantalla para conservar una sensación similar con distintos niveles de zoom. Alt suspende el ajuste mientras arrastrás.',
    'Enable Snap in the bar above the canvas. Nearby frame edges snap to margins, guides and module boundaries, including both sides of gutters. Tolerance is measured on screen for consistent behavior at different zoom levels. Hold Alt while dragging to bypass it.',
    'Ative Ímã na barra acima da tela. As bordas próximas se ajustam às margens, guias e limites dos módulos, incluindo os dois lados dos espaçamentos. A tolerância é medida na tela para funcionar bem em diferentes níveis de zoom. Segure Alt ao arrastar para suspender o ajuste.',
  ],
  [
    'Acercá un borde a una línea celeste. Compará el movimiento con Imán activado y con Alt presionado.',
    'Move an edge near a cyan line. Compare snapping with holding Alt.',
    'Aproxime uma borda da linha azul-clara. Compare o ajuste com o movimento segurando Alt.',
  ],
);
lesson(
  'text',
  'text',
  '[data-tool="text"]',
  ['9. Crear y editar texto', '9. Create and edit text', '9. Crie e edite texto'],
  [
    'Elegí Texto o Cuadro de texto y hacé clic dentro de la página para crear una caja. Escribí o pegá el contenido. Podés volver a editar con doble clic o Editar contenido. Cada caja mantiene su texto: todavía no hay encadenamiento automático entre cajas o páginas. Guardá antes de cambios grandes.',
    'Choose Text or Text frame and click a page to create a frame. Type or paste content. Double-click or use Edit content to return to typing. Each frame holds its own text: automatic threading between frames or pages is not available yet. Save before major edits.',
    'Escolha Texto ou Caixa de texto e clique na página para criar uma caixa. Escreva ou cole conteúdo. Volte a editar com clique duplo ou Editar conteúdo. Cada caixa mantém seu texto: ainda não há encadeamento automático entre caixas ou páginas. Salve antes de grandes mudanças.',
  ],
  [
    'Creá un título y un párrafo en cajas separadas para poder componerlos con libertad.',
    'Create a heading and paragraph in separate frames so you can position them independently.',
    'Crie um título e um parágrafo em caixas separadas para posicioná-los livremente.',
  ],
);
lesson(
  'fonts',
  'text',
  '[data-object="font"]',
  ['10. Elegir familia y estilo', '10. Choose family and style', '10. Escolha família e estilo'],
  [
    'Seleccioná una caja de texto y buscá una familia en Texto. Peso / estilo muestra las variantes reales detectadas, como Regular, Medium, Bold o Italic. En Fuentes de tu equipo podés agregar una carpeta TTF, OTF o TTC; también se leen subcarpetas. Volver a leer fuentes actualiza el catálogo.',
    'Select a text frame and search for a family in Text. Weight / style shows actual detected variants such as Regular, Medium, Bold and Italic. Fonts on your computer lets you add a TTF, OTF or TTC folder, including subfolders. Rescan refreshes the catalog.',
    'Selecione uma caixa e busque uma família em Texto. Peso / estilo mostra as variantes reais detectadas, como Regular, Medium, Bold e Italic. Em Fontes do seu computador, adicione uma pasta TTF, OTF ou TTC, incluindo subpastas. Reler atualiza o catálogo.',
  ],
  [
    'Elegí una familia con varios pesos y compará el título en Regular y Bold.',
    'Choose a family with several weights and compare Regular and Bold on the heading.',
    'Escolha uma família com vários pesos e compare Regular e Bold no título.',
  ],
);
lesson(
  'variables',
  'text',
  '#inspectorContent',
  ['11. Explorar fuentes variables', '11. Explore variable fonts', '11. Explore fontes variáveis'],
  [
    'Las fuentes variables muestran sus ejes debajo de Peso / estilo. Weight controla peso, Width ancho y Optical size el ajuste óptico, solo si la fuente incluye esos ejes. Podés elegir una instancia nombrada o mover los deslizadores. El proyecto recuerda los valores; en otra PC necesitás las mismas fuentes.',
    'Variable fonts show axes below Weight / style. Weight, Width and Optical size appear only when supported by the font. Choose a named instance or adjust sliders. The project remembers the values; editing on another computer requires the same fonts.',
    'Fontes variáveis mostram os eixos abaixo de Peso / estilo. Peso, largura e tamanho óptico aparecem somente quando existem na fonte. Escolha uma instância nomeada ou ajuste os controles. O projeto guarda os valores; em outro computador, você precisa das mesmas fontes.',
  ],
  [
    'Probá una fuente variable y mové su peso gradualmente. Revisá si cambia el desbordamiento.',
    'Try a variable font and adjust weight gradually. Check whether text overflow changes.',
    'Experimente uma fonte variável e ajuste o peso gradualmente. Confira se o texto passa a exceder a caixa.',
  ],
);
lesson(
  'paragraph',
  'text',
  '#inspectorContent',
  [
    '12. Ajustar composición tipográfica',
    '12. Refine typography',
    '12. Ajuste a composição tipográfica',
  ],
  [
    'Tamaño define el cuerpo e Interlineado la distancia entre líneas. Los botones eligen alineación izquierda, centrada, derecha o justificada. Carácter y párrafo incluye tracking, sangría inicial y espacio entre párrafos. Los controles afectan el cuadro completo, no una selección parcial de caracteres.',
    'Size sets the font size and Leading the distance between lines. Alignment can be left, center, right or justified. Character and paragraph includes tracking, first-line indent and paragraph spacing. Controls apply to the whole frame, not a partial character selection.',
    'Tamanho define o corpo e Entrelinha a distância entre linhas. O alinhamento pode ser à esquerda, centralizado, à direita ou justificado. Caractere e parágrafo inclui tracking, recuo e espaço entre parágrafos. Os controles afetam toda a caixa, não apenas caracteres selecionados.',
  ],
  [
    'Para un texto de 11 pt, probá 15 pt de interlineado y compará la lectura. Ajustá según la fuente.',
    'For 11 pt text, try 15 pt leading and compare readability. Adjust for the chosen typeface.',
    'Para texto de 11 pt, experimente 15 pt de entrelinha e compare a leitura. Ajuste conforme a fonte.',
  ],
);
lesson(
  'overflow',
  'text',
  '#spread',
  ['13. Revisar texto sobrante', '13. Check overflow', '13. Verifique texto excedente'],
  [
    'El signo rojo + indica que una caja tiene texto que no entra en su altura. El contenido sigue guardado, pero la parte que no entra queda recortada en la salida. Ampliá la caja, reducí cuerpo o interlineado, o repartí el texto manualmente en otra caja. El aviso de la barra inferior corresponde a las páginas visibles.',
    'A red + means text exceeds a frame’s height. Content remains saved, but the overflowing part is clipped in output. Enlarge the frame, reduce font size or leading, or split the text manually into another frame. The status bar checks currently visible pages.',
    'O sinal vermelho + indica texto além da altura da caixa. O conteúdo continua salvo, mas a parte excedente fica cortada na saída. Amplie a caixa, reduza corpo ou entrelinha, ou distribua o texto manualmente em outra caixa. A barra verifica as páginas visíveis.',
  ],
  [
    'Antes de exportar, recorré todas las dobles páginas y resolvé cada signo rojo.',
    'Before exporting, inspect every spread and resolve each red +.',
    'Antes de exportar, percorra todas as duplas e resolva cada sinal vermelho.',
  ],
);
lesson(
  'glyphs',
  'text',
  '#inspectorContent',
  ['14. Usar caracteres especiales', '14. Use special characters', '14. Use caracteres especiais'],
  [
    'En Carácter y párrafo abrí Glifos y caracteres especiales. Elegí un símbolo para agregarlo al final de la caja seleccionada. Es un repertorio básico de signos, tildes, comillas y símbolos; no representa todos los glifos OpenType de una fuente. Verificá que tu familia incluya el carácter elegido.',
    'Open Glyphs and special characters under Character and paragraph. Choose a symbol to append to the selected frame. This is a basic set of accents, quotes and symbols, not the font’s entire OpenType glyph repertoire. Check that your font contains the character.',
    'Abra Glifos e caracteres especiais em Caractere e parágrafo. Escolha um símbolo para adicionar ao final da caixa. É um conjunto básico de acentos, aspas e símbolos, não todos os glifos OpenType da fonte. Confira se a família contém o caractere.',
  ],
  [
    'Insertá comillas tipográficas o una raya y luego ubicalas dentro del texto con la edición normal.',
    'Insert typographic quotes or an em dash, then move them into position while editing.',
    'Insira aspas tipográficas ou um travessão e posicione no texto durante a edição normal.',
  ],
);
lesson(
  'images',
  'text',
  '[data-tool="image"]',
  ['15. Incorporar imágenes', '15. Add images', '15. Adicione imagens'],
  [
    'Elegí Imagen y hacé clic en la página. Abrí un archivo PNG, JPG, WebP o SVG; se convierte a una imagen integrada en el proyecto. Los controladores cambian el marco y la imagen se recorta para cubrirlo, conservando proporciones. El archivo original de tu equipo no se modifica.',
    'Choose Image, click the page and open PNG, JPG, WebP or SVG. It becomes an embedded image in the project. Handles resize its frame and the image crops to cover it while preserving proportions. Your original file is unchanged.',
    'Escolha Imagem, clique na página e abra PNG, JPG, WebP ou SVG. A imagem fica incorporada no projeto. Os controladores alteram a moldura e a imagem é recortada para preenchê-la, mantendo proporções. O arquivo original não é alterado.',
  ],
  [
    'Colocá una imagen y alineá su borde con una columna usando el imán.',
    'Place an image and snap its edge to a column.',
    'Insira uma imagem e ajuste sua borda a uma coluna usando o ímã.',
  ],
);
lesson(
  'frames',
  'text',
  '[data-tool="frame"]',
  [
    '16. Reservar espacio con marcos',
    '16. Reserve space with frames',
    '16. Reserve espaço com molduras',
  ],
  [
    'Marco crea un espacio reservado. Podés seleccionarlo, moverlo y redimensionarlo con los ocho controladores. Para llenarlo, elegí Imagen y hacé clic sobre el marco. Los marcos vacíos sirven para planificar y no se imprimen como contenido.',
    'Frame creates a placeholder. Select, move and resize it with eight handles. To fill it, choose Image and click the frame. Empty frames help plan layouts and are not printed as artwork.',
    'Moldura cria um espaço reservado. Selecione, mova e redimensione pelos oito controladores. Para preencher, escolha Imagem e clique na moldura. Molduras vazias ajudam no planejamento e não são impressas como conteúdo.',
  ],
  [
    'Creá un marco para una fotografía futura, ajustá su tamaño y después cargá una imagen en él.',
    'Create a placeholder for a future photo, size it, then load an image into it.',
    'Crie uma moldura para uma foto futura, ajuste o tamanho e depois carregue uma imagem nela.',
  ],
);
lesson(
  'layers',
  'layers',
  '[data-tab="layers"]',
  ['17. Ordenar objetos y capas', '17. Organize layers', '17. Organize as camadas'],
  [
    'Capas enumera los objetos de la página activa. Las filas superiores se dibujan delante. Seleccioná una fila y arrastrala sobre otra para cambiar el orden, o usá Subir y Bajar. El ojo oculta el objeto, también en la salida; el bloqueo impide moverlo y editarlo. Podés cambiar nombre, ancho y alto.',
    'Layers lists objects on the active page. Top rows draw in front. Select and drag a row over another to reorder, or use Move up and Move down. Hidden objects are excluded from output; locking prevents movement and editing. You can rename objects and enter width and height.',
    'Camadas lista os objetos da página ativa. As linhas superiores ficam à frente. Selecione e arraste uma linha sobre outra ou use Subir e Descer. Objetos ocultos não saem na impressão; o bloqueio impede mover e editar. Você pode renomear e informar largura e altura.',
  ],
  [
    'Renombrá un objeto, bloquealo y comprobá que no se mueve. Desbloquealo para continuar.',
    'Rename an object, lock it and verify it cannot move. Unlock it to continue.',
    'Renomeie um objeto, bloqueie e confira que ele não se move. Desbloqueie para continuar.',
  ],
);
lesson(
  'folio',
  'design',
  '[data-tool="folio"]',
  ['18. Automatizar el foliado', '18. Automate page numbers', '18. Automatize a numeração'],
  [
    'En Foliado activá la numeración. Elegí formato arábigo o romano, número inicial y posición. Personalizar permite configurar pares e impares, tipografía, separación del borde y desplazamientos. La numeración cambia al agregar o mover páginas. Para ocultar el folio de una página especial, usá su excepción en Páginas.',
    'Enable page numbering, choose Arabic or Roman numerals, starting number and position. Customize odd/even content, typeface, edge distance and offsets. Numbers update when pages are added or moved. Hide a number on a special page using its exception in Pages.',
    'Ative a numeração e escolha formato arábico ou romano, início e posição. Personalize pares e ímpares, fonte, distância da borda e deslocamentos. A numeração muda ao adicionar ou mover páginas. Oculte em páginas especiais pela exceção em Páginas.',
  ],
  [
    'Aplicá el folio inferior exterior y comprobá su posición en una doble página.',
    'Apply bottom-outside numbering and check both pages of a spread.',
    'Aplique numeração inferior externa e confira as duas páginas da dupla.',
  ],
  'folio',
);
lesson(
  'headers',
  'design',
  '[data-tool="header"]',
  ['19. Configurar cornisas', '19. Set running headers', '19. Configure cabeçalhos'],
  [
    'Cornisa es un elemento automático para todo el libro. Puede ir arriba, abajo o en un lateral, con rotación opcional. Usá {book}, {section}, {page} y {total} para contenido dinámico. El carácter | separa extremos. Podés definir textos distintos en pares e impares y ocultarlos en páginas especiales.',
    'Running headers apply throughout the book. Position them at the top, bottom or side, with optional rotation. Use {book}, {section}, {page} and {total} for dynamic content. The | character separates the two ends. Define odd/even text and hide headers on special pages.',
    'O cabeçalho é automático para todo o livro. Posicione acima, abaixo ou na lateral, com rotação opcional. Use {book}, {section}, {page} e {total} para conteúdo dinâmico. O caractere | separa extremidades. Defina textos para pares e ímpares e oculte em páginas especiais.',
  ],
  [
    'Probá {book} | {section} y verificá el resultado en páginas pares e impares.',
    'Try {book} | {section} and inspect odd and even pages.',
    'Experimente {book} | {section} e confira páginas pares e ímpares.',
  ],
  'header',
);
lesson(
  'sections',
  'pages',
  '[data-tab="page"]',
  [
    '20. Definir capítulos y excepciones',
    '20. Define sections and exceptions',
    '20. Defina seções e exceções',
  ],
  [
    'En la página donde comienza un capítulo, escribí su nombre en Comenzar sección. Esa sección se mantiene hasta el próximo comienzo y alimenta las cornisas y el índice. Para una portada o apertura, podés ocultar cornisa, titulillo y folio solo en esa página, sin desactivar los demás.',
    'On a chapter’s first page, enter its name under Start a section. It continues until the next section and feeds running headers and the contents. On covers or openers, hide the header, running title and page number for that page only.',
    'Na primeira página do capítulo, informe seu nome em Iniciar seção. Ela continua até a próxima seção e alimenta cabeçalhos e sumário. Em capas ou aberturas, oculte cabeçalho, título corrente e número somente naquela página.',
  ],
  [
    'Definí una segunda sección y observá cómo cambia {section} a partir de ella.',
    'Define a second section and see how {section} changes from that page onward.',
    'Defina uma segunda seção e observe a mudança de {section} a partir dela.',
  ],
);
lesson(
  'running-title',
  'design',
  '[data-tab="book"]',
  ['21. Agregar un titulillo', '21. Add a running title', '21. Adicione um título corrente'],
  [
    'Titulillo es un segundo elemento automático independiente de la cornisa. Podés usarlo para el nombre de una colección, una sección breve o una referencia lateral. Tiene sus propias posiciones, pares e impares y desplazamientos. Evitá superponerlo con el folio o con la caja de texto.',
    'A running title is a second automatic element independent of the header. Use it for a collection name, short section label or side reference. It has its own position, odd/even text and offsets. Avoid overlapping page numbers or text frames.',
    'O título corrente é um segundo elemento automático, independente do cabeçalho. Use para coleção, seção breve ou referência lateral. Ele tem posição, textos pares e ímpares e deslocamentos próprios. Evite sobrepor números ou caixas de texto.',
  ],
  [
    'Activá un titulillo lateral y ajustá su desplazamiento para separarlo del texto principal.',
    'Enable a side running title and adjust offsets to separate it from body text.',
    'Ative um título corrente lateral e ajuste os deslocamentos para separar do texto principal.',
  ],
);
lesson(
  'contents',
  'index',
  '[data-tab="index"]',
  ['22. Construir el índice', '22. Build the contents', '22. Construa o sumário'],
  [
    'El Índice reúne comienzos de sección y cuadros marcados como títulos. También admite entradas manuales vinculadas a una página. Seleccioná un texto y usá Marcar texto como título para incluirlo. Colocar índice crea una caja actualizable en la página activa; sus folios se recalculan al reorganizar el libro.',
    'Contents gathers section starts and frames marked as headings, plus manual entries linked to pages. Select text and mark it as a heading to include it. Place contents creates a live frame on the active page; page references recalculate when the book is reordered.',
    'O Sumário reúne inícios de seção e caixas marcadas como títulos, além de entradas manuais ligadas a páginas. Selecione um texto e marque como título. Inserir sumário cria uma caixa atualizável na página ativa; as referências mudam ao reorganizar o livro.',
  ],
  [
    'Reservá una página para el índice y colocá la tabla. Si una referencia aparece como —, revisá si eliminaste su página.',
    'Reserve a contents page and place the table. A — reference means its page may have been deleted.',
    'Reserve uma página para o sumário e insira a tabela. A referência — indica que a página pode ter sido excluída.',
  ],
);
lesson(
  'templates',
  'design',
  '#templates',
  ['23. Comparar plantillas', '23. Compare templates', '23. Compare modelos'],
  [
    'Las plantillas de la franja inferior cambian la cantidad de filas y columnas de la grilla. No rediseñan ni mueven automáticamente los objetos que ya colocaste. Usalas como estructuras para experimentar y luego ajustá cada caja. Deshacer permite volver a la propuesta anterior.',
    'Bottom templates change grid rows and columns. They do not automatically redesign or move existing objects. Use them as structures for experimentation, then adjust frames individually. Undo returns to the previous design.',
    'Os modelos inferiores alteram linhas e colunas da grade. Eles não redesenham nem movem objetos existentes automaticamente. Use como estrutura para experimentar e ajuste cada caixa. Desfazer retorna à proposta anterior.',
  ],
  [
    'Compará una grilla simple con una de tres columnas y elegí cuál ayuda a tu composición.',
    'Compare a simple grid with three columns and choose what supports your composition.',
    'Compare uma grade simples com três colunas e escolha o que ajuda sua composição.',
  ],
);
lesson(
  'review',
  'design',
  '#preview',
  ['24. Revisar sin guías', '24. Review without guides', '24. Revise sem guias'],
  [
    'Vista previa oculta guías, controles y avisos para mirar la composición limpia. Volvé a pulsarla para editar. El zoom cambia la visualización, no las medidas reales. Ampliar área de trabajo oculta paneles y deja más espacio para las páginas. Revisá también las páginas especiales y los laterales.',
    'Preview hides guides, handles and warnings for a clean view. Press it again to edit. Zoom changes the view, not actual dimensions. Expand workspace hides panels to give pages more room. Review special pages and side elements as well.',
    'Visualização oculta guias, controles e avisos para uma leitura limpa. Pressione novamente para editar. O zoom muda a visualização, não as medidas reais. Ampliar área de trabalho oculta painéis. Confira também páginas especiais e elementos laterais.',
  ],
  [
    'Alterná edición y vista previa para evaluar márgenes, ritmo y jerarquía tipográfica.',
    'Switch between editing and preview to assess margins, rhythm and typographic hierarchy.',
    'Alterne edição e visualização para avaliar margens, ritmo e hierarquia tipográfica.',
  ],
);
lesson(
  'save',
  'pages',
  '#save',
  ['25. Guardar y retomar', '25. Save and resume', '25. Salve e retome'],
  [
    'Guardar crea un archivo .mqt con páginas, texto, imágenes integradas y ajustes. Los archivos recientes aparecen en Inicio. La recuperación local ayuda a retomar una sesión, pero no reemplaza tu archivo guardado. Las fuentes se referencian por familia y estilo: necesitás las mismas al editar en otra PC.',
    'Save creates an .mqt file with pages, text, embedded images and settings. Recent files appear in Home. Local recovery helps resume a session but does not replace a saved file. Fonts are referenced by family and style, so another computer needs the same fonts.',
    'Salvar cria um arquivo .mqt com páginas, texto, imagens incorporadas e ajustes. Os recentes aparecem no Início. A recuperação local ajuda a retomar uma sessão, mas não substitui o arquivo salvo. As fontes são referenciadas por família e estilo; outro computador precisa das mesmas fontes.',
  ],
  [
    'Guardá una primera versión con un nombre reconocible y comprobá su acceso en Inicio.',
    'Save a version with a recognizable name and check its shortcut in Home.',
    'Salve uma versão com um nome reconhecível e confira o acesso no Início.',
  ],
);
lesson(
  'pdf',
  'design',
  '#export',
  ['26. Exportar un PDF de lectura', '26. Export a reading PDF', '26. Exporte um PDF de leitura'],
  [
    'Exportar PDF abre opciones de orden, papel y escala. Para una entrega de lectura, elegí páginas individuales y tamaño del libro. Dejá desactivadas grilla, guías, márgenes y marcas para una salida limpia. Cornisas, titulillos y folios pueden incluirse o excluirse. Revisá la vista previa antes de guardar.',
    'Export PDF offers page order, paper and scaling. For a reading copy, choose individual pages and book size. Disable grid, guides, margin lines and crop marks for clean output. Headers, running titles and page numbers can be included or excluded. Inspect the preview before saving.',
    'Exportar PDF oferece ordem, papel e escala. Para leitura, escolha páginas individuais e tamanho do livro. Desative grade, guias, margens e marcas para uma saída limpa. Cabeçalhos, títulos correntes e números podem ser incluídos ou excluídos. Revise a prévia antes de salvar.',
  ],
  [
    'Generá un PDF limpio y abrilo para comprobar que el texto no se corte.',
    'Create a clean PDF and open it to check for clipped text.',
    'Gere um PDF limpo e abra para verificar se o texto não foi cortado.',
  ],
  'pdf',
);
lesson(
  'booklet',
  'design',
  '#export',
  [
    '27. Preparar el abrochado al medio',
    '27. Prepare a saddle-stitch booklet',
    '27. Prepare o grampo central',
  ],
  [
    'Elegí Cuadernillo para abrochado. La app reordena páginas y completa blancos hasta un múltiplo de cuatro. A5 suele entrar en un A4 horizontal; revisá papel y escala. Al imprimir este PDF, no vuelvas a activar modo folleto en otra aplicación, porque ya está impuesto. Usá doble faz por borde corto si tu impresora lo permite.',
    'Choose Saddle-stitch booklet. The app reorders pages and adds blanks to a multiple of four. A5 usually fits on landscape A4; check paper and scale. Do not apply booklet mode again when printing this PDF: it is already imposed. Use short-edge duplex if supported.',
    'Escolha Livreto para grampo central. O app reordena as páginas e completa com brancos até múltiplo de quatro. A5 costuma caber em A4 horizontal; confira papel e escala. Não reaplique o modo livreto ao imprimir este PDF, pois ele já está imposto. Use frente e verso pela borda curta se disponível.',
  ],
  [
    'Hacé una prueba de pocas páginas, doblá las hojas y comprobá orden y orientación antes de imprimir todo.',
    'Test a few pages, fold the sheets and check order and orientation before printing everything.',
    'Teste poucas páginas, dobre as folhas e confira ordem e orientação antes de imprimir tudo.',
  ],
  'pdf',
);
lesson(
  'print',
  'design',
  '#printButton',
  ['28. Imprimir y elegir marcas', '28. Print and choose marks', '28. Imprima e escolha marcas'],
  [
    'Imprimir enumera las impresoras de Windows. Elegí papel, copias y doble faz según el controlador. Podés incluir marcas de corte, grilla, guías y líneas de márgenes. Las marcas reservan 7 mm alrededor del formato y pueden exigir papel mayor o reducción. Nada se envía hasta Imprimir ahora.',
    'Print lists Windows printers. Choose paper, copies and duplex as supported by the driver. Enable crop marks, grid, guides and margin lines if needed. Marks reserve 7 mm around the trim size and may require larger paper or shrinking. Nothing is sent until Print now.',
    'Imprimir lista as impressoras do Windows. Escolha papel, cópias e frente e verso conforme o driver. Ative marcas de corte, grade, guias e margens se necessário. As marcas reservam 7 mm ao redor e podem exigir papel maior ou redução. Nada é enviado antes de Imprimir agora.',
  ],
  [
    'Compará la vista previa con y sin grilla. Para una prueba docente podés imprimir las guías; para la entrega final, ocultalas.',
    'Compare preview with and without the grid. Print guides for a teaching proof and hide them for the final copy.',
    'Compare a prévia com e sem grade. Imprima guias para uma prova didática e oculte na versão final.',
  ],
  'print',
);
const tutorialUI = {
  es: {
    label: 'Guía de Maquetario',
    previous: 'Anterior',
    next: 'Siguiente',
    finish: 'Finalizar',
    close: 'Pausar tutorial',
    action: 'Abrir esta sección',
    note: 'Tus cambios se hacen en el libro actual. Podés deshacerlos con Ctrl+Z.',
    exercise: 'Probalo en tu libro',
    contents: 'Elegir capítulo',
    done: 'Recorrido completado. Podés volver a cualquier capítulo desde Ayuda.',
  },
  en: {
    label: 'Maquetario guide',
    previous: 'Back',
    next: 'Next',
    finish: 'Finish',
    close: 'Pause tutorial',
    action: 'Open this section',
    note: 'Edits apply to your current book. Undo with Ctrl+Z.',
    exercise: 'Try it in your book',
    contents: 'Choose a chapter',
    done: 'Tour complete. Revisit any chapter from Help.',
  },
  pt: {
    label: 'Guia do Maquetario',
    previous: 'Anterior',
    next: 'Próximo',
    finish: 'Concluir',
    close: 'Pausar tutorial',
    action: 'Abrir esta seção',
    note: 'As alterações afetam seu livro atual. Desfaça com Ctrl+Z.',
    exercise: 'Experimente no seu livro',
    contents: 'Escolher capítulo',
    done: 'Percurso concluído. Volte a qualquer capítulo pela Ajuda.',
  },
};
globalThis.tutorialIndex = 0;
const tutorialCard = document.createElement('aside');
tutorialCard.className = 'tutorial-card';
tutorialCard.id = 'tutorialCard';
tutorialCard.hidden = true;
tutorialCard.setAttribute('aria-live', 'polite');
document.body.append(tutorialCard);
globalThis.tutorialCard = tutorialCard;
function tutorialLocale() {
  return { code: LibroI18n.language, index: { es: 0, en: 1, pt: 2 }[LibroI18n.language] || 0 };
}
function startTutorial(index?: number): void {
  hideWelcome();
  if ($('#modal').open) $('#modal').close();
  // Desde el centro de Ayuda (u otra Hoja o Ventana de React): se cierra antes de mostrar la tarjeta.
  globalThis.closeSheet?.();
  let saved = Number(localStorage.getItem('maquetario-tutorial-step')) || 0;
  tutorialIndex = Number.isInteger(index)
    ? (index as number)
    : Math.min(saved, guideLessons.length - 1);
  tutorialCard.hidden = false;
  showTutorialStep(tutorialIndex);
}
globalThis.closeTutorial = function () {
  tutorialCard.hidden = true;
  $$('.tour-target').forEach((n) => n.classList.remove('tour-target'));
};
globalThis.showTutorialStep = function (index: number) {
  finishEditing();
  tutorialIndex = Math.max(0, Math.min(guideLessons.length - 1, index));
  localStorage.setItem('maquetario-tutorial-step', String(tutorialIndex));
  const { code, index: lang } = tutorialLocale(),
    w = tutorialUI[code],
    step = guideLessons[tutorialIndex];
  showTab(step.tab);
  $$('.tour-target').forEach((n) => n.classList.remove('tour-target'));
  const target = $(step.target);
  if (target) {
    target.classList.add('tour-target');
    target.closest('details')?.setAttribute('open', '');
    if (target.closest('#inspectorContent'))
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  tutorialCard.innerHTML = `<div class="tutorial-card-head"><span>${w.label} · ${tutorialIndex + 1} / ${guideLessons.length}</span><button class="icon-btn" id="pauseTutorial" title="${w.close}">${icon('close')}</button></div><div class="tutorial-progress"><span style="width:${((tutorialIndex + 1) / guideLessons.length) * 100}%"></span></div><div class="tutorial-body"><h2>${step.title[lang]}</h2><p>${step.body[lang]}</p><div class="tutorial-exercise"><strong>${w.exercise}</strong><br>${step.task[lang]}</div><button id="tutorialAction" class="tutorial-action">${w.action}</button></div><select id="tutorialJump" class="tutorial-jump" aria-label="${w.contents}">${guideLessons.map((s, i) => `<option value="${i}" ${i === tutorialIndex ? 'selected' : ''}>${i + 1}. ${s.title[lang]}</option>`).join('')}</select><div class="tutorial-nav"><button class="btn" id="tutorialPrev" ${tutorialIndex === 0 ? 'disabled' : ''}>← ${w.previous}</button><button class="btn primary" id="tutorialNext">${tutorialIndex === guideLessons.length - 1 ? w.finish : w.next} →</button></div><div class="tutorial-note">${w.note}</div>`;
  $('#pauseTutorial').onclick = closeTutorial;
  $('#tutorialPrev').onclick = () => showTutorialStep(tutorialIndex - 1);
  $('#tutorialNext').onclick = () => {
    if (tutorialIndex === guideLessons.length - 1) {
      closeTutorial();
      localStorage.setItem('maquetario-tutorial-step', '0');
      toast(w.done);
    } else showTutorialStep(tutorialIndex + 1);
  };
  $('#tutorialJump').onchange = (e) =>
    showTutorialStep(Number((e.target as HTMLSelectElement).value));
  $('#tutorialAction').onclick = () => {
    if (step.action === 'settings') settings(false);
    else if (step.action === 'pdf') outputDialog('pdf');
    else if (step.action === 'print') outputDialog('print');
    else if (['folio', 'header'].includes(step.action)) setTool(step.action);
    else {
      showTab(step.tab);
      const el = $(step.target);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus?.();
      }
    }
  };
};
globalThis.startTutorial = startTutorial;
// Centro de Ayuda: la sección "Tutorial guiado" (React, components/help/sections.tsx).
registerHelpSection(tutorialHelpSection);
document.addEventListener('maquetario:language', () => {
  if (!tutorialCard.hidden) showTutorialStep(tutorialIndex);
});
decorateInspector(() => {
  if (selectObject()?.locked && tab !== 'layers')
    $('#inspectorContent')
      .querySelectorAll<HTMLInputElement>(
        '[data-object],[data-extra],[data-align],[data-style],#fontVariant,[data-axis],[data-command="editText"],#glyphPanel',
      )
      .forEach((el) => (el.disabled = true));
  if (!tutorialCard.hidden) {
    const step = guideLessons[tutorialIndex],
      target = step && $(step.target);
    if (target) target.classList.add('tour-target');
  }
}, 'tutorial');

export {};
