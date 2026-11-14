import { PATCH_BUSINESS_OPTIONS } from "../patchScenarios";
import { PatchDeviceSearch } from "./PatchDeviceSearch";
import type { PatchDeviceSearchOption } from "../patchDeviceSearch";

export function PatchSelectionPanel({ family, variant, environment, scenario, onScenarioChange, options, selectedKey, onSelect }: {
  family: string | null;
  variant: string | null;
  environment: "dev" | "prod" | null;
  scenario: string;
  onScenarioChange: (id: string) => void;
  options: PatchDeviceSearchOption[];
  selectedKey: string | null;
  onSelect: (option: PatchDeviceSearchOption) => void;
}) {
  return <div className="draft-card">
    <h3>Choose the PATCH scenario</h3>
    <label className="field-label" htmlFor="patch-scenario-selector">PATCH scenario</label>
    <select id="patch-scenario-selector" className="rule-select" value={scenario}
      disabled={!family || !variant || environment === null} onChange={event => onScenarioChange(event.target.value)}>
      <option value="">Select a PATCH scenario</option>
      {PATCH_BUSINESS_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    {scenario === "status_code_edit" && <p className="panel-copy">Change On the EU market to No longer placed on the EU market. {environment === "prod"
      ? "Production generation awaits successful Playground verification."
      : "Ready for controlled Playground testing; EUDAMED acceptance has not yet been verified."}</p>}
    <PatchDeviceSearch key={JSON.stringify([environment, family, variant])} options={options} environment={environment}
      family={family} variant={variant} enabled={Boolean(scenario)} selectedKey={selectedKey} onSelect={onSelect} />
  </div>;
}
