const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the shared TypeScript dispatcher without a browser or additional dependencies.
function loadTypeScript(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}

for (const [mode, method, identity] of [
  ['post', 'assessSinglePost', 'CAT-002'],
  ['patch', 'assessSinglePatch', 'CAT-002'],
  ['marketInfo', 'assessSingleMarketInfo', 'CAT-002'],
  ['bulkPatch', 'assessBulkPatch', 'BASIC-1'],
  ['bulkMarketInfo', 'assessBulkMarketInfo', 'BASIC-1'],
  ['bulkUdidiPost', 'assessBulkPost', undefined],
]) {
  test(`${mode} refresh uses the same assessment and exact identity as initial loading`, async () => {
    const calls = [];
    const api = { [method]: (...args) => { calls.push(args); return Promise.resolve({ status: 'available' }); } };
    const { requestXmlAssessment } = loadTypeScript('xmlAssessmentRequest.ts', { './api': { api } });
    await requestXmlAssessment({ mode, productFamily: 'Family A', productVariant: 'Variant A', catalogueNumber: 'CAT-002', basicUdiDi: 'BASIC-1' });
    assert.deepEqual(calls, [identity ? ['Family A', 'Variant A', identity] : ['Family A', 'Variant A']]);
  });
}

test('upload scope guard distinguishes another device, parent and operation', () => {
  const { assessmentScopeKey } = loadTypeScript('xmlAssessmentRequest.ts', { './api': { api: {} } });
  const scope = { mode: 'patch', productFamily: 'Family A', productVariant: 'Variant A', catalogueNumber: 'CAT-001' };
  const key = assessmentScopeKey(scope);
  assert.equal(key, assessmentScopeKey({ ...scope }));
  for (const change of [{ catalogueNumber: 'CAT-002' }, { basicUdiDi: 'BASIC-2' }, { mode: 'marketInfo' }, { productVariant: 'Variant B' }]) {
    assert.notEqual(key, assessmentScopeKey({ ...scope, ...change }));
  }
  assert.notEqual(key, assessmentScopeKey(null));
});

test('all six visible workspace labels are retained', () => {
  const { resolveXmlModeUi } = loadTypeScript('xmlWorkspaceView.ts');
  for (const [mode, label] of Object.entries({ post: 'POST', patch: 'Patch XML', marketInfo: 'Market Info', bulkUdidiPost: 'Bulk UDI-DI POST', bulkPatch: 'Bulk PATCH', bulkMarketInfo: 'Bulk Market Info' })) {
    assert.equal(resolveXmlModeUi(mode).label, label);
  }
});

test('an upload cannot overwrite a different selected device', async () => {
  const refs = [];
  let refIndex = 0;
  const react = {
    useState: (initial) => [initial, () => {}],
    useRef: (initial) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
  };
  let finishUpload;
  let refreshed = false;
  const api = {
    uploadSuccessXml: () => new Promise((resolve) => { finishUpload = resolve; }),
    testingSubjectSummaries: () => { refreshed = true; return Promise.resolve([]); },
  };
  const { useSuccessXmlUpload } = loadTypeScript('useSuccessXmlUpload.ts', {
    react, './api': { api },
    './xmlAssessmentRequest': loadTypeScript('xmlAssessmentRequest.ts', { './api': { api } }),
  });
  const updates = [];
  const args = {
    scope: { mode: 'patch', productFamily: 'Family A', productVariant: 'Variant A', catalogueNumber: 'CAT-001' },
    setError: () => {}, setXmlActionMessage: () => {},
    setTestingSubjectSummaries: (value) => updates.push(value),
    setXmlOperationAssessment: (value) => updates.push(value),
    setXmlOperationAssessmentError: () => {}, clearPreviewState: () => updates.push('clear'),
  };
  useSuccessXmlUpload(args).handleSuccessXmlSelected({ target: { files: [{ name: 'ack.xml', text: async () => '<ack />' }] } });
  await new Promise(setImmediate);
  assert.equal(typeof finishUpload, 'function');
  refIndex = 0;
  useSuccessXmlUpload({ ...args, scope: { ...args.scope, catalogueNumber: 'CAT-002' } });
  finishUpload({ summary_message: 'Recorded' });
  await new Promise(setImmediate);
  assert.equal(refreshed, false);
  assert.deepEqual(updates, []);
});

test('bulk selection waits for the posted cohort instead of using parent samples', () => {
  const { resolveBulkCatalogueNumbers } = loadTypeScript('xmlActionInputs.ts');
  assert.deepEqual(resolveBulkCatalogueNumbers({ hasParent: true, scopeMode: 'all_posted', postedCatalogueNumbers: [], effectiveCatalogueNumbers: [], selectedCatalogueNumbers: [], importedMatchedCatalogueNumbers: [] }), []);
});

test('PATCH preview readiness requires a loaded accepted baseline, not a prior ZIP review', () => {
  let stateIndex = 0;
  const react = {
    useEffect: () => {},
    useState: (initial) => [stateIndex++ === 0 ? '2' : initial, () => {}],
  };
  const { usePatchScenarioState } = loadTypeScript('usePatchScenarioState.ts', { react });
  const args = {
    selectedXmlFamily: 'Family A', selectedXmlVariant: 'Variant A', selectedXmlRecordKey: 'CAT-001',
    selectedPatchScenario: { id: 'equivalent_first_patch', target: 'Version', implemented: true },
    selectedPatchWorkspaceRecordTradeName: 'Accepted name', selectedPatchWorkspaceCatalogueNumber: 'CAT-001',
    selectedCurrentTradeName: 'Accepted name', selectedCurrentBaseQuantity: 1,
    selectedCurrentSterile: false, selectedCurrentLatex: false, selectedCurrentStatusCode: 'ON_THE_MARKET',
    selectedPatchWarningCodes: [], selectedPatchStorageConditionMap: new Map(),
    hasLoadedPatchBaseline: true, isSharedAnchorLoading: false,
    xmlPairPreview: { latest_successful_patch_state: null }, xmlPatchPreview: null,
    selectedPairRequestArgs: { product_family: 'Family A', product_variant: 'Variant A', catalogue_number: 'CAT-001', primary_udi_di: '111111' },
    setXmlPatchPreview: () => {},
  };
  const loaded = usePatchScenarioState(args);
  assert.equal(loaded.isPatchScenarioReady, true);
  assert.equal(loaded.hasCurrentGeneratedPatchPreview, false);
  stateIndex = 0;
  const missing = usePatchScenarioState({ ...args, hasLoadedPatchBaseline: false });
  assert.equal(missing.isPatchScenarioReady, false);
  assert.match(missing.patchScenarioReadinessMessage, /Load the accepted baseline/);
});
