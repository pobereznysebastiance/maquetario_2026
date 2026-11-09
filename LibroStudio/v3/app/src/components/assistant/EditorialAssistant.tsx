// Asistente editorial (organismo "assistant"): Ventana de trabajo en React (modal.workspace →
// openWorkWindow). Columna de acciones (revisión automática, conexión con el aula, consulta con
// IA con autorización explícita) y, al lado, el resumen y los hallazgos con sus acciones: ver en
// el libro, quitar espacios repetidos (con deshacer) e ignorar.
//
// La lógica y el estado viven en src/editorial-assistant.ts (assistant, automaticEditorialReview,
// classroomPayload…). La Ventana los lee al dibujarse y se redibuja con useEditorState(): avisan
// las acciones de este archivo, los accesores que usan las pruebas (editorialReport…) y el núcleo
// cuando cambia el libro (así el aviso "El libro cambió" aparece en cuanto se edita).
//
// Ids que usan las pruebas y la autoprueba (tests/assistant-tests.js): #assistantConsent,
// #assistantFindings [data-finding-fix], #runAutomaticReview, #runClassroomAI. El aspecto sale de
// ui/organisms/assistant.css y dialog-content.css.
//
// Fuente TypeScript: viaja dentro de build/app.js (src/entries/app.ts).

import { useState } from 'react';
import { useLanguage } from '../../react/mount.tsx';
import { notifyEditorState, useEditorState } from '../../react/editor-state.ts';
import {
  assistant,
  type ClassServiceInfo,
  type EditorialFinding,
} from '../../editorial-assistant.ts';

declare global {
  /** Abre la Ventana del asistente (avisa si no hay un libro abierto). */
  var openEditorialAssistant: () => Promise<void>;
  /** Corre la revisión automática y deja el informe en el asistente. */
  var runAutomaticReview: () => Promise<void>;
}

/** Ir al hallazgo: cierra la Ventana y selecciona el objeto (o abre la cubierta). */
function goToFinding(item: EditorialFinding): void {
  closeSheet();
  if (item.kind === 'cover') {
    setTimeout(coverEditor, 30);
    return;
  }
  const index = book.pages.findIndex((p) => p.id === item.pageId);
  if (index < 0) return;
  goToBookPage(index);
  selected = book.pages[index].objects.some((o) => o.id === item.objectId) ? item.objectId : null;
  showTab(selectObject()?.type === 'text' ? 'text' : 'object');
  render(true);
}

function ignoreFinding(item: EditorialFinding): void {
  item.ignored = true;
  notifyEditorState();
}

/** Quita los espacios repetidos de la caja del hallazgo (se puede deshacer). */
function fixSpaces(item: EditorialFinding): void {
  const target = book.pages
    .find((p) => p.id === item.pageId)
    ?.objects.find((o) => o.id === item.objectId);
  if (!target || target.locked) return;
  commit(() => (target.text = target.text.replace(/(\S) {2,}(?=\S)/g, '$1 ')), false);
  item.ignored = true;
  notifyEditorState();
  toast(
    bw(
      'Espacios corregidos. Podés deshacer el cambio.',
      'Spaces corrected. You can undo this change.',
      'Espaços corrigidos. Você pode desfazer.',
    ),
  );
}

const Finding = ({ item }: { item: EditorialFinding }) => {
  const index = book.pages.findIndex((p) => p.id === item.pageId);
  return (
    <article className={`assistant-finding ${item.severity}`}>
      <div className="assistant-finding-heading">
        <span className="assistant-status" aria-hidden="true"></span>
        <h3>{item.title}</h3>
        <small>
          {item.source === 'ai' ? 'IA' : bw('Automática', 'Automatic', 'Automática')}
          {index >= 0 ? ' · ' + bw('Página', 'Page', 'Página') + ' ' + (index + 1) : ''}
        </small>
      </div>
      <p>{item.detail}</p>
      <div className="assistant-suggestion">{item.suggestion}</div>
      <div className="assistant-finding-actions">
        <button
          type="button"
          className="btn"
          data-finding-go={item.id}
          onClick={() => goToFinding(item)}
        >
          {bw('Ver en el libro', 'View in the book', 'Ver no livro')}
        </button>
        {item.fix === 'spaces' ? (
          <button
            type="button"
            className="btn"
            data-finding-fix={item.id}
            onClick={() => fixSpaces(item)}
          >
            {bw('Quitar espacios repetidos', 'Remove repeated spaces', 'Remover espaços repetidos')}
          </button>
        ) : null}
        <button
          type="button"
          className="quiet"
          data-finding-ignore={item.id}
          onClick={() => ignoreFinding(item)}
        >
          {bw('Ignorar', 'Ignore', 'Ignorar')}
        </button>
      </div>
    </article>
  );
};

