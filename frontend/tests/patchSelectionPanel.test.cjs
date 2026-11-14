const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(relative) {
  const filename = path.join(__dirname, '../src', relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!name.startsWith('.')) return require(name);
    const base = path.resolve(path.dirname(filename), name);
    const target = ['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync);
    return load(path.relative(path.join(__dirname, '../src'), target));
  }, module, module.exports);
  cache.set(filename, module.exports); return module.exports;
}
const { PatchSelectionPanel } = load('components/PatchSelectionPanel.tsx');
const { PATCH_BUSINESS_OPTIONS, withdrawalBlocker } = load('patchScenarios.ts');
const props = { family: 'Synthetic family', variant: 'Synthetic model', environment: 'dev',
  scenario: '', options: [], selectedKey: null, onScenarioChange() {}, onSelect() {} };
const markup = changes => renderToStaticMarkup(React.createElement(PatchSelectionPanel, { ...props, ...changes }));

test('only the five agreed business changes appear with plain menu labels', () => {
  assert.deepEqual(PATCH_BUSINESS_OPTIONS.map(option => option.label), [
    'Trade Name', 'Critical Warnings', 'Storage Conditions', 'Base Quantity', 'Device Market Status',
  ]);
  const html = markup();
  assert.equal((html.match(/<option /g) || []).length, 6); // Five choices plus the prompt.
  assert.doesNotMatch(html, /Production Identifier|Sterile|Latex|Equivalent First Patch|\(success\)|\(rejected\)|\(untested\)/);
  assert.ok(html.indexOf('id="patch-scenario-selector"') < html.indexOf('Device UDI-DI or catalogue number'));
});

test('the operator must choose a model and scenario before finding a device', () => {
  assert.match(markup(), /type="search"[^>]*disabled/);
  assert.match(markup({ family: null, variant: null }), /<select[^>]*disabled/);
  let chosen = null;
  const tree = PatchSelectionPanel({ ...props, onScenarioChange(value) { chosen = value; } });
  tree.props.children.find(node => node?.type === 'select').props.onChange({ target: { value: 'status_code_edit' } });
  assert.equal(chosen, 'status_code_edit');
  assert.doesNotMatch(markup({ scenario: chosen }), /type="search"[^>]*disabled/);
  assert.match(markup({ scenario: chosen }), /Search within Synthetic model/);
});

test('withdrawal is available for Dev testing, while Production generation remains gated', () => {
  assert.equal(withdrawalBlocker('dev', 'ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), null);
  assert.match(withdrawalBlocker('prod', 'ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), /Playground verification/);
  assert.match(withdrawalBlocker('dev', 'NOT_INTENDED_FOR_EU_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), /accepted status/);
  assert.match(withdrawalBlocker('dev', null, 'NO_LONGER_PLACED_ON_THE_MARKET'), /accepted status/);
  assert.match(withdrawalBlocker('dev', 'ON_THE_MARKET', ''), /Select No longer/);
  assert.match(markup({ environment: 'prod', scenario: 'status_code_edit' }), /Production generation awaits/);
});
