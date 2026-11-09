// PDF/X-4 "con RGB etiquetado" (etapa 4, docs/IMPRENTA_09-nov_pdfx.md). No convierte a CMYK:
// declara la condición de impresión (OutputIntent FOGRA39 con su perfil) y etiqueta el RGB de
// Chromium como sRGB (DefaultRGB), para que lo convierta el RIP de la imprenta. Además:
// - encabezado %PDF-1.6 (PDF/X-4 se basa en PDF 1.6) y sin /Version más nueva en el catálogo;
// - XMP con pdfxid:GTS_PDFXVersion, título, fechas, ids y pdf:Trapped, igual que en el Info;
// - /ID en el trailer (Chromium no lo escribe);
// - sin anotaciones (enlaces) en las páginas;
// - grupos de transparencia, imágenes y sombreados con /DeviceRGB explícito pasan a sRGB.
// Las cajas (TrimBox, BleedBox) las pone print-boxes.ts antes.
//
// Perfiles (desktop/assets/icc, copiados a dist/icc por scripts/build.mjs; licencias en
// desktop/assets/icc/LICENCIAS.md): FOGRA39L_coated.icc (zlib/libpng) y sRGB.icc (ArgyllCMS).
// Sin Electron: se prueba con node --test (desktop/test/pdfx.test.ts).
import { randomBytes } from 'node:crypto';
import { pdfLibModule, type PdfDocument } from './print-boxes.ts';

// ── Lo que se usa de pdf-lib por dentro (la copia minificada no trae tipos) ──
interface PdfObject {
  toString(): string;
}
interface PdfName extends PdfObject {
  asString(): string;
}
interface PdfRef extends PdfObject {}
interface PdfDict extends PdfObject {
  get(key: PdfName): PdfObject | undefined;
  set(key: PdfName, value: PdfObject): void;
  delete(key: PdfName): boolean;
  has(key: PdfName): boolean;
  entries(): [PdfName, PdfObject][];
}
interface PdfArray extends PdfObject {
  size(): number;
  get(index: number): PdfObject;
  set(index: number, value: PdfObject): void;
  asArray(): PdfObject[];
}
interface PdfStream extends PdfObject {
  dict: PdfDict;
  getContents(): Uint8Array;
}
interface PdfContext {
  header: unknown;
  trailerInfo: { Root?: PdfObject; Info?: PdfObject; ID?: PdfObject };
  obj(value: unknown): PdfObject;
  register(object: PdfObject): PdfRef;
  flateStream(contents: Uint8Array, dict?: Record<string, unknown>): PdfStream;
  stream(contents: Uint8Array, dict?: Record<string, unknown>): PdfStream;
  lookup(object: PdfObject | undefined): PdfObject | undefined;
  enumerateIndirectObjects(): [PdfRef, PdfObject][];
}
interface FullDocument extends PdfDocument {
  context: PdfContext;
  catalog: PdfDict;
  setTitle(title: string): void;
  setCreator(creator: string): void;
  setCreationDate(date: Date): void;
  setModificationDate(date: Date): void;
  getProducer(): string | undefined;
  getPages(): (ReturnType<PdfDocument['getPages']>[number] & { node: PdfDict })[];
}
type Class<T> = { new (...args: never[]): T };
interface LowLevel {
  PDFName: Class<PdfName> & { of(name: string): PdfName };
  PDFDict: Class<PdfDict>;
  PDFArray: Class<PdfArray>;
  PDFRef: Class<PdfRef>;
  PDFStream: Class<PdfStream>;
  PDFString: { of(text: string): PdfObject };
  PDFHexString: { of(hex: string): PdfObject; fromText(text: string): PdfObject };
}
const lib = pdfLibModule as LowLevel;
const name = (n: string) => lib.PDFName.of(n);

/** Condición de impresión declarada (OutputIntent). */
export interface OutputCondition {
  /** Identificador registrado en el ICC (https://www.color.org). */
  identifier: string;
  /** Texto legible de la condición. */
  condition: string;
  /** Nombre del perfil. */
  info: string;
}

/** FOGRA39: offset comercial, papel estucado (ISO 12647-2:2004/Amd 1). */
export const FOGRA39: OutputCondition = {
  identifier: 'FOGRA39',
  condition:
    'Offset commercial and specialty printing according to ISO 12647-2:2004 / Amd 1, coated paper (PT 1 & 2), screen frequency 60/cm',
  info: 'FOGRA39L Coated',
};

