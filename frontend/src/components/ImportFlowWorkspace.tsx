import { useEffect, useRef, useState, type MouseEvent } from "react";
import { api } from "../api";
import type { ImportSession, ImportMetadata, ImportChoice, ImportSources, ImportFlowContext } from "../importFlowTypes";
const blank: ImportMetadata = { creator: { name: "", email: "", team_role: "" }, description: "", source_date: null, export_date: null };
const emptyFiles = (): ImportSources => ({ templates: [], basic: [], xml: [] });
const memoryKey = "eudamed-dev-current-import";
function remember(id: string, key = memoryKey) { try {
    localStorage.setItem(key, id);
}
catch { /* Saved server copies remain resumable. */ } }
function remembered(key = memoryKey) { try {
    return localStorage.getItem(key);
}
catch {
    return null;
} }
function sourceValue(value: unknown, source: "previous" | "new") {
    return value == null || (typeof value === "string" && !value.trim())
        ? `Not present in ${source} source` : String(value);
}
export function ImportFlowWorkspace({ enabled, onContextChange, onDatabaseImported, view = "data", onViewHistory }: {
    enabled: boolean;
    onContextChange?: (context: ImportFlowContext) => void;
    onDatabaseImported?: () => void;
    view?: "data" | "history";
    onViewHistory?: () => void;
}) {
    const [choices, setChoices] = useState<ImportChoice[]>([]), [session, setSession] = useState<ImportSession | null>(null);
    const [metadata, setMetadata] = useState<ImportMetadata>(blank), [files, setFiles] = useState<ImportSources>(emptyFiles);
    const [removed, setRemoved] = useState<string[]>([]), [editing, setEditing] = useState(false), [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(""), [error, setError] = useState<string | null>(null), [saveState, setSaveState] = useState("");
    const [informationExamplesOpen, setInformationExamplesOpen] = useState<Record<string, boolean>>({});
    const [confirmed, setConfirmed] = useState(false), [importer, setImporter] = useState("");
    const current = useRef<ImportSession | null>(null), generation = useRef(0), request = useRef(0), saving = useRef<Promise<ImportSession> | null>(null), working = useRef(false), loaded = useRef(false), mounted = useRef(true);
    const reviewPill = !session?.review?.can_create
        ? {tone: "danger", label: "Showstopper"}
        : session.review.groups.some(group => group.severity === "warn")
            ? {tone: "warn", label: "Warning"}
            : {tone: "ok", label: session.review.groups.some(group => group.severity === "info") ? "Information" : "Good data"};
    const stage = editing ? "review" : session?.stage ?? "review";
    const history = view === "history";
    const selectionMemoryKey = history ? `${memoryKey}-history` : memoryKey;
    const completed = session?.stage === "complete";
    const visibleChoices = choices.filter(item => history ? item.status === "complete" : item.status !== "complete");
    const status = busy || (dirty ? "Saving changes" : session?.review?.message) || "Select source files";
    useEffect(() => { onContextChange?.({ batchId: session?.batch_id ?? "", status: stage === "complete" ? "Import completed" : status }); }, [session?.batch_id, stage, status, onContextChange]);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; loaded.current = false; }; }, []);
    function apply(value: ImportSession) { setInformationExamplesOpen({}); current.current = value; setSession(value); setMetadata(value.metadata); setFiles(emptyFiles()); setRemoved([]); setDirty(false); setEditing(false); setConfirmed(false); setImporter([value.metadata.creator.name, value.metadata.creator.email].filter(Boolean).join(" · ")); remember(value.id, selectionMemoryKey); setChoices(previous => [{ id: value.id, description: value.metadata.description || "Current import", status: value.stage }, ...previous.filter(item => item.id !== value.id)]); }
    async function choose(id: string) { const token = ++request.current; generation.current++; setError(null); setConfirmed(false); current.current = null; setSession(null); setDirty(false); setFiles(emptyFiles()); setRemoved([]); setMetadata(blank); setEditing(false); setSaveState(""); if (!id) {
        remember("", selectionMemoryKey);
        return;
    } setBusy("Opening saved import…"); try {
        const value = await api.importSession(id);
        if (mounted.current && request.current === token)
            apply(value);
    }
    catch (reason) {
        if (mounted.current && request.current === token)
            setError(reason instanceof Error ? reason.message : "Saved import could not be opened.");
    }
    finally {
        if (mounted.current && request.current === token)
            setBusy("");
    } }
    useEffect(() => { if (!enabled || loaded.current)
        return; loaded.current = true; const token = ++request.current; void api.importSessions().then(result => { if (!mounted.current || token !== request.current)
        return; setChoices(result.imports); const id = remembered(selectionMemoryKey); if (id && result.imports.some(item => item.id === id))
        void choose(id); }).catch(reason => { if (mounted.current && token === request.current)
        setError(String(reason)); }); }, [enabled]);
    useEffect(() => {
        if (!enabled || !history || busy || dirty || saving.current || completed) return;
        const first = choices.find(item => item.status === "complete");
        if (first) void choose(first.id);
    }, [enabled, history, choices, completed, dirty]);
    function changed() { generation.current++; setDirty(true); setSaveState("Unsaved changes"); setError(null); }
    async function save(): Promise<ImportSession> { if (saving.current)
        await saving.current; const snapshot = generation.current, token = request.current; const action = api.saveImportSession(current.current?.id ?? "new", current.current?.revision ?? undefined, metadata, files, removed); saving.current = action; try {
        const value = await action;
        if (mounted.current && token === request.current) {
            current.current = value;
            remember(value.id, selectionMemoryKey);
            setSession(value);
            if (snapshot === generation.current) {
                setFiles(emptyFiles());
                setRemoved([]);
                setDirty(false);
                setSaveState("Saved automatically");
            }
            setChoices(previous => [{ id: value.id, description: value.metadata.description || "Current import", status: value.stage }, ...previous.filter(item => item.id !== value.id)]);
        }
        return value;
    }
    finally {
        if (saving.current === action)
            saving.current = null;
    } }
    useEffect(() => { if (!dirty || busy)
        return; const timer = window.setTimeout(() => { setSaveState("Saving…"); void save().catch(reason => { if (mounted.current) {
        setSaveState("Changes not saved");
        setError(reason instanceof Error ? reason.message : "Could not save. Review source data to retry.");
    } }); }, 750); return () => window.clearTimeout(timer); }, [metadata, files, removed, dirty, busy, session?.revision]);
    async function primary() { if (working.current)
        return; working.current = true; const token = request.current; setError(null); setBusy(stage === "review" ? "Reviewing source data…" : stage === "workbook" ? "Creating Import Workbook…" : "Importing batch data…"); try {
        let value = current.current;
        if (stage === "review") {
            if (dirty || !value?.revision)
                value = await save();
            if (!value?.revision)
                throw Error("Source files have not been saved.");
            value = await api.reviewImportSession(value.id, value.revision);
        }
        else if (stage === "workbook" && value?.revision)
            value = await api.createImportWorkbook(value.id, value.revision);
        else if (stage === "import" && value?.revision)
            value = await api.importBatchData(value.id, value.revision, importer.trim(), confirmed);
        if (value && mounted.current && token === request.current) {
            apply(value);
            if (value.stage === "complete")
                onDatabaseImported?.();
        }
    }
    catch (reason) {
        if (mounted.current && token === request.current)
            setError(reason instanceof Error ? reason.message : "The import could not continue.");
    }
    finally {
        working.current = false;
        if (mounted.current && token === request.current)
            setBusy("");
    } }
    function replaceFiles() { if (session?.batch_id) {
        const value = { ...session, id: session.batch_id, revision: null, batch_id: null, stage: "review" as const, workbook: null, result: null, review: null };
        current.current = value;
        setSession(value);
    } setEditing(true); setConfirmed(false); }
    async function download(event: MouseEvent<HTMLAnchorElement>, findings = false) { event.preventDefault(); if (!session)
        return; try {
        const file = findings ? await api.downloadImportFindings(session.id) : await api.downloadImportWorkbook(session.id), url = URL.createObjectURL(file.blob), anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.fileName ?? session.workbook?.workbook_name ?? "source-findings.xlsx";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    catch (reason) {
        setError(reason instanceof Error ? reason.message : "Workbook download failed.");
    } }
    function receipt() {
        const result = session?.result;
        if (!result) return null;
        return <section aria-label="Completed import receipt">
            <h3>Import completed</h3>
            <p><strong>Import #{result.import_batch_id}</strong> · {new Date(result.confirmed_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</p>
            <p>Imported by {result.confirmed_by}</p>
            <p>{result.created_count} new devices · {result.existing_retained_count + result.omitted_retained_count} existing devices retained.</p>
            <p className="panel-copy">Registration history retained. Current data-quality issues and XML readiness are available in Canonical Validation.</p>
        </section>;
    }
    if (!history && completed) return <section className="panel import-flow" aria-label="Import data">
        {receipt()}
        <div className="import-action-row">
            <button type="button" className="ghost-button" onClick={() => void choose("")}>Start new import</button>
            <button type="button" className="ghost-button" onClick={onViewHistory}>View import history</button>
        </div>
    </section>;
    return <section className="panel import-flow" aria-label={history ? "Import history" : "Import data"}>
 <label className="import-batch-selector">{history ? "Completed import" : "Import"}<select value={history && !completed ? "" : session?.id ?? ""} disabled={Boolean(busy) || dirty || Boolean(saving.current)} onChange={event => void choose(event.target.value)}><option value="">{history ? "Select completed import" : "New import"}</option>{visibleChoices.map(item => <option key={item.id} value={item.id}>{item.description} · {item.status}</option>)}</select></label>
 {!history && <ol className="import-flow-stages" aria-label="Import progress">{["Review source data", "Create Import Workbook", "Import Batch Data"].map((title, index) => <li key={title} aria-current={(stage === "review" ? 0 : stage === "workbook" ? 1 : 2) === index ? "step" : undefined}>{index + 1}. {title}</li>)}</ol>}
 {error ? <p role="alert" className="error-banner">{error}</p> : null}
 {history && !completed && <p role="status">{busy || (visibleChoices.length ? "Select a completed import to view its audit evidence." : "No completed imports recorded.")}</p>}
 {history && completed && <>{receipt()}<details><summary>Source files and import details</summary><p>{session.metadata.description}</p><p>Source batch: {session.batch_id}</p><p>Workbook source date: {session.metadata.source_date || "Not recorded"} · XML export date: {session.metadata.export_date || "Not recorded"}</p><ul>{session.files.map(file => <li key={file.path}>{file.original_name || file.path}{file.excluded ? " · excluded from import" : ""}</li>)}</ul><p>Backup: {session.result?.backup.path}</p></details></>}
 {!history && stage === "review" ? <fieldset className="source-batch-fields" disabled={Boolean(busy)}><legend>Source files</legend><div className="import-source-grid">{([
                { key: "templates", role: "templates", title: "Template workbooks", accept: ".xlsx", multiple: true }, { key: "basic", role: "basic-udi", title: "BasicUDI workbook", accept: ".xlsx", multiple: false }, { key: "xml", role: "eudamed-xml", title: "EUDAMED XML extracts", accept: ".xml", multiple: true },
            ] as const).map(group => <div className="import-source-field" key={group.key}><label><strong>{group.title}</strong><input key={`${session?.revision ?? "new"}-${group.key}`} type="file" accept={group.accept} multiple={group.multiple} onChange={event => { setFiles(previous => ({ ...previous, [group.key]: Array.from(event.target.files ?? []) })); changed(); }}/></label>{files[group.key].length ? <p>{files[group.key].map(file => file.name).join(", ")}</p> : null}<ul className="import-selected-files">{session?.files.filter(file => file.role === group.role).map(file => <li key={file.path}><label><input type="checkbox" checked={!removed.includes(file.path)} onChange={event => { setRemoved(previous => event.target.checked ? previous.filter(path => path !== file.path) : [...previous, file.path]); changed(); }}/>{file.original_name ?? file.path.split("/").pop()}{file.excluded ? " · retained evidence, excluded from import" : ""}</label></li>)}</ul>{group.key === "xml" ? <small>Select all export pages. Replacement XMLs replace the saved page set.</small> : null}</div>)}</div>
 <div className="source-batch-details source-batch-details--source-review">{([{ key: "description", label: "Batch description", type: "text" }, { key: "source_date", label: "Workbook source date (if known)", type: "date" }, { key: "export_date", label: "XML export date (if known)", type: "date" }] as const).map(field => <label key={field.key}>{field.label}<input type={field.type} value={metadata[field.key] ?? ""} maxLength={field.key === "description" ? 2000 : undefined} onChange={event => { setMetadata(previous => ({ ...previous, [field.key]: field.key === "description" ? event.target.value : event.target.value || null })); changed(); }}/></label>)}{([{ key: "name", label: "Your name", type: "text" }, { key: "email", label: "Your work email", type: "email" }, { key: "team_role", label: "Team / role", type: "text" }] as const).map(field => <label key={field.key}>{field.label}<input type={field.type} maxLength={200} value={metadata.creator[field.key]} onChange={event => { setMetadata(previous => ({ ...previous, creator: { ...previous.creator, [field.key]: event.target.value } })); changed(); }}/></label>)}</div>
 <p className="panel-copy" role="status">{saveState || "Progress is saved automatically. Files can come from different folders."}</p></fieldset> : null}
 {session?.review && !dirty && (!history || completed) ? <section className="import-flow-review" aria-label={history ? "Historical source review" : "Source review"}>
   {history ? <><h3>Source review at import</h3><p className="panel-copy">Historical findings retained for audit. These describe the source review at the time of import; use Canonical Validation for current data quality.</p></> : <div className="import-review-heading"><h3>{session.review.message}</h3><span className={`status-pill compact ${reviewPill.tone}`}>{reviewPill.label}</span></div>}
   {session.review.groups.map(group => <details key={`${group.code}-${group.source}`}>
     <summary>{group.source}: {group.title} · {group.count}{group.severity === "info" ? " device entries" : ""}<span className={`status-pill compact ${group.severity === "block" ? "danger" : group.severity === "info" ? "ok" : "warn"}`}>{group.severity === "block" ? "Showstopper" : group.severity === "info" ? "Information" : "Warning"}</span></summary>
     <p>{group.action}</p>
     {group.severity === "info" ? <>
       <ul aria-label="Models with additional source information">{group.models?.map(model => <li key={`${model.product_family}:${model.product_variant}`}>{model.product_variant}: {model.device_count} device entries</li>)}</ul>
       <details onToggle={event => { const open = event.currentTarget.open; setInformationExamplesOpen(previous => ({ ...previous, [group.code]: open })); }}><summary>View affected device examples</summary>{informationExamplesOpen[group.code] ? <ul>{group.records.map((record, index) => <li key={index}>{[record.product_variant, record.catalogue, record.file, record.sheet, record.row ? (record.file?.toLowerCase().endsWith(".xml") ? `Device ${record.row} in XML` : `Row ${record.row}`) : "", record.identifier ?? record.udi_di, record.detail].filter(Boolean).join(" · ")}{record.locations?.length ? <ul>{record.locations.map((location, index) => <li key={index}>{[location.file, location.sheet, location.row ? `Row ${location.row}` : "", location.identifier].filter(Boolean).join(" · ")}</li>)}</ul> : null}{record.fields ? <ul>{record.fields.slice(0, 5).map(field => <li key={field.field}>{field.field}: {sourceValue(field.before, "previous")} → {sourceValue(field.after, "new")}</li>)}</ul> : null}</li>)}</ul> : null}
         {informationExamplesOpen[group.code] && group.truncated ? <p>Showing the first {group.records.length} examples. Download full source findings for all entries.</p> : null}
       </details>
     </> : <><ul>{group.records.map((record, index) => <li key={index}>{[record.product_variant, record.catalogue, record.file, record.sheet, record.row ? (record.file?.toLowerCase().endsWith(".xml") ? `Device ${record.row} in XML` : `Row ${record.row}`) : "", record.identifier ?? record.udi_di, record.detail].filter(Boolean).join(" · ")}{record.locations?.length ? <ul>{record.locations.map((location, index) => <li key={index}>{[location.file, location.sheet, location.row ? `Row ${location.row}` : "", location.identifier].filter(Boolean).join(" · ")}</li>)}</ul> : null}{record.fields ? <ul>{record.fields.slice(0, 5).map(field => <li key={field.field}>{field.field}: {sourceValue(field.before, "previous")} → {sourceValue(field.after, "new")}</li>)}</ul> : null}</li>)}</ul>{group.truncated ? <p>Showing the first {group.records.length} examples.</p> : null}</>}
   </details>)}
   {history || session.review.groups.some(group => group.truncated) ? <a href="#findings" onClick={event => void download(event, true)}>Download full source findings</a> : null}
 </section> : null}
 {!history && <>
 {stage === "workbook" ? <p className="panel-copy">Create the batch and its Import Workbook from these reviewed source copies. Warnings do not prevent continuing.</p> : null}
 {stage === "import" ? <><p className="panel-copy">Batch {session?.batch_id} · Dev / Playground</p><p>{session?.summary?.new_count ?? 0} new devices · {(session?.summary?.existing_retained_count ?? 0) + (session?.summary?.omitted_retained_count ?? 0)} existing devices retained.</p><p className="panel-copy">A verified backup is created automatically. Existing accepted registration history is retained.</p><label className="source-batch-correction-note">Importer name and work email<input value={importer} disabled={Boolean(busy)} onChange={event => setImporter(event.target.value)}/></label><label className="source-batch-confirmation"><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={event => setConfirmed(event.target.checked)}/>I confirm import into the Dev database.</label></> : null}
 <div className="import-action-row"><button className="action-button" type="button" disabled={Boolean(busy) || (stage === "import" && (!confirmed || !importer.trim()))} onClick={() => void primary()}>{busy || (stage === "review" ? "Review source data" : stage === "workbook" ? "Create Import Workbook" : "Import Batch Data")}</button></div>
 </>}
 <div className="import-flow-links">{session?.workbook && (!history || completed) ? <a href="#workbook" onClick={event => void download(event)}>Download workbook (optional)</a> : null}{!history && stage !== "review" && stage !== "complete" && !busy ? <a href="#sources" onClick={event => { event.preventDefault(); replaceFiles(); }}>{stage === "import" && error ? "Review source data again" : "Replace files"}</a> : null}</div>
 </section>;
}
