const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise rendered controls with synthetic devices, using the project's hook harness pattern.
function harness() {
  const slots = []; let cursor = 0; let tree; const effects = [];
  const calls = []; let focusCount = 0;
  const props = { label: 'Synthetic model', entries: Array.from({ length: 15 }, (_, i) => ({ catalogue_number: `CAT${i}`, primary_udi_di: `UDI${i}` })), selected: ['CAT0'], onApply: values => { calls.push(values); props.selected = values; } };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef() { const i = cursor++; return slots[i] ||= { current: { showModal() {}, close() {}, focus() { focusCount++; } } }; },
    useId() { cursor++; return 'selection-title'; },
    useEffect(fn, deps) { const i = cursor++; const old = slots[i]; if (!old || deps.some((v, n) => v !== old.deps[n])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const source = fs.readFileSync(require.resolve('../src/components/CatalogueSelection.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} }; const document = { body: { style: { overflow: '' } } };
  new Function('require', 'module', 'exports', 'document', output)(name => name === 'react' ? react : require(name), module, module.exports, document);
  function nodes(node = tree) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(value => nodes(value ?? null)); return [node, ...nodes(node.props?.children ?? null)]; }
  function render() { cursor = 0; tree = module.exports.CatalogueSelection(props); while (effects.length) effects.shift()(); }
  function button(text) { return nodes().find(n => n.type === 'button' && n.props.children === text); }
  function click(text) { button(text).props.onClick(); render(); }
  function rows() { return nodes().filter(n => n.props?.className === 'catalogue-dialog-row'); }
  function toggle(index) { nodes(rows()[index]).find(n => n.type === 'input').props.onChange(); render(); }
  render();
  return { props, calls, document, render, nodes, click, rows, toggle, focusCount: () => focusCount,
    search(value) { nodes().find(n => n.type === 'input' && n.props.type === 'search').props.onChange({ target: { value } }); render(); },
    selectedOnly() { nodes().find(n => n.props?.className === 'catalogue-selected-only').props.children[0].props.onChange({ target: { checked: true } }); render(); },
    escape() { nodes().find(n => n.type === 'dialog').props.onCancel({ preventDefault() {} }); render(); },
  };
}

test('shows more than ten devices immediately; search preserves hidden selections until Apply', () => {
  const h = harness(); h.click('Edit selection'); assert.equal(h.rows().length, 15);
  h.search('udi14'); assert.equal(h.rows().length, 1); h.toggle(0);
  assert.deepEqual(h.calls, []); h.search(''); h.selectedOnly(); assert.equal(h.rows().length, 2);
  h.click('Apply selection'); assert.deepEqual(h.calls, [['CAT0', 'CAT14']]);
  assert.equal(h.nodes().some(n => n.type === 'dialog'), false);
  assert.equal(h.document.body.style.overflow, ''); assert.ok(h.focusCount() > 0);
});
test('Cancel and Escape discard changes, reopening retains committed choices', () => {
  const h = harness(); h.click('Edit selection'); h.click('Clear selection'); h.click('Cancel');
  h.click('Edit selection'); h.selectedOnly(); assert.equal(h.rows().length, 1);
  h.toggle(0); h.escape(); assert.deepEqual(h.calls, []);
  h.click('Edit selection'); h.selectedOnly(); assert.equal(h.rows().length, 1);
});
test('Clear selection can be applied and then edited again', () => {
  const h = harness(); h.click('Edit selection'); h.click('Clear selection'); h.click('Apply selection');
  assert.deepEqual(h.calls, [[]]); h.click('Select devices'); h.selectedOnly(); assert.equal(h.rows().length, 0);
});
test('devices removed during selection cannot be submitted', () => {
  const h = harness(); h.click('Edit selection'); h.toggle(1);
  h.props.entries = h.props.entries.filter(e => e.catalogue_number !== 'CAT1'); h.render();
  h.click('Apply selection'); assert.deepEqual(h.calls, [['CAT0']]);
});
