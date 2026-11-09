// Inspector · Libro · Cornisa y Titulillo en React (etapa 3, D2).
//
// Mismo marcado que tenían en HTML (section(), row(), options() y masterDetails() de studio.ts).
// Absorben lo que agregaba el decorador de master-refinement.ts moviendo nodos: con la posición en
// un margen lateral, la fila "Lectura lateral" (data-master-direction) y su ayuda debajo de la
// posición, y "Rotar texto 90°" oculto (lo reemplaza la lectura lateral).
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useEditorState } from '../../react/editor-state.ts';
import { useLanguage } from '../../react/mount.tsx';
import {
  bind,
  CheckLine,
  firstTime,
  MasterDetails,
  onNativeChange,
  Options,
  Row,
  SwitchHeading,
  tt,
} from './fields.tsx';

type MasterType = 'header' | 'titulillo';

const isLateral = (type: MasterType): boolean =>
  ['left', 'right', 'outer', 'inner'].includes(book[type].pos);

/** Sentido de lectura en el margen lateral: el valor va por la propiedad, como antes, y se graba
 * al cambiar. */
const saveDirection = (type: MasterType) => {
  const listen = onNativeChange<HTMLSelectElement>((select) =>
    commit(() => (book[type].sideDirection = select.value), false),
  );
  return (select: HTMLSelectElement | null) => {
    if (select && firstTime(select)) select.value = book[type].sideDirection || 'up';
    listen(select);
  };
};

/** "Lectura lateral" y su ayuda: sólo con la posición en un margen lateral. */
const SideReading = ({ type }: { type: MasterType }) =>
  isLateral(type) ? (
    <>
      <div className="field-row">
        <label>{bw('Lectura lateral', 'Side reading direction', 'Leitura lateral')}</label>
        <select data-master-direction={type} ref={saveDirection(type)}>
          <option value="up">
            {'↑ ' + bw('De abajo hacia arriba', 'Bottom to top', 'De baixo para cima')}
          </option>
          <option value="down">
            {'↓ ' + bw('De arriba hacia abajo', 'Top to bottom', 'De cima para baixo')}
          </option>
        </select>
      </div>
      <p className="help">
        {bw(
          'Se ubica dentro del margen lateral. Distancia al borde mueve el eje; X e Y permiten ajustes adicionales.',
          'Placed inside the side margin. Distance from edge moves the axis; X and Y provide additional adjustment.',
          'Fica na margem lateral. Distância da borda move o eixo; X e Y permitem ajustes adicionais.',
        )}
      </p>
    </>
  ) : null;

export const HeaderPanel = () => {
  useEditorState();
  useLanguage();
  return (
    <>
      <SwitchHeading icon="header" title="Cornisa" enabled="header.enabled" />
      <Row label="Posición">
        <Options path="header.pos" items={positions} />
      </Row>
      <SideReading type="header" />
      <input
        className="field-full"
        aria-label={tt('Título del libro')}
        data-bind="title"
        maxLength={250}
        defaultValue={book.title}
        ref={bind}
      />
      <input
        className="field-full"
        aria-label={tt('Sección general')}
        data-bind="chapter"
        maxLength={250}
        defaultValue={book.chapter}
        ref={bind}
      />
      <MasterDetails
        type="header"
        verticalHidden={isLateral('header')}
        extra={<CheckLine path="header.rule" label=" Línea debajo de la cornisa" />}
      />
    </>
  );
};

export const TitulilloPanel = () => {
  useEditorState();
  useLanguage();
  return (
    <>
      <SwitchHeading icon="text" title="Titulillo" enabled="titulillo.enabled" />
      <Row label="Posición">
        <Options path="titulillo.pos" items={positions} />
      </Row>
      <SideReading type="titulillo" />
      <MasterDetails type="titulillo" verticalHidden={isLateral('titulillo')} />
    </>
  );
};

registerInspectorPanel('design:header', () => <HeaderPanel />, 'master-panels');
registerInspectorPanel('design:titulillo', () => <TitulilloPanel />, 'master-panels');
