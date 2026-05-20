import { useEffect, useState } from "react";
import { Fragment } from "react";

import { api } from "./api";
import canonicalDocumentation from "./content/docs/canonical.md?raw";
import canonicalValidationDocumentation from "./content/docs/canonical-validation.md?raw";
import workbooksDocumentation from "./content/docs/workbooks.md?raw";
import xmlGenerationDocumentation from "./content/docs/xml-generation.md?raw";
import type {
  CanonicalReviewBundle,
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

type MainTab = "workbooks" | "canonical" | "canonicalValidation" | "xml" | "documentation";
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
  id: "workbooks" | "canonical" | "canonicalValidation" | "xml";
  title: string;
  markdown: string;
};

type CanonicalMappingRow = {
  entityName: string;
  entityPath: string;
  excelField: string;
  canonicalPath: string;
  businessLabel: string;
  schemaTarget: string;
  classification: string;
  decisionStatus: string;
  decisionRationale: string | null;
  normalizedBy: string[];
  derivationLogic: string | null;
  assumptions: string[];
  exampleSourceValues: string[];
  exampleCanonicalValue: string | null;
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

function titleCaseToken(value: string): string {
  return value
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
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
  const [canonicalReview, setCanonicalReview] = useState<CanonicalReviewBundle | null>(null);
  const [expandedMappingPath, setExpandedMappingPath] = useState<string | null>(null);
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
      id: "canonicalValidation",
      title: "Canonical Validation",
      markdown: canonicalValidationDocumentation,
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
      api.canonicalReview(),
      api.schemas(),
      api.distinctValues(selectedColumn),
    ])
      .then(([workbookData, sheetData, ruleData, canonicalData, schemaData, distinctData]) => {
        setWorkbooks(workbookData);
        setSheets(sheetData);
        setRules(ruleData);
        setCanonicalReview(canonicalData);
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
  const canonicalEntityCount = canonicalReview?.entity_reviews.length ?? 0;
  const canonicalFieldCount =
    canonicalReview?.entity_reviews.reduce((total, entity) => total + entity.field_reviews.length, 0) ?? 0;
  const canonicalMappingRows: CanonicalMappingRow[] = (canonicalReview?.entity_reviews ?? []).flatMap((entity) =>
    entity.field_reviews.map((fieldReview) => ({
      entityName: entity.entity_name,
      entityPath: entity.entity_path,
      excelField: fieldReview.mapping.source_columns.join(" | ") || "Context / external reference",
      canonicalPath: fieldReview.mapping.canonical_path,
      businessLabel: fieldReview.mapping.business_label,
      schemaTarget:
        fieldReview.mapping.schema_targets.map((target) => target.schema_path).join(" | ") || "Not yet aligned",
      classification: fieldReview.mapping.classification,
      decisionStatus: fieldReview.decision.status,
      decisionRationale: fieldReview.decision.rationale,
      normalizedBy: fieldReview.mapping.normalized_by,
      derivationLogic: fieldReview.mapping.derivation_logic,
      assumptions: fieldReview.mapping.assumptions,
      exampleSourceValues: fieldReview.mapping.example_source_values,
      exampleCanonicalValue: fieldReview.mapping.example_canonical_value,
    })),
  );
  const classificationCounts = canonicalMappingRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1;
    return counts;
  }, {});
  const directCount = classificationCounts.direct ?? 0;
  const derivedRows = canonicalMappingRows.filter((row) => row.classification === "derived");
  const gapRows = canonicalMappingRows.filter((row) => row.classification === "gap");
  const normalizedRows = canonicalMappingRows.filter((row) => row.classification === "normalized");
  const needsClarificationRows = canonicalMappingRows.filter((row) => row.decisionStatus === "needs_clarification");
  const assumptionRows = canonicalMappingRows.filter((row) => row.assumptions.length > 0);
  const profileColumns = sheetProfile?.columns ?? [];
  const highNullColumns = profileColumns.filter((column) => {
    if (!sheetProfile?.data_rows) {
      return false;
    }
    return column.null_count / sheetProfile.data_rows > 0.25;
  });
  const criticalNullColumns = profileColumns.filter((column) => {
    if (!sheetProfile?.data_rows) {
      return false;
    }
    return column.null_count / sheetProfile.data_rows > 0.75;
  });
  const emptyColumns = profileColumns.filter((column) => column.non_null_count === 0);
  const topNullColumns = [...profileColumns]
    .sort((left, right) => right.null_count - left.null_count)
    .slice(0, 5);

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
            className={activeTab === "canonicalValidation" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("canonicalValidation")}
          >
            Canonical Validation
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
                Review workbook evidence, identify normalization challenges when they exist, and see
                how the application addresses them without changing the source Excel files.
              </p>
            </>
          ) : null}
          {activeTab === "canonical" ? (
            <>
              <p className="eyebrow">Canonical Preparation</p>
              <h1>Review the Excel to canonical to schema contract for the first MDR UDI-DI load.</h1>
              <p className="hero-copy">
                This stage defines how workbook fields map into canonical meaning and onward to
                `UDIDIType.xsd`, with accordion detail for assumptions and transformation notes.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <p className="eyebrow">Canonical Validation</p>
              <h1>Review the mappings that still depend on assumptions, context, or clarification.</h1>
              <p className="hero-copy">
                This stage isolates derived fields, gaps, normalization review, and clarification items
                so mapping validation stays separate from the canonical definition view.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <p className="eyebrow">XML Generation</p>
              <h1>Stage the MDR UDI-DI XML package flow after workbook data and canonical mapping are stable.</h1>
              <p className="hero-copy">
                This stage will produce previewable payloads, validate against `UDIDIType.xsd`, and
                prepare controlled manual submission packages without introducing M2M transport yet.
              </p>
            </>
          ) : null}
          {activeTab === "documentation" ? (
            <>
              <p className="eyebrow">Documentation</p>
              <h1>Read the workflow guidance for each major stage of the application in one place.</h1>
              <p className="hero-copy">
                Documentation is organized to match the main UI areas so the user can move between
                workbook analysis, canonical definition, canonical validation, and XML generation with aligned guidance.
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
                {sheets.length} sheets available for source review and {schemas?.total_files ?? 0} schema files
                inventoried.
              </p>
            </>
          ) : null}
          {activeTab === "canonical" ? (
            <>
              <span className="status-label">Current phase</span>
              <span className="status-pill warn">MDR UDI-DI first load</span>
              <p className="status-detail">
                {canonicalFieldCount} mappings are available in the definition view.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <span className="status-label">Validation scope</span>
              <span className="status-pill warn">Mapping review only</span>
              <p className="status-detail">
                {derivedRows.length + gapRows.length + needsClarificationRows.length} items currently need elevated review.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <span className="status-label">Current phase</span>
              <span className="status-pill warn">Not generating yet</span>
              <p className="status-detail">
                XML package generation remains downstream of canonical mapping and is currently scoped to MDR UDI-DI payload planning.
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

          <section className="panel section-break">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Sheets</span>
                <h2>Workbook Tabs</h2>
              </div>
            </div>
            <div className="sheet-list horizontal-sheet-list">
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
          </section>

          <section className="content-grid single-panel-grid">
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

          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Selected sheet rows</span>
              <strong>{sheetProfile?.data_rows ?? 0}</strong>
              <p>Rows currently available for completeness review in the selected workbook tab.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">High null fields</span>
              <strong>{highNullColumns.length}</strong>
              <p>Fields with more than 25% null values in the selected sheet.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Critical null fields</span>
              <strong>{criticalNullColumns.length}</strong>
              <p>Fields with more than 75% null values and likely needing closer review.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Empty fields</span>
              <strong>{emptyColumns.length}</strong>
              <p>Fields with no populated values at all in the selected sheet.</p>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Completeness</span>
                  <h2>Missing Data Highlights</h2>
                </div>
              </div>
              <p className="panel-copy">
                This summary highlights where the selected sheet looks sparse or incomplete before any
                deeper canonical review begins.
              </p>
              <div className="queue-summary">
                <div className="queue-chip">
                  <strong>{highNullColumns.length}</strong>
                  <span>high null fields</span>
                </div>
                <div className="queue-chip">
                  <strong>{criticalNullColumns.length}</strong>
                  <span>critical null fields</span>
                </div>
                <div className="queue-chip">
                  <strong>{emptyColumns.length}</strong>
                  <span>empty fields</span>
                </div>
              </div>
              <div className="draft-list">
                {topNullColumns.length ? (
                  topNullColumns.map((column) => {
                    const nullRate =
                      sheetProfile?.data_rows && sheetProfile.data_rows > 0
                        ? Math.round((column.null_count / sheetProfile.data_rows) * 100)
                        : 0;
                    return (
                      <div className="draft-card" key={column.header}>
                        <div className="draft-card-head">
                          <strong>{column.header}</strong>
                          <span
                            className={
                              nullRate === 100
                                ? "status-pill warn compact"
                                : nullRate > 75
                                  ? "status-pill warn compact"
                                  : "status-pill ok compact"
                            }
                          >
                            {nullRate}% null
                          </span>
                        </div>
                        <p className="draft-meta">
                          {column.null_count} null / {column.non_null_count} populated / {column.distinct_count} distinct
                        </p>
                        <p className="panel-copy">
                          {column.sample_values.length
                            ? `Sample values: ${column.sample_values.join(", ")}`
                            : "No sample values are available because the field is fully empty in this sheet."}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="panel-copy">Select a sheet to review missing-data highlights.</p>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="section-heading section-heading-spread">
                <div>
                  <span className="section-kicker">Normalization</span>
                  <h2>Normalization Status</h2>
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
              <p className="panel-copy">
                Review the normalization status for the selected field across <strong>{scopeLabel}</strong>. This is a
                summary of how inconsistent values have been handled, not the main data-quality view.
              </p>
              <div className="action-summary">
                <div className="summary-chip">
                  <strong>{unmappedCount}</strong>
                  <span>unresolved values</span>
                </div>
                <div className="summary-chip">
                  <strong>{mappedCount}</strong>
                  <span>resolved by rules</span>
                </div>
                <div className="summary-chip">
                  <strong>{reviewIssues.length}</strong>
                  <span>manual review</span>
                </div>
                <div className="summary-chip">
                  <strong>{selectedRuleFile?.rules.length ?? 0}</strong>
                  <span>applied rules</span>
                </div>
              </div>
              <p className="panel-copy resolution-status">
                {detectedIssues.length
                  ? "Some values for this field still need normalization attention or manual review."
                  : "Normalization needs for this field are currently addressed by the existing ruleset."}
              </p>
              <details className="group-accordion" open={detectedIssues.length > 0}>
                <summary>
                  <span>Normalization Detail</span>
                  <span className="status-pill warn compact">{detectedIssues.length}</span>
                </summary>
                <div className="accordion-body">
                  <div className="toolbar">
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={showUnmappedOnly}
                        onChange={(event) => setShowUnmappedOnly(event.target.checked)}
                      />
                      <span>Show unresolved only</span>
                    </label>
                    <input
                      className="filter-input"
                      type="search"
                      value={valueFilter}
                      onChange={(event) => setValueFilter(event.target.value)}
                      placeholder="Filter values"
                    />
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
                                {item.status === "mapped" ? "resolved" : "needs review"}
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
              </details>
              <details className="group-accordion" open={selectedColumnDrafts.length > 0}>
                <summary>
                  <span>Queued Changes</span>
                  <span className="status-pill warn compact">{selectedColumnDrafts.length}</span>
                </summary>
                <div className="accordion-body">
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
                              ? `Map${draft.suggestedNormalized ? ` to ${draft.suggestedNormalized}` : ""}`
                              : "Manual review"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="panel-copy">No queued changes for the selected field.</p>
                    )}
                  </div>
                </div>
              </details>
              <details className="group-accordion">
                <summary>
                  <span>Applied Normalization Rules</span>
                  <span className="status-pill ok compact">{selectedRuleFile?.rules.length ?? 0}</span>
                </summary>
                <div className="accordion-body">
                  {selectedRuleFile ? (
                    <div className="rule-block">
                      <strong>{selectedRuleFile.column}</strong>
                      <p className="panel-copy">{selectedRuleFile.description}</p>
                      {selectedRuleFile.rules.map((rule) => (
                        <div key={`${rule.raw}-${rule.normalized}`} className="rule-row">
                          <span>{rule.raw}</span>
                          <span>{rule.normalized}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="panel-copy">No applied normalization rules are currently loaded for this field.</p>
                  )}
                </div>
              </details>
              <details className="group-accordion">
                <summary>
                  <span>Rule YAML Preview</span>
                  <span className="status-pill ok compact">{selectedColumnMapDrafts.length}</span>
                </summary>
                <div className="yaml-preview accordion-body">
                  <pre>{yamlDraft || "# No additional normalization YAML is currently queued for this field."}</pre>
                </div>
              </details>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "canonical" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Reviewed entities</span>
              <strong>{canonicalEntityCount}</strong>
              <p>Canonical entities currently represented in the first-phase mapping contract.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Mapped fields</span>
              <strong>{canonicalFieldCount}</strong>
              <p>Field-level mappings currently visible in the compact review table.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Direct mappings</span>
              <strong>{directCount}</strong>
              <p>Mappings that come straight from the workbook meaning without inferred context.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Context-heavy</span>
              <strong>{derivedRows.length + normalizedRows.length}</strong>
              <p>Mappings that depend on derivation logic or controlled-value normalization.</p>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Phase Baseline</span>
                <h2>First-Phase Assumptions</h2>
              </div>
            </div>
            <p className="panel-copy">
              The canonical definition view shows the expected path from source workbook field to canonical
              meaning and onward to the first-phase schema target. Use the accordion rows for secondary
              detail rather than reading every mapping note at once.
            </p>
            <ul>
              {(canonicalReview?.phase_assumptions ?? []).map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Mapping Contract</span>
                <h2>Excel To Canonical To Schema</h2>
              </div>
            </div>
            <table className="mapping-contract-table">
              <colgroup>
                <col className="mapping-col-excel" />
                <col className="mapping-col-canonical" />
                <col className="mapping-col-schema" />
                <col className="mapping-col-type" />
                <col className="mapping-col-status" />
                <col className="mapping-col-details" />
              </colgroup>
              <thead>
                <tr>
                  <th>Excel field</th>
                  <th>Canonical field</th>
                  <th>Schema target</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {canonicalMappingRows.map((row) => {
                  const isExpanded = expandedMappingPath === row.canonicalPath;
                  return (
                    <Fragment key={row.canonicalPath}>
                      <tr>
                        <td>{row.excelField}</td>
                        <td>
                          <strong>{row.businessLabel}</strong>
                          <br />
                          <code>{row.canonicalPath}</code>
                        </td>
                        <td>{row.schemaTarget}</td>
                        <td>
                          <span className="status-pill ok compact">{titleCaseToken(row.classification)}</span>
                        </td>
                        <td>
                          <span className="status-pill warn compact">{titleCaseToken(row.decisionStatus)}</span>
                        </td>
                        <td>
                          <button
                            className="ghost-button compact"
                            type="button"
                            onClick={() =>
                              setExpandedMappingPath(isExpanded ? null : row.canonicalPath)
                            }
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="expanded-row">
                          <td colSpan={6}>
                            <div className="accordion-body full-row-detail">
                              <p>
                                Entity: <strong>{row.entityName}</strong>
                              </p>
                              {row.normalizedBy.length ? (
                                <p>Normalization: {row.normalizedBy.join(", ")}</p>
                              ) : null}
                              {row.derivationLogic ? <p>Derivation: {row.derivationLogic}</p> : null}
                              {row.assumptions.length ? <p>Assumptions: {row.assumptions.join(" ")}</p> : null}
                              {row.exampleSourceValues.length ? (
                                <p>Example source values: {row.exampleSourceValues.join(" | ")}</p>
                              ) : null}
                              {row.exampleCanonicalValue ? (
                                <p>Example canonical value: {row.exampleCanonicalValue}</p>
                              ) : null}
                              {row.decisionRationale ? <p>Review note: {row.decisionRationale}</p> : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        </section>
      ) : null}

      {activeTab === "canonicalValidation" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Derived fields</span>
              <strong>{derivedRows.length}</strong>
              <p>Mappings that depend on project scope or external reference context.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Gap fields</span>
              <strong>{gapRows.length}</strong>
              <p>Mappings with no confirmed first-phase workbook source at the moment.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Needs clarification</span>
              <strong>{needsClarificationRows.length}</strong>
              <p>Mappings whose source evidence or interpretation still needs review.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Normalized review</span>
              <strong>{normalizedRows.length}</strong>
              <p>Mappings that rely on controlled-value normalization before later execution.</p>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Validation Scope</span>
                <h2>Mapping Review Checkpoint</h2>
              </div>
            </div>
            <p className="panel-copy">
              This tab validates the mapping definition itself. It surfaces fields that depend on
              assumptions, derivation, normalization, or unresolved source evidence before any later
              row-level canonical execution work begins.
            </p>
            <div className="queue-summary">
              <div className="queue-chip">
                <strong>{assumptionRows.length}</strong>
                <span>fields with assumptions</span>
              </div>
              <div className="queue-chip">
                <strong>{canonicalMappingRows.filter((row) => row.excelField === "Context / external reference").length}</strong>
                <span>without workbook columns</span>
              </div>
            </div>
          </section>
          {[
            { title: "Derived Fields", rows: derivedRows },
            { title: "Gap Fields", rows: gapRows },
            { title: "Needs Clarification", rows: needsClarificationRows },
            { title: "Normalized Fields", rows: normalizedRows },
          ].map((group) => (
            <section className="panel roadmap-panel" key={group.title}>
              <details className="group-accordion" open>
                <summary>
                  <span>{group.title}</span>
                  <span className="status-pill warn compact">{group.rows.length}</span>
                </summary>
                <div className="roadmap-list">
                  {group.rows.length ? (
                    group.rows.map((row) => (
                      <div className="roadmap-item" key={`${group.title}-${row.canonicalPath}`}>
                        <strong>{row.businessLabel}</strong>
                        <p>
                          <code>{row.canonicalPath}</code>
                        </p>
                        <p>Excel field: {row.excelField}</p>
                        <p>Schema target: {row.schemaTarget}</p>
                        <p>
                          Classification: <strong>{titleCaseToken(row.classification)}</strong> · Review status:{" "}
                          <strong>{titleCaseToken(row.decisionStatus)}</strong>
                        </p>
                        {row.derivationLogic ? <p>Derivation: {row.derivationLogic}</p> : null}
                        {row.assumptions.length ? <p>Assumptions: {row.assumptions.join(" ")}</p> : null}
                        {row.normalizedBy.length ? <p>Normalization: {row.normalizedBy.join(", ")}</p> : null}
                        {row.decisionRationale ? <p>Review note: {row.decisionRationale}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="panel-copy">No items currently fall into this validation group.</p>
                  )}
                </div>
              </details>
            </section>
          ))}
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
              <strong>UDIDIType.xsd</strong>
              <p>Schema inventory is available, but payload generation should wait until the MDR UDI-DI canonical review is stable.</p>
            </div>
          </section>
          <section className="panel roadmap-panel">
            <span className="section-kicker">XML Generation</span>
            <h2>QMS-Aligned XML Package Workspace</h2>
            <p className="panel-copy">
              This tab is reserved for schema-aware MDR UDI-DI payload creation, preview, and `UDIDIType.xsd`
              validation after the canonical layer is approved.
            </p>
            <div className="roadmap-list">
              <div className="roadmap-item">
                <strong>Payload preview</strong>
                <p>Generate inspectable XML from validated first-phase canonical records.</p>
              </div>
              <div className="roadmap-item">
                <strong>XSD validation</strong>
                <p>Validate generated documents against the inventoried EUDAMED schemas with first-phase focus on `UDIDIType.xsd`.</p>
              </div>
              <div className="roadmap-item">
                <strong>Package preparation</strong>
                <p>Prepare controlled manual submission artifacts before any future Playground approval, M2M, or eDelivery integration.</p>
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
              <p>The documentation sections currently match `Workbooks`, `Canonical`, `Canonical Validation`, and `XML Generation`.</p>
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
