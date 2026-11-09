// Hoja "Configurar libro" (libro nuevo o formato del actual): tamaños de página a la izquierda y
// datos del libro a la derecha. La abre settingsNew(isNew); settings(isNew) (studio.ts) pregunta
// antes por los cambios sin guardar. Al aplicar llama a applyBookSettings (studio.ts), que valida
// y hace el cambio, y que otros módulos extienden (review-workspace, publications).
//
// Mismos ids que antes (los usan las pruebas y la autoprueba): #newTitle, #pageUnits, #newWidth,
// #newHeight, #orientation, #newCount o #formatName, #spreadArrangement y, en un libro nuevo,
// #publicationType. Los campos guardan su valor en el elemento (no controlados): los botones de
// formato, la unidad y el producto editorial los cambian directamente, como hacía la versión en
// HTML, y al aplicar se leen de ahí.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '../../react/mount.tsx';
import { Control, Field, Select } from '../form/Form.tsx';
import { bw, i18n } from '../../i18n/language.ts';
import { editor, M } from '../../core-api.ts';
import { openSheet } from '../dialog/dialogs.tsx';

declare global {
  /** Abre la Hoja de formato del libro (nuevo con isNew; si no, el del libro actual). Se cumple al cerrarla. */
  var settingsNew: (isNew?: boolean) => Promise<void> | undefined;
}

const tr = (text: string): string => i18n.tr(text);

/** Valor de un campo de medida al pasar de mm a cm (o al revés), como lo escribe la Hoja. */
const convert = (value: string, cm: boolean): string =>
  (Number(value) * (cm ? 0.1 : 10)).toFixed(cm ? 5 : 4).replace(/\.?0+$/, '');

/** Formato elegido en la Hoja abierta: el del libro al abrir, el del botón tocado o 'Personalizado'. */
let chosenFormat = '';

