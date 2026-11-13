const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const selected={batch_id:'2026-11-08-001',set_sha256:'set-hash',manifest_sha256:'manifest-hash',exported_from:'2026-11-07T10:00:00Z',exported_to:'2026-11-07T10:00:00Z',file_count:5,device_count:1000,complete_pages:true,retained_batches:['2026-11-08-001'],selection_reason:'Latest suitable complete retained extract set by recorded export dates',scope:'Business filters not established',source_status:'Retained source batch; not proof of registration'};
const sourceResult={environment:'dev',available:true,selected,excluded_sets:[]};
const result={report_type:'model_reconciliation_summary',comparison_basis:'current_device_data',comparison_fields:['Trade name','Reference number'],environment:'dev',manufacturer:'TEST-MF',generated_at:'2026-11-08T10:00:00Z',import_batch_id:4,comparison_basis_label:'Comparison basis: current stored device data against the retained EUDAMED extract.',extract_source:selected,excluded_extract_sets:[],
 models:[{key:'model-a',family:'Family',model:'Linx',total:1000,compared:995,unresolved:0,matching:950,exceptions:45,extract_only:0,status:'exceptions',exact:950,different:30,unable:15,absent:5,source_linked:1000,stored_available:980,extract_matched:995,source_files:['Template.xlsx']}],
 findings:[{model_key:'model-a',category:'Attribute difference',finding:'Trade name',affected:30}],
 details:[{model_key:'model-a',family:'Family',model:'Linx',issuer:'GS1',udi_di:'SECRET-DEVICE-ID',catalogue:'CATALOGUE',outcome:'different',issues:[],differences:[{field:'Trade name',stored:'Old',extracted:'New'}],missing_fields:[],notes:[],state_source:'Stored accepted device snapshot'}],
 extract_only:3,evidence:[{kind:'Retained Data Import extract',name:'extract.xml',sha256:'abc',created_at:'2026-11-07'}],export_files:[{created_at:'2026-11-07T10:00:00Z'}],limitations:['Missing stored data prevents a full match'],excel_base64:'AA=='};
