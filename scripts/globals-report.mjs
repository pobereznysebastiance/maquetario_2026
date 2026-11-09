// Inventario de globales de la interfaz (etapa 2, parte B: globales → import reales).
//
//   node scripts/globals-report.mjs            resumen y tabla de los globales
//   node scripts/globals-report.mjs --state    sólo el estado (variables), con quién las asigna
//   node scripts/globals-report.mjs --json     todo en JSON (para comparar entre entregas)
//
// Qué cuenta como global:
// - lo que declara el núcleo, src/global/studio.ts (es un script: sus let/const/function de nivel
//   superior son globales);
// - lo que un módulo publica con declare global { var x } y asigna con globalThis.x = …,
//   window.x = … u Object.defineProperties(globalThis, …);
// - lo que todavía declara LibroStudio/v3/app/globals.d.ts.
// Quién lo usa: cada identificador libre (que no declara el propio archivo en su alcance) de
// src/, tests/ y scripts/style-snapshot.js. En el proceso principal (desktop/src/main/) se buscan
// los nombres dentro de las cadenas de código que evalúa en la página: la autoprueba
// (selftest.ts) y el resto (main.ts, handlers…).
// Contrato con el proceso principal (src/contract/page-contract.ts): el proceso principal nombra
// sólo maquetarioMain y maquetarioTests. Se controla que cada miembro que usa (por callMain,
// mainExpression, testsExpression o escrito en una cadena) esté en el contrato, que test-loader.js
// arme maquetarioTests con los mismos nombres, y qué globales alcanza el contrato (los que lee
// src/contract/main-contract.ts).
// Extensiones: llamadas a extend('f', …) / extend.after('f', …) / … con el nombre como texto.
//
// El árbol sale del parser de TypeScript que trae prettier (TypeScript 7 ya no expone su API de
// JavaScript); los alcances se resuelven acá: bloques, funciones, parámetros, catch e imports.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { __debug } from 'prettier';

const root = join(import.meta.dirname, '..');
const app = join(root, 'LibroStudio', 'v3', 'app');
const src = join(app, 'src');
const STUDIO = join(src, 'global', 'studio.ts');
const LEGACY = join(app, 'globals.d.ts');
const MAIN = join(root, 'desktop', 'src', 'main');
const SELFTEST = join(MAIN, 'selftest.ts');
const SNAPSHOT = join(root, 'scripts', 'style-snapshot.js');

const walkDir = (dir, test) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walkDir(path, test) : test(path) ? [path] : [];
  });
const srcFiles = walkDir(src, (p) => /\.(ts|tsx)$/.test(p));
const testFiles = walkDir(join(app, 'tests'), (p) => p.endsWith('.js'));
const where = (p) =>
  relative(p.startsWith(app) ? app : root, p)
    .split(sep)
    .join('/');

const parse = async (file) =>
  (await __debug.parse(readFileSync(file, 'utf8'), { parser: 'typescript', filepath: file })).ast;

/** Hijos de un nodo ESTree (sin la información de posición). */
const children = (node) =>
  Object.entries(node).flatMap(([key, value]) =>
    ['loc', 'range', 'parent', 'comments', 'tokens'].includes(key)
      ? []
      : Array.isArray(value)
        ? value.filter((v) => v && typeof v.type === 'string')
        : value && typeof value.type === 'string'
          ? [value]
          : [],
  );

/** Nombres que declara un patrón (const { a, b: [c] } = …). */
const patternNames = (p) =>
  !p
    ? []
    : p.type === 'Identifier'
      ? [p.name]
      : p.type === 'ObjectPattern'
        ? p.properties.flatMap((q) => patternNames(q.type === 'RestElement' ? q.argument : q.value))
        : p.type === 'ArrayPattern'
          ? p.elements.flatMap(patternNames)
          : p.type === 'AssignmentPattern'
            ? patternNames(p.left)
            : p.type === 'RestElement'
              ? patternNames(p.argument)
              : p.type === 'TSParameterProperty'
                ? patternNames(p.parameter)
                : [];

const isScope = (n) =>
  [
    'Program',
    'BlockStatement',
    'StaticBlock',
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'CatchClause',
    'SwitchStatement',
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'ClassExpression',
  ].includes(n.type);

