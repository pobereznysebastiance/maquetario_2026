// Tamaño de la ventana del editor según el área de trabajo de la pantalla (sin la barra de tareas).
// Sin Electron: se prueba con node --test (desktop/test/window-size.test.ts).

export interface Area {
  width: number;
  height: number;
}

/** Tamaño cómodo en un monitor grande. */
export const PREFERRED: Area = { width: 1536, height: 1024 };

/**
 * Mínimo de la ventana. Tiene que entrar en las notebooks del aula:
 * - 1366 × 768 al 100 %: el área útil queda en ~1366 × 728 (barra de tareas de 40 px).
 * - 1920 × 1080 al 150 %: ~1280 × 672 (1080 / 1,5 = 720, menos 48 de barra de tareas).
 * 1024 × 640 entra en las dos con margen y deja lugar a la barra superior, el lienzo y el inspector.
 */
export const MINIMUM: Area = { width: 1024, height: 640 };

/** Parte del área de trabajo que ocupa la ventana al abrir (queda un borde para ver que es una ventana). */
const FILL = 0.95;

/** Tamaño inicial y mínimo para un área de trabajo: nunca más grande que la pantalla. */
export function windowSize(workArea: Area): { initial: Area; minimum: Area } {
  const minimum = {
    width: Math.min(MINIMUM.width, workArea.width),
    height: Math.min(MINIMUM.height, workArea.height),
  };
  const initial = {
    width: Math.max(minimum.width, Math.min(PREFERRED.width, Math.floor(workArea.width * FILL))),
    height: Math.max(
      minimum.height,
      Math.min(PREFERRED.height, Math.floor(workArea.height * FILL)),
    ),
  };
  return { initial, minimum };
}
