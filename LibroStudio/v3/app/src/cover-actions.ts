// Acciones de la cubierta. Los botones fijos para exportar o imprimir la cubierta y la nota de
// los dos archivos están en el editor (src/components/cover/CoverEditor.tsx). Al imprimir la cubierta en un papel estándar (A3, A4, A5, Carta), la centra en la hoja y, si
// se permite, la reduce para una prueba.
//
// No publica globales: todo se engancha con extend.
//
// Fuente TypeScript: se compila a build/cover-actions.js (desktop/scripts/build.mjs).

import { bw } from './i18n/language.ts';
import { outputPaperDimensions } from './output-words.ts';

/** Lo que devuelve prepareOutput (output.js). */
interface OutputInfo {
  width: number;
  height: number;
  faces: number;
  scale: number;
}

/** Lo que recibe prepareOutput: para la cubierta, kind = 'cover'. */
interface OutputRequest {
  kind?: string;
  paper: string;
  fit: boolean;
}

extend.result(
  'prepareOutput',
  function (info: OutputInfo, config: OutputRequest): OutputInfo {
    if (config.kind !== 'cover' || !['A3', 'A4', 'A5', 'Letter'].includes(config.paper))
      return info;
    const [width, height] = outputPaperDimensions(config.paper, info.width, info.height);
    const ratio = Math.min(width / info.width, height / info.height, 1);
    if (!config.fit && ratio < 0.999) {
      clearPrint();
      throw Error(
        bw(
          'La cubierta no cabe a tamaño real. Elegí un papel mayor o permití reducir para una prueba.',
          'The cover does not fit at actual size. Choose larger paper or allow reduction for a proof.',
          'A capa não cabe em tamanho real. Escolha papel maior ou permita redução para uma prova.',
        ),
      );
    }
    const root = $('#printRoot'),
      art = root.querySelector<HTMLElement>('.cover-artwork')!,
      sheet = document.createElement('div');
    sheet.className = 'print-page';
    Object.assign(sheet.style, {
      width: (width * 96) / 25.4 + 'px',
      height: (height * 96) / 25.4 + 'px',
      position: 'relative',
      overflow: 'hidden',
    });
    art.classList.remove('print-page');
    const scale = config.fit ? ratio : 1;
    Object.assign(art.style, {
      position: 'absolute',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      left: (((width - info.width * scale) / 2) * 96) / 25.4 + 'px',
      top: (((height - info.height * scale) / 2) * 96) / 25.4 + 'px',
    });
    sheet.append(art);
    root.querySelector('style')!.textContent = `@page{size:${width}mm ${height}mm;margin:0}`;
    root.append(sheet);
    return { width, height, faces: 1, scale };
  },
  'cover-actions',
);

export {};
