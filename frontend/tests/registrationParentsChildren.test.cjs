const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function nodes(tree) {
  const result = [];
  function visit(n) {
    if (Array.isArray(n)) return n.forEach(visit);
    if (!n || typeof n !== 'object') return;
    result.push(n); visit(n.props?.children);
  }
  visit(tree); return result;
}
const summary = {import_batch_id: 1, groups: [{key: 'group', parent_key: 'GS1:B1',
  basic_udi_di: 'B1', parent_issuing_entity: 'GS1', product_family: 'A', product_variant: 'Model',
  parent_registered: true, parent_post_ready: false, total_devices: 107, registered_devices: 1,
  awaiting_devices: 106, unknown_devices: 0, child_post_ready: 106, awaiting_blocked: 0,
  patch_ready: 1, market_info_ready: 1}]};
function harness(response, viewSummary = summary, onReviewPatch) {
  let current;
  const calls = [];
  function load(file, requireFn = require) {
    const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'),
      {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
    const module = {exports: {}};
    new Function('require', 'module', 'exports', output)(requireFn, module, module.exports);
    return module.exports;
  }
  const helpers = load('../src/registrationParents.ts');
  const components = load('../src/components/RegistrationParentsChildren.tsx', name => {
    if (name === '../registrationParents') return helpers;
    if (name === '../api') return {api: {registrationChildren: params => {calls.push(params); return response(params);}}};
    if (name === 'react') return {Fragment: require('react').Fragment,
      useState: initial => {const store = current; const index = store.cursor++;
        if (!(index in store.values)) store.values[index] = typeof initial === 'function' ? initial() : initial;
        return [store.values[index], value => {store.values[index] = typeof value === 'function' ? value(store.values[index]) : value;}];},
      useEffect: fn => {current.effect = fn;}};
    return require(name);
  });
  function instance(component, props) {
    const store = {values: [], cursor: 0};
    return {render() {current = store; store.cursor = 0; return nodes(component(props));},
      effect() {return store.effect();}};
  }
  const parent = instance(components.RegistrationParentsChildren, {summary: viewSummary, onReviewPatch});
  return {calls, parent, open() {
    parent.render().find(n => n.props?.className === 'registration-parent-toggle').props.onClick();
    const node = parent.render().find(n => typeof n.type === 'function');
    return instance(node.type, node.props);
  }};
}
const tick = () => new Promise(setImmediate);
function page(offset = 0) {
  return {total: 107, offset, limit: 20, children: Array.from({length: Math.min(20, 107 - offset)}, (_, i) => ({
    key: `D${offset + i + 1}`, product_family: 'A', product_variant: 'Model',
    catalogue_number: `CAT-D${offset + i + 1}`, issuing_entity: 'GS1', primary_udi_di: `D${offset + i + 1}`,
    registration_status: 'Unknown', child_post_ready: true, post_ready: true}))};
}
test('child requests are lazy and include the parent issuer, current groups, import and page', async () => {
  const h = harness(params => Promise.resolve(page(params.offset)));
  h.parent.render(); assert.equal(h.calls.length, 0);
  const child = h.open(); child.render(); let cleanup = child.effect(); await tick();
  assert.deepEqual(h.calls, [{basic_udi_di: 'B1', issuing_entity: 'GS1', group_keys: ['group'], import_batch_id: 1, offset: 0, limit: 20}]);
  const rendered = child.render();
  assert.match(JSON.stringify(rendered), /Confirm registration status before POST/);
  assert.equal(rendered.find(n => n.type === 'button' && n.props.children === 'Previous').props.disabled, true);
  assert.match(JSON.stringify(rendered), /1–20 of 107/);
  for (let offset = 20; offset <= 100; offset += 20) {
    child.render().find(n => n.type === 'button' && n.props.children === 'Next').props.onClick();
    cleanup(); child.render(); cleanup = child.effect(); await tick();
    assert.equal(h.calls.at(-1).offset, offset);
    assert.equal(h.calls.at(-1).limit, 20);
  }
  assert.match(JSON.stringify(child.render()), /101–107 of 107/);
  assert.equal(child.render().find(n => n.type === 'button' && n.props.children === 'Next').props.disabled, true);
  child.render().find(n => n.type === 'button' && n.props.children === 'Previous').props.onClick();
  cleanup(); child.render(); cleanup = child.effect(); await tick();
  assert.equal(h.calls.at(-1).offset, 80);
  cleanup();
});
test('closing a parent discards its pending child response', async () => {
  let resolve;
  const h = harness(() => new Promise(done => {resolve = done;}));
  const child = h.open(); child.render(); const cleanup = child.effect();
  cleanup(); resolve(page()); await tick();
  assert.match(JSON.stringify(child.render()), /Loading children/);
});
test('child request errors remain visible and can be retried', async () => {
  let fail = true;
  const h = harness(() => fail ? Promise.reject(new Error('Snapshot changed; refresh counts')) : Promise.resolve(page()));
  const child = h.open(); child.render(); let cleanup = child.effect(); await tick();
  const rendered = child.render(); assert.match(JSON.stringify(rendered), /Snapshot changed/);
  fail = false; rendered.find(n => n.type === 'button').props.onClick();
  cleanup(); child.render(); cleanup = child.effect(); await tick();
  assert.match(JSON.stringify(child.render()), /CAT-D1/); cleanup();
});


test('workbook parents and children show Unregistered without extract evidence', async () => {
  const current = {...summary, registration_coverage: {covers_parent_only: false},
    groups: [{...summary.groups[0], parent_registered: false}]};
  const h = harness(() => Promise.resolve({...page(), children: [{...page().children[0], registration_status: 'Unregistered'}]}), current);
  const parents = h.parent.render();
  assert.ok(parents.some(n => n.type === 'span' && Array.isArray(n.props.children) && n.props.children.join('') === 'Parent unregistered'));
  assert.match(JSON.stringify(parents), /Unregistered means present in the imported Template or BasicUDI workbook/);
  const child = h.open(); child.render(); child.effect(); await tick();
  const rendered = child.render();
  assert.ok(rendered.some(n => n.type === 'span' && n.props.children === 'Unregistered'));
  assert.doesNotMatch(JSON.stringify(rendered), /Confirm registration status before POST/);
});


test('PATCH review carries the exact family, variant, issuer and parent without opening a different group', () => {
  let selected;
  const h = harness(() => Promise.resolve(page()), summary, scope => {selected = scope;});
  const rendered = h.parent.render();
  const button = rendered.find(n => n.type === 'button' && n.props.children[0] === 'Review PATCH devices');
  assert.ok(button); assert.equal(button.props.disabled, false);
  button.props.onClick();
  assert.equal(selected.productFamily, 'A');
  assert.equal(selected.productVariant, 'Model');
  assert.equal(selected.issuer, 'GS1');
  assert.equal(selected.basicUdiDi, 'B1');
  assert.match(JSON.stringify(rendered), /PATCH-ready/);
  assert.match(JSON.stringify(rendered), /Family:/);
});