export interface PdfXOptions {
  /** Perfil CMYK de la condición de impresión (DestOutputProfile). */
  outputProfile: Uint8Array;
  /** Perfil sRGB para etiquetar el RGB de Chromium (DefaultRGB). */
  rgbProfile: Uint8Array;
  condition?: OutputCondition;
  title: string;
  /** Programa que creó el documento (xmp:CreatorTool e Info /Creator). */
  creator: string;
  /** Fecha del archivo (las pruebas la fijan). */
  now?: Date;
  /** 16 bytes para /ID y los uuid del XMP (las pruebas los fijan). */
  id?: Uint8Array;
}

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const uuid = (bytes: Uint8Array) => {
  const h = hex(bytes).padEnd(32, '0').slice(0, 32);
  return `uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const xml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Fecha XMP sin milisegundos y en UTC, igual a la del Info (D:AAAAMMDDhhmmssZ). */
const xmpDate = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** XMP de PDF/X-4. Los valores tienen que coincidir con los del diccionario Info. */
export function pdfxMetadata(fields: {
  title: string;
  creator: string;
  producer: string;
  date: Date;
  documentId: string;
  instanceId: string;
}): string {
  const date = xmpDate(fields.date);
  // El relleno final deja lugar para editar el XMP sin reescribir el archivo (recomendación XMP).
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
    xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(fields.title)}</rdf:li></rdf:Alt></dc:title>
   <xmp:CreateDate>${date}</xmp:CreateDate>
   <xmp:ModifyDate>${date}</xmp:ModifyDate>
   <xmp:MetadataDate>${date}</xmp:MetadataDate>
   <xmp:CreatorTool>${xml(fields.creator)}</xmp:CreatorTool>
   <pdf:Producer>${xml(fields.producer)}</pdf:Producer>
   <pdf:Trapped>False</pdf:Trapped>
   <xmpMM:DocumentID>${fields.documentId}</xmpMM:DocumentID>
   <xmpMM:InstanceID>${fields.instanceId}</xmpMM:InstanceID>
   <xmpMM:VersionID>1</xmpMM:VersionID>
   <xmpMM:RenditionClass>default</xmpMM:RenditionClass>
   <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
${' '.repeat(100).concat('\n').repeat(20)}<?xpacket end="w"?>`;
}

const isName = (o: PdfObject | undefined, n: string): boolean =>
  o instanceof lib.PDFName && o.asString() === `/${n}`;

/**
 * Cambia el RGB de dispositivo por sRGB en todo el documento: DefaultRGB en cada diccionario de
 * recursos (cubre rg/RG, cs /DeviceRGB, imágenes en línea) y /DeviceRGB explícito en imágenes,
 * sombreados, espacios Indexed y grupos de transparencia. Devuelve cuántos cambios hizo.
 */
function tagRgb(context: PdfContext, srgb: PdfObject): number {
  let changes = 0;
  const seen = new Set<PdfObject>();
  const resources = (value: PdfObject | undefined) => {
    const dict = context.lookup(value);
    if (!(dict instanceof lib.PDFDict)) return;
    let spaces = context.lookup(dict.get(name('ColorSpace')));
    if (!(spaces instanceof lib.PDFDict)) {
      spaces = context.obj({}) as PdfDict;
      dict.set(name('ColorSpace'), spaces);
    }
    (spaces as PdfDict).set(name('DefaultRGB'), srgb);
    changes++;
  };
  const visit = (object: PdfObject | undefined): void => {
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof lib.PDFStream) return visit(object.dict);
    if (object instanceof lib.PDFArray) {
      const items = object.asArray();
      if (isName(items[0], 'Indexed') && isName(items[1], 'DeviceRGB')) {
        object.set(1, srgb);
        changes++;
      }
      for (const item of items) visit(item);
      return;
    }
    if (!(object instanceof lib.PDFDict)) return;
    for (const [key, value] of object.entries()) {
      const k = key.asString();
      if ((k === '/ColorSpace' || k === '/CS') && isName(value, 'DeviceRGB')) {
        object.set(key, srgb);
        changes++;
      } else if (k === '/ColorSpace' && value instanceof lib.PDFDict) {
        // Espacios con nombre en los recursos: /CS0 /DeviceRGB.
        for (const [space, target] of value.entries())
          if (isName(target, 'DeviceRGB')) {
            value.set(space, srgb);
            changes++;
          }
      }
      if (k === '/Resources') resources(value);
      if (!(value instanceof lib.PDFRef)) visit(value);
    }
  };
  for (const [, object] of context.enumerateIndirectObjects()) visit(object);
  return changes;
}

/**
 * Encabezado de PDF/X-4 en un PDF ya guardado: pdf-lib escribe siempre %PDF-1.7 y PDF/X-4 pide
 * 1.6 o menos. Se cambia el dígito en el lugar: misma longitud, así la tabla xref sigue valiendo.
 */
