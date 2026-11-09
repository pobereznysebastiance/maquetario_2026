// Bienvenida: servicio de la pantalla (estado, acciones y API global) y montaje del componente
// React (WelcomeScreen.tsx). También el logo como "Inicio".
//
// API global (la misma que tenía src/welcome.ts):
// - showWelcome y hideWelcome: otros módulos las extienden por nombre (book-workflow,
//   editorial-learning, review-workspace) y muchos las llaman. Por eso, dentro de este archivo se
//   llaman siempre por globalThis: así corren con sus extensiones.
// - welcomeVisible (lo leen canvas-navigation, readability y el proceso principal), welcome (el
//   elemento #welcomeScreen: lo observa review-workspace) y ww (textos; tests/welcome-tests.js).
// - La entrada "Ayuda" abre el centro de Ayuda (openHelp, de src/help-center.ts).
//
// Cada showWelcome vuelve a montar el contenido (como cuando se rehacía con innerHTML) y lo
// dibuja antes de terminar (flushSync): las extensiones de showWelcome que esperan su promesa
// encuentran la pantalla nueva y lo que le agregaron a la anterior desaparece con ella.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { flushSync } from 'react-dom';
import { useSyncExternalStore } from 'react';
import { mount, useLanguage } from '../../react/mount.tsx';
import { WelcomeScreen, type RecentProject } from './WelcomeScreen.tsx';
import type { Language } from '../../i18n.ts';
import type { Book } from '../../model.ts';

export type { RecentProject } from './WelcomeScreen.tsx';

/** Lo que responde nativeCall('appInfo'). */
export interface WelcomeInfo {
  version: string;
  recents: RecentProject[];
  selftest?: boolean;
}

declare global {
  /** Textos de la bienvenida en el idioma actual. */
  var ww: () => Record<string, string>;
  /** La bienvenida está a la vista. */
  var welcomeVisible: boolean;
  /** Elemento de la bienvenida (#welcomeScreen). */
  var welcome: HTMLElement;
  var hideWelcome: () => void;
  var showWelcome: () => Promise<void>;
}

/** Textos de la bienvenida: el castellano es el texto fuente; la traducción está en src/i18n.ts. */
const WELCOME_TEXT: Record<string, string> = {
  headline: 'Cada libro empieza con una idea.',
  intro: 'Dale forma a tus páginas. Componé, ajustá y prepará tu libro para compartirlo.',
  recent: 'Proyectos recientes',
  empty: 'Tus proyectos aparecerán acá cuando los guardes o abras.',
  new: 'Crear un libro',
  open: 'Abrir proyecto',
  demo: 'Explorar el ejemplo',
  demoHelp: 'Abrí una novela ya maquetada para ver cómo está hecha.',
  help: 'Ayuda',
  helpHelp: 'Tutorial guiado y glosario editorial.',
  resume: 'Volver al libro',
  created: 'Creado por Sebastián Poberezny',
  missing: 'Archivo no disponible',
  recovery: 'Copia de recuperación',
  recover: 'Recuperar',
  discard: 'Descartar',
  discardTitle: 'Descartar la copia de recuperación',
  discardMessage: 'La copia se borra de este equipo. Tus archivos guardados no cambian.',
  home: 'Inicio',
  language: 'Idioma',
  art: 'Atelier editorial de páginas y grillas',
};
const ww = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(WELCOME_TEXT).map(([key, text]) => [
      key,
      globalThis.LibroI18n ? LibroI18n.tr(text) : text,
    ]),
  );
globalThis.ww = ww;

