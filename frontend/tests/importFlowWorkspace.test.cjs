const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const metadata={creator:{name:'RA Operator',email:'ra@example.test',team_role:'RA'},description:'Current extract',source_date:null,export_date:null};
const saved={id:'saved',revision:'revision',batch_id:null,stage:'review',metadata,files:[{role:'templates',path:'templates/Template.xlsx',original_name:'Template.xlsx',size_bytes:100}],review:null,workbook:null,summary:null,result:null};
const ready={...saved,stage:'workbook',review:{message:'Ready to continue',can_create:true,groups:[]}};
const workbook={...ready,stage:'import',batch_id:'2026-10-31-002',workbook:{artifact_id:'artifact',workbook_name:'import.xlsx'},summary:{new_count:2,existing_retained_count:5,omitted_retained_count:1}};
const complete={...workbook,stage:'complete',result:{import_batch_id:5,created_count:2,existing_retained_count:5,omitted_retained_count:1,confirmed_at:'2026-10-31T18:40:00Z',confirmed_by:'RA',backup:{path:'backup.sqlite3'}}};
function harness(overrides={},initial=null,initialView='data',environment='dev'){
 let view=initialView;
 const states=[],effects=[],timers=new Map(),calls=[];let cursor=0,tree,nextTimer=0;const memory=new Map(initial?[[`eudamed-${environment}-current-import`,initial.id]]:[]);
 const api={importSessions:async()=>({imports:initial?[{id:initial.id,description:'Current extract',status:initial.stage}]:[]}),importSession:async()=>initial,saveImportSession:async(id,revision,metadata,files)=>({...saved,metadata}),reviewImportSession:async()=>ready,createImportWorkbook:async()=>workbook,importBatchData:async()=>complete,downloadImportWorkbook:async()=>{throw Error('Download must be optional');},...overrides};
 for(const [key,value] of Object.entries(api))api[key]=(...args)=>{calls.push([key,...args]);return value(...args);};
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef(initial){const i=cursor++;return states[i]??={current:initial};},useEffect(fn,deps){const i=cursor++,old=states[i];if(!old||deps.some((value,n)=>value!==old.deps[n]))effects.push(()=>{old?.cleanup?.();states[i]={deps,cleanup:fn(),effect:fn};});}};
 const source=fs.readFileSync(require.resolve('../src/components/ImportFlowWorkspace.tsx'),'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const module={exports:{}};
 const win={setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 new Function('require','module','exports','window','localStorage',output)(name=>name==='react'?react:name==='../api'?{api}:require(name),module,module.exports,win,{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)});
 function nodes(node=tree){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(child=>nodes(child??null));return[node,...nodes(node.props?.children??null)];}
 let imported=0;const context=()=>{};
 function render(){cursor=0;tree=module.exports.ImportFlowWorkspace({enabled:true,environment,view,onViewHistory:()=>{view='history';},onContextChange:context,onDatabaseImported:()=>imported++});while(effects.length)effects.shift()();}
 function primary(){return nodes().find(node=>node.type==='button'&&node.props.className==='action-button');}
 function click(){const node=primary();assert.ok(node&&!node.props.disabled);node.props.onClick();render();}
 function field(label,value){const found=nodes().find(node=>node.type==='label'&&node.props.children?.[0]===label);assert.ok(found,label);nodes(found).find(node=>node.type==='input').props.onChange({target:{value}});render();}
 render();return{render,nodes,primary,click,field,calls,memory,get imported(){return imported;},async settle(){for(let i=0;i<4;i++){await new Promise(setImmediate);render();}},flushTimers(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());render();},text:()=>JSON.stringify(nodes())};
}
test('one primary action progresses through all three stages without downloading',async()=>{
 const h=harness();await h.settle();assert.equal(h.primary().props.children,'Review source data');h.click();await h.settle();assert.equal(h.primary().props.children,'Create Import Workbook');
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Good data'&&n.props.className.includes('ok')));
 assert.equal(h.nodes().filter(n=>n.type==='button').length,1);h.click();await h.settle();assert.equal(h.primary().props.children,'Import Batch Data');assert.equal(h.primary().props.disabled,true);
 h.nodes().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});h.render();h.click();await h.settle();assert.equal(h.primary(),undefined);assert.match(h.text(),/Import completed/);assert.equal(h.imported,1);
 assert.equal(h.calls.filter(c=>c[0]==='downloadImportWorkbook').length,0);assert.equal(h.calls.filter(c=>c[0]==='importBatchData').length,1);
});
test('autosave retains files and metadata and reopens at the saved stage without Resume controls',async()=>{
 let persisted;
 const h=harness({saveImportSession:async(id,revision,metadata,files)=>persisted={...saved,metadata}});await h.settle();h.field('Your name','Alice');h.flushTimers();await h.settle();assert.equal(persisted.metadata.creator.name,'Alice');assert.match(h.text(),/Saved automatically/);assert.equal(h.memory.get('eudamed-dev-current-import'),'saved');
 const reopened=harness({},persisted);await reopened.settle();assert.match(reopened.text(),/Template.xlsx/);assert.match(reopened.text(),/Alice/);assert.equal(reopened.primary().props.children,'Review source data');assert.ok(!reopened.text().includes('Save draft for later'));
 const atImport=harness({},workbook);await atImport.settle();assert.equal(atImport.primary().props.children,'Import Batch Data');assert.equal(atImport.primary().props.disabled,true);
});
test('blocking duplicate summary stays at source review with affected row references',async()=>{
 const blocked={...saved,review:{message:'Source corrections required',can_create:false,groups:[{code:'duplicates',source:'Template',title:'Duplicate Device UDI-DIs in Templates',severity:'block',count:1,action:'Correct the repeated identifiers.',records:[{file:'Template.xlsx',sheet:'Devices',row:2,identifier:'001'},{file:'Template.xlsx',sheet:'Devices',row:3,identifier:'001'}]}]}};
 const h=harness({reviewImportSession:async()=>blocked});await h.settle();h.click();await h.settle();assert.equal(h.primary().props.children,'Review source data');assert.match(h.text(),/Source corrections required/);assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Showstopper'&&n.props.className.includes('danger')));assert.match(h.text(),/Row 2/);assert.match(h.text(),/Row 3/);assert.ok(h.nodes().filter(n=>n.type==='details').every(n=>!n.props.open));assert.equal(h.calls.filter(c=>c[0]==='createImportWorkbook').length,0);
});
test('warnings progress directly to workbook creation without extra approval',async()=>{
 const h=harness({reviewImportSession:async()=>({...ready,review:{...ready.review,message:'Ready to continue — warnings found',groups:[{code:'optional',source:'Batch details',title:'Missing optional information',severity:'warn',action:'Complete later.',count:1,records:[{detail:'Date unknown'}]}]}})});await h.settle();h.click();await h.settle();assert.equal(h.primary().props.children,'Create Import Workbook');assert.equal(h.primary().props.disabled,false);assert.equal(h.nodes().filter(n=>n.type==='button').length,1);assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Warning'&&n.props.className.includes('warn')));
});
test('rapid repeated clicks perform only one review',async()=>{
 let finish;const h=harness({reviewImportSession:()=>new Promise(resolve=>finish=resolve)});await h.settle();h.click();h.primary().props.onClick();await h.settle();assert.equal(h.calls.filter(c=>c[0]==='reviewImportSession').length,1);finish(ready);await h.settle();assert.equal(h.primary().props.children,'Create Import Workbook');
});
test('an older autosave response cannot overwrite edits entered while it was uploading',async()=>{
 let finish,number=0;const h=harness({saveImportSession:async(id,revision,metadata)=>{number++;if(number===1)return new Promise(resolve=>finish=()=>resolve({...saved,metadata}));return {...saved,revision:'next',metadata};}});await h.settle();h.field('Your name','Alice');h.flushTimers();h.field('Your name','Alicia');finish();await h.settle();
 const label=h.nodes().find(n=>n.type==='label'&&n.props.children?.[0]==='Your name');assert.equal(h.nodes(label).find(n=>n.type==='input').props.value,'Alicia');h.flushTimers();await h.settle();assert.equal(h.calls.filter(c=>c[0]==='saveImportSession').at(-1)[3].creator.name,'Alicia');
});

