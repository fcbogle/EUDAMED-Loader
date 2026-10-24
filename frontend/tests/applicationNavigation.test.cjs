const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness(labels = ['EUDAMED Testing', 'Testing Summary']) {
  const state = []; let cursor = 0; let tree;
  const props = { activePage: 'workbooks', xmlWorkspaceLabel: labels[0], summaryWorkspaceLabel: labels[1],
    onSelect(page) { props.activePage = page; } };
  const react = { useState(initial) {
    const i = cursor++;
    if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
  } };
  const source = fs.readFileSync(require.resolve('../src/components/ApplicationNavigation.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => name === 'react' ? react : require(name), module, module.exports);
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(n => nodes(n));
    return [node, ...nodes(node.props?.children)];
  }
  function render() { cursor = 0; tree = module.exports.ApplicationNavigation(props); }
  function click(label) {
    const button = nodes().find(n => n.type === 'button' && n.props.children === label);
    assert.ok(button, `Visible button: ${label}`);
    button.props.onClick(); render();
  }
  render();
  return { props, nodes, click,
    pages: () => nodes().filter(n => n.type === 'button' && n.props.className.startsWith('navigation-page')).map(n => n.props.children),
  };
}

test('navigation displays only the selected area pages and marks both navigation levels', () => {
  const h = harness();
  assert.deepEqual(h.pages(), ['Submission Data', 'Canonical Validation', 'Registration State']);
  h.click('Import Management');
  assert.deepEqual(h.pages(), ['Source Files', 'Assessment & Import', 'Import History']);
  assert.equal(h.props.activePage, 'sourceFiles');
  assert.equal(h.nodes().find(n => n.props?.['aria-pressed'] === true).props.children, 'Import Management');
  assert.equal(h.nodes().find(n => n.props?.['aria-current'] === 'page').props.children, 'Source Files');
  h.click('Reporting');
  assert.deepEqual(h.pages(), ['Registration Snapshot', 'EUDAMED Comparison']);
  h.click('Help');
  assert.deepEqual(h.pages(), ['Documentation']);
});

test('switching areas restores each previous page, including after clicking the active area', () => {
  const h = harness();
  h.click('Registration State');
  h.click('EUDAMED'); h.click('Testing Summary');
  h.click('Import Management'); h.click('Import History');
  h.click('Reporting'); h.click('EUDAMED Comparison');
  h.click('Data Views'); assert.equal(h.props.activePage, 'registrationState');
  h.click('EUDAMED'); assert.equal(h.props.activePage, 'testingSummary');
  h.click('EUDAMED'); assert.equal(h.props.activePage, 'testingSummary');
  h.click('Import Management'); assert.equal(h.props.activePage, 'importHistory');
  h.click('Reporting'); assert.equal(h.props.activePage, 'eudamedComparison');
});

for (const labels of [
  ['EUDAMED Testing', 'Testing Summary'],
  ['EUDAMED Submission', 'Submission Summary'],
  ['EUDAMED Workspace', 'EUDAMED Summary'],
]) {
  test(`EUDAMED area remains stable with ${labels[0]} pages`, () => {
    const h = harness(labels);
    h.click('EUDAMED');
    assert.deepEqual(h.pages(), labels);
    h.click(labels[1]);
    assert.equal(h.props.activePage, 'testingSummary');
  });
}