/** Lo que declara un nodo en el alcance donde está (y, para funciones, en el suyo). */
function declaredHere(node) {
  switch (node.type) {
    case 'VariableDeclaration':
      return node.declarations.flatMap((d) => patternNames(d.id));
    case 'FunctionDeclaration':
    case 'TSDeclareFunction':
    case 'ClassDeclaration':
    case 'TSEnumDeclaration':
      return node.id ? [node.id.name] : [];
    case 'ImportDeclaration':
      return node.importKind === 'type' ? [] : node.specifiers.map((s) => s.local.name);
    default:
      return [];
  }
}

/** Declaraciones propias de un alcance (sin entrar a los alcances internos). */
function scopeNames(scope) {
  const names = new Set();
  if (
    ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(scope.type)
  ) {
    for (const p of scope.params) patternNames(p).forEach((n) => names.add(n));
    if (scope.type === 'FunctionExpression' && scope.id) names.add(scope.id.name);
  }
  if (scope.type === 'ClassExpression' && scope.id) names.add(scope.id.name);
  if (scope.type === 'CatchClause') patternNames(scope.param).forEach((n) => names.add(n));
  const visit = (n, top) => {
    if (!top && isScope(n)) {
      // Una declaración de función nombra en el alcance de afuera.
      if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration')
        declaredHere(n).forEach((x) => names.add(x));
      return;
    }
    if (n.type === 'TSModuleDeclaration') return;
    declaredHere(n).forEach((x) => names.add(x));
    for (const c of children(n)) visit(c, false);
  };
  const body =
    scope.type === 'ForStatement'
      ? [scope.init].filter(Boolean)
      : scope.type === 'ForInStatement' || scope.type === 'ForOfStatement'
        ? [scope.left]
        : scope.type === 'SwitchStatement'
          ? scope.cases
          : scope.type === 'Program' ||
              scope.type === 'BlockStatement' ||
              scope.type === 'StaticBlock'
            ? scope.body
            : scope.body && !Array.isArray(scope.body)
              ? scope.body.type === 'BlockStatement' || scope.body.type === 'ClassBody'
                ? scope.body.body
                : []
              : [];
  for (const n of body) visit(n, false);
  return names;
}

const globals = new Map();
const entry = (name) => {
  if (!globals.has(name))
    globals.set(name, {
      name,
      kind: 'función',
      definedIn: new Set(),
      declaredIn: new Set(),
      readers: new Map(),
      writers: new Map(),
      testReaders: new Set(),
      testWriters: new Set(),
      selftest: false,
      main: false,
      extensions: [],
      decl: null,
    });
  return globals.get(name);
};
const bump = (map, file) => map.set(file, (map.get(file) ?? 0) + 1);
const isFunctionValue = (init) =>
  !!init &&
  (['ArrowFunctionExpression', 'FunctionExpression'].includes(init.type) ||
    // const render = extensible('render', function …)
    (init.type === 'CallExpression' && init.callee.name === 'extensible'));
const isFunctionType = (annotation) =>
  !!annotation && ['TSFunctionType', 'TSTypeQuery'].includes(annotation.typeAnnotation?.type);
/** Tipos que son datos (número, texto, listas, uniones con null…), no un objeto de servicio. */
const DATA_TYPES = new Set([
  'TSNumberKeyword',
  'TSStringKeyword',
  'TSBooleanKeyword',
  'TSArrayType',
  'TSUnionType',
  'TSLiteralType',
  'TSTupleType',
]);

// ── Declaraciones: núcleo (nivel superior de studio.ts), declare global y globals.d.ts ──
const trees = new Map();
for (const file of [...srcFiles, LEGACY, ...testFiles, SNAPSHOT])
  trees.set(file, await parse(file));