test('verified additions use green information, model counts and optional device examples',async()=>{
 const information={code:'information',source:'Template / stored parent links',title:'Additional source information',severity:'info',action:'The parent links agree. No action required.',count:8420,truncated:true,models:[{product_family:'Linx',product_variant:'Linx',device_count:4000},{product_family:'Elite',product_variant:'Elite Blade',device_count:4420}],records:[{udi_di:'05050649023224',fields:[{field:'Basic UDI-DI',before:null,after:'5050649LINX2G'}]}]};
 const session={...ready,review:{message:'Ready to continue — additional source information',can_create:true,groups:[information]}};
 const h=harness({reviewImportSession:async()=>session});await h.settle();h.click();await h.settle();
 assert.equal(h.primary().props.children,'Create Import Workbook');assert.ok(!h.primary().props.disabled);
 const pills=h.nodes().filter(n=>n.type==='span'&&n.props.children==='Information');assert.equal(pills.length,2);assert.ok(pills.every(n=>n.props.className.includes('ok')));
 assert.ok(!h.nodes().some(n=>n.type==='span'&&n.props.children==='Warning'));
 assert.match(h.text(),/No action required/);assert.ok(h.nodes().some(n=>n.type==='li'&&Array.isArray(n.props.children)&&n.props.children[0]==='Linx'&&n.props.children[2]===4000));assert.match(h.text(),/4420/);
 assert.ok(!h.text().includes('05050649023224'));
 const examples=h.nodes().find(n=>n.type==='details'&&n.props.onToggle);assert.ok(examples);examples.props.onToggle({currentTarget:{open:true}});h.render();
 assert.match(h.text(),/05050649023224/);assert.match(h.text(),/Not present in previous source/);
 examples.props.onToggle({currentTarget:{open:false}});h.render();assert.ok(!h.text().includes('05050649023224'));
});

