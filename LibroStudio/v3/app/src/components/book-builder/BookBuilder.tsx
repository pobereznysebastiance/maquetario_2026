// Contenido de la Ventana "Dale estructura a tu libro" (book-workflow.ts → bookBuilder, que la abre
// con modal.workspace y lee los campos al crear). Mismos ids que la versión en HTML: #novelTitle,
// #novelAuthor, #novelToc, #novelBlanks, #novelRule, #novel-dedication… y #novelSource.
//
// Los campos no son controlados: "Cargar novela de prueba" (#novelSample) los completa con la
// novela de muestra y la acción los lee al crear, como antes.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { Fragment, useRef } from 'react';
import { Field } from '../form/Form.tsx';
import type { NovelData } from '../../book-workflow.ts';

const EXTRA_PARTS = ['dedication', 'epigraph', 'legal', 'thanks', 'colophon'] as const;

const partLabel = (key: (typeof EXTRA_PARTS)[number]): string =>
  ({
    dedication: bw('Dedicatoria', 'Dedication', 'Dedicatória'),
    epigraph: bw('Epígrafe', 'Epigraph', 'Epígrafe'),
    legal: bw('Legales', 'Copyright', 'Créditos'),
    thanks: bw('Agradecimientos', 'Acknowledgements', 'Agradecimentos'),
    colophon: bw('Colofón', 'Colophon', 'Colofão'),
  })[key];

const BookBuilder = ({ data }: { data: NovelData }) => {
  const root = useRef<HTMLDivElement>(null);
  /** Completa los campos con la novela de muestra. */
  const loadSample = () => {
    const sample = novelSample();
    const field = (id: string) =>
      root.current!.querySelector<HTMLInputElement | HTMLTextAreaElement>('#' + id)!;
    field('novelTitle').value = sample.title;
    field('novelAuthor').value = sample.author;
    field('novelSource').value = sample.source;
    for (const key of EXTRA_PARTS) field('novel-' + key).value = sample[key] || '';
  };
  return (
    <div ref={root}>
      <div className="builder-steps">
        <span>1 · {bw('Datos', 'Details', 'Dados')}</span>
        <span>2 · {bw('Partes y manuscrito', 'Parts and manuscript', 'Partes e manuscrito')}</span>
        <span>3 · {bw('Crear y revisar', 'Create and review', 'Criar e revisar')}</span>
      </div>
      <p className="builder-intro">
        {bw(
          'Prepará todas las partes en un solo lugar. El manuscrito se distribuye según el espacio real de las páginas A5 y queda editable, con estilos vinculados.',
          'Prepare every part in one place. The manuscript is distributed using real A5 page space and remains editable with linked styles.',
          'Prepare todas as partes em um lugar. O manuscrito é distribuído pelo espaço real das páginas A5 e fica editável, com estilos vinculados.',
        )}
      </p>
      <div className="modal-grid">
        <Field
          id="novelTitle"
          label={bw('Título', 'Title', 'Título')}
          type="text"
          defaultValue={data.title}
        />
        <Field
          id="novelAuthor"
          label={bw('Autor/a', 'Author', 'Autor/a')}
          type="text"
          defaultValue={data.author}
        />
      </div>
      <div className="builder-parts">
        <label className="check-line">
          <input id="novelToc" type="checkbox" defaultChecked />
          {bw('Índice automático', 'Automatic contents', 'Sumário automático')}
        </label>
        <label className="check-line">
          <input id="novelBlanks" type="checkbox" defaultChecked />
          {bw('Blancos de cortesía', 'Blank versos', 'Versos em branco')}
        </label>
        <label className="check-line">
          <input id="novelRule" type="checkbox" />
          {bw('Línea en cornisas', 'Header rules', 'Linhas nos cabeçalhos')}
        </label>
      </div>
      <details>
        <summary>
          {bw(
            'Dedicatoria, epígrafe, legales y cierre',
            'Dedication, epigraph, copyright and closing',
            'Dedicatória, epígrafe, créditos e encerramento',
          )}
        </summary>
        {EXTRA_PARTS.map((key) => (
          <Fragment key={key}>
            <label className="builder-label" htmlFor={'novel-' + key}>
              {partLabel(key)}
            </label>
            <textarea
              id={'novel-' + key}
              className="builder-short"
              defaultValue={data[key] || ''}
            />
          </Fragment>
        ))}
      </details>
      <label className="builder-label" htmlFor="novelSource">
        {bw(
          'Manuscrito · empezá cada capítulo con # Título',
          'Manuscript · begin each chapter with # Title',
          'Manuscrito · inicie cada capítulo com # Título',
        )}
      </label>
      <textarea
        id="novelSource"
        className="builder-source"
        placeholder={bw(
          '# Capítulo 1\nPrimer párrafo…\n\n# Capítulo 2\n…',
          '# Chapter 1\nFirst paragraph…\n\n# Chapter 2\n…',
          '# Capítulo 1\nPrimeiro parágrafo…\n\n# Capítulo 2\n…',
        )}
        defaultValue={data.source}
      />
      <button type="button" id="novelSample" className="quiet" onClick={loadSample}>
        {bw('Cargar novela de prueba', 'Load test novel', 'Carregar romance de teste')}
      </button>
      <p className="help">
        {bw(
          'Crea un libro nuevo; el proyecto actual se conserva hasta confirmar. No hay reflujo automático entre cajas después de editar. Revisar libro detecta texto sobrante en todas las páginas.',
          'Creates a new book; the current project stays until you confirm. Frames do not automatically reflow after editing. Check book finds overset text on all pages.',
          'Cria um livro novo; o projeto atual fica até confirmar. As caixas não redistribuem texto após editar. Revisar livro detecta texto excedente em todas as páginas.',
        )}
      </p>
    </div>
  );
};

/** Elemento de la Ventana (lo llama book-workflow.ts, que no es .tsx). */
export const bookBuilderForm = (data: NovelData) => <BookBuilder data={data} />;
