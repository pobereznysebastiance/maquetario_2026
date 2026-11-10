// El arranque de la interfaz: los oyentes del lienzo, de los
// archivos elegidos, de las pestañas y de los atajos del editor, el primer dibujo y el aviso de
// "listo" al anfitrión. Lo importa src/entries/core.ts al final, así corre después de todo core y
// antes que app (los oyentes quedan en el mismo orden frente a los de los módulos de app).
//
// Fuente TypeScript: viaja dentro de build/core.js (src/entries/core.ts).
import { $, $$ } from './utils.ts';
import { icons } from './icons.ts';
import { canvasHit, imageInputChange } from './editing.ts';
import { anyCommandKey, commandKey, isDeleteKey, isRedoKey } from '../keys.ts';

// ── Eventos del lienzo, delegados en #spread ──
// El papel no lleva oyentes propios: un solo oyente por evento en #spread busca la página y el
// objeto, y llama a objectDown, pageDown o startEditing con los mismos argumentos de antes (sus
// extensiones no cambian). Los nodos del papel se rehacen en cada dibujo; #spread queda.
{
  const host = $('#spread');
  host.addEventListener('pointerdown', (e) => {
    const hit = canvasHit(e.target);
    if (!hit) return;
    const { page, i, el, o } = hit;
    if (el && o) {
      // Desde una manija: la de tamaño (true) o un controlador con su dirección (frame-handles).
      const handle = (e.target as Element).closest<HTMLElement>('.resize-handle');
      objectDown(e, o, i, el, handle ? handle.dataset.handle || true : false);
      // Como cuando el objeto tenía su oyente: si objectDown no detuvo el evento, sigue a la página.
      if (e.cancelBubble) return;
    }
    pageDown(e, i, page);
  });
  // Doble clic en una caja de texto: editarla (el Índice abre su vista: editorial.ts).
  host.addEventListener('dblclick', (e) => {
    const hit = canvasHit(e.target);
    if (!hit?.el || hit.o?.type !== 'text') return;
    e.stopPropagation();
    active = hit.i;
    selected = hit.o.id;
    startEditing(hit.el);
  });
  // El texto que se escribe en la caja en edición.
  host.addEventListener('input', (e) => {
    const t = e.target instanceof Element ? e.target.closest<HTMLElement>('.text-content') : null,
      hit = canvasHit(t);
    if (!t || !hit?.o || hit.o.type !== 'text') return;
    hit.o.text = t.innerText.replace(/\r/g, '');
    changed();
  });
  // La caja en edición pierde el foco ("blur" no sube: focusout sí).
  host.addEventListener('focusout', (e) => {
    if (e.target instanceof Element && e.target.matches('.paper-object > .text-content'))
      finishEditing();
  });
}
$('#imageInput').onchange = imageInputChange;
$('#openInput').onchange = async (e: Event) => {
  try {
    const file = (e.target as HTMLInputElement).files![0];
    if (file) loadProject(await file.text());
  } catch (error) {
    toast('No se pudo abrir: ' + (error as Error).message, 'error');
  }
  (e.target as HTMLInputElement).value = '';
};
// Íconos de lo que quedó en HTML (la barra superior y el riel los dibuja React).
icons();
$$('.tab').forEach((el) => (el.onclick = () => showTab(el.dataset.tab!)));
$('#addPage').onclick = () => command('addPage');
document.addEventListener('keydown', (e) => {
  // Con un diálogo abierto (todos viven en #dialogLayer), los atajos del editor no corren: Ctrl+S,
  // Ctrl+Z o Supr no tienen que tocar el libro por detrás de una Hoja.
  if (document.querySelector('#dialogLayer dialog[open]')) return;
  const input = (e.target as Element).closest?.('input,textarea,select,[contenteditable="true"]');
  if (commandKey(e) && !e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProject();
    return;
  }
  if (input) return;
  // Rehacer primero: en macOS es ⇧⌘Z.
  if (isRedoKey(e)) {
    e.preventDefault();
    redo();
    return;
  }
  if (commandKey(e) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
    return;
  }
  if (isDeleteKey(e)) {
    e.preventDefault();
    command('deleteObject');
  }
  if (e.key === 'Escape') {
    finishEditing();
    selected = null;
    tool = 'select';
    render(false);
  }
  // Teclas sueltas: con Ctrl, ⌘ o Alt son otro atajo (⌘V no elige Seleccionar).
  if (!anyCommandKey(e) && !e.altKey) {
    const t = { v: 'select', t: 'text', i: 'image', f: 'frame' }[e.key.toLowerCase()];
    if (t) setTool(t);
  }
});
new ResizeObserver(() => {
  if (!editing && !drag) renderPages();
}).observe($('#spreadStage'));
window.addEventListener('beforeunload', (e) => {
  if (dirty && !native) {
    e.preventDefault();
    e.returnValue = '';
  }
});
render(true);
if (MaquetarioHost.available)
  nativeCall('ready', {})
    .then((info) => {
      native = true;
      fontList = [...new Set(['Georgia', 'Times New Roman', 'Garamond', ...(info.fonts || [])])];
      inspector();
    })
    .catch((e) => toast(e.message, 'error'));
