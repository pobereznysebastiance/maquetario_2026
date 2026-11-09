// Hoja "Biblioteca de grillas": las diez retículas de gridPresets (readability.ts) con su
// miniatura real. Elegir una la aplica (applyGridPreset), cierra la Hoja y lleva a Diseño.
// gridGallery es global: la abren "Ver todas…" del panel de plantillas, las pruebas
// (tests/readability-tests.js busca [data-grid-card]) y scripts/style-snapshot.js.
//
// La miniatura lleva columnas y filas en data-cols/data-rows; el CSS
// (ui/organisms/template-panel.css) arma la grilla con attr(), sin estilos en línea.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts; después de readability.ts).

import { useLanguage } from '../../react/mount.tsx';
import { gridSize, type GridPreset } from '../../readability.ts';

declare global {
  /** Abre la biblioteca de retículas. */
  var gridGallery: () => void;
}

/** Dos páginas con la grilla de la retícula (también en la franja de plantillas). */
export const GridMini = ({ preset }: { preset: GridPreset }) => (
  <>
    {[0, 1].map((page) => (
      <span key={page} className="grid-mini-page" data-cols={preset.c} data-rows={preset.r}>
        {Array.from({ length: preset.c * preset.r }, (_, i) => (
          <i key={i}></i>
        ))}
      </span>
    ))}
  </>
);

const GridGallery = () => {
  useLanguage();
  return (
    <>
      <p className="builder-intro">
        {bw(
          'Elegí una base y personalizá sus medianiles desde Diseño. Cada miniatura muestra columnas y filas reales.',
          'Choose a starting point and customize gutters in Design. Each thumbnail shows actual rows and columns.',
          'Escolha uma base e personalize os espaços em Design. Cada miniatura mostra linhas e colunas reais.',
        )}
      </p>
      <div className="grid-gallery-list">
        {gridPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={
              book.grid.cols === preset.c && book.grid.rows === preset.r
                ? 'grid-card active'
                : 'grid-card'
            }
            data-grid-card={preset.id}
            onClick={() => {
              applyGridPreset(preset.id);
              closeSheet();
              showTab('design');
            }}
          >
            <div className="template-art">
              <GridMini preset={preset} />
            </div>
            <strong>{bw(...preset.name)}</strong>
            <small>
              {gridSize(preset.c, preset.r)}
              <br />
              {bw(...preset.use)}
            </small>
          </button>
        ))}
      </div>
      <p className="help">
        {bw(
          'Bases 2×4, 5×4, 3×6, 6×6 y 4×8: referencia The Vignelli Canon (Vignelli Center, RIT). Las demás son variantes de Maquetario. Son guías de composición; no crean cajas ni modifican el contenido.',
          '2×4, 5×4, 3×6, 6×6 and 4×8 bases reference The Vignelli Canon (Vignelli Center, RIT). Others are Maquetario variants. These are composition guides; they do not create frames or alter content.',
          'Bases 2×4, 5×4, 3×6, 6×6 e 4×8: referência The Vignelli Canon (Vignelli Center, RIT). As demais são variantes do Maquetario. São guias de composição; não criam caixas nem alteram conteúdo.',
        )}
      </p>
    </>
  );
};

globalThis.gridGallery = function () {
  if (busy) return;
  finishEditing();
  void openSheet(<GridGallery />, {
    title: bw('Biblioteca de grillas', 'Grid library', 'Biblioteca de grades'),
    single: true,
    action: { label: bw('Cerrar', 'Close', 'Fechar'), run: () => true },
    size: 'lg',
    variant: 'grid-gallery',
  });
};
