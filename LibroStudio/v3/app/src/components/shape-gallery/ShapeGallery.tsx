// Contenido de la Hoja "Figuras y contenedores" (shapes.ts → shapeChooser, con modal.info): una
// opción por figura con su dibujo. Elegir una cierra la Hoja y deja la herramienta lista para
// dibujar (pick, en shapes.ts). Botones [data-shape-kind] como en la versión en HTML.
//
// El dibujo de cada opción es el SVG que arma shapeSvg (el mismo que va a la página), así que se
// inserta tal cual; no lo escribe el usuario.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLanguage } from '../../react/mount.tsx';
import { bw } from '../../i18n/language.ts';

interface GalleryProps {
  kinds: string[];
  label: (kind: string) => string;
  preview: (kind: string) => string;
  pick: (kind: string) => void;
}

const ShapeGallery = ({ kinds, label, preview, pick }: GalleryProps) => {
  useLanguage();
  return (
    <>
      <p className="builder-intro">
        {bw(
          'Elegí una figura y arrastrá sobre la página para dibujarla. Con Shift conserva proporciones iguales. Después ajustá relleno y trazo en Selección.',
          'Choose a shape and drag on the page to draw it. Hold Shift for equal proportions. Then set fill and stroke in Selection.',
          'Escolha uma figura e arraste na página para desenhar. Com Shift mantém proporções iguais. Depois ajuste preenchimento e traço em Seleção.',
        )}
      </p>
      <div className="shape-choices">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            data-shape-kind={kind}
            className="shape-choice"
            onClick={() => pick(kind)}
          >
            <div dangerouslySetInnerHTML={{ __html: preview(kind) }} />
            <strong>{label(kind)}</strong>
          </button>
        ))}
      </div>
    </>
  );
};

/** Elemento de la Hoja (lo llama shapes.ts, que no es .tsx). */
export const shapeGallery = (props: GalleryProps) => <ShapeGallery {...props} />;
