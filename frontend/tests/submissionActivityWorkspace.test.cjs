const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const base={model_key:'linx',kind:'ZIP download',activity_at:'2026-10-01T10:00:00Z',generated_at:'2026-10-01T09:59:00Z',zip_downloaded_at:'2026-10-01T10:00:00Z',response_at:null,batch_id:null,reference:'older.zip',operation:'UDI_DI.POST',package_sha256:'hash',outcome:'ZIP download / review recorded',success:0,error:0,pending:0,unknown:0,entities:[],responses:[],notes:['No package-to-batch association'],generated_by:null,response_imported_by:null,response_imported_at:null};
const older={...base,id:'zip:1'};
const latest={...base,id:'batch:C1',kind:'Message response',activity_at:'2026-10-03T12:00:00Z',response_at:'2026-10-03T12:00:00Z',reference:'C1',success:1,outcome:'Successful',entities:[{catalogue:'PRIVATE-CATALOGUE',udi_di:'PRIVATE-DI',kind:'Device UDI-DI',status:'SUCCESS'}],responses:[{event_id:1,file_name:'success.xml',message_id:'M1',correlation_id:'C1',response_at:'2026-10-03T12:00:00Z',transaction_id:null,submission_id:null,xml_available:true}]};
const echelon={...base,id:'zip:2',model_key:'echelon',reference:'echelon.zip'};
const result={environment:'dev',generated_at:'2026-11-08T10:00:00Z',models:[{key:'linx',model:'Linx',family:'Family',latest_activity:latest,latest_zip_downloaded_at:older.zip_downloaded_at,latest_response_at:latest.response_at,zip_records:1,message_batches:1,unlinked_responses:0,unordered_records:0},{key:'echelon',model:'Echelon',family:'Other',latest_activity:echelon,zip_records:1,message_batches:0,unlinked_responses:0,unordered_records:0}],activities:[latest,echelon,older],limitations:['Portal upload time not recorded'],excel_base64:'AA=='};
function harness(action=async()=>result){
 const states=new Map(),effects=[];let frame='',cursor=0,tree;const calls=[];const props={environment:'dev',enabled:true};
 const react={useState(initial){const key=frame+':'+cursor++;if(!states.has(key))states.set(key,initial);return[states.get(key),v=>states.set(key,typeof v==='function'?v(states.get(key)):v)];},useRef(initial){const key=frame+':'+cursor++;if(!states.has(key))states.set(key,{current:initial});return states.get(key);},useEffect(fn,deps){const key=frame+':'+cursor++,old=states.get(key);if(!old||deps.some((v,i)=>v!==old.deps[i]))effects.push(()=>{old?.cleanup?.();states.set(key,{deps,cleanup:fn()});});}};
 const source=fs.readFileSync(require.resolve('../src/components/SubmissionActivityWorkspace.tsx'),'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const module={exports:{}};
 new Function('require','module','exports',output)(name=>name==='react'?react:name==='../api'?{api:{submissionActivityReport:options=>{calls.push(options);return action(options);}}}:require(name),module,module.exports);
 function invoke(fn,props,path){const oldFrame=frame,oldCursor=cursor;frame=path;cursor=0;const value=fn(props);frame=oldFrame;cursor=oldCursor;return value;}
 function materialize(node,path){if(Array.isArray(node))return node.map((n,i)=>materialize(n,path+'/'+(n?.key??i)));if(!node||typeof node!=='object')return node;if(typeof node.type==='function')return materialize(invoke(node.type,node.props,path),path+'/render');return{...node,props:{...node.props,children:materialize(node.props?.children,path+'/children')}};}
 function render(){tree=materialize(invoke(module.exports.SubmissionActivityWorkspace,props,'root'),'tree');while(effects.length)effects.shift()();}
 function nodes(n=tree){if(!n||typeof n!=='object')return[];if(Array.isArray(n))return n.flatMap(x=>nodes(x??null));return[n,...nodes(n.props?.children??null)];}
 function button(label){return nodes().find(n=>n.type==='button'&&n.props.children===label);}
 function click(label){const b=button(label);assert.ok(b,label);assert.ok(!b.props.disabled);b.props.onClick();render();}
 function link(label){const node=nodes().find(n=>n.type==='a'&&n.props.children===label);assert.ok(node,label);node.props.onClick();render();}
 render();render();return{props,calls,render,nodes,button,click,link,text:()=>JSON.stringify(tree),async settle(){for(let i=0;i<4;i++){await new Promise(setImmediate);render();}}};
}

test('model hyperlinks show latest timing and open history including latest and earlier records',async()=>{
 const h=harness();h.click('Generate report');await h.settle();assert.equal(h.calls.length,1);
 assert.ok(h.nodes().some(n=>n.type==='a'&&n.props.children==='Linx'));
 assert.equal(h.nodes().find(n=>n.type==='select'),undefined);
 h.link('Linx');assert.match(h.text(),/Linx · Family — activity history/);
 const history=h.nodes().find(n=>n.props?.id==='submission-activity-history');const text=JSON.stringify(history);
 assert.match(text,/C1/);assert.match(text,/older.zip/);assert.match(text,/Latest recorded activity/);assert.doesNotMatch(text,/echelon.zip/);
 assert.ok(h.nodes().some(n=>n.type==='a'&&n.props.children==='Echelon'));
 h.link('Echelon');assert.match(JSON.stringify(h.nodes().find(n=>n.props?.id==='submission-activity-history')),/echelon.zip/);
 h.link('View history for all models');assert.match(h.text(),/All models — activity history/);
});

test('entity identifiers remain hidden until explicitly opening entity outcomes',async()=>{
 const h=harness();h.click('Generate report');await h.settle();assert.doesNotMatch(h.text(),/PRIVATE-DI/);
 const details=h.nodes().find(n=>n.type==='details'&&n.props.onToggle);assert.ok(details);
 details.props.onToggle({currentTarget:{open:true}});h.render();assert.match(h.text(),/PRIVATE-DI/);
 h.nodes().find(n=>n.type==='details'&&n.props.onToggle).props.onToggle({currentTarget:{open:false}});h.render();assert.doesNotMatch(h.text(),/PRIVATE-DI/);
 assert.match(h.text(),/ZIP generated by: Not recorded/);assert.match(h.text(),/Success XML imported by: Not recorded/);
});

test('leaving the report invalidates a delayed result and Production is disabled',async()=>{
 let finish;const h=harness(()=>new Promise(resolve=>finish=resolve));h.click('Generate report');h.props.enabled=false;h.render();finish(result);await h.settle();
 h.props.enabled=true;h.render();await h.settle();assert.equal(h.button('Download full report Excel'),undefined);
 h.props.environment='prod';h.render();assert.equal(h.button('Generate report'),undefined);
});

test('read failures and cross-environment responses never appear as successful reports',async()=>{
 const h=harness(async()=>{throw Error('Database unavailable');});h.click('Generate report');await h.settle();assert.match(h.text(),/Database unavailable/);assert.equal(h.button('Download full report Excel'),undefined);
 const other=harness(async()=>({...result,environment:'prod'}));other.click('Generate report');await other.settle();assert.match(other.text(),/Report environment changed/);
});

test('entity Excel detail requires opt-in and clears the previous download',async()=>{
 const h=harness();h.click('Generate report');await h.settle();assert.deepEqual(h.calls[0],{include_device_details:false});
 h.nodes().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});h.render();assert.equal(h.button('Download full report Excel'),undefined);
 h.click('Generate report');await h.settle();assert.deepEqual(h.calls[1],{include_device_details:true});
});