test('information does not hide a genuine warning or turn the overall review green',async()=>{
 const session={...ready,review:{message:'Ready to continue — warnings found',can_create:true,groups:[{code:'information',source:'Template',title:'Additional source information',severity:'info',action:'No action required.',count:1,models:[],records:[]},{code:'differences',source:'Template / database',title:'Differences between source files',severity:'warn',action:'Review the change.',count:1,records:[{udi_di:'DEVICE',fields:[{field:'Catalogue',before:'OLD',after:'NEW'}]}]}]}};
 const h=harness({reviewImportSession:async()=>session});await h.settle();h.click();await h.settle();
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Warning'&&n.props.className.includes('warn')));
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Information'&&n.props.className.includes('ok')));
 assert.match(h.text(),/OLD/);assert.match(h.text(),/NEW/);
});

test('extract-only warnings explain the affected model, catalogue and required check',async()=>{
 const review={message:'Ready to continue — warnings found',can_create:true,groups:[{code:'extract_only',source:'Template ↔ EUDAMED',title:'Registered devices missing from supplied Templates',severity:'warn',count:1,action:'Confirm whether these devices should be included in the current Templates.',records:[{file:'APP-DTX-000123109.xml',row:41,udi_di:'05050649062025',product_variant:'Echelon VAC',catalogue:'EVAC22L1S',detail:'Registered in the selected EUDAMED extract but missing from the supplied Templates.'}]}]};
 const h=harness({reviewImportSession:async()=>({...ready,review})});await h.settle();h.click();await h.settle();
 assert.match(h.text(),/Registered devices missing from supplied Templates/);assert.match(h.text(),/Echelon VAC/);assert.match(h.text(),/EVAC22L1S/);assert.match(h.text(),/Device 41 in XML/);assert.match(h.text(),/Confirm whether/);
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Warning'&&n.props.className.includes('warn')));
});

