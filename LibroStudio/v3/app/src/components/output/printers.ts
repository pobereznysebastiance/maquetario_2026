// Impresoras de la ventana de salida: la lista que informa el anfitrión y cuál está elegida.
// readPrinters (output.ts) la carga; el selector (OutputWindow.tsx, PrinterRow) la dibuja.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

/** Impresora tal como la informa el anfitrión. */
export interface InstalledPrinter {
  name: string;
  defaultPrinter: boolean;
  duplex: boolean;
}

export interface PrintersState {
  /** Cambia con cada carga: el selector se vuelve a armar con la elegida. */
  version: number;
  /** null mientras se buscan. */
  list: InstalledPrinter[] | null;
  /** La que queda elegida al cargar (la que estaba elegida, o la predeterminada). */
  selected: string;
}

let state: PrintersState = { version: 0, list: null, selected: '' };
const listeners = new Set<() => void>();

export const printersSnapshot = (): PrintersState => state;
export const subscribePrinters = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function setPrinters(next: Partial<PrintersState>): void {
  state = { ...state, ...next, version: state.version + 1 };
  listeners.forEach((listener) => listener());
}
