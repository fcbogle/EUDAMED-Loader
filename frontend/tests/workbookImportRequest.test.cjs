const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function setup() {
  const calls=[];
  const api={assessProductionImport:async()=>{calls.push(['assess']);return {assessment_token:'verified'};},runWorkbookImport:async body=>{calls.push(['commit',body]);return {created_count:2};}};
  const source=fs.readFileSync(path.join(__dirname,'../src/workbookImportRequest.ts'),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',output)(()=>({api}),module,module.exports);
  return {...module.exports,calls};
}
test('Production first click assesses without committing; confirmation sends the assessed token',async()=>{
  const h=setup();const assessment=await h.requestWorkbookImport('prod');
  assert.equal(assessment.kind,'assessment');assert.deepEqual(h.calls,[['assess']]);
  const imported=await h.requestWorkbookImport('prod',assessment.result.assessment_token);
  assert.equal(imported.kind,'import');assert.equal(h.calls[1][1].assessment_token,'verified');
  assert.equal(h.calls[1][1].imported_by,'ui');
});
test('Dev keeps direct import and does not send a Production assessment token',async()=>{
  const h=setup();await h.requestWorkbookImport('dev','obsolete-token');
  assert.equal(h.calls.length,1);assert.equal(h.calls[0][0],'commit');
  assert.ok(!('assessment_token' in h.calls[0][1]));
});
test('Unconfirmed backend cannot assess or commit',async()=>{
  const h=setup();await assert.rejects(h.requestWorkbookImport(null),/Confirm the backend/);
  assert.deepEqual(h.calls,[]);
});
