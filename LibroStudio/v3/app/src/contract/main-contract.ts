// Publica window.maquetarioMain: lo que el proceso principal le pide a la página (el contrato
// está en page-contract.ts). Cada función llama al global de la app en el momento, igual que
// antes las cadenas del proceso principal: así pasa por las extensiones que tenga.
//
// Lo importa src/entries/app.ts al final: el contrato tiene que existir cuando el proceso
// principal pregunta si la interfaz está lista (ready).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { MaquetarioMainApi, OutputOptions, OutputPage } from './page-contract.ts';

declare global {
  /** El contrato con el proceso principal (src/contract/page-contract.ts). */
  var maquetarioMain: MaquetarioMainApi;
}

const maquetarioMain: MaquetarioMainApi = {
  ready: () =>
    globalThis.native === true &&
    typeof globalThis.loadOpenedProject === 'function' &&
    typeof confirmChanges === 'function',
  welcomeVisible: () => globalThis.welcomeVisible === true,
  // Es el mismo recorrido que un reciente (welcome-service.tsx → openRecentProject): con cambios
  // sin guardar pregunta antes (confirmChanges), cierra la bienvenida y carga con
  // loadOpenedProject, como Abrir (src/core/project-file.ts → openBook).
  openRequested: () => {
    const run = async () => {
      try {
        const result = await nativeCall('openRequested', {});
        if (!result) return;
        globalThis.hideWelcome?.();
        loadOpenedProject(result);
      } catch (error) {
        toast((error as Error).message, 'error');
      }
    };
    if (globalThis.dirty) {
      globalThis.hideWelcome?.();
      confirmChanges(run, 'open');
    } else void run();
  },
  requestCloseConfirmation: () => {
    if (typeof globalThis.requestCloseConfirmation !== 'function') return false;
    globalThis.requestCloseConfirmation();
    return true;
  },
  showBusyCloseNotice: () => globalThis.showBusyCloseNotice(),
  updateAvailable: (update) => globalThis.maquetarioUpdateAvailable?.(update),

  bookTitle: () => globalThis.book.title,
  prepareOutput: (options) => globalThis.prepareOutput(options) as unknown as OutputPage | null,
  printTrim: (options) => {
    try {
      const o: OutputOptions = options || {};
      const book = globalThis.book;
      if (o.kind === 'cover') {
        if (!book.cover) return null;
        const c = book.cover,
          g = coverGeometry(c),
          wrap = c.wrap || 0;
        return { width: g.width + 2 * wrap, height: g.height + 2 * wrap, bleed: c.bleed || 0 };
      }
      const g = outputGeometry(o);
      return { width: book.width * g.columns, height: book.height * g.rows, bleed: 0 };
    } catch {
      return null;
    }
  },
  outputReady: () =>
    window.outputReady === true &&
    window.fontOutputReady !== false &&
    window.shapeOutputReady !== false &&
    window.composeOutputReady !== false,
  composeOutputReady: () => window.composeOutputReady !== false,
  preparePrint: () => window.preparePrint(),
  prepareIndexPrint: () => window.prepareIndexPrint(),
  clearPrint: () => window.clearPrint(),
  closeOutputWindow: () => window.closeOutputWindow(),

  setSelfTest: (on) => {
    window.maquetarioSelfTest = on;
  },
  get editor() {
    return globalThis.maquetarioEditor as unknown as Record<string, any>;
  },
  extensions: () => MaquetarioExtensions.list(),
  get workspace() {
    return MaquetarioWorkspace;
  },
  get rulers() {
    return MaquetarioRulers;
  },
  showHandlePreview: () => window.showHandlePreview(),
  prepareNovelProof: () => window.prepareNovelProof(),
  novelProofContent: () => window.novelProofContent(),
  prepareNovelPdf: () => window.prepareNovelPdf(),
  showWelcome: () => showWelcome(),
  hideWelcome: () => hideWelcome(),
  showTab: (name) => showTab(name),
  openSettings: (section) => openSettings(section),
  settingsNew: (sample) => settingsNew(sample),
  closeSheet: () => closeSheet(),
  confirmAction: (request) => confirmAction(request),
  startTutorial: (index) => window.startTutorial(index),
  composeActivate: () => composeActivate(),
  composeReport: () => composeReport(),
  composePdfLayout: () => composePdfLayout(),
};

globalThis.maquetarioMain = maquetarioMain;
