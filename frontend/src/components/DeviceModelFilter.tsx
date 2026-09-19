import { useId, useState } from "react";

export type ModelFilterOption = { family: string; variant: string; basicUdiDis: string[] };
export function mergeModelOptions(options: ModelFilterOption[]): ModelFilterOption[] {
  const unique = new Map<string, ModelFilterOption>();
  for (const option of options) {
    if (!option.family || !option.variant) continue;
    const key = JSON.stringify([option.family, option.variant]);
    const existing = unique.get(key);
    unique.set(key, { ...option, basicUdiDis: [...new Set([...(existing?.basicUdiDis ?? []), ...option.basicUdiDis])].sort() });
  }
  return [...unique.values()].sort((a, b) => a.variant.localeCompare(b.variant) || a.family.localeCompare(b.family));
}

export function DeviceModelFilter({ options, family, variant, onChange, onSearchChange, searchQuery }: {
  options: ModelFilterOption[]; family: string; variant: string;
  onChange: (family: string, variant: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}) {
  const id = useId();
  const [localQuery, setQuery] = useState("");
  const query = searchQuery ?? localQuery;
  const search = query.trim().toLocaleLowerCase();
  const all = mergeModelOptions(options);
  const key = (o: ModelFilterOption) => JSON.stringify([o.family, o.variant]);
  const value = family || variant ? JSON.stringify([family, variant]) : "";
  const selected = all.find(o => key(o) === value);
  const matches = all.filter(o => [o.family, o.variant, ...o.basicUdiDis].some(v => v.toLocaleLowerCase().includes(search)));
  const choices = selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  return <div className="device-model-filter">
    <label className="read-model-filter-control" htmlFor={`${id}-search`}>
      <span>Search device models</span>
      <input id={`${id}-search`} type="search" placeholder="Model, family or Basic UDI-DI" value={query} onChange={e => { setQuery(e.target.value); onSearchChange?.(e.target.value); }} />
    </label>
    <label className="read-model-filter-control" htmlFor={`${id}-model`}>
      <span>Device Model</span>
      <select id={`${id}-model`} className="rule-select" value={value} onChange={e => {
        const chosen = all.find(o => key(o) === e.target.value);
        if (chosen) onChange(chosen.family, chosen.variant);
        else if (!e.target.value) onChange("", "");
        setQuery("");
        onSearchChange?.("");
      }}>
        <option value="">All models</option>
        {value && !selected && <option value={value}>{variant || "All models"} · {family || "All families"} (current scope)</option>}
        {choices.map(o => <option key={key(o)} value={key(o)}>{o.variant} · {o.family}{o.basicUdiDis.length ? ` · ${o.basicUdiDis.join(", ")}` : ""}</option>)}
      </select>
    </label>
    {query && <div className="device-model-filter-search-status">
      <span role="status">{matches.length} matching models{selected && !matches.includes(selected) ? "; current selection retained" : ""}</span>
      <button type="button" className="ghost-button" onClick={() => { setQuery(""); onSearchChange?.(""); }}>Clear search</button>
    </div>}
  </div>;
}
