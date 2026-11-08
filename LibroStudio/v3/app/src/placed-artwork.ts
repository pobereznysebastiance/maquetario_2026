// Imágenes colocadas: arrastrar archivos (PNG, JPG, WebP o SVG) sobre una página o pegarlos desde el
// portapapeles (también SVG copiado desde Illustrator) los coloca como objetos de imagen.
// No publica nada: todo lo que define se usa sólo acá.
//
// Fuente TypeScript: se compila a build/placed-artwork.js (desktop/scripts/build.mjs).
import type { Page } from './model.ts';

interface PlacedImage {
  src: string;
  name: string;
  ratio: number;
}

const artworkTypes: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const artworkType = (file: File): string | undefined =>
  Object.values(artworkTypes).includes(file.type)
    ? file.type
    : artworkTypes[file.name.split('.').pop()!.toLowerCase()];

async function loadPlacedArtwork(file: File): Promise<PlacedImage> {
  const type = artworkType(file);
  if (!type || file.size > 16000000)
    throw Error(
      bw(
        'Usá PNG, JPG, WebP o SVG de hasta 16 MB.',
        'Use PNG, JPG, WebP or SVG up to 16 MB.',
        'Use PNG, JPG, WebP ou SVG de até 16 MB.',
      ),
    );
  // SVG is embedded as an image, never inserted as active markup.
  const data = new Blob([file], { type });
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(data);
  });
  const image = new Image();
  image.src = src;
  await image.decode();
  return { src, name: file.name, ratio: image.naturalWidth / image.naturalHeight };
}

async function placeArtwork(
  files: File[],
  page: Page,
  position?: { x: number; y: number },
): Promise<void> {
  const publication = book;
  // Project files above the native open limit cannot be reopened.
  let remaining = 78000000 - JSON.stringify(book, null, 2).length;
  const images: PlacedImage[] = [];
  for (const file of Array.from(files).slice(0, Math.min(30, 300 - page.objects.length))) {
    if ((file.size * 4) / 3 + 1000 > remaining) continue;
    try {
      const image = await loadPlacedArtwork(file);
      images.push(image);
      remaining -= image.src.length + 1000;
    } catch {
      /* Continue with the remaining files in a mixed selection. */
    }
  }
  if (publication !== book || canvasUnavailable() || !book.pages.includes(page)) return;
  images.splice(Math.max(0, 300 - page.objects.length));
  if (!images.length) {
    toast(
      bw(
        'No se pudo colocar la imagen. Usá PNG, JPG, WebP o SVG de hasta 16 MB y verificá que haya espacio para más objetos.',
        'Could not place the image. Use PNG, JPG, WebP or SVG up to 16 MB and check the page object limit.',
        'Não foi possível inserir a imagem. Use PNG, JPG, WebP ou SVG de até 16 MB e confira o limite de objetos.',
      ),
      'error',
    );
    return;
  }
  finishEditing();
  commit(() => {
    active = book.pages.indexOf(page);
    spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
    for (const [index, image] of images.entries()) {
      const w = Math.max(1, Math.min(108, book.width, book.height * image.ratio));
      const h = Math.max(1, Math.min(book.height, w / image.ratio));
      const x = Math.max(
        0,
        Math.min(book.width - w, (position?.x ?? (book.width - w) / 2) + index * 4),
      );
      const y = Math.max(
        0,
        Math.min(book.height - h, (position?.y ?? (book.height - h) / 2) + index * 4),
      );
      const object = { id: M.uid(), type: 'image', x, y, w, h, src: image.src, name: image.name };
      page.objects.push(object);
      selected = object.id;
    }
    tool = 'select';
  });
  if (images.length < files.length)
    toast(
      bw(
        'Algunas imágenes no se pudieron colocar.',
        'Some images could not be placed.',
        'Algumas imagens não puderam ser inseridas.',
      ),
      'warning',
    );
}

function clearDropTarget(): void {
  $('#spread .artwork-drop-target')?.classList.remove('artwork-drop-target');
}
document.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  const page =
    !canvasUnavailable() && !preview && (event.target as Element).closest('#spread .page');
  clearDropTarget();
  event.dataTransfer.dropEffect = page ? 'copy' : 'none';
  if (page) page.classList.add('artwork-drop-target');
});
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget || !(event.relatedTarget as Element).closest?.('#spread .page'))
    clearDropTarget();
});
document.addEventListener('drop', (event) => {
  clearDropTarget();
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) return;
  event.preventDefault();
  const element = (event.target as Element).closest<HTMLElement>('#spread .page');
  if (!element || canvasUnavailable() || preview) return;
  const rect = element.getBoundingClientRect();
  void placeArtwork(files, book.pages[Number(element.dataset.page)], {
    x: ((event.clientX - rect.left) * book.width) / rect.width,
    y: ((event.clientY - rect.top) * book.height) / rect.height,
  });
});

function clipboardSvg(text: string | null | undefined): File | null {
  if (!text || text.length > 16000000) return null;
  if (text?.includes('&lt;svg')) {
    text = new DOMParser().parseFromString(text, 'text/html').body.textContent;
  }
  const match = text?.match(/<svg[\s>][\s\S]*?<\/svg\s*>/i);
  if (!match) return null;
  const document = new DOMParser().parseFromString(match[0], 'image/svg+xml');
  const svg = document.documentElement;
  if (svg.localName !== 'svg' || document.querySelector('parsererror')) return null;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new File([new XMLSerializer().serializeToString(svg)], 'Illustrator.svg', {
    type: 'image/svg+xml',
  });
}
document.addEventListener('paste', async (event) => {
  if (canvasUnavailable() || preview || canvasInputTarget(event.target) || editing) return;
  const data = event.clipboardData;
  const page = book.pages[active],
    publication = book;
  const svg =
    clipboardSvg(data?.getData('image/svg+xml') || data?.getData('text/plain')) ||
    clipboardSvg(data?.getData('text/html'));
  const files = Array.from(data?.files || []).filter(artworkType);
  event.preventDefault();
  if (svg || files.length) {
    await placeArtwork(svg ? [svg] : files, page);
    return;
  }
  if (native && event.isTrusted) {
    try {
      const artwork = clipboardSvg(await nativeCall('clipboardSvg'));
      if (artwork && publication === book) {
        await placeArtwork([artwork], page);
        return;
      }
    } catch {
      /* Clipboard can be temporarily locked by another application. */
    }
  }
  toast(
    bw(
      'Para pegar desde Illustrator, activá «Incluir código SVG» en las preferencias del portapapeles y volvé a copiar.',
      'To paste from Illustrator, enable “Include SVG Code” in Clipboard Handling and copy again.',
      'Para colar do Illustrator, ative “Incluir código SVG” nas preferências da área de transferência e copie novamente.',
    ),
    'info',
  );
});
