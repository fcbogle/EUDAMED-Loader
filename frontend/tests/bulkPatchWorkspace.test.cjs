const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/components/BulkPatchWorkspace.tsx'), 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const loaded = {exports:{}};
new Function('require','module','exports',output)(name => name.startsWith('./') ? {} : require(name),loaded,loaded.exports);
function render(extra={}) {
 const nodes=[];
 function visit(n) {if(Array.isArray(n)) return n.forEach(visit);if(!n || typeof n!=='object') return;nodes.push(n);visit(n.props?.children);}
 const entry={catalogue_number:'LINX22',primary_udi_di:'D1',latest_version:'9',current_state:{version:'4',trade_name:'Linx',base_quantity:1}};
 visit(loaded.exports.BulkPatchWorkspace({familyVariantLabel:'Linx',displayedBulkPatchParentOptions:[],selectedBulkPatchParentGroup:{basic_udi_di:'B1'},bulkPatchScopeMode:'selected_catalogue_numbers',bulkPatchPostedEntries:[entry],selectedEntries:[entry],selectedBulkPatchSelectedCount:1,selectedPatchScenarioId:'base_quantity_edit',patchScenarioOptions:[{id:'base_quantity_edit',label:'Base quantity'}],bulkPatchBaselineSummary:[],criticalWarningCodeOptions:[],patchBaseQuantityInput:'2',selectedPatchScenarioSummary:'Change base quantity',...extra}));
 return {nodes,text:JSON.stringify(nodes)};
}
test('device review identifies each UDI and uses its accepted snapshot version',()=>{
 const {text,nodes}=render();
 assert.match(text,/LINX22/);assert.match(text,/D1/);assert.match(text,/Selected · preview required/);
 assert.ok(nodes.some(n=>n.type==='td' && n.props.children==='4'));
 assert.match(text,/Change base quantity/);
});
test('preview shows exact included versions and exclusions without treating every candidate as selected',()=>{
 const preview={included_records:[{catalogue_number:'LINX22',primary_udi_di:'D1',base_version:'4',derived_version:'5'}],excluded_records:[{catalogue_number:'BLOCKED',primary_udi_di:'D2',reason_message:'Accepted baseline unavailable'}]};
 const {text}=render({preview});assert.match(text,/Included · version 4 → 5/);assert.match(text,/BLOCKED/);assert.match(text,/Accepted baseline unavailable/);
 assert.match(render({selectedEntries:[]}).text,/Not selected/);
});
test('changed review scope is announced and can be explicitly cleared',()=>{
 let cleared=false;
 const {text,nodes}=render({reviewScopeLabel:'Linx · GS1: B1',reviewScopeMatches:false,onClearReviewScope:()=>{cleared=true;}});
 assert.ok(nodes.some(n=>n.props?.role==='alert'));
 assert.match(text,/differs from the reviewed group/);
 nodes.find(n=>n.type==='button' && n.props.children==='Clear reviewed group').props.onClick();assert.equal(cleared,true);
});
