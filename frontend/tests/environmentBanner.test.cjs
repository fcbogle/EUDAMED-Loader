const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function harness(response, onEnvironmentChange) {
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
    render() { cursor=0; return JSON.stringify(module.exports.EnvironmentBanner({ onEnvironmentChange })); },
    mount() { mounted=true; return effect(); },
  };
}
for (const [environment, label] of [['dev','EUDAMED Playground'],['prod','EUDAMED Production']]) {
  test(`banner uses backend ${environment} identity after starting unconfirmed`, async () => {
    const h=harness(() => Promise.resolve({environment, message_schema_version: environment === "dev" ? "3.0.32" : "3.0.30", schema_package: environment === "dev" ? "Derived package" : "Official package"}));
    assert.match(h.render(), /UNCONFIRMED/);
    const cleanup=h.mount(); await new Promise(setImmediate);
    assert.ok(h.render().includes(label));
    assert.ok(h.render().includes(environment === 'dev' ? '3.0.32' : '3.0.30'));
    assert.ok(h.render().includes(environment === 'dev' ? 'Derived package' : 'Official package')); assert.ok(!h.render().includes('UNCONFIRMED')); cleanup();
  });
}
for (const response of [() => Promise.resolve({environment:'invalid'}), () => Promise.reject(new Error('offline'))]) {
  test('unverified environment never displays a confirmed target and offers retry', async () => {
    const h=harness(response);h.render();const cleanup=h.mount();await new Promise(setImmediate);
    const text=h.render();assert.match(text,/UNCONFIRMED/);assert.match(text,/Retry/);
    assert.ok(!text.includes('EUDAMED Production'));assert.ok(!text.includes('EUDAMED Playground'));cleanup();
  });
}

test('older backend does not cause the banner to invent schema details', async () => {
  const h = harness(() => Promise.resolve({ environment: 'dev' }));
  h.render(); const cleanup = h.mount(); await new Promise(setImmediate);
  assert.match(h.render(), /Package unconfirmed/);
  assert.ok(!h.render().includes('3.0.32'));
  cleanup();
});

for (const environment of ['dev', 'prod']) {
  test(`banner shares confirmed ${environment} identity with workspace labels`, async () => {
    const changes = [];
    const h = harness(() => Promise.resolve({ environment }), value => changes.push(value));
    h.render(); const cleanup = h.mount(); await new Promise(setImmediate);
    assert.deepEqual(changes, [null, environment]);
    cleanup();
  });
}

test('failed environment confirmation keeps workspace identity unconfirmed', async () => {
  const changes = [];
  const h = harness(() => Promise.reject(new Error('offline')), value => changes.push(value));
  h.render(); const cleanup = h.mount(); await new Promise(setImmediate);
  assert.deepEqual(changes, [null]);
  cleanup();
});
