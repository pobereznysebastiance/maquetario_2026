// Inspector · Selección de una caja de texto en React (etapa 3, D2, paso 8):
// - "Párrafo y estilos" (paragraph): alcance, estilo de párrafo, alineación, sangrías, espacios,
//   última línea, separación silábica e idioma, y los botones de estilos. Antes lo anteponía el
//   decorador de paragraphs.ts.
// - "Tipografía" (typography): tipo de letra, peso y estilo, ejes variables, muestra, cuerpo,
//   interlineado, alineación, color y "Editar contenido". Antes lo armaban el viejo textControls()
//   y dos decoradores (fonts.ts y paragraphs.ts) que reescribían sus valores con los del
//   párrafo elegido.
// - "Carácter y párrafo" (character): tracking, sangría inicial, espacio entre párrafos, glifos y
//   abrir el Índice. Antes lo agregaba editorial.ts al final, y font-glyphs.tsx no llegaba a ligar
//   el botón de glifos (se agregaba después de los decoradores): ahora abre los glifos.
//
// Mismo marcado, ids y data-* que el HTML (los usan las pruebas, la autoprueba y document-units).
// Los campos graban con el "change" nativo; los botones, con el clic. El selector visual de fuente
// es FontBrowserButton (fields.tsx). Con la caja bloqueada, sus campos quedan deshabilitados.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).
import type { CSSProperties } from 'react';
import { paragraphIndices, styleDialog, type ParagraphStyle } from '../../paragraphs.ts';
import { useLanguage } from '../../react/mount.tsx';
import { Icon } from '../Icon.tsx';
import {
  Btn,
  fieldKey,
  firstTime,
  FontBrowserButton,
  Heading,
  lengthUnit,
  onNativeChange,
  Row,
  SectionHeading,
  tt,
} from './fields.tsx';
import { bw } from '../../i18n/language.ts';
import { editor, M } from '../../core-api.ts';
import { readHyphenationFields } from '../../hyphenation.ts';
import { registerInspectorPanel } from '../../inspector-registry.ts';
import {
  currentParagraph,
  paragraphFormat,
  paragraphMeta,
  pw,
  asParagraphOperation,
} from '../../paragraph-format.ts';
import {
  chooseDefaultFace,
  familyFaces,
  fw,
  selectedFace,
  variations,
} from '../../font-catalog.ts';

type Face = NativeFontFace;
type Axis = Face['axes'][number] & { name?: string };

/** Ref que prepara un nodo una sola vez (valor inicial, estado intermedio, oyentes). */
const once =
  <T extends Element>(prepare: (el: T) => void) =>
  (el: T | null): void => {
    if (el && firstTime(el)) prepare(el);
  };
const objectField = onNativeChange<HTMLInputElement | HTMLSelectElement>((el) =>
  commitObjectField(el as UIElement),
);

// ── Párrafo y estilos ──

/** Un cambio de párrafo sin redibujar fuera de rango (antes: inspector()). */
const paragraphNumber = onNativeChange<HTMLInputElement>((input) => {
  const value = Number(input.value);
  if (Number.isFinite(value) && value >= Number(input.min) && value <= Number(input.max))
    paragraphPatch({ [input.dataset.paragraph!]: value });
  else inspector();
});

