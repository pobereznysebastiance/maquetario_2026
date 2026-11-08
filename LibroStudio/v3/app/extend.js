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
// extend.around(name, factory, origin) envuelve la cadena completa y queda siempre por fuera,
// aunque se registren extensiones después. Sus fábricas se vuelven a llamar cada vez que la
// cadena cambia, así que no deben tener efectos al construirse.
(function () {
  'use strict';
  const registry = new Map();

  function entryFor(name) {
    let entry = registry.get(name);
    if (!entry) {
      const base = window[name];
      if (typeof base !== 'function') throw new Error(`extend: "${name}" no es una función global`);
      entry = { base, factories: [], arounds: [], inner: base, composed: base };
      registry.set(name, entry);
      window[name] = function (...args) {
        return entry.composed.apply(this, args);
      };
    }
    return entry;
  }

  function recompose(entry) {
    entry.composed = entry.arounds.reduce((fn, a) => a.factory(fn), entry.inner);
  }

  function extend(name, factory, origin = '') {
    const entry = entryFor(name);
    entry.factories.push({ factory, origin });
    entry.inner = factory(entry.inner);
    recompose(entry);
  }

  // El caso más común: correr fn después de la función, con los mismos argumentos.
  // Devuelve lo que devolvía la función; lo que devuelva fn se descarta.
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

  // Ajustar lo que devuelve la función: fn(resultado, ...args) devuelve el resultado final
  // (normalmente el mismo objeto, modificado).
  extend.result = (name, fn, origin = '') =>
    extend(
      name,
      (previous) =>
        function (...args) {
          return fn.call(this, previous.apply(this, args), ...args);
        },
      origin,
    );

  // Una ruta: cuando when(...args) es verdadera, fn reemplaza a la función; si no, sigue la cadena.
  extend.instead = (name, when, fn, origin = '') =>
    extend(
      name,
      (previous) =>
        function (...args) {
          return (when.apply(this, args) ? fn : previous).apply(this, args);
        },
      origin,
    );

  extend.around = function (name, factory, origin = '') {
    const entry = entryFor(name);
    entry.arounds.push({ factory, origin });
    recompose(entry);
  };

  window.extend = extend;
  window.MaquetarioExtensions = Object.freeze({
    list: () =>
      Object.fromEntries(
        [...registry].map(([name, e]) => [
          name,
          [...e.factories.map((f) => f.origin), ...e.arounds.map((a) => `${a.origin} (envoltura)`)],
        ]),
      ),
  });
})();
