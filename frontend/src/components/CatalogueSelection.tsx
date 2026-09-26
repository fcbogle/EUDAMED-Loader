import { useEffect, useId, useRef, useState } from "react";

type Entry = {
  catalogue_number: string | null;
  primary_udi_di: string | null;
  detail?: string;
};

type Props = {
  label: string;
  entries: Entry[];
  selected: string[];
  onApply: (selected: string[]) => void;
};

export function CatalogueSelection({ label, entries, selected, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const available = new Set(entries.map(entry => entry.catalogue_number).filter(Boolean));
  const committed = selected.filter(value => available.has(value));
  const current = draft.filter(value => available.has(value));
  const query = search.trim().toLowerCase();
  const visible = entries.filter(entry => entry.catalogue_number &&
    (!selectedOnly || current.includes(entry.catalogue_number)) &&
    (!query || entry.catalogue_number.toLowerCase().includes(query) ||
      entry.primary_udi_di?.toLowerCase().includes(query)));

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previous;
    };
  }, [open]);

  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }

  return <div className="catalogue-selection">
    <span>{committed.length} devices selected</span>
    <button type="button" className="ghost-button" ref={trigger} onClick={() => {
      setDraft([...committed]);
      setSearch("");
      setSelectedOnly(false);
      setOpen(true);
    }}>{committed.length ? "Edit selection" : "Select devices"}</button>
    {open && <dialog ref={dialog} className="catalogue-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); close(); }}>
      <div className="catalogue-dialog-header">
        <h2 id={titleId}>Select catalogue numbers — {label}</h2>
        <button type="button" className="ghost-button" aria-label="Cancel selection" onClick={close}>×</button>
      </div>
      <label className="catalogue-search">Search catalogue number or Device UDI-DI
        <input autoFocus type="search" className="rule-select" value={search}
          onChange={event => setSearch(event.target.value)} />
      </label>
      <label className="catalogue-selected-only"><input type="checkbox" checked={selectedOnly}
        onChange={event => setSelectedOnly(event.target.checked)} /> Show selected only</label>
      <div className="catalogue-dialog-list">
        {visible.length ? visible.map((entry, index) => <label className="catalogue-dialog-row"
          key={`${entry.catalogue_number}-${index}`}>
          <input type="checkbox" checked={current.includes(entry.catalogue_number!)} onChange={() => {
            const value = entry.catalogue_number!;
            setDraft(values => values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
          }} />
          <span><strong>{entry.catalogue_number}</strong><span>{entry.primary_udi_di || "Device UDI-DI unavailable"}</span>
            {entry.detail && <small>{entry.detail}</small>}</span>
        </label>) : <p role="status">{entries.length ? "No devices match these filters." : "No devices available in this scope."}</p>}
      </div>
      <div className="catalogue-dialog-footer">
        <span role="status">{current.length} selected · {visible.length} shown</span>
        <button type="button" className="ghost-button" onClick={() => setDraft([])}>Clear selection</button>
        <div className="catalogue-dialog-actions">
          <button type="button" className="ghost-button" onClick={close}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => { onApply(current); close(); }}>Apply selection</button>
        </div>
      </div>
    </dialog>}
  </div>;
}
