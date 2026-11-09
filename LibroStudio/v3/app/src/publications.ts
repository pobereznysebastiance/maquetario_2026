// Publicaciones y cubierta: tipos de producto editorial al crear un documento (libro, revista,
// diario…), editor de la cubierta desplegada, su dibujo (coverArtwork) y su salida en PDF.
//
// Todo lo publicado lo usan otros archivos, las pruebas (tests/publications-tests.js y otras) o
// la autoprueba. Las funciones se definen directamente en globalThis y se llaman por su nombre
// global, no por una copia local: otros módulos las extienden por nombre (extend reemplaza
// window[nombre]) y las llamadas de acá adentro tienen que pasar por esa cadena, como antes.
// coverDraft y coverPart viven en globalThis porque otros archivos (y las pruebas) los asignan.
//
// Fuente TypeScript: se compila a build/publications.js (desktop/scripts/build.mjs).

/** Una zona de la cubierta (texto, tipografía e imagen). */
export interface CoverDesignPart {
  text: string;
  size: number;
  color: string;
  y: number;
  align: 'left' | 'center' | 'right' | string;
  image?: string;
  imageFit?: 'cover' | 'contain' | string;
  [extra: string]: any;
}

/** Cubierta del libro (book.cover y coverDraft). */
export interface CoverDesign {
  spine: number;
  leftFlap: number;
  rightFlap: number;
  bleed: number;
  wrap?: number;
  safe: number;
  background: string;
  /** backFlap, back, spine, front, frontFlap. */
  parts: Record<string, CoverDesignPart>;
  [extra: string]: any;
}

/** Zona del desplegado: posición y ancho en mm. */
export interface CoverGeometryPart {
  id: string;
  x: number;
  w: number;
}

/** Desplegado de la cubierta: zonas presentes (ancho > 0), ancho total y alto, en mm. */
export interface CoverGeometry {
  parts: CoverGeometryPart[];
  width: number;
  height: number;
}

/** Punto de partida de un producto editorial (labels: castellano, inglés y portugués). */
export interface PublicationType {
  labels: [string, string, string];
  w: number;
  h: number;
  cols: number;
  rows: number;
  count: number;
}

declare global {
  /** Productos editoriales que ofrece el diálogo de documento nuevo. */
  var publicationTypes: Record<string, PublicationType>;
  /** Cubierta en edición (copia de book.cover mientras el editor está abierto). */
  var coverDraft: CoverDesign | null;
  /** Zona de la cubierta elegida en el editor (backFlap, back, spine, front, frontFlap). */
  var coverPart: string;
  /** Cubierta inicial: textos de ejemplo y medidas habituales. */
  var defaultCover: () => CoverDesign;
  /** Nombre de cada zona de la cubierta en el idioma actual. */
  var coverNames: () => Record<string, string>;
  /** Sangrado más demasía, en mm. */
  var coverExtension: (c: CoverDesign) => number;
  var coverGeometry: (c: CoverDesign) => CoverGeometry;
  /** Lanza un error legible si la cubierta tiene medidas o contenido fuera de rango; si no, la devuelve. */
  var validateCover: (c: CoverDesign) => CoverDesign;
  /** Dibuja la cubierta a px píxeles por mm (con guías de edición o marcas de corte si se piden). */
  var coverArtwork: (c: CoverDesign, px: number, guides?: boolean, crop?: boolean) => HTMLElement;
  /** Redibuja la vista previa y los campos del editor de cubierta. */
  var updateCoverPreview: () => void;
  var coverOutputDialog: () => void;
  /** Si algún texto de la cubierta no entra en su zona. */
  var coverOverflow: (c: CoverDesign) => boolean;
}

