// "Revisar libro" (preflight) en React: una Hoja con lo que encuentra preflightBook() en todas las
// páginas (texto sobrante y objetos fuera de página), un botón para ir a cada problema y, como
// acción, pasar a la revisión de la salida PDF. Se abre con preflightDialog() (book-workflow.ts):
// desde la barra del documento y desde el paso 4 del recorrido del libro.
//
// La revisión se hace al abrir (preflightBook arma cada página aparte): la Hoja muestra ese
// resultado; para volver a revisar, se cierra y se abre otra vez.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import type { PreflightIssue } from '../../book-workflow.ts';
import { Icon } from '../Icon.tsx';

const PreflightReport = ({ issues, pages }: { issues: PreflightIssue[]; pages: number }) => (
  <>
    <p className="builder-intro">
      {pages}{' '}
      {bw(
        'páginas revisadas. Este control comprueba texto sobrante y objetos fuera de página.',
        'pages checked. This checks overset text and objects outside the page.',
        'páginas revisadas. Este controle verifica texto excedente e objetos fora da página.',
      )}
    </p>
    {issues.length ? (
      issues.map((issue, i) => (
        <div className="preflight-item warn" key={i}>
          {bw('Página', 'Page', 'Página')} {issue.page + 1} ·{' '}
          {issue.kind === 'overflow'
            ? bw('Texto sobrante', 'Overset text', 'Texto excedente')
            : bw('Objeto fuera de página', 'Object outside page', 'Objeto fora da página')}
          <button
            type="button"
            className="preflight-link"
            data-issue-page={issue.page}
            onClick={() => {
              closeSheet();
              goToBookPage(issue.page);
              showTab('text');
            }}
          >
            {bw('Ir a la página', 'Go to page', 'Ir à página')}
          </button>
        </div>
      ))
    ) : (
      <div className="preflight-item ok">
        <Icon name="check" />
        {bw(
          'Sin desbordamientos ni objetos fuera de página.',
          'No overset text or objects outside the page.',
          'Sem texto excedente nem objetos fora da página.',
        )}
      </div>
    )}
    <p className="help">
      {bw(
        'Revisá también ortografía, cortes de párrafo y calidad de imágenes. Cambiar un estilo puede hacer que sobre texto: repetí este control antes de exportar.',
        'Also review spelling, paragraph breaks and image quality. Style changes may cause overset text: repeat this check before exporting.',
        'Revise também ortografia, quebras de parágrafo e qualidade de imagens. Alterar um estilo pode causar excesso: repita este controle antes de exportar.',
      )}
    </p>
  </>
);

/** Revisa el libro y muestra el resultado. Sin libro, ofrece crear uno (como antes). */
export function openPreflight(): void {
  if (!hasDocument) {
    settings(true);
    return;
  }
  const issues = preflightBook();
  void openSheet(<PreflightReport issues={issues} pages={book.pages.length} />, {
    title: 'Revisar el libro completo',
    action: {
      label: 'Revisar salida PDF',
      run: () => {
        setTimeout(() => outputDialog('pdf'), 30);
      },
    },
  });
}
