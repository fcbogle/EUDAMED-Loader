const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function harness() {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/RegistrationStateWorkspace.tsx'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  const Filter = () => null;
  new Function('require', 'module', 'exports', output)(name => name === './RegistrationCountSummary' ? { RegistrationCountSummary: () => null } : name === './DeviceModelFilter'
    ? { DeviceModelFilter: Filter } : require(name), module, module.exports);
  const state = { family: 'Family A', variant: 'Model A', query: '' };
  function render() {
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      nodes.push(node); visit(node.props?.children);
    }
    visit(module.exports.RegistrationStateWorkspace({
      isLoading: false, error: null, selectedFamily: state.family, selectedVariant: state.variant,
      selectedStatus: '', searchText: state.query, actionableOnly: false,
      modelOptions: [], statusOptions: [], metrics: [], rows: [],
      onModelChange: (family, variant) => Object.assign(state, { family, variant }),
      onSearchChange: query => { state.query = query; },
      onStatusChange() {}, onActionableOnlyChange() {},
      onReset: () => Object.assign(state, { family: '', variant: '', query: '' }),
    }));
    return { filter: nodes.find(node => node.type === Filter), nodes };
  }
  return { state, render };
}

test('registration model search updates the result query and clears an older model scope', () => {
  const h = harness();
  h.render().filter.props.onSearchChange(' BASIC-B ');
  assert.deepEqual(h.state, { family: '', variant: '', query: ' BASIC-B ' });
  assert.equal(h.render().filter.props.searchQuery, ' BASIC-B ');
  assert.equal(h.render().nodes.filter(n => n.type === 'input' && n.props.type === 'search').length, 0);
});

test('choosing a model and clearing search preserves the chosen pair; Reset clears visible search', () => {
  const h = harness();
  h.render().filter.props.onSearchChange('BASIC-B');
  h.render().filter.props.onChange('Family B', 'Model B');
  h.render().filter.props.onSearchChange('');
  assert.deepEqual(h.state, { family: 'Family B', variant: 'Model B', query: '' });
  h.render().filter.props.onSearchChange('unknown');
  h.render().nodes.find(n => n.type === 'button' && n.props.children === 'Reset').props.onClick();
  assert.equal(h.render().filter.props.searchQuery, '');
  assert.deepEqual(h.state, { family: '', variant: '', query: '' });
});
