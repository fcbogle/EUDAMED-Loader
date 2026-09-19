const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const options = [
  { family: 'Family A', variant: 'Model One', basicUdiDis: ['BASIC-A'] },
  { family: 'Family B', variant: 'Model One', basicUdiDis: ['BASIC-B'] },
];
function harness(family = '', variant = '', onSearchChange) {
  let query = ''; const calls = [];
  const source = fs.readFileSync(path.join(__dirname, '../src/components/DeviceModelFilter.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => name === 'react' ? {
    useId: () => 'filter', useState: () => [query, value => { query = value; }],
  } : require(name), module, module.exports);
  function render() {
    const nodes = [];
    function visit(n) {
      if (Array.isArray(n)) return n.forEach(visit);
      if (!n || typeof n !== 'object') return;
      nodes.push(n); visit(n.props?.children);
    }
    visit(module.exports.DeviceModelFilter({ options, family, variant, onSearchChange, onChange: (...args) => calls.push(args) }));
    return nodes;
  }
  return { render, calls, merge: module.exports.mergeModelOptions };
}
test('selects an exact model pair across families without a family selection first', () => {
  const h = harness();
  assert.equal(h.render().filter(n => n.type === 'option').length, 3);
  h.render().find(n => n.type === 'select').props.onChange({ target: { value: JSON.stringify(['Family B', 'Model One']) } });
  assert.deepEqual(h.calls, [['Family B', 'Model One']]);
});
test('searches Basic UDI-DI case-insensitively without changing current scope', () => {
  const h = harness('Family A', 'Model One');
  h.render().find(n => n.type === 'input').props.onChange({ target: { value: ' basic-b ' } });
  const nodes = h.render();
  assert.equal(nodes.find(n => n.type === 'select').props.value, JSON.stringify(['Family A', 'Model One']));
  assert.equal(nodes.filter(n => n.type === 'option').length, 3); // All, retained selection, match
  assert.deepEqual(h.calls, []);
  nodes.find(n => n.type === 'button').props.onClick();
  assert.equal(h.render().find(n => n.type === 'input').props.value, '');
  assert.deepEqual(h.calls, []);
});
test('All models clears both scope fields', () => {
  const h = harness('Family A', 'Model One');
  h.render().find(n => n.type === 'select').props.onChange({ target: { value: '' } });
  assert.deepEqual(h.calls, [['', '']]);
});
test('no search matches retains the current scope and offers All models', () => {
  const h = harness('Family A', 'Model One');
  h.render().find(n => n.type === 'input').props.onChange({ target: { value: 'missing' } });
  assert.equal(h.render().filter(n => n.type === 'option').length, 2);
  assert.deepEqual(h.calls, []);
});
test('combines duplicate model metadata without merging names across families', () => {
  const h = harness();
  assert.deepEqual(h.merge([...options, { ...options[0], basicUdiDis: ['BASIC-A', 'BASIC-C'] }]), [
    { ...options[0], basicUdiDis: ['BASIC-A', 'BASIC-C'] }, options[1],
  ]);
});

test('live search reports typing, clearing and model selection to the workspace', () => {
  const searches = [];
  const h = harness('', '', query => searches.push(query));
  h.render().find(n => n.type === 'input').props.onChange({ target: { value: 'BASIC-B' } });
  assert.deepEqual(searches, ['BASIC-B']);
  h.render().find(n => n.type === 'select').props.onChange({ target: { value: JSON.stringify(['Family B', 'Model One']) } });
  assert.deepEqual(h.calls, [['Family B', 'Model One']]);
  assert.deepEqual(searches, ['BASIC-B', '']);
  h.render().find(n => n.type === 'input').props.onChange({ target: { value: 'unknown' } });
  h.render().find(n => n.type === 'button').props.onClick();
  assert.deepEqual(searches, ['BASIC-B', '', 'unknown', '']);
});

test('canonical search filters parent identifiers, supports partial matches and excludes unknown identifiers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modelSearch.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', output)(module, module.exports);
  const match = module.exports.matchesModelSearch;
  const filter = query => options.filter(o => match(query, o.family, o.variant, ...o.basicUdiDis));
  assert.deepEqual(filter(' basic-b '), [options[1]]);
  assert.deepEqual(filter('BASIC-'), options);
  assert.deepEqual(filter('unrecognised'), []);
  assert.deepEqual(filter(''), options);
  assert.equal(match('BASIC-B', null, undefined), false);
});