const EmptyReport = () => (
  <div className="assistant-empty">
    <span>✦</span>
    <h3>
      {assistant.stamp
        ? bw('Sin hallazgos pendientes', 'No pending findings', 'Sem observações pendentes')
        : bw(
            'Una mirada más antes de publicar',
            'One more look before publishing',
            'Mais uma revisão antes de publicar',
          )}
    </h3>
    <p>
      {bw(
        'La revisión automática comprueba texto sobrante, límites de página, fuentes, resolución y algunas coincidencias geométricas. No sustituye la revisión editorial completa.',
        'Automatic review checks overset text, page bounds, fonts, resolution and selected geometric issues. It does not replace a complete editorial review.',
        'A revisão automática verifica excesso de texto, limites, fontes, resolução e algumas relações geométricas. Não substitui a revisão editorial completa.',
      )}
    </p>
  </div>
);

export const EditorialAssistant = () => {
  useEditorState();
  useLanguage();
  const [scope, setScope] = useState('page');
  const [consent, setConsent] = useState(false);
  const { configured } = assistant.service;
  const visible = assistant.report.filter((x) => !x.ignored);
  return (
    <>
      <div className="assistant-hero">
        <div>
          <h2>{bw('Revisar mi libro', 'Review my book', 'Revisar meu livro')}</h2>
          <p>
            {bw(
              'Encontrá detalles, entendé el motivo y decidí qué cambiar.',
              'Find details, understand why and decide what to change.',
              'Encontre detalhes, entenda o motivo e decida o que mudar.',
            )}
          </p>
        </div>
      </div>
      <div className="assistant-workspace">
        <aside>
          <button
            type="button"
            className="btn assistant-run"
            id="runAutomaticReview"
            disabled={assistant.running === 'auto'}
            onClick={() => void runAutomaticReview()}
          >
            {bw('Revisión automática', 'Automatic review', 'Revisão automática')}
          </button>
          <p className="help">
            {bw(
              'Sin conexión. No envía contenido.',
              'Offline. Sends no content.',
              'Sem conexão. Não envia conteúdo.',
            )}
          </p>
          <hr />
          <h3>{bw('IA del aula', 'Classroom AI', 'IA da turma')}</h3>
          <p className="help" id="assistantConnection">
            {configured
              ? bw('Aula conectada', 'Classroom connected', 'Turma conectada')
              : bw(
                  'Pendiente de conectar al servicio del docente.',
                  'Waiting for the teacher service connection.',
                  'Aguardando conexão ao serviço do docente.',
                )}
          </p>
          <button
            type="button"
            className="btn wide"
            id="assistantConnect"
            onClick={configureClassroom}
          >
            {bw('Conectar aula', 'Connect classroom', 'Conectar turma')}
          </button>
          <label className="builder-label" htmlFor="assistantScope">
            {bw('Consulta con IA', 'AI review scope', 'Consulta com IA')}
          </label>
          <select id="assistantScope" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="page">{bw('Página activa', 'Active page', 'Página ativa')}</option>
            <option value="structure">
              {bw('Estructura del libro', 'Book structure', 'Estrutura do livro')}
            </option>
          </select>
          <p className="help">
            {bw(
              'Página activa: envía texto y medidas, hasta 20.000 caracteres. Estructura: solo títulos de partes y medidas, sin el cuerpo del manuscrito. No envía imágenes ni archivos.',
              'Active page: sends text and dimensions, up to 20,000 characters. Structure: only part titles and dimensions, without manuscript body text. Sends no images or files.',
              'Página ativa: envia texto e medidas, até 20.000 caracteres. Estrutura: apenas títulos das partes e medidas, sem o corpo do manuscrito. Não envia imagens nem arquivos.',
            )}
          </p>
          <label className="check-line assistant-consent">
            <input
              type="checkbox"
              id="assistantConsent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {bw(
              'Autorizo enviar esta consulta al servicio de IA del aula.',
              'I authorize sending this query to the classroom AI service.',
              'Autorizo enviar esta consulta ao serviço de IA da turma.',
            )}
          </label>
          <button
            type="button"
            className="btn wide"
            id="runClassroomAI"
            disabled={!configured || assistant.running === 'ai'}
            onClick={() => void runClassroomReview(scope, consent)}
          >
            {bw('Consultar IA', 'Ask AI', 'Consultar IA')}
          </button>
          <p className="help">
            {bw(
              'Las sugerencias de IA pueden equivocarse. No cambian el libro automáticamente.',
              'AI suggestions can be wrong. They do not change the book automatically.',
              'Sugestões da IA podem estar erradas. Não alteram o livro automaticamente.',
            )}
          </p>
        </aside>
        <section>
          <div id="assistantSummary">
            {assistant.progress ||
              assistant.summary ||
              bw(
                'Elegí una revisión para comenzar.',
                'Choose a review to start.',
                'Escolha uma revisão para começar.',
              )}
          </div>
          <p
            className="notice"
            id="assistantStale"
            hidden={!assistant.stamp || assistant.stamp === reviewStamp()}
          >
            {bw(
              'El libro cambió. Repetí la revisión para actualizar los hallazgos.',
              'The book changed. Run the review again to refresh findings.',
              'O livro mudou. Repita a revisão para atualizar as observações.',
            )}
          </p>
          <div id="assistantFindings">
            {visible.length ? (
              visible.map((item) => <Finding key={item.id} item={item} />)
            ) : (
              <EmptyReport />
            )}
          </div>
          <p id="assistantError" className="inline-error">
            {assistant.error}
          </p>
        </section>
      </div>
    </>
  );
};

