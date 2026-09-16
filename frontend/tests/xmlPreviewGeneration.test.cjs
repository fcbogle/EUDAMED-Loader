const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(mode = 'patch') {
  const refs = [], effects = [], updates = [], requests = [];
  let index = 0;
  const react = {
    useRef: (value) => { const i = index++; return refs[i] ?? (refs[i] = { current: value }); },
    useEffect: (callback, deps) => {
      const i = index++;
      const previous = effects[i];
      if (!previous || deps.some((value, j) => value !== previous.deps[j])) {
        previous?.cleanup?.();
        effects[i] = { deps, cleanup: callback() };
      }
    },
  };
  const api = new Proxy({}, { get: (_, method) => (...args) => {
    const pending = deferred(); requests.push({ method, args, ...pending }); return pending.promise;
  } });
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/useXmlPreviewGeneration.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => name === 'react' ? react : { api }, module, module.exports);
  const identity = { product_family: 'Family A', product_variant: 'Variant A', catalogue_number: 'CAT-A' };
  let args = {
    xmlMode: mode, previewSelectionKey: 'selection-A', acceptedStateToken: {},
    selectedXmlFamilySummary: identity, selectedXmlVariantSummary: identity,
    selectedPairRequestArgs: identity, selectedMarketInfoRequestArgs: identity,
    selectedPatchScenarioId: 'trade_name_edit', patchVersionInput: '3', normalizedMarketInfoVersion: '2',
    currentPatchScenarioInputs: () => ({ new_trade_name: 'Draft A' }),
    currentMarketInfoScenarioInputs: () => [{ country: 'DE', original_placed_on_market: true }],
    selectedXmlChunkSequence: 1, effectiveBulkUdidiPostCatalogueNumbers: ['CAT-A'],
    selectedBulkPatchParentGroup: { basic_udi_di: 'PARENT-A' },
    selectedBulkMarketInfoParentGroup: { basic_udi_di: 'PARENT-A' },
    normalizedBulkMarketInfoScenarioItems: [{ country: 'DE', original_placed_on_market: true }],
    resolveBulkPatchCatalogueNumbers: async () => ['CAT-A'],
    resolveBulkMarketInfoCatalogueNumbers: async () => ['CAT-A'],
  };
  for (const setter of ['setXmlPairPreview', 'setXmlMarketInfoPreview', 'setXmlPatchPreview',
    'setXmlBulkUdidiPostPreview', 'setXmlBulkPatchPreview', 'setXmlBulkMarketInfoPreview',
    'setError', 'setXmlActionMessage', 'setIsGeneratingXml']) {
    args[setter] = value => updates.push([setter, value]);
  }
  return {
    requests, updates,
    render(changes = {}) { args = { ...args, ...changes }; index = 0; return module.exports.useXmlPreviewGeneration(args); },
    unmount() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

for (const mode of ['post', 'patch', 'marketInfo', 'bulkUdidiPost', 'bulkPatch', 'bulkMarketInfo']) {
  test(`${mode}: a delayed preview cannot overwrite a changed selection`, async () => {
    const h = harness(mode);
    const pending = h.render().generateXmlPreview();
    await Promise.resolve();
    assert.equal(h.requests.length, 1);
    h.render({ previewSelectionKey: 'selection-B' });
    const count = h.updates.length;
    h.requests[0].resolve({ catalogue_number: 'CAT-A', selected_chunk_sequence: 1 });
    await pending;
    assert.equal(h.updates.length, count);
  });
}

for (const [name, change] of Object.entries({
  device: { selectedPairRequestArgs: { product_family: 'Family A', product_variant: 'Variant A', catalogue_number: 'CAT-B' } },
  scenario: { selectedPatchScenarioId: 'base_quantity_edit' },
  inputs: { currentPatchScenarioInputs: () => ({ new_trade_name: 'Draft B' }) },
  version: { patchVersionInput: '4' },
  operation: { xmlMode: 'marketInfo' },
  acceptance: { acceptedStateToken: {} },
})) {
  test(`changing ${name} invalidates pending preview errors`, async () => {
    const h = harness();
    const pending = h.render().generateXmlPreview();
    h.render(change);
    const count = h.updates.length;
    h.requests[0].reject(new Error('Old request failed'));
    await pending;
    assert.equal(h.updates.length, count);
  });
}

test('returning to the original selection does not revive an old preview', async () => {
  const h = harness();
  const pending = h.render().generateXmlPreview();
  h.render({ previewSelectionKey: 'B' });
  h.render({ previewSelectionKey: 'selection-A' });
  const count = h.updates.length;
  h.requests[0].resolve({ catalogue_number: 'CAT-A' });
  await pending;
  assert.equal(h.updates.length, count);
});

test('only the newest overlapping request can update preview and loading state', async () => {
  const h = harness();
  const first = h.render().generateXmlPreview();
  const second = h.render().generateXmlPreview();
  const count = h.updates.length;
  h.requests[0].resolve({ draft: 'old' });
  await first;
  assert.equal(h.updates.length, count);
  h.requests[1].resolve({ draft: 'new' });
  await second;
  assert.deepEqual(h.updates.slice(count), [['setXmlPatchPreview', { draft: 'new' }], ['setIsGeneratingXml', false]]);
});

test('bulk scope changes during selection resolution prevent obsolete generation', async () => {
  const h = harness('bulkPatch');
  const selection = deferred();
  const pending = h.render({ resolveBulkPatchCatalogueNumbers: () => selection.promise }).generateXmlPreview();
  h.render({ previewSelectionKey: 'B' });
  const count = h.updates.length;
  selection.resolve(['CAT-A']);
  await pending;
  assert.equal(h.requests.length, 0);
  assert.equal(h.updates.length, count);
});

test('unmount invalidates pending previews', async () => {
  const h = harness();
  const pending = h.render().generateXmlPreview();
  h.unmount();
  const count = h.updates.length;
  h.requests[0].resolve({ draft: 'old' });
  await pending;
  assert.equal(h.updates.length, count);
});

test('current request errors remain visible and release loading state', async () => {
  const h = harness();
  const pending = h.render().generateXmlPreview();
  h.requests[0].reject(new Error('Current failure'));
  await pending;
  assert.deepEqual(h.updates.slice(-3), [
    ['setError', 'Current failure'], ['setXmlActionMessage', 'Current failure'], ['setIsGeneratingXml', false],
  ]);
});
