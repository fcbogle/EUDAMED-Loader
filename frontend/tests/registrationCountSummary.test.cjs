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
  assert.match(text, /A device stays Unknown/);
  assert.match(text, /Confirm unknown registration status/);
  assert.doesNotMatch(text, /No non-registration reconciliation/);
  assert.match(text, /8 Oct 2026/);
  assert.doesNotMatch(text, /2026-10-08T10:00Z/);
  assert.match(text, /source rows could not be mapped/);
  assert.match(text, /could not be matched to current devices/);
  assert.deepEqual(nodes.filter(n => n.type === 'strong').map(n => n.props.children), [2,1,1,10,4,6,5,3,2,1]);
});

test('MAX awaiting counts remain visible while provenance is collapsed and irrelevant unknown warnings are omitted', () => {
  const current = { ...summary, outside_canonical_scope_rows: 0, unresolved_identity_rows: 0,
    identity_issue_count: 0, unmatched_success_subjects: 0,
    counts: { ...summary.counts, unknown_devices: 0, awaiting_devices: 940, awaiting_ready: 940,
      awaiting_blocked: 0, unresolved_parent_devices: 0 } };
  const { nodes, text } = render({ summary: current });
  const details = nodes.find(n => n.type === 'details');
  assert.ok(details);
  assert.ok(!details.props.open);
  assert.match(JSON.stringify(details), /8 Oct 2026/);
  const paragraphs = nodes.filter(n => n.type === 'p');
  assert.ok(paragraphs.some(n => JSON.stringify(n.props.children).includes('Awaiting registration:') &&
    JSON.stringify(n.props.children).includes('940')));
  assert.doesNotMatch(text, /Confirm unknown registration status|A device stays Unknown|Import data needs review/);
});

test('nonzero data exceptions stay visible outside collapsed details', () => {
  const { nodes } = render();
  const warning = nodes.find(n => n.type === 'p' && n.props.className === 'status-detail-emphasis');
  assert.equal(warning.props.children, 'Import data needs review; see Details.');
});

test('a clean import uses readable counts and a short all-clear message without zero-valued diagnostics', () => {
  const { nodes, text } = render({summary: {...summary, source_rows: 10026, mapped_rows: 10026,
    outside_canonical_scope_rows: 0, unresolved_identity_rows: 0, duplicate_identity_rows: 0,
    identity_issue_count: 0, unmatched_success_subjects: 0,
    counts: {...summary.counts, unresolved_parent_devices: 0}}});
  const details = JSON.stringify(nodes.find(n => n.type === 'details'));
  assert.match(details, /10,026/);
  assert.match(details, /No outstanding data issues were found/);
  assert.match(details, /Latest registration confirmation date: not available/);
  assert.doesNotMatch(details, /canonical rows|unresolved parent identifier|0 rows/);
  assert.doesNotMatch(text, /No registration confirmations have been recorded/);
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
