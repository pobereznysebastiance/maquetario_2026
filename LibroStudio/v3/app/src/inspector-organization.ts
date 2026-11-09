// Panel del objeto (pasada 'object' de la pestaña Selección): geometría, alineación,
// distribución, orden y bloqueo del elemento seleccionado. Saca de Libro, del texto y de Capas lo
// que ahora vive acá y lleva los atajos de herramientas (grilla, foliado, cornisa) a su sección
// por nombre, no por posición.
//
// distributeObjects es global porque la usa tests/inspector-organization-tests.js.
//
// Fuente TypeScript: se compila a build/inspector-organization.js (desktop/scripts/build.mjs).
import type { BookObject } from './model.ts';

declare global {
  /** Iguala los espacios entre tres o más objetos seleccionados, conservando los extremos. */
  var distributeObjects: (axis: 'x' | 'y') => void;
}

function editableObjectSelection(): BookObject[] {
  return book.pages[active].objects.filter(
    (o) =>
      (multiSelection.size ? multiSelection.has(o.id) : selected === o.id) &&
      !o.locked &&
      !o.hidden,
  );
}
function distributeObjects(axis: 'x' | 'y'): void {
  const objects = editableObjectSelection();
  if (objects.length < 3) return;
  const horizontal = axis === 'x',
    size = horizontal ? 'w' : 'h',
    sorted = objects.slice().sort((a, b) => a[axis] - b[axis]);
  const start = sorted[0][axis],
    end = sorted.at(-1)![axis] + sorted.at(-1)![size],
    total = sorted.reduce((n, o) => n + o[size], 0),
    gap = (end - start - total) / (sorted.length - 1);
  commit(() => {
    let pos = start;
    for (const o of sorted) {
      o[axis] = pos;
      pos += o[size] + gap;
    }
  }, false);
}
globalThis.distributeObjects = distributeObjects;
function objectInspector(): void {
  const host = $('#inspectorContent'),
    scroll = host.scrollTop,
    o = selectObject(),
    locked = !o || o.locked,
    objects = editableObjectSelection(),
    w = rw();
  host.innerHTML =
    section(
      bw('Objeto seleccionado', 'Selected object', 'Objeto selecionado'),
      'select',
      o
        ? `<div class="selection-chip">${icon(o.type === 'text' ? 'text' : o.type === 'image' ? 'image' : 'frame')} ${bw(o.type === 'text' ? 'Caja de texto' : o.type === 'image' ? 'Imagen' : 'Marco', o.type === 'text' ? 'Text frame' : o.type === 'image' ? 'Image' : 'Frame', o.type === 'text' ? 'Caixa de texto' : o.type === 'image' ? 'Imagem' : 'Quadro')}</div>${o.type === 'text' ? `${UI.button({ id: 'objectGoText', label: bw('Editar tipografía y párrafos →', 'Edit type and paragraphs →', 'Editar tipografia e parágrafos →'), wide: true })}` : ''}<p class="help">${bw('Estos controles modifican el elemento completo. La alineación del texto dentro de la caja está más abajo, en Párrafo y estilos.', 'These controls modify the whole element. Text alignment within the frame is further down, under Paragraphs and styles.', 'Estes controles alteram o elemento inteiro. O alinhamento do texto dentro da caixa fica mais abaixo, em Parágrafos e estilos.')}</p>`
        : `<p class="help">${bw('Seleccioná una caja, una imagen o un marco en la página.', 'Select a frame or image on the page.', 'Selecione uma caixa ou imagem na página.')}</p>`,
    ) +
    section(
      bw('Posición y tamaño', 'Position and size', 'Posição e tamanho'),
      'box',
      o
        ? `<div class="pair">${['x', 'y', 'w', 'h']
            .map(
              (key, i) =>
                `<div><label for="object-${key}">${bw(
                  ...(
                    [
                      ['Posición X', 'X position', 'Posição X'],
                      ['Posición Y', 'Y position', 'Posição Y'],
                      ['Ancho', 'Width', 'Largura'],
                      ['Alto', 'Height', 'Altura'],
                    ] as [string, string, string][]
                  )[i],
                )} · mm</label><input id="object-${key}" data-object-geometry="${key}" type="number" min="${key === 'w' || key === 'h' ? 1 : 0}" max="${key === 'x' || key === 'w' ? book.width : book.height}" step="0.5" value="${Number(o[key].toFixed(2))}" ${locked ? 'disabled' : ''}></div>`,
            )
            .join('')}</div>`
        : '',
    ) +
    section(
      w.alignObjects,
      'frame',
      `<div class="field-row"><label>${w.relative}</label><select id="alignReference"><option value="margins">${w.margins}</option><option value="page">${w.page}</option><option value="selection">${w.selection}</option></select></div><div class="object-alignment">${[
        ['left', w.xLeft],
        ['hcenter', w.xCenter],
        ['right', w.xRight],
        ['top', w.yTop],
        ['vcenter', w.yCenter],
        ['bottom', w.yBottom],
      ]
        .map(([key, label]) =>
          UI.textButton({ label, data: { objectAlign: key }, disabled: !objects.length }),
        )
        .join('')}</div><p class="help">${w.tip}</p>`,
    ) +
    section(
      bw('Distribuir objetos', 'Distribute objects', 'Distribuir objetos'),
      'grid',
      `<div class="page-action">${UI.button({ label: bw('Espacios horizontales', 'Horizontal gaps', 'Espaços horizontais'), data: { distribute: 'x' }, disabled: objects.length < 3 })}${UI.button({ label: bw('Espacios verticales', 'Vertical gaps', 'Espaços verticais'), data: { distribute: 'y' }, disabled: objects.length < 3 })}</div><p class="help">${bw('Seleccioná al menos tres elementos con Shift + clic. Iguala los espacios entre ellos conservando los extremos.', 'Shift-click at least three elements. Equalizes gaps while retaining the outer positions.', 'Selecione pelo menos três elementos com Shift + clique. Iguala os espaços mantendo os extremos.')}</p>`,
    ) +
    section(
      bw('Orden y bloqueo', 'Order and locking', 'Ordem e bloqueio'),
      'layers',
      o
        ? `<div class="page-action">${UI.button({ label: bw('Al frente', 'To front', 'Para frente'), data: { objectCommand: 'front' }, disabled: locked })}${UI.button({ label: bw('Al fondo', 'To back', 'Para trás'), data: { objectCommand: 'back' }, disabled: locked })}</div><label class="check-line"><input type="checkbox" id="objectLocked" ${o.locked ? 'checked' : ''}>${bw('Bloquear objeto', 'Lock object', 'Bloquear objeto')}</label><label class="check-line"><input type="checkbox" id="objectHidden" ${o.hidden ? 'checked' : ''}>${bw('Ocultar objeto', 'Hide object', 'Ocultar objeto')}</label>${UI.button({ label: bw('Eliminar objeto', 'Delete object', 'Excluir objeto'), variant: 'danger', wide: true, data: { objectCommand: 'deleteObject' }, disabled: locked })}`
        : '',
    );
  host.scrollTop = scroll;
  $('#alignReference').value = objectAlignReference;
  $('#alignReference').onchange = (e: Event) =>
    (objectAlignReference = (e.target as HTMLSelectElement).value);
  host
    .querySelectorAll<HTMLElement>('[data-object-align]')
    .forEach((b) => (b.onclick = () => alignSelection(b.dataset.objectAlign!)));
  host
    .querySelectorAll<HTMLElement>('[data-distribute]')
    .forEach((b) => (b.onclick = () => distributeObjects(b.dataset.distribute as 'x' | 'y')));
  host
    .querySelectorAll<HTMLElement>('[data-object-command]')
    .forEach((b) => (b.onclick = () => command(b.dataset.objectCommand!)));
  host.querySelectorAll<HTMLInputElement>('[data-object-geometry]').forEach(
    (input) =>
      (input.onchange = () => {
        const value = Number(input.value),
          key = input.dataset.objectGeometry!;
        if (
          !o ||
          o.locked ||
          !Number.isFinite(value) ||
          value < Number(input.min) ||
          value > Number(input.max)
        ) {
          objectInspector();
          return;
        }
        commit(() => {
          o[key] = value;
          if (o.x + o.w > book.width || o.y + o.h > book.height)
            throw Error(
              bw(
                'El objeto debe quedar dentro de la página.',
                'The object must stay inside the page.',
                'O objeto deve ficar dentro da página.',
              ),
            );
        }, false);
      }),
  );
  if ($('#objectGoText')) $('#objectGoText').onclick = () => showTab('text');
  if (o) {
    $('#objectLocked').onchange = (e: Event) =>
      commit(() => (o.locked = (e.target as HTMLInputElement).checked), false);
    $('#objectHidden').onchange = (e: Event) =>
      commit(() => (o.hidden = (e.target as HTMLInputElement).checked), false);
  }
  updateActivePage();
  updateSnapButton();
}
registerInspectorPanel('object', objectInspector, 'inspector-organization');
decorateInspector(() => {
  if (tab === 'object') return;
  const host = $('#inspectorContent');
  if (tab === 'design') {
    host.querySelector('[data-object="font"]')?.closest('.section')?.remove();
  }
  if (tab === 'text') {
    host.querySelector('[data-section="Transformar objeto"]')?.remove();
    host.querySelector('#alignReference')?.closest('.section')?.remove();
    // La ayuda de edición sobra: medidas y alineación están arriba, en la misma pestaña Selección.
    host.querySelector('[data-section="Edición"]')?.remove();
  }
  if (tab === 'layers') {
    host.querySelector('#alignReference')?.closest('.section')?.remove();
    host.querySelector('#layerWidth')?.closest('.pair')?.remove();
  }
}, 'inspector-organization');
// Los atajos de herramientas buscan su sección por nombre, no por una posición numérica frágil.
extend.instead(
  'setTool',
  (name: string) => ['grid', 'folio', 'header'].includes(name),
  function (name: 'grid' | 'folio' | 'header') {
    finishEditing();
    showTab('design');
    const key = { grid: 'Grilla', folio: 'Foliado', header: 'Cornisa' }[name];
    $(`#inspectorContent [data-section="${key}"]`)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
    tool = 'select';
  },
  'inspector-organization',
);
extend.after(
  'setTool',
  function (name: string) {
    if (name === 'image' || name === 'frame') showTab('object');
  },
  'inspector-organization',
);
extend.before(
  'objectDown',
  function (e: PointerEvent, o: BookObject) {
    if (o.type !== 'text' && tab === 'text' && !o.locked) showTab('object');
  },
  'inspector-organization',
);
document.addEventListener('maquetario:language', () => {
  inspector();
});
const alignLesson = guideLessons.find((l) => l.id === 'align-objects');
if (alignLesson) {
  alignLesson.tab = 'object';
  alignLesson.body = alignLesson.body.map((text, i) =>
    text.replace(
      ['Texto y Capas', 'Text and Layers', 'Texto e Camadas'][i],
      ['Objeto', 'Object', 'Objeto'][i],
    ),
  );
}
inspector();