async function openEditorialAssistant(): Promise<void> {
  if (!hasDocument) {
    toast(
      bw(
        'Creá o abrí un libro para revisarlo.',
        'Create or open a book to review it.',
        'Crie ou abra um livro para revisá-lo.',
      ),
      'info',
    );
    return;
  }
  try {
    assistant.service = await nativeCall('assistantStatus');
  } catch {}
  // Cada apertura empieza sin el aviso de progreso ni el error de la anterior.
  assistant.progress = assistant.error = '';
  modal.workspace('Asistente editorial', <EditorialAssistant />, { variant: 'assistant-modal' });
}

async function runAutomaticReview(): Promise<void> {
  if (assistant.busy) return;
  assistant.busy = true;
  assistant.running = 'auto';
  assistant.error = '';
  const stamp = reviewStamp();
  try {
    assistant.progress = bw(
      'Revisando todas las páginas…',
      'Reviewing all pages…',
      'Revisando todas as páginas…',
    );
    notifyEditorState();
    const issues = await automaticEditorialReview();
    assistant.report = issues;
    assistant.stamp = stamp;
    assistant.summary = `${book.pages.length} ${bw('páginas revisadas', 'pages reviewed', 'páginas revisadas')} · ${issues.length} ${bw('hallazgos para comprobar', 'findings to check', 'observações para conferir')}`;
    assistant.progress = '';
  } catch (e) {
    assistant.error = (e as Error).message;
  } finally {
    assistant.busy = false;
    assistant.running = null;
    notifyEditorState();
  }
}