export function pdfxHeader(bytes: Uint8Array): Uint8Array {
  const head = Buffer.from(bytes.subarray(0, 8)).toString('latin1');
  if (!/^%PDF-1\.\d$/.test(head)) throw new Error('El archivo no empieza como un PDF.');
  if (Number(head[7]) > 6) bytes[7] = '6'.charCodeAt(0);
  return bytes;
}

/** Convierte un documento ya abierto (con sus cajas) en PDF/X-4 con RGB etiquetado. */
export function applyPdfX(document: PdfDocument, options: PdfXOptions): void {
  const doc = document as FullDocument;
  const context = doc.context;
  const condition = options.condition ?? FOGRA39;
  const now = new Date(Math.floor((options.now ?? new Date()).getTime() / 1000) * 1000);
  const id = options.id ?? randomBytes(16);

  // Perfiles: el de salida (CMYK, N 4) y sRGB (N 3) para DefaultRGB.
  const outputProfile = context.register(
    context.flateStream(options.outputProfile, { N: 4, Alternate: 'DeviceCMYK' }),
  );
  const srgbProfile = context.register(
    context.flateStream(options.rgbProfile, { N: 3, Alternate: 'DeviceRGB' }),
  );
  const srgb = context.register(context.obj([name('ICCBased'), srgbProfile]));

  const intent = context.register(
    context.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFX',
      OutputConditionIdentifier: lib.PDFString.of(condition.identifier),
      RegistryName: lib.PDFString.of('http://www.color.org'),
      OutputCondition: lib.PDFString.of(condition.condition),
      Info: lib.PDFString.of(condition.info),
      DestOutputProfile: outputProfile,
    }),
  );
  doc.catalog.set(name('OutputIntents'), context.obj([intent]));
  // PDF/X-4 es PDF 1.6: el catálogo no puede declarar una versión más nueva. El encabezado lo
  // corrige pdfxHeader después de guardar (pdf-lib escribe siempre %PDF-1.7).
  doc.catalog.delete(name('Version'));

  // Sin anotaciones: los enlaces no se imprimen y PDF/X no los admite dentro de la hoja.
  for (const page of doc.getPages()) page.node.delete(name('Annots'));

  tagRgb(context, srgb);

  // Info y XMP con los mismos valores.
  const producer = doc.getProducer() || 'Maquetario';
  doc.setTitle(options.title);
  doc.setCreator(options.creator);
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  const info = context.lookup(context.trailerInfo.Info);
  if (info instanceof lib.PDFDict) {
    info.set(name('Trapped'), name('False'));
    info.set(name('GTS_PDFXVersion'), lib.PDFString.of('PDF/X-4'));
  }
  const metadata = pdfxMetadata({
    title: options.title,
    creator: options.creator,
    producer,
    date: now,
    documentId: uuid(id),
    instanceId: uuid(id),
  });
  doc.catalog.set(
    name('Metadata'),
    context.register(
      context.stream(new TextEncoder().encode(metadata), { Type: 'Metadata', Subtype: 'XML' }),
    ),
  );
  // Identificador del archivo: las dos partes iguales en un archivo nuevo.
  context.trailerInfo.ID = context.obj([
    lib.PDFHexString.of(hex(id)),
    lib.PDFHexString.of(hex(id)),
  ]);
}

/** Lo que tiene un PDF de lo que pide PDF/X-4 (para las pruebas y para revisar una salida). */
export interface PdfXReport {
  header: string;
  outputIntents: {
    subtype: string;
    identifier: string;
    registry: string;
    info: string;
    profileComponents: number;
    profileBytes: number;
  }[];
  metadata: string | null;
  info: Record<string, string>;
  fileId: boolean;
  pages: { defaultRgb: boolean; annotations: boolean; trimBox: boolean; bleedBox: boolean }[];
  /** /DeviceRGB explícito que quedó en espacios de color o grupos. */
  deviceRgb: number;
}

