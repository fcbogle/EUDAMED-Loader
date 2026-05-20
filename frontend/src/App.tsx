import { useEffect, useState } from "react";

import { api } from "./api";
import canonicalDocumentation from "./content/docs/canonical.md?raw";
import workbooksDocumentation from "./content/docs/workbooks.md?raw";
import xmlGenerationDocumentation from "./content/docs/xml-generation.md?raw";
import type {
  DistinctValueProfile,
  NormalizationRuleFile,
  SchemaInventory,
  SheetProfile,
  SheetSummary,
  WorkbookSummary,
} from "./types";

const focusColumns = [
  "UDI-DI status e.g. On the EU market",
  "Select the language e.g English",
];

type MainTab = "workbooks" | "canonical" | "xml" | "documentation";
type ScopeMode = "all" | "sheet";

type DraftAction = {
  column: string;
  rawValue: string;
  count: number;
  action: "map" | "review";
  suggestedNormalized: string | null;
  reason: string;
  workbook: string | null;
  sheet: string | null;
};

type SuggestedAction = {
  action: "map" | "review";
  label: string;
  suggestedNormalized: string | null;
  reason: string;
};

type ParsingIssue = {
  rawValue: string;
  count: number;
  suggestion: SuggestedAction;
};

type DocumentationSection = {
  id: "workbooks" | "canonical" | "xml";
  title: string;
  markdown: string;
};

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<code key={`code-${key++}`}>{match[1]}</code>);
    } else if (match[2] !== undefined) {
      parts.push(<strong key={`strong-${key++}`}>{match[2]}</strong>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderMarkdownDocument(content: string): JSX.Element[] {
  const lines = content.split("\n");
  const blocks: JSX.Element[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="markdown-code-block" key={`block-${key++}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (trimmed.startsWith("#")) {
      const level = Math.min(trimmed.match(/^#+/)?.[0].length ?? 1, 3);
      const text = trimmed.replace(/^#+\s*/, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push(
        <Tag key={`block-${key++}`} id={id}>
          {renderInlineMarkdown(text)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      blocks.push(
        <ul key={`block-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`item-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith("- ") &&
      !lines[index].trim().startsWith("```")
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`block-${key++}`}>{renderInlineMarkdown(paragraphLines.join(" "))}</p>);
  }

  return blocks;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function suggestAction(
  rawValue: string,
  acceptedValues: string[],
  currentRuleMappings: Map<string, string>,
): SuggestedAction {
  const rawToken = normalizeToken(rawValue);
  const matchedAcceptedValue = acceptedValues.find((candidate) => normalizeToken(candidate) === rawToken);
  if (matchedAcceptedValue) {
    return {
      action: "map",
      label: `Map to ${matchedAcceptedValue}`,
      suggestedNormalized: matchedAcceptedValue,
      reason: "Value differs only by casing or light formatting from an accepted normalized value.",
    };
  }

  const matchedRule = Array.from(currentRuleMappings.entries()).find(
    ([candidateRaw]) => normalizeToken(candidateRaw) === rawToken,
  );
  if (matchedRule) {
    return {
      action: "map",
      label: `Reuse ${matchedRule[1]}`,
      suggestedNormalized: matchedRule[1],
      reason: "A semantically equivalent raw value already exists in the accepted rule set.",
    };
  }

  if (acceptedValues.length === 1) {
    return {
      action: "map",
      label: `Map to ${acceptedValues[0]}`,
      suggestedNormalized: acceptedValues[0],
      reason: "This column currently has a single accepted normalized value, so the input likely needs alignment.",
    };
  }

  return {
    action: "review",
    label: "Review source value",
    suggestedNormalized: null,
    reason: "No safe automatic normalization candidate was inferred from the current accepted values.",
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("workbooks");
  const [activeDocumentationSection, setActiveDocumentationSection] = useState<
    DocumentationSection["id"]
  >("workbooks");
  const [workbooks, setWorkbooks] = useState<WorkbookSummary[]>([]);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetSummary | null>(null);
  const [sheetProfile, setSheetProfile] = useState<SheetProfile | null>(null);
  const [distinctValues, setDistinctValues] = useState<DistinctValueProfile | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>(focusColumns[0]);
  const [rules, setRules] = useState<NormalizationRuleFile[]>([]);
  const [schemas, setSchemas] = useState<SchemaInventory | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState<boolean>(true);
  const [valueFilter, setValueFilter] = useState<string>("");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);
  const [isApplyingRules, setIsApplyingRules] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const documentationSections: DocumentationSection[] = [
    {
      id: "workbooks",
      title: "Workbooks",
      markdown: workbooksDocumentation,
    },
    {
      id: "canonical",
      title: "Canonical",
      markdown: canonicalDocumentation,
    },
    {
      id: "xml",
      title: "XML Generation",
      markdown: xmlGenerationDocumentation,
    },
  ];
  const selectedDocumentationSection =
    documentationSections.find((section) => section.id === activeDocumentationSection) ??
    documentationSections[0];

  useEffect(() => {
    void Promise.all([
      api.workbooks(),
      api.sheets(),
      api.normalizationRules(),
      api.schemas(),
      api.distinctValues(selectedColumn),
    ])
      .then(([workbookData, sheetData, ruleData, schemaData, distinctData]) => {
        setWorkbooks(workbookData);
        setSheets(sheetData);
        setRules(ruleData);
        setSchemas(schemaData);
        setDistinctValues(distinctData);
        setSelectedSheet(sheetData[0] ?? null);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (!selectedSheet) {
      return;
    }
    void api
      .sheetProfile(selectedSheet.workbook, selectedSheet.sheet)
      .then(setSheetProfile)
      .catch((requestError: Error) => setError(requestError.message));
  }, [selectedSheet]);

  useEffect(() => {
    const workbook = scopeMode === "sheet" ? selectedSheet?.workbook : undefined;
    const sheet = scopeMode === "sheet" ? selectedSheet?.sheet : undefined;

    void api
      .distinctValues(selectedColumn, workbook, sheet)
      .then(setDistinctValues)
      .catch((requestError: Error) => setError(requestError.message));
  }, [scopeMode, selectedColumn, selectedSheet]);

  const selectedRuleFile = rules.find((item) => item.column === selectedColumn);
  const acceptedValues = Array.from(new Set(selectedRuleFile?.rules.map((rule) => rule.normalized) ?? []));
  const currentRuleMappings = new Map(
    (selectedRuleFile?.rules ?? []).map((rule) => [rule.raw, rule.normalized]),
  );
  const selectedColumnDrafts = draftActions.filter((item) => item.column === selectedColumn);
  const selectedColumnMapDrafts = selectedColumnDrafts.filter(
    (item) => item.action === "map" && item.suggestedNormalized,
  );
  const selectedColumnReviewDrafts = selectedColumnDrafts.filter((item) => item.action === "review");
  const filteredDistinctValues = (distinctValues?.values ?? []).filter((item) => {
    if (showUnmappedOnly && item.status === "mapped") {
      return false;
    }
    if (!valueFilter) {
      return true;
    }
    const search = valueFilter.trim().toLowerCase();
    return item.raw_value.toLowerCase().includes(search) || (item.normalized_value ?? "").toLowerCase().includes(search);
  });
  const unmappedCount = distinctValues?.values.filter((item) => item.status !== "mapped").length ?? 0;
  const mappedCount = distinctValues?.values.filter((item) => item.status === "mapped").length ?? 0;
  const detectedIssues: ParsingIssue[] = (distinctValues?.values ?? [])
    .filter((item) => item.status !== "mapped")
    .map((item) => ({
      rawValue: item.raw_value,
      count: item.count,
      suggestion: suggestAction(item.raw_value, acceptedValues, currentRuleMappings),
    }));
  const autoFixableIssues = detectedIssues.filter((item) => item.suggestion.action === "map");
  const reviewIssues = detectedIssues.filter((item) => item.suggestion.action === "review");
  const scopeLabel =
    scopeMode === "sheet" && selectedSheet
      ? `${selectedSheet.workbook} / ${selectedSheet.sheet}`
      : "All indexed sheets";
  const yamlDraft = selectedColumnMapDrafts
    .map((item) => `  - raw: ${item.rawValue}\n    normalized: ${item.suggestedNormalized}`)
    .join("\n");

  function queueDraftAction(item: DistinctValueProfile["values"][number], suggestion: SuggestedAction): void {
    setDraftActions((current) => {
      const nextItem: DraftAction = {
        column: selectedColumn,
        rawValue: item.raw_value,
        count: item.count,
        action: suggestion.action,
        suggestedNormalized: suggestion.suggestedNormalized,
        reason: suggestion.reason,
        workbook: scopeMode === "sheet" ? selectedSheet?.workbook ?? null : null,
        sheet: scopeMode === "sheet" ? selectedSheet?.sheet ?? null : null,
      };
      const deduplicated = current.filter(
        (entry) => !(entry.column === nextItem.column && entry.rawValue === nextItem.rawValue),
      );
      return [...deduplicated, nextItem];
    });
  }

  function removeDraftAction(column: string, rawValue: string): void {
    setDraftActions((current) =>
      current.filter((entry) => !(entry.column === column && entry.rawValue === rawValue)),
    );
  }

  async function refreshNormalizationState(column: string): Promise<void> {
    const workbook = scopeMode === "sheet" ? selectedSheet?.workbook : undefined;
    const sheet = scopeMode === "sheet" ? selectedSheet?.sheet : undefined;
    const [ruleData, distinctData] = await Promise.all([
      api.normalizationRules(),
      api.distinctValues(column, workbook, sheet),
    ]);
    setRules(ruleData);
    setDistinctValues(distinctData);
  }

  async function applyDraftRules(column: string): Promise<void> {
    const rulesToApply = draftActions
      .filter(
        (item) => item.column === column && item.action === "map" && item.suggestedNormalized,
      )
      .map((item) => ({
        raw: item.rawValue,
        normalized: item.suggestedNormalized as string,
      }));

    if (!rulesToApply.length) {
      setSaveMessage("No queued mapping rules to apply for this column.");
      return;
    }

    setIsApplyingRules(true);
    setError(null);
    setSaveMessage(null);
    try {
      const result = await api.applyNormalizationRules(column, rulesToApply);
      await refreshNormalizationState(column);
      setDraftActions((current) =>
        current.filter((item) => !(item.column === column && item.action === "map")),
      );
      setSaveMessage(`Applied ${result.applied_rules} normalization rule(s) to ${result.file_path}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to apply normalization rules.");
    } finally {
      setIsApplyingRules(false);
    }
  }

  function queueRecommendedFixes(): void {
    autoFixableIssues.forEach((issue) => {
      queueDraftAction(
        {
          raw_value: issue.rawValue,
          count: issue.count,
          normalized_value: null,
          status: "unmapped",
        },
        issue.suggestion,
      );
    });
    setSaveMessage(
      autoFixableIssues.length
        ? `Queued ${autoFixableIssues.length} recommended fix${autoFixableIssues.length === 1 ? "" : "es"} for ${selectedColumn}.`
        : "No recommended fixes available for this column.",
    );
  }

  async function acceptRecommendedFixes(): Promise<void> {
    const rulesToApply = autoFixableIssues
      .filter((issue) => issue.suggestion.suggestedNormalized)
      .map((issue) => ({
        raw: issue.rawValue,
        normalized: issue.suggestion.suggestedNormalized as string,
      }));

    if (!rulesToApply.length) {
      setSaveMessage("No recommended fixes available for this column.");
      return;
    }

    setIsApplyingRules(true);
    setError(null);
    setSaveMessage(null);
    try {
      const result = await api.applyNormalizationRules(selectedColumn, rulesToApply);
      await refreshNormalizationState(selectedColumn);
      setDraftActions((current) => current.filter((item) => item.column !== selectedColumn));
      setSaveMessage(
        `Accepted ${result.applied_rules} recommended fix${result.applied_rules === 1 ? "" : "es"} for ${selectedColumn}. Source Excel files were not changed.`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to apply normalization rules.");
    } finally {
      setIsApplyingRules(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="top-nav">
        <div className="brand-block">
          <span className="brand-kicker">Regulatory Data Preparation</span>
          <div className="nav-title-block">
            <strong>EUDAMED Profiling Workspace</strong>
            <span className="nav-subtitle">
              Workbook analysis, canonical preparation, and XML package planning
            </span>
          </div>
        </div>
        <div className="nav-links">
          <button
            className={activeTab === "workbooks" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("workbooks")}
          >
            Workbooks
          </button>
          <button
            className={activeTab === "canonical" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("canonical")}
          >
            Canonical
          </button>
          <button
            className={activeTab === "xml" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("xml")}
          >
            XML Generation
          </button>
          <button
            className={activeTab === "documentation" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("documentation")}
          >
            Documentation
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy-block">
          {activeTab === "workbooks" ? (
            <>
              <p className="eyebrow">Workbook Analysis</p>
              <h1>Profile workbook structure and configure normalization without changing source files.</h1>
              <p className="hero-copy">
                Review Excel parsing results, detect noisy source values, and configure normalization
                rules that prepare the data for canonical mapping.
              </p>
            </>
          ) : null}
          {activeTab === "canonical" ? (
            <>
              <p className="eyebrow">Canonical Preparation</p>
              <h1>Prepare the regulatory device model that will sit between workbook inputs and XML output.</h1>
              <p className="hero-copy">
                This stage will hold canonical classes, source-to-canonical mapping definitions,
                and validation logic for human review before package generation.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <p className="eyebrow">XML Generation</p>
              <h1>Stage the schema-aware XML package flow after workbook data and canonical mapping are stable.</h1>
              <p className="hero-copy">
                This stage will produce previewable payloads, validate against XSDs, and prepare
                submission packages without introducing M2M transport yet.
              </p>
            </>
          ) : null}
          {activeTab === "documentation" ? (
            <>
              <p className="eyebrow">Documentation</p>
              <h1>Read the workflow guidance for each major stage of the application in one place.</h1>
              <p className="hero-copy">
                Documentation is organized to match the main UI areas so the user can move between
                workbook analysis, canonical preparation, and XML generation with aligned guidance.
              </p>
            </>
          ) : null}
        </div>
        <aside className="status-card">
          {activeTab === "workbooks" ? (
            <>
              <span className="status-label">Current scope</span>
              <span className="status-pill ok">{workbooks.length} workbooks indexed</span>
              <p className="status-detail">
                {sheets.length} sheets available for review and {schemas?.total_files ?? 0} schema files
                inventoried.
              </p>
            </>
          ) : null}
          {activeTab === "canonical" ? (
            <>
              <span className="status-label">Current phase</span>
              <span className="status-pill warn">Structure first</span>
              <p className="status-detail">
                Canonical modeling should follow workbook profiling and normalization decisions.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <span className="status-label">Current phase</span>
              <span className="status-pill warn">Not generating yet</span>
              <p className="status-detail">
                XML package generation remains downstream of canonical mapping and validation.
              </p>
            </>
          ) : null}
          {activeTab === "documentation" ? (
            <>
              <span className="status-label">Documentation set</span>
              <span className="status-pill ok">{documentationSections.length} sections available</span>
              <p className="status-detail">
                Each section maps directly to a primary workflow tab in the application.
              </p>
            </>
          ) : null}
        </aside>
      </section>

      {error ? <div className="panel error-banner">{error}</div> : null}
      {activeTab === "workbooks" ? (
        <>
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Workbook families</span>
              <strong>{workbooks.length}</strong>
              <p>Source workbook containers discovered in the configured Excel directory.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Sheet variants</span>
              <strong>{sheets.length}</strong>
              <p>Individual product-family tabs available for profiling and normalization review.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Normalization sets</span>
              <strong>{rules.length}</strong>
              <p>Rule files currently applied as a non-destructive normalization layer.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Schema inventory</span>
              <strong>{schemas?.total_files ?? 0}</strong>
              <p>Device and service XSD assets currently indexed by the backend.</p>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Inventory</span>
                  <h2>Workbook Inventory</h2>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Workbook</th>
                    <th>Sheets</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {workbooks.map((workbook) => (
                    <tr key={workbook.workbook}>
                      <td>{workbook.workbook}</td>
                      <td>{workbook.sheet_count}</td>
                      <td>{workbook.total_rows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Schemas</span>
                  <h2>Schema Inventory</h2>
                </div>
              </div>
              <p className="panel-copy">
                {schemas ? `${schemas.total_files} schema files indexed from the configured directory.` : "Loading..."}
              </p>
              <div className="schema-groups">
                <div className="schema-card">
                  <strong>Device schemas</strong>
                  <p>{schemas?.device_files.length ?? 0} files</p>
                </div>
                <div className="schema-card">
                  <strong>Service schemas</strong>
                  <p>{schemas?.service_files.length ?? 0} files</p>
                </div>
              </div>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Sheets</span>
                  <h2>Workbook Tabs</h2>
                </div>
              </div>
              <div className="sheet-list">
                {sheets.map((sheet) => {
                  const active =
                    selectedSheet?.workbook === sheet.workbook && selectedSheet?.sheet === sheet.sheet;
                  return (
                    <button
                      key={`${sheet.workbook}-${sheet.sheet}`}
                      className={active ? "sheet-card active" : "sheet-card"}
                      onClick={() => setSelectedSheet(sheet)}
                    >
                      <span className="sheet-title">{sheet.sheet}</span>
                      <small>{sheet.workbook}</small>
                      <small>{sheet.data_rows} rows</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Profile</span>
                  <h2>Sheet Profile</h2>
                </div>
              </div>
              {sheetProfile ? (
                <>
                  <p className="panel-copy">
                    {sheetProfile.workbook} / {sheetProfile.sheet} with {sheetProfile.data_rows} data rows.
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Column</th>
                        <th>Distinct</th>
                        <th>Nulls</th>
                        <th>Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheetProfile.columns.slice(0, 12).map((column) => (
                        <tr key={column.index}>
                          <td>{column.header}</td>
                          <td>{column.distinct_count}</td>
                          <td>{column.null_count}</td>
                          <td>{column.sample_values.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="panel-copy">Select a sheet.</p>
              )}
            </div>
          </section>

          <section className="content-grid">
            <div className="panel">
              <div className="section-heading section-heading-spread">
                <div>
                  <span className="section-kicker">Normalization</span>
                  <h2>Normalization Review</h2>
                </div>
                <div className="control-row">
                  <select value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)}>
                    {focusColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                  <select value={scopeMode} onChange={(event) => setScopeMode(event.target.value as ScopeMode)}>
                    <option value="all">All sheets</option>
                    <option value="sheet" disabled={!selectedSheet}>
                      Selected sheet
                    </option>
                  </select>
                </div>
              </div>
              <p className="panel-copy">{selectedRuleFile?.description ?? "No rule file loaded."}</p>
              <div className="summary-card parsing-summary-card">
                <span className="summary-label">Parsing Summary</span>
                <strong>{detectedIssues.length}</strong>
                <p>
                  Detected source-data issues for <strong>{selectedColumn}</strong> across <strong>{scopeLabel}</strong>.
                </p>
                <p className="parsing-summary-note">
                  The input Excel files will not be changed. Accepting a fix configures this application to
                  handle source-data inconsistencies through normalization rules.
                </p>
                <div className="queue-summary">
                  <div className="queue-chip">
                    <strong>{autoFixableIssues.length}</strong>
                    <span>recommended fixes</span>
                  </div>
                  <div className="queue-chip">
                    <strong>{reviewIssues.length}</strong>
                    <span>needs review</span>
                  </div>
                </div>
                <div className="draft-actions-bar">
                  <button
                    className="action-button"
                    type="button"
                    onClick={queueRecommendedFixes}
                    disabled={!autoFixableIssues.length}
                  >
                    {autoFixableIssues.length
                      ? `Queue ${autoFixableIssues.length} recommended fix${autoFixableIssues.length === 1 ? "" : "es"}`
                      : "No recommended fixes"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void acceptRecommendedFixes()}
                    disabled={isApplyingRules || !autoFixableIssues.length}
                  >
                    {isApplyingRules ? "Applying..." : `Yes, apply recommended fixes`}
                  </button>
                </div>
              </div>
              <div className="workflow-note">
                <strong>How this works</strong>
                <span>Review detected parsing issues, accept recommended fixes, and configure the app to normalize source-data errors without editing the Excel workbooks.</span>
              </div>
              <div className="toolbar">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={showUnmappedOnly}
                    onChange={(event) => setShowUnmappedOnly(event.target.checked)}
                  />
                  <span>Show unmapped only</span>
                </label>
                <input
                  className="filter-input"
                  type="search"
                  value={valueFilter}
                  onChange={(event) => setValueFilter(event.target.value)}
                  placeholder="Filter values"
                />
              </div>
              <div className="action-summary">
                <div className="summary-chip">
                  <strong>{unmappedCount}</strong>
                  <span>need action</span>
                </div>
                <div className="summary-chip">
                  <strong>{mappedCount}</strong>
                  <span>already mapped</span>
                </div>
                <div className="summary-chip">
                  <strong>{scopeLabel}</strong>
                  <span>current scope</span>
                </div>
                <div className="summary-chip">
                  <strong>{selectedColumnMapDrafts.length}</strong>
                  <span>queued fixes</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Raw value</th>
                    <th>Count</th>
                    <th>Normalized</th>
                    <th>Status</th>
                    <th>Suggested action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDistinctValues.slice(0, 24).map((item) => {
                    const suggestion =
                      item.status === "mapped"
                        ? {
                            action: "review" as const,
                            label: "Covered by rule",
                            suggestedNormalized: item.normalized_value,
                            reason: "This value is already represented in the accepted normalization rules.",
                          }
                        : suggestAction(item.raw_value, acceptedValues, currentRuleMappings);
                    return (
                      <tr key={item.raw_value}>
                        <td>{item.raw_value}</td>
                        <td>{item.count}</td>
                        <td>{item.normalized_value ?? "Pending"}</td>
                        <td>
                          <span className={item.status === "mapped" ? "status-pill ok compact" : "status-pill warn compact"}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-cell">
                            <strong>{suggestion.label}</strong>
                            <span>{suggestion.reason}</span>
                            {item.status !== "mapped" ? (
                              <button
                                className="action-button"
                                type="button"
                                onClick={() => queueDraftAction(item, suggestion)}
                              >
                                {suggestion.action === "map" ? "Queue rule draft" : "Queue review note"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Rectification</span>
                  <h2>Draft Action Queue</h2>
                </div>
              </div>
              <p className="panel-copy">
                The queue below is scoped to the currently selected column. Applying fixes updates the
                normalization YAML only and leaves the source workbooks unchanged.
              </p>
              <div className="draft-actions-bar">
                <button
                  className="action-button"
                  type="button"
                  onClick={() => void applyDraftRules(selectedColumn)}
                  disabled={isApplyingRules || !selectedColumnMapDrafts.length}
                >
                  {isApplyingRules
                    ? "Applying..."
                    : selectedColumnMapDrafts.length
                      ? `Apply ${selectedColumnMapDrafts.length} queued fix${selectedColumnMapDrafts.length === 1 ? "" : "es"}`
                      : "No queued fixes for this column"}
                </button>
                {saveMessage ? <span className="save-message">{saveMessage}</span> : null}
              </div>
              <div className="queue-summary">
                <div className="queue-chip">
                  <strong>{selectedColumnMapDrafts.length}</strong>
                  <span>mapping drafts</span>
                </div>
                <div className="queue-chip">
                  <strong>{selectedColumnReviewDrafts.length}</strong>
                  <span>review notes</span>
                </div>
              </div>
              <div className="draft-list">
                {selectedColumnDrafts.length ? (
                  selectedColumnDrafts.map((draft) => (
                    <div key={`${draft.column}-${draft.rawValue}`} className="draft-card">
                      <div className="draft-card-head">
                        <strong>{draft.rawValue}</strong>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => removeDraftAction(draft.column, draft.rawValue)}
                        >
                          Remove
                        </button>
                      </div>
                      <p className="draft-meta">
                        {draft.count} occurrences · {draft.workbook && draft.sheet ? `${draft.workbook} / ${draft.sheet}` : "All sheets"}
                      </p>
                      <p className="panel-copy">{draft.reason}</p>
                      <span className={draft.action === "map" ? "status-pill ok compact" : "status-pill warn compact"}>
                        {draft.action === "map"
                          ? `Draft map${draft.suggestedNormalized ? ` to ${draft.suggestedNormalized}` : ""}`
                          : "Manual review"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="panel-copy">No queued actions for the selected column yet.</p>
                )}
              </div>
              <div className="section-heading draft-heading">
                <div>
                  <span className="section-kicker">Rules</span>
                  <h2>Accepted Rules</h2>
                </div>
              </div>
              {rules.map((ruleFile) => (
                <div key={ruleFile.column} className="rule-block">
                  <strong>{ruleFile.column}</strong>
                  <p className="panel-copy">{ruleFile.description}</p>
                  {ruleFile.rules.map((rule) => (
                    <div key={`${rule.raw}-${rule.normalized}`} className="rule-row">
                      <span>{rule.raw}</span>
                      <span>{rule.normalized}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="yaml-preview">
                <strong>Draft YAML preview</strong>
                <pre>{yamlDraft || "# Queue mapping actions for the selected column to build a draft YAML snippet."}</pre>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "canonical" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Current stage</span>
              <strong>Draft</strong>
              <p>Canonical structures should be derived from the workbook evidence and approved before implementation.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Planned contents</span>
              <strong>Model + Mapping</strong>
              <p>This tab will host canonical classes, source-to-canonical mappings, and rule-based validation.</p>
            </div>
          </section>
          <section className="panel roadmap-panel">
            <span className="section-kicker">Canonical</span>
            <h2>Planned Canonical Workspace</h2>
            <p className="panel-copy">
              The next phase should introduce the regulatory device model, mapping definitions, and validation results
              derived from the workbook analysis already captured in the Workbooks tab.
            </p>
            <div className="roadmap-list">
              <div className="roadmap-item">
                <strong>Canonical model proposal</strong>
                <p>Draft entities such as `BasicDevice`, `DeviceRecord`, `PackagingLevel`, and `ValidationIssue`.</p>
              </div>
              <div className="roadmap-item">
                <strong>Mapping definitions</strong>
                <p>Show how workbook fields and normalization outputs populate canonical attributes.</p>
              </div>
              <div className="roadmap-item">
                <strong>Validation review</strong>
                <p>Summarize missing, inconsistent, and suspicious data before XML generation.</p>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "xml" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Current stage</span>
              <strong>Deferred</strong>
              <p>XML generation should remain downstream of canonical mapping, validation, and human review.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Schema readiness</span>
              <strong>{schemas?.total_files ?? 0}</strong>
              <p>Schema inventory is available, but payload generation should wait until canonical structures are stable.</p>
            </div>
          </section>
          <section className="panel roadmap-panel">
            <span className="section-kicker">XML Generation</span>
            <h2>Planned XML Package Workspace</h2>
            <p className="panel-copy">
              This tab is reserved for schema-aware payload creation, preview, and XSD validation after the canonical
              layer is approved.
            </p>
            <div className="roadmap-list">
              <div className="roadmap-item">
                <strong>Payload preview</strong>
                <p>Generate inspectable XML from validated canonical records.</p>
              </div>
              <div className="roadmap-item">
                <strong>XSD validation</strong>
                <p>Validate generated documents against the inventoried EUDAMED schemas.</p>
              </div>
              <div className="roadmap-item">
                <strong>Package preparation</strong>
                <p>Prepare manual submission artifacts before any future M2M or eDelivery integration.</p>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "documentation" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Documentation sections</span>
              <strong>{documentationSections.length}</strong>
              <p>Markdown-backed guidance aligned to the major workflow areas in the UI.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Current structure</span>
              <strong>Aligned</strong>
              <p>The documentation sections currently match `Workbooks`, `Canonical`, and `XML Generation`.</p>
            </div>
          </section>
          <section className="documentation-layout">
            <aside className="panel documentation-sidebar">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Contents</span>
                  <h2>Documentation</h2>
                </div>
              </div>
              <p className="panel-copy">
                Jump between the major application stages. Each document aligns with a primary UI tab.
              </p>
              <div className="documentation-toc">
                {documentationSections.map((section) => (
                  <button
                    key={section.id}
                    className={
                      activeDocumentationSection === section.id
                        ? "documentation-toc-link active"
                        : "documentation-toc-link"
                    }
                    type="button"
                    onClick={() => setActiveDocumentationSection(section.id)}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </aside>
            <article className="panel documentation-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Documentation</span>
                  <h2>{selectedDocumentationSection.title}</h2>
                </div>
              </div>
              <div className="markdown-document">
                {renderMarkdownDocument(selectedDocumentationSection.markdown)}
              </div>
            </article>
          </section>
        </section>
      ) : null}
    </main>
  );
}
