// Deshacer y cambios: el estado para deshacer (snapshot), la marca de cambios sin guardar con su
// copia de recuperación (changed), el cambio con deshacer y redibujo (commit) y undo/redo. No
// tiene efectos al cargar. core-wiring.ts registra commit como
// extensible (paragraphs.ts lo extiende) y publica todo.
//
// Lo que estas funciones llaman del resto del núcleo (render, updateStatus, finishEditing, toast,
// syncNative) se llama por su nombre global, así pasa por las extensiones de cada una.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { scheduleRecovery } from './recovery.ts';
import { editor } from '../state/editor.ts';

/**
 * Guarda el estado para deshacer. Dentro de un grupo (editor.historyGroup) sólo lo guarda el primer
 * cambio: los siguientes se deshacen con él. Devuelve si guardó.
 */
export function snapshot(): boolean {
  const group = editor.historyGroup;
  if (group?.snapshotTaken) {
    redoStack = [];
    return false;
  }
  if (group) group.snapshotTaken = true;
  undoStack.push(JSON.stringify(book));
  let sum = undoStack.reduce((a, b) => a + b.length, 0);
  while (undoStack.length > 1 && (sum > 40000000 || undoStack.length > 40))
    sum -= undoStack.shift()!.length;
  redoStack = [];
  return true;
}
/** Marca cambios sin guardar y programa la copia de recuperación. */
export function changed(): void {
  dirty = true;
  syncNative();
  scheduleRecovery();
  updateStatus();
}
/**
 * Aplica un cambio al libro con deshacer: guarda el estado, corre fn, marca el cambio y redibuja
 * (full: también miniaturas y plantillas). Si fn falla, vuelve atrás y lo avisa. Se publica
 * extensible (core-wiring.ts): no llamarla por este nombre local.
 */
export function commitChange(fn: () => void, full = true): void {
  if (busy) return;
  // En un grupo ya abierto no se guarda otro estado: si fn falla, se vuelve a esta copia.
  const before = editor.historyGroup?.snapshotTaken ? JSON.stringify(book) : null;
  const saved = snapshot();
  try {
    fn();
    changed();
    render(full);
  } catch (error) {
    book = JSON.parse(saved ? undoStack.pop()! : before!);
    toast((error as Error).message, 'error');
    render(true);
  }
}
export function undo(): void {
  if (busy || !undoStack.length) return;
  finishEditing();
  redoStack.push(JSON.stringify(book));
  book = JSON.parse(undoStack.pop()!);
  selected = null;
  active = Math.min(active, book.pages.length - 1);
  spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
  changed();
  render(true);
}
export function redo(): void {
  if (busy || !redoStack.length) return;
  finishEditing();
  undoStack.push(JSON.stringify(book));
  book = JSON.parse(redoStack.pop()!);
  selected = null;
  active = Math.min(active, book.pages.length - 1);
  spread = Math.floor(active / (book.facing ? 2 : 1)) * (book.facing ? 2 : 1);
  changed();
  render(true);
}
