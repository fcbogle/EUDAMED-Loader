const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness() {
  const state = []; let cursor = 0; let tree;
  const props = { page: 'registrationSnapshot', environment: 'dev', onPageChange(page) { props.page = page; } };
  const react = { useState(initial) {
    const i = cursor++;
    if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
  } };
  const source = fs.readFileSync(require.resolve('../src/components/ReportingWorkspace.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => name === 'react' ? react : require(name), module, module.exports);
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(n => nodes(n ?? null));
    if (typeof node.type === 'function') return nodes(node.type(node.props));
    return [node, ...nodes(node.props?.children ?? null)];
  }
  function render() { cursor = 0; tree = module.exports.ReportingWorkspace(props); }
  function button(label) { return nodes().find(n => n.type === 'button' && n.props.children === label); }
  function click(label) { const b = button(label); assert.ok(b); assert.ok(!b.props.disabled); b.props.onClick(); render(); }
  function change(id, value) { nodes().find(n => n.props?.id === id).props.onChange({ target: { value } }); render(); }
  render();
  return { props, render, nodes, button, click, change, text: () => JSON.stringify(nodes().map(n => n.props?.children)) };
}

test('snapshot filters retain unknown registration and independent parent status', () => {
  const h = harness();
  assert.ok(!h.text().includes('DEMO-001'));
  h.click('View example snapshot');
  assert.ok(h.text().includes('Synthetic example'));
  h.change('snapshot-model', 'Example Model A');
  h.change('snapshot-status', 'Unknown');
  assert.ok(h.text().includes('DEMO-003'));
  assert.ok(!h.text().includes('DEMO-002'));
  h.change('snapshot-status', 'Unregistered');
  const badges = h.nodes().filter(n => n.type === 'span' && n.props.className?.startsWith('status-pill compact reporting-status-'));
  assert.ok(badges.filter(n => n.props.children === 'Registered').length >= 2); // Legend and DEMO-002's parent.
  assert.ok(h.text().includes('DEMO-002'));
  assert.ok(!h.text().includes('DEMO-005'));
  assert.equal(h.button('Create Excel Snapshot').props.disabled, true);
  h.click('Go to EUDAMED Comparison'); h.click('Go to Registration Snapshot');
  assert.equal(h.nodes().find(n => n.props?.id === 'snapshot-status').props.value, 'Unregistered');
});

test('comparison distinguishes missing export coverage from a proven difference', () => {
  const h = harness();
  h.click('Go to EUDAMED Comparison');
  h.click('View example comparison');
  h.change('comparison-outcome', 'Unable to compare');
  assert.ok(h.text().includes('DEMO-003'));
  assert.ok(!h.text().includes('DEMO-006'));
  assert.ok(h.text().includes('export coverage is unconfirmed'));
  h.change('comparison-outcome', 'Difference found');
  assert.ok(h.text().includes('DEMO-006'));
  assert.ok(!h.text().includes('DEMO-003'));
  assert.ok(h.text().includes('snapshot 3; XML extract 4'));
});

test('local XML and synthetic snapshot selection never enable processing or download', () => {
  const h = harness(); h.click('Go to EUDAMED Comparison');
  h.change('comparison-snapshot', 'synthetic');
  let input = h.nodes().find(n => n.props?.id === 'comparison-xml');
  input.props.onChange({ target: { files: [{ name: 'Synthetic.txt', size: 100 }] } }); h.render();
  assert.ok(h.nodes().find(n => n.props?.id === 'comparison-xml').props['aria-invalid']);
  input = h.nodes().find(n => n.props?.id === 'comparison-xml');
  input.props.onChange({ target: { files: [{ name: 'Synthetic.xml', size: 100 }] } }); h.render();
  assert.ok(h.text().includes('selected locally · Not uploaded'));
  h.click('View example comparison');
  assert.ok(h.text().includes('independent of the selected snapshot'));
  assert.equal(h.button('Upload and compare').props.disabled, true);
  assert.equal(h.button('Download comparison report').props.disabled, true);
});
