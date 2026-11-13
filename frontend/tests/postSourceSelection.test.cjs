const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/postSourceSelection.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', output)(loaded, loaded.exports);
const { postSourceSelectable } = loaded.exports;

test('both environments ignore historical POST/PATCH source labels', () => {
  for (const environment of ['dev', 'prod']) {
    for (const historical of ['POST', 'PATCH', null]) {
      assert.equal(postSourceSelectable(environment, historical), true);
    }
  }
});
test('unresolved environments do not expose an operational candidate set', () => {
  for (const environment of [null, undefined, '']) {
    assert.equal(postSourceSelectable(environment, 'PATCH'), false);
    assert.equal(postSourceSelectable(environment, 'POST'), false);
  }
});
test('designation follows active registration evidence and legacy success flags are ignored', () => {
  const { registrationOperation, hasRegistrationEvidence } = loaded.exports;
  assert.equal(registrationOperation(true), 'PATCH');
  assert.equal(registrationOperation(false), 'POST');
  assert.equal(registrationOperation(undefined), null);
  assert.equal(hasRegistrationEvidence({ post_success: true }), false);
  for (const evidence of ['imported_baseline_present', 'has_successful_device_post', 'has_successful_child_post_or_patch']) {
    assert.equal(hasRegistrationEvidence({ [evidence]: true }), true);
  }
});
