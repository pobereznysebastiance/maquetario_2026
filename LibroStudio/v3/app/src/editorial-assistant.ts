// Asistente editorial: botón "Asistente editorial" en la barra y su diálogo. La revisión
// automática recorre las páginas sin conexión (objetos fuera de página, texto que no entra,
// espacios repetidos, fuentes que faltan, marcos vacíos, imágenes ilegibles o con pocos píxeles,
// cajas de texto superpuestas y texto sobrante en la cubierta). La consulta a la IA del aula manda
// texto y medidas al servicio del docente por el anfitrión (nativeCall), sólo con autorización.
// Los hallazgos no cambian el libro: sólo la corrección de espacios, explícita y con deshacer.
//
// Este archivo es la lógica (revisión, consulta, estado del informe). La Ventana de trabajo es
// React: src/components/assistant/EditorialAssistant.tsx, que lee el estado de `assistant` y
// se redibuja con notifyEditorState() (src/react/editor-state.ts).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { BookObject } from './model.ts';
import { notifyEditorState } from './react/editor-state.ts';

export type FindingSeverity = 'error' | 'warning' | 'tip';

/** Un hallazgo de la revisión automática ('local') o de la IA del aula ('ai'). */
export interface EditorialFinding {
  id: string;
  pageId: string | null;
  objectId: string | null;
  kind: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  suggestion: string;
  /** Corrección que ofrece el diálogo (sólo 'spaces': quitar espacios repetidos). */
  fix?: 'spaces' | null;
  source: 'local' | 'ai';
  ignored?: boolean;
}

/** Estado de la conexión con el servicio de IA del aula (lo devuelve el anfitrión). */
export interface ClassServiceInfo {
  configured: boolean;
  serviceUrl: string;
}

type ImageSize = { w: number; h: number };

/**
 * Estado del asistente. Lo lee la Ventana de trabajo al dibujarse; quien lo cambie llama a
 * notifyEditorState() para que se redibuje.
 */
