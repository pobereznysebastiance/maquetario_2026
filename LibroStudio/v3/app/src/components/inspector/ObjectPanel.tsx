// Inspector · Selección · objeto (etapa 3, D2, paso 7): el elemento elegido, su posición y
// tamaño, alinear, distribuir, orden y bloqueo; y el estado vacío "Nada seleccionado".
//
// objectInspector (inspector-organization.ts) deja los lugares de las cinco secciones, en su
// orden y con sus atributos (data-section, data-key), y los monta con mountInspectorSlot; el
// estado vacío lo deja inspector-views.ts. Mismo marcado que tenía en HTML, ya con la unidad
// dentro del campo (como lo dejaba unitsInsideFields): mismos ids, data-object-geometry,
// data-object-align, data-distribute, data-object-command y textos. La figura elegida le da su
// nombre a la etiqueta del objeto (antes lo cambiaba shapes.ts escribiendo en el nodo).
//
// Los campos graban con el "change" nativo (las pruebas disparan new Event('change'), que no
// sube). Los de posición y tamaño siguen al objeto: con cada aviso del editor (también mientras se
// arrastra o se estira en la página) toman el valor del objeto, salvo el que se está escribiendo.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLayoutEffect, useRef } from 'react';
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import { editableObjectSelection } from '../../inspector-organization.ts';
import { Icon } from '../Icon.tsx';

/** Encabezado de una sección (section() de studio.ts). */
const Heading = ({ icon, title }: { icon: string; title: string }) => (
  <div className="section-heading">
    <Icon name={icon} />
    <span>{title}</span>
  </div>
);

const bound = new WeakSet<Element>();
/** Escucha el "change" nativo de un campo (una sola vez por nodo). */
const onChange =
  <T extends HTMLInputElement | HTMLSelectElement>(handler: (el: T) => void) =>
  (el: T | null): void => {
    if (!el || bound.has(el)) return;
    bound.add(el);
    el.addEventListener('change', () => handler(el));
  };

const typeIcon = (type: string) =>
  type === 'text' ? 'text' : type === 'image' ? 'image' : 'frame';
const typeName = (type: string) =>
  bw(
    type === 'text' ? 'Caja de texto' : type === 'image' ? 'Imagen' : 'Marco',
    type === 'text' ? 'Text frame' : type === 'image' ? 'Image' : 'Frame',
    type === 'text' ? 'Caixa de texto' : type === 'image' ? 'Imagem' : 'Quadro',
  );

/** Objeto seleccionado: qué es (o qué figura) y, si es una caja de texto, el paso al texto. */
export const SelectedObjectPanel = () => {
  useEditorState();
  useLanguage();
  const o = selectObject();
  return (
    <>
      <Heading
        icon="select"
        title={bw('Objeto seleccionado', 'Selected object', 'Objeto selecionado')}
      />
      {o ? (
        <>
          <div className="selection-chip">
            {o.shape ? (
              <>
                <Icon name="frame" />
                {bw(...shapeNames[o.shape])}
              </>
            ) : (
              <>
                <Icon name={typeIcon(o.type)} />
                {' ' + typeName(o.type)}
              </>
            )}
          </div>
          {o.type === 'text' ? (
            <button
              type="button"
              id="objectGoText"
              className="btn wide"
              onClick={() => showTab('text')}
            >
              {bw(
                'Editar tipografía y párrafos →',
                'Edit type and paragraphs →',
                'Editar tipografia e parágrafos →',
              )}
            </button>
          ) : null}
          <p className="help">
            {bw(
              'Estos controles modifican el elemento completo. La alineación del texto dentro de la caja está más abajo, en Párrafo y estilos.',
              'These controls modify the whole element. Text alignment within the frame is further down, under Paragraphs and styles.',
              'Estes controles alteram o elemento inteiro. O alinhamento do texto dentro da caixa fica mais abaixo, em Parágrafos e estilos.',
            )}
          </p>
        </>
      ) : (
        <p className="help">
          {bw(
            'Seleccioná una caja, una imagen o un marco en la página.',
            'Select a frame or image on the page.',
            'Selecione uma caixa ou imagem na página.',
          )}
        </p>
      )}
    </>
  );
};

