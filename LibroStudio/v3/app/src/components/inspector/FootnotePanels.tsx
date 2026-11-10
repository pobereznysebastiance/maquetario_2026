// Inspector · notas al pie (src/footnote-model.ts):
// - Selección → "Notas al pie" (text:notes): insertar una nota en la caja (donde está el cursor si
//   se está escribiendo) y escribir o quitar las notas que llama la caja, en orden.
// - Libro → "Notas al pie" (design:footnotes): tipo de letra, cuerpo, interlineado, espacio sobre
//   las notas, filete y numeración. Aparece cuando el libro tiene alguna nota.
//
// Los campos graban con el "change" nativo. El botón de insertar no se lleva el foco (Btn keepFocus:
// preventDefault en mousedown): así la caja sigue en edición y la nota va donde está el cursor.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { ReactNode } from 'react';
import { useLanguage } from '../../react/mount.tsx';
import {
  Btn,
  fieldKey,
  firstTime,
  FontBrowserButton,
  Heading,
  lengthUnit,
  onNativeChange,
} from './fields.tsx';
import { bw } from '../../i18n/language.ts';
import { editor } from '../../core-api.ts';
import { registerInspectorPanel } from '../../inspector-registry.ts';
import {
  footnoteSettings,
  insertFootnote,
  noteKeysIn,
  noteNumbers,
  removeFootnote,
  setFootnoteSetting,
  setFootnoteText,
} from '../../footnote-model.ts';
import type { FootnoteSettings } from '../../model.ts';
import { markAsQuote } from '../../roles.ts';
import { shortcutLabel } from '../../keys.ts';

const title = () => bw('Notas al pie', 'Footnotes', 'Notas de rodapé');

/** Texto de una nota: graba al salir del campo ("change" nativo). */
const noteText = (key: string) => (el: HTMLTextAreaElement | null) => {
  if (el && firstTime(el)) el.addEventListener('change', () => setFootnoteText(key, el.value));
};

export const NotesPanel = () => {
  useLanguage();
  const o = selectObject();
  if (!o || o.type !== 'text' || o.toc) return null;
  const notes = footnoteSettings().notes,
    keys = noteKeysIn(o.text),
    numbers = noteNumbers(),
    locked = !!o.locked;
  return (
    <>
      <Heading
        icon="text"
        title={bw('Notas al pie y citas', 'Footnotes and quotes', 'Notas de rodapé e citações')}
      />
      <Btn
        id="insertFootnote"
        icon="plus"
        label={bw('Insertar nota al pie', 'Insert footnote', 'Inserir nota de rodapé')}
        wide
        keepFocus
        disabled={locked}
        onClick={insertFootnote}
      />
      <p className="help">
        {shortcutLabel(
          keys.length
            ? bw(
                'Ctrl+Alt+F mientras escribís pone la nota donde está el cursor. El formato de las notas está en Libro.',
                'Ctrl+Alt+F while typing places the note at the cursor. Note formatting is in Book.',
                'Ctrl+Alt+F enquanto escreve coloca a nota no cursor. O formato das notas está em Livro.',
              )
            : bw(
                'Escribiendo en la caja, la nota va donde está el cursor (también con Ctrl+Alt+F); si no, al final del párrafo.',
                'While typing in the box, the note goes at the cursor (also Ctrl+Alt+F); otherwise, at the end of the paragraph.',
                'Escrevendo na caixa, a nota vai no cursor (também com Ctrl+Alt+F); se não, no fim do parágrafo.',
              ),
        )}
      </p>
      <Btn
        id="markQuote"
        label={bw('Marcar como cita', 'Mark as quote', 'Marcar como citação')}
        wide
        disabled={locked}
        onClick={markAsQuote}
      />
      <p className="help">
        {bw(
          'El párrafo elegido (o el del cursor) pasa a ser una cita: sangrada y un punto más chica. En la pauta va en Otros.',
          'The chosen paragraph (or the one at the cursor) becomes a quote: indented and one point smaller. In the guide it goes under Other.',
          'O parágrafo escolhido (ou o do cursor) vira uma citação: recuada e um ponto menor. Na pauta fica em Outros.',
        )}
      </p>
      {keys.map((key) => {
        const label = bw('Nota', 'Note', 'Nota') + ' ' + (numbers.get(key) ?? '');
        return (
          <div className="footnote-field" key={key}>
            <div className="field-row">
              <label htmlFor={'footnote-' + key}>{label}</label>
              <button
                type="button"
                className="quiet"
                disabled={locked}
                data-footnote-remove={key}
                onClick={() => removeFootnote(key)}
              >
                {bw('Quitar', 'Remove', 'Remover')}
              </button>
            </div>
            <textarea
              key={fieldKey('footnote-' + key, notes[key])}
              id={'footnote-' + key}
              className="field-full"
              rows={3}
              maxLength={20000}
              disabled={locked}
              data-footnote-text={key}
              aria-label={label}
              defaultValue={notes[key]}
              ref={noteText(key)}
            />
          </div>
        );
      })}
    </>
  );
};