export const assistant = {
  /** Hallazgos del último informe. */
  report: [] as EditorialFinding[],
  /** Huella del libro cuando se hizo el informe ('' si no hay informe). */
  stamp: '',
  /** Resumen del informe. */
  summary: '',
  /** Hay una revisión en curso (automática o con IA): no se larga otra. */
  busy: false,
  /** Cuál corre, para deshabilitar su botón. */
  running: null as 'auto' | 'ai' | null,
  /** Texto mientras corre una revisión (va en el lugar del resumen). */
  progress: '',
  /** Error de la última revisión o consulta. */
  error: '',
  /** Conexión con el servicio del aula. */
  service: { configured: false, serviceUrl: '' } as ClassServiceInfo,
};
const imageSizeCache = new Map<string, Promise<ImageSize | null>>();
// La entrada "Asistente editorial" (#editorialAssistant) está en la barra superior
// (components/topbar/Topbar.tsx).
function reviewStamp(): string {
  let hash = 2166136261;
  const text = JSON.stringify([
    book.title,
    book.width,
    book.height,
    book.margins,
    book.header,
    book.folio,
    book.paragraphStyles,
    book.pages.map((p) => [
      p.id,
      p.hideHeader,
      p.hideFolio,
      p.objects.map((o) => ({ ...o, src: o.src ? o.src.length : undefined })),
    ]),
  ]);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(hash);
}
function finding(
  page: number,
  o: BookObject | null | undefined,
  kind: string,
  severity: FindingSeverity,
  title: string,
  detail: string,
  suggestion: string,
  fix: 'spaces' | null = null,
): EditorialFinding {
  return {
    id: M.uid(),
    pageId: book.pages[page]?.id || null,
    objectId: o?.id || null,
    kind,
    severity,
    title,
    detail,
    suggestion,
    fix,
    source: 'local',
    ignored: false,
  };
}
async function imageDimensions(src: string): Promise<ImageSize | null> {
  if (imageSizeCache.has(src)) return imageSizeCache.get(src)!;
  const promise = (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return { w: img.naturalWidth, h: img.naturalHeight };
  })().catch(() => null);
  imageSizeCache.set(src, promise);
  return promise;
}
async function automaticEditorialReview(): Promise<EditorialFinding[]> {
  await ensureBookFonts();
  const issues: EditorialFinding[] = [];
  for (let i = 0; i < book.pages.length; i++) {
    const p = book.pages[i];
    let rendered: HTMLElement | undefined;
    try {
      rendered = paper(i, 96 / 25.4, true);
      Object.assign(rendered.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        display: 'block',
        visibility: 'hidden',
      });
      document.body.append(rendered);
      for (const o of p.objects) {
        if (o.hidden) continue;
        if (o.x < 0 || o.y < 0 || o.x + o.w > book.width + 0.1 || o.y + o.h > book.height + 0.1)
          issues.push(
            finding(
              i,
              o,
              'bounds',
              'error',
              bw('Objeto fuera de página', 'Object outside page', 'Objeto fora da página'),
              bw(
                'Parte del elemento queda fuera del formato.',
                'Part of the element lies outside the page.',
                'Parte do elemento fica fora do formato.',
              ),
              bw(
                'Revisá Posición y tamaño en Selección.',
                'Review Position and size in Selection.',
                'Revise Posição e tamanho em Seleção.',
              ),
            ),
          );
        if (o.type === 'text') {
          const content = rendered.querySelector(`[data-id="${o.id}"] .text-content`);
          if (content && content.scrollHeight > content.clientHeight + 2)
            issues.push(
              finding(
                i,
                o,
                'overflow',
                'error',
                bw('Texto que no entra', 'Overset text', 'Texto que não cabe'),
                bw(
                  'Hay contenido que no se ve completo dentro de esta caja.',
                  'Some content is not fully visible in this frame.',
                  'Há conteúdo que não fica totalmente visível nesta caixa.',
                ),
                bw(
                  'Ampliá la caja o revisá cuerpo e interlineado.',
                  'Enlarge the frame or review type size and leading.',
                  'Aumente a caixa ou revise corpo e entrelinha.',
                ),
              ),
            );
          if (!o.toc && /\S {2,}(?=\S)/.test(o.text))
            issues.push(
              finding(
                i,
                o,
                'spaces',
                'tip',
                bw('Espacios repetidos', 'Repeated spaces', 'Espaços repetidos'),
                bw(
                  'Hay dos o más espacios entre palabras. Puede ser intencional.',
                  'Two or more spaces occur between words. This may be intentional.',
                  'Há dois ou mais espaços entre palavras. Pode ser intencional.',
                ),
                bw(
                  'Reemplazarlos por un espacio si no son necesarios.',
                  'Replace them with one space if they are not needed.',
                  'Substituir por um espaço se não forem necessários.',
                ),
                'spaces',
              ),
            );
          const unavailable =
            (o.fontFaceId && !nativeFaces.some((f) => f.id === o.fontFaceId)) ||
            fontLoadErrors.has(o.fontFaceId);
          if (unavailable)
            issues.push(
              finding(
                i,
                o,
                'font',
                'warning',
                bw('Fuente no disponible', 'Font unavailable', 'Fonte indisponível'),
                bw(
                  'La fuente guardada no se pudo cargar en este equipo.',
                  'The saved font could not be loaded on this computer.',
                  'A fonte salva não pôde ser carregada neste computador.',
                ),
                bw(
                  'Agregá su carpeta o elegí una fuente instalada.',
                  'Add its folder or choose an installed font.',
                  'Adicione a pasta ou escolha uma fonte instalada.',
                ),
              ),
            );
        }
        if (o.type === 'frame' && !o.shape && !o.decoration)
          issues.push(
            finding(
              i,
              o,
              'empty-frame',
              'tip',
              bw('Marco sin imagen', 'Empty image frame', 'Quadro sem imagem'),
              bw(
                'Este marco no contiene una imagen y no se imprime como un diseño.',
                'This frame contains no image and does not print as artwork.',
                'Este quadro não contém imagem e não é impresso como desenho.',
              ),
              bw(
                'Colocá una imagen o usá una figura con relleno.',
                'Place an image or use a filled shape.',
                'Insira uma imagem ou use uma figura com preenchimento.',
              ),
            ),
          );
        if (o.type === 'image') {
          const size = await imageDimensions(o.src);
          if (!size)
            issues.push(
              finding(
                i,
                o,
                'image',
                'error',
                bw('Imagen no legible', 'Image cannot be read', 'Imagem ilegível'),
                bw(
                  'No se pudo decodificar la imagen incorporada.',
                  'The embedded image could not be decoded.',
                  'Não foi possível decodificar a imagem incorporada.',
                ),
                bw(
                  'Volvé a colocar la imagen.',
                  'Place the image again.',
                  'Insira a imagem novamente.',
                ),
              ),
            );
          else {
            const scale = (o.imageFit === 'contain' ? Math.min : Math.max)(
                o.w / size.w,
                o.h / size.h,
              ),
              ppi = 25.4 / scale;
            if (ppi < 150)
              issues.push(
                finding(
                  i,
                  o,
                  'resolution',
                  'warning',
                  bw(
                    'Pocos píxeles al tamaño colocado',
                    'Low resolution at placed size',
                    'Poucos pixels no tamanho aplicado',
                  ),
                  `${Math.round(ppi)} ppp / ppi · ${size.w} × ${size.h} px`,
                  bw(
                    'Considerá una imagen con más píxeles o un tamaño menor. El destino de impresión determina la calidad necesaria.',
                    'Consider more pixels or a smaller placed size. Printing requirements determine the needed quality.',
                    'Considere mais pixels ou um tamanho menor. O destino de impressão determina a qualidade necessária.',
                  ),
                ),
              );
          }
        }
      }
      const texts = p.objects.filter((o) => o.type === 'text' && !o.hidden && !o.toc);
      for (let a = 0; a < texts.length; a++)
        for (let b = a + 1; b < texts.length; b++) {
          const x = texts[a],
            y = texts[b],
            area =
              Math.max(0, Math.min(x.x + x.w, y.x + y.w) - Math.max(x.x, y.x)) *
              Math.max(0, Math.min(x.y + x.h, y.y + y.h) - Math.max(x.y, y.y));
          if (area > Math.min(x.w * x.h, y.w * y.h) * 0.3)
            issues.push(
              finding(
                i,
                y,
                'overlap',
                'tip',
                bw(
                  'Cajas de texto superpuestas',
                  'Overlapping text frames',
                  'Caixas de texto sobrepostas',
                ),
                bw(
                  'Las áreas de estas cajas se cruzan. Es una pista geométrica, no una confirmación de texto ilegible.',
                  'These frame areas overlap. This is a geometric hint, not confirmation of illegible text.',
                  'As áreas destas caixas se cruzam. É uma indicação geométrica, não confirmação de texto ilegível.',
                ),
                bw(
                  'Comprobá si la superposición es parte de tu diseño.',
                  'Check whether the overlap is intentional.',
                  'Confira se a sobreposição é intencional.',
                ),
              ),
            );
        }
    } finally {
      rendered?.remove();
    }
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }
  if (book.cover && coverOverflow(book.cover))
    issues.push({
      id: M.uid(),
      pageId: null,
      objectId: null,
      kind: 'cover',
      severity: 'error',
      title: bw('Texto sobrante en cubierta', 'Cover text does not fit', 'Texto excedente na capa'),
      detail: bw(
        'Una zona de la cubierta no muestra todo su texto.',
        'A cover area does not display all its text.',
        'Uma área da capa não mostra todo o texto.',
      ),
      suggestion: bw(
        'Revisá la cubierta antes de exportar.',
        'Review the cover before exporting.',
        'Revise a capa antes de exportar.',
      ),
      source: 'local',
    });
  return issues;
}
function classroomPayload(scope: string) {
  const pages =
    scope === 'page'
      ? [{ p: book.pages[active], index: active }]
      : book.pages.map((p, index) => ({ p, index }));
  let remaining = 20000,
    truncated = false;
  return {
    language: LibroI18n.language,
    scope,
    title: book.title,
    width: book.width,
    height: book.height,
    margins: book.margins,
    pages: pages.map(({ p, index }) => ({
      id: p.id,
      number: index + 1,
      section: p.section,
      objects:
        scope === 'page'
          ? p.objects
              .filter((o) => !o.hidden)
              .map((o) => {
                const f = o.type === 'text' ? paragraphFormat(book, o, 0) : null;
                let text = o.type === 'text' ? o.text : '';
                if (text.length > remaining) {
                  text = text.slice(0, remaining);
                  truncated = true;
                }
                remaining -= text.length;
                return {
                  id: o.id,
                  type: o.type,
                  x: o.x,
                  y: o.y,
                  w: o.w,
                  h: o.h,
                  text,
                  font: f?.font || null,
                  size: f?.size || null,
                  leading: f?.leading || null,
                };
              })
          : [],
    })),
    truncated: truncated,
  };
}

