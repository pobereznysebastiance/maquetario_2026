// Inspector · Libro · Fuentes de tu equipo (etapa 3, D2, paso 4): cuántas familias y estilos leyó
// la app, y administrar las carpetas de fuentes.
//
// Va al final de Libro, en una sección con class "font-library" (Inspector.tsx). Mismo marcado que tenía en HTML
// (UI.skeleton, UI.button), con los textos de fw() (fonts.ts). Mientras se lee el catálogo, los
// botones quedan deshabilitados; obtainFonts vuelve a dibujar el inspector al empezar y al terminar.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import { Btn, SectionHeading } from './fields.tsx';

/** Líneas grises de "cargando" (UI.skeleton). */
const Skeleton = ({ lines, label }: { lines: number; label: string }) => (
  <div className="skeleton" role="status" aria-busy="true" aria-label={label}>
    {Array.from({ length: lines }, (_, i) => (
      <span key={i} className="skeleton-line"></span>
    ))}
  </div>
);

export const FontLibraryPanel = () => {
  useLanguage();
  const w = fw(),
    loading = fontCatalogLoading();
  return (
    <>
      <SectionHeading>
        <Icon name="text" />
        {' ' + w.library}
      </SectionHeading>
      <p className="help">
        {loading
          ? w.loading
          : `${new Set(nativeFaces.map((f) => f.family)).size} ${w.families} · ${nativeFaces.length} ${w.faces}`}
      </p>
      {loading ? <Skeleton lines={4} label={w.loading} /> : null}
      <details className="font-library-options">
        <summary>{w.manage}</summary>
        <Btn
          id="addFontFolder"
          icon="folder"
          label={w.folder}
          wide
          disabled={loading}
          onClick={() => obtainFonts('chooseFontFolder')}
        />
        <Btn
          id="refreshFontCatalog"
          label={w.refresh}
          wide
          disabled={loading}
          onClick={() => obtainFonts('refreshFonts')}
        />
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
