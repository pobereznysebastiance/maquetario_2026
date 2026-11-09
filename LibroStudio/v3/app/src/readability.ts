// Legibilidad y retículas: "Guardar como…" (Ctrl+Mayús+S), el tamaño de la interfaz (cómodo o
// grande) y la biblioteca de retículas que reemplaza a las plantillas de studio.js.
//
// setReadability, gridPresets y applyGridPreset son globales: los usan settings-panel.tsx,
// cover-measurements.js, las pruebas (tests/readability-tests.js, tests/feedback-tests.js) y
// scripts/style-snapshot.js. La biblioteca de retículas (gridGallery) es una Hoja en React:
// src/components/grid-gallery/GridGallery.tsx (usa gridSize de acá).
//
// Fuente TypeScript: se compila a build/readability.js (desktop/scripts/build.mjs).
import { refreshCanvasBar } from './components/canvas-bar/canvas-bar-state.ts';
import { bw } from './i18n/language.ts';
import { saveProjectAs } from './save-as.ts';
('use strict');

/** Retícula de la biblioteca: columnas (c), filas (r) y medianiles (gx, gy) en mm. */
export interface GridPreset {
  id: string;
  /** Nombre en castellano, inglés y portugués. */
  name: [string, string, string];
  c: number;
  r: number;
  gx: number;
  gy: number;
  /** Para qué sirve, en los tres idiomas. */
  use: [string, string, string];
}

declare global {
  /** Tamaño de la interfaz: 'large' agranda menús y controles; cualquier otro valor, cómodo. */
  var setReadability: (value: string) => void;
  /** Las diez retículas de la biblioteca. */
  var gridPresets: GridPreset[];
  /** Aplica una retícula de la biblioteca (sin mover objetos). */
  var applyGridPreset: (id: string) => void;
}

