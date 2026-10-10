const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/productionVariantMappings.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', output)(loaded, loaded.exports);
const { matchingProductionMappingVariants } = loaded.exports;
const variants = [
  { source_workbook: 'production-import.xlsx', source_sheet: 'To Register', product_family: 'Elan', product_variant: 'Elan MAX' },
  { source_workbook: 'production-import.xlsx', source_sheet: 'To Register', product_family: 'Elan', product_variant: 'Elan' },
  { source_workbook: 'production-import.xlsx', source_sheet: 'Registered', product_family: 'Elan', product_variant: 'Elan MAX' },
  { source_workbook: 'production-import.xlsx', source_sheet: 'To Register', product_family: 'Other', product_variant: 'Other model' },
];
const mapping = { workbook: 'production-import.xlsx', sheet: 'To Register', device_model: 'Elan MAX' };

test('Production family scope uses imported family rather than the shared workbook name', () => {
  assert.deepEqual(matchingProductionMappingVariants(mapping, variants, 'Elan', ''), [variants[0]]);
  assert.deepEqual(matchingProductionMappingVariants(mapping, variants, 'Other', ''), []);
});
test('Production variant scope separates models sharing a prepared workbook and tab', () => {
  assert.deepEqual(matchingProductionMappingVariants(mapping, variants, 'Elan', 'Elan MAX'), [variants[0]]);
  assert.deepEqual(matchingProductionMappingVariants(mapping, variants, 'Elan', 'Elan'), []);
});
test('Production mappings retain workbook and tab identity even without a selected scope', () => {
  assert.deepEqual(matchingProductionMappingVariants(mapping, variants, '', ''), [variants[0]]);
  assert.deepEqual(matchingProductionMappingVariants({ ...mapping, sheet: 'Registered' }, variants, '', ''), [variants[2]]);
  assert.deepEqual(matchingProductionMappingVariants({ ...mapping, workbook: 'other.xlsx' }, variants, '', ''), []);
});
