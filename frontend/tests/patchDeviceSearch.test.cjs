const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative, overrides = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => overrides[name] ?? require(name), module, module.exports);
  return module.exports;
}
const search = load('patchDeviceSearch.ts');
function record(overrides = {}) {
  return { product_family: 'Socket Adaptors', product_variant: 'Socket Adaptors',
    catalogue_number: 'P189410', primary_udi_di: '05050649091186', issuing_entity: 'GS1',
    xml_readiness: { status: 'complete' }, ...overrides };
}
function harness(records, environment = 'prod') {
  const state = []; let cursor = 0;
  const props = { options: search.patchDeviceSearchOptions(records), environment, family: 'Socket Adaptors', variant: 'Socket Adaptors', selectedKey: null, onSelect(option) {
    calls.push(option); props.selectedKey = option.key;
  } };
  const calls = [];
  const { PatchDeviceSearch } = load('components/PatchDeviceSearch.tsx', {
    '../patchDeviceSearch': search,
    react: { useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial;
      return [state[i], value => { state[i] = value; }]; }, useId: () => 'patch-device' },
  });
  function render() {
    cursor = 0; const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      nodes.push(node); visit(node.props?.children);
    }
    visit(PatchDeviceSearch(props)); return nodes;
  }
  return { props, calls, render, type(query) {
    render().find(node => node.type === 'input').props.onChange({ target: { value: query } });
    return render();
  }, text() { return JSON.stringify(render()); } };
}

test('typing narrows 10,000 imported devices without changing selection or rendering thousands of rows', () => {
  const records = Array.from({ length: 10000 }, (_, i) => record({
    catalogue_number: `CAT-${i}`, primary_udi_di: `05050649${String(i).padStart(6, '0')}`,
  }));
  const h = harness([...records, record()]);
  assert.equal(h.render().filter(n => n.type === 'tr').length, 0);
  assert.equal(h.type('0').filter(n => n.type === 'tr').length, 0);
  let rows = h.type('05050649').filter(n => n.type === 'tbody')[0].props.children;
  assert.equal(rows.length, 10); assert.match(h.text(), /10001 matching devices/);
  rows = h.type('05050649091186').filter(n => n.type === 'tbody')[0].props.children;
  assert.equal(rows.length, 1); assert.match(h.text(), /P189410/);
  assert.deepEqual(h.calls, []);
  h.render().find(n => n.props.children === 'Select for PATCH').props.onClick();
  assert.equal(h.calls[0].record.primary_udi_di, '05050649091186');
  assert.match(h.text(), /Selected for PATCH/);
  h.render().find(n => n.props.children === 'Clear device search').props.onClick();
  assert.equal(h.render().filter(n => n.type === 'tr').length, 0);
  assert.equal(h.calls.length, 1); // Clearing the query retains the chosen device.
});

test('catalogue queries ignore case and whitespace; exact identities precede partial matches', () => {
  const options = search.patchDeviceSearchOptions([
    record({ catalogue_number: 'P189410-extra', primary_udi_di: '0050506490911869' }),
    record({ catalogue_number: 'XP189410', primary_udi_di: '99' }), record(),
  ]);
  assert.equal(search.searchPatchDevices(options, '  p189410 ').results[0].record.catalogue_number, 'P189410');
  assert.equal(search.searchPatchDevices(options, '05050649091186').results[0].record.primary_udi_di, '05050649091186');
  const h = harness([record()]); h.type('missing');
  assert.match(h.text(), /No matching device in the selected model for this environment/);
  assert.equal(h.render().filter(n => n.type === 'table').length, 0);
});

test('same catalogue in different models stays distinct and selection preserves the exact model and UDI', () => {
  const records = [record(), record({ product_family: 'Other family', product_variant: 'Other model', primary_udi_di: '00012345' })];
  const options = search.patchDeviceSearchOptions(records);
  assert.equal(options.length, 2);
  assert.ok(options.every(option => !option.blockedReason));
  const chosen = options[1];
  assert.equal(search.resolvePatchSearchSelection(options, chosen.key, 'Other family', 'Other model').primary_udi_di, '00012345');
  assert.equal(search.resolvePatchSearchSelection(options, chosen.key, 'Socket Adaptors', 'Socket Adaptors'), null);
});

test('ambiguous catalogue identities and XML blockers are visible but cannot be selected', () => {
  const h = harness([record(), record({ primary_udi_di: '00012345' }),
    record({ catalogue_number: 'P189410-blocked', xml_readiness: { status: 'incomplete' } })]);
  h.type('p189410');
  const buttons = h.render().filter(n => n.props.children === 'Select for PATCH');
  assert.equal(buttons.length, 3); assert.ok(buttons.every(button => button.props.disabled));
  assert.match(h.text(), /catalogue identifies multiple devices/);
  assert.match(h.text(), /XML data blockers/);
  for (const option of h.props.options) {
    assert.equal(search.resolvePatchSearchSelection(h.props.options, option.key, option.record.product_family, option.record.product_variant), null);
  }
});

test('identical source rows deduplicate, while missing identity or a removed selection fails closed', () => {
  const options = search.patchDeviceSearchOptions([record(), record()]);
  assert.equal(options.length, 1);
  assert.equal(search.resolvePatchSearchSelection([], options[0].key, 'Socket Adaptors', 'Socket Adaptors'), null);
  const incomplete = search.patchDeviceSearchOptions([record({ issuing_entity: null })]);
  assert.match(incomplete[0].blockedReason, /identity is incomplete/);
});

test('a baseline from another device or model cannot satisfy a searched PATCH selection', () => {
  assert.ok(search.patchSearchBaselineMatches(record(), record()));
  assert.equal(search.patchSearchBaselineMatches(record(), record({ primary_udi_di: '99999' })), false);
  assert.equal(search.patchSearchBaselineMatches(record(), record({ product_variant: 'Other model' })), false);
  assert.equal(search.patchSearchBaselineMatches(record(), null), false);
  assert.equal(search.patchSearchBaselineMatches(record({ primary_udi_di: null }), record()), false);
});

test('unknown environment disables selection and the environment name is explicit', () => {
  const h = harness([record()], null);
  assert.ok(h.render().find(n => n.type === 'input').props.disabled);
  h.type('P189410');
  assert.equal(h.render().filter(n => n.props.children === 'Select for PATCH').length, 0);
  assert.match(harness([], 'prod').text(), /Production/);
  assert.match(harness([], 'dev').text(), /Dev \/ Playground/);
});


test('model scope excludes an exact UDI match from another model and scenario is required first', () => {
  const h = harness([record(), record({ product_variant: 'Another model', primary_udi_di: '00099999' })]);
  h.type('00099999');
  assert.equal(h.render().filter(n => n.props.children === 'Select for PATCH').length, 0);
  assert.match(h.text(), /No matching device in the selected model/);
  h.props.enabled = false;
  assert.ok(h.render().find(n => n.type === 'input').props.disabled);
  h.props.enabled = true; h.props.family = null;
  assert.ok(h.render().find(n => n.type === 'input').props.disabled);
});
