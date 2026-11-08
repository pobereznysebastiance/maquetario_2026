// Estado de la ventana del editor (lo que en C# eran campos de la clase Desktop).
import type { BrowserWindow } from 'electron';

export interface Session {
  win: BrowserWindow;
  projectPath: string | null;
  dirty: boolean;
  /** Hay una salida (PDF, impresión, paquete) en curso. */
  busy: boolean;
  assistantWorking: boolean;
  closingAllowed: boolean;
  closePromptShown: boolean;
  /** Idioma de la interfaz: es, en o pt. */
  language: string;
}

export function createSession(win: BrowserWindow): Session {
  return {
    win,
    projectPath: null,
    dirty: false,
    busy: false,
    assistantWorking: false,
    closingAllowed: false,
    closePromptShown: false,
    language: 'es',
  };
}

/** Ejecuta código en la página (equivalente a ExecuteScriptAsync). */
export function exec<T = unknown>(session: Session, code: string): Promise<T> {
  return session.win.webContents.executeJavaScript(code, true) as Promise<T>;
}

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Espera a que una expresión de la página sea verdadera. */
export async function waitFor(
  session: Session,
  expression: string,
  tries: number,
  everyMs: number,
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if ((await exec(session, `!!(${expression})`)) === true) return true;
    await delay(everyMs);
  }
  return false;
}

/** Evita dos salidas a la vez (PDF, impresión, paquete). */
export async function exclusive<T>(
  session: Session,
  message: string,
  work: () => Promise<T>,
): Promise<T> {
  if (session.busy) throw new Error(message);
  session.busy = true;
  try {
    return await work();
  } finally {
    session.busy = false;
  }
}
