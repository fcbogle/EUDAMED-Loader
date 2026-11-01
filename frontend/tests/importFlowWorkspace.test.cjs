const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const metadata={creator:{name:'RA Operator',email:'ra@example.test',team_role:'RA'},description:'Current extract',source_date:null,export_date:null};
const saved={id:'saved',revision:'revision',batch_id:null,stage:'review',metadata,files:[{role:'templates',path:'templates/Template.xlsx',original_name:'Template.xlsx',size_bytes:100}],review:null,workbook:null,summary:null,result:null};
const ready={...saved,stage:'workbook',review:{message:'Ready to continue',can_create:true,groups:[]}};
const workbook={...ready,stage:'import',batch_id:'2026-10-31-002',workbook:{artifact_id:'artifact',workbook_name:'import.xlsx'},summary:{new_count:2,existing_retained_count:5,omitted_retained_count:1}};
const complete={...workbook,stage:'complete',result:{created_count:2,confirmed_at:'2026-10-31',confirmed_by:'RA',backup:{path:'backup.sqlite3'}}};
function harness(overrides={},initial=null){
 const states=[],effects=[],timers=new Map(),calls=[];let cursor=0,tree,nextTimer=0;const memory=new Map(initial?[['eudamed-dev-current-import',initial.id]]:[]);
 const api={importSessions:async()=>({imports:initial?[{id:initial.id,description:'Current extract',status:initial.stage}]:[]}),importSession:async()=>initial,saveImportSession:async(id,revision,metadata,files)=>({...saved,metadata}),reviewImportSession:async()=>ready,createImportWorkbook:async()=>workbook,importBatchData:async()=>complete,downloadImportWorkbook:async()=>{throw Error('Download must be optional');},...overrides};
 for(const [key,value] of Object.entries(api))api[key]=(...args)=>{calls.push([key,...args]);return value(...args);};
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef(initial){const i=cursor++;return states[i]??={current:initial};},useEffect(fn,deps){const i=cursor++,old=states[i];if(!old||deps.some((value,n)=>value!==old.deps[n]))effects.push(()=>{old?.cleanup?.();states[i]={deps,cleanup:fn(),effect:fn};});}};
 const source=fs.readFileSync(require.resolve('../src/components/ImportFlowWorkspace.tsx'),'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const module={exports:{}};
 const win={setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 new Function('require','module','exports','window','localStorage',output)(name=>name==='react'?react:name==='../api'?{api}:require(name),module,module.exports,win,{getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)});
 function nodes(node=tree){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(nodes);return[node,...nodes(node.props?.children??null)];}
 let imported=0;const context=()=>{};
 function render(){cursor=0;tree=module.exports.ImportFlowWorkspace({enabled:true,onContextChange:context,onDatabaseImported:()=>imported++});while(effects.length)effects.shift()();}
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
