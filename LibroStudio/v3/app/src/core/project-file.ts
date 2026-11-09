// Archivo y guardado: la pregunta por los cambios sin guardar (confirmChanges), Guardar, Abrir y
// cargar un proyecto. No tiene efectos al cargar. core-wiring.ts
// publica todo y registra saveProject (bienvenida, pruebas) y loadProject (fonts,
// review-workspace) como extensibles. confirmChanges llama a saveProject por el nombre global,
// así pasa por sus extensiones; también va por el nombre global lo demás que llama (askUnsaved,
// loadOpenedProject, render, toast…).
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { M, $ } from './utils.ts';

/** Para qué se pregunta por los cambios sin guardar: da el verbo de los botones del aviso. */
export type UnsavedIntent = 'close' | 'open' | 'new' | 'build' | 'recover' | 'continue';
/**
 * Pregunta qué hacer con los cambios sin guardar (el aviso de app-notices.tsx, el mismo que al
 * cerrar) y, si corresponde, sigue con proceed: al descartar, en el acto; al guardar, cuando se
 * guardó. intent da el verbo ("Descartar y abrir", "Guardar y abrir"…).
 */
export function confirmChanges(proceed: () => unknown, intent: UnsavedIntent = 'continue'): void {
  // La autoprueba no puede contestar avisos: descarta y sigue, como antes.
  if (window.maquetarioSelfTest) {
    proceed();
    return;
  }
  askUnsaved(intent, {
    save: async () => {
      const saved = await saveProject();
      if (saved) setTimeout(proceed, 20);
      return saved;
    },
    discard: () => proceed(),
    cancel: () => {},
  });
}
/** Guarda el proyecto (Guardar). Se publica extensible como saveProject (core-wiring.ts). */
export async function saveProjectBase(): Promise<boolean> {
  finishEditing();
  try {
    M.validate(book);
    if (native) {
      const saved = await nativeCall('save', {
        json: JSON.stringify(book, null, 2),
        name: book.title,
      });
      if (!saved) return false;
    } else
      download(
        new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }),
        book.title + '.mqt',
      );
    dirty = false;
    syncNative();
    toast('Proyecto guardado. Podés seguir editando.');
    return true;
  } catch (error) {
    toast('No se pudo guardar: ' + (error as Error).message, 'error');
    return false;
  }
}
/** Descarga un archivo (fuera de la app de escritorio). */
export function download(blob: Blob, name: string): void {
  const a = document.createElement('a'),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Abrir: con cambios sin guardar, antes pregunta. */
export function openBook(): void {
  const run = async () => {
    try {
      if (native) {
        const r = await nativeCall('open', {});
        if (!r) return;
        loadOpenedProject(r);
      } else $('#openInput').click();
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };
  if (dirty) confirmChanges(run, 'open');
  else run();
}
/**
 * Valida el contenido de un proyecto y lo carga como libro actual. Se publica extensible como
 * loadProject (core-wiring.ts).
 */
export function loadProjectBase(content: string): void {
  if (content.length > 80000000) throw Error('El proyecto supera 80 MB.');
  const loaded = M.validate(JSON.parse(content.replace(/^\uFEFF/, '')));
  book = loaded;
  selected = null;
  active = spread = 0;
  undoStack = [];
  redoStack = [];
  dirty = false;
  syncNative();
  render(true);
  toast('Proyecto abierto.');
}
