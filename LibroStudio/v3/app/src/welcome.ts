// Pantalla de bienvenida: crear, abrir, ejemplo, tutorial, proyectos recientes y recuperación de
// la última sesión. También el botón de tutorial de la barra del documento y el logo como "Inicio".
//
// showWelcome y hideWelcome son globales: otros archivos las extienden por nombre
// (book-workflow.js, editorial-learning.js, review-workspace.js) y muchos las llaman. Por eso,
// dentro de este archivo se llaman siempre por globalThis: así corren con sus extensiones, como
// cuando este archivo era un script común. También son globales welcomeVisible (lo leen
// canvas-navigation.js y readability.js), welcome (el elemento: lo observa review-workspace.js) y
// ww (lo usa tests/welcome-tests.js).
//
// Fuente TypeScript: se compila a build/welcome.js (desktop/scripts/build.mjs).
import type { Language } from './i18n.ts';
import type { Book } from './model.ts';

/** Proyecto reciente que informa el anfitrión (appInfo). */
export interface RecentProject {
  name: string;
  path: string;
  modified: string | number;
  missing?: boolean;
}

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

const welcomeText: Record<string, Record<string, string>> = {
  es: {
    headline: 'Cada libro empieza\ncon una idea.',
    intro: 'Dale forma a tus páginas. Componé, ajustá y prepará tu libro para compartirlo.',
    recent: 'Proyectos recientes',
    empty: 'Tus proyectos aparecerán acá cuando los guardes o abras.',
    new: 'Crear un libro',
    open: 'Abrir proyecto',
    demo: 'Explorar el ejemplo',
    learn: 'Tutorial guiado',
    resume: 'Continuar en el editor',
    created: 'Creado por Sebastián Poberezny',
    missing: 'Archivo no disponible',
    recover: 'Recuperar la última sesión',
    home: 'Inicio',
    tutorial: 'Tutorial',
  },
  en: {
    headline: 'Every book begins\nwith an idea.',
    intro: 'Shape your pages. Compose, refine and prepare your book to share.',
    recent: 'Recent projects',
    empty: 'Your projects will appear here after you save or open them.',
    new: 'Create a book',
    open: 'Open project',
    demo: 'Explore the example',
    learn: 'Guided tutorial',
    resume: 'Continue editing',
    created: 'Created by Sebastián Poberezny',
    missing: 'File unavailable',
    recover: 'Recover last session',
    home: 'Home',
    tutorial: 'Tutorial',
  },
  pt: {
    headline: 'Todo livro começa\ncom uma ideia.',
    intro: 'Dê forma às suas páginas. Componha, ajuste e prepare seu livro para compartilhar.',
    recent: 'Projetos recentes',
    empty: 'Seus projetos aparecerão aqui depois de salvar ou abrir.',
    new: 'Criar um livro',
    open: 'Abrir projeto',
    demo: 'Explorar o exemplo',
    learn: 'Tutorial guiado',
    resume: 'Continuar no editor',
    created: 'Criado por Sebastián Poberezny',
    missing: 'Arquivo indisponível',
    recover: 'Recuperar a última sessão',
    home: 'Início',
    tutorial: 'Tutorial',
  },
};
const ww = () => welcomeText[globalThis.LibroI18n?.language || 'es'];
globalThis.ww = ww;
let welcomeInfo: WelcomeInfo = { version: '3.6.0', recents: [] };
globalThis.welcomeVisible = false;
let recoveryCopy: Book | null = null;
const welcome = document.createElement('section');
globalThis.welcome = welcome;
welcome.id = 'welcomeScreen';
welcome.setAttribute('aria-label', 'Maquetario');
welcome.hidden = true;
document.body.append(welcome);
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
  const w = ww();
  welcome.innerHTML = `<header class="welcome-header"><div class="welcome-brand"><img src="maquetario.svg" alt=""><strong>Maquetario</strong><span>v${welcomeInfo.version}</span></div></header><div class="welcome-body"><section class="welcome-copy"><h1>${w.headline.replace('\n', '<br>')}</h1><p class="welcome-intro">${w.intro}</p><div class="welcome-actions">${UI.button({ id: 'welcomeNew', variant: 'primary', icon: 'plus', label: w.new })}${UI.button({ id: 'welcomeOpen', icon: 'folder', label: w.open })}</div><div class="welcome-links">${UI.textButton({ id: 'welcomeTutorial', label: `${w.learn} ↗` })}${UI.textButton({ id: 'welcomeDemo', label: `${w.demo} ↗` })}${UI.textButton({ id: 'welcomeResume', label: `${w.resume} ↗` })}${recoveryCopy ? UI.textButton({ id: 'welcomeRecover', label: `${w.recover} ↗` }) : ''}</div><section class="welcome-recents"><div class="welcome-section-title"><h2>${w.recent}</h2></div><div id="recentProjects">${welcomeInfo.recents.length ? welcomeInfo.recents.map((r, i) => UI.recentProject({ data: { recent: i }, missing: r.missing, name: r.name, path: r.path, date: r.missing ? w.missing : new Date(r.modified).toLocaleDateString(LibroI18n.language === 'pt' ? 'pt-BR' : LibroI18n.language === 'en' ? 'en-US' : 'es-AR') })).join('') : `<div class="recent-empty">${icon('folder')}<p>${w.empty}</p></div>`}</div></section></section><aside class="welcome-art"><img src="assets/welcome-editorial-glass.png" alt="Atelier editorial de páginas y grillas"><div class="art-caption"><span>Maquetario</span><div class="art-swatches"><i></i><i></i><i></i></div></div></aside></div><footer class="welcome-footer"><span>${w.created}</span><span class="welcome-footer-end"><select id="welcomeLanguage" aria-label="Idioma"><option value="es">ES · Español</option><option value="en">EN · English</option><option value="pt">PT · Português</option></select><span>Maquetario v${welcomeInfo.version}</span></span></footer>`;
  welcomeVisible = true;
  welcome.hidden = false;
  document.body.classList.add('welcome-open');
  $('.topbar').inert = true;
  $('.app-layout').inert = true;
  $('#welcomeLanguage').value = LibroI18n.language;
  $('#welcomeLanguage').onchange = (e: Event) => {
    LibroI18n.set((e.target as HTMLSelectElement).value as Language);
    globalThis.showWelcome();
  };
  $('#welcomeNew').onclick = () => {
    globalThis.hideWelcome();
    settings(true);
  };
  $('#welcomeOpen').onclick = () => {
    globalThis.hideWelcome();
    openBook();
  };
  $('#welcomeResume').onclick = globalThis.hideWelcome;
  $('#welcomeDemo').onclick = () => {
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
  };
  $('#welcomeTutorial').onclick = () => {
    globalThis.hideWelcome();
    startTutorial();
  };
  // Qué pasa con la copia si no se recupera: queda en el equipo hasta el próximo cambio en un libro
  // (studio.ts → changed() la reemplaza a los 900 ms).
  if ($('#welcomeRecover') && recoveryCopy)
    $('#welcomeRecover').title = bw(
      `Abre la copia de recuperación de «${recoveryCopy.title}» (${recoveryCopy.pages.length} páginas). Si no la recuperás, queda guardada en este equipo hasta que crees o edites otro libro.`,
      `Opens the recovery copy of “${recoveryCopy.title}” (${recoveryCopy.pages.length} pages). If you don't recover it, it stays on this computer until you create or edit another book.`,
      `Abre a cópia de recuperação de “${recoveryCopy.title}” (${recoveryCopy.pages.length} páginas). Se você não recuperar, ela fica neste computador até você criar ou editar outro livro.`,
    );
  if ($('#welcomeRecover'))
    $('#welcomeRecover').onclick = () => {
      globalThis.hideWelcome();
      book = M.clone(recoveryCopy!);
      active = spread = 0;
      selected = null;
      dirty = true;
      syncNative();
      render(true);
      ensureBookFonts().then(renderPages);
    };
  $$('[data-recent]').forEach(
    (b) => (b.onclick = () => openRecentProject(welcomeInfo.recents[Number(b.dataset.recent)])),
  );
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
const brandHome = $('.brand');
brandHome.style.cursor = 'pointer';
brandHome.title = ww().home;
brandHome.onclick = () => globalThis.showWelcome();
const helpButton = UI.element(
  UI.quietButton({ id: 'tutorialButton', icon: 'help', label: ww().tutorial }),
);
helpButton.onclick = () => startTutorial();
$('.documentbar').append(helpButton);
document.addEventListener('maquetario:language', () => {
  helpButton.querySelector('span')!.textContent = ww().tutorial;
});
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
