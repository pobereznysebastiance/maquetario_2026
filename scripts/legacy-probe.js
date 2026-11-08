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
        // Sólo las hojas viejas (importadas como ../nombre.css): ui/templates/workspace.css se llama igual que la vieja.
        if (FILES.includes(name) && r.href.startsWith('../')) out[name] = r.styleSheet;
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
        // En html/body/:root también cuentan sus propias propiedades (márgenes, fuente base…), no sólo colores.
        const own = [...new Set(flat(rule).flatMap((r) => [...r.style]))].filter((p) => !p.startsWith('--'));
        const props = isRoot ? [...new Set(ROOT_PROPS.concat(own, ['font-size', 'font-family', 'line-height', 'margin-top', 'margin-left', 'padding-top', 'width', 'height']))] : own;
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
  // Confirmación acumulativa: legacyProbe prueba cada regla sola, y dos reglas duplicadas en hojas
  // distintas parecen muertas por separado aunque no lo estén juntas. legacyConfirm('estado', claves)
  // las borra de a una SIN reponerlas (de la última a la primera en cada hoja, para no correr índices):
  // si borrar una cambia algo con las anteriores ya borradas, se repone y queda como necesaria.
  // Al final repone todo. Devuelve las claves que siguen siendo borrables en este estado; correrlo
  // en cada estado pasándole lo que devolvió el anterior.
  window.legacyConfirm = (label, keys) => {
    const found = sheets(), removed = [], needed = [];
    const ordered = [...keys].sort((a, b) => {
      const [fa, ia] = a.split('#'), [fb, ib] = b.split('#');
      return fa === fb ? Number(ib) - Number(ia) : FILES.indexOf(fa) - FILES.indexOf(fb);
    });
    for (const key of ordered) {
      const [file, i] = key.split('#'), sheet = found[file], index = Number(i), rule = sheet.cssRules[index];
      const text = rule.cssText, selectors = flat(rule).map((r) => r.selectorText).join(',');
      const isRoot = /^:root|^body\b|^html\b/.test(selectors);
      const pairs = isRoot ? [...document.querySelectorAll('*')].slice(0, 4000).map((e) => [e, null]) : targets(rule);
      const own = [...new Set(flat(rule).flatMap((r) => [...r.style]))].filter((p) => !p.startsWith('--'));
      const props = isRoot ? [...new Set(ROOT_PROPS.concat(own))] : own;
      const before = pairs.length && props.length ? snapshot(pairs, props) : [];
      sheet.deleteRule(index);
      const after = pairs.length && props.length ? snapshot(pairs, props) : [];
      if (before.some((v, k) => v !== after[k])) { sheet.insertRule(text, index); needed.push(key); }
      else removed.push([sheet, index, text]);
    }
    for (const [sheet, index, text] of removed.reverse()) sheet.insertRule(text, index);
    window.__legacyNeeded = (window.__legacyNeeded || []).concat(needed.map((k) => k + ' (' + label + ')'));
    return keys.filter((k) => !needed.includes(k));
  };
  // Por propiedad: qué declaraciones de cada regla siguen cambiando algo (para portar sólo esas a ui/).
  // legacyProps('estado') acumula en window.__legacyProps: { 'archivo#i': { selector, props: {prop: valor} } }.
  // Asincrónica: cede el hilo entre reglas (las hojas grandes tardan) y deja el avance en
  // window.__legacyPropsProgress. Lanzarla sin esperar y consultar el avance.
  const INHERITED = /^(color|font|line-height|letter-spacing|word-spacing|text-(align|indent|transform|shadow)|white-space|visibility|cursor|direction|list-style|quotes|hyphens|tab-size)/;
  window.legacyProps = async (label = '') => {
    const found = sheets(), out = (window.__legacyProps ??= {});
    const total = FILES.reduce((n, f) => n + found[f].cssRules.length, 0);
    let done = 0;
    for (const file of FILES) for (let i = 0; i < found[file].cssRules.length; i++) {
      window.__legacyPropsProgress = `${label}: ${++done}/${total}`;
      if (done % 5 === 0) await new Promise((r) => setTimeout(r, 0));
      const rule = found[file].cssRules[i];
      if (!(rule instanceof CSSStyleRule) || new RegExp(DYNAMIC.source).test(rule.selectorText)) continue;
      const withKids = targets(rule);
      if (!withKids.length) continue;
      const own = withKids.filter(([el, pseudo]) => { try { return pseudo || flat(rule).some((r) => split(r.selectorText).some((p) => el.matches(p.replace(PSEUDO, '').trim() || '*'))); } catch { return true; } });
      // Las declaraciones tal como están escritas (con sus formas cortas): una forma corta con var()
      // deja vacías sus propiedades largas en el CSSOM y, recorriendo [...rule.style], no se detectaba.
      const written = rule.style.cssText.split(/;(?![^(]*\))/).map((d) => d.split(':')[0].trim()).filter(Boolean);
      for (const prop of written) {
        if (prop.startsWith('--')) continue;
        const pairs = INHERITED.test(prop) ? withKids : own;
        if (!pairs.length) continue;
        const value = rule.style.getPropertyValue(prop), priority = rule.style.getPropertyPriority(prop);
        const before = snapshot(pairs, [prop]);
        rule.style.removeProperty(prop);
        const after = snapshot(pairs, [prop]);
        rule.style.setProperty(prop, value, priority);
        if (before.some((v, k) => v !== after[k])) {
          const entry = (out[file + '#' + i] ??= { selector: rule.selectorText, props: {}, states: [] });
          entry.props[prop] = value + (priority ? ' !' + priority : '');
          if (!entry.states.includes(label)) entry.states.push(label);
        }
      }
    }
    return Object.keys(out).length + ' reglas con propiedades efectivas';
  };
  return 'sonda lista para ' + FILES.join(', ');
})();
