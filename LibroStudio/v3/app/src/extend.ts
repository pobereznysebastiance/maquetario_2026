// Registro de extensiones de funciones globales.
//
// Antes, cada módulo hacía:   const anterior = inspector; inspector = function () { anterior(); … };
// Ahora declara:              extend('inspector', (anterior) => function () { anterior(); … }, 'módulo');
//
// El resultado es el mismo (cada extensión envuelve a la anterior, en orden de carga), pero:
// - ninguna pieza reasigna la función global: la instala este registro una sola vez;
// - la lista de extensiones de cada función se puede consultar (MaquetarioExtensions.list());
// - es el paso previo para convertir las extensiones en paneles y decoradores con nombre.
//
// extend.replace(name, fn, origin) reemplaza la función entera (lo anterior ya no corre).
// extend.around(name, factory, origin) envuelve la cadena completa y queda siempre por fuera,
// aunque se registren extensiones después. Sus fábricas se vuelven a llamar cada vez que la
// cadena cambia, así que no deben tener efectos al construirse.
//
// Fuente TypeScript: se compila a build/extend.js (desktop/scripts/build.mjs).

export type AnyFunction = (this: any, ...args: any[]) => any;
/** Recibe la función como está hasta ahora y devuelve la que la reemplaza (normalmente, envolviéndola). */
export type Factory = (previous: AnyFunction) => AnyFunction;

interface Entry {
  base: AnyFunction;
  factories: { factory: Factory; origin: string }[];
  arounds: { factory: Factory; origin: string }[];
  inner: AnyFunction;
  composed: AnyFunction;
}

export interface Extend {
  (name: string, factory: Factory, origin?: string): void;
  /** Correr fn después de la función, con los mismos argumentos (lo que devuelve fn se descarta). */
  after(name: string, fn: AnyFunction, origin?: string): void;
  /** Correr fn antes de la función, con los mismos argumentos. */
  before(name: string, fn: AnyFunction, origin?: string): void;
  /** Ajustar lo que devuelve: fn(resultado, ...args) devuelve el resultado final. Con fn async, recibe la promesa. */
  result(name: string, fn: (result: any, ...args: any[]) => any, origin?: string): void;
  /** Una ruta: cuando when(...args) es verdadera, fn reemplaza a la función; si no, sigue la cadena. */
  instead(name: string, when: AnyFunction, fn: AnyFunction, origin?: string): void;
  /** Reemplazo completo: lo anterior de la cadena ya no corre; lo que se registre después envuelve a fn. */
  replace(name: string, fn: AnyFunction, origin?: string): void;
  /** Envoltura por fuera de toda la cadena, aunque se registren extensiones después. */
  around(name: string, factory: Factory, origin?: string): void;
}

const registry = new Map<string, Entry>();
const globals = window as unknown as Record<string, unknown>;

function entryFor(name: string): Entry {
  let entry = registry.get(name);
  if (!entry) {
    const base = globals[name];
    if (typeof base !== 'function') throw new Error(`extend: "${name}" no es una función global`);
    const created: Entry = {
      base: base as AnyFunction,
      factories: [],
      arounds: [],
      inner: base as AnyFunction,
      composed: base as AnyFunction,
    };
    entry = created;
    registry.set(name, created);
    globals[name] = function (this: unknown, ...args: unknown[]) {
      return created.composed.apply(this, args);
    };
  }
  return entry;
}

function recompose(entry: Entry): void {
  entry.composed = entry.arounds.reduce((fn, a) => a.factory(fn), entry.inner);
}

const extend = function (name: string, factory: Factory, origin = '') {
  const entry = entryFor(name);
  entry.factories.push({ factory, origin });
  entry.inner = factory(entry.inner);
  recompose(entry);
} as Extend;

extend.after = (name, fn, origin = '') =>
  extend(
    name,
    (previous) =>
      function (...args) {
        const result = previous.apply(this, args);
        fn.apply(this, args);
        return result;
      },
    origin,
  );

extend.before = (name, fn, origin = '') =>
  extend(
    name,
    (previous) =>
      function (...args) {
        fn.apply(this, args);
        return previous.apply(this, args);
      },
    origin,
  );

extend.result = (name, fn, origin = '') =>
  extend(
    name,
    (previous) =>
      function (...args) {
        return fn.call(this, previous.apply(this, args), ...args);
      },
    origin,
  );

extend.instead = (name, when, fn, origin = '') =>
  extend(
    name,
    (previous) =>
      function (...args) {
        return (when.apply(this, args) ? fn : previous).apply(this, args);
      },
    origin,
  );

extend.replace = (name, fn, origin = '') => extend(name, () => fn, origin);

extend.around = function (name, factory, origin = '') {
  const entry = entryFor(name);
  entry.arounds.push({ factory, origin });
  recompose(entry);
};

declare global {
  var extend: Extend;
  var MaquetarioExtensions: Readonly<{ list(): Record<string, string[]> }>;
}
globalThis.extend = extend;
globalThis.MaquetarioExtensions = Object.freeze({
  list: () =>
    Object.fromEntries(
      [...registry].map(([name, e]) => [
        name,
        [...e.factories.map((f) => f.origin), ...e.arounds.map((a) => `${a.origin} (envoltura)`)],
      ]),
    ),
});
