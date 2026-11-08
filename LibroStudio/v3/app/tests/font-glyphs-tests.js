// Pruebas de font-glyphs.js: sólo se cargan en la autoprueba (test-loader.js), no van en el instalador.

registerFontTest(async function (r) {
  const face = chooseDefaultFace('Georgia') || nativeFaces[0],
    result = await nativeCall('fontGlyphs', { fontId: face.id });
  if (!result.points.includes(65) || result.points.includes(0))
    throw Error('Mapa de caracteres incorrecto');
  r.checks.push('Mapa real de fuente incluye A y excluye controles');
  await showFontGlyphs(face);
  if (!$('#fontGlyphGrid [data-real-glyph="65"]')) {
    glyphPoints = result.points;
    $('#glyphSearch').value = 'U+0041';
    renderGlyphGrid();
  }
  if (!$('#fontGlyphGrid [data-real-glyph="65"]')) throw Error('Glifo A no visible');
  r.checks.push('Paleta muestra glifo real y búsqueda Unicode');
  $('#modal').close();
  return r;
}, 'font-glyphs');
