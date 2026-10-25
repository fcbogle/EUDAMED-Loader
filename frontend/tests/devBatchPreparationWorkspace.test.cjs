const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const batch = id => ({ batch_id: id, created_at: '2026-10-25T10:00:00Z', manufacturer_srn: 'GB-MF-000000001', file_integrity: 'verified', files: [
  { name: 'Synthetic.xlsx', role: 'templates', size_bytes: 1024, source_modified_at: '2026-10-25T09:00:00Z', excluded: false },
  { name: 'Excluded.xlsx', role: 'templates', size_bytes: 1024, source_modified_at: '2026-10-25T09:00:00Z', excluded: true },
] });
const checked = id => ({ batch_id: id, inspection_complete: true, inspection_token: 'token', errors: [], requested_inspection_scope: {
  distinct_device_identities: 22, rows_with_findings: 0, duplicate_identity_occurrences: 0, excluded_workbook_names: ['Excluded.xlsx'], finding_counts: {}, in_exports: 2, export_only: 0,
}, exports: { device_records: 2 } });
const prepared = { batch_id: '2026-10-25-001', artifact_id: 'artifact', workbook_name: 'dev-import-example.xlsx', summary: { to_register_tab_rows: 20, registered_tab_rows: 2, rows_requiring_review: 1 }, review_examples: [{ key: 'GS1:00000000000001', catalogue: 'DEMO-1', device_type: 'Example', reasons: ['Source review needed'] }] };

function harness(overrides = {}) {
  const state = []; let cursor = 0; let tree; const effects = [];
  const props = { page: 'sourceFiles', enabled: true, onPageChange(page) { props.page = page; }, onContextChange() {} };
  const api = { devInputBatches: async () => ({ batches: [batch('2026-10-25-001'), batch('2026-10-25-002')] }), inspectDevInputBatch: async id => checked(id), prepareDevInputBatch: async () => prepared, ...overrides };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return state[i] ||= { current: initial }; },
    useEffect(fn, deps) { const i = cursor++; const old = state[i]; if (!old || deps.some((v, n) => v !== old.deps[n])) effects.push(() => { old?.cleanup?.(); state[i] = { deps, cleanup: fn(), effect: fn }; }); },
  };
  const source = fs.readFileSync(require.resolve('../src/components/DevBatchPreparationWorkspace.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => name === 'react' ? react : name === '../api' ? { api } : require(name), module, module.exports);
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(n => nodes(n ?? null));
    return [node, ...nodes(node.props?.children ?? null)];
  }
  function render() { cursor = 0; tree = module.exports.DevBatchPreparationWorkspace(props); while (effects.length) effects.shift()(); }
  function button(label) { return nodes().find(n => n.type === 'button' && n.props.children === label); }
  function click(label) { const b = button(label); assert.ok(b); assert.ok(!b.props.disabled); b.props.onClick(); render(); }
  function select(id) { nodes().find(n => n.props?.id === 'dev-input-batch').props.onChange({ target: { value: id } }); render(); }
  async function settle() { await new Promise(setImmediate); render(); }
  render(); return { props, api, nodes, button, click, select, settle, render,
    strictReplay() { const entries = state.filter(item => item?.effect); for (const item of entries) item.cleanup?.(); for (const item of entries) item.cleanup = item.effect(); },
    text: () => JSON.stringify(nodes().map(n => n.props?.children)) };
}

test('verified batch displays retained exclusions and requires checks before preparation', async () => {
  const h = harness(); await h.settle();
  assert.equal(h.button('Continue to Create Import Workbook').props.disabled, true);
  h.select('2026-10-25-001');
  assert.ok(h.text().includes('Excluded from preparation'));
  h.click('Continue to Create Import Workbook');
  assert.equal(h.button('Create Import Workbook').props.disabled, true);
  h.click('Check source data'); await h.settle();
  assert.equal(h.button('Create Import Workbook').props.disabled, false);
  assert.ok(h.text().includes('Existing exclusion retained'));
});

test('a delayed source check cannot enable preparation for another batch', async () => {
  let resolve;
  const h = harness({ inspectDevInputBatch: () => new Promise(done => { resolve = done; }) }); await h.settle();
  h.select('2026-10-25-001'); h.click('Continue to Create Import Workbook'); h.click('Check source data');
  h.select('2026-10-25-002'); resolve(checked('2026-10-25-001')); await h.settle();
  assert.equal(h.button('Create Import Workbook').props.disabled, true);
  assert.ok(!h.text().includes('Source checks completed'));
});

test('stale-input preparation failure clears previous checks', async () => {
  const h = harness({ prepareDevInputBatch: async () => { throw new Error('Inputs changed; check again'); } }); await h.settle();
  h.select('2026-10-25-001'); h.click('Continue to Create Import Workbook'); h.click('Check source data'); await h.settle();
  h.click('Create Import Workbook'); await h.settle();
  assert.ok(h.text().includes('Inputs changed; check again'));
  assert.equal(h.button('Create Import Workbook').props.disabled, true);
});

test('real preparation offers paired downloads and review findings but no database import', async () => {
  const h = harness(); await h.settle(); h.select('2026-10-25-001'); h.click('Continue to Create Import Workbook');
  h.click('Check source data'); await h.settle(); h.click('Create Import Workbook'); await h.settle();
  assert.equal(h.button('Download workbook + audit').props.disabled, false);
  assert.ok(h.text().includes('Source review needed'));
  h.click('View Assess & Import Workbook');
  assert.equal(h.button('Assess import').props.disabled, true);
  assert.equal(h.button('Confirm database import').props.disabled, true);
});