/** Contenido de la Hoja "Conectar el aula": código del aula y, para el docente, la dirección. */
const ClassroomForm = ({ service }: { service: ClassServiceInfo }) => {
  useLanguage();
  return (
    <>
      <p className="builder-intro">
        {bw(
          'Tu docente te entrega un código. La clave del proveedor de IA nunca se instala en los equipos de estudiantes.',
          'Your teacher provides a code. The AI provider key is never installed on student computers.',
          'Seu docente fornece um código. A chave do provedor de IA nunca é instalada nos computadores dos alunos.',
        )}
      </p>
      <label className="builder-label" htmlFor="classCode">
        {bw('Código de aula', 'Classroom code', 'Código da turma')}
      </label>
      <input
        id="classCode"
        type="password"
        autoComplete="off"
        maxLength={200}
        placeholder={
          service.configured
            ? bw('Dejar vacío para conservar', 'Leave blank to keep', 'Deixar vazio para manter')
            : ''
        }
      />
      <details open={!service.serviceUrl}>
        <summary>
          {bw('Configuración del docente', 'Teacher setup', 'Configuração do docente')}
        </summary>
        <label className="builder-label" htmlFor="classUrl">
          {bw(
            'Dirección del servicio del aula',
            'Classroom service address',
            'Endereço do serviço da turma',
          )}
        </label>
        <input
          id="classUrl"
          type="url"
          defaultValue={service.serviceUrl || ''}
          placeholder="https://…"
        />
        <p className="help">
          {bw(
            'Podés distribuir maquetario-aula.json junto al ejecutable con esta dirección. Los estudiantes solo ingresan el código. El servicio central se publica por separado.',
            'Distribute maquetario-aula.json next to the executable with this address. Students only enter the code. Publish the central service separately.',
            'Distribua maquetario-aula.json junto ao executável com este endereço. Alunos só informam o código. O serviço central é publicado separadamente.',
          )}
        </p>
      </details>
    </>
  );
};

/** Conexión con el servicio del aula (Hoja; al guardar vuelve a abrir el asistente). */
function configureClassroom(): void {
  modal.sheet(
    bw('Conectar el aula', 'Connect classroom', 'Conectar turma'),
    <ClassroomForm service={assistant.service} />,
    async () => {
      await nativeCall('assistantConfigure', {
        url: $('#classUrl').value.trim(),
        code: $('#classCode').value.trim(),
      });
      setTimeout(openEditorialAssistant, 30);
    },
    bw('Guardar conexión', 'Save connection', 'Salvar conexão'),
    { size: 'sm' },
  );
}

/** Consulta a la IA del aula con el alcance elegido; sin autorización no se envía nada. */
async function runClassroomReview(scope: string, consent: boolean): Promise<void> {
  if (assistant.busy) return;
  if (!consent) {
    assistant.error = bw(
      'Marcá la autorización antes de enviar.',
      'Authorize the query before sending.',
      'Autorize a consulta antes de enviar.',
    );
    notifyEditorState();
    return;
  }
  const payload = classroomPayload(scope);
  const stamp = reviewStamp();
  assistant.busy = true;
  assistant.running = 'ai';
  assistant.error = '';
  try {
    assistant.progress = bw(
      'Consultando la IA del aula…',
      'Asking the classroom AI…',
      'Consultando a IA da turma…',
    );
    notifyEditorState();
    const result = await nativeCall('assistantReview', { consent: true, document: payload });
    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.issues))
      throw Error(
        bw(
          'El servicio devolvió una respuesta no válida.',
          'The service returned an invalid response.',
          'O serviço retornou uma resposta inválida.',
        ),
      );
    const allowedPages = new Set(payload.pages.map((p) => p.id));
    // La respuesta del servicio es JSON sin tipo: estos filtros son su validación.
    const suggestions: EditorialFinding[] = (result.issues as any[])
      .slice(0, 30)
      .filter(
        (i) =>
          allowedPages.has(i.pageId) &&
          ['warning', 'tip'].includes(i.severity) &&
          [i.title, i.detail, i.suggestion].every((v) => typeof v === 'string' && v.length < 3000),
      )
      .map((i) => ({ ...i, id: M.uid(), source: 'ai', kind: 'ai', fix: null }));
    assistant.report = assistant.report.filter((i) => i.source !== 'ai').concat(suggestions);
    assistant.stamp = stamp;
    assistant.summary =
      result.summary.slice(0, 3000) +
      (payload.truncated
        ? bw(
            ' · El texto enviado fue recortado al límite.',
            ' · Submitted text was truncated to the limit.',
            ' · O texto enviado foi limitado.',
          )
        : '');
    assistant.progress = '';
  } catch (e) {
    assistant.error = (e as Error).message;
  } finally {
    assistant.busy = false;
    assistant.running = null;
    notifyEditorState();
  }
}

globalThis.openEditorialAssistant = openEditorialAssistant;
globalThis.runAutomaticReview = runAutomaticReview;
