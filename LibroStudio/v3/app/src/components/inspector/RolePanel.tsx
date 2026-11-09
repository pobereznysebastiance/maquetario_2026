// Inspector · Selección → Rol (text:role), primero con una caja de texto (src/roles.ts):
// - el rol de los párrafos elegidos (toda la caja, o el párrafo de "Aplicar a" en Párrafo y estilos;
//   al escribir, el del cursor), con los nombres de la planilla de la cátedra;
// - "¿sólo acá o en todo el rol?": si el texto se aparta del rol, qué cambió y las dos salidas;
// - el ancho de caja del rol en columnas de la grilla, y si esta caja no coincide.
//
// Los campos graban con el "change" nativo; los botones, con el clic.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import { useLanguage } from '../../react/mount.tsx';
import { Btn, fieldKey, Heading, onNativeChange } from './fields.tsx';
import { bw } from '../../i18n/language.ts';
import { registerInspectorPanel } from '../../inspector-registry.ts';
import { paragraphIndices } from '../../paragraph-format.ts';
import type { RoleId } from '../../model.ts';
import {
  applyDeviationToRole,
  applyRole,
  backToRole,
  boxColumns,
  boxRoleStyle,
  deviationLabels,
  fitBoxToRole,
  gridColumnCount,
  ROLE_IDS,
  roleDeviation,
  roleName,
  selectedRole,
  setRoleColumns,
} from '../../roles.ts';

export const RolePanel = () => {
  useLanguage();
  const o = selectObject();
  if (!o || o.type !== 'text' || o.toc) return null;
  const role = selectedRole(o),
    deviation = roleDeviation(o),
    boxStyle = boxRoleStyle(o),
    columns = boxStyle ? boxColumns(o) : 0,
    locked = !!o.locked,
    scope =
      paragraphIndices(o).length === o.text.split('\n').length
        ? bw('toda la caja', 'the whole frame', 'toda a caixa')
        : bw('el párrafo ', 'paragraph ', 'o parágrafo ') + (paragraphIndices(o)[0]! + 1);
  return (
    <>
      <Heading icon="text" title={bw('Rol', 'Role', 'Função')} />
      {/* A todo el ancho: los nombres de la planilla ("Frases destacadas A") no entran en la columna. */}
      <div className="field-row stacked">
        <label htmlFor="textRole">{bw('Rol del texto', 'Text role', 'Função do texto')}</label>
        <select
          key={fieldKey('role', role + ':' + o.id + ':' + paragraphIndices(o).join())}
          id="textRole"
          defaultValue={role}
          disabled={locked}
          ref={onNativeChange<HTMLSelectElement>((select) =>
            applyRole(select.value as RoleId | ''),
          )}
        >
          <option value="">{bw('Sin rol', 'No role', 'Sem função')}</option>
          {role === 'mixed' ? (
            <option value="mixed" disabled>
              {bw('Roles mezclados', 'Mixed roles', 'Funções misturadas')}
            </option>
          ) : null}
          {ROLE_IDS.map((id) => (
            <option key={id} value={id}>
              {roleName(id)}
            </option>
          ))}
        </select>
      </div>
      <p className="help">
        {bw('Se aplica a ', 'Applies to ', 'Aplica-se a ') +
          scope +
          bw(
            '. Cambiar el formato de un rol cambia todos los textos que lo tienen.',
            '. Changing a role’s format changes every text that has it.',
            '. Mudar o formato de uma função muda todos os textos que a têm.',
          )}
      </p>
      <Btn
        id="openTypeGuide"
        label={bw('Ver la pauta del libro', 'See the book guide', 'Ver a pauta do livro')}
        quiet
        wide
        onClick={() => editorialRulesDialog()}
      />
      {deviation ? (
        <div className="role-deviation" data-role-deviation>
          <p className="help">
            {bw('Este texto se aparta de ', 'This text departs from ', 'Este texto se afasta de ') +
              roleName(deviation.style.role!) +
              ': ' +
              deviationLabels(deviation.keys).join(', ') +
              bw(
                '. ¿Sólo acá o en todo el rol?',
                '. Only here or in the whole role?',
                '. Só aqui ou em toda a função?',
              )}
          </p>
          <div className="page-action">
            <Btn
              id="roleApplyAll"
              label={bw('En todo el rol', 'Whole role', 'Em toda a função')}
              disabled={locked}
              onClick={applyDeviationToRole}
            />
            <Btn
              id="roleBack"
              label={bw('Volver al rol', 'Back to role', 'Voltar à função')}
              disabled={locked}
              onClick={backToRole}
            />
          </div>
        </div>
      ) : null}
      {boxStyle ? (
        <>
          <div className="field-row">
            <label htmlFor="roleColumns">
              {bw('Ancho de caja', 'Frame width', 'Largura da caixa')}
            </label>
            <select
              key={fieldKey('roleColumns', String(boxStyle.columns ?? ''))}
              id="roleColumns"
              defaultValue={String(boxStyle.columns ?? '')}
              disabled={locked}
              ref={onNativeChange<HTMLSelectElement>((select) =>
                setRoleColumns(select.value ? Number(select.value) : null),
              )}
            >
              <option value="">{bw('Libre', 'Free', 'Livre')}</option>
              {Array.from({ length: gridColumnCount() }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n +
                    ' ' +
                    (n === 1
                      ? bw('columna', 'column', 'coluna')
                      : bw('columnas', 'columns', 'colunas'))}
                </option>
              ))}
            </select>
          </div>
          {boxStyle.columns && boxStyle.columns !== columns ? (
            <>
              <p className="help" data-role-columns-mismatch>
                {bw('Esta caja ocupa ', 'This frame spans ', 'Esta caixa ocupa ') +
                  columns +
                  bw(' columnas; el rol, ', ' columns; the role, ', ' colunas; a função, ') +
                  boxStyle.columns +
                  '.'}
              </p>
              <Btn
                id="roleFitColumns"
                label={bw(
                  'Ajustar la caja al rol',
                  'Fit frame to role',
                  'Ajustar a caixa à função',
                )}
                wide
                disabled={locked}
                onClick={fitBoxToRole}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
};

registerInspectorPanel('text:role', () => <RolePanel />, 'role-panel');
