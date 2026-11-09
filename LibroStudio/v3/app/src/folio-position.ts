// Posición del folio: lo ubica según el ancho real del número (medido en un canvas), dentro del
// margen elegido (arriba, abajo o lateral). Los deslizadores de ajuste fino del inspector están en
// el panel de Foliado (src/components/inspector/FolioPanel.tsx).
//
// No publica globales: se engancha con extend.
//
// Fuente TypeScript: se compila a build/folio-position.js (desktop/scripts/build.mjs).
import type { AutoType } from './model.ts';

const folioMetric = document.createElement('canvas').getContext('2d')!;
extend.result(
  'autoElement',
  function (
    element: HTMLElement | null,
    index: number,
    type: AutoType,
    px: number,
    printing = false,
  ): HTMLElement | null {
    if (!element || type !== 'folio') return element;
    // Si el folio no se muestra en esta página, autoElement ya devolvió null.
    const cfg = M.auto(book, index, type)!,
      margins = M.margins(book, index);
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const fontSize = (cfg.size * 25.4) / 72,
      height = fontSize * 1.3;
    const outer = index % 2 === 0 ? 'left' : 'right',
      inner = outer === 'left' ? 'right' : 'left';
    const pos = cfg.pos;
    const side = pos === 'outer' ? outer : pos === 'inner' ? inner : pos;
    const lateral = ['left', 'right'].includes(side);
    const font = element.style.fontFamily || 'Georgia';
    folioMetric.font = `${element.style.fontStyle || 'normal'} ${element.style.fontWeight || '400'} ${fontSize * 4}px ${font}`;
    const width = Math.max(fontSize, folioMetric.measureText(element.textContent!).width / 4) + 0.6;
    const rotate = !!cfg.vertical;
    const halfX = (rotate ? height : width) / 2,
      halfY = (rotate ? width : height) / 2;
    let x: number, y: number;
    if (lateral) {
      const left = side === 'left',
        margin = left ? margins.left : margins.right;
      const inset = clamp(cfg.distance, halfX, Math.max(halfX, margin - halfX));
      const min = left ? 0 : book.width - margin,
        max = left ? margin : book.width;
      x =
        margin < halfX * 2
          ? (min + max) / 2
          : clamp((left ? inset : book.width - inset) + cfg.offsetX, min + halfX, max - halfX);
      y = clamp(book.height / 2 + cfg.offsetY, halfY, book.height - halfY);
      // Clip to the physical margin when the chosen type is wider than the margin.
      element.style.clipPath = rotate
        ? `inset(${Math.max(0, (height - margin) / 2) * px}px 0)`
        : `inset(0 ${Math.max(0, (width - margin) / 2) * px}px)`;
      element.dataset.sideMargin = side;
    } else {
      const [edge, anchor] = pos.split('-');
      const horizontal = anchor === 'outer' ? outer : anchor === 'inner' ? inner : 'center';
      const top = edge === 'top',
        margin = top ? book.margins.top : book.margins.bottom;
      const inset = clamp(cfg.distance + halfY, halfY, Math.max(halfY, margin - halfY));
      const min = top ? 0 : book.height - margin,
        max = top ? margin : book.height;
      y =
        margin < halfY * 2
          ? (min + max) / 2
          : clamp((top ? inset : book.height - inset) + cfg.offsetY, min + halfY, max - halfY);
      const defaultX =
        horizontal === 'left'
          ? cfg.distance + halfX
          : horizontal === 'right'
            ? book.width - cfg.distance - halfX
            : book.width / 2;
      x = clamp(defaultX + cfg.offsetX, halfX, book.width - halfX);
    }
    Object.assign(element.style, {
      left: x * px + 'px',
      top: y * px + 'px',
      width: width * px + 'px',
      height: height * px + 'px',
      lineHeight: height * px + 'px',
      whiteSpace: 'nowrap',
      textAlign: 'center',
      transform: `translate(-50%,-50%)${rotate ? ' rotate(-90deg)' : ''}`,
      transformOrigin: 'center',
    });
    return element;
  },
  'folio-position',
);

// Los deslizadores de ajuste fino del inspector los dibuja el panel de Foliado en React
// (src/components/inspector/FolioPanel.tsx).

export {};
