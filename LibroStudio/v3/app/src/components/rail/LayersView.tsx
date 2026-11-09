// Vista Capas del riel, en React: los objetos de la página activa de adelante hacia atrás, con
// ojo (ocultar), candado (bloquear), arrastrar para reordenar y, con un objeto elegido, su nombre
// y Subir / Bajar. Mismo marcado e ids que la versión en HTML de layout-tools.ts, salvo el ojo y
// el candado: antes eran caracteres sin nombre accesible; ahora son íconos con aria-label y
// aria-pressed.
//
// El nombre escucha el "change" nativo en el propio campo (no el onChange de React). Se redibuja
// con RailViews.tsx (avisos del núcleo e idioma).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { DragEvent } from 'react';
import type { BookObject } from '../../model.ts';
import { Icon } from '../Icon.tsx';

/** Lo que la vista necesita de layout-tools.ts. */
export interface LayersSource {
  /** Textos en el idioma actual (layoutWords). */
  words: () => Record<string, string>;
  /** Mueve la capa source al lugar de target. */
  reorder: (source: string, target: string) => void;
  /** Sube (1) o baja (-1) la capa elegida. */
  move: (direction: number) => void;
}

/** La capa que se está arrastrando. */
let dragging: string | null = null;

const bound = new WeakSet<Element>();
const nameField = (el: HTMLInputElement | null): void => {
  if (!el || bound.has(el)) return;
  bound.add(el);
  el.addEventListener('change', () => commit(() => (selectObject()!.name = el.value), false));
};

const layerName = (o: BookObject): string =>
  o.name ||
  o.text?.trim().split('\n')[0]?.slice(0, 36) ||
  (o.type === 'frame' ? 'Marco' : 'Objeto');

const LayerRow = ({ o, objects }: { o: BookObject; objects: BookObject[] }) => {
  const name = layerName(o);
  const toggle = (key: 'hidden' | 'locked') =>
    commit(() => {
      const target = objects.find((item) => item.id === o.id)!;
      target[key] = !target[key];
    }, false);
  const eye = o.hidden
      ? bw('Mostrar', 'Show', 'Mostrar') + ': ' + name
      : bw('Ocultar', 'Hide', 'Ocultar') + ': ' + name,
    lock = o.locked
      ? bw('Desbloquear', 'Unlock', 'Desbloquear') + ': ' + name
      : bw('Bloquear', 'Lock', 'Bloquear') + ': ' + name;
  return (
    <div
      className={`layer-row ${o.id === selected ? 'active' : ''} ${o.hidden ? 'is-hidden' : ''}`}
      draggable="true"
      data-layer={o.id}
      onClick={(e) => {
        if ((e.target as Element).closest('button')) return;
        finishEditing();
        tool = 'select';
        selected = o.id;
        render(false);
      }}
      onDragStart={(e: DragEvent) => {
        dragging = o.id;
        e.dataTransfer.setData('text/plain', o.id);
      }}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('drop-target');
      }}
      onDragLeave={(e: DragEvent<HTMLDivElement>) =>
        e.currentTarget.classList.remove('drop-target')
      }
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        const source = dragging;
        if (source && source !== o.id) commit(() => layers.reorder(source, o.id), false);
        dragging = null;
      }}
    >
      <span className="layer-grip" aria-hidden="true">
        <Icon name="grip" />
      </span>
      <span className="layer-type">
        <Icon name={o.type === 'text' ? 'text' : o.type === 'image' ? 'image' : 'frame'} />
      </span>
      <span className="layer-name user-content">{name}</span>
      <button
        type="button"
        className="icon-btn"
        data-eye={o.id}
        title={eye}
        aria-label={eye}
        aria-pressed={!!o.hidden}
        onClick={() => toggle('hidden')}
      >
        <Icon name={o.hidden ? 'eyeOff' : 'eye'} />
      </button>
      <button
        type="button"
        className="icon-btn"
        data-lock={o.id}
        title={lock}
        aria-label={lock}
        aria-pressed={!!o.locked}
        onClick={() => toggle('locked')}
      >
        <Icon name={o.locked ? 'lock' : 'unlock'} />
      </button>
    </div>
  );
};

/** Las acciones de layout-tools.ts (se fijan al registrar la vista). */
let layers: LayersSource;

const LayersView = () => {
  const w = layers.words(),
    objects = book.pages[active].objects,
    current = selectObject();
  return (
    <section className="section" data-section={w.layers + ' · ' + (active + 1)} data-key="pages">
      <div className="section-heading">
        <Icon name="pages" />
        <span>{w.layers + ' · ' + (active + 1)}</span>
      </div>
      <p className="help">{w.hint}</p>
      <div id="layerList">
        {objects.length ? (
          objects
            .slice()
            .reverse()
            .map((o) => <LayerRow key={o.id} o={o} objects={objects} />)
        ) : (
          <p className="help">{w.empty}</p>
        )}
      </div>
      {current ? (
        <>
          <label className="field-label">{w.rename}</label>
          <input
            id="layerName"
            className="field-full"
            maxLength={100}
            defaultValue={current.name || ''}
            key={current.id + ':' + (current.name || '')}
            ref={nameField}
          />
          <div className="page-action">
            <button type="button" id="layerUp" className="btn" onClick={() => layers.move(1)}>
              {'↑ ' + w.up}
            </button>
            <button type="button" id="layerDown" className="btn" onClick={() => layers.move(-1)}>
              {'↓ ' + w.down}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
};

/** La vista, con las acciones de layout-tools.ts. */
export const layersViewFor = (source: LayersSource) => {
  layers = source;
  return () => <LayersView />;
};
