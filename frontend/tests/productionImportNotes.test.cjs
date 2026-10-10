const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const output=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/productionImportNotes.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const loaded={exports:{}};
new Function('module','exports',output)(loaded,loaded.exports);
const { productionImportNotes }=loaded.exports;
test('Repeated removal notices and optional URL cohorts retain counts in brief notes',()=>{
  const entries=[
    ...Array.from({length:3},()=>({Category:'Removed from current templates',Scope:'Footspares','Affected Rows':1})),
    ...Array.from({length:26},()=>({Category:'Removed from current templates',Scope:'Adaptors_Socket_Accessories','Affected Rows':1})),
    ...[820,107,13].map(count=>({Category:'Included with optional URL omitted','Affected Rows':count})),
    {Category:'Counts',Details:'Repeated counts'}, {Category:'Device exception',Details:'Already under skipped devices'},
    {Category:'Recorded encoding override',Details:'Audit metadata'}, {Category:'Later verification',Details:'Preparation metadata'},
    {Category:'Approved setting',Scope:'Elan MAX',Details:'Markets: Germany. First placement: Germany.'},
  ];
  const original=JSON.stringify(entries);const notes=productionImportNotes(entries);
  assert.equal(notes.length,3);assert.match(notes.join('\n'),/940 rows/);
  assert.match(notes.join('\n'),/29 identities.*Footspares: 3.*Adaptors Socket Accessories: 26/);
  assert.match(notes.join('\n'),/Elan MAX: Markets: Germany/);
  assert.equal(JSON.stringify(entries),original);
});
test('Unrecognized future note categories stay visible',()=>{
  assert.deepEqual(productionImportNotes([{Category:'New exception',Scope:'Example',Details:'Needs review'}]),['New exception: Example — Needs review']);
});

test('Owner exclusions remain visible as a brief count',()=>{
  assert.deepEqual(productionImportNotes([{Category:'Owner-approved exclusion','Affected Rows':3,Details:'Full parent identity list'}]),['3 device rows intentionally excluded from import.']);
});