/** Separación silábica e idioma (hyphenationFields de hyphenation-controls.ts), ligados al párrafo. */
const Hyphenation = ({
  format,
  formats,
  locked,
}: {
  format: Record<string, any>;
  formats: Record<string, any>[];
  locked: boolean;
}) => {
  const mixed = formats.some((item) => !!item.hyphenate !== !!format.hyphenate);
  return (
    <div className="control full hyphenation-controls">
      {'\n    '}
      <label className="check-line">
        <input
          key={fieldKey('hyphenate', String(!!format.hyphenate) + mixed)}
          type="checkbox"
          id="paragraphHyphenEnabled"
          defaultChecked={!!format.hyphenate && !mixed}
          disabled={locked}
          ref={once<HTMLInputElement>((el) => {
            el.indeterminate = mixed;
            el.addEventListener('change', () =>
              paragraphPatch(readHyphenationFields('paragraphHyphen')),
            );
          })}
        />
        {'\n    ' + bw('Separación silábica', 'Hyphenation', 'Separação silábica')}
      </label>
      {'\n    '}
      <label htmlFor="paragraphHyphenLanguage">
        {bw('Idioma del texto', 'Text language', 'Idioma do texto')}
      </label>
      {'\n    '}
      <select
        key={fieldKey('hyphenLanguage', format.hyphenLanguage)}
        id="paragraphHyphenLanguage"
        defaultValue={format.hyphenLanguage || 'es'}
        disabled={locked}
        ref={onNativeChange<HTMLSelectElement>((el) =>
          paragraphPatch({ hyphenLanguage: el.value }),
        )}
      >
        {[
          ['es', 'Español'],
          ['en', 'English'],
          ['pt', 'Português'],
        ].map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {'\n  '}
    </div>
  );
};

export const ParagraphPanel = () => {
  useLanguage();
  const o = selectObject(),
    w = pw();
  if (!o || o.type !== 'text' || o.toc)
    return (
      <>
        <SectionHeading>
          <Icon name="justify" />
          {' ' + w.panel}
        </SectionHeading>
        <p className="help">{w.empty}</p>
      </>
    );
  if (editor.paragraphScope.id !== o.id) editor.paragraphScope = { id: o.id, index: -1 };
  const indices = paragraphIndices(o),
    formats = indices.map((i) => paragraphFormat(editor.book, o, i)),
    props = formats[0],
    styles: ParagraphStyle[] = editor.book.paragraphStyles || [],
    styleIds = indices.map((i) => o.paragraphMap?.[i]?.styleId || ''),
    singleStyle = styleIds.every((id) => id === styleIds[0]) ? styleIds[0] : 'mixed',
    style = styles.find((s) => s.id === singleStyle),
    locked = !!o.locked,
    alignments = [
      ['left', w.l],
      ['center', w.c],
      ['right', w.r],
      ['justify', w.j],
    ];
  return (
    <>
      <SectionHeading>
        <Icon name="justify" />
        {' ' + w.panel}
      </SectionHeading>
      <div className="field-row">
        <label>{w.scope}</label>
        <select
          key={fieldKey('scope', o.id + ':' + editor.paragraphScope.index)}
          id="paragraphScope"
          defaultValue={String(editor.paragraphScope.index)}
          disabled={locked}
          ref={onNativeChange<HTMLSelectElement>((el) => {
            editor.paragraphScope = { id: o.id, index: Number(el.value) };
            inspector();
          })}
        >
          <option value="-1">{w.all}</option>
          {o.text.split('\n').map((text: string, i: number) => (
            <option key={i} value={String(i)}>
              {`${w.paragraph} ${i + 1} · ${M.withoutNoteMarks(editor.book, text).slice(0, 25) || '—'}`}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label>{w.style}</label>
        <select
          key={fieldKey('style', singleStyle + ':' + styles.map((s) => s.id).join())}
          id="paragraphStyle"
          defaultValue={singleStyle}
          disabled={locked}
          ref={onNativeChange<HTMLSelectElement>((el) => applyParagraphStyle(el.value))}
        >
          <option value="">{w.none}</option>
          {singleStyle === 'mixed' ? (
            <option value="mixed" disabled>
              {w.mixed}
            </option>
          ) : null}
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="paragraph-align">
        {alignments.map(([align, label]) => (
          <button
            key={align}
            type="button"
            className={props.align === align ? 'active' : undefined}
            title={label}
            data-paragraph-align={align}
            disabled={locked}
            onClick={() => paragraphPatch({ align })}
          >
            <Icon name={align} />
          </button>
        ))}
      </div>
      {(
        [
          ['indentLeft', w.left, 0, 80],
          ['indentRight', w.right, 0, 80],
          ['firstIndent', w.first, -30, 50],
          ['spaceBefore', w.before, 0, 50],
          ['spaceAfter', w.after, 0, 50],
        ] as [string, string, number, number][]
      ).map(([key, label, min, max]) => (
        <div className="field-row" key={key}>
          <label>{label}</label>
          <span className="unit-wrap">
            <input
              key={fieldKey(key, Number(props[key] || 0).toFixed(1))}
              data-paragraph={key}
              type="number"
              step=".5"
              min={min}
              max={max}
              defaultValue={Number(props[key] || 0).toFixed(1)}
              disabled={locked}
              ref={paragraphNumber}
            />
            <span className="unit">{lengthUnit()}</span>
          </span>
        </div>
      ))}
      <div className="field-row">
        <label>{w.last}</label>
        <select
          key={fieldKey('lastAlign', props.lastAlign)}
          id="paragraphLastAlign"
          defaultValue={props.lastAlign}
          disabled={locked}
          ref={onNativeChange<HTMLSelectElement>((el) => paragraphPatch({ lastAlign: el.value }))}
        >
          {[['auto', w.auto], ...alignments].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Hyphenation format={props} formats={formats} locked={locked} />
      <Btn
        id="newParagraphStyle"
        label={'+ ' + w.new}
        wide
        disabled={locked}
        onClick={() => styleDialog(null)}
      />
      <div className="page-action">
        <Btn
          id="editParagraphStyle"
          label={w.edit}
          disabled={!style || locked}
          onClick={() => styleDialog(style)}
        />
        <Btn
          id="redefineParagraphStyle"
          icon="refresh"
          label=""
          title={w.redefine}
          disabled={!style || locked}
          onClick={() =>
            asParagraphOperation(() => {
              const properties = paragraphFormat(editor.book, o, currentParagraph(o));
              commit(() => {
                style!.properties = M.clone(properties);
                for (const index of paragraphIndices(o)) paragraphMeta(o, index).overrides = {};
              }, false);
            })
          }
        />
      </div>
      <Btn
        id="clearParagraphOverrides"
        label={w.reset}
        quiet
        wide
        disabled={locked}
        onClick={() =>
          asParagraphOperation(() =>
            commit(() => {
              for (const index of paragraphIndices(o)) paragraphMeta(o, index).overrides = {};
            }, false),
          )
        }
      />
      <Btn
        id="detachParagraphStyle"
        label={w.detach}
        quiet
        wide
        disabled={!(singleStyle && singleStyle !== 'mixed') || locked}
        onClick={() => applyParagraphStyle(null)}
      />
      <p className="help">{w.hint}</p>
    </>
  );
};

// ── Tipografía ──

/** Tipo de letra de la caja: con su archivo si lo hay, si no sólo el nombre. */
const changeFont = onNativeChange<HTMLSelectElement>(async (selector) => {
  const target = selectObject(),
    next = chooseDefaultFace(selector.value);
  if (!target) return;
  try {
    if (next) await applyFace(target, next);
    else
      commit(() => {
        target.font = selector.value;
        delete target.fontFaceId;
        delete target.fontAxes;
        delete target.fontWeight;
        delete target.fontItalic;
      }, false);
  } catch (error) {
    toast(fw().fail + (error as Error).message, 'error');
  }
});

/** Mientras se arrastra el deslizador de un eje, su valor se ve al lado del nombre. */
const showValue = once<HTMLInputElement>((input) =>
  input.addEventListener(
    'input',
    () =>
      (input.previousElementSibling!.querySelector('output')!.textContent = Number(
        input.value,
      ).toFixed(1)),
  ),
);

/** Un eje variable: nombre, etiqueta, valor y deslizador. */
const AxisControl = ({
  axis,
  value,
  data,
  disabled,
  onChange,
}: {
  axis: Axis;
  value: number;
  data: 'axis' | 'paragraphAxis';
  disabled?: boolean;
  onChange: (input: HTMLInputElement) => void;
}) => (
  <div className="font-axis">
    <div>
      <label>
        {(axis.name || axis.tag) + ' '}
        <span>{axis.tag}</span>
      </label>
      <output>{Number(value).toFixed(1)}</output>
    </div>
    <input
      key={fieldKey(axis.tag, value)}
      type="range"
      {...{ [data === 'axis' ? 'data-axis' : 'data-paragraph-axis']: axis.tag }}
      min={axis.min}
      max={axis.max}
      step={axis.tag === 'wght' ? 1 : 0.1}
      defaultValue={value}
      aria-label={data === 'axis' ? axis.name || axis.tag : undefined}
      disabled={disabled}
      ref={(input) => {
        showValue(input);
        onNativeChange(onChange)(input);
      }}
    />
  </div>
);

export const TypographyPanel = () => {
  useLanguage();
  const o = selectObject();
  if (!o || o.type !== 'text') return null;
  const w = fw(),
    objectFace = selectedFace(o) as Face | undefined,
    // El párrafo elegido manda (salvo en el índice, que no tiene párrafos).
    props = o.toc ? null : paragraphFormat(editor.book, o, currentParagraph(o)),
    face = props ? (selectedFace(props) as Face | undefined) : undefined,
    shown = (key: string) =>
      props && props[key] !== undefined
        ? typeof props[key] === 'number'
          ? Number(props[key].toFixed(2))
          : props[key]
        : o[key],
    align = props ? props.align : o.align,
    // Objeto bloqueado: sus campos quedan deshabilitados (antes lo hacía un decorador de tutorial.ts).
    locked = !!o.locked;
  // Peso y estilo: con la cara del párrafo, sus estilos e instancias; si no, los de la caja.
  const objectVariants = familyFaces(o.font).flatMap((f) => [
    {
      key: f.id,
      label: f.style + (f.axes.length ? ' · ' + w.variable : ''),
      face: f,
      instance: null,
    },
    ...f.instances.map((inst, i) => ({
      key: f.id + '@' + i,
      label: inst.name || String(i + 1),
      face: f,
      instance: inst,
    })),
  ]);
  const variants = face
    ? familyFaces(props!.font).flatMap((f) => [
        { key: f.id, label: f.style },
        ...f.instances.map((inst, i) => ({ key: f.id + '@' + i, label: inst.name })),
      ])
    : objectVariants.map(({ key, label }) => ({ key, label }));
  const named = face ? face.instances.findIndex((i) => i.name === props!.fontStyleName) : -1,
    variantValue = face
      ? face.id + (named >= 0 ? '@' + named : '')
      : objectVariants.find(
          (v) =>
            o.fontFaceId === v.face.id && o.fontStyleName === (v.instance?.name || v.face.style),
        )?.key;
  const missing =
    o.fontFaceId &&
    (!nativeFaces.some((f) => f.id === o.fontFaceId) || fontLoadErrors.has(o.fontFaceId));
  // Muestra: la cara de la caja y, encima, la del párrafo (en el orden en que se escribían).
  const variation = (axes: Record<string, number> | undefined) =>
    Object.entries(axes || {})
      .map(([tag, value]) => `"${tag}" ${value}`)
      .join(',');
  const specimen: Record<string, string> = {
    fontFamily: objectFace ? 'MQT_' + objectFace.id : o.font,
  };
  if (objectFace) {
    specimen.fontVariationSettings = variation(o.fontAxes);
    specimen.fontWeight = String(o.fontWeight || objectFace.weight);
    specimen.fontStyle = o.fontItalic ? 'italic' : 'normal';
  }
  if (face) {
    specimen.fontFamily = `"MQT_${face.id}", "${props!.font}"`;
    specimen.fontWeight = String(props!.fontAxes?.wght ?? props!.fontWeight ?? face.weight);
    specimen.fontStyle = props!.fontItalic ? 'italic' : 'normal';
    specimen.fontVariationSettings = variation(props!.fontAxes);
  }
  return (
    <>
      <Heading icon="text" title="Tipografía" />
      <div className="selection-chip">
        <Icon name="box" />
        {tt(' Cuadro de texto seleccionado')}
      </div>
      <Row label="Tipo de letra">
        <select
          key={fieldKey('font', shown('font'))}
          data-object="font"
          className="font-native-hidden"
          data-browser-hook="1"
          defaultValue={shown('font')}
          disabled={locked}
          ref={changeFont}
        >
          {editor.fontList.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <FontBrowserButton family={shown('font')} disabled={locked} />
      </Row>
      <div className="font-variant-block">
        <div className="field-row">
          <label>{w.weight}</label>
          <select
            key={fieldKey('variant', variantValue)}
            id="fontVariant"
            defaultValue={variantValue}
            disabled={locked}
            ref={onNativeChange<HTMLSelectElement>(async (el) => {
              if (face) {
                const [id, inst] = el.value.split('@'),
                  f = nativeFaces.find((f) => f.id === id);
                if (f) await applyFace(o, f, inst !== undefined ? f.instances[Number(inst)] : null);
                return;
              }
              const v = objectVariants.find((v) => v.key === el.value);
              if (!v) return;
              try {
                await applyFace(selectObject()!, v.face, v.instance);
              } catch (error) {
                toast(w.fail + (error as Error).message, 'error');
              }
            })}
          >
            {variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {objectFace && objectFace.axes.length > 0 && !face ? (
          <>
            <div className="sub-label">{w.axes}</div>
            {(objectFace.axes as Axis[]).map((axis) => (
              <AxisControl
                key={axis.tag}
                axis={axis}
                value={o.fontAxes?.[axis.tag] ?? axis.normal}
                data="axis"
                disabled={locked}
                onChange={(input) =>
                  commit(() => {
                    const target = selectObject()!;
                    if (!target.fontFaceId) {
                      target.fontFaceId = objectFace.id;
                      target.fontStyleName = objectFace.style;
                    }
                    target.fontAxes = {
                      ...variations(objectFace),
                      ...(target.fontAxes || {}),
                      [input.dataset.axis!]: Number(input.value),
                    };
                    if (input.dataset.axis === 'wght') target.fontWeight = Number(input.value);
                  }, false)
                }
              />
            ))}
          </>
        ) : null}
        {missing ? <p className="font-warning">{w.missing}</p> : null}
        {face?.axes.length ? (
          <div className="paragraph-variable-axes">
            <div className="sub-label">{w.axes}</div>
            {(face.axes as Axis[]).map((axis) => (
              <AxisControl
                key={axis.tag}
                axis={axis}
                value={props!.fontAxes?.[axis.tag] ?? axis.normal}
                data="paragraphAxis"
                disabled={!!o.locked}
                onChange={(input) => {
                  const axes = {
                    ...variations(face),
                    ...(props!.fontAxes || {}),
                    [input.dataset.paragraphAxis!]: Number(input.value),
                  };
                  paragraphPatch({
                    fontAxes: axes,
                    ...(axes.wght !== undefined ? { fontWeight: axes.wght } : {}),
                  });
                }}
              />
            ))}
          </div>
        ) : null}
        <div className="font-specimen" id="fontSpecimen" style={specimen as CSSProperties}>
          Aa Bb Gg 0123
        </div>
      </div>
      <Row label="Tamaño">
        <span className="unit-wrap">
          <input
            key={fieldKey('size', shown('size'))}
            data-object="size"
            aria-label={tt('Cuerpo del texto')}
            disabled={locked}
            type="number"
            min="4"
            max="150"
            step=".5"
            defaultValue={shown('size')}
            ref={objectField}
          />
          <span className="unit">pt</span>
        </span>
      </Row>
      <Row label="Interlineado" term>
        <span className="unit-wrap">
          <input
            key={fieldKey('leading', shown('leading'))}
            data-object="leading"
            aria-label={tt('Interlineado')}
            disabled={locked}
            type="number"
            min="4"
            max="220"
            step=".5"
            defaultValue={shown('leading')}
            ref={objectField}
          />
          <span className="unit">pt</span>
        </span>
      </Row>
      <Row label="Alineación">
        <div className="alignment">
          {['left', 'center', 'right', 'justify'].map((a) => (
            <button
              key={a}
              type="button"
              className={align === a ? 'active' : undefined}
              title={tt(a)}
              data-align={a}
              disabled={locked}
              onClick={() => commit(() => (selectObject()!.align = a), false)}
            >
              <Icon name={a} />
            </button>
          ))}
        </div>
      </Row>
      {objectFace ? null : (
        <div className="segmented">
          {(
            [
              ['bold', 'Negrita'],
              ['italic', 'Cursiva'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              data-style={key}
              className={o[key] ? 'active' : ''}
              disabled={locked}
              onClick={() =>
                commit(() => {
                  const target = selectObject()!;
                  target[key] = !target[key];
                }, false)
              }
            >
              {key === 'bold' ? <b>{tt(label)}</b> : <i>{tt(label)}</i>}
            </button>
          ))}
        </div>
      )}
      <Row label="Color">
        <input
          key={fieldKey('color', shown('color'))}
          data-object="color"
          type="color"
          defaultValue={shown('color')}
          disabled={locked}
          ref={objectField}
        />
      </Row>
      <Btn icon="text" label="Editar contenido" wide command="editText" disabled={locked} />
    </>
  );
};

// ── Carácter y párrafo ──

const extraField = onNativeChange<HTMLInputElement>((el) => {
  const n = Number(el.value);
  if (!Number.isFinite(n) || n < Number(el.min) || n > Number(el.max)) return;
  commit(() => (selectObject()![el.dataset.extra!] = n), false);
});

export const CharacterPanel = () => {
  useLanguage();
  const o = selectObject(),
    off = !o || o.type !== 'text' || !!o.toc,
    locked = !!o?.locked;
  return (
    <section className="section" data-section="Carácter y párrafo" data-key="text">
      <Heading icon="text" title="Carácter y párrafo" />
      <Row label="Tracking" term>
        <span className="unit-wrap">
          <input
            key={fieldKey('tracking', o?.tracking || 0)}
            data-extra="tracking"
            type="number"
            min="-100"
            max="500"
            defaultValue={o?.tracking || 0}
            disabled={off || locked}
            ref={extraField}
          />
          <span className="unit">‰</span>
        </span>
      </Row>
      <Row label="Sangría inicial" term>
        <span className="unit-wrap">
          <input
            key={fieldKey('indent', o?.indent || 0)}
            data-extra="indent"
            type="number"
            min="0"
            max="30"
            step=".5"
            defaultValue={o?.indent || 0}
            disabled={off || locked}
            ref={extraField}
          />
          <span className="unit">{lengthUnit()}</span>
        </span>
      </Row>
      <Row label="Espacio entre párrafos">
        <span className="unit-wrap">
          <input
            key={fieldKey('spaceAfter', o?.spaceAfter || 0)}
            data-extra="spaceAfter"
            type="number"
            min="0"
            max="30"
            step=".5"
            defaultValue={o?.spaceAfter || 0}
            disabled={off || locked}
            ref={extraField}
          />
          <span className="unit">{lengthUnit()}</span>
        </span>
      </Row>
      <Btn
        id="glyphPanel"
        label={bw('Glifos de la tipografía…', 'Typeface glyphs…', 'Glifos da tipografia…')}
        wide
        disabled={locked}
        onClick={() => void showFontGlyphs()}
      />
      <Btn id="openIndexFromText" label="Abrir Índice" wide onClick={() => showTab('index')} />
    </section>
  );
};

registerInspectorPanel('text:paragraph', () => <ParagraphPanel />, 'text-panels');
registerInspectorPanel('text:typography', () => <TypographyPanel />, 'text-panels');
registerInspectorPanel('text:character', () => <CharacterPanel />, 'text-panels');
