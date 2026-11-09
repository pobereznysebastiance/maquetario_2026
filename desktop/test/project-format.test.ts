// Formato del proyecto (.mqt): migraciones de versión antes de validar
// (LibroStudio/v3/app/src/model-migrations.ts y M.validate en model.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkProjectVersion,
  CURRENT_VERSION,
  type Migration,
  migrateProject,
  migrationPath,
  MIGRATIONS,
  NEWER_PROJECT_ERROR,
  UNKNOWN_PROJECT_ERROR,
} from '../../LibroStudio/v3/app/src/model-migrations.ts';
// El modelo se publica como globalThis.LibroModel (en la app, M); no toca la pantalla.
import '../../LibroStudio/v3/app/src/model.ts';

const { validate, create } = globalThis.LibroModel;
const current = () => JSON.parse(JSON.stringify(create()));

test('un proyecto de la versión actual se valida igual que antes', () => {
  const project = current();
  assert.equal(project.version, CURRENT_VERSION);
  assert.equal(migrateProject(project), project, 'sin pasos, no copia ni cambia nada');
  assert.deepEqual(validate(project), project);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(project))), project);
});

test('hoy no hay pasos y la versión actual es la 3', () => {
  assert.equal(CURRENT_VERSION, 3);
  assert.deepEqual(MIGRATIONS, []);
});

test('un proyecto de una versión más nueva da un error claro y no se toca', () => {
  const future = { ...current(), version: CURRENT_VERSION + 1, nuevoCampo: { a: 1 } };
  const before = JSON.stringify(future);
  assert.throws(() => validate(future), { message: NEWER_PROJECT_ERROR });
  assert.throws(() => checkProjectVersion(future), { message: NEWER_PROJECT_ERROR });
  assert.match(NEWER_PROJECT_ERROR, /versión más nueva de Maquetario: actualizá el programa/);
  assert.equal(JSON.stringify(future), before);
});

test('lo que no es un proyecto, o una versión sin camino, sigue rechazándose', () => {
  for (const input of [
    null,
    undefined,
    [],
    'texto',
    {},
    { version: '3' },
    { version: 0 },
    { version: 2.5 },
    { ...current(), version: 2 },
  ])
    assert.throws(() => validate(input), { message: UNKNOWN_PROJECT_ERROR }, JSON.stringify(input));
});

test('los pasos se aplican en orden hasta la versión actual, sobre una copia', () => {
  const steps: Migration[] = [
    {
      from: 1,
      to: 2,
      describe: 'el título pasa a llamarse title',
      migrate: (p) => {
        p.title = p.titulo;
        delete p.titulo;
      },
    },
    {
      from: 2,
      to: 3,
      describe: 'las páginas pasan a una lista con id',
      migrate: (p) => ({
        ...p,
        pages: p.paginas.map((id: string) => ({ id })),
        paginas: undefined,
      }),
    },
  ];
  const old = { version: 1, titulo: 'Viejo', paginas: ['a', 'b'] };
  assert.deepEqual(
    migrationPath(old, steps, 3).map((s) => `${s.from}→${s.to}`),
    ['1→2', '2→3'],
  );
  const migrated = migrateProject(old, steps, 3);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.title, 'Viejo');
  assert.deepEqual(migrated.pages, [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(
    old,
    { version: 1, titulo: 'Viejo', paginas: ['a', 'b'] },
    'el original no cambia',
  );
  assert.equal(migrateProject({ version: 2, paginas: [] }, steps, 3).version, 3, 'desde el medio');
  assert.throws(() => migrateProject({ version: 4 }, steps, 3), { message: NEWER_PROJECT_ERROR });
  assert.throws(() => migrateProject({ version: 1 }, [steps[1]!], 3), {
    message: UNKNOWN_PROJECT_ERROR,
  });
});

test('un paso de ejemplo de la versión actual a la siguiente produce un proyecto válido', () => {
  const next = CURRENT_VERSION + 1;
  const steps: Migration[] = [
    {
      from: CURRENT_VERSION,
      to: next,
      describe: 'unidad de medida explícita',
      migrate: (p) => {
        p.measurementUnit = p.measurementUnit ?? 'mm';
      },
    },
  ];
  const migrated = migrateProject(current(), steps, next);
  assert.equal(migrated.version, next);
  assert.equal(migrated.measurementUnit, 'mm');
  // Validado con las reglas de hoy, salvo la versión, que es la del ejemplo.
  assert.equal(validate({ ...migrated, version: CURRENT_VERSION }).measurementUnit, 'mm');
});