document.addEventListener(
  'keydown',
  (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!welcomeVisible && !document.querySelector('#dialogLayer dialog[open]')) saveProjectAs();
    }
  },
  true,
);
function setReadability(value: string): void {
  const big = value === 'large';
  document.body.classList.toggle('ui-large', big);
  localStorage.setItem('maquetario-readability', big ? 'large' : 'standard');
  requestAnimationFrame(() => renderPages());
}
globalThis.setReadability = setReadability;
setReadability(localStorage.getItem('maquetario-readability') || 'standard');
const gridPresets: GridPreset[] = [
  {
    id: 'manuscript',
    name: ['Manuscrito', 'Manuscript', 'Manuscrito'],
    c: 1,
    r: 1,
    gx: 0,
    gy: 0,
    use: [
      'Novela y lectura continua',
      'Novel and continuous reading',
      'Romance e leitura contínua',
    ],
  },
  {
    id: 'book',
    name: ['Libro · 2 × 4', 'Book · 2 × 4', 'Livro · 2 × 4'],
    c: 2,
    r: 4,
    gx: 5,
    gy: 4,
    use: ['Texto e imagen', 'Text and image', 'Texto e imagem'],
  },
  {
    id: 'magazine',
    name: ['Revista · 3 × 6', 'Magazine · 3 × 6', 'Revista · 3 × 6'],
    c: 3,
    r: 6,
    gx: 4,
    gy: 4,
    use: ['Artículos y reportajes', 'Articles and features', 'Artigos e reportagens'],
  },
  {
    id: 'manual',
    name: ['Manual · 4 × 8', 'Manual · 4 × 8', 'Manual · 4 × 8'],
    c: 4,
    r: 8,
    gx: 4,
    gy: 3,
    use: [
      'Pasos, fichas e infografías',
      'Steps, cards and infographics',
      'Passos, fichas e infográficos',
    ],
  },
  {
    id: 'catalogue',
    name: ['Catálogo · 5 × 4', 'Catalogue · 5 × 4', 'Catálogo · 5 × 4'],
    c: 5,
    r: 4,
    gx: 3,
    gy: 4,
    use: ['Productos y combinaciones', 'Products and combinations', 'Produtos e combinações'],
  },
  {
    id: 'five-ten',
    name: ['Modular · 5 × 10', 'Modular · 5 × 10', 'Modular · 5 × 10'],
    c: 5,
    r: 10,
    gx: 3,
    gy: 3,
    use: [
      'Composición editorial flexible',
      'Flexible editorial composition',
      'Composição editorial flexível',
    ],
  },
  {
    id: 'six-six',
    name: ['Modular · 6 × 6', 'Modular · 6 × 6', 'Modular · 6 × 6'],
    c: 6,
    r: 6,
    gx: 3,
    gy: 3,
    use: ['Bloques y dobles columnas', 'Blocks and double columns', 'Blocos e colunas duplas'],
  },
  {
    id: 'newspaper',
    name: ['Diario · 6 × 12', 'Newspaper · 6 × 12', 'Jornal · 6 × 12'],
    c: 6,
    r: 12,
    gx: 3,
    gy: 3,
    use: ['Noticias y módulos', 'News and modules', 'Notícias e módulos'],
  },
  {
    id: 'eight',
    name: ['Atlas · 8 × 8', 'Atlas · 8 × 8', 'Atlas · 8 × 8'],
    c: 8,
    r: 8,
    gx: 2,
    gy: 2,
    use: ['Mapas y contenido visual', 'Maps and visual content', 'Mapas e conteúdo visual'],
  },
  {
    id: 'twelve',
    name: ['Flexible · 12 × 12', 'Flexible · 12 × 12', 'Flexível · 12 × 12'],
    c: 12,
    r: 12,
    gx: 2,
    gy: 2,
    use: ['Agrupaciones de 2, 3, 4 o 6', 'Groups of 2, 3, 4 or 6', 'Grupos de 2, 3, 4 ou 6'],
  },
];
globalThis.gridPresets = gridPresets;
function applyGridPreset(id: string): void {
  const p = gridPresets.find((p) => p.id === id);
  if (!p) return;
  commit(() => {
    book.grid.cols = p.c;
    book.grid.rows = p.r;
    book.grid.fit = 'margins';
    const rect = M.gridRect(book, active);
    book.grid.gapX = p.c > 1 ? Math.max(0, Math.min(p.gx, (rect.w - p.c * 2) / (p.c - 1))) : 0;
    book.grid.gapY = p.r > 1 ? Math.max(0, Math.min(p.gy, (rect.h - p.r * 2) / (p.r - 1))) : 0;
    book.grid.enabled = true;
    if (!M.validateGrid(book))
      throw Error(
        bw(
          'La grilla no cabe con estos márgenes.',
          'The grid does not fit these margins.',
          'A grade não cabe nestas margens.',
        ),
      );
  }, true);
  toast(
    bw(
      'Grilla aplicada. Los objetos conservan su posición.',
      'Grid applied. Objects keep their positions.',
      'Grade aplicada. Os objetos mantêm a posição.',
    ),
  );
}
globalThis.applyGridPreset = applyGridPreset;
/** "3 columnas · 6 filas", con singular cuando corresponde. */
export const gridSize = (c: number, r: number): string =>
  `${c} ${c === 1 ? bw('columna', 'column', 'coluna') : bw('columnas', 'columns', 'colunas')} · ` +
  `${r} ${r === 1 ? bw('fila', 'row', 'linha') : bw('filas', 'rows', 'linhas')}`;
// La franja de plantillas (gridPresets, la activa marcada) y "Ver todas…" los dibuja la barra
// del lienzo (React, components/canvas-bar/CanvasBar.tsx). renderTemplates sólo le avisa que
// vuelva a leer la grilla del libro (la llaman render y las pruebas).
extend.replace(
  'renderTemplates',
  function () {
    refreshCanvasBar(true);
  },
  'readability',
);
