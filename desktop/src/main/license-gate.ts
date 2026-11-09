// Aviso de licencia al arrancar (modo enforce): qué botones ofrece según lo que pasó antes.
// Sin Electron: se prueba con node --test (desktop/test/license-gate.test.ts). El aviso lo
// muestra main.ts → licenseGate().
import type { NoticeButton } from './notice.ts';

/**
 * Lo que puede elegir la persona:
 * - connect: conectar en el navegador (login + licencia de este equipo).
 * - retry: pedir la licencia otra vez sin pasar por el navegador (la sesión ya está).
 * - account: abrir Mi cuenta → Mis programas en Motiova (para liberar una computadora).
 * - quit: salir.
 */
export type GateChoice = 'connect' | 'retry' | 'account' | 'quit';

/** Mientras se espera la confirmación desde el navegador. */
export const WAITING_NOTICE = {
  title: 'Seguí en el navegador',
  message: 'Entrá a tu cuenta de Motiova y tocá Conectar. Cuando termine, Maquetario se abre solo.',
  progressLabel: 'Esperamos la confirmación',
};

/**
 * Botones del aviso. `failure` es el código del último intento (MotiovaError.code) o null.
 * Con el tope de equipos no se vuelve a ofrecer "Conectar con Motiova" (es lo que acaba de
 * fallar): se ofrece ir a Mis programas y, después de abrirlo, volver a pedir la licencia.
 */
export function gateButtons(failure: string | null, accountOpened = false): NoticeButton[] {
  const quit: NoticeButton = { id: 'quit', label: 'Salir' };
  if (failure === 'device-limit')
    return [
      quit,
      { id: 'account', label: 'Abrir Mis programas', primary: !accountOpened },
      { id: 'retry', label: 'Volver a intentar', primary: accountOpened },
    ];
  if (failure === 'timeout' || failure === 'cancelled' || failure === 'offline')
    return [quit, { id: 'connect', label: 'Volver a intentar', primary: true }];
  return [quit, { id: 'connect', label: 'Conectar con Motiova', primary: true }];
}
