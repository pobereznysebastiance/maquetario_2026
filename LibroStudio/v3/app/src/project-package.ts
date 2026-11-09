// Empaquetar proyecto: botón junto a "Guardar como" que crea una carpeta con el proyecto editable,
// copias de las imágenes, el PDF del interior (y el de la cubierta, si hay) y, si se pide, las
// fuentes que se pueden compartir. Al abrir un proyecto desde un paquete, sus fuentes se suman al
// catálogo antes de cargarlo.
//
// loadOpenedProject es global: lo llaman studio.js (Abrir) y welcome.js (recientes).
//
// Fuente TypeScript: se compila a build/project-package.js (desktop/scripts/build.mjs).

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

function loadOpenedProject(result: OpenedProject): void {
  M.validate(JSON.parse(result.content.replace(/^\uFEFF/, '')));
  portableFontFaces = result.packageFaces || [];
  updatePortableFontCatalog();
  loadProject(result.content);
}
globalThis.loadOpenedProject = loadOpenedProject;

/** Fuentes que usa el libro: id de la cara (o "missing:…") → nombre legible. */
function packageFontUsage(): Record<string, string> {
  const usage = new Map<string, string>();
  const include = (format: Record<string, any> | undefined) => {
    if (!format?.font) return;
    const face = selectedFace(format);
    const id = face?.id || 'missing:' + format.font + ' ' + (format.fontStyleName || '');
    usage.set(id, format.font + (face?.style ? ' · ' + face.style : ''));
  };
  for (const page of book.pages)
    for (const object of page.objects) {
      if (object.type !== 'text') continue;
      if (object.toc) include(object);
      else {
        const count = object.text.split('\n').length;
        for (let index = 0; index < count; index++) include(paragraphFormat(book, object, index));
      }
    }
  for (const type of ['header', 'titulillo', 'folio'] as const)
    if (book[type].enabled) include(book[type]);
  for (const style of book.paragraphStyles || []) include(style.properties);
  if (book.cover) include({ font: 'Georgia' });
  return Object.fromEntries(usage);
}

function packageDialog(): void {
  if (!hasDocument || busy) return;
  const title = bw('Empaquetar proyecto', 'Package project', 'Empacotar projeto');
  modal.sheet(
    title,
    `<p class="builder-intro">${bw(
      'Creá una carpeta con el proyecto editable, copias de las imágenes y un PDF del interior. Si diseñaste una cubierta, se agrega su PDF por separado.',
      'Create a folder with the editable project, copies of its images and an interior PDF. If there is a cover, its PDF is included separately.',
      'Crie uma pasta com o projeto editável, cópias das imagens e um PDF do miolo. Se houver capa, seu PDF será incluído separadamente.',
    )}</p>
    <label class="check-line"><input type="checkbox" id="packageFonts">${bw(
      'Copiar las fuentes que tengo permiso de compartir',
      'Copy fonts I am allowed to share',
      'Copiar as fontes que tenho permissão para compartilhar',
    )}</label>
    <p class="help">${bw(
      'Abrí el .mqt desde la carpeta del paquete en la otra computadora. Las fuentes que queden afuera se anotan en el LEEME.',
      'Open the .mqt from inside the package folder on the other computer. Fonts left out are listed in the README.',
      'Abra o .mqt dentro da pasta do pacote no outro computador. As fontes omitidas são listadas no LEEME.',
    )}</p>
    <p class="inline-error"></p>`,
    async () => {
      if (busy) return false;
      M.validate(book);
      if (book.cover) validateCover(book.cover);
      const copyFonts = $('#packageFonts').checked;
      const dialog = $('#modal');
      const buttons = [...dialog.querySelectorAll('button')].filter((button) => !button.disabled);
      const preventCancel = (event: Event) => event.preventDefault();
      for (const button of buttons) button.disabled = true;
      dialog.addEventListener('cancel', preventCancel);
      busy = true;
      try {
        await fontCatalogPromise;
        const result = await nativeCall('packageProject', {
          project: JSON.stringify(book, null, 2),
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
        busy = false;
        dialog.removeEventListener('cancel', preventCancel);
        for (const button of buttons) button.disabled = false;
      }
    },
    bw('Elegir carpeta…', 'Choose folder…', 'Escolher pasta…'),
    { size: 'sm' },
  );
}

const packageButton = document.createElement('button');
packageButton.type = 'button';
packageButton.className = 'tool-action';
packageButton.id = 'packageProject';
packageButton.innerHTML = icon('folder') + '<span></span>';
packageButton.onclick = packageDialog;
$('#saveAs').after(packageButton);
function labelPackageButton(): void {
  packageButton.querySelector('span')!.textContent = bw('Empaquetar', 'Package', 'Empacotar');
  packageButton.title = bw('Empaquetar proyecto', 'Package project', 'Empacotar projeto');
}
labelPackageButton();
document.addEventListener('maquetario:language', () => {
  labelPackageButton();
});

export {};