/** Un número del formato (cuerpo, interlineado, espacio), con su rango. */
const SettingNumber = ({
  name,
  min,
  max,
  step,
  unit,
}: {
  name: 'size' | 'leading' | 'space';
  min: number;
  max: number;
  step: number;
  unit: string;
}) => {
  const value = footnoteSettings()[name];
  return (
    <span className="unit-wrap">
      <input
        key={fieldKey('footnotes.' + name, value)}
        type="number"
        data-footnote-setting={name}
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        ref={onNativeChange<HTMLInputElement>((input) => {
          const next = Number(input.value);
          if (!Number.isFinite(next) || next < Number(input.min) || next > Number(input.max)) {
            toast('Revisá el valor ingresado.', 'warning');
            inspector();
          } else setFootnoteSetting(name, next);
        })}
      />
      <span className="unit">{unit}</span>
    </span>
  );
};

export const FootnoteFormatPanel = () => {
  useLanguage();
  const s = footnoteSettings();
  const row = (label: string, control: ReactNode) => (
    <div className="field-row">
      <label>{label}</label>
      {control}
    </div>
  );
  return (
    <>
      <Heading icon="text" title={title()} />
      {row(
        bw('Tipo de letra', 'Typeface', 'Fonte'),
        <>
          <select
            key={fieldKey('footnotes.font', s.font)}
            className="font-native-hidden"
            data-browser-hook="1"
            data-footnote-setting="font"
            defaultValue={s.font}
            ref={onNativeChange<HTMLSelectElement>((select) =>
              setFootnoteSetting('font', select.value),
            )}
          >
            {[...new Set([s.font, ...editor.fontList])].map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
          <FontBrowserButton family={s.font} />
        </>,
      )}
      {row(
        bw('Cuerpo', 'Size', 'Corpo'),
        <SettingNumber name="size" min={4} max={72} step={0.5} unit="pt" />,
      )}
      {row(
        bw('Interlineado', 'Leading', 'Entrelinha'),
        <SettingNumber name="leading" min={4} max={100} step={0.5} unit="pt" />,
      )}
      {row(
        bw('Espacio sobre las notas', 'Space above notes', 'Espaço acima das notas'),
        <SettingNumber name="space" min={0} max={50} step={0.5} unit={lengthUnit()} />,
      )}
      {row(
        bw('Numeración', 'Numbering', 'Numeração'),
        <select
          key={fieldKey('footnotes.restart', s.restart)}
          data-footnote-setting="restart"
          defaultValue={s.restart}
          ref={onNativeChange<HTMLSelectElement>((select) =>
            setFootnoteSetting('restart', select.value as FootnoteSettings['restart']),
          )}
        >
          <option value="book">{bw('Continua', 'Continuous', 'Contínua')}</option>
          <option value="section">{bw('Por sección', 'By section', 'Por seção')}</option>
          <option value="page">{bw('Por página', 'By page', 'Por página')}</option>
        </select>,
      )}
      {row(
        bw('Número al pie', 'Note number', 'Número da nota'),
        <select
          key={fieldKey('footnotes.numberStyle', s.numberStyle)}
          data-footnote-setting="numberStyle"
          defaultValue={s.numberStyle || 'normal'}
          ref={onNativeChange<HTMLSelectElement>((select) =>
            setFootnoteSetting('numberStyle', select.value as FootnoteSettings['numberStyle']),
          )}
        >
          <option value="normal">{bw('Normal', 'Normal', 'Normal')}</option>
          <option value="superscript">{bw('Volado', 'Superscript', 'Sobrescrito')}</option>
        </select>,
      )}
      <label className="check-line">
        <input
          key={fieldKey('footnotes.rule', s.rule)}
          type="checkbox"
          data-footnote-setting="rule"
          defaultChecked={s.rule}
          ref={onNativeChange<HTMLInputElement>((input) =>
            setFootnoteSetting('rule', input.checked),
          )}
        />
        {bw('Filete sobre las notas', 'Rule above notes', 'Filete acima das notas')}
      </label>
    </>
  );
};

registerInspectorPanel('text:notes', () => <NotesPanel />, 'footnote-panels');
registerInspectorPanel('design:footnotes', () => <FootnoteFormatPanel />, 'footnote-panels');
