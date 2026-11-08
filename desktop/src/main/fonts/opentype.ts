// Lectura mínima de archivos OpenType/TrueType (TTF, OTF, TTC).
// Port de OpenTypeReader (HostFonts.cs, HostGlyphs.cs, HostPackage.cs).
// Lee sólo las tablas necesarias (name, OS/2, head, fvar) sin cargar el archivo entero.
import { createHash } from 'node:crypto';
import { open, readFile, stat, type FileHandle } from 'node:fs/promises';

export interface FontAxis {
  tag: string;
  name: string;
  min: number;
  max: number;
  normal: number;
}
export interface FontInstance {
  name: string;
  coordinates: Record<string, number>;
}
/** Lo que ve la interfaz (sin la ruta del archivo). */
export interface FontFace {
  id: string;
  family: string;
  style: string;
  weight: number;
  italic: boolean;
  axes: FontAxis[];
  instances: FontInstance[];
}
export interface FontRecord extends FontFace {
  path: string;
  offset: number;
}

export const MAX_FONT_FILE = 80_000_000;
const DOTNET_EPOCH_TICKS = 621_355_968_000_000_000n;

export const publicFace = ({ path: _path, offset: _offset, ...face }: FontRecord): FontFace => face;

const tag = (b: Buffer, p: number) => b.toString('latin1', p, p + 4);
const fixed = (b: Buffer, p: number) => b.readInt32BE(p) / 65536;

type TableMap = Map<string, { start: number; length: number; entry: number }>;

function parseDirectory(dir: Buffer, size: number, dirStart: number): TableMap {
  const count = dir.readUInt16BE(4);
  if (count < 1 || count > 400) throw new Error('Tabla de fuentes inválida');
  const tables: TableMap = new Map();
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16;
    const start = dir.readInt32BE(p + 8);
    const length = dir.readInt32BE(p + 12);
    if (start < 0 || length < 0 || start + length > size) throw new Error('Fuente incompleta');
    tables.set(tag(dir, p), { start, length, entry: dirStart + p });
  }
  return tables;
}

/** Nombre de la tabla `name`, con la misma prioridad que la versión C#: Windows > Unicode, inglés EE. UU. */
function nameRecord(b: Buffer, id: number): string {
  const count = b.readUInt16BE(2);
  const strings = b.readUInt16BE(4);
  let best = -1;
  let chosen = '';
  for (let i = 0; i < count; i++) {
    const p = 6 + i * 12;
    if (p + 12 > b.length || b.readUInt16BE(p + 6) !== id) continue;
    const platform = b.readUInt16BE(p);
    const language = b.readUInt16BE(p + 4);
    const len = b.readUInt16BE(p + 8);
    const start = strings + b.readUInt16BE(p + 10);
    const score = (platform === 3 ? 100 : platform === 0 ? 80 : 0) + (language === 0x409 ? 10 : 0);
    if (start + len > b.length || score <= best) continue;
    const raw = b.subarray(start, start + len);
    let text: string;
    if (platform === 0 || platform === 3) {
      const swapped = Buffer.from(raw);
      swapped.swap16();
      text = swapped.toString('utf16le');
    } else {
      text = raw.toString('latin1');
    }
    chosen = text.replace(/^[\0 ]+|[\0 ]+$/g, '');
    best = score;
  }
  return chosen;
}

async function readAt(fh: FileHandle, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await fh.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new Error('Fuente incompleta');
  return buffer;
}

/** Mismo identificador que la versión C#: SHA-256 de ruta#offset#mtime en ticks .NET. */
export function faceId(path: string, offset: number, mtimeNs: bigint): string {
  const ticks = mtimeNs / 100n + DOTNET_EPOCH_TICKS;
  return createHash('sha256')
    .update(`${path.toLowerCase()}#${offset}#${ticks}`, 'utf8')
    .digest('hex')
    .toUpperCase()
    .slice(0, 24);
}