test('React StrictMode effect replay does not strand initial batch loading', async () => {
  let requests = 0;
  const h = harness({ devInputBatches: async () => { requests++; return { batches: [batch('2026-10-25-001')] }; } });
  h.strictReplay(); await h.settle();
  assert.equal(requests, 2);
  h.select('2026-10-25-001');
  assert.equal(h.button('Continue to Create Import Workbook').props.disabled, false);
});

const baselineAssessment = id => ({ batch_id: id, report_id: 'report', assessed_at: '2026-10-25T10:00:00Z', read_only: true,
  summary: { devices: 1, parents: 1, field_comparisons: { 'Difference found': 1, 'Missing local evidence': 2 }, full_local_snapshots: 0, partial_local_snapshots: 1, missing_local_snapshots: 0 },
  review_markers: { current_count: 0, note: 'Fresh review required.' }, limitations: ['Dated evidence only.'],
  records: [{ issuer: 'GS1', udi_di: '00000000000001', catalogue: 'DEMO-1', model: 'Demo', outcome: 'Update proposed', local_snapshot: 'Partial', warnings: [],
    fields: [{ group: 'Device', field: 'trade_name', comparison: 'Difference found', local: 'Old', exported: 'New', local_evidence: 'Accepted partial snapshot' }] }],
});

test('baseline comparison is read only and keeps workbook import disabled', async () => {
  const h = harness({ assessPlaygroundBaseline: async id => baselineAssessment(id) }); await h.settle();
  h.select('2026-10-25-001'); h.props.page = 'assessmentImport'; h.render();
  h.click('Assess Playground baseline'); await h.settle();
  assert.ok(h.text().includes('Difference found'));
  assert.ok(h.text().includes('Fresh review required.'));
  assert.equal(h.button('Download assessment Excel').props.disabled, false);
  assert.equal(h.button('Confirm database import').props.disabled, true);
});

test('delayed baseline assessment cannot attach to a different batch', async () => {
  let resolve;
  const h = harness({ assessPlaygroundBaseline: () => new Promise(done => { resolve = done; }) }); await h.settle();
  h.select('2026-10-25-001'); h.props.page = 'assessmentImport'; h.render(); h.click('Assess Playground baseline');
  h.select('2026-10-25-002'); resolve(baselineAssessment('2026-10-25-001')); await h.settle();
  assert.equal(h.button('Download assessment Excel'), undefined);
  assert.equal(h.button('Confirm database import').props.disabled, true);
});

test('value differences lead the assessment with before/after rows and distinct device counts', async () => {
  const result = baselineAssessment('2026-10-25-001');
  result.summary.field_comparisons['Missing local evidence'] = 6660;
  result.records[0].fields.push(
    { group: 'Device', field: 'base_quantity', comparison: 'Difference found', local: 2, exported: 1, local_evidence: 'Accepted partial snapshot' },
    { group: 'Device', field: 'sterile', comparison: 'Missing local evidence', local: null, exported: false, local_evidence: 'Not available' },
  );
  result.records[0].warnings = ['Legacy version needs review'];
  const h = harness({ assessPlaygroundBaseline: async () => result }); await h.settle();
  h.select(result.batch_id); h.props.page = 'assessmentImport'; h.render(); h.click('Assess Playground baseline'); await h.settle();
  const metrics = h.nodes().find(n => n.props?.['aria-label'] === 'Assessment review summary');
  assert.deepEqual(h.nodes(metrics).filter(n => n.type === 'strong').map(n => n.props.children), [2, 1, 1]);
  assert.ok(!JSON.stringify(metrics).includes('6660'));
  const table = h.nodes().find(n => n.type === 'table' && n.props['aria-label'] === 'Value differences');
  assert.equal(h.nodes(table).filter(n => n.type === 'tr').length, 3);
  assert.ok(JSON.stringify(table).includes('Old'));
  assert.ok(JSON.stringify(table).includes('New'));
  assert.ok(!JSON.stringify(table).includes('sterile'));
  const supporting = h.nodes().filter(n => n.type === 'details' && n.props.className === 'assessment-supporting-details');
  assert.equal(supporting.length, 2);
  assert.ok(supporting.every(n => !n.props.open));
  assert.ok(JSON.stringify(supporting[0]).includes('6660'));
  assert.ok(h.text().includes('Legacy version needs review'));
  assert.equal(h.button('Confirm database import').props.disabled, true);
});

test('no known differences does not imply complete evidence or baseline approval', async () => {
  const result = baselineAssessment('2026-10-25-001');
  result.records[0].fields = [{ group: 'Device', field: 'trade_name', comparison: 'Missing local evidence', local: null, exported: 'New', local_evidence: 'Not available' }];
  const h = harness({ assessPlaygroundBaseline: async () => result }); await h.settle();
  h.select(result.batch_id); h.props.page = 'assessmentImport'; h.render(); h.click('Assess Playground baseline'); await h.settle();
  assert.ok(h.text().includes('No value differences found in fields with usable local evidence.'));
  assert.ok(h.text().includes('Missing evidence and version or identity concerns may still need review.'));
  assert.equal(h.button('Confirm database import').props.disabled, true);
});
