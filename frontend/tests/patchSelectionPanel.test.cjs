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
const { PATCH_BUSINESS_OPTIONS, bulkPatchScenarioOptions, withdrawalBlocker } = load('patchScenarios.ts');
const props = { family: 'Synthetic family', variant: 'Synthetic model', environment: 'dev',
  scenario: '', options: [], selectedKey: null, onScenarioChange() {}, onSelect() {} };
const markup = changes => renderToStaticMarkup(React.createElement(PatchSelectionPanel, { ...props, ...changes }));

test('only the four available business changes appear with plain menu labels', () => {
  assert.deepEqual(PATCH_BUSINESS_OPTIONS.map(option => option.label), [
    'Trade Name', 'Critical Warnings', 'Storage Conditions', 'Device Market Status',
  ]);
  const html = markup();
  assert.equal((html.match(/<option /g) || []).length, 5); // Four choices plus the prompt.
  assert.doesNotMatch(html, /Base Quantity|Production Identifier|Sterile|Latex|Equivalent First Patch|\(success\)|\(rejected\)|\(untested\)/);
  assert.ok(html.indexOf('id="patch-scenario-selector"') < html.indexOf('Device UDI-DI or catalogue number'));
});

test('the operator must choose a model and scenario before finding a device', () => {
  assert.match(markup(), /type="search"[^>]*disabled/);
  assert.match(markup({ family: null, variant: null }), /<select[^>]*disabled/);
  let chosen = null;
  const tree = PatchSelectionPanel({ ...props, onScenarioChange(value) { chosen = value; } });
  const controls = tree.props.children.find(node => node?.props.className === 'patch-scenario-control');
  controls.props.children.find(node => node?.type === 'select').props.onChange({ target: { value: 'status_code_edit' } });
  assert.equal(chosen, 'status_code_edit');
  assert.doesNotMatch(markup({ scenario: chosen }), /type="search"[^>]*disabled/);
  assert.match(markup({ scenario: chosen }), /Search within Synthetic model/);
});

test('withdrawal is available in both environments with the same transition safeguards', () => {
  assert.equal(withdrawalBlocker('dev', 'ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), null);
  assert.equal(withdrawalBlocker('prod', 'ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), null);
  assert.match(withdrawalBlocker(null, 'ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), /confirmed application environment/);
  assert.match(withdrawalBlocker('dev', 'NOT_INTENDED_FOR_EU_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), /accepted status/);
  assert.match(withdrawalBlocker('dev', null, 'NO_LONGER_PLACED_ON_THE_MARKET'), /accepted status/);
  assert.match(withdrawalBlocker('dev', 'ON_THE_MARKET', ''), /Select No longer/);
  assert.match(markup({ environment: 'prod', scenario: 'status_code_edit' }), /matching Success XML/);
  assert.match(withdrawalBlocker('prod', 'NO_LONGER_PLACED_ON_THE_MARKET', 'NO_LONGER_PLACED_ON_THE_MARKET'), /accepted status/);
});


test('bulk withdrawal is offered in both confirmed environments', () => {
  for (const environment of ['dev', 'prod']) {
    assert.deepEqual(bulkPatchScenarioOptions(environment), [...PATCH_BUSINESS_OPTIONS]);
  }
  assert.equal(bulkPatchScenarioOptions(null).some(option => option.id === 'status_code_edit'), false);
});

test('baseline progress and failures are visible beside the selected device', () => {
  assert.match(markup({selectedKey:'chosen',baselineLoading:true}), /Loading the selected device/);
  assert.match(markup({selectedKey:'chosen',baselineLoaded:true}), /Accepted baseline loaded/);
  assert.match(markup({selectedKey:'chosen',baselineError:'Identity mismatch'}), /role="alert"[^>]*>Accepted baseline could not be loaded: Identity mismatch/);
  assert.doesNotMatch(markup({selectedKey:null,baselineLoaded:true}), /Accepted baseline loaded/);
});

test('selecting the same device again requests a fresh accepted baseline', () => {
  const source=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');
  const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast)==='PatchSelectionPanel') {
      handler=node.attributes.properties.find(p=>p.name?.getText(ast)==='onSelect').initializer.expression.getText(ast);
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(handler);
  let retry=0,selectedKey=null,baseline='loaded';
  const select=new Function('setSelectedXmlRecordKey','setPatchSearchSelectionKey','setAcceptedBaselineRetry','setXmlPairPreview','setXmlPatchPreview','setAcceptedBaselineError','setXmlActionMessage',`return (${handler});`)(
    ()=>{},key=>{selectedKey=key;},update=>{retry=update(retry);},value=>{baseline=value;},()=>{},()=>{},()=>{});
  const option={key:'same-device',record:{catalogue_number:'SYN-TEST'}};
  select(option);select(option);
  assert.equal(selectedKey,'same-device');assert.equal(baseline,null);assert.equal(retry,2);
});
