// Autoprueba: `npm run self-test` (o Maquetario --self-test [--out=<carpeta>]).
// Port de la parte verificable del self-test de Host.cs: pruebas de integración
// de la interfaz, PDF reales, guardado, recientes y paquete. Deja los resultados
// en la carpeta de salida y un resumen.json; sale con código 1 si algo falla.
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { argValue, dataDir, rendererDir } from './env.ts';
import { writeAtomic } from './files.ts';
import { readFaces } from './fonts/opentype.ts';
import { replacePackageFaces, setPackageFonts, getPackageFaces } from './fonts/catalog.ts';
import { pdf, prepareOutput } from './handlers/output.ts';
import { createProjectPackage, type PackageRequest } from './handlers/package.ts';
import { readRecents, recordRecent, saveProject } from './handlers/project.ts';
import { delay, exec, type Session } from './session.ts';

type StepResult = { step: string; ok: boolean; detail?: unknown; error?: string };

export async function runSelfTest(session: Session): Promise<boolean> {
  const out = argValue('out') ?? join(dataDir(), 'self-test');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const results: StepResult[] = [];
  const A5 = { width: 148, height: 210 };

  const step = async (name: string, work: () => Promise<unknown>) => {
    try {
      const detail = await work();
      results.push({ step: name, ok: true, detail });
    } catch (error) {
      results.push({ step: name, ok: false, error: error instanceof Error ? error.stack ?? error.message : String(error) });
      await exec(session, 'window.clearPrint&&window.clearPrint()').catch(() => undefined);
    }
  };
  /** Las pruebas de la interfaz devuelven {ok, checks} (a veces como texto JSON). */
  const uiSuite = async (file: string, expression: string) => {
    const raw = await exec<unknown>(session, expression);
    const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    await writeFile(join(out, file), JSON.stringify(value, null, 2));
    const ok = (value as { ok?: unknown } | null)?.ok;
    if (ok === false || (value as { error?: unknown } | null)?.error) throw new Error(JSON.stringify(value));
    return { checks: ((value as { checks?: unknown[] }).checks ?? []).length };
  };
  const writePdf = async (file: string, prepare: string, page = A5, wait = 350) => {
    await exec(session, prepare);
    await delay(wait);
    const bytes = await pdf(session, page);
    await exec(session, 'window.clearPrint()');
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`PDF inválido: ${file}`);
    await writeFile(join(out, file), bytes);
    return { bytes: bytes.length };
  };
  const capture = async (file: string) => writeFile(join(out, file), (await session.win.webContents.capturePage()).toPNG());

  await delay(500);
  await step('interfaz: pruebas de integración', () =>
    uiSuite('verificacion.json', '(()=>{try{return window.runIntegrationTests()}catch(e){return JSON.stringify({ok:false,error:e.stack})}})()'),
  );
  await step('guardar sobre un archivo existente', () => checkProjectSaving(session));
  await step('proyectos recientes', () => checkRecents());
  await step('fuentes del sistema', () =>
    uiSuite('verificacion-fuentes.json', 'window.runFontIntegrationTests().catch(e=>({ok:false,error:e.message}))'),
  );
  await step('captura del editor', async () => {
    await exec(session, 'window.showHandlePreview()');
    await delay(150);
    await capture('editor.png');
  });
  await step('PDF de lectura', () => writePdf('prueba-lectura.pdf', 'window.preparePrint()', A5, 450));
  await step('PDF del índice', () => writePdf('prueba-indice.pdf', 'window.prepareIndexPrint()', A5, 200));
  await step('PDF con marcas de corte', () =>
    writePdf('prueba-marcas.pdf', 'window.prepareMarkedOutputTest()', { width: 162, height: 224 }, 300),
  );
  await step('PDF tipográfico', async () => {
    await exec(session, 'window.prepareFontPdfTest()');
    return writePdf('prueba-fuentes.pdf', 'void 0', A5, 200);
  });
  await step('PDF de párrafos', () => writePdf('prueba-parrafos.pdf', 'window.prepareParagraphPdfTest()', A5, 200));
  await step('novela de prueba', async () => {
    const report = await exec<string>(session, 'window.prepareNovelProof()');
    await writeFile(join(out, 'prueba-novela.json'), report);
    await writeFile(join(out, 'El atlas de las casas vacias.mqt'), await exec<string>(session, 'window.novelProofContent()'));
    await delay(250);
    await capture('novela.png');
    return writePdf('El atlas de las casas vacias.pdf', 'window.prepareNovelPdf()', A5, 350);
  });
  await step('PDF de cubierta', async () => {
    await exec(session, 'window.prepareCoverProof()');
    await delay(300);
    const page = await prepareOutput(session, { kind: 'cover', crop: true });
    const bytes = await pdf(session, page);
    await exec(session, "window.clearPrint();document.querySelector('#modal').close()");
    await writeFile(join(out, 'prueba-cubierta.pdf'), bytes);
    return { page };
  });
  await step('asistente editorial', () =>
    uiSuite('verificacion-asistente.json', 'window.runAssistantTests().catch(e=>({ok:false,error:e.stack}))'),
  );
  await step('navegación', () =>
    uiSuite('verificacion-navegacion.json', 'window.runNavigationTests().catch(e=>({ok:false,error:e.stack}))'),
  );
  await step('avisos', () => uiSuite('verificacion-avisos.json', 'window.runNoticeTests().catch(e=>({ok:false,error:e.stack}))'));
  await step('paquete del proyecto', () => checkPackage(session));

  const ok = results.every((r) => r.ok);
  await writeFile(join(out, 'resumen.json'), JSON.stringify({ ok, carpeta: out, resultados: results }, null, 2));
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.step}${r.ok ? '' : `\n    ${r.error}`}`);
  console.log(`\nAutoprueba ${ok ? 'OK' : 'CON FALLAS'} · resultados en ${out}`);
  return ok;
}

async function checkProjectSaving(session: Session) {
  const a = join(tmpdir(), `maquetario-save-${randomUUID()}.mqt`);
  const b = join(tmpdir(), `maquetario-copy-${randomUUID()}.mqt`);
  const old = session.projectPath;
  const oldDirty = session.dirty;
  try {
    await writeAtomic(a, 'original');
    session.projectPath = a;
    if (!(await saveProject(session, 'updated', 'Prueba', false))) throw new Error('No guardó sobre el archivo existente');
    await writeAtomic(b, 'copy');
    if ((await readFile(a, 'utf8')) !== 'updated' || (await readFile(b, 'utf8')) !== 'copy') throw new Error('La copia modificó el original');
    return ['Guardar actualiza el archivo existente sin diálogo', 'Escritura de copia no modifica el original'];
  } finally {
    session.projectPath = old;
    session.dirty = oldDirty;
    await rm(a, { force: true });
    await rm(b, { force: true });
  }
}

async function checkRecents() {
  const a = join(tmpdir(), `maquetario-recent-${randomUUID()}.mqt`);
  const b = join(tmpdir(), `maquetario-recent-${randomUUID()}.mqt`);
  const content = JSON.stringify({ version: 3, title: 'Prueba de recientes', pages: [{}] });
  try {
    await writeFile(a, content);
    await writeFile(b, content);
    await recordRecent(a, content);
    await recordRecent(b, content);
    await recordRecent(a, content);
    const list = await readRecents();
    if (list.length !== 2 || list[0]?.path !== a || list[0]?.pages !== 1) throw new Error('Orden y persistencia de recientes');
    return ['Recientes persisten en disco', 'Volver a abrir mueve el proyecto al principio', 'No se duplican entradas'];
  } finally {
    await rm(a, { force: true });
    await rm(b, { force: true });
    await rm(join(dataDir(), 'recent-selftest.json'), { force: true });
  }
}

async function checkPackage(session: Session) {
  const folder = join(tmpdir(), `maquetario-test-${randomUUID()}`);
  await mkdir(folder, { recursive: true });
  const [sample] = await readFaces(join(rendererDir(), 'fonts', 'DM-Sans-400.ttf'));
  if (!sample) throw new Error('No se pudo leer DM Sans');
  const previous = replacePackageFaces([sample]);
  try {
    const request = JSON.parse(await exec<string>(session, `window.preparePackageProof(${JSON.stringify(sample.id)})`)) as PackageRequest;
    await createProjectPackage(session, folder, request);
    const [result] = await readdir(folder);
    if (!result) throw new Error('No se creó la carpeta del paquete');
    const dir = join(folder, result);
    const project = (await readdir(dir)).find((f) => f.endsWith('.mqt'));
    if (!project) throw new Error('Falta el .mqt');
    await setPackageFonts(join(dir, project));
    if (!getPackageFaces().some((f) => f.id === sample.id && f.family === sample.family)) {
      throw new Error('La fuente no se pudo reabrir desde el paquete.');
    }
    if ((await readdir(join(dir, 'Imágenes'))).filter((f) => f.endsWith('.svg')).length !== 1) throw new Error('Falta la imagen del paquete.');
    for (const file of ['Interior.pdf', 'Cubierta.pdf']) {
      if ((await readFile(join(dir, file))).subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`PDF inválido: ${file}`);
    }
    return ['Proyecto y copia SVG en la carpeta', 'PDF interior y cubierta generados', 'Fuente recargada usando el identificador original'];
  } finally {
    replacePackageFaces(previous);
    await rm(folder, { recursive: true, force: true });
  }
}