export async function readFaces(path: string): Promise<FontRecord[]> {
  const info = await stat(path, { bigint: true });
  const size = Number(info.size);
  if (size < 12 || size > MAX_FONT_FILE) return [];
  const fh = await open(path, 'r');
  try {
    const header = await readAt(fh, 0, 12);
    let offsets = [0];
    if (tag(header, 0) === 'ttcf') {
      const n = Math.min(header.readInt32BE(8), 100);
      if (n < 1) return [];
      const list = await readAt(fh, 12, n * 4);
      offsets = Array.from({ length: n }, (_, i) => list.readInt32BE(i * 4));
    }
    const result: FontRecord[] = [];
    for (const offset of offsets) {
      try {
        const head12 = await readAt(fh, offset, 12);
        const count = head12.readUInt16BE(4);
        if (count < 1 || count > 400) continue;
        const dir = Buffer.concat([head12, await readAt(fh, offset + 12, count * 16)]);
        const tables = parseDirectory(dir, size, offset);
        const nameTable = tables.get('name');
        if (!nameTable) continue;
        const names = await readAt(fh, nameTable.start, nameTable.length);
        const family = nameRecord(names, 16) || nameRecord(names, 1);
        const style = nameRecord(names, 17) || nameRecord(names, 2);
        if (!family.trim()) continue;
        const record: FontRecord = {
          path,
          offset,
          id: faceId(path, offset, info.mtimeNs),
          family,
          style: style || 'Regular',
          weight: 400,
          italic: false,
          axes: [],
          instances: [],
        };
        const os2 = tables.get('OS/2');
        const head = tables.get('head');
        if (os2 && os2.length >= 6) {
          const b = await readAt(fh, os2.start, Math.min(os2.length, 64));
          record.weight = Math.max(1, Math.min(1000, b.readUInt16BE(4)));
          if (os2.length >= 64) record.italic = (b.readUInt16BE(62) & 1) !== 0;
        } else if (head && head.length >= 46) {
          const b = await readAt(fh, head.start, 46);
          record.italic = (b.readUInt16BE(44) & 2) !== 0;
        }
        const fvar = tables.get('fvar');
        if (fvar) {
          const f = await readAt(fh, fvar.start, fvar.length);
          const axisStart = f.readUInt16BE(4);
          const axes = f.readUInt16BE(8);
          const axisSize = f.readUInt16BE(10);
          const instances = f.readUInt16BE(12);
          const instanceSize = f.readUInt16BE(14);
          if (axes > 32 || axisSize < 20 || instances > 500) throw new Error('Ejes inválidos');
          for (let i = 0; i < axes; i++) {
            const p = axisStart + i * axisSize;
            record.axes.push({
              tag: tag(f, p),
              name: nameRecord(names, f.readUInt16BE(p + 18)),
              min: fixed(f, p + 4),
              normal: fixed(f, p + 8),
              max: fixed(f, p + 12),
            });
          }
          const start = axisStart + axes * axisSize;
          for (let i = 0; i < instances; i++) {
            const p = start + i * instanceSize;
            const coordinates: Record<string, number> = {};
            record.axes.forEach((axis, a) => (coordinates[axis.tag] = fixed(f, p + 4 + a * 4)));
            record.instances.push({ name: nameRecord(names, f.readUInt16BE(p)), coordinates });
          }
        }
        result.push(record);
      } catch {
        // Cara dañada: se omite, igual que en la versión C#.
      }
    }
    return result;
  } finally {
    await fh.close();
  }
}

function tablesInMemory(b: Buffer, offset: number): TableMap {
  return parseDirectory(b.subarray(offset), b.length, offset);
}

/**
 * Devuelve el archivo de una sola cara. Las colecciones TTC tienen offsets
 * relativos a la colección, así que se reconstruye una fuente independiente
 * para que Chromium la pueda cargar.
 */
export async function faceBytes(record: Pick<FontRecord, 'path' | 'offset'>): Promise<Buffer> {
  const b = await readFile(record.path);
  if (tag(b, 0) !== 'ttcf') return b;
  const tables = [...tablesInMemory(b, record.offset)].sort(([x], [y]) =>
    x < y ? -1 : x > y ? 1 : 0,
  );
  const count = tables.length;
  let total = 12 + count * 16;
  for (const [, t] of tables) total += (t.length + 3) & ~3;
  const out = Buffer.alloc(total);
  b.copy(out, 0, record.offset, record.offset + 4);
  out.writeUInt16BE(count, 4);
  let power = 1;
  let selector = 0;
  while (power * 2 <= count) {
    power *= 2;
    selector++;
  }
  out.writeUInt16BE(power * 16, 6);
  out.writeUInt16BE(selector, 8);
  out.writeUInt16BE(count * 16 - power * 16, 10);
  let cursor = 12 + count * 16;
  let headAt = -1;
  tables.forEach(([name, t], i) => {
    const p = 12 + i * 16;
    out.write(name, p, 4, 'latin1');
    b.copy(out, cursor, t.start, t.start + t.length);
    if (name === 'head') {
      headAt = cursor;
      out.writeUInt32BE(0, headAt + 8);
    }
    let sum = 0;
    const padded = (t.length + 3) & ~3;
    for (let k = 0; k < padded; k += 4) sum = (sum + out.readUInt32BE(cursor + k)) >>> 0;
    out.writeUInt32BE(sum, p + 4);
    out.writeUInt32BE(cursor, p + 8);
    out.writeUInt32BE(t.length, p + 12);
    cursor += padded;
  });
  let checksum = 0;
  for (let i = 0; i < out.length; i += 4) checksum = (checksum + out.readUInt32BE(i)) >>> 0;
  if (headAt >= 0) out.writeUInt32BE((0xb1b0afba - checksum) >>> 0, headAt + 8);
  return out;
}

