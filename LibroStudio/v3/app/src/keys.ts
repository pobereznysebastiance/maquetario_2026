// Atajos de teclado en cada sistema: en macOS el modificador de los atajos es ⌘ (Command) y en
// Windows y Linux, Ctrl. Las teclas se escriben una vez ("Ctrl+S") y acá se leen y se rotulan como
// corresponde (⌘S en macOS).
//
// No tiene efectos al cargar ni estado: lo importan el núcleo (build/core.js) y la app
// (build/app.js), y cada paquete lleva su copia.
//
// Fuente TypeScript: viaja dentro de build/core.js y build/app.js.

/** La interfaz corre en macOS (Electron informa la plataforma real en navigator.platform). */
export const isMac = /^Mac/i.test(globalThis.navigator?.platform ?? '');

type Modifiers = Pick<KeyboardEvent | MouseEvent | WheelEvent, 'ctrlKey' | 'metaKey'>;

/**
 * El modificador de los atajos está apretado: ⌘ en macOS, Ctrl en los demás. En macOS, Ctrl
 * solo no cuenta (Ctrl+clic es el clic derecho y Ctrl+letra mueve el cursor en los textos).
 */
export const commandKey = (e: Modifiers): boolean => (isMac ? e.metaKey : e.ctrlKey);

/** Algún modificador de atajo (Ctrl o ⌘), en cualquier sistema: para no robar teclas sueltas. */
export const anyCommandKey = (e: Modifiers): boolean => e.ctrlKey || e.metaKey;

/** La tecla de borrar objetos: Supr; en macOS también la tecla "delete" (Backspace). */
export const isDeleteKey = (e: Pick<KeyboardEvent, 'key'>): boolean =>
  e.key === 'Delete' || (isMac && e.key === 'Backspace');

/** Rehacer: Ctrl+Y en Windows y Linux; ⇧⌘Z (y ⌘Y) en macOS. */
export const isRedoKey = (e: KeyboardEvent): boolean => {
  const key = e.key.toLowerCase();
  return commandKey(e) && (key === 'y' || (key === 'z' && e.shiftKey));
};

/**
 * Rótulo de un atajo para el sistema: "Ctrl+Mayús+S" queda igual en Windows y pasa a "⇧⌘S" en
 * macOS; "Ctrl + rueda" pasa a "⌘ + rueda". Sirve para títulos, ayudas y la tabla de atajos.
 */
export const shortcutLabel = (text: string): string => {
  if (!isMac) return text;
  return (
    text
      // Combinaciones pegadas (Ctrl+Alt+F, Ctrl+Mayús+S): orden de macOS, ⌃⌥⇧⌘ y la tecla.
      .replace(
        /\bCtrl\+((?:(?:Alt|Mayús|Shift|Maiús)\+)*)([^\s+·,)]+)/g,
        (_, mods: string, key) => {
          const alt = /Alt\+/.test(mods) ? '⌥' : '',
            shift = /(Mayús|Shift|Maiús)\+/.test(mods) ? '⇧' : '';
          return alt + shift + '⌘' + key;
        },
      )
      // Lo que queda separado con espacios ("Ctrl + rueda", "Ctrl + 0").
      .replace(/\bCtrl\b/g, '⌘')
      .replace(/\bAlt\b/g, '⌥')
  );
};
