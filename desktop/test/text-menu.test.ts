import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spellCheckerLanguages, textMenuTemplate } from '../src/main/text-menu.ts';

const flags = {
  canUndo: true,
  canRedo: false,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: false,
};
const params = (over: Partial<Parameters<typeof textMenuTemplate>[0]> = {}) => ({
  isEditable: true,
  misspelledWord: '',
  dictionarySuggestions: [] as string[],
  selectionText: '',
  editFlags: flags,
  ...over,
});
const labels = (items: ReturnType<typeof textMenuTemplate>) =>
  items.map((item) => (item.type === 'separator' ? '—' : item.label));

test('en un campo: deshacer, cortar, copiar, pegar y seleccionar todo, en castellano', () => {
  assert.deepEqual(labels(textMenuTemplate(params(), 'es', null)), [
    'Deshacer',
    'Rehacer',
    '—',
    'Cortar',
    'Copiar',
    'Pegar',
    '—',
    'Seleccionar todo',
  ]);
});

test('con una palabra mal escrita: primero las sugerencias y agregar al diccionario', () => {
  const items = textMenuTemplate(
    params({ misspelledWord: 'tipografia', dictionarySuggestions: ['tipografía', 'topografía'] }),
    'es',
    null,
  );
  assert.deepEqual(labels(items).slice(0, 4), [
    'tipografía',
    'topografía',
    'Agregar al diccionario',
    '—',
  ]);
});

test('sin sugerencias lo dice, y en portugués usa sus palabras', () => {
  const items = textMenuTemplate(params({ misspelledWord: 'xyz' }), 'pt', null);
  assert.equal(items[0]!.label, 'Sem sugestões');
  assert.equal(items[0]!.enabled, false);
  assert.ok(labels(items).includes('Colar'));
});

test('texto elegido que no se edita: sólo copiar; nada elegido: sin menú', () => {
  assert.deepEqual(
    labels(textMenuTemplate(params({ isEditable: false, selectionText: 'Hola' }), 'es', null)),
    ['Copiar'],
  );
  assert.equal(textMenuTemplate(params({ isEditable: false }), 'es', null).length, 0);
});

test('idiomas del corrector: el castellano que haya y el inglés', () => {
  assert.deepEqual(spellCheckerLanguages(['en-US', 'es-ES', 'fr']), ['es-ES', 'en-US']);
  assert.deepEqual(spellCheckerLanguages(['es-CL', 'de']), ['es-CL']);
  assert.deepEqual(spellCheckerLanguages(['fr']), []);
});
