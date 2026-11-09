// Medidas de la cubierta: tabla de cada zona (tamaño final y píxeles a 300 ppp) en el editor de
// cubierta, ficha descargable y ajuste de imagen por zona (cubrir o mostrar completa).
//
// coverMeasurementRows y coverMeasurementText son globales porque las usa
// tests/cover-measurements-tests.js.
//
// Fuente TypeScript: se compila a build/cover-measurements.js (desktop/scripts/build.mjs).

import type { CoverDesign, CoverGeometryPart } from './publications.ts';

export interface CoverMeasurementRow extends CoverGeometryPart {
  height: number;
  pixelW: number;
  pixelH: number;
}

declare global {
  /** Tamaño final de cada zona de la cubierta, con su equivalente en píxeles a 300 ppp. */
  var coverMeasurementRows: (c: CoverDesign) => CoverMeasurementRow[];
  /** Ficha de medidas de la cubierta en texto plano (la que se descarga). */
  var coverMeasurementText: (c: CoverDesign) => string;
}

function coverMeasurementRows(c: CoverDesign): CoverMeasurementRow[] {
  return coverGeometry(c).parts.map((p) => ({
    ...p,
    height: book.height,
    pixelW: Math.round((p.w / 25.4) * 300),
    pixelH: Math.round((book.height / 25.4) * 300),
  }));
}
globalThis.coverMeasurementRows = coverMeasurementRows;
function coverMeasurementText(c: CoverDesign): string {
  const g = coverGeometry(c);
  return [
    'MAQUETARIO · ' + book.title,
    bw('FICHA DE CUBIERTA', 'COVER SPECIFICATION', 'FICHA DE CAPA'),
    ...coverMeasurementRows(c).map(
      (p) =>
        `${coverNames()[p.id]}: ${displayDimensions(p.w, p.height)} · ${p.pixelW} × ${p.pixelH} px (300 ppp)`,
    ),
    `${bw('Desplegado final', 'Trimmed spread', 'Peça final')}: ${displayDimensions(g.width, g.height)}`,
    `${bw('Con sangrado y demasía', 'With bleed and wrap', 'Com sangria e dobra')}: ${displayDimensions(g.width + 2 * coverExtension(c), g.height + 2 * coverExtension(c))}`,
    `${bw('Sangrado exterior', 'Outer bleed', 'Sangria externa')}: ${displayMeasure(c.bleed)} ${documentUnit()}`,
    `${bw('Demasía por lado', 'Wrap allowance per edge', 'Dobra por lado')}: ${displayMeasure(c.wrap || 0)} ${documentUnit()}`,
    `${bw('Seguridad de texto', 'Text safety', 'Segurança do texto')}: ${displayMeasure(c.safe)} ${documentUnit()}`,
    bw(
      'Las partes se colocan al tamaño final indicado. El sangrado se añade al contorno exterior del desplegado, no a cada pliegue. Los píxeles son una referencia a 300 ppp, no una comprobación de la calidad de la imagen. Confirmar lomo y troquel con la imprenta.',
      'Place parts at the stated trim sizes. Bleed is added around the outer spread, not at each fold. Pixel values are a 300 ppi reference, not an image quality check. Confirm spine and dieline with the printer.',
      'Insira as partes nos tamanhos finais. A sangria vai no contorno externo, não em cada dobra. Os pixels são referência a 300 ppp, não uma verificação de qualidade. Confirme lombada e faca com a gráfica.',
    ),
  ].join('\n');
}
globalThis.coverMeasurementText = coverMeasurementText;
function refreshCoverMeasurements(): void {
  if (!$('#coverMeasureTable')) return;
  const c = coverDraft!,
    g = coverGeometry(c);
  $('#coverMeasureTable').innerHTML =
    `<thead><tr><th>${bw('Zona', 'Area', 'Área')}</th><th>${bw('Tamaño final', 'Trim size', 'Tamanho final')} · ${documentUnit()}</th><th>${bw('Imagen a 300 ppp · px', 'Image at 300 ppi · px', 'Imagem a 300 ppp · px')}</th></tr></thead><tbody>${coverMeasurementRows(
      c,
    )
      .map(
        (p) =>
          `<tr class="${p.id === coverPart ? 'selected' : ''}"><td>${coverNames()[p.id]}</td><td>${displayMeasure(p.w)} × ${displayMeasure(p.height)}</td><td>${p.pixelW} × ${p.pixelH}</td></tr>`,
      )
      .join('')}</tbody>`;
  $('#coverMeasureSummary').textContent =
    bw('Desplegado final: ', 'Trimmed spread: ', 'Peça final: ') +
    `${displayDimensions(g.width, g.height)} · ` +
    bw('Con sangrado y demasía: ', 'With bleed and wrap: ', 'Com sangria e dobra: ') +
    `${displayDimensions(g.width + 2 * coverExtension(c), g.height + 2 * coverExtension(c))}`;
  if ($('#coverImageFit')) $('#coverImageFit').value = c.parts[coverPart].imageFit || 'cover';
}
extend.after(
  'updateCoverPreview',
  function () {
    refreshCoverMeasurements();
  },
  'cover-measurements',
);
extend.result(
  'coverArtwork',
  function (art: HTMLElement, c: CoverDesign, px: number, guides = false, crop = false) {
    art.querySelectorAll<HTMLElement>('[data-cover-part]').forEach((region) => {
      const img = region.querySelector('img');
      if (img) img.style.objectFit = c.parts[region.dataset.coverPart!].imageFit || 'cover';
    });
    return art;
  },
  'cover-measurements',
);
