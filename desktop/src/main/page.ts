// El proceso principal le habla a la página sólo por el contrato (window.maquetarioMain y, en la
// autoprueba, window.maquetarioTests): LibroStudio/v3/app/src/contract/page-contract.ts. Estas
// funciones arman la expresión con el nombre verificado por TypeScript y los argumentos en JSON.
//
//   await callMain(session, 'prepareOutput', options)     → maquetarioMain.prepareOutput({...})
//   await waitFor(session, mainExpression('outputReady'), 100, 100)
import type {
  MaquetarioMainApi,
  MaquetarioTestsApi,
} from '../../../LibroStudio/v3/app/src/contract/page-contract.ts';
import { exec, type Session } from './session.ts';

type Callable<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never;
}[keyof T];
type Args<T, K extends keyof T> = T[K] extends (...args: infer A) => unknown ? A : never;
type Result<T, K extends keyof T> = T[K] extends (...args: never[]) => infer R ? Awaited<R> : never;

const call = (object: string, name: string, args: unknown[]) =>
  `${object}.${name}(${args.map((a) => JSON.stringify(a)).join(',')})`;

/** Expresión que llama a maquetarioMain.name(...args). */
export const mainExpression = <K extends Callable<MaquetarioMainApi>>(
  name: K,
  ...args: Args<MaquetarioMainApi, K>
): string => call('window.maquetarioMain', name, args);

/** Igual, pero no falla si la página todavía no publicó el contrato (da undefined). */
export const mainExpressionIfLoaded = <K extends Callable<MaquetarioMainApi>>(
  name: K,
  ...args: Args<MaquetarioMainApi, K>
): string => call('window.maquetarioMain?', name, args);

/** Llama a maquetarioMain.name(...args) en la página y espera el resultado. */
export const callMain = <K extends Callable<MaquetarioMainApi>>(
  session: Session,
  name: K,
  ...args: Args<MaquetarioMainApi, K>
): Promise<Result<MaquetarioMainApi, K>> => exec(session, mainExpression(name, ...args));

/** Expresión que llama a una prueba de la interfaz: maquetarioTests.name(...args). */
export const testsExpression = <K extends Callable<MaquetarioTestsApi>>(
  name: K,
  ...args: Args<MaquetarioTestsApi, K>
): string => call('window.maquetarioTests', name, args);
