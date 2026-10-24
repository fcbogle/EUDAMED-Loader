const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness() {
  const state = []; let cursor = 0; let tree;
  const props = { page: 'sourceFiles', onPageChange(page) { props.page = page; } };
  const react = { useState(initial) {
    const i = cursor++;
    if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
  } };
  const source = fs.readFileSync(require.resolve('../src/components/ImportManagementWorkspace.tsx'), 'utf8');
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
  function render() { cursor = 0; tree = module.exports.ImportManagementWorkspace(props); }
  function button(label) { return nodes().find(n => n.type === 'button' && n.props.children === label); }
  function click(label) { const b = button(label); assert.ok(b); assert.ok(!b.props.disabled); b.props.onClick(); render(); }
  function select(id, files) { nodes().find(n => n.props?.id === id).props.onChange({ target: { files } }); render(); }
  render();
  return { props, render, nodes, button, click, select, content: () => JSON.stringify(nodes().map(n => n.props?.children)) };
}

test('source selection distinguishes local files from upload and persists between the two pages', () => {
  const h = harness();
  const inputs = h.nodes().filter(n => n.type === 'input' && n.props.type === 'file');
  assert.equal(inputs.length, 3);
  assert.deepEqual(inputs.map(n => n.props.multiple), [true, false, true]);
  h.select('import-templates', [{ name: 'Synthetic-template.xlsx', size: 2048 }]);
  h.select('import-basicUdi', [{ name: 'Synthetic-parents.xlsx', size: 1024 }]);
  h.select('import-xml', [{ name: 'Synthetic-page-1.xml', size: 1024 }, { name: 'Synthetic-page-2.xml', size: 1024 }]);
  assert.ok(h.content().includes('Synthetic-page-2.xml'));
  assert.ok(h.content().includes('Selected locally · Not uploaded'));
  assert.equal(h.button('Upload files').props.disabled, true);
  assert.equal(h.button('Check source data'), undefined);
  h.click('Continue to Create Import Workbook');
  assert.equal(h.props.page, 'createImportWorkbook');
  assert.equal(h.nodes().filter(n => n.type === 'input' && n.props.type === 'file').length, 0);
  assert.equal(h.button('Check source data').props.disabled, true);
  h.click('Continue to Assess & Import Workbook');
  assert.equal(h.props.page, 'assessmentImport');
  h.click('Back to Create Import Workbook');
  h.click('Back to Import Source Files');
  assert.ok(h.content().includes('Synthetic-template.xlsx'));
  assert.ok(h.content().includes('Synthetic-page-2.xml'));
});

test('unsupported extensions show local selection errors, without claiming data validation', () => {
  const h = harness();
  h.select('import-xml', [{ name: 'Synthetic.txt', size: 16 }]);
  assert.equal(h.nodes().find(n => n.props?.id === 'import-xml').props['aria-invalid'], true);
  assert.ok(h.content().includes('Unsupported file type'));
  h.click('Continue to Create Import Workbook');
  assert.equal(h.button('Create Import Workbook').props.disabled, true);
});

test('synthetic assessment and acknowledgement cannot enable database import', () => {
  const h = harness();
  h.click('Continue to Create Import Workbook');
  h.click('Continue to Assess & Import Workbook');
  assert.ok(h.nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.disabled);
  h.click('View example assessment');
  assert.ok(h.content().includes('Synthetic example'));
  assert.ok(h.content().includes('DEMO-021'));
  h.nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  h.render();
  assert.equal(h.button('Confirm database import').props.disabled, true);
  assert.equal(h.button('Download assessment report').props.disabled, true);
  h.click('Hide example results');
  const checkbox = h.nodes().find(n => n.type === 'input' && n.props.type === 'checkbox');
  assert.equal(checkbox.props.checked, false);
  assert.equal(checkbox.props.disabled, true);
});
