// Copia de recuperación: el libro se guarda en IndexedDB (LibroStudioRecovery → books → 'last')
// un momento después de cada cambio; la bienvenida la ofrece al arrancar si el programa se cerró
// sin guardar (components/welcome/welcome-service.tsx). No tiene efectos al cargar.
// core-wiring.ts publica recoveryDb.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).

/** La base de la copia de recuperación (la crea la primera vez). */
export async function recoveryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('LibroStudioRecovery', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('books');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
/** Guarda el libro actual como copia de recuperación. */
async function storeRecovery(): Promise<void> {
  try {
    const db = await recoveryDb(),
      tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').put(JSON.stringify(book), 'last');
    tx.oncomplete = () => db.close();
  } catch {}
}
let recoveryTimer: number | undefined;
/** Programa la copia de recuperación (la última pedida gana: se guarda 900 ms después). */
export function scheduleRecovery(): void {
  clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(() => storeRecovery(), 900);
}
