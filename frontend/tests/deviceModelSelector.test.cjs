const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function harness(options, selectedFamily = 'Family A', selectedVariant = 'Model 0') {
  const state = ['', '']; let cursor = 0; const calls = [];
  const source = fs.readFileSync(path.join(__dirname, '../src/components/DeviceModelSelector.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => name === 'react' ? {
    useState: () => { const i = cursor++; return [state[i], value => { state[i] = value; }]; }, useId: () => 'scope',
  } : require(name), module, module.exports);
  function render() {
    cursor = 0; const elements = [];
    function visit(n) {
      if (Array.isArray(n)) return n.forEach(visit);
      if (!n || typeof n !== 'object') return;
      elements.push(n); visit(n.props?.children);
    }
    visit(module.exports.DeviceModelSelector({ options, selectedFamily, selectedVariant,
      onSelect: (family, variant) => calls.push([family, variant]) }));
    return elements;
  }
  return { render, calls };
}
const options = Array.from({ length: 100 }, (_, i) => ({ family: i < 50 ? 'Family A' : 'Family B', variant: `Model ${i}`, basicUdiDis: [`BASIC-${i}`], total: 10, ready: 9, blocked: 1 }));
test('all families are available and Basic UDI search does not change selected scope', () => {
  const h = harness(options);
  assert.equal(h.render().filter(n => n.props['aria-pressed'] !== undefined).length, 100);
  h.render().find(n => n.type === 'input').props.onChange({ target: { value: ' basic-99 ' } });
  const nodes = h.render(); const choices = nodes.filter(n => n.props['aria-pressed'] !== undefined);
  assert.equal(choices.length, 1); assert.equal(choices[0].props['aria-pressed'], false);
  assert.deepEqual(h.calls, []);
  assert.ok(nodes.some(n => n.props.className === 'xml-scope-selected' && n.props.children.some(c => typeof c === 'string' && c.includes('Model 0'))));
  choices[0].props.onClick({ stopPropagation() {} }); assert.deepEqual(h.calls, [['Family B', 'Model 99']]);
});
test('optional family filter and clearing filters never change the selected model', () => {
  const h = harness(options);
  h.render().find(n => n.type === 'select').props.onChange({ target: { value: 'Family B' } });
  assert.equal(h.render().filter(n => n.props['aria-pressed'] !== undefined).length, 50);
  h.render().find(n => n.type === 'input').props.onChange({ target: { value: 'unknown' } });
  assert.equal(h.render().filter(n => n.props['aria-pressed'] !== undefined).length, 0);
  h.render().find(n => n.props.children === 'Clear filters').props.onClick();
  assert.equal(h.render().filter(n => n.props['aria-pressed'] !== undefined).length, 100);
  assert.deepEqual(h.calls, []);
});
test('same model name in different families selects the exact family/variant pair', () => {
  const h = harness([options[0], { ...options[0], family: 'Family B' }]);
  const buttons = h.render().filter(n => n.props['aria-pressed'] !== undefined);
  assert.deepEqual(buttons.map(n => n.props['aria-pressed']), [true, false]);
  buttons[1].props.onClick({ stopPropagation() {} });
  assert.deepEqual(h.calls, [['Family B', 'Model 0']]);
});
test('empty inventory explains the absence of models', () => {
  assert.ok(harness([]).render().some(n => n.props.children === 'No models are available in the imported data.'));
});
