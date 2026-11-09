// Autoprueba: `npm run self-test` (o Maquetario --self-test [--out=<carpeta>]).
// Pruebas de integración de la interfaz, PDF reales, guardado, recientes y paquete. Deja los
// resultados en la carpeta de salida y un resumen.json; sale con código 1 si algo falla.
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
import { delay, exec, waitFor, type Session } from './session.ts';

type StepResult = {
  step: string;
  ok: boolean;
  skipped?: boolean;
  detail?: unknown;
  error?: string;
};

export async function runSelfTest(session: Session): Promise<boolean> {
  const out = argValue('out') ?? join(dataDir(), 'self-test');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const results: StepResult[] = [];
  // Si la página se recarga o se cae durante la prueba, queda registrado con su motivo.
  const contents = session.win.webContents;
  contents.on('render-process-gone', (_e, details) =>
    console.log(`[autoprueba] la página se cayó: ${details.reason} (código ${details.exitCode})`),
  );
  contents.on('did-start-navigation', (details) => {
    if (!details.isSameDocument) console.log(`[autoprueba] navegación: ${details.url}`);
  });
  contents.on('console-message', (details) => {
    if (details.level === 'error')
      console.log(
        `[autoprueba] error en la página: ${details.message} (${details.sourceId}:${details.lineNumber})`,
      );
  });
  const A5 = { width: 148, height: 210 };

  /** Cada paso tiene un límite: un paso colgado falla con su nombre en vez de trabar toda la prueba. */
  const STEP_TIMEOUT_MS = 90_000;
  const step = async (name: string, work: () => Promise<unknown>) => {
    try {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `El paso tardó más de ${STEP_TIMEOUT_MS / 1000} s (¿quedó esperando una respuesta?)`,
              ),
            ),
          STEP_TIMEOUT_MS,
        );
      });
      const detail = await Promise.race([work(), timeout]).finally(() => clearTimeout(timer));
      results.push({ step: name, ok: true, detail });
    } catch (error) {
      results.push({
        step: name,
        ok: false,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      await exec(session, 'window.clearPrint&&window.clearPrint()').catch(() => undefined);
    }
  };
  /** Las pruebas de la interfaz devuelven {ok, checks} (a veces como texto JSON). */
  const uiSuite = async (file: string, expression: string) => {
    const raw = await exec<unknown>(session, expression);
    const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    await writeFile(join(out, file), JSON.stringify(value, null, 2));
    const ok = (value as { ok?: unknown } | null)?.ok;
    if (ok === false || (value as { error?: unknown } | null)?.error)
      throw new Error(JSON.stringify(value));
    return { checks: ((value as { checks?: unknown[] }).checks ?? []).length };
  };
  const writePdf = async (file: string, prepare: string, page = A5, wait = 350) => {
    await exec(session, prepare);
    await delay(wait);
    const bytes = await pdf(session, page);
    await exec(session, 'window.clearPrint()');
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-')
      throw new Error(`PDF inválido: ${file}`);
    await writeFile(join(out, file), bytes);
    return { bytes: bytes.length };
  };
  const capture = async (file: string) =>
    writeFile(join(out, file), (await session.win.webContents.capturePage()).toPNG());

  await delay(500);
  // Las confirmaciones (confirm.js) no esperan respuesta durante la autoprueba.
  await exec(session, 'window.maquetarioSelfTest = true');
  // Las pruebas de la interfaz se cargan aparte (test-loader.js, desde tests/); el paquete distribuido
  // no las trae, y los pasos que las usan (testStep) se omiten.
  const loaderDone = await waitFor(session, 'window.maquetarioTestsReady !== undefined', 150, 100);
  const testsIncluded = loaderDone && (await exec(session, 'window.maquetarioTestsReady')) === true;
  if (!testsIncluded)
    console.log(
      '[autoprueba] este paquete no incluye las pruebas de la interfaz: se omiten los pasos que las usan',
    );
  const testStep = async (name: string, work: () => Promise<unknown>) => {
    if (testsIncluded) return step(name, work);
    results.push({ step: name, ok: true, skipped: true, detail: 'omitido: paquete sin pruebas' });
  };
  await testStep('interfaz: pruebas de integración', () =>
    uiSuite(
      'verificacion.json',
      '(()=>{try{return window.runIntegrationTests()}catch(e){return JSON.stringify({ok:false,error:e.stack})}})()',
    ),
  );
  await step('guardar sobre un archivo existente', () => checkProjectSaving(session));
  await step('proyectos recientes', () => checkRecents());
  await testStep('fuentes del sistema', () =>
    uiSuite(
      'verificacion-fuentes.json',
      'window.runFontIntegrationTests().catch(e=>({ok:false,error:e.message}))',
    ),
  );
  await step('captura del editor', async () => {
    await exec(session, 'window.showHandlePreview()');
    await delay(150);
    await capture('editor.png');
  });
  await step('PDF de lectura', () =>
    writePdf('prueba-lectura.pdf', 'window.preparePrint()', A5, 450),
  );
  await step('PDF del índice', () =>
    writePdf('prueba-indice.pdf', 'window.prepareIndexPrint()', A5, 200),
  );
  await testStep('PDF con marcas de corte', () =>
    writePdf(
      'prueba-marcas.pdf',
      'window.prepareMarkedOutputTest()',
      { width: 162, height: 224 },
      300,
    ),
  );
  await testStep('PDF tipográfico', async () => {
    await exec(session, 'window.prepareFontPdfTest()');
    return writePdf('prueba-fuentes.pdf', 'void 0', A5, 200);
  });
  await testStep('PDF de párrafos', () =>
    writePdf('prueba-parrafos.pdf', 'window.prepareParagraphPdfTest()', A5, 200),
  );
  await step('novela de prueba', async () => {
    const report = await exec<string>(session, 'window.prepareNovelProof()');
    await writeFile(join(out, 'prueba-novela.json'), report);
    await writeFile(
      join(out, 'El atlas de las casas vacias.mqt'),
      await exec<string>(session, 'window.novelProofContent()'),
    );
    await delay(250);
    await capture('novela.png');
    return writePdf('El atlas de las casas vacias.pdf', 'window.prepareNovelPdf()', A5, 350);
  });
  await step('capturas de interfaz', async () => {
    await exec(session, 'showWelcome()');
    await delay(600);
    await capture('bienvenida.png');
    await exec(session, 'hideWelcome()');
    await exec(session, "showTab('design')");
    await delay(250);
    await capture('inspector-diseno.png');
    await exec(session, "showTab('book')");
    await exec(session, 'openSettings()');
    await delay(400);
    await capture('configuracion.png');
    // Lista desplegable abierta (clic real: el selector se abre con interacción de la persona).
    const box = await exec<{ x: number; y: number }>(
      session,
      "(()=>{const r=document.querySelector('#settingsLanguage').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()",
    );
    session.win.webContents.sendInputEvent({
      type: 'mouseDown',
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: 1,
    });
    session.win.webContents.sendInputEvent({
      type: 'mouseUp',
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: 1,
    });
    await delay(400);
    await capture('selector-abierto.png');
    session.win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    await delay(150);
    await exec(session, "document.querySelector('#modal').close()");
    // void: executeJavaScript esperaría la promesa, que sólo se resuelve al contestar el diálogo.
    await exec(
      session,
      "window.maquetarioSelfTest = false; void confirmAction({ title: '¿Eliminar la página 3?', message: 'La página y sus objetos se quitan del libro. Podés recuperarlos con Deshacer.', confirmLabel: 'Eliminar página', danger: true })",
    );
    await delay(300);
    await capture('confirmacion.png');
    await exec(
      session,
      "document.querySelector('#confirmDialog').close(); window.maquetarioSelfTest = true",
    );
  });
  await step('confirmación aislada de los atajos', async () => {
    const result = await exec<string>(
      session,
      "(async()=>{window.maquetarioSelfTest=false;const pages=book.pages.length,before=tool;const answer=confirmAction({title:'Prueba',message:'',confirmLabel:'Eliminar',danger:true});const d=document.querySelector('#confirmDialog');for(const key of ['h','t','Delete','Backspace'])d.querySelector('button').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));d.querySelector('button').click();const value=await answer;window.maquetarioSelfTest=true;return JSON.stringify({closed:!d.open,value,toolKept:tool===before,pagesKept:book.pages.length===pages});})()",
    );
    const r = JSON.parse(result) as {
      closed: boolean;
      value: boolean;
      toolKept: boolean;
      pagesKept: boolean;
    };
    if (!r.closed || r.value !== false || !r.toolKept || !r.pagesKept) throw new Error(result);
    return ['Cancelar cierra y no confirma', 'Las teclas no llegan a los atajos de la app'];
  });
  await step('espacios de trabajo', async () => {
    const result = await exec<string>(
      session,
      "(()=>{const W=MaquetarioWorkspace,h=s=>document.querySelector(s)?.hasAttribute('data-workspace-hidden');W.setMode('simple');const simple={frame:h('[data-tool=\"frame\"]'),select:h('[data-tool=\"select\"]'),layersView:h('[data-rail-view=\"layers\"]'),templates:h('.template-panel')};W.setVisible('tool:frame',true);const custom={mode:W.mode(),frame:h('[data-tool=\"frame\"]')};W.setMode('default');const any=document.querySelectorAll('[data-workspace-hidden]').length;return JSON.stringify({simple,custom,any});})()",
    );
    const r = JSON.parse(result);
    const ok =
      r.simple.frame &&
      !r.simple.select &&
      r.simple.layersView &&
      r.simple.templates &&
      r.custom.mode === 'custom' &&
      !r.custom.frame &&
      r.any === 0;
    if (!ok) throw new Error(result);
    await exec(session, 'MaquetarioWorkspace.toggleMenu()');
    await delay(250);
    await capture('menu-espacios.png');
    await exec(
      session,
      "document.querySelector('#workspaceMenu').hidePopover(); openSettings('workspace')",
    );
    await delay(400);
    await capture('configuracion-espacio.png');
    await exec(session, "document.querySelector('#modal').close()");
    return [
      'Inicial oculta lo avanzado',
      'Personalizado guarda la selección',
      'Predeterminado muestra todo',
    ];
  });
  await step('tamaños de pantalla', async () => {
    // Viewport en píxeles CSS: notebook, notebook Full HD al 125 %, 1080p, 1440p, 4K al 150 % y 4K al 100 %.
    const sizes: [string, number, number][] = [
      ['1366x768', 1366, 768],
      ['1536x864', 1536, 864],
      ['1920x1080', 1920, 1080],
      ['2560x1440', 2560, 1440],
      ['3840x2160', 3840, 2160],
    ];
    const contents = session.win.webContents;
    const overflow: Record<string, number> = {};
    for (const [name, width, height] of sizes) {
      contents.enableDeviceEmulation({
        screenPosition: 'desktop',
        screenSize: { width, height },
        viewPosition: { x: 0, y: 0 },
        deviceScaleFactor: 1,
        viewSize: { width, height },
        scale: 1,
      });
      await delay(500);
      // Algo que se sale del ancho de la ventana es un defecto en cualquier tamaño.
      overflow[name] = await exec<number>(
        session,
        'document.documentElement.scrollWidth - window.innerWidth',
      );
      await writeFile(
        join(out, `pantalla-${name}.png`),
        (await contents.capturePage({ x: 0, y: 0, width, height })).toPNG(),
      );
    }
    contents.disableDeviceEmulation();
    await delay(300);
    const broken = Object.entries(overflow).filter(([, px]) => px > 0);
    if (broken.length)
      throw new Error(`Desborde horizontal: ${JSON.stringify(Object.fromEntries(broken))}`);
    return overflow;
  });
  await step('reglas', async () => {
    const r = JSON.parse(
      await exec<string>(
        session,
        "(()=>{MaquetarioRulers.setVisible(false);const hidden=getComputedStyle(document.querySelector('.ruler-x')).display==='none',top=getComputedStyle(document.querySelector('#spreadStage')).top;MaquetarioRulers.setVisible(true);const shown=getComputedStyle(document.querySelector('.ruler-x')).display!=='none';return JSON.stringify({hidden,top,shown});})()",
      ),
    );
    if (!r.hidden || r.top !== '0px' || !r.shown) throw new Error(JSON.stringify(r));
    return ['Ocultar reglas libera el espacio', 'Mostrarlas las vuelve a poner'];
  });
  await testStep('PDF de cubierta', async () => {
    await exec(session, 'window.prepareCoverProof()');
    await delay(300);
    const page = await prepareOutput(session, { kind: 'cover', crop: true });
    const bytes = await pdf(session, page);
    await exec(session, "window.clearPrint();document.querySelector('#modal').close()");
    await writeFile(join(out, 'prueba-cubierta.pdf'), bytes);
    return { page };
  });
  await testStep('asistente editorial', () =>
    uiSuite(
      'verificacion-asistente.json',
      'window.runAssistantTests().catch(e=>({ok:false,error:e.stack}))',
    ),
  );
  await testStep('navegación', () =>
    uiSuite(
      'verificacion-navegacion.json',
      'window.runNavigationTests().catch(e=>({ok:false,error:e.stack}))',
    ),
  );
  await testStep('avisos', () =>
    uiSuite(
      'verificacion-avisos.json',
      'window.runNoticeTests().catch(e=>({ok:false,error:e.stack}))',
    ),
  );
  await testStep('paquete del proyecto', () => checkPackage(session));

  await testStep('capturas de paneles', async () => {
    const shots: [string, string, string][] = [
      [
        'panel-salida.png',
        'window.prepareOutputReviewPreview()',
        "document.querySelector('#modal').close()",
      ],
      [
        'panel-fuentes.png',
        'window.prepareFontBrowserPreview()',
        "document.querySelector('#fontBrowser')?.close()",
      ],
      [
        'panel-cubierta.png',
        'window.prepareCoverProof()',
        "document.querySelector('#modal').close()",
      ],
      [
        'panel-asistente.png',
        'window.prepareAssistantPreview()',
        "document.querySelector('#modal').close()",
      ],
      [
        'panel-tutorial.png',
        'window.startTutorial(3)',
        "document.querySelector('#pauseTutorial')?.click()",
      ],
      [
        'panel-glosario.png',
        'window.prepareGlossaryPreview()',
        "document.querySelector('#modal').close()",
      ],
    ];
    const done: string[] = [];
    for (const [file, open, close] of shots) {
      await exec(session, `Promise.resolve(${open}).then(() => true)`);
      await delay(700);
      await capture(file);
      await exec(session, `try { ${close} } catch {}`);
      await delay(150);
      done.push(file);
    }
    return done;
  });

  // Última: abrir "libro nuevo" descarta el libro de prueba.
  await step('captura de libro nuevo', async () => {
    await exec(session, 'settingsNew(true)');
    await delay(400);
    await capture('libro-nuevo.png');
    await exec(session, "document.querySelector('#modal').close()");
  });

  const ok = results.every((r) => r.ok);
  await writeFile(
    join(out, 'resumen.json'),
    JSON.stringify({ ok, carpeta: out, resultados: results }, null, 2),
  );
  for (const r of results) {
    console.log(
      `${r.skipped ? '·' : r.ok ? '✓' : '✗'} ${r.step}${r.skipped ? ' (omitido)' : r.ok ? '' : `\n    ${r.error}`}`,
    );
  }
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
    if (!(await saveProject(session, 'updated', 'Prueba', false)))
      throw new Error('No guardó sobre el archivo existente');
    await writeAtomic(b, 'copy');
    if ((await readFile(a, 'utf8')) !== 'updated' || (await readFile(b, 'utf8')) !== 'copy')
      throw new Error('La copia modificó el original');
    return [
      'Guardar actualiza el archivo existente sin diálogo',
      'Escritura de copia no modifica el original',
    ];
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
    if (list.length !== 2 || list[0]?.path !== a || list[0]?.pages !== 1)
      throw new Error('Orden y persistencia de recientes');
    return [
      'Recientes persisten en disco',
      'Volver a abrir mueve el proyecto al principio',
      'No se duplican entradas',
    ];
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
    const request = JSON.parse(
      await exec<string>(session, `window.preparePackageProof(${JSON.stringify(sample.id)})`),
    ) as PackageRequest;
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
    if ((await readdir(join(dir, 'Imágenes'))).filter((f) => f.endsWith('.svg')).length !== 1)
      throw new Error('Falta la imagen del paquete.');
    for (const file of ['Interior.pdf', 'Cubierta.pdf']) {
      if ((await readFile(join(dir, file))).subarray(0, 5).toString('latin1') !== '%PDF-')
        throw new Error(`PDF inválido: ${file}`);
    }
    return [
      'Proyecto y copia SVG en la carpeta',
      'PDF interior y cubierta generados',
      'Fuente recargada usando el identificador original',
    ];
  } finally {
    replacePackageFaces(previous);
    await rm(folder, { recursive: true, force: true });
  }
}