// Publicado a propósito: las pruebas (tests/assistant-tests.js, paso "asistente editorial" de la
// autoprueba) llaman a estas funciones. openEditorialAssistant y runAutomaticReview los publica
// la pantalla (EditorialAssistant.tsx).
type ClassroomPayload = ReturnType<typeof classroomPayload>;
type FindingFactory = typeof finding;
declare global {
  var automaticEditorialReview: () => Promise<EditorialFinding[]>;
  var classroomPayload: (scope: string) => ClassroomPayload;
  var finding: FindingFactory;
  var reviewStamp: () => string;
  /** Hallazgos del último informe (las pruebas lo reemplazan y lo vacían). */
  var editorialReport: EditorialFinding[];
  /** Huella del documento cuando se hizo el informe ('' si no hay informe). */
  var editorialReportStamp: string;
  /** Resumen que muestra el diálogo sobre los hallazgos. */
  var editorialSummary: string;
}
globalThis.automaticEditorialReview = automaticEditorialReview;
globalThis.classroomPayload = classroomPayload;
globalThis.finding = finding;
globalThis.reviewStamp = reviewStamp;
// El estado del informe sigue siendo de este archivo; las pruebas lo leen y lo reemplazan por
// estos accesores (y la Ventana, si está abierta, se redibuja).
const field = <K extends 'report' | 'stamp' | 'summary'>(key: K) => ({
  get: () => assistant[key],
  set: (value: (typeof assistant)[K]) => {
    assistant[key] = value;
    notifyEditorState();
  },
  configurable: true,
});
Object.defineProperties(globalThis, {
  editorialReport: field('report'),
  editorialReportStamp: field('stamp'),
  editorialSummary: field('summary'),
});
