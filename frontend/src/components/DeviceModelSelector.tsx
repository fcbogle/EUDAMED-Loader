import { useId, useState } from "react";

export type DeviceModelOption = {
  family: string;
  variant: string;
  basicUdiDis: string[];
  total: number;
  ready: number;
  blocked: number;
};

export function DeviceModelSelector({ options, selectedFamily, selectedVariant, onSelect }: {
  options: DeviceModelOption[];
  selectedFamily: string | null;
  selectedVariant: string | null;
  onSelect: (family: string, variant: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const id = useId();
  const families = [...new Set(options.map(o => o.family))].sort();
  const filter = families.includes(familyFilter) ? familyFilter : "";
  const search = query.trim().toLocaleLowerCase();
  const visible = options.filter(o => (!filter || o.family === filter) &&
    [o.family, o.variant, ...o.basicUdiDis].some(v => v.toLocaleLowerCase().includes(search)));
  const selected = options.find(o => o.family === selectedFamily && o.variant === selectedVariant);
  return (
    <section className="panel device-model-selector">
      <div className="section-heading"><h2>Select Device Model</h2></div>
      <p className="xml-scope-selected"><strong>Selected model:</strong> {selected
        ? `${selected.variant} · ${selected.family} · ${selected.basicUdiDis.join(", ") || "Basic UDI-DI unavailable"}`
        : "None selected"}</p>
      <div className="device-model-filters">
        <div>
          <label className="field-label" htmlFor={`${id}-search`}>Search model, family or Basic UDI-DI</label>
          <input id={`${id}-search`} className="rule-input" type="search" value={query}
            placeholder="Model name, family or Basic UDI-DI" aria-controls={`${id}-results`}
            onChange={event => setQuery(event.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor={`${id}-family`}>Family (optional)</label>
          <select id={`${id}-family`} className="rule-select" value={filter} onChange={event => setFamilyFilter(event.target.value)}>
            <option value="">All families</option>
            {families.map(family => <option key={family} value={family}>{family}</option>)}
          </select>
        </div>
        <button type="button" className="ghost-button" disabled={!query && !filter}
          onClick={() => { setQuery(""); setFamilyFilter(""); }}>Clear filters</button>
      </div>
      <p className="xml-scope-count" role="status">{visible.length} of {options.length} models shown</p>
      <div className="device-model-results" id={`${id}-results`}>
        <table className="device-model-table">
          <thead><tr><th>Model</th><th>Family</th><th>Basic UDI-DI</th><th>Devices</th><th>XML ready / blocked</th></tr></thead>
          <tbody>{visible.map(option => {
            const active = option.family === selectedFamily && option.variant === selectedVariant;
            return <tr key={JSON.stringify([option.family, option.variant])} className={active ? "selected-table-row" : ""}
              onClick={() => onSelect(option.family, option.variant)}>
              <td><button type="button" className="table-select-button" aria-pressed={active}
                aria-label={`Select ${option.variant}, family ${option.family}`}
                onClick={event => { event.stopPropagation(); onSelect(option.family, option.variant); }}>
                {option.variant}{active ? " ✓" : ""}</button></td>
              <td>{option.family}</td><td>{option.basicUdiDis.join(", ") || "Unavailable"}</td>
              <td>{option.total.toLocaleString()}</td><td>{option.ready.toLocaleString()} / {option.blocked.toLocaleString()}</td>
            </tr>;
          })}</tbody>
        </table>
        {!visible.length && <p className="panel-copy">{options.length ? "No matching models. Clear the filters to see all models." : "No models are available in the imported data."}</p>}
      </div>
    </section>
  );
}