// ── Estado ──
// Lo último que informó el anfitrión y la copia de recuperación encontrada. Se dibujan recién en
// el próximo showWelcome, como antes: la pantalla no cambia mientras está escondida.
let welcomeInfo: WelcomeInfo = { version: '3.6.0', recents: [] };
let recoveryCopy: Book | null = null;
/** Lo que está dibujado. */
interface WelcomeState {
  /** Cuántas veces se mostró: cambia en cada showWelcome y vuelve a montar el contenido. */
  renderId: number;
  info: WelcomeInfo;
  recovery: Book | null;
}
let state: WelcomeState = { renderId: 0, info: welcomeInfo, recovery: null };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const update = (patch: Partial<WelcomeState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

globalThis.welcomeVisible = false;
const welcome = document.createElement('section');
globalThis.welcome = welcome;
welcome.id = 'welcomeScreen';
welcome.setAttribute('aria-label', 'Maquetario');
welcome.hidden = true;
document.body.append(welcome);

// ── Acciones ──
function hideWelcome(): void {
  welcomeVisible = false;
  welcome.hidden = true;
  document.body.classList.remove('welcome-open');
  $('.topbar').inert = false;
  $('.app-layout').inert = false;
  requestAnimationFrame(renderPages);
}
async function showWelcome(): Promise<void> {
  if (busy) return;
  finishEditing();
  if ($('#modal').open) $('#modal').close();
  if (globalThis.closeTutorial) globalThis.closeTutorial();
  if (native)
    try {
      welcomeInfo = await nativeCall('appInfo');
    } catch {}
  flushSync(() =>
    update({ info: welcomeInfo, recovery: recoveryCopy, renderId: state.renderId + 1 }),
  );
  welcomeVisible = true;
  welcome.hidden = false;
  document.body.classList.add('welcome-open');
  $('.topbar').inert = true;
  $('.app-layout').inert = true;
}
function startDemo(): void {
  const go = () => {
    globalThis.hideWelcome();
    book = M.create();
    if (native) nativeCall('newProject').catch(() => {});
    active = spread = 0;
    selected = null;
    undoStack = [];
    redoStack = [];
    dirty = false;
    syncNative();
    render(true);
    ensureBookFonts().then(renderPages);
  };
  if (dirty) {
    globalThis.hideWelcome();
    confirmChanges(go);
  } else go();
}
function recover(): void {
  const copy = recoveryCopy;
  if (!copy) return;
  globalThis.hideWelcome();
  book = M.clone(copy);
  active = spread = 0;
  selected = null;
  dirty = true;
  syncNative();
  render(true);
  ensureBookFonts().then(renderPages);
}
/** Borra la copia de recuperación de este equipo (después de confirmarlo). */
async function discardRecovery(): Promise<void> {
  const t = ww();
  const ok = await confirmAction({
    title: t.discardTitle,
    message: t.discardMessage,
    confirmLabel: t.discard,
    danger: true,
  });
  if (!ok) return;
  try {
    const db = await recoveryDb(),
      tx = db.transaction('books', 'readwrite');
    tx.objectStore('books').delete('last');
    tx.oncomplete = () => db.close();
  } catch {}
  recoveryCopy = null;
  flushSync(() => update({ recovery: null }));
}
async function openRecentProject(record: RecentProject): Promise<void> {
  const run = async () => {
    try {
      const result = await nativeCall('openRecent', { path: record.path });
      globalThis.hideWelcome();
      loadOpenedProject(result);
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  };
  if (dirty) {
    globalThis.hideWelcome();
    confirmChanges(run);
  } else await run();
}

// ── Componente ──
const WelcomeRoot = () => {
  const s = useSyncExternalStore(subscribe, () => state);
  // Se redibuja también cuando el idioma cambia desde otro lado (Configuración, pruebas).
  const language = useLanguage() as Language;
  if (!s.renderId) return null;
  return (
    <WelcomeScreen
      key={s.renderId}
      texts={ww()}
      language={language}
      version={s.info.version}
      recents={s.info.recents}
      recovery={s.recovery ? { title: s.recovery.title, pages: s.recovery.pages.length } : null}
      canResume={hasDocument}
      onNew={() => {
        globalThis.hideWelcome();
        settings(true);
      }}
      onOpen={() => {
        globalThis.hideWelcome();
        openBook();
      }}
      onDemo={startDemo}
      onHelp={() => globalThis.openHelp()}
      onResume={() => globalThis.hideWelcome()}
      onRecover={recover}
      onDiscardRecovery={() => void discardRecovery()}
      onOpenRecent={(project) => void openRecentProject(project)}
      onLanguage={(value: Language) => {
        LibroI18n.set(value);
        globalThis.showWelcome();
      }}
    />
  );
};
flushSync(() => {
  mount(welcome, <WelcomeRoot />);
});

// La copia de la última sesión se ofrece como fila de Recientes, no como diálogo.
extend.replace(
  'offerRecovery',
  async function () {
    try {
      const db = await recoveryDb(),
        request = db.transaction('books', 'readonly').objectStore('books').get('last');
      request.onsuccess = () => {
        db.close();
        if (request.result)
          try {
            recoveryCopy = M.validate(JSON.parse(request.result));
            if (welcomeVisible) globalThis.showWelcome();
          } catch {}
      };
    } catch {}
  },
  'welcome',
);
// La marca de la barra superior vuelve al Inicio (components/topbar/Topbar.tsx).
// La ayuda tiene una sola puerta: "Ayuda" en la barra superior (help-center.ts). El botón
// "Tutorial" de la barra del documento ya no existe; el tutorial se empieza desde la Ayuda.
document.addEventListener(
  'keydown',
  (e) => {
    if (welcomeVisible && e.ctrlKey && ['p', 's', 'z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
globalThis.showWelcome = showWelcome;
globalThis.hideWelcome = hideWelcome;
extend.result(
  'saveProject',
  async function (pending: Promise<unknown>) {
    const saved = await pending;
    if (saved && native)
      try {
        welcomeInfo = await nativeCall('appInfo');
      } catch {}
    return saved;
  },
  'welcome',
);
async function initializeWelcome(): Promise<void> {
  for (let i = 0; i < 100 && !native; i++) await new Promise((r) => setTimeout(r, 100));
  if (!native) return;
  try {
    welcomeInfo = await nativeCall('appInfo');
    // Versión del panel izquierdo, en el mismo formato que la bienvenida (v3.24.0).
    $('.version').textContent = 'v' + welcomeInfo.version;
    if (!welcomeInfo.selftest) await globalThis.showWelcome();
  } catch (error) {
    toast((error as Error).message, 'error');
  }
}
initializeWelcome();