const addDeclaration = (node, file, defines) => {
  if (node.type === 'VariableDeclaration')
    for (const d of node.declarations)
      for (const name of patternNames(d.id)) {
        const g = entry(name);
        g.declaredIn.add(where(file));
        if (defines) g.definedIn.add(where(file));
        if (!isFunctionValue(d.init) && !isFunctionType(d.id.typeAnnotation))
          g.decl = {
            keyword: node.kind,
            type: d.id.typeAnnotation?.typeAnnotation?.type,
            init: d.init?.type,
          };
      }
  else if (['FunctionDeclaration', 'TSDeclareFunction'].includes(node.type) && node.id) {
    const g = entry(node.id.name);
    g.declaredIn.add(where(file));
    if (defines) g.definedIn.add(where(file));
  }
};
for (const file of [...srcFiles, LEGACY]) {
  const ast = trees.get(file);
  const visit = (n) => {
    if (n.type === 'TSModuleDeclaration' && (n.global || n.id?.name === 'global')) {
      for (const s of n.body?.body ?? []) addDeclaration(s, file, false);
      return;
    }
    for (const c of children(n)) visit(c);
  };
  visit(ast);
  if (file === STUDIO || file === LEGACY)
    for (const s of ast.body)
      addDeclaration(
        s.type === 'ExportNamedDeclaration' ? (s.declaration ?? s) : s,
        file,
        file === STUDIO,
      );
}

const globalMember = (n) =>
  n?.type === 'MemberExpression' &&
  !n.computed &&
  n.object.type === 'Identifier' &&
  ['globalThis', 'window'].includes(n.object.name);
const isTypeNode = (n) =>
  n.type.startsWith('TS') &&
  ![
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'TSTypeAssertion',
    'TSParameterProperty',
    'TSInstantiationExpression',
  ].includes(n.type);
const extendMethods = new Set(['after', 'before', 'result', 'instead', 'replace', 'around']);

