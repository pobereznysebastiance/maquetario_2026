// "Guardar como…": guarda una copia del libro en un archivo nuevo, que pasa a ser el del proyecto.
// Lo llaman la barra superior (components/topbar/Topbar.tsx) y el atajo Ctrl+Mayús+S
// (readability.ts). No tiene efectos al cargar: se importa.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { bw } from './i18n/language.ts';
import { M } from './core-api.ts';

/** Guarda una copia del libro; devuelve si se guardó. */
export async function saveProjectAs(): Promise<boolean> {
  if (!hasDocument) {
    settings(true);
    return false;
  }
  finishEditing();
  try {
    M.validate(book);
    if (native) {
      if (!(await nativeCall('saveAs', { json: JSON.stringify(book, null, 2), name: book.title })))
        return false;
    } else
      download(
        new Blob([JSON.stringify(book, null, 2)], { type: 'application/json' }),
        book.title + '.mqt',
      );
    dirty = false;
    syncNative();
    toast(
      bw(
        'Copia guardada. Los próximos cambios se guardan en este archivo.',
        'Copy saved. Future changes will be saved in this file.',
        'Cópia salva. As próximas alterações serão salvas neste arquivo.',
      ),
    );
    return true;
  } catch (e) {
    toast((e as Error).message, 'error');
    return false;
  }
}