test('resolved corrections are green and each information category opens examples independently',async()=>{
 const groups=[{code:'information',source:'Template',title:'Additional source information',severity:'info',count:1,action:'No action required.',models:[],records:[{udi_di:'PARENT-EXAMPLE'}]},{code:'applied_corrections',source:'Template',title:'Source correction already applied',severity:'info',count:1,action:'Current database agrees. Historical source retained. No action required.',models:[{product_variant:'Echelon',product_family:'Echelon',device_count:1}],records:[{udi_di:'CORRECTION-EXAMPLE',fields:[{field:'Catalogue',before:'EC27LN7S',after:'EC24R1S'}]}]}];
 const h=harness({reviewImportSession:async()=>({...ready,review:{message:'Ready to continue — additional source information',can_create:true,groups}})});await h.settle();h.click();await h.settle();
 assert.match(h.text(),/Source correction already applied/);assert.ok(!h.text().includes('CORRECTION-EXAMPLE'));assert.ok(!h.text().includes('PARENT-EXAMPLE'));
 const examples=h.nodes().filter(n=>n.type==='details'&&n.props.onToggle);assert.equal(examples.length,2);
 examples[1].props.onToggle({currentTarget:{open:true}});h.render();assert.match(h.text(),/CORRECTION-EXAMPLE/);assert.match(h.text(),/EC27LN7S/);assert.match(h.text(),/EC24R1S/);assert.ok(!h.text().includes('PARENT-EXAMPLE'));
 assert.ok(!h.nodes().some(n=>n.type==='span'&&n.props.children==='Warning'));
});

const historicReview={message:'Ready to continue — warnings found',can_create:true,groups:[{code:'optional',source:'Template',title:'Missing source date',severity:'warn',action:'Complete later.',count:1,records:[{detail:'Historical finding'}]}]};

