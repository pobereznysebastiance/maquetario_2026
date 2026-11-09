// Anfitrión y avisos: los pedidos al proceso principal (nativeCall y sus respuestas), los avisos
// del sistema mientras no cargó su componente (toast y la cola pendingToasts) y el aviso de
// cambios sin guardar (syncNative). No tiene efectos al cargar: core-wiring.ts registra toast y
// syncNative como extensibles (otros los extienden por nombre), los publica y escucha las
// respuestas del anfitrión.
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import type { HostReply } from '../host.ts';
import { M } from './utils.ts';

/** Pedidos al proceso principal que esperan respuesta, por id. */
const pending = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
>();

/** Pedido al proceso principal de Electron; rechaza fuera de la app de escritorio. */
export function nativeCall(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (!MaquetarioHost.available)
    return Promise.reject(Error('Esta función requiere la app de escritorio de Maquetario.'));
  if (action === 'newProject' && typeof updatePortableFontCatalog === 'function') {
    portableFontFaces = [];
    updatePortableFontCatalog();
  }
  const id = M.uid();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    MaquetarioHost.postMessage({ id, action, payload });
  });
}
/** Respuesta del anfitrión a un pedido de nativeCall (la escucha core-wiring.ts). */
export function nativeReply(data: HostReply): void {
  const p = pending.get(data.id);
  if (p) {
    pending.delete(data.id);
    data.error ? p.reject(Error(data.error)) : p.resolve(data.result);
  }
}

/** Avisos pedidos antes de que cargue el componente de avisos (build/app.js): [mensaje, tipo]. */
export const pendingToasts: [message: string, type: string][] = [];
/**
 * Aviso del sistema: toast(mensaje, tipo), tipo 'success' (por defecto) | 'info' | 'warning' |
 * 'error'. Lo muestra el componente React de src/components/toast/, que reemplaza esta función al
 * cargar (extend.replace); hasta entonces, los avisos esperan en pendingToasts.
 */
export function toast(msg: string, type = 'success'): void {
  pendingToasts.push([msg, type]);
}
/**
 * Avisa al anfitrión si hay cambios sin guardar y marca body.has-unsaved-changes (color del punto
 * del nombre y del estado). Una sola fuente, la variable dirty: el texto del indicador de guardado
 * lo dibuja la barra de estado en React, que se redibuja después de esta función
 * (src/react/editor-state.ts).
 */
export function syncNative(): void {
  if (native) nativeCall('dirty', { dirty, title: book.title }).catch(() => {});
  document.body.classList.toggle('has-unsaved-changes', dirty);
}
