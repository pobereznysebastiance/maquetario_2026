// Átomo: selector de una fila.
// Con el selector personalizable de Chromium (appearance: base-select), el valor elegido se dibuja en
// una parte interna que el CSS no alcanza: un valor largo pasaba por debajo de la flecha. Acá cada
// selector de la interfaz recibe su <button><selectedcontent>, que sí se puede estilizar (field.css lo
// corta con puntos suspensivos). Los selectores se arman con innerHTML en muchos módulos: un
// observador se lo agrega a los nuevos y a los que pierden el botón al rehacer sus opciones.
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

const ZONES =
  '.topbar, .leftpanel, .documentbar, .template-panel, .statusbar, .inspector, #modal, dialog, .welcome-footer, .tutorial-card';

const fit = (select: HTMLSelectElement): void => {
  if (
    select.multiple ||
    select.size > 1 ||
    select.firstElementChild?.tagName === 'BUTTON' ||
    !select.closest(ZONES)
  )
    return;
  const button = document.createElement('button');
  button.append(document.createElement('selectedcontent'));
  select.prepend(button);
};
const scan = (node: Node): void => {
  if (node instanceof HTMLSelectElement) fit(node);
  else if (node instanceof Element) node.querySelectorAll('select').forEach(fit);
};

new MutationObserver((records) => {
  for (const record of records) {
    if (record.target instanceof HTMLSelectElement) fit(record.target);
    record.addedNodes.forEach(scan);
  }
}).observe(document.body, { childList: true, subtree: true });
scan(document.body);
export {};
