import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import {
  hasRequestedProject,
  projectPathFromArgv,
  requestProject,
  takeRequestedProject,
} from '../src/main/open-file.ts';
import { MINIMUM, PREFERRED, windowSize } from '../src/main/window-size.ts';

const cwd = resolve('/proyectos');

test('toma el .mqt del argv de Windows al abrir con doble clic', () => {
  const file = join(cwd, 'Mi libro.mqt');
  assert.equal(projectPathFromArgv(['C:\\Maquetario\\Maquetario.exe', file], cwd), file);
});

test('saltea el ejecutable, las opciones y lo que no es un proyecto', () => {
  assert.equal(projectPathFromArgv(['electron', '.', '--dev'], cwd), null);
  assert.equal(
    projectPathFromArgv(['electron', '.', '--dev', '--capture-notice=x.mqt'], cwd),
    null,
  );
  assert.equal(projectPathFromArgv(['Maquetario.exe', 'notas.txt', 'libro.json'], cwd), null);
  assert.equal(projectPathFromArgv(['libro.mqt'], cwd), null, 'argv[0] es el ejecutable');
});

test('resuelve rutas relativas contra la carpeta de la segunda instancia', () => {
  const argv = [
    'Maquetario.exe',
    '--allow-file-access-from-files',
    '--original-process-start-time=1',
    'libros\\Novela.MQT',
  ];
  assert.equal(projectPathFromArgv(argv, cwd), resolve(cwd, 'libros\\Novela.MQT'));
});

test('acepta las extensiones viejas y se queda con la última', () => {
  const argv = ['Maquetario.exe', 'viejo.librostudio', 'otro.maquetario'];
  assert.equal(projectPathFromArgv(argv, cwd), resolve(cwd, 'otro.maquetario'));
});

test('la ruta pedida se entrega una sola vez', () => {
  assert.equal(hasRequestedProject(), false);
  requestProject('/a/uno.mqt');
  requestProject('/a/dos.mqt');
  assert.equal(hasRequestedProject(), true);
  assert.equal(takeRequestedProject(), '/a/dos.mqt');
  assert.equal(takeRequestedProject(), null);
  assert.equal(hasRequestedProject(), false);
});

test('en un monitor grande abre con el tamaño de siempre', () => {
  const { initial, minimum } = windowSize({ width: 2560, height: 1400 });
  assert.deepEqual(initial, PREFERRED);
  assert.deepEqual(minimum, MINIMUM);
});

test('en notebooks la ventana entra entera, también el mínimo', () => {
  for (const area of [
    { width: 1366, height: 728 }, // 1366 × 768 al 100 %
    { width: 1280, height: 672 }, // 1920 × 1080 al 150 %
    { width: 1536, height: 816 }, // 1920 × 1080 al 125 %
    { width: 1280, height: 752 }, // 1280 × 800
  ]) {
    const { initial, minimum } = windowSize(area);
    assert.ok(initial.width <= area.width && initial.height <= area.height, JSON.stringify(area));
    assert.ok(minimum.width <= initial.width && minimum.height <= initial.height);
    assert.deepEqual(minimum, MINIMUM);
  }
});

test('en una pantalla más chica que el mínimo, el mínimo se achica a la pantalla', () => {
  const { initial, minimum } = windowSize({ width: 1000, height: 600 });
  assert.deepEqual(minimum, { width: 1000, height: 600 });
  assert.deepEqual(initial, { width: 1000, height: 600 });
});
