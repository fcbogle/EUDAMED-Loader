const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const app = fs.readFileSync(require.resolve('../src/App.tsx'), 'utf8');
const parsed = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expression(name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name) found = node.initializer.getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(found, `Missing application expression ${name}`);
  return found;
}
const helpers = { exports: {} };
new Function('module', 'exports', ts.transpileModule(
  fs.readFileSync(require.resolve('../src/xmlActionInputs.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText)(helpers, helpers.exports);

for (const flow of ['UdidiPost', 'Patch', 'MarketInfo']) {
  test(`${flow}: Next 300 bounds actual selection and reaches the generated request`, () => {
    const mode = `bulk${flow}ScopeMode`;
    const available = flow === 'UdidiPost' ? 'bulkUdidiPostCatalogueNumbers' : `bulk${flow}PostedCatalogueNumbers`;
    const select = new Function(mode, available, `return (${expression(`effectiveBulk${flow}CatalogueNumbers`)});`);
    for (const count of [0, 17, 300, 301, 650]) {
      const eligible = Array.from({ length: count }, (_, i) => `SYNTHETIC-${i}`);
      const selected = select('next_300', eligible);
      assert.deepEqual(selected, eligible.slice(0, 300));
      assert.equal(eligible.length, count);
      if (flow !== 'UdidiPost') {
        const args = {
          hasParent: true, scopeMode: 'next_300', postedCatalogueNumbers: eligible,
          effectiveCatalogueNumbers: selected, selectedCatalogueNumbers: ['DO-NOT-USE-MANUAL'],
          importedMatchedCatalogueNumbers: ['DO-NOT-USE-IMPORTED'],
        };
        assert.deepEqual(helpers.exports.resolveBulkCatalogueNumbers(args), selected);
        assert.deepEqual(helpers.exports.resolveBulkCatalogueNumbers({ ...args, hasParent: false }), []);
      }
    }
    const eligible = Array.from({ length: 350 }, (_, i) => `SYNTHETIC-${i}`);
    assert.deepEqual(select('next_10', eligible), eligible.slice(0, 10));
    assert.deepEqual(select('next_25', eligible), eligible.slice(0, 25));
    assert.deepEqual(select('all_posted', eligible), eligible);
  });
}
