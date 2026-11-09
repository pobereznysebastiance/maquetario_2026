// Inspector · Libro · Fuentes de tu equipo (etapa 3, D2, paso 4): cuántas familias y estilos leyó
// la app, y administrar las carpetas de fuentes.
//
// La sección la agrega fonts.ts al final de Libro como un lugar vacío (class "font-library",
// data-inspector-slot="fonts") y la monta con mountInspectorSlot. Mismo marcado que tenía en HTML
// (UI.skeleton, UI.button), con los textos de fw() (fonts.ts). Mientras se lee el catálogo, los
// botones quedan deshabilitados; obtainFonts vuelve a dibujar el inspector al empezar y al terminar.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';

/** Líneas grises de "cargando" (UI.skeleton). */
const Skeleton = ({ lines, label }: { lines: number; label: string }) => (
  <div className="skeleton" role="status" aria-busy="true" aria-label={label}>
    {Array.from({ length: lines }, (_, i) => (
      <span key={i} className="skeleton-line"></span>
    ))}
  </div>
);

export const FontLibraryPanel = () => {
  useEditorState();
  useLanguage();
  const w = fw(),
    loading = fontCatalogLoading();
  return (
    <>
      <div className="section-heading">
        <Icon name="text" />
        {' ' + w.library}
      </div>
      <p className="help">
        {loading
          ? w.loading
          : `${new Set(nativeFaces.map((f) => f.family)).size} ${w.families} · ${nativeFaces.length} ${w.faces}`}
      </p>
      {loading ? <Skeleton lines={4} label={w.loading} /> : null}
      <details className="font-library-options">
        <summary>{w.manage}</summary>
        <button
          type="button"
          id="addFontFolder"
          className="btn wide"
          disabled={loading}
          onClick={() => obtainFonts('chooseFontFolder')}
        >
          <Icon name="folder" />
          {w.folder}
        </button>
        <button
          type="button"
          id="refreshFontCatalog"
          className="btn wide"
          disabled={loading}
          onClick={() => obtainFonts('refreshFonts')}
        >
          {w.refresh}
        </button>
        <p className="help">{w.hint}</p>
        <details>
          <summary>{w.folders}</summary>
          <div className="font-folder-list user-content">
            {fontFolders.length ? fontFolders.map((f) => <p key={f}>{f}</p>) : w.noFolders}
          </div>
        </details>
        <p className="help">{w.saved}</p>
      </details>
    </>
  );
};

registerInspectorPanel('design:fonts', () => <FontLibraryPanel />, 'font-library-panel');
