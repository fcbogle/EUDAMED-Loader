const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function harness(response) {
  const state = [null, false, 0]; let cursor = 0; let effect; let mounted = false;
  const source = fs.readFileSync(path.join(__dirname, '../src/components/EnvironmentBanner.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', output)(name => {
    if (name === 'react') return { useState: () => { const i=cursor++; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useEffect: fn => { if (!mounted) effect=fn; } };
    if (name === '../api') return { api: { environment: () => response() } };
    return require(name);
  }, module, module.exports, { setTimeout, clearTimeout });
  return {
    render() { cursor=0; return JSON.stringify(module.exports.EnvironmentBanner()); },
    mount() { mounted=true; return effect(); },
  };
}
for (const [environment, label] of [['dev','EUDAMED Playground'],['prod','EUDAMED Production']]) {
  test(`banner uses backend ${environment} identity after starting unconfirmed`, async () => {
    const h=harness(() => Promise.resolve({environment}));
    assert.match(h.render(), /UNCONFIRMED/);
    const cleanup=h.mount(); await new Promise(setImmediate);
    assert.ok(h.render().includes(label)); assert.ok(!h.render().includes('UNCONFIRMED')); cleanup();
  });
}
for (const response of [() => Promise.resolve({environment:'invalid'}), () => Promise.reject(new Error('offline'))]) {
  test('unverified environment never displays a confirmed target and offers retry', async () => {
    const h=harness(response);h.render();const cleanup=h.mount();await new Promise(setImmediate);
    const text=h.render();assert.match(text,/UNCONFIRMED/);assert.match(text,/Retry/);
    assert.ok(!text.includes('EUDAMED Production'));assert.ok(!text.includes('EUDAMED Playground'));cleanup();
  });
}
