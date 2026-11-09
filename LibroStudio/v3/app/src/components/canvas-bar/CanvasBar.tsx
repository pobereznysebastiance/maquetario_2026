// Organismo: barra debajo del lienzo. A la izquierda, "Plantillas" (plegable) y "Ver todas…"; a
// la derecha, el zoom: −, deslizador, +, porcentaje, Continuo, Ajustar, "?" (atajos) y Ampliar
// área. Debajo, la franja de plantillas de grilla (#templates) con la activa marcada.
//
// Es sólo presentación: el estado vive donde vivía y se lee al dibujar.
// - zoom: canvas-navigation.ts (zoomCanvasTo, fitCanvas, actualCanvasPercent; atajos Ctrl + / − /
//   0 / 1 y Ctrl + rueda, que siguen ahí).
// - Continuo: continuous-canvas.ts (continuousCanvas, toggleContinuousCanvas).
// - Ampliar área: focus-layout.ts (clase focused del body, toggleFocusLayout; Escape).
// - Plantillas abiertas o plegadas: page-priority.ts (showGridStrip, toggleGridStrip, recordado).
// - Retículas: readability.ts (gridPresets, applyGridPreset); la biblioteca, GridGallery.tsx.
// Se redibuja con useEditorState() (cambios del libro: la grilla activa) y con refreshCanvasBar()
// (canvas-bar-state.ts: zoom, continuo, ampliado, plantillas). Mismos ids que antes: #zoomOut
// #zoom #zoomIn #canvasZoomValue #continuousCanvas #fitZoom #canvasShortcuts #fullscreen
// #toggleGridStrip #gridLibrary #templates [data-grid-preset].
//
// La franja (.template-panel), su altura (panel-resize.ts) y el agarrador no son de React: se
// monta en .template-heading y en #templates.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts; después de readability y
// de la biblioteca de grillas).

import { useLayoutEffect, useRef } from 'react';
import { Icon } from '../Icon.tsx';
import { mount, useLanguage } from '../../react/mount.tsx';
import { useEditorState } from '../../react/editor-state.ts';
import { GridMini } from '../grid-gallery/GridGallery.tsx';
import { gridSize } from '../../readability.ts';
import { useCanvasBar } from './canvas-bar-state.ts';

/** Porcentaje real del lienzo (antes de que cargue canvas-navigation, 100). */
const canvasPercent = (): number =>
  typeof actualCanvasPercent === 'function' ? actualCanvasPercent() : 100;

/** Zoom: − deslizador + porcentaje · Continuo · Ajustar · ? · Ampliar área. */
const ZoomControls = () => {
  const percent = canvasPercent(),
    focused = document.body.classList.contains('focused'),
    continuous = !!globalThis.continuousCanvas;
  // El deslizador no es controlado: mientras se arrastra, el lienzo manda (zoomCanvasTo) y el
  // valor se pone acá cuando el porcentaje cambia.
  const slider = useRef<HTMLInputElement | null>(null);
  const sliderValue = Math.max(10, Math.min(800, percent));
  useLayoutEffect(() => {
    if (slider.current) slider.current.value = String(sliderValue);
  }, [sliderValue]);
  const focusText = focused
    ? bw('Restaurar paneles', 'Restore panels', 'Restaurar painéis')
    : bw('Ampliar área', 'Expand workspace', 'Ampliar área');
  const focusTitle = focused
    ? bw('Restaurar paneles · Escape', 'Restore panels · Escape', 'Restaurar painéis · Escape')
    : focusText;
  const shortcuts = bw('Atajos de navegación', 'Navigation shortcuts', 'Atalhos de navegação');
  return (
    <div className="zoom">
      <button
        type="button"
        id="zoomOut"
        className="icon-btn"
        aria-label={LibroI18n.tr('Alejar')}
        onClick={() => zoomCanvasTo(canvasPercent() / 1.2)}
      >
        −
      </button>
      <input
        ref={slider}
        type="range"
        min="10"
        max="800"
        step="1"
        defaultValue={sliderValue}
        id="zoom"
        aria-label={bw('Zoom del lienzo · %', 'Canvas zoom · %', 'Zoom da tela · %')}
        onInput={(event) => zoomCanvasTo(Number(event.currentTarget.value))}
      />
      <button
        type="button"
        id="zoomIn"
        className="icon-btn"
        aria-label={LibroI18n.tr('Acercar')}
        onClick={() => zoomCanvasTo(canvasPercent() * 1.2)}
      >
        +
      </button>
      <span id="canvasZoomValue" aria-live="polite">
        {Math.round(percent)}%
      </span>
      <button
        type="button"
        id="continuousCanvas"
        className="quiet"
        title={bw(
          'Recorrer todas las páginas con la rueda',
          'Scroll through all pages',
          'Rolar por todas as páginas',
        )}
        aria-pressed={continuous}
        onClick={() => toggleContinuousCanvas()}
      >
        {bw('Continuo', 'Continuous', 'Contínuo')}
      </button>
      <button
        type="button"
        id="fitZoom"
        className="quiet"
        title={bw('Ajustar pliego · Ctrl+0', 'Fit spread · Ctrl+0', 'Ajustar páginas · Ctrl+0')}
        onClick={() => fitCanvas()}
      >
        {bw('Ajustar', 'Fit', 'Ajustar')}
      </button>
      <button
        type="button"
        id="canvasShortcuts"
        className="icon-btn"
        title={shortcuts}
        aria-label={shortcuts}
        onClick={() => void openHelp('shortcuts')}
      >
        <Icon name="help" />
      </button>
      <button
        type="button"
        id="fullscreen"
        className="quiet"
        title={focusTitle}
        aria-label={focusTitle}
        aria-pressed={focused}
        onClick={() => toggleFocusLayout()}
      >
        <Icon name="expand" />
        <span>{focusText}</span>
      </button>
    </div>
  );
};

/** Encabezado de la franja: Plantillas (plegable) · Ver todas… y el zoom. */
export const CanvasBar = () => {
  useEditorState();
  useLanguage();
  useCanvasBar();
  const open = !!globalThis.showGridStrip;
  return (
    <>
      <span>
        <button
          type="button"
          id="toggleGridStrip"
          className="quiet"
          aria-expanded={open}
          onClick={() => toggleGridStrip()}
        >
          {(open ? '▾ ' : '▸ ') + bw('Plantillas', 'Templates', 'Grades')}
        </button>
        <button
          type="button"
          id="gridLibrary"
          className="quiet"
          // La biblioteca es una Hoja en React (src/components/grid-gallery/GridGallery.tsx).
          onClick={() => gridGallery()}
        >
          {bw('Ver todas…', 'View all…', 'Ver todas…')}
        </button>
      </span>
      <ZoomControls />
    </>
  );
};

/** Franja de plantillas: una tarjeta por retícula, con su miniatura, nombre y medidas. */
export const TemplateStrip = () => {
  useEditorState();
  useLanguage();
  useCanvasBar();
  return (
    <>
      {gridPresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={
            book.grid.cols === preset.c && book.grid.rows === preset.r
              ? 'template active'
              : 'template'
          }
          data-grid-preset={preset.id}
          title={bw(...preset.use)}
          onClick={() => applyGridPreset(preset.id)}
        >
          <div className="template-art">
            <GridMini preset={preset} />
          </div>
          {bw(...preset.name)}
          <span className="template-dimensions">{gridSize(preset.c, preset.r)}</span>
        </button>
      ))}
    </>
  );
};

mount($('.template-heading'), <CanvasBar />, { sync: true });
mount($('#templates'), <TemplateStrip />, { sync: true });