// ── Usos ──
for (const file of [...srcFiles, ...testFiles, SNAPSHOT]) {
  const name = where(file);
  const test = testFiles.includes(file);
  const page = test || file === SNAPSHOT;
  const scopes = [];
  const free = (id) => !scopes.some((s) => s.has(id));
  const use = (id, write) => {
    const g = globals.get(id);
    if (!g || !free(id)) return;
    if (test) (write ? g.testWriters : g.testReaders).add(name);
    else bump(write ? g.writers : g.readers, name);
  };
  const visit = (n, parent, role) => {
    if (isTypeNode(n) || n.type === 'TSModuleDeclaration') return;
    if (isScope(n)) scopes.push(scopeNames(n));
    // Publicación: globalThis.x = … / Object.defineProperties(globalThis, { x: … })
    if (n.type === 'AssignmentExpression' && globalMember(n.left) && !page) {
      const g = globals.get(n.left.property.name);
      if (g && file !== STUDIO) g.definedIn.add(name);
    }
    if (
      n.type === 'CallExpression' &&
      n.callee.type === 'MemberExpression' &&
      /^definePropert(y|ies)$/.test(n.callee.property.name ?? '') &&
      n.arguments[0]?.type === 'Identifier' &&
      n.arguments[0].name === 'globalThis' &&
      !page
    ) {
      const keys =
        n.callee.property.name === 'defineProperty'
          ? [n.arguments[1]?.value]
          : (n.arguments[1]?.properties ?? []).map((p) => p.key?.name ?? p.key?.value);
      for (const key of keys) globals.get(key)?.definedIn.add(name);
    }
    // Extensiones por nombre.
    if (
      n.type === 'CallExpression' &&
      n.arguments[0]?.type === 'Literal' &&
      typeof n.arguments[0].value === 'string'
    ) {
      const c = n.callee;
      const method =
        c.type === 'Identifier' && c.name === 'extend'
          ? 'extend'
          : c.type === 'MemberExpression' &&
              c.object.type === 'Identifier' &&
              c.object.name === 'extend' &&
              extendMethods.has(c.property.name)
            ? c.property.name
            : null;
      if (method) entry(n.arguments[0].value).extensions.push(`${name} (${method})`);
    }
    // Referencias.
    if (n.type === 'Identifier' && role !== 'skip') use(n.name, role === 'write');
    if (globalMember(n) && role !== 'skip') use(n.property.name, role === 'write');

    for (const [key, child] of Object.entries(n)) {
      if (
        [
          'loc',
          'range',
          'parent',
          'typeAnnotation',
          'returnType',
          'typeParameters',
          'typeArguments',
        ].includes(key)
      )
        continue;
      const list = Array.isArray(child) ? child : [child];
      for (const c of list) {
        if (!c || typeof c.type !== 'string') continue;
        let r = 'read';
        if (n.type === 'MemberExpression' && key === 'property' && !n.computed) r = 'skip';
        else if (globalMember(n) && key === 'object') r = 'skip';
        else if (
          ['Property', 'PropertyDefinition', 'MethodDefinition', 'TSPropertySignature'].includes(
            n.type,
          ) &&
          key === 'key' &&
          !n.computed
        )
          r = n.shorthand ? 'read' : 'skip';
        else if (['VariableDeclarator'].includes(n.type) && key === 'id') r = 'skip';
        else if (
          [
            'FunctionDeclaration',
            'FunctionExpression',
            'ArrowFunctionExpression',
            'ClassDeclaration',
            'ClassExpression',
            'TSDeclareFunction',
          ].includes(n.type) &&
          ['id', 'params'].includes(key)
        )
          r = 'skip';
        else if (n.type === 'CatchClause' && key === 'param') r = 'skip';
        else if (
          ['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(n.type) &&
          key === 'label'
        )
          r = 'skip';
        else if (
          [
            'ImportSpecifier',
            'ImportDefaultSpecifier',
            'ImportNamespaceSpecifier',
            'ExportSpecifier',
          ].includes(n.type)
        )
          r = 'skip';
        else if (
          n.type.startsWith('JSX') &&
          ['name', 'namespace'].includes(key) &&
          n.type !== 'JSXExpressionContainer'
        )
          r = 'skip';
        else if (n.type === 'AssignmentExpression' && key === 'left') r = 'write';
        else if (n.type === 'UpdateExpression') r = 'write';
        else if (
          role === 'write' &&
          ['ObjectPattern', 'ArrayPattern', 'AssignmentPattern', 'RestElement'].includes(n.type)
        )
          r = key === 'right' ? 'read' : 'write';
        else if (role === 'write' && n.type === 'Property' && key === 'value') r = 'write';
        else if (role === 'write' && n.type === 'Property' && key === 'key') r = 'skip';
        visit(c, n, r);
      }
    }
    if (isScope(n)) scopes.pop();
  };
  visit(trees.get(file), null, 'read');
}
// El archivo que define un global no cuenta como lector ni como quien lo asigna.
for (const g of globals.values())
  for (const file of g.definedIn) {
    g.readers.delete(file);
    g.writers.delete(file);
  }

// Tipo: función; estado (algo que cambia: let del núcleo, un dato, o alguien lo asigna); u objeto
// (un servicio que se publica una vez: M, UI, LibroI18n, extend…).
for (const g of globals.values()) {
  if (!g.decl) continue;
  const assigned = g.writers.size || g.testWriters.size;
  g.kind =
    g.decl.keyword === 'let' || assigned || DATA_TYPES.has(g.decl.type) ? 'estado' : 'objeto';
}

// ── Proceso principal: nombres dentro de las cadenas que evalúa en la página ──
// Sólo las cadenas que son código (llamadas, asignaciones, propiedades): un texto suelto como
// 'book' o 'design' es un dato (o el nombre de un miembro del contrato), y una frase (cuatro
// palabras seguidas) es un mensaje, no un global. Los textos entre comillas dentro del código
// (títulos, selectores) no cuentan.
const unquoted = (text) => text.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
const isCode = (text) =>
  /[();=]|[\w$]\.[\w$]/.test(text) && !/(?:\b\p{L}+ ){3}\p{L}+\b/u.test(text);
const stringsOf = async (file) => {
  const strings = [];
  const collect = (n) => {
    if ((n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateElement')
      strings.push(n.value?.raw ?? n.value);
    for (const c of children(n)) collect(c);
  };
  collect(await parse(file));
  return strings.map(unquoted).filter(isCode).join('\n');
};
// El nombre suelto (no como propiedad de otra cosa, ni clave de un objeto, ni parte de un nombre
// de archivo como inspector-diseno.png) o como window.x / globalThis.x.
const mentions = (text, name) => {
  const n = name.replace(/\$/g, '\\$');
  return (
    new RegExp(`(?<![\\w.$'"#-])${n}(?![\\w$:-])`).test(text) ||
    new RegExp(`(?:window|globalThis)\\.${n}(?![\\w$])`).test(text)
  );
};
const selftestText = await stringsOf(SELFTEST);
let mainText = '';
for (const file of walkDir(MAIN, (p) => p.endsWith('.ts') && p !== SELFTEST))
  mainText += (await stringsOf(file)) + '\n';
for (const g of globals.values()) {
  g.selftest = mentions(selftestText, g.name);
  g.main = mentions(mainText, g.name);
}

// ── Contrato con el proceso principal ──
const CONTRACT = join(src, 'contract', 'page-contract.ts');
const CONTRACT_IMPL = 'src/contract/main-contract.ts';
const LOADER = join(app, 'test-loader.js');
const contractTree = await parse(CONTRACT);
const membersOf = (name) => {
  const found = [];
  const visit = (n) => {
    if (n.type === 'TSInterfaceDeclaration' && n.id.name === name)
      for (const m of n.body.body) if (m.key?.name) found.push(m.key.name);
    for (const c of children(n)) visit(c);
  };
  visit(contractTree);
  return found;
};
const contract = { main: membersOf('MaquetarioMainApi'), tests: membersOf('MaquetarioTestsApi') };
const usedByMain = { main: new Set(), tests: new Set() };
const HELPERS = {
  callMain: ['main', 1],
  mainExpression: ['main', 0],
  mainExpressionIfLoaded: ['main', 0],
  testsExpression: ['tests', 0],
};
for (const file of walkDir(MAIN, (p) => p.endsWith('.ts'))) {
  const visit = (n) => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && HELPERS[n.callee.name]) {
      const [kind, index] = HELPERS[n.callee.name];
      const arg = n.arguments[index];
      if (arg?.type === 'Literal' && typeof arg.value === 'string') usedByMain[kind].add(arg.value);
    }
    for (const c of children(n)) visit(c);
  };
  visit(await parse(file));
  const text = await stringsOf(file);
  for (const m of text.matchAll(/maquetarioMain\??\.(\w+)/g)) usedByMain.main.add(m[1]);
  for (const m of text.matchAll(/maquetarioTests\??\.(\w+)/g)) usedByMain.tests.add(m[1]);
}
const loaderList =
  (readFileSync(LOADER, 'utf8').match(/const TESTS_API = \[([\s\S]*?)\]/)?.[1] ?? '')
    .match(/'(\w+)'/g)
    ?.map((x) => x.slice(1, -1)) ?? [];
const contractProblems = [
  ...[...usedByMain.main]
    .filter((n) => !contract.main.includes(n))
    .map((n) => `maquetarioMain.${n} no está en el contrato`),
  ...[...usedByMain.tests]
    .filter((n) => !contract.tests.includes(n))
    .map((n) => `maquetarioTests.${n} no está en el contrato`),
  ...contract.tests
    .filter((n) => n !== 'ready' && !loaderList.includes(n))
    .map((n) => `test-loader.js no arma maquetarioTests.${n}`),
  ...loaderList
    .filter((n) => !contract.tests.includes(n))
    .map((n) => `test-loader.js arma ${n}, que no está en el contrato`),
];
const CONTRACT_OBJECTS = new Set(['maquetarioMain', 'maquetarioTests']);

// ── Salida ──
const rows = [...globals.values()]
  .filter((g) => g.declaredIn.size || g.definedIn.size)
  .map((g) => ({
    name: g.name,
    kind: g.kind,
    definedIn: [...(g.definedIn.size ? g.definedIn : g.declaredIn)],
    readers: Object.fromEntries(g.readers),
    writers: Object.fromEntries(g.writers),
    testReaders: [...g.testReaders],
    testWriters: [...g.testWriters],
    selftest: g.selftest,
    main: g.main,
    contract: g.readers.has(CONTRACT_IMPL),
    extensions: g.extensions,
  }))
  .sort(
    (a, b) =>
      Object.keys(b.readers).length - Object.keys(a.readers).length || a.name.localeCompare(b.name),
  );
const extendedOnly = [...globals.values()]
  .filter((g) => g.extensions.length && !g.declaredIn.size && !g.definedIn.size)
  .map((g) => g.name);
const files = (o) => Object.keys(o).length;
const core = (r) => r.definedIn.includes('src/global/studio.ts');

const summary = {
  globales: rows.length,
  'del núcleo (studio.ts)': rows.filter(core).length,
  'publicados por módulos': rows.filter((r) => !core(r)).length,
  funciones: rows.filter((r) => r.kind === 'función').length,
  'objetos de servicio (M, UI, LibroI18n…)': rows.filter((r) => r.kind === 'objeto').length,
  'estado (variables)': rows.filter((r) => r.kind === 'estado').length,
  'estado asignado desde otros archivos': rows.filter(
    (r) => r.kind === 'estado' && files(r.writers),
  ).length,
  'sin usos fuera de su archivo (ni pruebas, ni extensiones, ni proceso principal)': rows.filter(
    (r) =>
      !files(r.readers) &&
      !files(r.writers) &&
      !r.testReaders.length &&
      !r.testWriters.length &&
      !r.selftest &&
      !r.main &&
      !r.extensions.length,
  ).length,
  'leídos por pruebas': rows.filter((r) => r.testReaders.length).length,
  'asignados por pruebas': rows.filter((r) => r.testWriters.length).length,
  'nombrados en cadenas de la autoprueba': rows.filter((r) => r.selftest).length,
  'nombrados en cadenas del proceso principal': rows.filter((r) => r.main).length,
  'nombrados sueltos por el proceso principal (fuera del contrato)': rows.filter(
    (r) => (r.selftest || r.main) && !CONTRACT_OBJECTS.has(r.name),
  ).length,
  'miembros del contrato (maquetarioMain)': contract.main.length,
  'miembros del contrato (maquetarioTests)': contract.tests.length,
  'globales que alcanza el contrato (src/contract/main-contract.ts)': rows.filter((r) => r.contract)
    .length,
  'problemas del contrato': contractProblems.length,
  'funciones extendidas por nombre': rows.filter((r) => r.extensions.length).length,
  'extensiones registradas': [...globals.values()].reduce((n, g) => n + g.extensions.length, 0),
};

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        summary,
        contract: { ...contract, problems: contractProblems },
        globals: rows,
        extendedWithoutGlobal: extendedOnly,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
console.log('Globales de la interfaz (etapa 2, parte B)\n');
for (const [label, n] of Object.entries(summary))
  console.log(`  ${String(n).padStart(4)}  ${label}`);
if (extendedOnly.length)
  console.log(`\n  Extendidas sin global declarado: ${extendedOnly.join(', ')}`);
const loose = rows.filter((r) => (r.selftest || r.main) && !CONTRACT_OBJECTS.has(r.name));
if (loose.length)
  console.log(
    `\n  Nombrados sueltos por el proceso principal: ${loose.map((r) => r.name).join(', ')}`,
  );
for (const problem of contractProblems) console.log(`  ⚠ ${problem}`);

const onlyState = process.argv.includes('--state');
const list = onlyState ? rows.filter((r) => r.kind === 'estado') : rows;
console.log(
  `\n${onlyState ? 'Estado' : 'Globales'}: nombre · tipo · definido en · archivos que leen/asignan · pruebas leen/asignan · autoprueba (a) / proceso principal (p) / contrato (c) · extensiones\n`,
);
for (const r of list) {
  console.log(
    [
      r.name.padEnd(30),
      r.kind.padEnd(8),
      r.definedIn.join(', ').padEnd(38),
      `${files(r.readers)}/${files(r.writers)}`.padStart(6),
      `${r.testReaders.length}/${r.testWriters.length}`.padStart(6),
      (r.selftest ? 'a' : ' ') + (r.main ? 'p' : ' ') + (r.contract ? 'c' : ' '),
      r.extensions.length ? String(r.extensions.length) : '',
    ].join('  '),
  );
  if (onlyState && files(r.writers))
    console.log(`      asignan: ${Object.keys(r.writers).join(', ')}`);
}
