// Idioma de la interfaz en la página: translate() recorre la interfaz visible y la traduce; un
// MutationObserver la vuelve a correr cuando cambia el DOM. Maneja el selector #language, guarda
// el idioma elegido y publica window.LibroI18n (tr, language, set, translate). El diccionario, tr,
// bw y el idioma actual están en src/i18n/language.ts (sin efectos, para importarlos).
// Fuente TypeScript: se compila a build/i18n.js (desktop/scripts/build.mjs).

import { currentLanguage, setCurrentLanguage, tr, type Language } from './i18n/language.ts';

export type { Language } from './i18n/language.ts';

export interface LibroI18nApi {
  /** Texto en castellano → idioma actual (si no lo conoce, lo devuelve igual). */
  tr(text: string): string;
  /** Idioma actual de la interfaz. */
  readonly language: Language;
  /** Cambia el idioma como si se eligiera en el selector #language. */
  set(language: Language): void;
  /** Vuelve a traducir la interfaz visible. */
  translate(): void;
}

/** Texto fuente de un nodo o atributo y la traducción que se le escribió (no traducir dos veces). */
interface TextSource {
  source: string;
  output: string;
}

const textSources = new WeakMap<Node, TextSource>(),
  attrSources = new WeakMap<Element, Record<string, TextSource>>();
const excluded =
  '#spreadStage,#printRoot,#documentName,.user-content,.thumb-head,#language,script,style,textarea,[contenteditable="true"],[data-react]';
function translate(): void {
  const roots = [
    $('.topbar'),
    $('.leftpanel'),
    $('.documentbar'),
    $('.canvas-hint'),
    $('.template-panel'),
    $('.statusbar'),
    $('.inspector'),
    $('#toast'),
  ];
  for (const root of roots) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest(excluded)) continue;
      // Los nodos de texto siempre tienen nodeValue.
      const raw = node.nodeValue as string,
        trim = raw.trim();
      if (!trim) continue;
      let prev = textSources.get(node),
        source = prev && trim === prev.output ? prev.source : trim;
      const value = tr(source);
      textSources.set(node, { source, output: value });
      if (value !== trim) node.nodeValue = raw.replace(trim, value);
    }
    root.querySelectorAll('[title],[aria-label],[placeholder]').forEach((el) => {
      if (el.closest(excluded)) return;
      let refs = attrSources.get(el) || {};
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const old = refs[attr],
          source = old && value === old.output ? old.source : value,
          translated = tr(source);
        refs[attr] = { source, output: translated };
        if (translated !== value) el.setAttribute(attr, translated);
      }
      attrSources.set(el, refs);
    });
  }
}
let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    translate();
  });
}).observe(document.body, { childList: true, subtree: true, characterData: true });
const selector = $('#language') as HTMLSelectElement;
selector.value = currentLanguage();
selector.onchange = () => {
  setCurrentLanguage(selector.value as Language);
  const locale = currentLanguage();
  localStorage.setItem('librostudio-language', locale);
  document.documentElement.lang = locale;
  translate();
  if (native) nativeCall('locale', { language: locale }).catch(() => {});
  document.dispatchEvent(new CustomEvent('maquetario:language', { detail: { language: locale } }));
};
document.documentElement.lang = currentLanguage();
translate();

declare global {
  var LibroI18n: LibroI18nApi;
}
globalThis.LibroI18n = {
  tr,
  get language() {
    return currentLanguage();
  },
  set(language) {
    selector.value = language;
    // Corre el manejador del selector, igual que un cambio hecho desde la interfaz.
    (selector.onchange as () => void).call(selector);
  },
  translate,
};
