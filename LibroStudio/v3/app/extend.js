// Registro de extensiones de funciones globales.
//
// Antes, cada módulo hacía:   const anterior = inspector; inspector = function () { anterior(); … };
// Ahora declara:              extend('inspector', (anterior) => function () { anterior(); … }, 'módulo');
//
// El resultado es el mismo (cada extensión envuelve a la anterior, en orden de carga), pero:
// - ninguna pieza reasigna la función global: la instala este registro una sola vez;
// - la lista de extensiones de cada función se puede consultar (MaquetarioExtensions.list());
// - es el paso previo para convertir las extensiones en paneles y decoradores con nombre.
(function () {
  'use strict';
  const registry = new Map();

  function extend(name, factory, origin = '') {
    let entry = registry.get(name);
    if (!entry) {
      const base = window[name];
      if (typeof base !== 'function') throw new Error(`extend: "${name}" no es una función global`);
      entry = { base, factories: [], composed: base };
      registry.set(name, entry);
      window[name] = function (...args) {
        return entry.composed.apply(this, args);
      };
    }
    entry.factories.push({ factory, origin });
    entry.composed = factory(entry.composed);
  }

  window.extend = extend;
  window.MaquetarioExtensions = Object.freeze({
    list: () => Object.fromEntries([...registry].map(([name, e]) => [name, e.factories.map((f) => f.origin)])),
  });
})();
