const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(initial = {}) {
  const slots = [], effects = [], requests = [];
  let cursor = 0, tree, writes = 0;
  const props = { importBatchId: 1, environment: 'prod', ...initial };
  const react = {
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], next => { writes++; slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(callback, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: callback() }; });
      }
    },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(require.resolve('../src/components/SnapshotRegistrationCards.tsx'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'react') return react;
    if (name === '../api') return { api: { registrationSummary(params) {
      const request = deferred(); requests.push({ ...request, params }); return request.promise;
    } } };
    return require(name);
  }, module, module.exports);
  function render() {
    cursor = 0; tree = module.exports.SnapshotRegistrationCards(props);
    while (effects.length) effects.shift()();
  }
  function nodes(node = tree) {
    if (Array.isArray(node)) return node.flatMap(value => nodes(value ?? null));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children ?? null)];
  }
  render();
  return {
    props, requests, render, nodes,
    values: () => nodes().filter(n => n.type === 'strong').map(n => n.props.children),
    text: () => JSON.stringify(tree),
    writes: () => writes,
    async settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const summary = (overrides = {}) => ({ import_batch_id: 1,
  counts: { registered_devices: 210, awaiting_devices: 30, unknown_devices: 0 }, ...overrides });

test('cards load uncapped, unfiltered counts automatically on page reload without a refresh button', async () => {
  const h = harness();
  assert.deepEqual(h.values(), ['—', '—']);
  assert.deepEqual(h.requests[0].params, {});
  h.requests[0].resolve(summary({ counts: { registered_devices: 10210, awaiting_devices: 30, unknown_devices: 0 } }));
  await h.settle();
  assert.deepEqual(h.values(), ['30', '10,210']);
  assert.match(h.text(), /Awaiting registration/); assert.match(h.text(), /Registered/);
  assert.equal(h.nodes().some(n => n.type === 'button'), false);
  h.unmount();
  const reloaded = harness(); assert.deepEqual(reloaded.values(), ['—', '—']);
  reloaded.requests[0].resolve(summary({ counts: { registered_devices: 10230, awaiting_devices: 10, unknown_devices: 0 } }));
  await reloaded.settle(); assert.deepEqual(reloaded.values(), ['10', '10,230']);
});
test('unknown devices are identified separately, not added to awaiting registrations', async () => {
  const h = harness();
  h.requests[0].resolve(summary({ counts: { registered_devices: 210, awaiting_devices: 30, unknown_devices: 7 } }));
  await h.settle();
  assert.deepEqual(h.values(), ['30', '210']); assert.match(h.text(), /7/); assert.match(h.text(), /unknown registration status/);
});
test('a failed page load shows unavailable counts and a page reload recovers', async () => {
  const h = harness(); h.requests[0].reject(new Error('Synthetic unavailable service')); await h.settle();
  assert.deepEqual(h.values(), ['—', '—']); assert.match(h.text(), /Synthetic unavailable service/);
  assert.match(h.text(), /Refresh the page to try again/);
  assert.equal(h.nodes().some(n => n.type === 'button'), false);
  h.unmount();
  const reloaded = harness(); reloaded.requests[0].resolve(summary()); await reloaded.settle();
  assert.deepEqual(reloaded.values(), ['30', '210']); assert.doesNotMatch(reloaded.text(), /Synthetic unavailable service/);
});
test('a real zero is displayed only after a successful count response', async () => {
  const h = harness(); h.requests[0].resolve(summary({ counts: { registered_devices: 0, awaiting_devices: 0, unknown_devices: 0 } }));
  await h.settle(); assert.deepEqual(h.values(), ['0', '0']);
});
test('old import and environment responses cannot replace the current snapshot', async () => {
  const h = harness(); const first = h.requests[0];
  h.props.importBatchId = 2; h.render();
  h.props.environment = 'dev'; h.render();
  first.resolve(summary()); h.requests[1].resolve(summary({ import_batch_id: 2 }));
  await h.settle(); assert.deepEqual(h.values(), ['—', '—']);
  h.requests[2].resolve(summary({ import_batch_id: 2 })); await h.settle();
  assert.deepEqual(h.values(), ['30', '210']);
});
test('a mismatched server import cannot be presented as this import\'s counts', async () => {
  const h = harness(); h.requests[0].resolve(summary({ import_batch_id: 2 })); await h.settle();
  assert.deepEqual(h.values(), ['—', '—']); assert.match(h.text(), /import changed/);
});
for (const props of [{ importBatchId: null }, { environment: null }]) {
  test(`no request or fabricated zero without a confirmed import/environment: ${JSON.stringify(props)}`, () => {
    const h = harness(props); assert.equal(h.requests.length, 0); assert.deepEqual(h.values(), ['—', '—']);
  });
}
test('unmount discards an outstanding response', async () => {
  const h = harness(); h.unmount(); const writes = h.writes();
  h.requests[0].resolve(summary()); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.writes(), writes);
});
