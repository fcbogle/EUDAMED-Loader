import { PATCH_BUSINESS_OPTIONS } from "../patchScenarios";
import { PatchDeviceSearch } from "./PatchDeviceSearch";
import type { PatchDeviceSearchOption } from "../patchDeviceSearch";

export function PatchSelectionPanel({ family, variant, environment, scenario, onScenarioChange, options, selectedKey, onSelect, baselineLoading = false, baselineError = null, baselineLoaded = false }: {
  family: string | null;
  variant: string | null;
  environment: "dev" | "prod" | null;
  scenario: string;
  onScenarioChange: (id: string) => void;
  options: PatchDeviceSearchOption[];
  selectedKey: string | null;
  onSelect: (option: PatchDeviceSearchOption) => void;
  baselineLoading?: boolean;
  baselineError?: string | null;
  baselineLoaded?: boolean;
}) {
  return <div className="draft-card patch-selection-panel">
    <h3>Choose the PATCH scenario</h3>
    <div className="patch-scenario-control">
      <label className="field-label" htmlFor="patch-scenario-selector">PATCH scenario</label>
      <select id="patch-scenario-selector" className="rule-select" value={scenario}
        disabled={!family || !variant || environment === null} onChange={event => onScenarioChange(event.target.value)}>
        <option value="">Select a PATCH scenario</option>
        {PATCH_BUSINESS_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>
    {scenario === "status_code_edit" && <p className="panel-copy">Change On the EU market to No longer placed on the EU market. The registration is retained. Current device data updates after uploading the matching Success XML.</p>}
    <PatchDeviceSearch key={JSON.stringify([environment, family, variant])} options={options} environment={environment}
      family={family} variant={variant} enabled={Boolean(scenario)} selectedKey={selectedKey} onSelect={onSelect} />
    {selectedKey && <p className="panel-copy" role={baselineError ? "alert" : "status"}>
      {baselineError ? `Accepted baseline could not be loaded: ${baselineError}`
        : baselineLoading ? "Loading the selected device’s accepted baseline…"
          : baselineLoaded ? "Accepted baseline loaded. Review the PATCH Before and After values below."
            : "Checking the selected device’s accepted baseline. Select the device again to reload it."}
    </p>}
  </div>;
}