/** Lo que falta para PDF/X-4 según las reglas que este módulo cubre (vacío: todo en orden). */
export function pdfxProblems(report: PdfXReport): string[] {
  const problems: string[] = [];
  const version = /^%PDF-1\.(\d)/.exec(report.header);
  if (!version || Number(version[1]) > 6) problems.push(`encabezado ${report.header.trim()}`);
  const intents = report.outputIntents.filter((i) => i.subtype === '/GTS_PDFX');
  if (intents.length !== 1) problems.push('hace falta un OutputIntent GTS_PDFX');
  else if (intents[0]!.profileComponents !== 4 || !intents[0]!.profileBytes)
    problems.push('el OutputIntent no trae un perfil CMYK incrustado');
  const xmp = report.metadata ?? '';
  const tag = (name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xmp)?.[1];
  if (tag('pdfxid:GTS_PDFXVersion') !== 'PDF/X-4') problems.push('XMP sin GTS_PDFXVersion PDF/X-4');
  if (tag('pdf:Trapped') !== 'False' || report.info.Trapped !== '/False')
    problems.push('Trapped tiene que ser False en el Info y en el XMP');
  if (!/<dc:title>/.test(xmp) || !report.info.Title) problems.push('falta el título');
  if (tag('pdf:Producer') !== report.info.Producer)
    problems.push('Producer distinto en XMP e Info');
  if (tag('xmp:CreatorTool') !== report.info.Creator)
    problems.push('Creator distinto en XMP e Info');
  for (const id of ['xmpMM:DocumentID', 'xmpMM:InstanceID', 'xmp:CreateDate', 'xmp:ModifyDate'])
    if (!tag(id)) problems.push(`XMP sin ${id}`);
  if (!report.fileId) problems.push('el trailer no tiene /ID');
  report.pages.forEach((page, i) => {
    if (!page.trimBox || !page.bleedBox) problems.push(`página ${i + 1} sin TrimBox o BleedBox`);
    if (page.annotations) problems.push(`página ${i + 1} con anotaciones`);
    if (!page.defaultRgb) problems.push(`página ${i + 1} sin DefaultRGB`);
  });
  if (report.deviceRgb) problems.push(`${report.deviceRgb} usos de /DeviceRGB sin etiquetar`);
  return problems;
}

// Los nombres se leen con su barra (/GTS_PDFX); los textos, decodificados.
const text = (o: PdfObject | undefined) =>
  o === undefined
    ? ''
    : o instanceof lib.PDFName
      ? o.asString()
      : 'decodeText' in (o as object)
        ? (o as unknown as { decodeText(): string }).decodeText()
        : o.toString();

/** Lee lo que importa para PDF/X-4. */
export function inspectPdfX(document: PdfDocument, bytes: Uint8Array): PdfXReport {
  const doc = document as FullDocument;
  const context = doc.context;
  const intents = context.lookup(doc.catalog.get(name('OutputIntents')));
  const outputIntents = (intents instanceof lib.PDFArray ? intents.asArray() : []).map((ref) => {
    const intent = context.lookup(ref) as PdfDict;
    const profile = context.lookup(intent.get(name('DestOutputProfile'))) as PdfStream | undefined;
    return {
      subtype: text(intent.get(name('S'))),
      identifier: text(intent.get(name('OutputConditionIdentifier'))),
      registry: text(intent.get(name('RegistryName'))),
      info: text(intent.get(name('Info'))),
      profileComponents: Number(profile?.dict.get(name('N'))?.toString() ?? 0),
      profileBytes: profile ? profile.getContents().length : 0,
    };
  });
  const metadataStream = context.lookup(doc.catalog.get(name('Metadata')));
  const metadata =
    metadataStream instanceof lib.PDFStream
      ? new TextDecoder().decode(metadataStream.getContents())
      : null;
  const infoDict = context.lookup(context.trailerInfo.Info);
  const info: Record<string, string> = {};
  if (infoDict instanceof lib.PDFDict)
    for (const [key, value] of infoDict.entries()) info[key.asString().slice(1)] = text(value);
  let deviceRgb = 0;
  for (const [, object] of context.enumerateIndirectObjects()) {
    const dict = object instanceof lib.PDFStream ? object.dict : object;
    if (!(dict instanceof lib.PDFDict)) continue;
    for (const [key, value] of dict.entries())
      if (['/ColorSpace', '/CS'].includes(key.asString()) && isName(value, 'DeviceRGB'))
        deviceRgb++;
  }
  return {
    header: Buffer.from(bytes.subarray(0, 8)).toString('latin1'),
    outputIntents,
    metadata,
    info,
    fileId: !!context.trailerInfo.ID,
    pages: doc.getPages().map((page) => {
      const resources = context.lookup(page.node.get(name('Resources')));
      const spaces =
        resources instanceof lib.PDFDict
          ? context.lookup(resources.get(name('ColorSpace')))
          : undefined;
      return {
        defaultRgb: spaces instanceof lib.PDFDict && spaces.has(name('DefaultRGB')),
        annotations: page.node.has(name('Annots')),
        trimBox: page.node.has(name('TrimBox')),
        bleedBox: page.node.has(name('BleedBox')),
      };
    }),
    deviceRgb,
  };
}