const printable = (cp: number) =>
  cp >= 32 && cp <= 0x10ffff && !(cp >= 0x7f && cp <= 0x9f) && !(cp >= 0xd800 && cp <= 0xdfff);

/** Puntos de código Unicode que la fuente cubre (cmap formatos 4 y 12). */
export function unicodePoints(b: Buffer): number[] {
  const tables = tablesInMemory(b, 0);
  const cmap = tables.get('cmap');
  if (!cmap) return [];
  const root = cmap.start;
  const tableEnd = root + cmap.length;
  if (root + 4 > tableEnd) return [];
  const count = b.readUInt16BE(root + 2);
  const points = new Set<number>();
  for (let n = 0; n < count; n++) {
    const entry = root + 4 + n * 8;
    if (entry + 8 > tableEnd) break;
    const platform = b.readUInt16BE(entry);
    const encoding = b.readUInt16BE(entry + 2);
    if (
      platform !== 0 &&
      !(platform === 3 && (encoding === 0 || encoding === 1 || encoding === 10))
    )
      continue;
    const rel = b.readInt32BE(entry + 4);
    if (rel < 0 || rel > tableEnd - root - 2) continue;
    const start = root + rel;
    try {
      const format = b.readUInt16BE(start);
      if (format === 12) {
        if (start + 16 > tableEnd) continue;
        const length = b.readInt32BE(start + 4);
        const groups = b.readInt32BE(start + 12);
        if (length < 16 || start + length > tableEnd || groups < 0 || groups > 100_000) continue;
        for (let j = 0; j < groups; j++) {
          const p = start + 16 + j * 12;
          if (p + 12 > start + length) break;
          const first = b.readInt32BE(p);
          const last = b.readInt32BE(p + 4);
          const glyph = b.readInt32BE(p + 8);
          if (first < 0 || last < first || last > 0x10ffff) continue;
          for (let cp = first; cp <= last && points.size < 150_000; cp++) {
            if (glyph + cp - first > 0 && printable(cp)) points.add(cp);
          }
        }
      } else if (format === 4) {
        if (start + 14 > tableEnd) continue;
        const length = b.readUInt16BE(start + 2);
        const segments = b.readUInt16BE(start + 6) / 2;
        const end = start + 14;
        const beg = end + segments * 2 + 2;
        const delta = beg + segments * 2;
        const ranges = delta + segments * 2;
        if (
          segments < 1 ||
          segments > 32768 ||
          start + length > tableEnd ||
          ranges + segments * 2 > start + length
        )
          continue;
        for (let j = 0; j < segments; j++) {
          const lo = b.readUInt16BE(beg + j * 2);
          const hi = b.readUInt16BE(end + j * 2);
          const d = b.readUInt16BE(delta + j * 2);
          const offset = b.readUInt16BE(ranges + j * 2);
          for (let cp = lo; cp <= hi; cp++) {
            if (!printable(cp) || cp === 65535) continue;
            let glyph: number;
            if (offset === 0) glyph = (cp + d) & 65535;
            else {
              const at = ranges + j * 2 + offset + 2 * (cp - lo);
              if (at < start || at + 2 > start + length) continue;
              glyph = b.readUInt16BE(at);
              if (glyph !== 0) glyph = (glyph + d) & 65535;
            }
            if (glyph !== 0) points.add(cp);
          }
        }
      }
    } catch {
      // Subtabla dañada: se ignora.
    }
  }
  return [...points].sort((x, y) => x - y);
}

/** Licencia de incrustación (OS/2 fsType): no copiar fuentes restringidas al paquete. */
export function canPackage(b: Buffer): boolean {
  const os2 = tablesInMemory(b, 0).get('OS/2');
  if (!os2 || os2.length < 10) return false;
  return (b.readUInt16BE(os2.start + 8) & 0x0206) === 0;
}

export const isOpenTypeCff = (b: Buffer) => tag(b, 0) === 'OTTO';
