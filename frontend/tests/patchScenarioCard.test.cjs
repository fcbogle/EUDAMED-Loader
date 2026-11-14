const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/components/PatchScenarioCard.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const component = { exports: {} };
const labels = { exports: {} };
const labelCode = ts.transpileModule(fs.readFileSync(require.resolve('../src/patchScenarios.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('require','module','exports',labelCode)(require,labels,labels.exports);
new Function('require', 'module', 'exports', compiled)(name => name === '../patchScenarios' ? labels.exports : require(name), component, component.exports);
function render(overrides = {}) {
  const props = {
    selectedPatchScenarioLabel: 'Trade Name Edit', selectedPatchScenarioStatus: 'EUDAMED Accepted',
    selectedPatchWorkspaceCatalogueNumber: 'SYN-00001', currentAcceptedPatchLabel: 'Not loaded',
    currentAcceptedPatchVersion: 3, patchVersionInput: '4', selectedPatchScenarioId: 'trade_name_edit',
    selectedPatchScenarioImplemented: true, patchTradeNameInput: 'New synthetic name',
    patchDraftComparisonRows: [{ label: 'Trade name', before: 'Original name', after: 'New synthetic name' }],
    patchDeviceOptions: [{ catalogueNumber: 'SYN-00001', primaryUdiDi: '00012345' }],
    patchScenarioOptions: [{ id: 'equivalent_first_patch', label: 'Equivalent First Patch' }, { id: 'trade_name_edit', label: 'Trade Name Edit' }],
    hasLoadedPatchBaseline: false, xmlPatchPreview: null, ...overrides,
  };
  const nodes = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    nodes.push(node); visit(node.props?.children);
  }
  visit(component.exports.PatchScenarioCard(props));
  return nodes;
}

test('failed baseline loading exposes the actual error and a usable local retry', () => {
  let retries = 0;
  const nodes = render({ baselineError: 'The accepted baseline could not be decoded.', onRetryBaseline() { retries++; } });
  assert.match(JSON.stringify(nodes), /could not be decoded/);
  assert.ok(nodes.some(n => n.props.role === 'alert'));
  const retry = nodes.find(n => n.type === 'button' && n.props.children === 'Reload accepted baseline');
  assert.ok(!retry.props.disabled); retry.props.onClick(); assert.equal(retries, 1);
  assert.equal(nodes.filter(n => n.type === 'select').length, 0);
});

test('loading state explains the wait and prevents overlapping manual retries', () => {
  const nodes = render({ baselineLoading: true, onRetryBaseline() {} });
  assert.match(JSON.stringify(nodes), /Loading accepted baseline/);
  assert.ok(nodes.find(n => n.props.children === 'Reload accepted baseline').props.disabled);
  assert.ok(nodes.some(n => n.props.role === 'status'));
});

test('a loaded baseline reveals scenario selection and the next PATCH version', () => {
  const nodes = render({ hasLoadedPatchBaseline: true, currentAcceptedPatchLabel: 'Accepted device version 3' });
  assert.ok(!nodes.some(n => n.props.id === 'patch-scenario-selector')); // Scenario is chosen before selecting the device.
  assert.ok(!nodes.some(n => n.type === 'option' && n.props.value === 'equivalent_first_patch'));
  assert.equal(nodes.find(n => n.props.id === 'patch-version-input').props.value, '4');
  assert.match(JSON.stringify(nodes), /Original name/);
  assert.match(JSON.stringify(nodes), /New synthetic name/);
  assert.ok(!nodes.some(n => n.props.children === 'Reload accepted baseline'));
});


test('withdrawal review has readable accepted Before and only the permitted After option', () => {
  const nodes = render({ hasLoadedPatchBaseline: true, selectedPatchScenarioId: 'status_code_edit',
    selectedCurrentStatusCode: 'ON_THE_MARKET', patchStatusCodeInput: 'NO_LONGER_PLACED_ON_THE_MARKET',
    withdrawalBlocker: 'Production generation awaits Playground verification.' });
  assert.match(JSON.stringify(nodes), /On the EU market/);
  assert.match(JSON.stringify(nodes), /No longer placed on the EU market/);
  assert.match(JSON.stringify(nodes), /Market Info is omitted/);
  assert.match(JSON.stringify(nodes), /linked container packages/);
  const selector = nodes.find(n => n.props.id === 'patch-status-code-input');
  assert.deepEqual(selector.props.children.map(n => n.props.value), ['', 'NO_LONGER_PLACED_ON_THE_MARKET']);
  assert.ok(!nodes.some(n => n.props.id === 'patch-device-selector'));
});
