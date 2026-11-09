// PDF propio del motor de composición (etapa 4, paso 6): lo que la página le pasa al proceso
// principal para escribir el PDF. La arma composePdfLayout (src/modules/compose.ts) y la escribe
// desktop/src/main/compose-pdf.ts. Sólo tipos, sin dependencias: lo importan las dos partes.
// Medidas en puntos, desde la esquina superior izquierda de cada hoja.

export interface PdfGlyph {
  gid: number;
  /** Origen del glifo, en puntos desde el borde izquierdo de la hoja. */
  x: number;
}

export interface PdfText {
  font: string;
  size: number;
  color: [number, number, number];
  /** Línea de base, en puntos desde el borde superior de la hoja. */
  y: number;
  glyphs: PdfGlyph[];
  /** Negrita y cursiva sintéticas, como las arma Chromium cuando la familia no tiene esa cara. */
  fakeBold?: boolean;
  fakeItalic?: boolean;
}

export interface PdfFont {
  key: string;
  url: string;
  variations: Record<string, number>;
  name: string;
  upem: number;
  ascender: number;
  descender: number;
  italic: boolean;
  /** Avance de cada glifo usado, en unidades de la fuente (de la instancia, si es variable). */
  widths: Record<number, number>;
  /** El texto que representa cada glifo (para ToUnicode: copiar y buscar). */
  unicode: Record<number, string>;
}

export interface PdfImage {
  src: string;
  /** Dónde va la imagen entera y el recorte de su caja, en puntos. */
  x: number;
  y: number;
  width: number;
  height: number;
  clip: { x: number; y: number; width: number; height: number };
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: [number, number, number];
  /** Filete de puntos (border dotted): puntos redondos del grosor del filete. */
  dotted?: boolean;
}

export interface PdfSheet {
  width: number;
  height: number;
  texts: PdfText[];
  images: PdfImage[];
  rects: PdfRect[];
}

export interface PdfLayout {
  sheets: PdfSheet[];
  fonts: PdfFont[];
  /** Líneas que dibuja el motor y palabras que quedan donde las puso Chromium. */
  composedLines: number;
  domWords: number;
  /** Lo que no se dibuja, por motivo. */
  notes: Record<string, number>;
}
