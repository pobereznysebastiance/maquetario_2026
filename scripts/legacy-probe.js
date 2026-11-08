// Sonda del CSS legacy: ¿qué reglas de una hoja vieja todavía cambian algo en pantalla?
//
// Uso (la interfaz en un navegador, por ejemplo con `node scripts/serve-ui.cjs` y http://127.0.0.1:5179):
//   1. Pegar este archivo en la consola, con las hojas a revisar:  window.LEGACY_FILES = ['glass.css'];
//   2. Llevar la interfaz a cada estado (pestañas, selección, diálogos, tutorial…) y correr  legacyProbe('nombre').
//   3. legacyReport() separa las reglas en: muertas (probadas y nunca efectivas), efectivas,
//      dinámicas sin cubrir (:hover/:focus que ui/ no fija) y sin probar (sus elementos no aparecieron).
//
// Cómo decide: borra cada regla, compara los estilos calculados de sus elementos (y descendientes,
// por herencia) y la vuelve a poner. Las de :hover/:focus se dan por cubiertas si una regla de ui/
// con el mismo estado fija las mismas propiedades sobre los mismos elementos.
// No reemplaza a la autoprueba: después de borrar, `npm run self-test` y comparar capturas con
// scripts/compare-captures.cjs. Lo que la sonda no visitó lo encuentra esa comparación.
(() => {
  const FILES = window.LEGACY_FILES || ['glass.css', 'crystal.css'];
  const DYNAMIC = /:(hover|focus-visible|focus-within|focus|active)\b/g;
  const PSEUDO = /::?(before|after|placeholder|marker|selection|-webkit-[\w-]+)\b/;
  const ROOT_PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'fill', 'accent-color', 'opacity', 'backdrop-filter', 'border-radius', 'caret-color'];
  const state = (window.__legacy ??= { effective: new Map(), tested: new Set(), dynamic: new Set() });
  const flat = (x) => (x instanceof CSSStyleRule ? [x] : x.cssRules ? [...x.cssRules].flatMap(flat) : []);
  const split = (selector) => selector.split(/,(?![^()]*\))/);

  function sheets() {
    const out = {};
    for (const s of document.styleSheets) try {
      for (const r of s.cssRules) if (r instanceof CSSImportRule && r.styleSheet) {
        const name = r.href.split('/').pop();
        if (FILES.includes(name)) out[name] = r.styleSheet;
      }
    } catch {}
    return out;
  }
  function targets(rule) {
    const out = [];
    for (const r of flat(rule)) for (const part of split(r.selectorText)) {
      const pseudo = (part.match(PSEUDO) || [])[0];
      let els = [];
      try { els = [...document.querySelectorAll(part.replace(PSEUDO, '').trim() || '*')]; } catch {}
      for (const el of els.slice(0, 400)) out.push([el, pseudo ? pseudo.replace(/^:+/, '::') : null]);
    }
    const extra = [];
    for (const [el, pseudo] of out) if (!pseudo) for (const d of [...el.querySelectorAll('*')].slice(0, 60)) extra.push([d, null]);
    return out.concat(extra.slice(0, 3000));
  }
  const snapshot = (pairs, props) => pairs.map(([el, pseudo]) => { const cs = getComputedStyle(el, pseudo); return props.map((p) => cs.getPropertyValue(p)).join('|'); });

  window.legacyProbe = (label = '') => {
    const found = sheets(); let effective = 0, tested = 0;
    for (const file of FILES) {
      const sheet = found[file];
      if (!sheet) throw new Error('no está cargada ' + file);
      for (let i = 0; i < sheet.cssRules.length; i++) {
        const rule = sheet.cssRules[i], key = file + '#' + i, text = rule.cssText;
        if (rule instanceof CSSMediaRule && /print/.test(rule.conditionText)) { state.effective.set(key, ['impresión']); continue; }
        const selectors = flat(rule).map((r) => r.selectorText).join(',');
        if (new RegExp(DYNAMIC.source).test(selectors)) { state.dynamic.add(key); continue; }
        const isRoot = /^:root|^body\b|^html\b/.test(selectors);
        const pairs = isRoot ? [...document.querySelectorAll('*')].slice(0, 4000).map((e) => [e, null]) : targets(rule);
        const props = isRoot ? ROOT_PROPS : [...new Set(flat(rule).flatMap((r) => [...r.style]))].filter((p) => !p.startsWith('--'));
        if (!pairs.length || !props.length) continue;
        tested++; state.tested.add(key);
        const before = snapshot(pairs, props);
        sheet.deleteRule(i);
        const after = snapshot(pairs, props);
        sheet.insertRule(text, i);
        if (before.some((v, k) => v !== after[k])) {
          effective++;
          const prev = state.effective.get(key) || [];
          if (!prev.includes(label)) state.effective.set(key, prev.concat(label));
        }
      }
    }
    return `${label}: ${effective} efectivas de ${tested} probadas`;
  };

  window.legacyReport = () => {
    const found = sheets(), uiRules = [];
    for (const s of document.styleSheets) try {
      for (const r of s.cssRules) if (r instanceof CSSImportRule && r.styleSheet && !r.href.startsWith('../')) uiRules.push(...[...r.styleSheet.cssRules].flatMap(flat));
    } catch {}
    const coveredDynamic = (rule) => {
      let any = false;
      for (const r of flat(rule)) for (const part of split(r.selectorText)) {
        const states = part.match(DYNAMIC) || [];
        if (!states.length) continue;
        let els = [];
        try { els = [...document.querySelectorAll(part.replace(DYNAMIC, '').trim())]; } catch {}
        if (!els.length) continue;
        any = true;
        for (const prop of r.style) {
          if (prop.startsWith('--')) continue;
          const ok = els.every((el) => uiRules.some((u) => u.style.getPropertyValue(prop) !== '' && split(u.selectorText).some((up) => states.every((s) => up.includes(s)) && (() => { try { return el.matches(up.replace(DYNAMIC, '').trim() || '*'); } catch { return false; } })())));
          if (!ok) return false;
        }
      }
      return any;
    };
    const groups = { muertas: [], efectivas: [], dinamicasSinCubrir: [], sinProbar: [] };
    for (const file of FILES) for (let i = 0; i < found[file].cssRules.length; i++) {
      const key = file + '#' + i, r = found[file].cssRules[i];
      const row = `${key} ${(r.selectorText || '@media ' + r.conditionText).slice(0, 80)}`;
      if (state.effective.has(key)) groups.efectivas.push(row);
      else if (state.dynamic.has(key)) (coveredDynamic(r) ? groups.muertas : groups.dinamicasSinCubrir).push(row);
      else if (state.tested.has(key)) groups.muertas.push(row);
      else groups.sinProbar.push(row);
    }
    // Para scripts/prune-css.cjs:
    groups.clavesMuertas = JSON.stringify(groups.muertas.map((r) => r.split(' ')[0]));
    return groups;
  };
  return 'sonda lista para ' + FILES.join(', ');
})();
