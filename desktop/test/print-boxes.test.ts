import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boxesFor,
  fixPrintBoxes,
  pdfLib,
  POINTS_PER_MM,
  readPrintBoxes,
  type Box,
} from '../src/main/print-boxes.ts';

const pt = (mm: number) => mm * POINTS_PER_MM;
const close = (actual: Box, expected: Box, label: string) =>
  actual.forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]!) < 1e-6, `${label}: ${actual} ≠ ${expected}`),
  );

/** Un PDF como el de Chromium: tamaño redondeado al punto entero. */
async function roundedPdf(pages: number, width: number, height: number): Promise<Uint8Array> {
  const doc = await pdfLib.PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([width, height]);
  return doc.save();
}

test('A5 sin marcas: MediaBox exacta, anclada arriba a la izquierda, y corte = hoja', async () => {
  const fixed = await fixPrintBoxes(await roundedPdf(3, 420, 596), { width: 148, height: 210 });
  const pages = await readPrintBoxes(fixed);
  assert.equal(pages.length, 3);
  const a5: Box = [0, 596 - pt(210), pt(148), 596];
  for (const boxes of pages) {
    close(boxes.media, a5, 'media');
    close(boxes.crop, a5, 'crop');
    close(boxes.trim, a5, 'trim');
    close(boxes.bleed, a5, 'bleed');
  }
  // 148 × 210 mm = 419,53 × 595,28 pt: lo que Chromium redondea a 420 × 596 ya no queda.
  assert.ok(Math.abs(pages[0]!.media[2] - pages[0]!.media[0] - 419.5276) < 1e-3);
});

test('con marcas de corte: el corte queda centrado a 7 mm del borde', async () => {
  const fixed = await fixPrintBoxes(
    await roundedPdf(1, 459, 635),
    { width: 162, height: 224 },
    { width: 148, height: 210, bleed: 0 },
  );
  const [boxes] = await readPrintBoxes(fixed);
  const bottom = 635 - pt(224);
  close(boxes!.media, [0, bottom, pt(162), 635], 'media');
  close(boxes!.trim, [pt(7), bottom + pt(7), pt(155), bottom + pt(217)], 'trim');
  close(boxes!.bleed, boxes!.trim, 'sin sangrado, BleedBox = TrimBox');
});

test('cubierta: sangrado alrededor del corte, sin salirse de la hoja', () => {
  // Desplegado de 316 × 210 mm + 3 mm de sangrado + 7 mm para las marcas.
  const sheet = { width: 316 + 20, height: 210 + 20 };
  const boxes = boxesFor([0, 0, 900, 700], sheet, { width: 316, height: 210, bleed: 3 });
  const top = 700;
  const bottom = top - pt(230);
  close(boxes.trim, [pt(10), bottom + pt(10), pt(326), bottom + pt(220)], 'trim');
  close(boxes.bleed, [pt(7), bottom + pt(7), pt(329), bottom + pt(223)], 'bleed');
  // Sangrado más grande que el margen: llega hasta el borde de la hoja y no más.
  const wide = boxesFor([0, 0, 900, 700], sheet, { width: 316, height: 210, bleed: 30 });
  close(wide.bleed, wide.media, 'bleed recortado a la hoja');
});

test('un corte más grande que la hoja se ajusta a la hoja; una hoja inválida da error', () => {
  const boxes = boxesFor(
    [0, 0, 100, 100],
    { width: 30, height: 30 },
    {
      width: 40,
      height: 40,
      bleed: 0,
    },
  );
  close(boxes.trim, boxes.media, 'trim');
  assert.throws(() => boxesFor([0, 0, 1, 1], { width: 0, height: 10 }));
  assert.throws(() => boxesFor([0, 0, 1, 1], { width: Number.NaN, height: 10 }));
});

test('sin datos de corte válidos, el corte es la hoja', () => {
  const boxes = boxesFor(
    [0, 0, 10, 10],
    { width: 100, height: 100 },
    {
      width: Number.NaN,
      height: 10,
      bleed: 0,
    },
  );
  close(boxes.trim, boxes.media, 'trim');
});

test('respeta una MediaBox que no empieza en el origen', () => {
  const boxes = boxesFor([10, 20, 430, 616], { width: 148, height: 210 });
  close(boxes.media, [10, 616 - pt(210), 10 + pt(148), 616], 'media');
});
