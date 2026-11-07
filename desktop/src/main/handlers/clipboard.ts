// Pegar SVG desde el portapapeles (Illustrator, Figma, Inkscape…).
// Port de ReadClipboardSvg en Host.cs, con la API asíncrona de portapapeles de Electron.
import { clipboard } from 'electron';

const MAX = 16_000_000;

function decode(bytes: Buffer): string {
  const utf8 = bytes.toString('utf8');
  return utf8.includes('<') && utf8.includes('\0') ? bytes.toString('utf16le') : utf8;
}

const isSvg = (text: string | null | undefined): text is string => !!text && text.length <= MAX && /<svg/i.test(text);

export async function readClipboardSvg(): Promise<string | null> {
  try {
    for (const item of await clipboard.read()) {
      for (const type of item.types) {
        if (!/svg/i.test(type)) continue;
        const data = await item.getType(type);
        if (!(data instanceof Blob) || data.size === 0 || data.size > MAX) continue;
        const text = decode(Buffer.from(await data.arrayBuffer()));
        if (isSvg(text)) return text;
      }
    }
  } catch {
    // Formato no legible en esta plataforma: se prueba con el texto.
  }
  const text = await clipboard.readText();
  return isSvg(text) ? text : null;
}
