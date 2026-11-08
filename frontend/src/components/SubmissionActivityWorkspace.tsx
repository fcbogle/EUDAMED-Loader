import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { SubmissionActivity, SubmissionActivityReport } from "../submissionActivityTypes";

function date(value: string | null) {
  if (!value) return "Not recorded";
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return `${value} (timezone unresolved)`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? `${value} (unresolved)` : `${parsed.toLocaleString("en-GB", {timeZone:"UTC"})} UTC`;
}
function save(blob: Blob, name: string) {
  const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function SubmissionActivityWorkspace({environment,enabled}: {environment:"dev"|"prod"|null;enabled:boolean}) {
  const [report,setReport]=useState<SubmissionActivityReport|null>(null);
  const [model,setModel]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [includeEntities,setIncludeEntities]=useState(false);
  const [offset,setOffset]=useState(0);
  const request=useRef(0);
  useEffect(()=>{request.current++;setReport(null);setError("");setBusy(false);setOffset(0);setModel("");return()=>{request.current++;};},[environment,enabled]);
  async function generate() {
    const token=++request.current;setBusy(true);setReport(null);setError("");setOffset(0);setModel("");
    try {const result=await api.submissionActivityReport({include_device_details:includeEntities});
      if(token!==request.current)return;
      if(result.environment!==environment)throw Error("Report environment changed. Refresh and generate again.");
      setReport(result);
    } catch(reason){if(token===request.current)setError(reason instanceof Error?reason.message:"Activity could not be read");}
    finally {if(token===request.current)setBusy(false);}
  }
  async function response(eventId:number) {
    const token=request.current;
    try {const download=await api.submissionActivityResponse(eventId);if(token===request.current)save(download.blob,download.fileName||`retained-response-${eventId}.xml`);}
    catch(reason){if(token===request.current)setError(reason instanceof Error?reason.message:"Response unavailable");}
  }
  if(!enabled)return null;
  if(environment!=="dev")return <section className="panel"><h2>Submission Activity</h2><p>This first report iteration is available in Dev / Playground.</p></section>;
  const selected=report?.models.find(row=>row.key===model);
  const rows=report?.activities.filter(row=>!model||row.model_key===model)??[];
  const latestIds=new Set((selected?[selected]:report?.models??[]).map(row=>row.latest_activity?.id));
  function select(key:string){setModel(key);setOffset(0);}
  function excel(){if(report)save(new Blob([Uint8Array.from(atob(report.excel_base64),c=>c.charCodeAt(0))],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"submission-activity.xlsx");}
  return <section className="tab-stack" aria-label="Submission Activity report">
    <section className="panel"><h2>Submission Activity</h2>
      <p>Recorded ZIP downloads and EUDAMED response history by model. The actual portal upload timestamp is not recorded.</p>
      <p className="panel-copy">ZIP generator, Success XML importer and application response-import time are not recorded. ZIPs and message batches remain separate where no direct association exists.</p>
      <label><input type="checkbox" checked={includeEntities} onChange={e=>{request.current++;setReport(null);setBusy(false);setIncludeEntities(e.target.checked);}}/> Include individual entity outcomes in Excel</label>
      <div className="import-action-row"><button type="button" className="action-button" disabled={busy} onClick={()=>{void generate();}}>{busy?"Reading activity…":"Generate report"}</button></div>
      {error&&<p role="alert">{error}</p>}
    </section>
    {report&&<>
      <section className="panel"><div className="section-heading"><h2>Models</h2><button type="button" className="ghost-button" onClick={excel}>Download full report Excel</button></div>
        <p>Dev / Playground · Generated {date(report.generated_at)}. Latest means latest usable recorded timestamp, not portal upload time.</p>
        <div className="import-exception-table"><table><thead><tr><th>Model</th><th>Latest recorded activity</th><th>Activity type</th><th>Latest ZIP download</th><th>Latest EUDAMED response</th><th>ZIP records</th><th>Message batches</th><th>Unlinked responses</th></tr></thead><tbody>
          {report.models.map(row=><tr key={row.key}><td><a href="#submission-activity-history" aria-label={`${row.model} · ${row.family} history`} onClick={()=>select(row.key)}>{row.model}</a></td><td>{date(row.latest_activity?.activity_at??null)}{row.unordered_records>0&&<p>{row.unordered_records} records with unresolved timestamps</p>}</td><td>{row.latest_activity?.kind||"No recorded activity"}</td><td>{date(row.latest_zip_downloaded_at)}</td><td>{date(row.latest_response_at)}</td><td>{row.zip_records}</td><td>{row.message_batches}</td><td>{row.unlinked_responses}</td></tr>)}
        </tbody></table></div>
        {!report.models.length&&<p>No model activity is recorded in this database.</p>}
      </section>
      <section className="panel" id="submission-activity-history" tabIndex={-1} aria-labelledby="submission-activity-title"><h2 id="submission-activity-title">{selected?`${selected.model} · ${selected.family} — activity history`:"All models — activity history"}</h2>
        {selected&&<p><a href="#submission-activity-history" onClick={()=>select("")}>View history for all models</a></p>}
        <p>Includes the latest record shown above and previous records. Ordered newest first where timestamps are usable. ZIP records and message batches are not counts of separate portal uploads.</p>
        <div className="import-exception-table"><table><thead><tr><th>Recorded time (UTC)</th><th>Record type</th><th>Operation</th><th>ZIP / batch reference</th><th>Successful entities</th><th>Failed entities</th><th>Pending entities</th><th>Outcome / evidence</th></tr></thead><tbody>
          {rows.slice(offset,offset+25).map(row=><tr key={row.id}><td>{date(row.activity_at)}{latestIds.has(row.id)&&<strong> · Latest recorded activity</strong>}</td><td>{row.kind}</td><td>{row.operation||"Not recorded"}</td><td>{row.reference||"Not recorded"}</td><td>{row.id.startsWith("zip:")?"—":row.success}</td><td>{row.id.startsWith("zip:")?"—":row.error}</td><td>{row.id.startsWith("zip:")?"—":row.pending}</td><td>{row.outcome}<ActivityEvidence row={row} onResponse={response}/></td></tr>)}
        </tbody></table></div>
        {!rows.length&&<p>No activity records for this model.</p>}
        <p>{rows.length} records · showing {rows.length?offset+1:0}–{Math.min(offset+25,rows.length)}</p>
        <button type="button" className="ghost-button" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous activity</button><button type="button" className="ghost-button" disabled={offset+25>=rows.length} onClick={()=>setOffset(offset+25)}>Next activity</button>
      </section>
      <section className="panel"><h2>Report scope</h2><ul>{report.limitations.map(note=><li key={note}>{note}</li>)}</ul></section>
    </>}
  </section>;
}
function ActivityEvidence({row,onResponse}:{row:SubmissionActivity;onResponse:(id:number)=>Promise<void>}) {
  return <details><summary>View record evidence</summary>
    <p>Generated: {date(row.generated_at)} · ZIP downloaded: {date(row.zip_downloaded_at)} · EUDAMED response: {date(row.response_at)}</p>
    <p>ZIP generated by: Not recorded · Success XML imported by: Not recorded · Success XML application import time: Not recorded</p>
    <p>ZIP SHA-256: {row.package_sha256||"Not recorded"} · Unknown entity outcomes: {row.unknown}</p>
    {row.notes.map(note=><p key={note}>{note}</p>)}
    {row.responses.map(reference=><div key={reference.event_id}><p>{reference.file_name||"Response filename not recorded"} · Response dated {date(reference.response_at)} · Message {reference.message_id||"Not recorded"} · Correlation {reference.correlation_id||"Not recorded"} · Transaction {reference.transaction_id||"Not recorded"} · Submission {reference.submission_id||"Not recorded"}</p>{reference.xml_available?<button type="button" className="ghost-button" onClick={()=>{void onResponse(reference.event_id);}}>Download retained response XML</button>:<p>Original response XML unavailable</p>}</div>)}
    {row.entities.length>0&&<EntityOutcomes row={row}/>}

  </details>;
}

function EntityOutcomes({row}:{row:SubmissionActivity}) {
  const [open,setOpen]=useState(false);
  const [offset,setOffset]=useState(0);
  return <details onToggle={event=>{setOpen(event.currentTarget.open);if(!event.currentTarget.open)setOffset(0);}}><summary>View individual entity outcomes ({row.entities.length})</summary>
    {open&&<><div className="import-exception-table"><table><thead><tr><th>Catalogue</th><th>Device UDI-DI</th><th>Entity kind</th><th>Outcome</th></tr></thead><tbody>{row.entities.slice(offset,offset+25).map((entity,index)=><tr key={index}><td>{entity.catalogue||"Not recorded"}</td><td>{entity.udi_di||"Not recorded"}</td><td>{entity.kind}</td><td>{entity.status}</td></tr>)}</tbody></table></div>
    <p>{row.entities.length} entities · showing {row.entities.length?offset+1:0}–{Math.min(offset+25,row.entities.length)}</p>
    <button type="button" className="ghost-button" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous entities</button><button type="button" className="ghost-button" disabled={offset+25>=row.entities.length} onClick={()=>setOffset(offset+25)}>Next entities</button></>}
  </details>;
}
