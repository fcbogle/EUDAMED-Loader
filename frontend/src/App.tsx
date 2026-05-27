import { useEffect, useState } from "react";

import { api } from "./api";
import architecturePositionDocumentation from "./content/docs/architecture-position.md?raw";
import canonicalDocumentation from "./content/docs/canonical.md?raw";
import canonicalValidationDocumentation from "./content/docs/canonical-validation.md?raw";
import projectStructureDocumentation from "./content/docs/project-structure.md?raw";
import softwareEngineeringPatternsDocumentation from "./content/docs/software-engineering-patterns.md?raw";
import workbooksDocumentation from "./content/docs/workbooks.md?raw";
import xmlGenerationDocumentation from "./content/docs/xml-generation.md?raw";
import type {
  BatchXmlPreview,
  CanonicalReviewBundle,
  DistinctValueProfile,
  EchelonValidationBundle,
  NormalizationRuleFile,
  ReferenceWorkbookSummary,
  SchemaInventory,
  SheetProfile,
  SheetSummary,
  SingleRecordXmlPreview,
  WorkbookSummary,
} from "./types";

const focusColumns = [
  "UDI-DI status e.g. On the EU market",
  "Select the language e.g English",
];

type MainTab = "workbooks" | "canonical" | "canonicalValidation" | "xml" | "documentation";
type ScopeMode = "all" | "sheet";
type XmlGenerationMode = "single" | "batch";

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
  id:
    | "architecturePosition"
    | "workbooks"
    | "canonical"
    | "canonicalValidation"
    | "xml"
    | "projectStructure"
    | "softwareEngineeringPatterns";
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
  exampleSourceValues: string[];
  exampleCanonicalValue: string | null;
};

type MarkdownListItem = {
  text: string;
  children: MarkdownListBlock[];
};

type MarkdownListKind = "unordered" | "ordered";

type MarkdownListBlock = {
  kind: MarkdownListKind;
  items: MarkdownListItem[];
};

function renderInlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const pattern = /\[\[pill:([^\]]+)\]\]|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(
        <span className="markdown-pill" key={`pill-${key++}`}>
          {match[1]}
        </span>,
      );
    } else if (match[2] !== undefined) {
      parts.push(<code key={`code-${key++}`}>{match[2]}</code>);
    } else if (match[3] !== undefined) {
      parts.push(<strong key={`strong-${key++}`}>{match[3]}</strong>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function parseMarkdownList(
  lines: string[],
  startIndex: number,
  baseIndent: number,
  kind: MarkdownListKind,
): [MarkdownListItem[], number] {
  const items: MarkdownListItem[] = [];
  let index = startIndex;
  const pattern = kind === "ordered" ? /^(\s*)\d+\. (.*)$/ : /^(\s*)- (.*)$/;

  while (index < lines.length) {
    const match = lines[index].match(pattern);
    if (!match) {
      break;
    }

    const indent = match[1].length;
    const text = match[2];

    if (indent < baseIndent) {
      break;
    }

    if (indent > baseIndent) {
      if (!items.length) {
        break;
      }
      const childKind: MarkdownListKind = /^\s*\d+\. /.test(lines[index]) ? "ordered" : "unordered";
      const [children, nextIndex] = parseMarkdownList(lines, index, indent, childKind);
      items[items.length - 1].children = [{ kind: childKind, items: children }];
      index = nextIndex;
      continue;
    }

    items.push({ text, children: [] });
    index += 1;
  }

  return [items, index];
}

function renderMarkdownList(items: MarkdownListItem[], keyPrefix: string, kind: MarkdownListKind): JSX.Element {
  const Tag = kind === "ordered" ? "ol" : "ul";
  return (
    <Tag key={keyPrefix}>
      {items.map((item, itemIndex) => (
        <li key={`${keyPrefix}-item-${itemIndex}`}>
          {renderInlineMarkdown(item.text)}
          {item.children.map((childBlock, childIndex) =>
            renderMarkdownList(
              childBlock.items,
              `${keyPrefix}-nested-${itemIndex}-${childIndex}`,
              childBlock.kind,
            ),
          )}
        </li>
      ))}
    </Tag>
  );
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

    if (/^\s*(- |\d+\. )/.test(line)) {
      const kind: MarkdownListKind = /^\s*\d+\. /.test(line) ? "ordered" : "unordered";
      const baseIndent =
        (kind === "ordered" ? line.match(/^(\s*)\d+\. /) : line.match(/^(\s*)- /))?.[1].length ?? 0;
      const [items, nextIndex] = parseMarkdownList(lines, index, baseIndent, kind);
      blocks.push(renderMarkdownList(items, `block-${key++}`, kind));
      index = nextIndex;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("#") &&
      !lines[index].trim().startsWith("- ") &&
      !/^\d+\. /.test(lines[index].trim()) &&
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

function formatSchemaPathForInlineNote(schemaPath: string): string {
  const normalizedPath = schemaPath.replace(/\\/g, "/");
  const dataIndex = normalizedPath.indexOf("data/");
  const projectRelativePath = dataIndex >= 0 ? normalizedPath.slice(dataIndex) : normalizedPath;
  const fileName = projectRelativePath.split("/").pop() ?? projectRelativePath;
  const directory = projectRelativePath.replace(`/${fileName}`, "");
  return `${fileName} in ${directory}`;
}

function workbookFamilyLabel(workbookName: string): string {
  if (workbookName.includes("Echelon")) {
    return "Echelon";
  }
  if (workbookName.includes("Elan")) {
    return "Elan";
  }
  if (workbookName.includes("Elite")) {
    return "Elite";
  }
  if (workbookName.includes("Epirus_Esprit")) {
    return "Epirus / Esprit";
  }
  if (workbookName.includes("Navigator_Javelin_Linx")) {
    return "Navigator / Javelin / Linx";
  }
  return workbookName.replace("Template for ", "").replace(" EUDAMED.xlsx", "");
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
  >("projectStructure");
  const [workbooks, setWorkbooks] = useState<WorkbookSummary[]>([]);
  const [referenceWorkbooks, setReferenceWorkbooks] = useState<ReferenceWorkbookSummary[]>([]);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetSummary | null>(null);
  const [sheetProfile, setSheetProfile] = useState<SheetProfile | null>(null);
  const [distinctValues, setDistinctValues] = useState<DistinctValueProfile | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>(focusColumns[0]);
  const [rules, setRules] = useState<NormalizationRuleFile[]>([]);
  const [schemas, setSchemas] = useState<SchemaInventory | null>(null);
  const [canonicalReview, setCanonicalReview] = useState<CanonicalReviewBundle | null>(null);
  const [echelonValidation, setEchelonValidation] = useState<EchelonValidationBundle | null>(null);
  const [mappingPreviewApplied, setMappingPreviewApplied] = useState<boolean>(false);
  const [selectedValidationRecordKey, setSelectedValidationRecordKey] = useState<string | null>(null);
  const [xmlGenerationMode, setXmlGenerationMode] = useState<XmlGenerationMode>("single");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState<boolean>(true);
  const [valueFilter, setValueFilter] = useState<string>("");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);
  const [isApplyingRules, setIsApplyingRules] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xmlPreview, setXmlPreview] = useState<SingleRecordXmlPreview | null>(null);
  const [batchXmlPreview, setBatchXmlPreview] = useState<BatchXmlPreview | null>(null);
  const [selectedBatchChunkSequence, setSelectedBatchChunkSequence] = useState<number>(1);
  const [isGeneratingXml, setIsGeneratingXml] = useState<boolean>(false);
  const documentationSections: DocumentationSection[] = [
    {
      id: "projectStructure",
      title: "Project Structure",
      markdown: projectStructureDocumentation,
    },
    {
      id: "architecturePosition",
      title: "Architecture Position",
      markdown: architecturePositionDocumentation,
    },
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
    {
      id: "softwareEngineeringPatterns",
      title: "Software Engineering Patterns",
      markdown: softwareEngineeringPatternsDocumentation,
    },
  ];
  const selectedDocumentationSection =
    documentationSections.find((section) => section.id === activeDocumentationSection) ??
    documentationSections[0];

  useEffect(() => {
    void Promise.all([
      api.workbooks(),
      api.referenceWorkbooks(),
      api.sheets(),
      api.normalizationRules(),
      api.canonicalReview(),
      api.echelonCanonicalValidation(),
      api.schemas(),
      api.distinctValues(selectedColumn),
    ])
      .then(([workbookData, referenceWorkbookData, sheetData, ruleData, canonicalData, echelonData, schemaData, distinctData]) => {
        setWorkbooks(workbookData);
        setReferenceWorkbooks(referenceWorkbookData);
        setSheets(sheetData);
        setRules(ruleData);
        setCanonicalReview(canonicalData);
        setEchelonValidation(echelonData);
        setSelectedValidationRecordKey(
          echelonData.sample_records[0]?.catalogue_number ?? echelonData.records[0]?.catalogue_number ?? null,
        );
        setSchemas(schemaData);
        setDistinctValues(distinctData);
        const firstVisibleWorkbook = workbookData.find((workbook) => workbook.in_scope_for_variant_mapping);
        const firstVisibleSheet =
          sheetData.find((sheet) => sheet.workbook === firstVisibleWorkbook?.workbook) ?? sheetData[0] ?? null;
        setSelectedSheet(firstVisibleSheet);
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

  useEffect(() => {
    setXmlPreview(null);
  }, [selectedValidationRecordKey, xmlGenerationMode]);

  useEffect(() => {
    setBatchXmlPreview(null);
  }, [selectedBatchChunkSequence]);

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
  const variantMappings = canonicalReview?.variant_mappings ?? [];
  const canonicalFieldCount =
    canonicalReview?.entity_reviews.reduce((total, entity) => total + entity.field_reviews.length, 0) ?? 0;
  const canonicalEntityNames = (canonicalReview?.entity_reviews ?? []).map((entity) => entity.entity_name);
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
      exampleSourceValues: fieldReview.mapping.example_source_values,
      exampleCanonicalValue: fieldReview.mapping.example_canonical_value,
    })),
  );
  const classificationCounts = canonicalMappingRows.reduce<Record<string, number>>((counts, row) => {
    counts[row.classification] = (counts[row.classification] ?? 0) + 1;
    return counts;
  }, {});
  const directCount = classificationCounts.direct ?? 0;
  const repeatedCount = classificationCounts.repeated ?? 0;
  const derivedRows = canonicalMappingRows.filter((row) => row.classification === "derived");
  const normalizedRows = canonicalMappingRows.filter((row) => row.classification === "normalized");
  const contextHeavyCount = derivedRows.length + normalizedRows.length;
  const validationRecords = echelonValidation?.records ?? [];
  const sampleValidationRecords = echelonValidation?.sample_records ?? [];
  const selectedValidationRecord =
    sampleValidationRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    validationRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    sampleValidationRecords[0] ??
    validationRecords[0] ??
    null;
  const activeCompleteness = mappingPreviewApplied
    ? selectedValidationRecord?.after_completeness ?? null
    : selectedValidationRecord?.before_completeness ?? null;
  const blockerSummaries = echelonValidation?.blocker_summaries ?? [];
  const resolvedBlockerHighlights = [...blockerSummaries]
    .filter((summary) => summary.before_missing_count > 0 && summary.after_missing_count === 0)
    .sort((left, right) => right.before_missing_count - left.before_missing_count)
    .slice(0, 3);
  const persistentBlockerHighlights = [...blockerSummaries]
    .filter((summary) => summary.after_missing_count > 0)
    .sort((left, right) => right.after_missing_count - left.after_missing_count)
    .slice(0, 3);
  const resolvedBlockerFieldCount = blockerSummaries.filter(
    (summary) => summary.before_missing_count > 0 && summary.after_missing_count === 0,
  ).length;
  const persistentBlockerFieldCount = blockerSummaries.filter(
    (summary) => summary.after_missing_count > 0,
  ).length;
  const visibleValidationFields = selectedValidationRecord
    ? [
        ...selectedValidationRecord.fields.map((field) => ({
          ...field,
          currentValue: mappingPreviewApplied ? field.after_value : field.before_value,
          currentSource: mappingPreviewApplied ? field.after_source : field.before_source,
        })),
        {
          canonical_path: "device_record.storage_conditions",
          business_label: "Storage Conditions",
          required: false,
          before_value: null,
          after_value: null,
          before_source: "derived" as const,
          after_source: "derived" as const,
          source_detail: selectedValidationRecord.storage_condition_items.length
            ? selectedValidationRecord.storage_condition_items.map((item) => item.source_fields.join(" + ")).join(" | ")
            : "No storage condition source fields are populated for this row.",
          update_reason: "Repeated structure. Review the structured items in the Selected Sample panel.",
          currentValue: selectedValidationRecord.storage_condition_items.length
            ? `${selectedValidationRecord.storage_condition_items.length} assembled item${selectedValidationRecord.storage_condition_items.length === 1 ? "" : "s"}`
            : "No assembled items",
          currentSource: "derived" as const,
        },
        {
          canonical_path: "device_record.warnings",
          business_label: "Critical Warnings",
          required: false,
          before_value: null,
          after_value: null,
          before_source: "derived" as const,
          after_source: "derived" as const,
          source_detail: selectedValidationRecord.critical_warning_items.length
            ? selectedValidationRecord.critical_warning_items.map((item) => item.source_fields.join(" + ")).join(" | ")
            : "No critical warning source fields are populated for this row.",
          update_reason: "Repeated structure. Review the structured items in the Selected Sample panel.",
          currentValue: selectedValidationRecord.critical_warning_items.length
            ? `${selectedValidationRecord.critical_warning_items.length} assembled item${selectedValidationRecord.critical_warning_items.length === 1 ? "" : "s"}`
            : "No assembled items",
          currentSource: "derived" as const,
        },
      ]
    : [];
  const xmlReadyRecords = validationRecords.filter((record) => record.after_completeness.status === "complete");
  const xmlBlockedRecords = validationRecords.filter((record) => record.after_completeness.status !== "complete");
  const selectedStorageExample = selectedValidationRecord?.storage_condition_items[0] ?? null;
  const selectedWarningExample = selectedValidationRecord?.critical_warning_items[0] ?? null;
  const selectedOpenBlockerPreview = selectedValidationRecord?.after_blockers.slice(0, 2) ?? [];
  const trackedValidationFieldCount = validationRecords[0]?.fields.length ?? sampleValidationRecords[0]?.fields.length ?? 0;
  const optionalValidationFieldCount = Math.max(
    trackedValidationFieldCount - (echelonValidation?.tracked_required_fields ?? 0),
    0,
  );
  const sourceFieldCoverageEntries = echelonValidation?.source_field_coverage ?? [];
  const coverageSummaryLookup = new Map(
    (echelonValidation?.source_field_coverage_summaries ?? []).map((summary) => [summary.status, summary]),
  );
  const representedFieldCount = coverageSummaryLookup.get("represented")?.field_count ?? 0;
  const partialFieldCount = coverageSummaryLookup.get("partially_represented")?.field_count ?? 0;
  const notRepresentedFieldCount = coverageSummaryLookup.get("not_yet_represented")?.field_count ?? 0;
  const deferredFieldCount = coverageSummaryLookup.get("deferred_by_design")?.field_count ?? 0;
  const totalWorkbookRows = workbooks.reduce((sum, workbook) => sum + workbook.total_rows, 0);
  const authoritativeReferenceWorkbook =
    referenceWorkbooks.find((workbook) => workbook.source_status === "authoritative") ?? null;
  const inScopeWorkbookCount = workbooks.filter((workbook) => workbook.in_scope_for_variant_mapping).length;
  const excludedWorkbookCount = workbooks.filter((workbook) => !workbook.in_scope_for_variant_mapping).length;
  const visibleWorkbooks = workbooks.filter((workbook) => workbook.in_scope_for_variant_mapping);
  const selectedWorkbookName = selectedSheet?.workbook ?? visibleWorkbooks[0]?.workbook ?? null;
  const selectedWorkbookSummary =
    visibleWorkbooks.find((workbook) => workbook.workbook === selectedWorkbookName) ?? visibleWorkbooks[0] ?? null;
  const workbookSheets = selectedWorkbookName
    ? sheets.filter((sheet) => sheet.workbook === selectedWorkbookName)
    : [];
  const selectedXmlRecord =
    xmlReadyRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    xmlReadyRecords[0] ??
    null;
  const xmlPreviewLines = selectedXmlRecord
    ? xmlPreview?.xml ??
      [
        "<!-- Generate XML to load the schema-valid Push message preview -->",
        `<catalogue-number>${selectedXmlRecord.catalogue_number ?? "PENDING"}</catalogue-number>`,
        `<udi-di>${selectedXmlRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
      ].join("\n")
    : "<!-- No XML-ready Echelon record is currently available -->";
  const batchChunkOptions = batchXmlPreview?.chunks ?? [];
  const selectedBatchValidation =
    xmlGenerationMode === "batch" ? batchXmlPreview?.selected_chunk_validation ?? null : xmlPreview?.validation ?? null;
  const validationStatusLabel = selectedBatchValidation
    ? selectedBatchValidation.valid
      ? "Schema valid"
      : "Schema invalid"
    : "Awaiting validation";
  const selectedSchemaLabel = selectedBatchValidation
    ? formatSchemaPathForInlineNote(selectedBatchValidation.schema_path)
    : null;
  const batchPreviewLines = batchXmlPreview?.selected_chunk_xml ??
    [
      "<!-- Generate batch XML to preview one chunked Push message -->",
      `<eligible-records>${xmlReadyRecords.length}</eligible-records>`,
      `<max-records-per-file>300</max-records-per-file>`,
    ].join("\n");
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
  const selectedWorkbookVariantMappings = variantMappings.filter(
    (mapping) => mapping.workbook === selectedWorkbookSummary?.workbook,
  );
  const selectedSheetVariantMapping =
    variantMappings.find(
      (mapping) => mapping.workbook === selectedSheet?.workbook && mapping.sheet === selectedSheet?.sheet,
    ) ?? null;
  const matchedVariantCount = variantMappings.filter((mapping) => mapping.match_status === "matched").length;
  const excludedVariantCount = variantMappings.filter((mapping) => mapping.match_status === "excluded").length;
  const unmatchedVariantCount = variantMappings.filter((mapping) => mapping.match_status === "unmatched").length;
  const familyWorkbookSummaries = visibleWorkbooks.reduce<
    { family: string; rows: number; postRows: number; patchRows: number }[]
  >((families, workbook) => {
    const family = workbookFamilyLabel(workbook.workbook);
    const variantRows = sheets.filter((sheet) => sheet.workbook === workbook.workbook);
    const mappingsForWorkbook = variantMappings.filter(
      (mapping) => mapping.workbook === workbook.workbook && mapping.match_status === "matched",
    );
    const postRows = mappingsForWorkbook
      .filter((mapping) => mapping.submission_operation === "POST")
      .reduce((sum, mapping) => {
        const sheet = variantRows.find((item) => item.sheet === mapping.sheet);
        return sum + (sheet?.data_rows ?? 0);
      }, 0);
    const patchRows = mappingsForWorkbook
      .filter((mapping) => mapping.submission_operation === "PATCH")
      .reduce((sum, mapping) => {
        const sheet = variantRows.find((item) => item.sheet === mapping.sheet);
        return sum + (sheet?.data_rows ?? 0);
      }, 0);
    families.push({
      family,
      rows: workbook.total_rows,
      postRows,
      patchRows,
    });
    return families;
  }, []);

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

  async function generateXmlPreview(): Promise<void> {
    if (!selectedXmlRecord?.catalogue_number) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    try {
      const preview = await api.previewEchelonXmlRecord(selectedXmlRecord.catalogue_number);
      setXmlPreview(preview);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate XML preview.");
    } finally {
      setIsGeneratingXml(false);
    }
  }

  async function downloadXmlRecord(): Promise<void> {
    if (!selectedXmlRecord?.catalogue_number) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    try {
      const { blob, fileName } = await api.downloadEchelonXmlRecord(selectedXmlRecord.catalogue_number);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName ?? xmlPreview?.file_name ?? `echelon-${selectedXmlRecord.catalogue_number}.xml`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to download XML.");
    } finally {
      setIsGeneratingXml(false);
    }
  }

  async function generateBatchXmlPreview(chunkSequence = selectedBatchChunkSequence): Promise<void> {
    setIsGeneratingXml(true);
    setError(null);
    try {
      const preview = await api.previewEchelonXmlBatch(chunkSequence);
      setBatchXmlPreview(preview);
      setSelectedBatchChunkSequence(preview.selected_chunk_sequence);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate batch XML preview.");
    } finally {
      setIsGeneratingXml(false);
    }
  }

  async function downloadBatchXml(): Promise<void> {
    setIsGeneratingXml(true);
    setError(null);
    try {
      const { blob, fileName } = await api.downloadEchelonXmlBatch();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName ?? batchXmlPreview?.package_file_name ?? "echelon-batch-package.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to download batch XML package.");
    } finally {
      setIsGeneratingXml(false);
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
              <h1>Review EUDAMED Excel Input</h1>
              <p className="hero-copy">
                Review imported workbook evidence, understand sheet structure, and identify data-quality
                or normalization issues without changing the source Excel files.
              </p>
            </>
          ) : null}
          {activeTab === "canonical" ? (
            <>
              <p className="eyebrow">Canonical Preparation</p>
              <h1>Review Canonical Model Contract</h1>
              <p className="hero-copy">
                An intermediary layer that preserves stable regulatory meaning before workbook values are
                projected into schema-specific XML.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <p className="eyebrow">Canonical Validation</p>
              <h1>Validate Echelon Mapping</h1>
              <p className="hero-copy">
                Review the Echelon subset and compare completeness before and after read-only Basic
                UDI-DI enrichment.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <p className="eyebrow">XML Generation</p>
              <h1>Generate Echelon EUDAMED XML</h1>
              <p className="hero-copy">
                Produce previewable payloads for the Echelon product family, validate them against the
                local schema set, and prepare controlled manual submission packages.
              </p>
            </>
          ) : null}
          {activeTab === "documentation" ? (
            <>
              <p className="eyebrow">Documentation</p>
              <h1>Application Architecture Documentation</h1>
              <p className="hero-copy">
                Documentation outlines the software engineering thought process, guiding principles,
                design realization, and future roadmap for the application.
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
                <span className="inline-stat-pill">{canonicalFieldCount} review-model definitions</span>
                are available in the canonical mapping view.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <span className="status-label">Validation scope</span>
              <span className="status-pill warn">{echelonValidation?.family_scope ?? "Echelon only"}</span>
              <p className="status-detail">
                {trackedValidationFieldCount
                  ? `${trackedValidationFieldCount} validation-subset fields are currently under review.`
                  : "Loading validation subset..."}
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <span className="status-label">Current phase</span>
              <span className={xmlReadyRecords.length ? "status-pill ok" : "status-pill warn"}>
                {xmlReadyRecords.length ? "Ready for XML" : "Blocked"}
              </span>
              <p className="status-detail">
                {xmlReadyRecords.length
                  ? `${xmlReadyRecords.length} validated Echelon record${xmlReadyRecords.length === 1 ? "" : "s"} are currently eligible for XML generation.`
                  : "XML generation remains downstream of canonical mapping and awaits validation-ready records."}
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
              <span className="summary-label">Workbook files</span>
              <strong>{visibleWorkbooks.length}</strong>
              <p>Imported Excel workbooks currently shown for active source review.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Variant mapping scope</span>
              <strong>{inScopeWorkbookCount}</strong>
              <p>Accessories_Footspares Template deliberately excluded.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Workbook tabs</span>
              <strong>{sheets.length}</strong>
              <p>Individual sheets available for structure, completeness, and value review.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Basic UDI source</span>
              <strong>{authoritativeReferenceWorkbook ? 1 : 0}</strong>
              <p>
                {authoritativeReferenceWorkbook
                  ? `${authoritativeReferenceWorkbook.workbook} is the active reference workbook.`
                  : "Authoritative Basic UDI source not found."}
              </p>
            </div>
          </section>

          <section className="panel family-scope-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Product Families</span>
                <h2>Registration Scope</h2>
              </div>
            </div>
            <p className="panel-copy">
              Detals of HTTP Post versus Patch update, reflecting current EUDAMED registration, by Product Family
            </p>
            <div className="family-scope-grid">
              {familyWorkbookSummaries.map((family) => (
                <div className="family-scope-card" key={family.family}>
                  <div className="family-scope-head">
                    <span className="summary-label">{family.family}</span>
                    <strong>{family.rows}</strong>
                  </div>
                  <div className="family-scope-pill-row">
                    <span className="status-pill ok compact">{family.postRows} POST</span>
                    <span className="status-pill warn compact">{family.patchRows} PATCH</span>
                  </div>
                </div>
              ))}
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
              <p className="panel-copy">
                Start here to see which source files are in scope. Select a workbook to inspect its sheets and data signals.
              </p>
              <div className="draft-list">
                {visibleWorkbooks.map((workbook) => {
                  const isActive = selectedWorkbookName === workbook.workbook;
                  const firstWorkbookSheet = sheets.find((sheet) => sheet.workbook === workbook.workbook);
                  return (
                    <button
                      key={workbook.workbook}
                      className={isActive ? "sheet-card active" : "sheet-card"}
                      type="button"
                      onClick={() => {
                        if (firstWorkbookSheet) {
                          setSelectedSheet(firstWorkbookSheet);
                        }
                      }}
                    >
                      <span className="sheet-title">{workbook.workbook}</span>
                      <small>{workbook.sheet_count} sheet{workbook.sheet_count === 1 ? "" : "s"}</small>
                      <small>{workbook.total_rows} rows</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Selected Workbook</span>
                  <h2>{selectedWorkbookSummary?.workbook ?? "No workbook selected"}</h2>
                </div>
              </div>
              {selectedWorkbookSummary ? (
                <>
                  <p className="panel-copy">
                    Read-only workbook detail for the currently selected source file. Use this view to understand sheet structure before looking at lower-level column and normalization detail.
                  </p>
                  <p className="panel-copy workbook-note-followup">
                    In the sheet list below, <strong>Default</strong> marks the sheet currently shown first for this workbook, while <strong>Present</strong> means the sheet exists in the workbook but is not the default sheet shown at startup.
                  </p>
                  <div className="queue-summary">
                    <div className="queue-chip">
                      <strong>{selectedWorkbookSummary.sheet_count}</strong>
                      <span>sheets</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedWorkbookSummary.total_rows}</strong>
                      <span>rows</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedWorkbookSummary.total_columns}</strong>
                      <span>tracked columns</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedWorkbookSummary.in_scope_for_variant_mapping ? "In scope" : "Excluded"}</strong>
                      <span>variant mapping</span>
                    </div>
                  </div>
                  {selectedWorkbookSummary.notes.length ? (
                    <p className="panel-copy workbook-note-followup">{selectedWorkbookSummary.notes.join(" ")}</p>
                  ) : null}
                  <table>
                    <thead>
                      <tr>
                        <th>Sheet</th>
                        <th>Basic UDI match</th>
                        <th>Rows</th>
                        <th>Populated columns</th>
                        <th>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workbookSheets.map((sheet) => {
                        const isActive = selectedSheet?.workbook === sheet.workbook && selectedSheet?.sheet === sheet.sheet;
                        const mapping =
                          selectedWorkbookVariantMappings.find((item) => item.sheet === sheet.sheet) ?? null;
                        return (
                          <tr key={`${sheet.workbook}-${sheet.sheet}`}>
                            <td>
                              <strong>{sheet.sheet}</strong>
                            </td>
                            <td>
                              <span
                                className={
                                  mapping?.match_status === "matched"
                                    ? "status-pill ok compact"
                                    : mapping?.match_status === "excluded"
                                      ? "status-pill warn compact"
                                      : "status-pill warn compact"
                                }
                              >
                                {mapping?.match_status === "matched"
                                  ? mapping.device_model
                                  : mapping?.match_status === "excluded"
                                    ? "Excluded"
                                    : "Unmatched"}
                              </span>
                            </td>
                            <td>{sheet.data_rows}</td>
                            <td>{sheet.populated_columns}</td>
                            <td>
                              <button
                                className="table-select-button"
                                type="button"
                                onClick={() => setSelectedSheet(sheet)}
                                disabled={isActive}
                              >
                                {isActive ? "Default" : "Present"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="panel-copy">No workbook is currently selected.</p>
              )}
            </div>
          </section>

          <section className="panel selected-sheet-panel workbook-stack-gap">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Selected Sheet</span>
                <h2>{selectedSheet ? `${selectedSheet.workbook} / ${selectedSheet.sheet}` : "No sheet selected"}</h2>
              </div>
            </div>
            {sheetProfile ? (
                <>
                  <p className="panel-copy">
                    This is the active sheet detail view. It provides a quick structure summary before deeper column or value-level review.
                  </p>
                  {selectedSheetVariantMapping ? (
                    <div className="queue-summary sheet-mapping-summary">
                      <div className="queue-chip">
                        <strong>
                          {selectedSheetVariantMapping.match_status === "matched"
                            ? selectedSheetVariantMapping.device_model
                            : titleCaseToken(selectedSheetVariantMapping.match_status)}
                        </strong>
                        <span>Basic UDI variant</span>
                      </div>
                      <div className="queue-chip">
                        <strong>{selectedSheetVariantMapping.submission_operation ?? "N/A"}</strong>
                        <span>operation</span>
                      </div>
                      <div className="queue-chip">
                        <strong>{selectedSheetVariantMapping.basic_udi_di ?? "N/A"}</strong>
                        <span>basic UDI-DI</span>
                      </div>
                      <div className="queue-chip">
                        <strong>{selectedSheetVariantMapping.available_market_country_count}</strong>
                        <span>market countries</span>
                      </div>
                    </div>
                  ) : null}
                  <ul className="supporting-bullets">
                    <li>
                      <strong>Data Rows:</strong> the number of populated source rows currently profiled in this sheet.
                    </li>
                    <li>
                      <strong>Profiled Columns:</strong> the number of columns with headers that the profiler is currently tracking for structure and value review.
                    </li>
                    <li>
                      <strong>Header Row:</strong> the worksheet row identified as the effective header row for profiling this sheet.
                    </li>
                  </ul>
                  <div className="queue-summary">
                    <div className="queue-chip">
                      <strong>{sheetProfile.data_rows}</strong>
                      <span>data rows</span>
                    </div>
                  <div className="queue-chip">
                    <strong>{sheetProfile.columns.length}</strong>
                    <span>profiled columns</span>
                  </div>
                  <div className="queue-chip">
                    <strong>{selectedSheet?.header_row ?? "Unknown"}</strong>
                      <span>header row</span>
                    </div>
                  </div>
                </>
            ) : (
              <p className="panel-copy">Select a sheet.</p>
            )}
          </section>

          <section className="summary-grid workbook-stack-gap">
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
                  <span className="section-kicker">Review Signals</span>
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
              <details className="group-accordion">
                <summary>
                  <span>Sheet Profile Detail</span>
                  <span className="status-pill ok compact">{sheetProfile?.columns.length ?? 0} columns</span>
                </summary>
                <div className="accordion-body">
                  {sheetProfile ? (
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
                  ) : (
                    <p className="panel-copy">Select a sheet to inspect column profile detail.</p>
                  )}
                </div>
              </details>
              <details className="group-accordion">
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
              <details className="group-accordion">
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
              <span className="summary-label">Matched variants</span>
              <strong>{matchedVariantCount}</strong>
              <p>Workbook sheets with exact `Device Model` matches in the authoritative Basic UDI workbook.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Excluded variants</span>
              <strong>{excludedVariantCount}</strong>
              <p>Workbook sheets intentionally deferred from active variant-level canonical linkage.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Unmatched variants</span>
              <strong>{unmatchedVariantCount}</strong>
              <p>Sheets currently lacking an exact Basic UDI `Device Model` match.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Authoritative source</span>
              <strong>{authoritativeReferenceWorkbook?.workbook ?? "Missing"}</strong>
              <p>Variant-level Basic UDI context is now resolved from the active reference workbook.</p>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Business Layer</span>
                <h2>Canonical Intermediary Model</h2>
              </div>
            </div>
            <p className="panel-copy">
              The canonical model sits between the source workbook and the target schema. It captures
              business and regulatory meaning in stable business terms so the application can retain the
              same semantics even when source headers vary, normalization is needed, or the final schema
              structure looks different from the source template.
            </p>
            <div className="canonical-summary-block">
              <div className="canonical-summary-item">
                <span className="summary-label">Scope in review</span>
                <p className="canonical-summary-inline">
                  {canonicalEntityCount} entity groups are currently defined for the first MDR UDI-DI load.
                  <span className="canonical-inline-pill-row">
                    <span className="canonical-entity-pill">{canonicalFieldCount} review-model definitions</span>
                  </span>
                  {canonicalEntityNames.length ? (
                    <span className="canonical-entity-pill-row" aria-label="Canonical entity groups">
                      {" "}
                      {canonicalEntityNames.map((entityName) => (
                        <span className="canonical-entity-pill" key={entityName}>
                          {entityName}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="canonical-summary-item">
                <span className="summary-label">Workbook-aligned fields</span>
                <p>
                  {directCount} fields map directly from workbook meaning into the canonical layer without
                  extra transformation logic.
                </p>
              </div>
              <div className="canonical-summary-item">
                <span className="summary-label">Normalization and derivation</span>
                <p>
                  {contextHeavyCount} fields need normalization or derivation so business meaning stays
                  stable before schema-specific codes or combined values are applied.
                </p>
              </div>
              <div className="canonical-summary-item">
                <span className="summary-label">Repeated structures</span>
                <p className="canonical-summary-inline">
                  {repeatedCount} fields are modeled as repeated business structures, including
                  <span className="canonical-inline-pill-row">
                    <span className="canonical-entity-pill">Storage Conditions</span>
                    <span className="canonical-entity-pill">Critical Warnings</span>
                  </span>,
                  before projection into nested schema elements.
                </p>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Variant Join</span>
                <h2>Workbook To Basic UDI Matching</h2>
              </div>
            </div>
            <p className="panel-copy">
              The canonical layer now resolves Basic UDI context per product variant. For in-scope family workbooks, the
              workbook sheet name is used as the primary join key to the authoritative `BasicUDIs.xlsx` `Device Model`.
            </p>
            <table className="mapping-contract-table">
              <thead>
                <tr>
                  <th>Workbook</th>
                  <th>Sheet</th>
                  <th>Basic UDI variant</th>
                  <th>Operation</th>
                  <th>Basic UDI-DI</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {variantMappings.map((mapping) => (
                  <tr key={`${mapping.workbook}-${mapping.sheet}`}>
                    <td>{mapping.workbook}</td>
                    <td>{mapping.sheet}</td>
                    <td>{mapping.device_model ?? "Pending"}</td>
                    <td>{mapping.submission_operation ?? "N/A"}</td>
                    <td>{mapping.basic_udi_di ?? "N/A"}</td>
                    <td>
                      <span
                        className={
                          mapping.match_status === "matched"
                            ? "status-pill ok compact"
                            : "status-pill warn compact"
                        }
                      >
                        {titleCaseToken(mapping.match_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              </colgroup>
              <thead>
                <tr>
                  <th>Excel field</th>
                  <th>Canonical field</th>
                  <th>Schema target</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {canonicalMappingRows.map((row) => (
                  <tr key={row.canonicalPath}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      ) : null}

      {activeTab === "canonicalValidation" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Total Echelon rows</span>
              <strong>{echelonValidation?.total_source_records ?? 0}</strong>
              <p>Source rows parsed from the Echelon family workbook across all family tabs.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Rows in scope</span>
              <strong>{echelonValidation?.validation_subset_records ?? 0}</strong>
              <p>All rows currently inherit the shared Echelon Basic UDI-DI family context.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Before mapping complete</span>
              <strong>{echelonValidation?.before_complete_records ?? 0}</strong>
              <p>Rows already complete before the Basic UDI-DI enrichment preview is applied.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">After mapping complete</span>
              <strong>{echelonValidation?.after_complete_records ?? 0}</strong>
              <p>Rows complete after the shared Basic UDI-DI family context is applied.</p>
            </div>
          </section>

          <section className="panel scope-banner-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Validation Scope</span>
                <h2>Echelon-Only Mapping Preview</h2>
              </div>
            </div>
            <p className="panel-copy">
              This Echelon-only preview tracks the current XML-facing validation subset for MDR
              UDI-DI generation. The workbook provides row-level device data, while a separate
              shared Basic UDI reference provides family-level context that is required to complete
              the XML-facing field set.
            </p>
            <p className="panel-copy scope-note-secondary">
              The pill counts summarize the tracked subset, required fields, optional fields, and
              represented source headers. Apply Basic UDI-DI mapping preview to show how that shared
              reference context enriches each row and resolves fields that are not present in the
              workbook alone.
            </p>
            <div className="queue-summary">
              <div className="queue-chip">
                <strong>{representedFieldCount}</strong>
                <span>represented source headers</span>
              </div>
              <div className="queue-chip">
                <strong>{echelonValidation?.matched_reference_records ?? 0}</strong>
                <span>rows inheriting family context</span>
              </div>
              <div className="queue-chip">
                <strong>{trackedValidationFieldCount}</strong>
                <span>tracked subset fields</span>
              </div>
              <div className="queue-chip">
                <strong>{echelonValidation?.tracked_required_fields ?? 0}</strong>
                <span>required for completeness</span>
              </div>
              <div className="queue-chip">
                <strong>{optionalValidationFieldCount}</strong>
                <span>optional fields</span>
              </div>
            </div>
          </section>

          <section className="summary-grid validation-phase-grid">
            <div className="summary-card">
              <span className="summary-label">Active view</span>
              <strong>{mappingPreviewApplied ? "After" : "Before"}</strong>
              <p>
                {mappingPreviewApplied
                  ? "Shows the read-only enrichment result after applying Basic UDI-DI mapping."
                  : "Shows the workbook-only state before Basic UDI-DI enrichment is applied."}
              </p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Mapped required fields</span>
              <strong>{activeCompleteness?.mapped_required_fields ?? 0}</strong>
              <p>Required fields currently populated in the selected validation view.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Missing required fields</span>
              <strong>{activeCompleteness?.missing_required_fields ?? 0}</strong>
              <p>Remaining blockers in the selected validation view for the tracked field set.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Completeness status</span>
              <strong>{titleCaseToken(activeCompleteness?.status ?? "incomplete")}</strong>
              <p>Measured against the tracked canonical fields in this preview bundle.</p>
            </div>
          </section>

          <section className="content-grid validation-layout">
            <div className="panel validation-equal-panel validation-summary-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">By Sheet</span>
                  <h2>Validation Summary</h2>
                </div>
              </div>
              <p className="panel-copy">
                The default view summarizes the full Echelon population by sheet so users can review
                completeness without scanning thousands of near-identical rows.
              </p>
              <p className="panel-copy scope-note-secondary">
                <span className="inline-stat-pill">{representedFieldCount} represented source headers</span>
                in `Workbook Coverage Summary` is a separate header-level measure, not a row-completeness count.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Sheet</th>
                    <th>Rows</th>
                    <th>Before complete</th>
                    <th>After complete</th>
                    <th>Missing fields</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {(echelonValidation?.sheet_summaries ?? []).map((summary) => {
                    const sheetSample = sampleValidationRecords.find(
                      (record) => record.source_sheet === summary.sheet_name,
                    );
                    return (
                      <tr key={summary.sheet_name}>
                        <td>{summary.sheet_name}</td>
                        <td>{summary.record_count}</td>
                        <td>{summary.before_complete_records}</td>
                        <td>{summary.after_complete_records}</td>
                        <td>
                          {mappingPreviewApplied
                            ? summary.after_missing_field_total
                            : summary.before_missing_field_total}
                        </td>
                        <td>
                          <button
                            className="table-select-button"
                            type="button"
                            onClick={() => setSelectedValidationRecordKey(sheetSample?.catalogue_number ?? null)}
                            disabled={!sheetSample}
                          >
                            Sample
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="panel validation-equal-panel validation-blockers-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Blockers</span>
                  <h2>Common Missing Fields</h2>
                </div>
              </div>
              <p className="panel-copy">
                This summary shows which tracked canonical fields were missing before enrichment and
                whether they remain missing after the shared Basic UDI-DI context is applied.
              </p>
              <div className="queue-summary">
                <div className="queue-chip">
                  <strong>{blockerSummaries.length}</strong>
                  <span>tracked blocker fields</span>
                </div>
                <div className="queue-chip">
                  <strong>{resolvedBlockerFieldCount}</strong>
                  <span>fully resolved after mapping</span>
                </div>
                <div className="queue-chip">
                  <strong>{persistentBlockerFieldCount}</strong>
                  <span>still missing after mapping</span>
                </div>
              </div>
              <div className="draft-list">
                <div className="draft-card">
                  <div className="draft-card-head">
                    <strong>Most improved</strong>
                    <span className="status-pill ok compact">{resolvedBlockerHighlights.length}</span>
                  </div>
                  {resolvedBlockerHighlights.length ? (
                    <ul className="compact-list validation-highlight-list">
                      {resolvedBlockerHighlights.map((summary) => (
                        <li key={summary.canonical_path}>
                          <strong>{summary.business_label}</strong>
                          <span>
                            {summary.before_missing_count} before, 0 after
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="panel-copy">No blocker fields are fully resolved by the shared mapping step.</p>
                  )}
                </div>
                <div className="draft-card">
                  <div className="draft-card-head">
                    <strong>Still open</strong>
                    <span
                      className={
                        persistentBlockerHighlights.length ? "status-pill warn compact" : "status-pill ok compact"
                      }
                    >
                      {persistentBlockerHighlights.length}
                    </span>
                  </div>
                  {persistentBlockerHighlights.length ? (
                    <ul className="compact-list validation-highlight-list">
                      {persistentBlockerHighlights.map((summary) => (
                        <li key={summary.canonical_path}>
                          <strong>{summary.business_label}</strong>
                          <span>
                            {summary.after_missing_count} rows still missing after mapping
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="panel-copy">No blocker fields remain open after the shared mapping preview.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="content-grid validation-layout">
            <div className="panel validation-equal-panel validation-samples-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Sample Records</span>
                  <h2>Representative Drilldown</h2>
                </div>
              </div>
              <p className="panel-copy">
                One representative row per sheet is available for detailed field-level inspection.
              </p>
              <div className="draft-list">
                {sampleValidationRecords.map((record) => {
                  const isSelected = selectedValidationRecord?.catalogue_number === record.catalogue_number;
                  return (
                    <button
                      key={`${record.source_sheet}-${record.catalogue_number}`}
                      className={isSelected ? "sheet-card active validation-sample-card" : "sheet-card validation-sample-card"}
                      type="button"
                      onClick={() => setSelectedValidationRecordKey(record.catalogue_number)}
                    >
                      <span className="sheet-title">{record.source_sheet}</span>
                      <small>{record.catalogue_number}</small>
                      <small>{record.trade_name ?? "No trade name"}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel validation-equal-panel validation-selected-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Selected Sample</span>
                  <h2>{selectedValidationRecord?.catalogue_number ?? "No sample selected"}</h2>
                </div>
                {selectedValidationRecord ? (
                  <span className="status-pill ok compact">
                    {selectedValidationRecord.reference_match_status === "matched"
                      ? "Basic UDI match resolved"
                      : "Reference missing"}
                  </span>
                ) : null}
              </div>
              {selectedValidationRecord ? (
                <>
                  <div className="queue-summary">
                    <div className="queue-chip">
                      <strong>
                        {selectedValidationRecord.source_sheet} · row {selectedValidationRecord.source_row_index}
                      </strong>
                      <span>source position</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedValidationRecord.basic_reference_name ?? "Unknown"}</strong>
                      <span>basic model</span>
                    </div>
                  </div>
                  <div className="workflow-note validation-record-note">
                    <strong>{selectedValidationRecord.trade_name}</strong>
                    <span>
                      UDI-DI {selectedValidationRecord.primary_udi_di} · Issuing entity{" "}
                      {selectedValidationRecord.issuing_entity ?? "Unknown"}
                    </span>
                  </div>
                  <div className="draft-list">
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Mapping snapshot</strong>
                        <span
                          className={
                            selectedValidationRecord.after_blockers.length
                              ? "status-pill warn compact"
                              : "status-pill ok compact"
                          }
                        >
                          {selectedValidationRecord.before_blockers.length} to{" "}
                          {selectedValidationRecord.after_blockers.length}
                        </span>
                      </div>
                      <div className="queue-summary">
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.before_blockers.length}</strong>
                          <span>before mapping</span>
                        </div>
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.after_blockers.length}</strong>
                          <span>after mapping</span>
                        </div>
                      </div>
                      {selectedValidationRecord.after_blockers.length ? (
                        <ul className="compact-list validation-highlight-list">
                          {selectedOpenBlockerPreview.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="panel-copy">
                          All tracked fields are populated after the Basic UDI-DI mapping preview.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="draft-list">
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Repeated structures</strong>
                        <span className="status-pill ok compact">
                          {selectedValidationRecord.storage_condition_items.length +
                            selectedValidationRecord.critical_warning_items.length}
                        </span>
                      </div>
                      <div className="queue-summary">
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.storage_condition_items.length}</strong>
                          <span>storage items</span>
                        </div>
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.critical_warning_items.length}</strong>
                          <span>warning items</span>
                        </div>
                      </div>
                      {selectedStorageExample ? (
                        <div className="field-source-note validation-example-note">
                          Storage example: {selectedStorageExample.item_type ?? "Unspecified type"}
                          {selectedStorageExample.normalized_code
                            ? ` -> ${selectedStorageExample.normalized_code}`
                            : " -> schema code pending"}
                        </div>
                      ) : null}
                      {selectedWarningExample ? (
                        <div className="field-source-note validation-example-note">
                          Warning example: {selectedWarningExample.item_type ?? "Unspecified warning"}
                          {selectedWarningExample.normalized_code
                            ? ` -> ${selectedWarningExample.normalized_code}`
                            : " -> schema code pending"}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="panel-copy">No Echelon rows currently have Basic UDI reference coverage.</p>
              )}
            </div>
          </section>

          <details className="panel group-accordion" open={false}>
            <summary>
              <span>Selected Row Evidence</span>
              <span className="accordion-summary-pills">
                <span className="status-pill ok compact">{trackedValidationFieldCount} tracked fields</span>
                <span className={mappingPreviewApplied ? "status-pill ok compact" : "status-pill warn compact"}>
                  {mappingPreviewApplied ? "After mapping" : "Before mapping"}
                </span>
              </span>
            </summary>
            <div className="accordion-body">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Single-Value Field Evidence</span>
                  <h2>{mappingPreviewApplied ? "After Mapping Preview" : "Before Mapping Preview"}</h2>
                </div>
                <button
                  className="action-button"
                  type="button"
                  onClick={() => setMappingPreviewApplied((current) => !current)}
                  disabled={!selectedValidationRecord}
                >
                  {mappingPreviewApplied ? "Show before mapping" : "Apply Basic UDI-DI mapping preview"}
                </button>
              </div>
              <p className="panel-copy">
                This table shows the flat canonical fields for the selected sample row only. It does not include
                repeated structures such as storage conditions or critical warnings; those are shown above as
                assembled item lists because one row can contain multiple items.
              </p>
              {visibleValidationFields.length ? (
                <table>
                  <thead>
                    <tr>
                      <th>Canonical field</th>
                      <th>Current value</th>
                      <th>Source</th>
                      <th>Update note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleValidationFields.map((field) => (
                      <tr key={field.canonical_path}>
                        <td>
                          <strong>{field.business_label}</strong>
                          <br />
                          <code>{field.canonical_path}</code>
                        </td>
                        <td>{field.currentValue ?? "Missing"}</td>
                        <td>
                          <span
                            className={
                              field.currentSource === "missing"
                                ? "status-pill warn compact"
                                : "status-pill ok compact"
                            }
                          >
                            {titleCaseToken(field.currentSource)}
                          </span>
                          <div className="field-source-note">{field.source_detail}</div>
                        </td>
                        <td>{field.update_reason ?? "No change required for this field."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="panel-copy">Select a sample record to inspect field-level evidence.</p>
              )}
            </div>
          </details>

          <details className="panel group-accordion" open={false}>
            <summary>
              <span>Workbook Coverage Summary</span>
              <span className="status-pill ok compact">{echelonValidation?.source_field_total ?? 0} headers</span>
            </summary>
            <div className="accordion-body">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Source Field Coverage</span>
                  <h2>Echelon Header Coverage</h2>
                </div>
              </div>
              <p className="panel-copy">
                This summary compares the unique source headers in the Echelon workbook against the current
                canonical/XML-facing review path. It is header coverage only, not row-population completeness, and
                acts as a readiness summary before moving into XML generation.
              </p>
              <section className="summary-grid coverage-summary-grid">
                <div className="summary-card">
                  <span className="summary-label">Headers reviewed</span>
                  <strong>{echelonValidation?.source_field_total ?? 0}</strong>
                  <p>Unique source headers across the Echelon workbook family tabs.</p>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Represented</span>
                  <strong>{representedFieldCount}</strong>
                  <p>Headers with a documented place in the current canonical/XML-facing path.</p>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Partially represented</span>
                  <strong>{partialFieldCount}</strong>
                  <p>Headers recognized in the model, but only partially covered because the structure is richer than the current implementation.</p>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Not represented</span>
                  <strong>{notRepresentedFieldCount + deferredFieldCount}</strong>
                  <p>Headers without current documented coverage in the active canonical review path.</p>
                </div>
              </section>
              <table className="coverage-table">
                <colgroup>
                  <col className="coverage-col-source" />
                  <col className="coverage-col-status" />
                  <col className="coverage-col-canonical" />
                  <col className="coverage-col-schema" />
                  <col className="coverage-col-notes" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Source field</th>
                    <th>Status</th>
                    <th>Canonical target</th>
                    <th>Schema target</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceFieldCoverageEntries.map((entry) => (
                    <tr key={entry.source_field}>
                      <td>
                        <strong>{entry.source_field}</strong>
                        <div className="field-source-note">{entry.source_sheets.join(", ")}</div>
                      </td>
                      <td>
                        <span
                          className={
                            entry.coverage_status === "represented"
                              ? "status-pill ok compact"
                              : entry.coverage_status === "partially_represented"
                                ? "status-pill warn compact"
                                : "status-pill compact"
                          }
                        >
                          {titleCaseToken(entry.coverage_status)}
                        </span>
                      </td>
                      <td>
                        {entry.canonical_targets.length ? (
                          entry.canonical_targets.map((target) => <div key={target}><code>{target}</code></div>)
                        ) : (
                          "None yet"
                        )}
                      </td>
                      <td>
                        {entry.schema_targets.length ? (
                          entry.schema_targets.map((target) => <div key={target}><code>{target}</code></div>)
                        ) : (
                          "None yet"
                        )}
                      </td>
                      <td>{entry.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      ) : null}

      {activeTab === "xml" ? (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Validated rows</span>
              <strong>{validationRecords.length}</strong>
              <p>Rows available from the Echelon canonical validation workspace.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">XML-ready rows</span>
              <strong>{xmlReadyRecords.length}</strong>
              <p>Rows whose post-mapping completeness is currently suitable for XML projection.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Blocked rows</span>
              <strong>{xmlBlockedRecords.length}</strong>
              <p>Rows that would need canonical validation fixes before XML generation should include them.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Schema target</span>
              <strong>UDIDIType.xsd</strong>
              <p>The XML workspace is currently designed around the first-phase MDR UDI-DI schema target.</p>
            </div>
          </section>

          <section className="panel scope-banner-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Dependency Gate</span>
                <h2>XML Generation Depends On Canonical Validation</h2>
              </div>
              <span className={xmlReadyRecords.length ? "status-pill ok compact" : "status-pill warn compact"}>
                {xmlReadyRecords.length ? "Validation-ready records available" : "Validation gate not yet met"}
              </span>
            </div>
            <p className="panel-copy">
              This workspace consumes the validated Echelon mapping output. If a record is blocked in
              canonical validation, it should not be included in XML generation.
            </p>
            <div className="queue-summary">
              <div className="queue-chip">
                <strong>{echelonValidation?.family_scope ?? "Echelon only"}</strong>
                <span>generation scope</span>
              </div>
              <div className="queue-chip">
                <strong>{echelonValidation?.matched_reference_records ?? 0}</strong>
                <span>rows with shared Basic UDI context</span>
              </div>
              <div className="queue-chip">
                <strong>{xmlBlockedRecords.length}</strong>
                <span>rows excluded until resolved</span>
              </div>
            </div>
          </section>

          <section className="content-grid xml-mode-layout">
            <div className="panel xml-mode-panel xml-equal-panel xml-top-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Mode</span>
                  <h2>Generation Mode</h2>
                </div>
              </div>
              <div className="xml-mode-toggle">
                <button
                  className={xmlGenerationMode === "single" ? "nav-link active xml-mode-button" : "nav-link xml-mode-button"}
                  type="button"
                  onClick={() => setXmlGenerationMode("single")}
                >
                  Single record
                </button>
                <button
                  className={xmlGenerationMode === "batch" ? "nav-link active xml-mode-button" : "nav-link xml-mode-button"}
                  type="button"
                  onClick={() => setXmlGenerationMode("batch")}
                >
                  Full family batch
                </button>
              </div>
              <p className="panel-copy">
                Start with a single validated record for schema testing, then move to a full-family batch
                once the single-record payload shape is stable.
              </p>
            </div>

            <div className="panel xml-readiness-panel xml-equal-panel xml-top-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Readiness</span>
                  <h2>Generation Summary</h2>
                </div>
              </div>
              <div className="draft-list">
                <div className="draft-card">
                  <div className="draft-card-head">
                    <strong>Included</strong>
                    <span className="status-pill ok compact">{xmlReadyRecords.length}</span>
                  </div>
                  <p className="panel-copy">Records that would currently be eligible for XML generation.</p>
                </div>
                <div className="draft-card">
                  <div className="draft-card-head">
                    <strong>Excluded</strong>
                    <span className="status-pill warn compact">{xmlBlockedRecords.length}</span>
                  </div>
                  <p className="panel-copy">
                    Records blocked by canonical validation and therefore excluded from downstream XML scope.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="content-grid xml-mode-layout">
            {xmlGenerationMode === "single" ? (
              <>
                <div className="panel xml-workspace-panel xml-equal-panel xml-middle-panel">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">Single Record</span>
                      <h2>Record Selection</h2>
                    </div>
                  </div>
                  <p className="panel-copy">
                    Choose one validated Echelon record to use as the first XML generation and schema-validation target.
                  </p>
                  <div className="control-row xml-control-row">
                    <select
                      value={selectedXmlRecord?.catalogue_number ?? ""}
                      onChange={(event) => setSelectedValidationRecordKey(event.target.value)}
                    >
                      {xmlReadyRecords.map((record) => (
                        <option key={record.catalogue_number ?? record.primary_udi_di ?? record.source_row_index} value={record.catalogue_number ?? ""}>
                          {record.catalogue_number} · {record.source_sheet}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedXmlRecord ? (
                    <div className="draft-list">
                      <div className="draft-card">
                        <div className="draft-card-head">
                          <strong>{selectedXmlRecord.catalogue_number}</strong>
                          <span className="status-pill ok compact">XML-ready</span>
                        </div>
                        <p className="draft-meta">{selectedXmlRecord.source_sheet} · row {selectedXmlRecord.source_row_index}</p>
                        <p className="panel-copy">{selectedXmlRecord.trade_name}</p>
                        <p className="panel-copy">
                          UDI-DI {selectedXmlRecord.primary_udi_di} · Basic context {selectedXmlRecord.basic_reference_name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="panel-copy">No XML-ready Echelon record is currently available.</p>
                  )}
                  <div className="draft-actions-bar">
                    <button
                      className="action-button"
                      type="button"
                      onClick={() => void generateXmlPreview()}
                      disabled={!selectedXmlRecord || isGeneratingXml}
                    >
                      {isGeneratingXml ? "Generating..." : "Generate XML"}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void generateXmlPreview()}
                      disabled={!selectedXmlRecord || isGeneratingXml}
                    >
                      Validate Against XSD
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void downloadXmlRecord()}
                      disabled={!selectedXmlRecord || isGeneratingXml}
                    >
                      Download XML
                    </button>
                  </div>
                  <div className="workflow-note">
                    <strong>Validation result</strong>
                    <span>
                      {selectedBatchValidation
                        ? `${validationStatusLabel} against ${selectedSchemaLabel}${selectedBatchValidation.errors.length ? ` · ${selectedBatchValidation.errors.length} issue${selectedBatchValidation.errors.length === 1 ? "" : "s"}` : ""}.`
                        : "Use Generate XML or Validate Against XSD to populate the validation result."}
                    </span>
                  </div>
                </div>

                <div className="panel xml-preview-panel xml-equal-panel xml-middle-panel">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">Preview</span>
                      <h2>Single Record XML Preview</h2>
                    </div>
                  </div>
                  <pre className="xml-preview-block">
                    <code>{xmlPreviewLines}</code>
                  </pre>
                  <div className="workflow-note">
                    <strong>Preview status</strong>
                    <span>
                      {xmlPreview
                        ? `Preview generated for ${xmlPreview.catalogue_number}.`
                        : "No XML preview generated yet for the selected record."}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="panel xml-workspace-panel xml-equal-panel xml-middle-panel">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">Batch</span>
                      <h2>Full Family Batch Scope</h2>
                    </div>
                  </div>
                  <p className="panel-copy">
                    Batch generation will include all validation-ready Echelon rows and report any excluded rows separately.
                  </p>
                  <div className="draft-list">
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Included rows</strong>
                        <span className="status-pill ok compact">{xmlReadyRecords.length}</span>
                      </div>
                      <p className="panel-copy">Validation-ready rows that would enter the batch payload set.</p>
                    </div>
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Excluded rows</strong>
                        <span className="status-pill warn compact">{xmlBlockedRecords.length}</span>
                      </div>
                      <p className="panel-copy">Rows still blocked by canonical validation and omitted from the batch.</p>
                    </div>
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Chunk limit</strong>
                        <span className="status-pill ok compact">300</span>
                      </div>
                      <p className="panel-copy">Each wrapped Push message may contain at most 300 device entries.</p>
                    </div>
                  </div>
                  <div className="control-row xml-control-row">
                    <select
                      value={selectedBatchChunkSequence}
                      onChange={(event) => setSelectedBatchChunkSequence(Number(event.target.value))}
                      disabled={!batchChunkOptions.length}
                    >
                      {(batchChunkOptions.length ? batchChunkOptions : [{ sequence: 1, file_name: "Chunk 1" }]).map((chunk) => (
                        <option key={chunk.sequence} value={chunk.sequence}>
                          {`Chunk ${chunk.sequence}${"record_count" in chunk ? ` · ${chunk.record_count} rows` : ""}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="draft-actions-bar">
                    <button className="action-button" type="button" onClick={() => void generateBatchXmlPreview()} disabled={!xmlReadyRecords.length || isGeneratingXml}>
                      {isGeneratingXml ? "Generating..." : "Generate Batch XML"}
                    </button>
                    <button className="ghost-button" type="button" onClick={() => void generateBatchXmlPreview()} disabled={!xmlReadyRecords.length || isGeneratingXml}>
                      Validate Batch
                    </button>
                    <button className="ghost-button" type="button" onClick={() => void downloadBatchXml()} disabled={!xmlReadyRecords.length || isGeneratingXml}>
                      Download Batch Package
                    </button>
                  </div>
                  <div className="workflow-note">
                    <strong>Validation result</strong>
                    <span>
                      {selectedBatchValidation
                        ? `Selected chunk is ${selectedBatchValidation.valid ? "schema valid" : "schema invalid"} against ${selectedSchemaLabel}${selectedBatchValidation.errors.length ? ` · ${selectedBatchValidation.errors.length === 1 ? "" : "s"}` : ""}.`
                        : "Generate Batch XML or Validate Batch to populate the chunk validation result."}
                    </span>
                  </div>
                </div>

                <div className="panel xml-preview-panel xml-equal-panel xml-middle-panel">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">Batch Output</span>
                      <h2>Family Batch Preview</h2>
                    </div>
                  </div>
                  <pre className="xml-preview-block">
                    <code>{batchPreviewLines}</code>
                  </pre>
                  <div className="workflow-note">
                    <strong>Preview status</strong>
                    <span>
                      {batchXmlPreview
                        ? `Chunk ${batchXmlPreview.selected_chunk_sequence} preview generated for ${batchXmlPreview.selected_chunk_record_count} record${batchXmlPreview.selected_chunk_record_count === 1 ? "" : "s"}.`
                        : "No batch preview generated yet."}
                    </span>
                  </div>
                  {batchXmlPreview ? (
                    <div className="roadmap-list compact-structured-list">
                      {batchXmlPreview.chunks.map((chunk) => (
                        <div className="roadmap-item compact-structured-item" key={chunk.sequence}>
                          <strong>{chunk.file_name}</strong>
                          <p>
                            {chunk.record_count} rows · {chunk.first_catalogue_number ?? "Unknown"} to{" "}
                            {chunk.last_catalogue_number ?? "Unknown"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <section className="content-grid xml-mode-layout">
            <div className="panel xml-equal-panel xml-bottom-panel xml-validation-bottom-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Validation</span>
                  <h2>XSD Validation Workspace</h2>
                </div>
              </div>
              <div className="draft-list">
                <div className="draft-card">
                  <div className="draft-card-head">
                    <strong>Schema target</strong>
                    <span className="status-pill ok compact">UDIDIType.xsd</span>
                  </div>
                  <p className="panel-copy">
                    Generated XML is validated against the wrapped EUDAMED service-message schema set rooted at `Message.xsd`.
                  </p>
                </div>
                <div className="draft-card">
                  <div className="draft-card-head">
                    <strong>Validation output</strong>
                    <span className={selectedBatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                      {selectedBatchValidation
                        ? selectedBatchValidation.valid
                          ? "Schema valid"
                          : "Schema invalid"
                        : "Awaiting preview"}
                    </span>
                  </div>
                  {selectedBatchValidation ? (
                    <>
                      <p className="panel-copy">{selectedBatchValidation.schema_path}</p>
                      {selectedBatchValidation.errors.length ? (
                        <div className="roadmap-list">
                          {selectedBatchValidation.errors.slice(0, 5).map((issue, index) => (
                            <div className="roadmap-item" key={`${issue.line ?? 0}-${issue.column ?? 0}-${index}`}>
                              <strong>
                                Line {issue.line ?? "?"}, column {issue.column ?? "?"}
                              </strong>
                              <p>{issue.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="panel-copy">
                          {xmlGenerationMode === "batch"
                            ? "The selected batch chunk validates cleanly against the service-message schema set."
                            : "The generated single-record Push message validates cleanly."}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="panel-copy">
                      {xmlGenerationMode === "batch"
                        ? "Generate a batch preview to inspect the chunk-level schema validation outcome."
                        : "Generate a single-record preview to inspect the schema validation outcome."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="panel xml-equal-panel xml-bottom-panel xml-handoff-bottom-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Guide</span>
                  <h2>Recommended XML Workflow</h2>
                </div>
              </div>
              <div className="roadmap-list">
                <div className="roadmap-item">
                  <strong>1. Validate Canonical</strong>
                  <p>Confirm the selected Echelon records are complete before entering XML generation.</p>
                </div>
                <div className="roadmap-item">
                  <strong>2. Generate Single XML</strong>
                  <p>Start with one XML-ready record to confirm payload shape and mapped values.</p>
                </div>
                <div className="roadmap-item">
                  <strong>3. Validate Against Schema</strong>
                  <p>Validate the wrapped Push message before any download or batch run.</p>
                </div>
                <div className="roadmap-item">
                  <strong>4. Download Single XML</strong>
                  <p>Download the reviewed single-record file for controlled inspection.</p>
                </div>
                <div className="roadmap-item">
                  <strong>5. Generate Batch XML</strong>
                  <p>Generate the Echelon batch package in chunks of up to 300 devices.</p>
                </div>
                <div className="roadmap-item">
                  <strong>6. Validate Batch Against Schema</strong>
                  <p>Review a batch chunk preview and confirm the package validates cleanly.</p>
                </div>
                <div className="roadmap-item">
                  <strong>7. Download Batch Package</strong>
                  <p>Download the zip package containing the XML chunk files and manifest.</p>
                </div>
              </div>
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === "documentation" ? (
        <section className="tab-stack">
          <section className="documentation-layout">
            <aside className="panel documentation-sidebar">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Contents</span>
                  <h2>Documentation</h2>
                </div>
              </div>
              <p className="panel-copy">
                Jump between the primary workflow stages and the new cross-cutting reference docs that explain how the
                application is structured.
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