const GEOMETRY: ['x' | 'y' | 'w' | 'h', [string, string, string]][] = [
  ['x', ['Posición X', 'X position', 'Posição X']],
  ['y', ['Posición Y', 'Y position', 'Posição Y']],
  ['w', ['Ancho', 'Width', 'Largura']],
  ['h', ['Alto', 'Height', 'Altura']],
];
/** Valor que muestra el campo (en mm; document-units lo pasa a cm si hace falta). */
const shown = (value: number): string => String(Number(value.toFixed(2)));

/** Graba una medida del objeto; fuera de rango (o bloqueado), el campo vuelve a su valor. */
const saveGeometry = onChange<HTMLInputElement>((input) => {
  const o = selectObject(),
    value = Number(input.value),
    key = input.dataset.objectGeometry!;
  if (
    !o ||
    o.locked ||
    !Number.isFinite(value) ||
    value < Number(input.min) ||
    value > Number(input.max)
  ) {
    if (o) input.value = shown(o[key]);
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
});

/** Posición y tamaño: cuatro medidas que siguen al objeto. */
export const GeometryPanel = () => {
  const version = useEditorState();
  useLanguage();
  const o = selectObject(),
    locked = !o || o.locked;
  const pair = useRef<HTMLDivElement>(null);
  // Con cada aviso (mover o estirar en la página, deshacer…), los campos toman el valor del objeto.
  useLayoutEffect(() => {
    if (!o) return;
    for (const input of pair.current?.querySelectorAll<HTMLInputElement>(
      '[data-object-geometry]',
    ) ?? [])
      if (input !== document.activeElement) input.value = shown(o[input.dataset.objectGeometry!]);
  }, [version, o]);
  return (
    <>
      <Heading
        icon="box"
        title={bw('Posición y tamaño', 'Position and size', 'Posição e tamanho')}
      />
      {o ? (
        <div className="pair" ref={pair}>
          {GEOMETRY.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`object-${key}`}>{bw(...label)}</label>
              <span className="unit-wrap">
                <input
                  id={`object-${key}`}
                  data-object-geometry={key}
                  type="number"
                  min={key === 'w' || key === 'h' ? 1 : 0}
                  max={key === 'x' || key === 'w' ? book.width : book.height}
                  step="0.5"
                  defaultValue={shown(o[key])}
                  disabled={locked}
                  ref={saveGeometry}
                />
                <span className="unit">mm</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};

const chooseReference = onChange<HTMLSelectElement>(
  (select) => (objectAlignReference = select.value),
);

/** Alinear objetos: con los márgenes, la página o la selección. */
export const AlignPanel = () => {
  useEditorState();
  useLanguage();
  const w = rw(),
    none = !editableObjectSelection().length;
  return (
    <>
      <Heading icon="frame" title={w.alignObjects} />
      <div className="field-row">
        <label>{w.relative}</label>
        <select id="alignReference" defaultValue={objectAlignReference} ref={chooseReference}>
          <option value="margins">{w.margins}</option>
          <option value="page">{w.page}</option>
          <option value="selection">{w.selection}</option>
        </select>
      </div>
      <div className="object-alignment">
        {(
          [
            ['left', w.xLeft],
            ['hcenter', w.xCenter],
            ['right', w.xRight],
            ['top', w.yTop],
            ['vcenter', w.yCenter],
            ['bottom', w.yBottom],
          ] as [string, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            data-object-align={key}
            disabled={none}
            onClick={() => alignSelection(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="help">{w.tip}</p>
    </>
  );
};

/** Distribuir objetos: iguala los espacios entre tres o más. */
export const DistributePanel = () => {
  useEditorState();
  useLanguage();
  const few = editableObjectSelection().length < 3;
  return (
    <>
      <Heading
        icon="grid"
        title={bw('Distribuir objetos', 'Distribute objects', 'Distribuir objetos')}
      />
      <div className="page-action">
        <button
          type="button"
          className="btn"
          data-distribute="x"
          disabled={few}
          onClick={() => distributeObjects('x')}
        >
          {bw('Espacios horizontales', 'Horizontal gaps', 'Espaços horizontais')}
        </button>
        <button
          type="button"
          className="btn"
          data-distribute="y"
          disabled={few}
          onClick={() => distributeObjects('y')}
        >
          {bw('Espacios verticales', 'Vertical gaps', 'Espaços verticais')}
        </button>
      </div>
      <p className="help">
        {bw(
          'Seleccioná al menos tres elementos con Shift + clic. Iguala los espacios entre ellos conservando los extremos.',
          'Shift-click at least three elements. Equalizes gaps while retaining the outer positions.',
          'Selecione pelo menos três elementos com Shift + clique. Iguala os espaços mantendo os extremos.',
        )}
      </p>
    </>
  );
};

const toggleLocked = onChange<HTMLInputElement>((box) => {
  const o = selectObject();
  if (o) commit(() => (o.locked = box.checked), false);
});
const toggleHidden = onChange<HTMLInputElement>((box) => {
  const o = selectObject();
  if (o) commit(() => (o.hidden = box.checked), false);
});

/** Orden y bloqueo: al frente o al fondo, bloquear, ocultar y eliminar. */
export const OrderPanel = () => {
  useEditorState();
  useLanguage();
  const o = selectObject(),
    locked = !o || o.locked;
  const objectButton = (name: string, label: string, extra = '') => (
    <button
      type="button"
      className={'btn' + extra}
      data-object-command={name}
      disabled={locked}
      onClick={() => command(name)}
    >
      {label}
    </button>
  );
  return (
    <>
      <Heading
        icon="layers"
        title={bw('Orden y bloqueo', 'Order and locking', 'Ordem e bloqueio')}
      />
      {o ? (
        <>
          <div className="page-action">
            {objectButton('front', bw('Al frente', 'To front', 'Para frente'))}
            {objectButton('back', bw('Al fondo', 'To back', 'Para trás'))}
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              id="objectLocked"
              defaultChecked={!!o.locked}
              ref={toggleLocked}
            />
            {bw('Bloquear objeto', 'Lock object', 'Bloquear objeto')}
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              id="objectHidden"
              defaultChecked={!!o.hidden}
              ref={toggleHidden}
            />
            {bw('Ocultar objeto', 'Hide object', 'Ocultar objeto')}
          </label>
          {objectButton(
            'deleteObject',
            bw('Eliminar objeto', 'Delete object', 'Excluir objeto'),
            ' danger wide',
          )}
        </>
      ) : null}
    </>
  );
};

/** Nada seleccionado (pestaña Selección sin objeto). */
export const EmptySelection = () => {
  useLanguage();
  return (
    <>
      <p className="inspector-empty-title">{LibroI18n.tr('Nada seleccionado')}</p>
      <p className="help">
        {LibroI18n.tr(
          'Hacé clic en una caja, una imagen o un marco de la página para ver sus propiedades. Con doble clic en una caja de texto, escribís.',
        )}
      </p>
    </>
  );
};

registerInspectorPanel('object:select', () => <SelectedObjectPanel />, 'object-panel');
registerInspectorPanel('object:box', () => <GeometryPanel />, 'object-panel');
registerInspectorPanel('object:align', () => <AlignPanel />, 'object-panel');
registerInspectorPanel('object:distribute', () => <DistributePanel />, 'object-panel');
registerInspectorPanel('object:order', () => <OrderPanel />, 'object-panel');
registerInspectorPanel('selection:empty', () => <EmptySelection />, 'object-panel');
