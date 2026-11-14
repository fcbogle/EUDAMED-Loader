import { useId, useState } from "react";
import { scopePatchDevices, searchPatchDevices, type PatchDeviceSearchOption } from "../patchDeviceSearch";

export function PatchDeviceSearch({ options, environment, selectedKey, onSelect, family, variant, enabled = true }: {
  options: PatchDeviceSearchOption[];
  environment: "dev" | "prod" | null;
  selectedKey: string | null;
  onSelect: (option: PatchDeviceSearchOption) => void;
  family: string | null;
  variant: string | null;
  enabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const scoped = scopePatchDevices(options, family, variant);
  const canSearch = enabled && Boolean(family && variant) && environment !== null;
  const { total, results } = searchPatchDevices(canSearch ? scoped : [], query);
  const searching = query.trim().length >= 2;
  const selected = scoped.find(option => option.key === selectedKey);
  return <section className="device-model-selector patch-device-search" aria-label="Find device for PATCH">
    <h3>Find device for PATCH</h3>
    <p className="panel-copy">{family && variant ? `Search within ${variant} · ${family}` : "Select a model first"} in {environment === "prod" ? "Production" : environment === "dev" ? "Dev / Playground" : "the current environment"}. Selecting a device checks its accepted baseline and PATCH eligibility.</p>
    <label className="field-label" htmlFor={id}>Device UDI-DI or catalogue number</label>
    <div className="patch-device-search-controls">
      <input id={id} type="search" className="rule-input" value={query} disabled={!canSearch}
        placeholder="Enter Device UDI-DI or catalogue number" aria-controls={`${id}-results`} aria-describedby={`${id}-status`}
        onChange={event => setQuery(event.target.value)} />
      <button type="button" className="ghost-button" disabled={!query} onClick={() => setQuery("")}>Clear device search</button>
    </div>
    <p id={`${id}-status`} role="status">{!canSearch ? "Select the model and PATCH scenario before searching for a device." : !searching ? "Enter at least 2 characters to find a device."
      : total ? `${total} matching devices${total > results.length ? `; showing the first ${results.length}. Keep typing to narrow the results.` : "."}`
        : "No matching device in the selected model for this environment."}</p>
    {selectedKey && <p className="xml-scope-selected">{selected && !selected.blockedReason
      ? <>Selected for PATCH: <strong>{selected.record.product_variant} · {selected.record.catalogue_number} · {selected.record.issuing_entity}: {selected.record.primary_udi_di}</strong></>
      : "The selected device is no longer available for PATCH. Search and select again."}</p>}
    <div className="device-model-results" id={`${id}-results`}>
      {results.length > 0 && <table className="device-model-table">
        <caption className="visually-hidden">Matching devices for PATCH</caption>
        <thead><tr><th>Model / family</th><th>Catalogue number</th><th>Device UDI-DI</th><th>Selection</th></tr></thead>
        <tbody>{results.map(option => <tr key={option.key} className={option.key === selectedKey ? "selected-table-row" : ""}>
          <td>{option.record.product_variant} · {option.record.product_family}</td>
          <td>{option.record.catalogue_number ?? "Unavailable"}</td>
          <td><code>{option.record.issuing_entity ?? "Issuer unavailable"}: {option.record.primary_udi_di ?? "Unavailable"}</code></td>
          <td><button type="button" className="ghost-button" disabled={Boolean(option.blockedReason) || !canSearch}
            aria-pressed={option.key === selectedKey}
            aria-label={`Select ${option.record.catalogue_number ?? "device"}, ${option.record.primary_udi_di ?? "UDI-DI unavailable"}, ${option.record.product_variant}, ${option.record.product_family} for PATCH`}
            onClick={() => onSelect(option)}>Select for PATCH</button>
            {option.blockedReason && <p className="panel-copy">{option.blockedReason}</p>}</td>
        </tr>)}</tbody>
      </table>}
    </div>
  </section>;
}
