// Empaquetar proyecto: botón junto a "Guardar como" que crea una carpeta con el proyecto editable,
// copias de las imágenes, el PDF del interior (y el de la cubierta, si hay) y, si se pide, las
// fuentes que se pueden compartir. Al abrir un proyecto desde un paquete, sus fuentes se suman al
// catálogo antes de cargarlo.
//
// No tiene efectos al cargar: se importa. loadOpenedProject es global (lo llaman src/core/project-file.ts y el
// proceso principal); lo publica project-package-wiring.ts.
//
// La Hoja es React (modal.sheet): mientras se arma el paquete, sus botones quedan
// deshabilitados y no se cierra (lo hace la Hoja con una acción en curso, Sheet.tsx).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { bw } from './i18n/language.ts';
import { editor, M } from './core-api.ts';
import { selectedFace, updatePortableFontCatalog } from './font-catalog.ts';
import { paragraphFormat } from './paragraph-format.ts';
import { modal } from './components/dialog/modal.ts';

/** Lo que devuelve el anfitrión al abrir un proyecto (desktop/src/main/handlers/project.ts). */
interface OpenedProject {
  content: string;
  path?: string;
  /** Caras tipográficas del paquete, si el proyecto está dentro de uno. */
  packageFaces?: typeof portableFontFaces;
}

declare global {
  /** Valida el proyecto abierto, suma las fuentes de su paquete al catálogo y lo carga. */
  var loadOpenedProject: (result: OpenedProject) => void;
}

export function loadOpenedProject(result: OpenedProject): void {
  M.validate(JSON.parse(result.content.replace(/^\uFEFF/, '')));
  portableFontFaces = result.packageFaces || [];
  updatePortableFontCatalog();
  loadProject(result.content);
}

/** Fuentes que usa el libro: id de la cara (o "missing:…") → nombre legible. */
function packageFontUsage(): Record<string, string> {
  const usage = new Map<string, string>();
  const include = (format: Record<string, any> | undefined) => {
    if (!format?.font) return;
    const face = selectedFace(format);
    const id = face?.id || 'missing:' + format.font + ' ' + (format.fontStyleName || '');
    usage.set(id, format.font + (face?.style ? ' · ' + face.style : ''));
  };
  for (const page of editor.book.pages)
    for (const object of page.objects) {
      if (object.type !== 'text') continue;
      if (object.toc) include(object);
      else {
        const count = object.text.split('\n').length;
        for (let index = 0; index < count; index++)
          include(paragraphFormat(editor.book, object, index));
      }
    }
  for (const type of ['header', 'titulillo', 'folio'] as const)
    if (editor.book[type].enabled) include(editor.book[type]);
  for (const style of editor.book.paragraphStyles || []) include(style.properties);
  if (editor.book.cover) include({ font: 'Georgia' });
  return Object.fromEntries(usage);
}

/** Contenido de la Hoja: qué lleva el paquete y la opción de copiar fuentes. */
const PackageSheet = () => (
  <>
    <p className="builder-intro">
      {bw(
        'Creá una carpeta con el proyecto editable, copias de las imágenes y un PDF del interior. Si diseñaste una cubierta, se agrega su PDF por separado.',
        'Create a folder with the editable project, copies of its images and an interior PDF. If there is a cover, its PDF is included separately.',
        'Crie uma pasta com o projeto editável, cópias das imagens e um PDF do miolo. Se houver capa, seu PDF será incluído separadamente.',
      )}
    </p>
    <label className="check-line">
      <input type="checkbox" id="packageFonts" />
      {bw(
        'Copiar las fuentes que tengo permiso de compartir',
        'Copy fonts I am allowed to share',
        'Copiar as fontes que tenho permissão para compartilhar',
      )}
    </label>
    <p className="help">
      {bw(
        'Abrí el .mqt desde la carpeta del paquete en la otra computadora. Las fuentes que queden afuera se anotan en el LEEME.',
        'Open the .mqt from inside the package folder on the other computer. Fonts left out are listed in the README.',
        'Abra o .mqt dentro da pasta do pacote no outro computador. As fontes omitidas são listadas no LEEME.',
      )}
    </p>
  </>
);

export function packageDialog(): void {
  if (!editor.hasDocument || editor.busy) return;
  const title = bw('Empaquetar proyecto', 'Package project', 'Empacotar projeto');
  modal.sheet(
    title,
    <PackageSheet />,
    async () => {
      if (editor.busy) return false;
      M.validate(editor.book);
      if (editor.book.cover) validateCover(editor.book.cover);
      const copyFonts = $('#packageFonts').checked;
      editor.busy = true;
      try {
        await fontCatalogPromise;
        const result = await nativeCall('packageProject', {
          project: JSON.stringify(editor.book, null, 2),
          copyFonts,
          fonts: packageFontUsage(),
        });
        if (!result) return false;
        const summary =
          bw('Paquete creado en', 'Package created at', 'Pacote criado em') + ' ' + result.path;
        toast(
          summary +
            (result.omitted.length
              ? bw(
                  ' · Revisá las fuentes en LEEME.',
                  ' · Check fonts in the README.',
                  ' · Confira as fontes no LEEME.',
                )
              : ''),
        );
        return true;
      } finally {
        editor.busy = false;
      }
    },
    bw('Elegir carpeta…', 'Choose folder…', 'Escolher pasta…'),
    { size: 'sm' },
  );
}

// "Empaquetar" está en la barra superior (components/topbar/Topbar.tsx).

export {};
