const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/canonicalValidationStatus.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', output)(loaded, loaded.exports);
const { canonicalCompletenessNotes, canonicalValidationStatus } = loaded.exports;

test('Production completeness notes do not turn XML-ready devices into blocked devices', () => {
  assert.deepEqual(canonicalValidationStatus('prod', 350, 350, 350), { label: 'XML ready', className: 'ok' });
});
test('Production XML blockers remain visible even when canonical completeness is satisfied', () => {
  assert.deepEqual(canonicalValidationStatus('prod', 2, 0, 0), { label: 'XML blocked', className: 'warn' });
});
test('Dev retains its completeness warning and ready states; empty scopes remain stopped', () => {
  assert.deepEqual(canonicalValidationStatus('dev', 350, 350, 350), { label: 'Warning', className: 'warn' });
  assert.deepEqual(canonicalValidationStatus('dev', 2, 0, 0), { label: 'Ready', className: 'ok' });
  assert.deepEqual(canonicalValidationStatus('prod', 0, 0, 0), { label: 'Stop', className: 'danger' });
});

test('XML-required gaps remain blockers rather than nonblocking completeness notes', () => {
  const record = {
    blockers: ['Clinical Investigation is not populated.', 'Manufacturer SRN is not populated.'],
    fields: [
      { business_label: 'Clinical Investigation', xml_required: false, value: null },
      { business_label: 'Manufacturer SRN', xml_required: true, value: null },
    ],
  };
  assert.deepEqual(canonicalCompletenessNotes(record, 'prod'), ['Clinical Investigation is not populated.']);
  assert.deepEqual(canonicalCompletenessNotes(record, 'dev'), record.blockers);
});
