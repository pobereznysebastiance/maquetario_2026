// Contrato entre la página y el proceso principal (desktop/src/main): lo único que el proceso
// principal nombra en el código que evalúa en la página (executeJavaScript). Son dos objetos:
//
//   window.maquetarioMain   lo publica la app (src/contract/main-contract.ts). Lo usan main.ts,
//                           open-file.ts, handlers/output.ts, handlers/package.ts y selftest.ts.
//   window.maquetarioTests  lo arma test-loader.js con las pruebas de tests/; sólo existe en la
//                           autoprueba (el programa distribuido no trae las pruebas).
//
// Fuera de estos dos objetos, el proceso principal no nombra globales de la página (sólo el DOM,
// con document.querySelector). scripts/globals-report.mjs lo controla: cada maquetarioMain.x y
// maquetarioTests.x de las cadenas tiene que estar en estas interfaces.
//
// Este archivo sólo tiene tipos y no depende de nada de la app: lo importan las dos partes
// (import type). Cambiar un nombre acá rompe la compilación de las dos.

/** Tamaño de página de la salida en mm (prepareOutput). */
export interface OutputPage {
  width: number;
  height: number;
  /** Escala del libro en la hoja (1 = tamaño real). */
  scale?: number;
  [extra: string]: unknown;
}

/** Corte y sangrado de una salida, en mm (printTrim). */
export interface OutputTrim {
  width: number;
  height: number;
  bleed: number;
}

/** Opciones de una salida, como las arma el proceso principal o la autoprueba. */
export type OutputOptions = Record<string, unknown>;

/** Espacios de trabajo (src/workspace.ts), lo que usa la autoprueba. */
export interface WorkspaceControl {
  mode(): string;
  setMode(mode: 'default' | 'simple' | 'custom'): void;
  setVisible(id: string, visible: boolean): void;
  toggleMenu(): void;
}

/** Confirmación simple (src/components/dialog/dialogs.tsx). */
export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

/** Lo que el proceso principal le pide a la página. */
export interface MaquetarioMainApi {
  // ── Arranque y proyectos (main.ts, open-file.ts) ──
  /** La interfaz ya puede abrir proyectos: anfitrión nativo, puente de proyectos y avisos listos. */
  ready(): boolean;
  /** La bienvenida está a la vista. */
  welcomeVisible(): boolean;
  /** Abre el proyecto que pidió el sistema (doble clic en un .mqt), como un reciente. */
  openRequested(): void;
  /** Aviso de cierre con cambios sin guardar; false si la interfaz todavía no lo puede mostrar. */
  requestCloseConfirmation(): boolean;
  /** Aviso de que no se puede cerrar mientras hay una salida en curso. */
  showBusyCloseNotice(): void;
  /** Hay una versión nueva (Motiova). */
  updateAvailable(update: { version?: string } | null | undefined): void;

  // ── Salida (handlers/output.ts, handlers/package.ts) ──
  /** Título del libro abierto. */
  bookTitle(): string;
  /** Arma las hojas de salida en #printRoot; devuelve el tamaño de página. */
  prepareOutput(options: OutputOptions): OutputPage | null;
  /** Corte y sangrado de esa salida (null si no corresponde). */
  printTrim(options: OutputOptions): OutputTrim | null;
  /** Imágenes, fuentes, figuras y motor de composición listos para imprimir. */
  outputReady(): boolean;
  /** Con el motor de composición prendido, todos los párrafos compuestos (si no, true). */
  composeOutputReady(): boolean;
  /** Prepara la salida de lectura (formato libro). */
  preparePrint(): boolean;
  /** Prepara el PDF del índice. */
  prepareIndexPrint(): void;
  /** Saca las hojas de salida de #printRoot. */
  clearPrint(): void;
  /** Cierra la ventana de salida abierta. */
  closeOutputWindow(): void;

  // ── Autoprueba (selftest.ts) ──
  /** Las confirmaciones no esperan respuesta (eligen la primera acción). */
  setSelfTest(on: boolean): void;
  /** El estado del editor (src/state/editor.ts): book, tool, active… */
  readonly editor: Record<string, any>;
  /** Qué módulo extiende cada función y en qué orden (MaquetarioExtensions.list). */
  extensions(): Record<string, string[]>;
  readonly workspace: WorkspaceControl;
  readonly rulers: { isVisible(): boolean; setVisible(value: boolean): void };
  showHandlePreview(): void;
  prepareNovelProof(): string;
  novelProofContent(): string;
  prepareNovelPdf(): void;
  showWelcome(): Promise<void>;
  hideWelcome(): void;
  showTab(name: string): void;
  openSettings(section?: string): Promise<void>;
  /** Libro nuevo (o de muestra); la promesa se cumple al cerrar la Hoja. */
  settingsNew(sample?: boolean): Promise<unknown> | unknown;
  closeSheet(): void;
  confirmAction(request: ConfirmRequest): Promise<boolean>;
  startTutorial(index?: number): void;
  composeActivate(): Promise<void>;
  composeReport(): Promise<unknown>;
}

/** Las pruebas de la interfaz (tests/), como las junta test-loader.js. */
export interface MaquetarioTestsApi {
  /** true: todas cargadas · 'missing': el paquete no trae pruebas. */
  readonly ready: true | 'missing';
  runIntegrationTests(): unknown;
  runFontIntegrationTests(): Promise<unknown>;
  runAssistantTests(): Promise<unknown>;
  runNavigationTests(): Promise<unknown>;
  runNoticeTests(): Promise<unknown>;
  prepareMarkedOutputTest(): unknown;
  prepareFontPdfTest(): unknown;
  prepareParagraphPdfTest(): unknown;
  prepareCoverProof(): unknown;
  preparePackageProof(faceId: string): string;
  prepareOutputReviewPreview(): unknown;
  prepareFontBrowserPreview(): unknown;
  prepareAssistantPreview(): unknown;
  prepareGlossaryPreview(): unknown;
}
