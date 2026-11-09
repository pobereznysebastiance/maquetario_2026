import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyPdfX,
  inspectPdfX,
  pdfxHeader,
  pdfxMetadata,
  pdfxProblems,
} from '../src/main/pdfx.ts';
import {
  applyPrintBoxes,
  openPdf,
  pdfLibModule,
  POINTS_PER_MM,
  readPrintBoxes,
  savePdf,
} from '../src/main/print-boxes.ts';

const icc = join(import.meta.dirname, '..', 'assets', 'icc');
const outputProfile = readFileSync(join(icc, 'FOGRA39L_coated.icc'));
const rgbProfile = readFileSync(join(icc, 'sRGB.icc'));
// pdf-lib por dentro, para armar un PDF como los de Chromium.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lib = pdfLibModule as any;
const NOW = new Date('2026-11-09T12:34:56.789Z');
const ID = Uint8Array.from({ length: 16 }, (_, i) => i * 17);

/** Como un PDF de Chromium: RGB de dispositivo, imagen, transparencia, un enlace y Skia. */
async function chromiumLike(): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create();
  doc.setProducer('Skia/PDF m156');
  doc.setTitle('index.html');
  const ctx = doc.context;
  const N = (n: string) => lib.PDFName.of(n);
  for (let i = 0; i < 2; i++) {
    const page = doc.addPage([420, 596]);
    page.drawRectangle({ x: 20, y: 20, width: 100, height: 50, color: lib.rgb(0.2, 0.8, 0.7) });
    const image = ctx.register(
      ctx.stream(Uint8Array.of(255, 0, 0), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 1,
        Height: 1,
        BitsPerComponent: 8,
        ColorSpace: 'DeviceRGB',
      }),
    );
    const form = ctx.register(
      ctx.stream(new TextEncoder().encode('0 0 1 rg 0 0 10 10 re f'), {
        Type: 'XObject',
        Subtype: 'Form',
        BBox: [0, 0, 10, 10],
        Group: { Type: 'Group', S: 'Transparency', CS: 'DeviceRGB', I: true },
        Resources: { ProcSet: ['PDF'] },
      }),
    );
    const resources = ctx.lookup(page.node.get(N('Resources')));
    resources.set(N('XObject'), ctx.obj({ Im0: image, Fm0: form }));
    const link = ctx.register(
      ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10], Border: [0, 0, 0] }),
    );
    page.node.set(N('Annots'), ctx.obj([link]));
  }
  return doc.save();
}

async function toPdfX(): Promise<Uint8Array> {
  const doc = await openPdf(await chromiumLike());
  applyPrintBoxes(doc, { width: 148, height: 210 }, { width: 140, height: 200, bleed: 3 });
  applyPdfX(doc, {
    outputProfile,
    rgbProfile,
    title: 'El atlas de las casas vacías <1>',
    creator: 'Maquetario 3.24.0',
    now: NOW,
    id: ID,
  });
  return pdfxHeader(await savePdf(doc));
}

test('los perfiles son los de assets/icc/LICENCIAS.md', () => {
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const licenses = readFileSync(join(icc, 'LICENCIAS.md'), 'utf8');
  assert.ok(licenses.includes(sha(outputProfile)), 'suma de FOGRA39L_coated.icc');
  assert.ok(licenses.includes(sha(rgbProfile)), 'suma de sRGB.icc');
  // Encabezados ICC: perfil de salida CMYK y de monitor RGB.
  assert.equal(outputProfile.subarray(12, 20).toString('latin1'), 'prtrCMYK');
  assert.equal(rgbProfile.subarray(12, 20).toString('latin1'), 'mntrRGB ');
});

test('un PDF de Chromium sin tocar no es PDF/X', async () => {
  const bytes = await chromiumLike();
  const problems = pdfxProblems(inspectPdfX(await openPdf(bytes), bytes));
  for (const expected of ['OutputIntent', 'GTS_PDFXVersion', '/ID', 'anotaciones', 'DefaultRGB'])
    assert.ok(
      problems.some((p) => p.includes(expected)),
      `${expected} en ${problems.join(' · ')}`,
    );
});

