const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/registrationParents.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const moduleUnderTest = { exports: {} };
new Function('require', 'module', 'exports', output)(require, moduleUnderTest, moduleUnderTest.exports);
const { registrationParents, parentNextStep, childXmlActions } = moduleUnderTest.exports;
function group(extra = {}) {
  return {key: 'model1', parent_key: 'GS1:B1', basic_udi_di: 'B1', parent_issuing_entity: 'GS1',
    product_family: 'Family', product_variant: 'Model', parent_registered: false, parent_post_ready: true,
    total_devices: 107, registered_devices: 0, awaiting_devices: 107, unknown_devices: 0,
    child_post_ready: 0, awaiting_blocked: 0, patch_ready: 0, market_info_ready: 0, ...extra};
}
test('models sharing the same issuer-qualified parent form one row, while issuers remain distinct', () => {
  const parents = registrationParents([group(), group({key: 'model2', product_variant: 'Other', total_devices: 3, awaiting_devices: 3}),
    group({key: 'model3', parent_key: 'HIBCC:B1', parent_issuing_entity: 'HIBCC'})]);
  assert.equal(parents.length, 2);
  assert.equal(parents[0].total, 110);
  assert.equal(parents[0].awaiting, 110);
  assert.deepEqual(parents[0].groupKeys, ['model1', 'model2']);
  assert.equal(parents[0].models.length, 2);
});
test('a seed acceptance changes the next step from parent POST to remaining child POST', () => {
  const before = registrationParents([group()])[0];
  assert.equal(parentNextStep(before), 'Review parent POST');
  const after = registrationParents([group({parent_registered: true, parent_post_ready: false,
    registered_devices: 1, awaiting_devices: 106, child_post_ready: 106})])[0];
  assert.equal(after.registeredChildren, 1);
  assert.equal(after.awaiting, 106);
  assert.equal(parentNextStep(after), 'Review Bulk UDI-DI POST');
});
test('unknown registration and unresolved parents remain distinct from confirmed awaiting devices', () => {
  const unknown = registrationParents([group({awaiting_devices: 0, unknown_devices: 107})])[0];
  assert.equal(parentNextStep(unknown), 'Confirm unknown registration status');
  const missing = registrationParents([group({parent_key: '', parent_issuing_entity: null}),
    group({key: 'another', parent_key: '', parent_issuing_entity: null})]);
  assert.equal(missing.length, 2);
  assert.equal(parentNextStep(missing[0]), 'Resolve parent identity');
});
test('child XML labels distinguish seed, child-only POST, updates and unavailable actions', () => {
  assert.equal(childXmlActions({post_ready: true}), 'Parent + child POST candidate');
  assert.equal(childXmlActions({post_ready: true, child_post_ready: true}), 'Child POST ready');
  assert.equal(childXmlActions({patch_ready: true, market_info_ready: true}), 'PATCH ready · Market Info ready');
  assert.equal(childXmlActions({}), 'No available XML action');
});