function harness(action=async()=>result,sourceAction=async()=>sourceResult){
 const states=[],effects=[],calls=[],sourceCalls=[];let cursor=0,tree;
 const props={environment:'dev',enabled:true};
 const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
 useRef(initial){const i=cursor++;return states[i]??={current:initial};},
 useEffect(fn,deps){const i=cursor++,old=states[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))effects.push(()=>{old?.cleanup?.();states[i]={deps,cleanup:fn()};});}};
 const source=fs.readFileSync(require.resolve('../src/components/ReportingWorkspace.tsx'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',compiled)(name=>name==='react'?react:name==='../api'?{api:{storedDeviceComparison:request=>{calls.push(request);return action(request);},storedDeviceComparisonSource:()=>{sourceCalls.push(true);return sourceAction();}}}:require(name),module,module.exports);
 function nodes(node=tree){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(n=>nodes(n??null));if(typeof node.type==='function')return nodes(node.type(node.props));return[node,...nodes(node.props?.children??null)];}
 function render(){cursor=0;tree=module.exports.ReportingWorkspace(props);while(effects.length)effects.shift()();}
 function button(label){return nodes().find(n=>n.type==='button'&&n.props.children===label);}
 function click(label){const b=button(label);assert.ok(b,label);assert.ok(!b.props.disabled,label);b.props.onClick();render();}
 render();render();
 return{props,calls,sourceCalls,render,nodes,button,click,text:()=>JSON.stringify(nodes()),async settle(){for(let i=0;i<4;i++){await new Promise(setImmediate);render();}}};
}

test('summary uses retained sources and displays models without device lists or other reports',async()=>{
 const h=harness();assert.equal(h.button('Generate summary').props.disabled,true);await h.settle();
 assert.equal(h.nodes().filter(n=>n.type==='input').length,0);
 h.click('Generate summary');await h.settle();assert.deepEqual(h.calls[0],{summary_only:true,include_device_details:false});
 assert.match(h.text(),/950/);assert.match(h.text(),/Model Reconciliation Summary/);assert.doesNotMatch(h.text(),/SECRET-DEVICE-ID/);
 assert.equal(h.nodes().filter(n=>n.type==='table').length,1);
 assert.equal(h.nodes().filter(n=>n.type==='a').length,0);
 assert.equal(h.button('View affected entries'),undefined);assert.equal(h.button('View comparison sources'),undefined);
 assert.ok(h.button('Download summary Excel'));
});

test('missing suitable sources remain unassessed and direct the correction through Data Import',async()=>{
 const h=harness(undefined,async()=>({environment:'dev',available:false,selected:null,excluded_sets:[],reason:'No suitable retained extract. Correct through Data Import.'}));
 await h.settle();assert.equal(h.button('Generate summary').props.disabled,true);assert.match(h.text(),/Correct through Data Import/);
 assert.equal(h.button('Download summary Excel'),undefined);assert.equal(h.calls.length,0);
});

test('excluded incomplete sets are explained without blocking the selected suitable older set',async()=>{
 const h=harness(undefined,async()=>({...sourceResult,excluded_sets:[{batch_id:'2026-11-08-002',reason:'Missing export pages'}]}));
 await h.settle();assert.match(h.text(),/Missing export pages/);assert.equal(h.button('Generate summary').props.disabled,false);
});

test('source errors never enable generation or present zero-count results',async()=>{
 const h=harness(undefined,async()=>{throw Error('Retained storage unavailable');});await h.settle();
 assert.match(h.text(),/Retained storage unavailable/);assert.equal(h.button('Generate summary').props.disabled,true);
 assert.equal(h.button('Download summary Excel'),undefined);
});

test('leaving Reporting invalidates in-flight results and returning rechecks Data Import sources',async()=>{
 let finish;const h=harness(()=>new Promise(resolve=>finish=resolve));await h.settle();h.click('Generate summary');await h.settle();
 h.props.enabled=false;h.render();finish(result);await h.settle();h.props.enabled=true;h.render();await h.settle();
 assert.doesNotMatch(h.text(),/950/);assert.equal(h.sourceCalls.length,2);
});

test('environment changes reject in-flight source and report results',async()=>{
 let finish;const h=harness(undefined,()=>new Promise(resolve=>finish=resolve));
 h.props.environment='prod';h.render();finish(sourceResult);await h.settle();assert.equal(h.button('Generate summary'),undefined);
 let finishReport;const other=harness(()=>new Promise(resolve=>finishReport=resolve));await other.settle();other.click('Generate summary');await other.settle();
 other.props.environment='prod';other.render();finishReport(result);await other.settle();assert.doesNotMatch(other.text(),/950/);
});

test('generation errors and mismatched environments do not become successful zero reports',async()=>{
 const h=harness(async()=>{throw Error('Retained extract changed');});await h.settle();h.click('Generate summary');await h.settle();
 assert.match(h.text(),/Retained extract changed/);assert.equal(h.button('Download summary Excel'),undefined);
 const other=harness(async()=>({...result,environment:'prod'}));await other.settle();other.click('Generate summary');await other.settle();
 assert.match(other.text(),/Report environment changed/);assert.equal(other.button('Download summary Excel'),undefined);
});

test('generation shows the actual selected latest source even if Data Import changed after preflight',async()=>{
 const h=harness(async()=>({...result,extract_source:{...selected,batch_id:'2026-11-08-003'}}));await h.settle();h.click('Generate summary');await h.settle();
 assert.match(h.text(),/2026-11-08-003/);assert.doesNotMatch(h.text(),/2026-11-08-001/);
});

test('large device scopes remain a single model row with no device detail controls',async()=>{
 const detailed={...result,details:Array.from({length:10000},(_,i)=>({...result.details[0],udi_di:`DEVICE-${i}`}))};
 const h=harness(async()=>detailed);await h.settle();h.click('Generate summary');await h.settle();
 assert.doesNotMatch(h.text(),/DEVICE-0/);assert.equal(h.nodes().filter(n=>n.type==='tbody')[0].props.children.length,1);
 assert.equal(h.nodes().filter(n=>n.type==='input').length,0);
});

test('green means a complete model match and amber covers any exception',async()=>{
 const good={...result.models[0],key:'good',model:'Matching model',total:1000,compared:500,matching:500,different:0,unable:0,absent:500,exceptions:0,status:'match'};
 const h=harness(async()=>({...result,models:[good,...result.models]}));await h.settle();h.click('Generate summary');await h.settle();
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Registered data matches'&&n.props.className.includes('ok')));
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='Data exceptions'&&n.props.className.includes('warn')));
 assert.equal(h.nodes().filter(n=>n.type==='tbody')[0].props.children.length,2);
});

test('an accepted-state result cannot be displayed as current-data reconciliation',async()=>{
 const h=harness(async()=>({...result,comparison_basis:'accepted_state'}));await h.settle();h.click('Generate summary');await h.settle();
 assert.match(h.text(),/Current stored device data could not be verified/);
 assert.equal(h.nodes().filter(n=>n.type==='table').length,0);
 assert.equal(h.button('Download summary Excel'),undefined);
});


test('models with no devices compared use neutral status and show registration coverage',async()=>{
 const pending={...result.models[0],total:500,compared:0,matching:0,different:0,unable:0,absent:500,exceptions:0,status:'not_compared'};
 const h=harness(async()=>({...result,models:[pending]}));await h.settle();h.click('Generate summary');await h.settle();
 assert.ok(h.nodes().some(n=>n.type==='span'&&n.props.children==='No devices compared'&&n.props.className.includes('neutral')));
 assert.ok(!h.nodes().some(n=>n.type==='span'&&['Registered data matches','Data exceptions'].includes(n.props.children)));
 assert.match(h.text(),/Not in extract/);assert.match(h.text(),/does not make a model amber/);
});