const publicationTypes: Record<string, PublicationType> = {
  book: { labels: ['Libro', 'Book', 'Livro'], w: 148, h: 210, cols: 1, rows: 1, count: 8 },
  magazine: {
    labels: ['Revista', 'Magazine', 'Revista'],
    w: 210,
    h: 280,
    cols: 3,
    rows: 6,
    count: 16,
  },
  newspaper: {
    labels: ['Diario', 'Newspaper', 'Jornal'],
    w: 280,
    h: 430,
    cols: 5,
    rows: 8,
    count: 8,
  },
  manual: { labels: ['Manual', 'Manual', 'Manual'], w: 210, h: 297, cols: 2, rows: 6, count: 12 },
  brochure: {
    labels: ['Folleto / catálogo', 'Brochure / catalogue', 'Folheto / catálogo'],
    w: 210,
    h: 210,
    cols: 3,
    rows: 4,
    count: 8,
  },
  custom: {
    labels: ['Personalizado', 'Custom', 'Personalizado'],
    w: 210,
    h: 297,
    cols: 1,
    rows: 1,
    count: 4,
  },
};
globalThis.publicationTypes = publicationTypes;
// El selector de producto editorial está en la Hoja de libro nuevo (src/components/book-setup/);
// al crear el libro, el producto elegido pone su grilla y sus márgenes.
extend.after(
  'applyBookSettings',
  function (isNew: boolean, values: { publicationType?: string }) {
    const type = values.publicationType;
    if (!isNew || !type || !hasDocument) return;
    const p = publicationTypes[type];
    commit(() => {
      book.publicationType = type;
      book.grid.cols = p.cols;
      book.grid.rows = p.rows;
      book.grid.gapX = 4;
      book.grid.gapY = 4;
      book.grid.enabled = p.cols > 1;
      book.margins = { top: 18, bottom: 18, inside: 18, outside: 18 };
      if (!M.validateGrid(book)) book.grid.gapX = book.grid.gapY = 0;
    }, true);
  },
  'publications',
);
globalThis.defaultCover = function (): CoverDesign {
  return {
    spine: 12,
    leftFlap: 70,
    rightFlap: 70,
    bleed: 3,
    safe: 8,
    background: '#FFFFFF',
    parts: {
      backFlap: {
        text: bw('Sobre el autor', 'About the author', 'Sobre o autor'),
        size: 11,
        color: '#202125',
        y: 30,
        align: 'left',
      },
      back: {
        text: bw('Sinopsis', 'Synopsis', 'Sinopse'),
        size: 14,
        color: '#202125',
        y: 40,
        align: 'left',
      },
      spine: { text: book.title, size: 12, color: '#202125', y: 0, align: 'center' },
      front: {
        text: book.title + '\n\n' + (book.author || ''),
        size: 28,
        color: '#202125',
        y: 45,
        align: 'center',
      },
      frontFlap: {
        text: bw(
          'Biografía y otras obras',
          'Biography and other works',
          'Biografia e outras obras',
        ),
        size: 11,
        color: '#202125',
        y: 30,
        align: 'left',
      },
    },
  };
};
globalThis.coverNames = () => ({
  backFlap: bw('Solapa de contratapa', 'Back flap', 'Orelha traseira'),
  back: bw('Contratapa', 'Back cover', 'Quarta capa'),
  spine: bw('Lomo', 'Spine', 'Lombada'),
  front: bw('Tapa', 'Front cover', 'Capa'),
  frontFlap: bw('Solapa de tapa', 'Front flap', 'Orelha dianteira'),
});
globalThis.coverExtension = function (c: CoverDesign): number {
  return c.bleed + (c.wrap || 0);
};
globalThis.coverGeometry = function (c: CoverDesign): CoverGeometry {
  const parts = (
    [
      ['backFlap', c.leftFlap],
      ['back', book.width],
      ['spine', c.spine],
      ['front', book.width],
      ['frontFlap', c.rightFlap],
    ] as [string, number][]
  ).filter(([, w]) => w > 0);
  let x = 0;
  return {
    parts: parts.map(([id, w]) => {
      const p = { id, x, w };
      x += w;
      return p;
    }),
    width: parts.reduce((s, p) => s + p[1], 0),
    height: book.height,
  };
};
globalThis.validateCover = function (c: CoverDesign): CoverDesign {
  if (c.wrap !== undefined && (!Number.isFinite(c.wrap) || c.wrap < 0 || c.wrap > 50))
    throw Error('Demasía: 0–50 mm');
  for (const [k, min, max] of [
    ['spine', 0, 100],
    ['leftFlap', 0, 150],
    ['rightFlap', 0, 150],
    ['bleed', 0, 10],
    ['safe', 3, 20],
  ] as [string, number, number][])
    if (!Number.isFinite(c[k]) || c[k] < min || c[k] > max)
      throw Error(
        bw(
          'Revisá las medidas de cubierta.',
          'Review cover dimensions.',
          'Revise as medidas da capa.',
        ),
      );
  if (!/^#[0-9a-f]{6}$/i.test(c.background)) throw Error('Color');
  for (const p of Object.values(c.parts)) {
    if (
      typeof p.text !== 'string' ||
      p.text.length > 3000 ||
      !Number.isFinite(p.size) ||
      p.size < 4 ||
      p.size > 100 ||
      !Number.isFinite(p.y) ||
      p.y < 0 ||
      p.y > book.height ||
      !/^#[0-9a-f]{6}$/i.test(p.color) ||
      !['left', 'center', 'right'].includes(p.align) ||
      (p.image &&
        (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(p.image) ||
          p.image.length > 20000000))
    )
      throw Error(
        bw(
          'Revisá el texto, imagen o tipografía de la cubierta.',
          'Review cover text, image or typography.',
          'Revise texto, imagem ou tipografia da capa.',
        ),
      );
  }
  return c;
};
globalThis.coverArtwork = function (
  c: CoverDesign,
  px: number,
  guides = false,
  crop = false,
): HTMLElement {
  const g = coverGeometry(c),
    pad = coverExtension(c) + (crop ? 7 : 0),
    root = document.createElement('div');
  root.className = 'cover-artwork';
  Object.assign(root.style, {
    position: 'relative',
    width: (g.width + pad * 2) * px + 'px',
    height: (g.height + pad * 2) * px + 'px',
    overflow: 'hidden',
    background: 'white',
  });
  const bg = document.createElement('div');
  Object.assign(bg.style, {
    position: 'absolute',
    left: (pad - coverExtension(c)) * px + 'px',
    top: (pad - coverExtension(c)) * px + 'px',
    width: (g.width + 2 * coverExtension(c)) * px + 'px',
    height: (g.height + 2 * coverExtension(c)) * px + 'px',
    background: c.background,
  });
  root.append(bg);
  for (const part of g.parts) {
    const p = c.parts[part.id],
      region = document.createElement('div');
    region.dataset.coverPart = part.id;
    Object.assign(region.style, {
      position: 'absolute',
      left: (pad + part.x) * px + 'px',
      top: pad * px + 'px',
      width: part.w * px + 'px',
      height: g.height * px + 'px',
      overflow: 'visible',
      boxSizing: 'border-box',
    });
    if (p.image) {
      const img = document.createElement('img');
      img.src = p.image;
      Object.assign(img.style, {
        width:
          (part.w +
            (part.x === 0 ? coverExtension(c) : 0) +
            (part.x + part.w === g.width ? coverExtension(c) : 0)) *
            px +
          'px',
        height: (g.height + 2 * coverExtension(c)) * px + 'px',
        objectFit: 'cover',
        position: 'absolute',
        top: -coverExtension(c) * px + 'px',
        left: -(part.x === 0 ? coverExtension(c) : 0) * px + 'px',
      });
      region.append(img);
    }
    const text = document.createElement('div');
    text.className = 'cover-text';
    text.textContent = p.text;
    Object.assign(text.style, {
      position: 'absolute',
      fontFamily: coverFontFamily(),
      fontSize: ((p.size * 25.4) / 72) * px + 'px',
      lineHeight: '1.4',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      color: p.color,
      textAlign: p.align,
      boxSizing: 'border-box',
    });
    if (part.id === 'spine') {
      const safe = Math.min(c.safe, part.w * 0.2);
      Object.assign(text.style, {
        left: '50%',
        top: '50%',
        width: Math.max(1, g.height - 2 * c.safe) * px + 'px',
        maxHeight: Math.max(1, part.w - safe * 2) * px + 'px',
        overflow: 'hidden',
        transform: 'translate(-50%,-50%) rotate(90deg)',
        textAlign: 'center',
      });
    } else {
      const safe = Math.min(c.safe, part.w / 4);
      Object.assign(text.style, {
        left: safe * px + 'px',
        top: p.y * px + 'px',
        width: Math.max(1, part.w - 2 * safe) * px + 'px',
        maxHeight: Math.max(1, g.height - p.y - c.safe) * px + 'px',
        overflow: 'hidden',
      });
    }
    region.append(text);
    if (guides) {
      region.style.outline = part.id === coverPart ? '2px solid #40D6BE' : '1px dashed #E6B66B';
      const label = document.createElement('span');
      label.textContent = coverNames()[part.id];
      Object.assign(label.style, {
        position: 'absolute',
        top: '3px',
        left: '3px',
        font: '9px sans-serif',
        color: '#F3D6A2',
        background: '#102C30CC',
        padding: '3px',
        pointerEvents: 'none',
      });
      if (part.id !== 'spine') region.append(label);
      region.style.cursor = 'pointer';
      region.onclick = () => {
        coverPart = part.id;
        updateCoverPreview();
      };
      const guide = document.createElement('div');
      Object.assign(guide.style, {
        position: 'absolute',
        inset: Math.min(c.safe, part.w / 4) * px + 'px',
        border: '1px dashed #54DCC8',
        pointerEvents: 'none',
      });
      region.append(guide);
    }
    root.append(region);
  }
  if (crop)
    root.insertAdjacentHTML(
      'beforeend',
      cropSvg(
        pad - (c.wrap || 0),
        pad - (c.wrap || 0),
        g.width + 2 * (c.wrap || 0),
        g.height + 2 * (c.wrap || 0),
        g.width + 2 * pad,
        g.height + 2 * pad,
      ),
    );
  return root;
};
globalThis.coverDraft = null;
globalThis.coverPart = 'front';
globalThis.updateCoverPreview = function (): void {
  const area = $('#coverPreview');
  if (!area) return;
  const c = coverDraft!,
    g = coverGeometry(c),
    px = 96 / 25.4,
    k = Math.min(
      (area.clientWidth - 20) / ((g.width + coverExtension(c) * 2) * px),
      280 / ((g.height + coverExtension(c) * 2) * px),
    );
  const art = coverArtwork(c, px, true);
  art.style.transform = `scale(${k})`;
  art.style.transformOrigin = 'top left';
  const wrap = document.createElement('div');
  wrap.style.width = art.style.width;
  wrap.style.height = art.style.height;
  wrap.style.zoom = String(k);
  art.style.transform = 'none';
  wrap.append(art);
  area.replaceChildren(wrap);
  $('#coverDimensions').textContent =
    `${displayDimensions(g.width, g.height)} · + ${displayMeasure(c.bleed)} ${documentUnit()} ${bw('sangrado', 'bleed', 'sangria')} · ${g.parts.map((p) => coverNames()[p.id]).join(' / ')}`;
  $('#coverRegion').textContent = coverNames()[coverPart];
  const text = $('#coverText');
  text.value = c.parts[coverPart].text;
  $('#coverSize').value = c.parts[coverPart].size;
  $('#coverTextColor').value = c.parts[coverPart].color;
  $('#coverY').value = c.parts[coverPart].y;
  $('#coverAlign').value = c.parts[coverPart].align;
  $$('[data-cover-edit]').forEach((b) =>
    b.classList.toggle('primary', b.dataset.coverEdit === coverPart),
  );
};
// El editor de la cubierta (coverEditor) es una Ventana de trabajo en React:
// src/components/cover/CoverEditor.tsx.
globalThis.coverOutputDialog = function (): void {
  return coverSheetDialog('pdf');
};
extend.instead(
  'prepareOutput',
  (config: { kind?: string; crop?: boolean }) => config.kind === 'cover',
  function (config: { kind?: string; crop?: boolean }) {
    const c = validateCover(book.cover),
      g = coverGeometry(c),
      pad = coverExtension(c) + (config.crop ? 7 : 0),
      width = g.width + pad * 2,
      height = g.height + pad * 2,
      root = $('#printRoot');
    root.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `@page{size:${width}mm ${height}mm;margin:0}`;
    const art = coverArtwork(c, 96 / 25.4, false, config.crop);
    art.classList.add('print-page');
    root.append(style, art);
    window.outputReady = false;
    Promise.all([
      document.fonts.ready,
      ...[...art.querySelectorAll('img')].map((i) => i.decode().catch(() => {})),
    ]).then(() => (window.outputReady = true));
    return { width, height, faces: 1, scale: 1 };
  },
  'publications',
);
const coverButton = document.createElement('button');
coverButton.className = 'tool';
coverButton.id = 'coverTool';
coverButton.innerHTML = icon('pages') + '<span>' + bw('Cubierta', 'Cover', 'Capa') + '</span>';
// Por el global: el editor es de src/components/cover/ y carga después que este módulo.
coverButton.onclick = () => coverEditor();
$('#tools').append(coverButton);
// La cubierta es un paso del recorrido del libro (book-workflow.ts); acá sólo se traduce su botón.
document.addEventListener('maquetario:language', () => {
  coverButton.querySelector('span')!.textContent = bw('Cubierta', 'Cover', 'Capa');
});

globalThis.coverOverflow = function (c: CoverDesign): boolean {
  const art = coverArtwork(c, 96 / 25.4, false);
  Object.assign(art.style, { position: 'fixed', left: '-10000px', top: '0', visibility: 'hidden' });
  document.body.append(art);
  try {
    return [...art.querySelectorAll('.cover-text')].some(
      (t) => t.scrollHeight > t.clientHeight + 2 || t.scrollWidth > t.clientWidth + 2,
    );
  } finally {
    art.remove();
  }
};
