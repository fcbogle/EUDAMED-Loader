const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/RegistrationCountSummary.tsx'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleUnderTest = { exports: {} };
new Function('require', 'module', 'exports', output)(require, moduleUnderTest, moduleUnderTest.exports);
const summary = {
  import_batch_id: 2, imported_at: '2026-10-08T10:00Z', calculated_at: '2026-10-08T12:00Z', latest_acceptance_at: null,
  source_rows: 15, mapped_rows: 12, outside_canonical_scope_rows: 3, unresolved_identity_rows: 1,
  duplicate_identity_rows: 1, identity_issue_count: 1, unmatched_success_subjects: 2,
  counts: {total_parents: 2, registered_parents: 1, unknown_parents: 1, total_devices: 10,
    registered_devices: 4, unknown_devices: 6, awaiting_devices: 0, awaiting_ready: 0, awaiting_blocked: 0,
    post_ready: 5, child_post_ready: 3, patch_ready: 2, market_info_ready: 1},
};
function render(overrides = {}) {
  const nodes = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    nodes.push(node); visit(node.props?.children);
  }
  visit(moduleUnderTest.exports.RegistrationCountSummary({summary, isLoading: false, error: null, onRefresh() {}, ...overrides}));
  return { nodes, text: JSON.stringify(nodes) };
}
test('registration counts distinguish unknown from awaiting and show snapshot provenance and exclusions', () => {
  const { text, nodes } = render();
  assert.match(text, /Devices unknown/);
  assert.match(text, /without acceptance evidence remain unknown/);
  assert.match(text, /No non-registration reconciliation/);
  assert.match(text, /2026-10-08T10:00Z/);
  assert.match(text, /outside canonical scope/);
  assert.match(text, /unmatched to current identities/);
  assert.deepEqual(nodes.filter(n => n.type === 'strong').map(n => n.props.children), [2,1,1,10,4,6,5,3,2,1]);
});
for (const state of [{ isLoading: true }, { error: 'Refresh failed' }, { summary: null }, { summary: {...summary, import_batch_id: null} }]) {
  test(`unavailable counts show dashes instead of stale totals or zero: ${JSON.stringify(state)}`, () => {
    const { nodes } = render(state);
    assert.ok(nodes.filter(n => n.type === 'strong').every(n => n.props.children === '—'));
  });
}
test('refresh can recover a failed count request', () => {
  let refreshed = false;
  const { nodes, text } = render({ error: 'Refresh failed', onRefresh: () => { refreshed = true; } });
  assert.match(text, /Refresh failed/);
  const button = nodes.find(n => n.type === 'button');
  assert.equal(button.props.disabled, false);
  button.props.onClick(); assert.equal(refreshed, true);
});
