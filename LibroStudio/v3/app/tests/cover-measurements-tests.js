// Pruebas de cover-measurements.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerIntegrationTest(function (r) {
  const c = defaultCover(),
    rows = coverMeasurementRows(c);
  if (rows.find((p) => p.id === 'front').pixelW !== Math.round((book.width / 25.4) * 300))
    throw Error('Conversión a píxeles');
  r.checks.push('Ficha de medidas calcula tamaño y píxeles de cada zona');
  if (
    !coverMeasurementText(c).includes(
      displayDimensions(
        book.width * 2 + c.spine + c.leftFlap + c.rightFlap + 2 * coverExtension(c),
        book.height + 2 * coverExtension(c),
      ),
    )
  )
    throw Error('Medida desplegado');
  r.checks.push('Ficha incluye desplegado y sangrado exterior');
  return r;
}, 'cover-measurements');
