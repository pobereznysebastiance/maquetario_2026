// Menú del clic derecho sobre texto (pedido de la BETA 0.2): en un campo o mientras se escribe en
// una caja del libro, sugerencias de ortografía, cortar, copiar, pegar y seleccionar todo. Sobre
// texto elegido que no se edita, copiar.
//
// Lo demás (objetos, página, miniaturas) lo arma la interfaz (src/context-menu.tsx): ahí la página
// cancela el evento y Chromium no pide este menú. Las sugerencias sólo las sabe el corrector del
// sistema (Windows y macOS), por eso este va acá y no en la página.
//
// Idioma de las etiquetas: el de la interfaz (session.language, que avisa la página).
// Sin Electron en tiempo de ejecución (sólo tipos): se prueba con node --test
// (desktop/test/text-menu.test.ts). Lo engancha a la ventana context-menu.ts.
import type { MenuItemConstructorOptions, WebContents } from 'electron';

type Words = Record<
  'cut' | 'copy' | 'paste' | 'selectAll' | 'learn' | 'noSuggestions' | 'undo' | 'redo',
  string
>;
const WORDS: Record<string, Words> = {
  es: {
    cut: 'Cortar',
    copy: 'Copiar',
    paste: 'Pegar',
    selectAll: 'Seleccionar todo',
    learn: 'Agregar al diccionario',
    noSuggestions: 'Sin sugerencias',
    undo: 'Deshacer',
    redo: 'Rehacer',
  },
  en: {
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select all',
    learn: 'Add to dictionary',
    noSuggestions: 'No suggestions',
    undo: 'Undo',
    redo: 'Redo',
  },
  pt: {
    cut: 'Recortar',
    copy: 'Copiar',
    paste: 'Colar',
    selectAll: 'Selecionar tudo',
    learn: 'Adicionar ao dicionário',
    noSuggestions: 'Sem sugestões',
    undo: 'Desfazer',
    redo: 'Refazer',
  },
};

/** Las entradas del menú para lo que tocó el clic (función pura: la prueba la usa sin Electron). */
export function textMenuTemplate(
  params: Pick<
    Electron.ContextMenuParams,
    'isEditable' | 'misspelledWord' | 'dictionarySuggestions' | 'selectionText' | 'editFlags'
  >,
  language: string,
  contents: Pick<WebContents, 'replaceMisspelling' | 'session'> | null,
): MenuItemConstructorOptions[] {
  const w = WORDS[language] ?? WORDS.es!;
  const items: MenuItemConstructorOptions[] = [];
  if (params.isEditable && params.misspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(0, 6);
    if (suggestions.length)
      for (const suggestion of suggestions)
        items.push({
          label: suggestion,
          click: () => contents?.replaceMisspelling(suggestion),
        });
    else items.push({ label: w.noSuggestions, enabled: false });
    items.push(
      {
        label: w.learn,
        click: () => contents?.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      },
      { type: 'separator' },
    );
  }
  if (params.isEditable) {
    const f = params.editFlags;
    items.push(
      { role: 'undo', label: w.undo, enabled: f.canUndo },
      { role: 'redo', label: w.redo, enabled: f.canRedo },
      { type: 'separator' },
      { role: 'cut', label: w.cut, enabled: f.canCut },
      { role: 'copy', label: w.copy, enabled: f.canCopy },
      { role: 'paste', label: w.paste, enabled: f.canPaste },
      { type: 'separator' },
      { role: 'selectAll', label: w.selectAll, enabled: f.canSelectAll },
    );
  } else if (params.selectionText.trim()) {
    items.push({ role: 'copy', label: w.copy });
  }
  return items;
}

/**
 * Idiomas del corrector: castellano (el que tenga el sistema) e inglés. En macOS el corrector es
 * el del sistema y elige solo; en Windows hay que pedir los que estén instalados.
 */
export function spellCheckerLanguages(available: string[]): string[] {
  const spanish = ['es-AR', 'es-419', 'es-ES', 'es-MX', 'es'].find((code) =>
    available.includes(code),
  );
  const fallbackSpanish = available.find((code) => code.toLowerCase().startsWith('es'));
  const english = ['en-US', 'en-GB', 'en'].find((code) => available.includes(code));
  return [spanish ?? fallbackSpanish, english].filter((code): code is string => !!code);
}