const BookSetup = ({ isNew }: { isNew: boolean }) => {
  useLanguage();
  const [activeFormat, setActiveFormat] = useState<string | null>(editor.book.format);
  const [cm, setCm] = useState(false);
  const title = useRef<HTMLInputElement>(null);
  const width = useRef<HTMLInputElement>(null);
  const height = useRef<HTMLInputElement>(null);
  const count = useRef<HTMLInputElement>(null);
  const formatName = useRef<HTMLInputElement>(null);
  const units = useRef<HTMLSelectElement>(null);
  const orientation = useRef<HTMLSelectElement>(null);
  const formats = M.formats as Record<string, [number, number]>;

  const setFormat = (name: string, active: string | null) => {
    chosenFormat = name;
    setActiveFormat(active);
    if (formatName.current) formatName.current.value = name;
  };
  const chooseFormat = (name: string) => {
    let [w, h] = formats[name];
    if (orientation.current!.value === 'landscape') [w, h] = [h, w];
    const u = units.current!.value === 'cm' ? 10 : 1;
    width.current!.value = String(w / u);
    height.current!.value = String(h / u);
    setFormat(name, name);
  };
  // Medidas escritas a mano: el formato pasa a Personalizado.
  const markCustom = () => setFormat('Personalizado', null);
  const changeUnit = (unit: string) => {
    const toCm = unit === 'cm';
    setCm(toCm);
    for (const input of [width.current!, height.current!]) {
      input.value = convert(input.value, toCm);
      input.min = String(toCm ? 6 : 60);
      input.max = String(input === width.current ? (toCm ? 42 : 420) : toCm ? 59.4 : 594);
      input.step = String(toCm ? 0.01 : 0.1);
    }
  };
  const swapOrientation = () => {
    const w = width.current!.value,
      h = height.current!.value;
    width.current!.value = h;
    height.current!.value = w;
  };
  const choosePublication = (type: string) => {
    const p = publicationTypes[type];
    const divisor = units.current!.value === 'cm' ? 10 : 1;
    width.current!.value = String(p.w / divisor);
    height.current!.value = String(p.h / divisor);
    markCustom();
    count.current!.value = String(p.count);
    title.current!.value = bw(...p.labels);
  };
  // Un libro en centímetros abre la Hoja en centímetros.
  useLayoutEffect(() => {
    if (editor.book.measurementUnit === 'cm') {
      units.current!.value = 'cm';
      changeUnit('cm');
    }
  }, []);

  return (
    <div className="book-setup" data-book-setup={isNew ? 'new' : 'current'}>
      <section className="book-setup-sizes">
        <p className="book-setup-label">
          {bw('Tamaño de página', 'Page size', 'Tamanho da página')}
        </p>
        <div className="format-options">
          {Object.entries(formats).map(([name, [w, h]]) => (
            <button
              key={name}
              type="button"
              className={activeFormat === name ? 'format-option active' : 'format-option'}
              data-format={name}
              onClick={() => chooseFormat(name)}
            >
              <strong>{name}</strong>
              <small>
                {(cm ? w / 10 : w) + ' × ' + (cm ? h / 10 : h) + ' ' + (cm ? 'cm' : 'mm')}
              </small>
            </button>
          ))}
        </div>
        <div className="notice">
          {tr(
            'Medidas reales, sin depender del tamaño de tu pantalla. ' +
              (isNew
                ? 'El libro comienza con páginas vacías y elementos automáticos.'
                : 'Al cambiar el formato, los objetos se conservan y se ajustan al área de la página. Podés deshacer el cambio.'),
          )}
        </div>
      </section>
      <section className="book-setup-fields">
        {isNew ? (
          <div className="publication-picker">
            <label htmlFor="publicationType">
              {bw('Producto editorial', 'Publication type', 'Produto editorial')}
            </label>
            <Select
              id="publicationType"
              options={Object.entries(publicationTypes).map(([value, p]) => ({
                value,
                label: bw(...p.labels),
              }))}
              defaultValue="book"
              onChange={choosePublication}
            />
            <p className="help">
              {bw(
                'Punto de partida editable: formato, cantidad de páginas, márgenes y grilla.',
                'Editable starting point: format, page count, margins and grid.',
                'Ponto de partida editável: formato, páginas, margens e grade.',
              )}
            </p>
          </div>
        ) : null}
        <div className="modal-grid">
          <Field
            id="newTitle"
            label="Título del libro"
            type="text"
            defaultValue={isNew ? 'Mi libro' : editor.book.title}
            full
            inputRef={title}
          />
          <Control label="Unidad de medida" full>
            <Select
              id="pageUnits"
              options={[
                { value: 'mm', label: 'Milímetros (mm)' },
                { value: 'cm', label: 'Centímetros (cm)' },
              ]}
              defaultValue="mm"
              selectRef={units}
              onChange={changeUnit}
            />
          </Control>
          <Field
            id="newWidth"
            label={cm ? 'Ancho · cm' : 'Ancho · mm'}
            defaultValue={editor.book.width}
            min={60}
            max={420}
            inputRef={width}
            onInput={markCustom}
          />
          <Field
            id="newHeight"
            label={cm ? 'Alto · cm' : 'Alto · mm'}
            defaultValue={editor.book.height}
            min={60}
            max={594}
            inputRef={height}
            onInput={markCustom}
          />
          <Control label="Orientación">
            <Select
              id="orientation"
              options={[
                { value: 'portrait', label: 'Vertical' },
                { value: 'landscape', label: 'Horizontal' },
              ]}
              defaultValue={editor.book.width > editor.book.height ? 'landscape' : 'portrait'}
              selectRef={orientation}
              onChange={swapOrientation}
            />
          </Control>
          {isNew ? (
            <Field
              id="newCount"
              label="Cantidad de páginas"
              defaultValue={8}
              min={1}
              max={200}
              inputRef={count}
            />
          ) : (
            <Field
              id="formatName"
              label="Formato"
              type="text"
              defaultValue={editor.book.format}
              readOnly
              inputRef={formatName}
            />
          )}
          <Control
            label={bw('Disposición de páginas', 'Page arrangement', 'Disposição das páginas')}
            htmlFor="spreadArrangement"
            full
          >
            <Select
              id="spreadArrangement"
              options={[
                {
                  value: 'single',
                  label: bw('Página individual', 'Single pages', 'Páginas individuais'),
                },
                {
                  value: 'horizontal',
                  label: bw(
                    'Pliego horizontal · lado a lado',
                    'Horizontal spread · side by side',
                    'Dupla horizontal · lado a lado',
                  ),
                },
                {
                  value: 'vertical',
                  label: bw(
                    'Pliego vertical · tipo almanaque',
                    'Vertical spread · calendar style',
                    'Dupla vertical · tipo calendário',
                  ),
                },
              ]}
              defaultValue={
                !editor.book.facing ? 'single' : verticalSpread() ? 'vertical' : 'horizontal'
              }
            />
          </Control>
        </div>
      </section>
    </div>
  );
};

/** Lee la Hoja abierta y aplica (applyBookSettings tira el error que muestra la Hoja). */
function applyFromSheet(isNew: boolean): boolean {
  const value = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  return applyBookSettings(isNew, {
    title: value('newTitle'),
    width: value('newWidth'),
    height: value('newHeight'),
    count: value('newCount'),
    unit: value('pageUnits') === 'cm' ? 'cm' : 'mm',
    arrangement: value('spreadArrangement'),
    format: chosenFormat,
    publicationType: isNew ? value('publicationType') : undefined,
  });
}

globalThis.settingsNew = function (isNew = true) {
  if (editor.busy) return;
  finishEditing();
  chosenFormat = editor.book.format;
  return openSheet(<BookSetup isNew={isNew} />, {
    title: isNew
      ? bw('Crear un libro', 'Create a book', 'Criar um livro')
      : 'Configuración del libro',
    action: {
      label: isNew ? bw('Crear libro', 'Create book', 'Criar livro') : 'Aplicar al libro',
      run: () => applyFromSheet(isNew),
    },
    size: 'lg',
    variant: 'book-setup-dialog',
  });
};
