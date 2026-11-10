// Engancha el menú del clic derecho sobre texto (text-menu.ts) a la ventana del editor.
import { Menu } from 'electron';
import type { Session } from './session.ts';
import { textMenuTemplate } from './text-menu.ts';

/** Engancha el menú de texto a la ventana del editor. */
export function attachTextMenu(session: Session): void {
  const contents = session.win.webContents;
  contents.on('context-menu', (_event, params) => {
    const template = textMenuTemplate(params, session.language, contents);
    if (template.length) Menu.buildFromTemplate(template).popup({ window: session.win });
  });
}