test('PDF/X-4: OutputIntent, XMP, Info, /ID, encabezado y RGB etiquetado', async () => {
  const bytes = await toPdfX();
  const report = inspectPdfX(await openPdf(bytes), bytes);
  assert.deepEqual(pdfxProblems(report), []);
  assert.equal(report.header, '%PDF-1.6');

  const [intent] = report.outputIntents;
  assert.equal(intent!.subtype, '/GTS_PDFX');
  assert.equal(intent!.identifier, 'FOGRA39');
  assert.equal(intent!.registry, 'http://www.color.org');
  assert.equal(intent!.info, 'FOGRA39L Coated');
  assert.equal(intent!.profileComponents, 4);

  const xmp = report.metadata!;
  assert.match(xmp, /<pdfxid:GTS_PDFXVersion>PDF\/X-4<\/pdfxid:GTS_PDFXVersion>/);
  assert.match(xmp, /El atlas de las casas vacías &lt;1&gt;/);
  assert.match(xmp, /<xmp:CreateDate>2026-11-09T12:34:56Z<\/xmp:CreateDate>/);
  assert.match(xmp, /<xmpMM:DocumentID>uuid:00112233-4455-6677-8899-aabbccddeeff</);
  assert.match(xmp, /<pdf:Producer>Skia\/PDF m156<\/pdf:Producer>/);
  assert.ok(xmp.startsWith('<?xpacket begin="﻿"'));

  assert.equal(report.info.Title, 'El atlas de las casas vacías <1>');
  assert.equal(report.info.Creator, 'Maquetario 3.24.0');
  assert.equal(report.info.Trapped, '/False');
  assert.equal(report.info.GTS_PDFXVersion, 'PDF/X-4');
  assert.equal(report.info.CreationDate, 'D:20261109123456Z');
  assert.equal(report.info.ModDate, 'D:20261109123456Z');

  // /ID en el trailer, con los mismos bytes que los uuid del XMP.
  const trailer = Buffer.from(bytes.subarray(bytes.length - 400)).toString('latin1');
  assert.match(
    trailer,
    /\/ID \[ <00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff> \]/i,
  );

  assert.equal(report.pages.length, 2);
  for (const page of report.pages) {
    assert.equal(page.defaultRgb, true);
    assert.equal(page.annotations, false);
  }
  assert.equal(report.deviceRgb, 0);
});

test('el Form con transparencia también recibe DefaultRGB y sRGB en el grupo', async () => {
  const doc = await openPdf(await toPdfX());
  const N = (n: string) => lib.PDFName.of(n);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (doc as any).context;
  let forms = 0;
  for (const [, object] of ctx.enumerateIndirectObjects()) {
    if (!(object instanceof lib.PDFStream)) continue;
    const dict = object.dict;
    if (String(dict.get(N('Subtype'))) !== '/Form') continue;
    forms++;
    const group = ctx.lookup(dict.get(N('Group')));
    const cs = ctx.lookup(group.get(N('CS')));
    assert.equal(String(cs.get(0)), '/ICCBased');
    const spaces = ctx.lookup(ctx.lookup(dict.get(N('Resources'))).get(N('ColorSpace')));
    assert.ok(spaces.has(N('DefaultRGB')));
  }
  assert.equal(forms, 2);
});

test('las cajas siguen exactas después del PDF/X', async () => {
  const [boxes] = await readPrintBoxes(await toPdfX());
  const width = boxes!.media[2] - boxes!.media[0];
  assert.ok(Math.abs(width - 148 * POINTS_PER_MM) < 1e-6);
  const trim = boxes!.trim[2] - boxes!.trim[0];
  const bleed = boxes!.bleed[2] - boxes!.bleed[0];
  assert.ok(Math.abs(trim - 140 * POINTS_PER_MM) < 1e-6);
  assert.ok(Math.abs(bleed - 146 * POINTS_PER_MM) < 1e-6);
});

test('el encabezado pasa a 1.6 sin mover la tabla xref, y el PDF se sigue abriendo', async () => {
  const bytes = await toPdfX();
  assert.equal(Buffer.from(bytes.subarray(0, 8)).toString('latin1'), '%PDF-1.6');
  // pdf-lib lo vuelve a abrir y encuentra todas las páginas por la tabla xref.
  assert.equal((await openPdf(bytes)).getPages().length, 2);
  assert.throws(() => pdfxHeader(new TextEncoder().encode('hola')));
  const old = new TextEncoder().encode('%PDF-1.4\n');
  assert.equal(
    new TextDecoder().decode(pdfxHeader(old)),
    '%PDF-1.4\n',
    'no sube una versión menor',
  );
});

test('el XMP escapa el texto y lleva los datos de PDF/X-4', () => {
  const xmp = pdfxMetadata({
    title: 'A & B "C"',
    creator: 'Maquetario',
    producer: 'Skia',
    date: NOW,
    documentId: 'uuid:1',
    instanceId: 'uuid:2',
  });
  assert.match(xmp, /A &amp; B &quot;C&quot;/);
  assert.match(xmp, /<xmpMM:RenditionClass>default<\/xmpMM:RenditionClass>/);
  assert.match(xmp, /<\?xpacket end="w"\?>$/);
});
