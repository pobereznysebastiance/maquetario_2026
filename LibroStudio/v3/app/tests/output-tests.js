// Pruebas de output.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (result) {
  const assert = (v, m) => {
    if (!v) throw Error(m);
    result.checks.push(m);
  };
  const clean = {
    mode: 'reading',
    paper: 'book',
    fit: true,
    crop: false,
    grid: false,
    guides: false,
    margins: false,
    headers: true,
    folios: true,
  };
  let g = prepareOutput(clean);
  assert(g.width === maquetarioEditor.book.width, 'PDF sin marcas conserva formato');
  assert(
    !$('#printRoot .crop-marks') && !$('#printRoot .output-guides'),
    'Salida limpia sin guías',
  );
  const marked = { ...clean, crop: true, grid: true, guides: true, margins: true };
  g = prepareOutput(marked);
  assert(
    g.width === maquetarioEditor.book.width + 14 && g.height === maquetarioEditor.book.height + 14,
    'Espacio exterior para marcas de corte',
  );
  assert(
    !!$('#printRoot .crop-marks') && !!$('#printRoot .output-guides'),
    'Marcas y grilla en salida',
  );
  g = prepareOutput({ ...marked, mode: 'booklet', paper: 'A4' });
  assert(g.faces === 4 && g.width === 297 && g.height === 210, 'Cuadernillo A4 de cuatro caras');
  assert(
    $('#printRoot .output-sheet').querySelectorAll('.print-artwork').length === 1,
    'Cuadernillo conserva páginas en blanco',
  );
  clearPrint();
  result.checks.push('Botón Imprimir disponible');
  return result;
}, 'output');

window.prepareMarkedOutputTest = function () {
  return prepareOutput({
    mode: 'reading',
    paper: 'book',
    fit: true,
    crop: true,
    grid: true,
    guides: true,
    margins: true,
    headers: true,
    folios: true,
  });
};