test('completed imports display only a receipt and next actions in Import Data',async()=>{
 const h=harness({}, {...complete,review:historicReview});await h.settle();
 assert.match(h.text(),/Import completed/);assert.match(h.text(),/Import #/);assert.match(h.text(),/RA/);assert.match(h.text(),/Canonical Validation/);
 assert.ok(!h.nodes().some(n=>n.props?.['aria-label']==='Import progress'));
 assert.ok(!h.text().includes('Ready to continue'));assert.ok(!h.text().includes('Historical finding'));
 assert.equal(h.nodes().filter(n=>['select','input','a'].includes(n.type)).length,0);
 assert.deepEqual(h.nodes().filter(n=>n.type==='button').map(n=>n.props.children),['Start new import','View import history']);
 assert.equal(h.primary(),undefined);assert.ok(!h.calls.some(c=>['reviewImportSession','createImportWorkbook','importBatchData'].includes(c[0])));
 h.nodes().find(n=>n.type==='button'&&n.props.children==='Start new import').props.onClick();await h.settle();
 assert.equal(h.primary().props.children,'Review source data');assert.ok(!h.text().includes('Historical finding'));assert.equal(h.memory.get('eudamed-dev-current-import'),'');
});

test('history keeps the source findings and downloads read-only',async()=>{
 const initial={...complete,review:historicReview};const original=JSON.stringify(initial);
 const h=harness({},initial);await h.settle();
 h.nodes().find(n=>n.type==='button'&&n.props.children==='View import history').props.onClick();await h.settle();
 assert.match(h.text(),/Source review at import/);assert.match(h.text(),/Historical finding/);assert.match(h.text(),/Template.xlsx/);assert.match(h.text(),/backup.sqlite3/);
 assert.ok(!h.text().includes('Ready to continue'));assert.ok(!h.nodes().some(n=>n.props?.['aria-label']==='Import progress'));
 assert.equal(h.nodes().filter(n=>n.type==='input'||n.type==='button').length,0);
 assert.ok(h.nodes().some(n=>n.type==='a'&&n.props.children==='Download full source findings'));
 assert.ok(h.nodes().some(n=>n.type==='a'&&n.props.children==='Download workbook (optional)'));
 assert.ok(!h.calls.some(c=>['saveImportSession','reviewImportSession','createImportWorkbook','importBatchData'].includes(c[0])));
 assert.equal(JSON.stringify(initial),original);
});

test('history shows only completed imports and never presents a draft as evidence',async()=>{
 const h=harness({importSessions:async()=>({imports:[{id:'draft',description:'Pending draft',status:'Awaiting review'},{id:'done',description:'Finished import',status:'complete'}]}),importSession:async id=>id==='done'?{...complete,id:'done',metadata:{...metadata,description:'Finished import'}}:saved},null,'history');await h.settle();
 assert.match(h.text(),/Finished import/);assert.ok(!h.text().includes('Pending draft'));assert.match(h.text(),/Import completed/);
 assert.ok(!h.nodes().some(n=>n.type==='input'||n.type==='button'));
});

test('empty history provides an empty state without import controls',async()=>{
 const h=harness({},null,'history');await h.settle();
 assert.match(h.text(),/No completed imports recorded/);
 assert.ok(!h.nodes().some(n=>n.type==='input'||n.type==='button'));
});

test('browsing history preserves the separately remembered ongoing import',async()=>{
 const h=harness({importSessions:async()=>({imports:[{id:'done',description:'Finished',status:'complete'}]}),importSession:async()=>({...complete,id:'done'})},saved,'history');await h.settle();
 assert.equal(h.memory.get('eudamed-dev-current-import'),'saved');
 assert.equal(h.memory.get('eudamed-dev-current-import-history'),'done');
 assert.ok(!h.calls.some(c=>['saveImportSession','reviewImportSession','createImportWorkbook','importBatchData'].includes(c[0])));
});


test('Production requires its named confirmation and keeps selection separate from Dev',async()=>{
 const initial={...workbook,environment:'prod'};
 const h=harness({importBatchData:async()=>({...complete,environment:'prod'})},initial,'data','prod');await h.settle();
 assert.match(h.text(),/Production/);assert.ok(!h.text().includes('Dev database'));
 assert.equal(h.primary().props.disabled,true);
 h.nodes().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});h.render();h.click();await h.settle();
 const call=h.calls.find(c=>c[0]==='importBatchData');assert.equal(call[5],'prod');
 assert.equal(h.memory.get('eudamed-prod-current-import'),'saved');assert.equal(h.memory.get('eudamed-dev-current-import'),undefined);
});

test('earlier Production receipts remain read-only without invented downloads',async()=>{
 const legacy={...complete,environment:'prod',legacy:true,legacy_workbooks:['Earlier production workbook.xlsx'],review:null,workbook:null,result:{...complete.result,backup:null}};
 const h=harness({},legacy,'history','prod');await h.settle();
 assert.match(h.text(),/Earlier Production import/);assert.match(h.text(),/Earlier production workbook.xlsx/);
 assert.equal(h.nodes().filter(n=>n.type==='button'||n.type==='input'||n.type==='a').length,0);
});

test('Production rejects a saved import returned for another environment',async()=>{
 const h=harness({importSession:async()=>({...workbook,environment:'dev'})},{...workbook,environment:'prod'},'data','prod');await h.settle();
 assert.match(h.text(),/Import environment changed/);
 assert.equal(h.calls.filter(call=>call[0]==='importBatchData').length,0);
});


test('Production autosave binds the environment and displays the larger bounded source allowance',async()=>{
 const h=harness({saveImportSession:async(id,revision,m)=>({...saved,metadata:m,environment:'prod'})},null,'data','prod');await h.settle();
 assert.match(h.text(),/500 files \/ 256 MB/);
 h.field('Your name','Production operator');h.flushTimers();await h.settle();
 assert.equal(h.calls.find(call=>call[0]==='saveImportSession')[6],'prod');
 assert.equal(h.memory.get('eudamed-dev-current-import'),undefined);
});
