// Lecciones del tutorial sobre estilos de párrafo, alineación y revisión de la salida, y el texto
// actualizado de la lección de párrafo. Se registran al cargar, después de las de tutorial.js.
//
// No publica globales: sólo llama a lesson() y retoca guideLessons (de tutorial.js).
//
// Fuente TypeScript: se compila a build/review-tutorial.js (desktop/scripts/build.mjs).

import { guideLessons, lesson } from './tutorial-lessons.ts';

lesson(
  'paragraph-styles',
  'text',
  '#inspectorContent',
  [
    'Estilos de párrafo reutilizables',
    'Reusable paragraph styles',
    'Estilos de parágrafo reutilizáveis',
  ],
  [
    'En Selección, Párrafo y estilos permite elegir toda la caja o un párrafo individual. Ajustá su formato y elegí Nuevo desde selección para guardarlo con un nombre. Aplicalo a otros párrafos desde el selector. Editar estilo actualiza todos los párrafos vinculados; Redefinir adopta los ajustes del párrafo actual. Quitar ajustes locales vuelve al estilo guardado.',
    'In Selection, Paragraphs and styles targets the whole frame or an individual paragraph. Adjust formatting and save it with New from selection. Apply it elsewhere from the style selector. Edit style updates every linked paragraph; Redefine adopts the current paragraph settings. Clear local overrides returns to the stored style.',
    'Em Seleção, Parágrafos e estilos permite escolher a caixa inteira ou um parágrafo. Ajuste o formato e salve com Novo a partir da seleção. Aplique pelo seletor. Editar estilo atualiza todos os parágrafos vinculados; Redefinir adota os ajustes do parágrafo atual. Limpar ajustes locais retorna ao estilo salvo.',
  ],
  [
    'Creá un estilo “Cuerpo” y aplicalo a dos párrafos. Editá su interlineado y comprobá que ambos se actualicen.',
    'Create a Body style and apply it to two paragraphs. Edit leading and check both update.',
    'Crie um estilo Corpo e aplique em dois parágrafos. Edite a entrelinha e confira a atualização de ambos.',
  ],
);
lesson(
  'align-objects',
  'text',
  '#inspectorContent',
  ['Alinear elementos en la página', 'Align page elements', 'Alinhar elementos na página'],
  [
    'Alinear objetos está en Selección. Elegí un objeto o seleccioná varios con Shift + clic. Podés alinear a los márgenes, a toda la página o al conjunto seleccionado. Izquierda, centro, derecha, arriba, centro vertical y abajo cambian la posición de los objetos sin cambiar su tamaño. Los bloqueados quedan fuera de la operación.',
    'Align objects is in Selection. Select one object or Shift-click several. Align to page margins, the full page or the selection bounds. Left, center, right, top, vertical center and bottom reposition objects without resizing. Locked objects are excluded.',
    'Alinhar objetos fica em Seleção. Selecione um objeto ou use Shift + clique para vários. Alinhe às margens, à página inteira ou aos limites da seleção. Esquerda, centro, direita, acima, centro vertical e abaixo reposicionam sem redimensionar. Objetos bloqueados não são alterados.',
  ],
  [
    'Seleccioná dos cajas y alinealas a la izquierda de sus márgenes. Revisá que sus dimensiones no cambien.',
    'Select two frames and align them to the left margin. Check their sizes stay unchanged.',
    'Selecione duas caixas e alinhe à margem esquerda. Confira que as dimensões não mudam.',
  ],
);
lesson(
  'review-output',
  'design',
  '#export',
  [
    'Revisar cada cara antes de exportar',
    'Review every output side',
    'Revisar cada face antes de exportar',
  ],
  [
    'En PDF o Imprimir, usá las flechas para recorrer la vista previa. El número permite saltar a una cara y los extremos llevan a la primera o la última. En cuadernillo, cada cara muestra los dos folios correspondientes o Blanco. La página activa en el editor se identifica con contorno, etiqueta y miniatura resaltada; no debe confundirse con la cara de impresión.',
    'In PDF or Print, use arrows to review each side. Enter a number to jump, or use first and last. Booklet sides show the two page references or Blank. In the editor, the active page has an outline, label and highlighted thumbnail; it is different from the printed sheet side.',
    'Em PDF ou Imprimir, use as setas para revisar cada face. Digite um número para pular ou use primeira e última. No livreto, aparecem os dois números ou Branco. No editor, a página ativa tem contorno, etiqueta e miniatura destacada; ela é diferente da face impressa da folha.',
  ],
  [
    'Recorré todas las caras del cuadernillo y verificá los blancos, los folios y la posición de las imágenes.',
    'Review all booklet sides and check blanks, page numbers and image placement.',
    'Percorra todas as faces do livreto e confira brancos, números e imagens.',
  ],
  'pdf',
);
const paragraphLesson = guideLessons.find((s) => s.id === 'paragraph')!;
paragraphLesson.body = [
  'Tamaño define el cuerpo e Interlineado la distancia entre líneas. En Párrafo y estilos elegí un párrafo o toda la caja antes de formatear. Tenés alineación izquierda, centrada, derecha y justificada, última línea, sangrías izquierda y derecha, primera línea y espacios anterior y posterior. Guardá combinaciones como estilos reutilizables.',
  'Size sets font size and Leading the line spacing. In Paragraphs and styles, choose one paragraph or the whole frame before formatting. Set left, center, right or justified alignment, last-line alignment, left and right indents, first-line indent and before/after spacing. Save combinations as reusable styles.',
  'Tamanho define o corpo e Entrelinha o espaçamento de linhas. Em Parágrafos e estilos, escolha um parágrafo ou a caixa inteira antes de formatar. Configure alinhamento, última linha, recuos esquerdo e direito, primeira linha e espaços anterior e posterior. Salve combinações como estilos reutilizáveis.',
];

export {};
