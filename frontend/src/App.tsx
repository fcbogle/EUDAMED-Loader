import { useEffect, useState } from "react";

import { api } from "./api";
import architecturePositionDocumentation from "./content/docs/architecture-position.md?raw";
import canonicalDocumentation from "./content/docs/canonical.md?raw";
import canonicalValidationDocumentation from "./content/docs/canonical-validation.md?raw";
import dataInterpretationDocumentation from "./content/docs/data-interpretation.md?raw";
import eudamedServiceContractFindingsDocumentation from "./content/docs/eudamed-service-contract-findings.md?raw";
import projectStructureDocumentation from "./content/docs/project-structure.md?raw";
import roadmapDocumentation from "./content/docs/roadmap.md?raw";
import softwareEngineeringPatternsDocumentation from "./content/docs/software-engineering-patterns.md?raw";
import testingScenariosDocumentation from "./content/docs/testing-scenarios.md?raw";
import workbooksDocumentation from "./content/docs/workbooks.md?raw";
import xmlGenerationDocumentation from "./content/docs/xml-generation.md?raw";
import xmlSampleComparisonDocumentation from "./content/docs/xml-sample-comparison.md?raw";
import type {
  BatchXmlPreview,
  CanonicalValidationBundle,
  CanonicalReviewBundle,
  DistinctValueProfile,
  EquivalentPatchPairPreview,
  MarketInfoPutPreview,
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
    | "dataInterpretation"
    | "eudamedServiceContractFindings"
    | "testingScenarios"
    | "xml"
    | "xmlSampleComparison"
    | "roadmap"
    | "projectStructure"
    | "softwareEngineeringPatterns";
  title: string;
  markdown: string;
};

type DocumentationGroup = {
  id: "project" | "dataCanonical" | "xmlService" | "verification";
  title: string;
  sectionIds: DocumentationSection["id"][];
};

type CanonicalMappingRow = {
  entityName: string;
  entityPath: string;
  excelField: string;
  canonicalPath: string;
  businessLabel: string;
  schemaTarget: string;
  schemaFile: string;
  classification: string;
  reviewNotes: string;
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

function basicUdiMatchLabel(matchStatus: string | null | undefined): string {
  if (matchStatus === "matched") {
    return "Matched in BasicUDIs.xlsx";
  }
  if (matchStatus === "excluded") {
    return "Excluded from Basic UDI mapping";
  }
  if (matchStatus === "unmatched") {
    return "Unmatched in BasicUDIs.xlsx";
  }
  return "Basic UDI mapping unknown";
}

function basicUdiMatchPillClass(matchStatus: string | null | undefined): string {
  if (matchStatus === "matched") {
    return "status-pill ok compact";
  }
  return "status-pill warn compact";
}

function formatSchemaPathForInlineNote(schemaPath: string): string {
  const normalizedPath = schemaPath.replace(/\\/g, "/");
  const dataIndex = normalizedPath.indexOf("data/");
  const projectRelativePath = dataIndex >= 0 ? normalizedPath.slice(dataIndex) : normalizedPath;
  const fileName = projectRelativePath.split("/").pop() ?? projectRelativePath;
  const directory = projectRelativePath.replace(`/${fileName}`, "");
  return `${fileName} in ${directory}`;
}

function schemaFileForTarget(schemaPath: string): string {
  if (schemaPath.startsWith("UDIDIType/")) {
    return "data/schemas/data/Entity/Device/RegulationDevice/UDIDIType.xsd";
  }
  if (schemaPath.startsWith("UDIDIDataType/")) {
    return "data/schemas/data/Entity/Device/LegacyDevice/EUUDIDIDataType.xsd";
  }
  if (schemaPath.startsWith("BasicUDIType/")) {
    return "data/schemas/data/Entity/Device/RegulationDevice/BasicUDIType.xsd";
  }
  if (schemaPath.startsWith("DeviceBasicUDIType/")) {
    return "data/schemas/data/Entity/Device/RegulationDevice/BasicUDIType.xsd";
  }
  if (schemaPath.startsWith("MDRBasicUDIType/")) {
    return "data/schemas/data/Entity/Device/RegulationDevice/BasicUDIType.xsd";
  }
  if (schemaPath.startsWith("DeviceUDIDIDataType/")) {
    return "data/schemas/data/Entity/Device/LegacyDevice/EUUDIDIDataType.xsd";
  }
  if (schemaPath.startsWith("MDRUDIDIDataType/")) {
    return "data/schemas/data/Entity/Device/LegacyDevice/EUUDIDIDataType.xsd";
  }
  if (schemaPath.startsWith("CommonDeviceType/")) {
    return "data/schemas/data/Entity/Device/CommonDeviceType.xsd";
  }
  if (schemaPath.startsWith("MarketInfoType/")) {
    return "data/schemas/data/Entity/MarketInfo/MarketInfoType.xsd";
  }
  if (schemaPath.startsWith("MarketInfosType/")) {
    return "data/schemas/data/Entity/MarketInfo/MarketInfoType.xsd";
  }
  if (schemaPath.startsWith("ServiceType/")) {
    return "data/schemas/service/Service/ServiceType.xsd";
  }
  if (schemaPath.startsWith("Entity/")) {
    return "data/schemas/data/Entity/Entity.xsd";
  }
  return "Schema file under review";
}

function schemaFamilyForTarget(schemaPath: string): string {
  if (schemaPath.startsWith("UDIDIType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("UDIDIDataType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("BasicUDIType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("DeviceBasicUDIType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("MDRBasicUDIType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("DeviceUDIDIDataType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("MDRUDIDIDataType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("CommonDeviceType/")) {
    return "Business payload";
  }
  if (schemaPath.startsWith("MarketInfoType/")) {
    return "Market information";
  }
  if (schemaPath.startsWith("MarketInfosType/")) {
    return "Market information";
  }
  if (schemaPath.startsWith("ServiceType/")) {
    return "Service envelope";
  }
  if (schemaPath.startsWith("Entity/")) {
    return "Base entity metadata";
  }
  return "Under review";
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
  const [selectedColumn] = useState<string>(focusColumns[0]);
  const [rules, setRules] = useState<NormalizationRuleFile[]>([]);
  const [schemas, setSchemas] = useState<SchemaInventory | null>(null);
  const [canonicalReview, setCanonicalReview] = useState<CanonicalReviewBundle | null>(null);
  const [canonicalValidation, setCanonicalValidation] = useState<CanonicalValidationBundle | null>(null);
  const [validationStepsOpen, setValidationStepsOpen] = useState<boolean>(false);
  const [selectedValidationRecordKey, setSelectedValidationRecordKey] = useState<string | null>(null);
  const [selectedValidationFamily, setSelectedValidationFamily] = useState<string | null>(null);
  const [selectedValidationVariant, setSelectedValidationVariant] = useState<string | null>(null);
  const [selectedXmlFamily, setSelectedXmlFamily] = useState<string | null>(null);
  const [selectedXmlVariant, setSelectedXmlVariant] = useState<string | null>(null);
  const [selectedXmlRecordKey, setSelectedXmlRecordKey] = useState<string | null>(null);
  const [xmlMode, setXmlMode] = useState<"pair" | "single" | "marketInfo" | "batch">("pair");
  const [pairPreviewView, setPairPreviewView] = useState<"post" | "patch">("post");
  const [selectedXmlChunkSequence, setSelectedXmlChunkSequence] = useState<number>(1);
  const [scopeMode] = useState<ScopeMode>("all");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState<boolean>(true);
  const [valueFilter, setValueFilter] = useState<string>("");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);
  const [isApplyingRules, setIsApplyingRules] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xmlPreview, setXmlPreview] = useState<SingleRecordXmlPreview | null>(null);
  const [xmlBatchPreview, setXmlBatchPreview] = useState<BatchXmlPreview | null>(null);
  const [xmlPairPreview, setXmlPairPreview] = useState<EquivalentPatchPairPreview | null>(null);
  const [xmlMarketInfoPreview, setXmlMarketInfoPreview] = useState<MarketInfoPutPreview | null>(null);
  const [isGeneratingXml, setIsGeneratingXml] = useState<boolean>(false);
  const [isLoadingStartup, setIsLoadingStartup] = useState<boolean>(true);
  const [isLoadingCanonicalReview, setIsLoadingCanonicalReview] = useState<boolean>(false);
  const [isLoadingCanonicalValidation, setIsLoadingCanonicalValidation] = useState<boolean>(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState<boolean>(false);
  const documentationSections: DocumentationSection[] = [
    {
      id: "projectStructure",
      title: "Project Overview",
      markdown: projectStructureDocumentation,
    },
    {
      id: "architecturePosition",
      title: "Architecture Position",
      markdown: architecturePositionDocumentation,
    },
    {
      id: "roadmap",
      title: "Roadmap",
      markdown: roadmapDocumentation,
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
      id: "dataInterpretation",
      title: "Data Interpretation",
      markdown: dataInterpretationDocumentation,
    },
    {
      id: "xml",
      title: "XML Generation",
      markdown: xmlGenerationDocumentation,
    },
    {
      id: "xmlSampleComparison",
      title: "XML Sample Comparison",
      markdown: xmlSampleComparisonDocumentation,
    },
    {
      id: "eudamedServiceContractFindings",
      title: "EUDAMED Service Contract Findings",
      markdown: eudamedServiceContractFindingsDocumentation,
    },
    {
      id: "testingScenarios",
      title: "Testing Scenarios",
      markdown: testingScenariosDocumentation,
    },
    {
      id: "softwareEngineeringPatterns",
      title: "Software Engineering Patterns",
      markdown: softwareEngineeringPatternsDocumentation,
    },
  ];
  const documentationGroups: DocumentationGroup[] = [
    {
      id: "project",
      title: "Project",
      sectionIds: ["projectStructure", "architecturePosition", "roadmap"],
    },
    {
      id: "dataCanonical",
      title: "Data And Canonical Interpretation",
      sectionIds: ["workbooks", "canonical", "canonicalValidation", "dataInterpretation"],
    },
    {
      id: "xmlService",
      title: "XML And Service Design",
      sectionIds: ["xml", "xmlSampleComparison", "eudamedServiceContractFindings"],
    },
    {
      id: "verification",
      title: "Verification And Decision Support",
      sectionIds: ["testingScenarios", "softwareEngineeringPatterns"],
    },
  ];
  const selectedDocumentationSection =
    documentationSections.find((section) => section.id === activeDocumentationSection) ??
    documentationSections[0];

  function initializeCanonicalValidationState(canonicalValidationData: CanonicalValidationBundle): void {
    setCanonicalValidation(canonicalValidationData);
    setSelectedValidationRecordKey(
      canonicalValidationData.sample_records[0]?.catalogue_number ??
        canonicalValidationData.records[0]?.catalogue_number ??
        null,
    );
    setSelectedValidationFamily(canonicalValidationData.family_summaries[0]?.product_family ?? null);
    setSelectedValidationVariant(canonicalValidationData.variant_summaries[0]?.product_variant ?? null);
    setSelectedXmlFamily(canonicalValidationData.family_summaries[0]?.product_family ?? null);
    setSelectedXmlVariant(canonicalValidationData.variant_summaries[0]?.product_variant ?? null);
    setSelectedXmlRecordKey(
      canonicalValidationData.records.find((record) => record.xml_readiness.status === "complete")?.catalogue_number ?? null,
    );
  }

  async function loadCanonicalReviewBundle(): Promise<void> {
    if (canonicalReview || isLoadingCanonicalReview) {
      return;
    }
    setIsLoadingCanonicalReview(true);
    try {
      const canonicalData = await api.canonicalReview();
      setCanonicalReview(canonicalData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load canonical review.");
    } finally {
      setIsLoadingCanonicalReview(false);
    }
  }

  async function loadCanonicalValidationBundle(): Promise<void> {
    if (canonicalValidation || isLoadingCanonicalValidation) {
      return;
    }
    setIsLoadingCanonicalValidation(true);
    try {
      const canonicalValidationData = await api.canonicalValidation();
      initializeCanonicalValidationState(canonicalValidationData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load canonical validation.");
    } finally {
      setIsLoadingCanonicalValidation(false);
    }
  }

  async function loadSchemaInventory(): Promise<void> {
    if (schemas || isLoadingSchemas) {
      return;
    }
    setIsLoadingSchemas(true);
    try {
      const schemaData = await api.schemas();
      setSchemas(schemaData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load schema inventory.");
    } finally {
      setIsLoadingSchemas(false);
    }
  }

  function renderLoadingPanel(title: string, message: string): JSX.Element {
    return (
      <section className="tab-stack">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Loading</span>
              <h2>{title}</h2>
            </div>
          </div>
          <p className="panel-copy">{message}</p>
        </section>
      </section>
    );
  }

  useEffect(() => {
    void Promise.all([
      api.workbooks(),
      api.referenceWorkbooks(),
      api.sheets(),
      api.normalizationRules(),
      api.distinctValues(selectedColumn),
    ])
      .then(([workbookData, referenceWorkbookData, sheetData, ruleData, distinctData]) => {
        setWorkbooks(workbookData);
        setReferenceWorkbooks(referenceWorkbookData);
        setSheets(sheetData);
        setRules(ruleData);
        setDistinctValues(distinctData);
        const firstVisibleWorkbook = workbookData.find((workbook) => workbook.in_scope_for_variant_mapping);
        const firstVisibleSheet =
          sheetData.find((sheet) => sheet.workbook === firstVisibleWorkbook?.workbook) ?? sheetData[0] ?? null;
        setSelectedSheet(firstVisibleSheet);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoadingStartup(false));
  }, []);

  useEffect(() => {
    if ((activeTab === "workbooks" || activeTab === "canonical") && !canonicalReview) {
      void loadCanonicalReviewBundle();
    }
  }, [activeTab, canonicalReview]);

  useEffect(() => {
    if ((activeTab === "canonicalValidation" || activeTab === "xml") && !canonicalValidation) {
      void loadCanonicalValidationBundle();
    }
  }, [activeTab, canonicalValidation]);

  useEffect(() => {
    if (activeTab === "workbooks" && !schemas) {
      void loadSchemaInventory();
    }
  }, [activeTab, schemas]);

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
    setXmlBatchPreview(null);
    setXmlPairPreview(null);
    setXmlMarketInfoPreview(null);
  }, [selectedXmlRecordKey, selectedXmlFamily, selectedXmlVariant, selectedXmlChunkSequence, xmlMode]);

  useEffect(() => {
    if (!canonicalValidation?.family_summaries.length) {
      return;
    }
    if (
      selectedValidationFamily &&
      canonicalValidation.family_summaries.some((summary) => summary.product_family === selectedValidationFamily)
    ) {
      return;
    }
    setSelectedValidationFamily(canonicalValidation.family_summaries[0]?.product_family ?? null);
  }, [canonicalValidation, selectedValidationFamily]);

  useEffect(() => {
    const familyVariantSummaries = (canonicalValidation?.variant_summaries ?? []).filter(
      (summary) => summary.product_family === selectedValidationFamily,
    );
    if (!familyVariantSummaries.length) {
      return;
    }
    if (
      selectedValidationVariant &&
      familyVariantSummaries.some((summary) => summary.product_variant === selectedValidationVariant)
    ) {
      return;
    }
    setSelectedValidationVariant(familyVariantSummaries[0]?.product_variant ?? null);
  }, [canonicalValidation, selectedValidationFamily, selectedValidationVariant]);

  useEffect(() => {
    const variantRecords = (canonicalValidation?.records ?? []).filter(
      (record) =>
        record.product_family === selectedValidationFamily &&
        record.product_variant === selectedValidationVariant,
    );
    if (!variantRecords.length) {
      return;
    }
    if (
      selectedValidationRecordKey &&
      variantRecords.some((record) => record.catalogue_number === selectedValidationRecordKey)
    ) {
      return;
    }
    setSelectedValidationRecordKey(variantRecords[0]?.catalogue_number ?? null);
  }, [canonicalValidation, selectedValidationFamily, selectedValidationVariant, selectedValidationRecordKey]);

  useEffect(() => {
    if (!canonicalValidation?.family_summaries.length) {
      return;
    }
    if (
      selectedXmlFamily &&
      canonicalValidation.family_summaries.some((summary) => summary.product_family === selectedXmlFamily)
    ) {
      return;
    }
    setSelectedXmlFamily(canonicalValidation.family_summaries[0]?.product_family ?? null);
  }, [canonicalValidation, selectedXmlFamily]);

  useEffect(() => {
    const familyVariantSummaries = (canonicalValidation?.variant_summaries ?? []).filter(
      (summary) => summary.product_family === selectedXmlFamily,
    );
    if (!familyVariantSummaries.length) {
      return;
    }
    if (
      selectedXmlVariant &&
      familyVariantSummaries.some((summary) => summary.product_variant === selectedXmlVariant)
    ) {
      return;
    }
    setSelectedXmlVariant(familyVariantSummaries[0]?.product_variant ?? null);
  }, [canonicalValidation, selectedXmlFamily, selectedXmlVariant]);

  useEffect(() => {
    const variantRecords = (canonicalValidation?.records ?? []).filter(
      (record) =>
        record.product_family === selectedXmlFamily &&
        record.product_variant === selectedXmlVariant &&
        record.xml_readiness.status === "complete",
    );
    if (!variantRecords.length) {
      return;
    }
    if (
      selectedXmlRecordKey &&
      variantRecords.some((record) => record.catalogue_number === selectedXmlRecordKey)
    ) {
      return;
    }
    setSelectedXmlRecordKey(variantRecords[0]?.catalogue_number ?? null);
  }, [canonicalValidation, selectedXmlFamily, selectedXmlVariant, selectedXmlRecordKey]);

  useEffect(() => {
    setSelectedXmlChunkSequence(1);
  }, [selectedXmlFamily, selectedXmlVariant]);

  useEffect(() => {
    setPairPreviewView("post");
  }, [selectedXmlFamily, selectedXmlVariant, selectedXmlRecordKey, xmlMode]);

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
  const uniqueCanonicalFieldCount = new Set(
    (canonicalReview?.entity_reviews ?? []).flatMap((entity) =>
      entity.field_reviews.map((fieldReview) => fieldReview.mapping.canonical_path),
    ),
  ).size;
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
      schemaFile:
        Array.from(
          new Set(fieldReview.mapping.schema_targets.map((target) => schemaFileForTarget(target.schema_path))),
        ).join(" | ") || "Schema file under review",
      classification: fieldReview.mapping.classification,
      reviewNotes:
        fieldReview.mapping.derivation_logic ??
        fieldReview.mapping.assumptions[0] ??
        fieldReview.mapping.schema_targets[0]?.notes ??
        fieldReview.decision.rationale ??
        "No additional review note recorded.",
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
  const gapCount = classificationCounts.gap ?? 0;
  const derivedRows = canonicalMappingRows.filter((row) => row.classification === "derived");
  const normalizedRows = canonicalMappingRows.filter((row) => row.classification === "normalized");
  const contextHeavyCount = derivedRows.length + normalizedRows.length;
  const schemaFileCount = new Set(
    canonicalMappingRows
      .map((row) => row.schemaFile)
      .filter((schemaFile) => schemaFile && schemaFile !== "Schema file under review")
      .flatMap((schemaFile) => schemaFile.split(" | ")),
  ).size;
  const schemaScopeGroups = Array.from(
    canonicalMappingRows.reduce<Map<string, Set<string>>>((groups, row) => {
      const targets = row.schemaTarget === "Not yet aligned" ? [] : row.schemaTarget.split(" | ");
      for (const target of targets) {
        const family = schemaFamilyForTarget(target);
        if (!groups.has(family)) {
          groups.set(family, new Set<string>());
        }
        groups.get(family)?.add(target.split("/")[0] ?? target);
      }
      return groups;
    }, new Map()),
  );
  const logicalSchemaTypeCount = schemaScopeGroups.reduce((count, [, schemaNames]) => count + schemaNames.size, 0);
  const canonicalValidationRecords = canonicalValidation?.records ?? [];
  const validationFamilySummaries = canonicalValidation?.family_summaries ?? [];
  const validationVariantSummaries = canonicalValidation?.variant_summaries ?? [];
  const validationVariantOperationLookup = new Map(
    validationVariantSummaries.map((summary) => [
      `${summary.source_workbook}::${summary.source_sheet}`,
      summary.submission_operation,
    ]),
  );
  const selectedFamilySummary =
    validationFamilySummaries.find((summary) => summary.product_family === selectedValidationFamily) ??
    validationFamilySummaries[0] ??
    null;
  const selectedFamilyVariantSummaries = validationVariantSummaries.filter(
    (summary) => summary.product_family === (selectedFamilySummary?.product_family ?? selectedValidationFamily),
  );
  const selectedVariantSummary =
    selectedFamilyVariantSummaries.find((summary) => summary.product_variant === selectedValidationVariant) ??
    selectedFamilyVariantSummaries[0] ??
    null;
  const selectedVariantRecords = canonicalValidationRecords.filter(
    (record) =>
      record.product_family === (selectedFamilySummary?.product_family ?? selectedValidationFamily) &&
      record.product_variant === (selectedVariantSummary?.product_variant ?? selectedValidationVariant),
  );
  const sampleValidationRecords = selectedVariantRecords.slice(0, 8);
  const selectedValidationRecord =
    sampleValidationRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    selectedVariantRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    sampleValidationRecords[0] ??
    selectedVariantRecords[0] ??
    null;
  const activeCompleteness = selectedValidationRecord?.completeness ?? null;
  const blockerSummaries = canonicalValidation?.blocker_summaries ?? [];
  const topBlockerHighlights = [...blockerSummaries]
    .filter((summary) => summary.missing_count > 0)
    .sort((left, right) => right.missing_count - left.missing_count)
    .slice(0, 6);
  const visibleValidationFields = selectedValidationRecord?.fields ?? [];
  const selectedStorageExample = selectedValidationRecord?.storage_condition_items[0] ?? null;
  const selectedWarningExample = selectedValidationRecord?.critical_warning_items[0] ?? null;
  const selectedMarketAvailabilityExample = selectedValidationRecord?.market_availability_items[0] ?? null;
  const selectedOpenBlockerPreview = selectedValidationRecord?.blockers.slice(0, 3) ?? [];
  const selectedXmlBlockerPreview = selectedValidationRecord?.xml_blockers.slice(0, 3) ?? [];
  const trackedValidationFieldCount =
    canonicalValidationRecords[0]?.fields.length ?? canonicalValidation?.sample_records[0]?.fields.length ?? 0;
  const optionalValidationFieldCount = Math.max(
    trackedValidationFieldCount - (canonicalValidation?.tracked_required_fields ?? 0),
    0,
  );
  const sourceFieldCoverageEntries = canonicalValidation?.source_field_coverage ?? [];
  const coverageSummaryLookup = new Map(
    (canonicalValidation?.source_field_coverage_summaries ?? []).map((summary) => [summary.status, summary]),
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
  const xmlValidationRecords = canonicalValidationRecords;
  const xmlReadyRecords = xmlValidationRecords.filter((record) => record.xml_readiness.status === "complete");
  const xmlBlockedRecords = xmlValidationRecords.filter((record) => record.xml_readiness.status !== "complete");
  const xmlFamilySummaries = validationFamilySummaries;
  const selectedXmlFamilySummary =
    xmlFamilySummaries.find((summary) => summary.product_family === selectedXmlFamily) ?? xmlFamilySummaries[0] ?? null;
  const selectedXmlVariantSummaries = validationVariantSummaries.filter(
    (summary) => summary.product_family === (selectedXmlFamilySummary?.product_family ?? selectedXmlFamily),
  );
  const selectedXmlVariantSummary =
    selectedXmlVariantSummaries.find((summary) => summary.product_variant === selectedXmlVariant) ??
    selectedXmlVariantSummaries[0] ??
    null;
  const selectedXmlVariantRecords = xmlReadyRecords.filter(
    (record) =>
      record.product_family === (selectedXmlFamilySummary?.product_family ?? selectedXmlFamily) &&
      record.product_variant === (selectedXmlVariantSummary?.product_variant ?? selectedXmlVariant),
  );
  const selectedXmlRecord =
    selectedXmlVariantRecords.find((record) => record.catalogue_number === selectedXmlRecordKey) ??
    selectedXmlVariantRecords[0] ??
    null;
  const selectedXmlPairRecord =
    selectedXmlVariantRecords.find(
      (record) =>
        record.catalogue_number === selectedXmlRecordKey && (record.submission_operation ?? "").toUpperCase() === "POST",
    ) ??
    selectedXmlVariantRecords.find((record) => (record.submission_operation ?? "").toUpperCase() === "POST") ??
    null;
  const selectedXmlVariantChunkCount = selectedXmlVariantSummary
    ? Math.max(Math.ceil(selectedXmlVariantSummary.xml_ready_records / 300), 1)
    : 1;
  const xmlPreviewLines =
    xmlMode === "pair"
      ? xmlPairPreview
        ? pairPreviewView === "post"
          ? xmlPairPreview.post_xml
          : xmlPairPreview.patch_xml
        : selectedXmlPairRecord
          ? [
              "<!-- Generate paired XML to load the accepted-shape POST and equivalent first PATCH previews -->",
              `<catalogue-number>${selectedXmlPairRecord.catalogue_number ?? "PENDING"}</catalogue-number>`,
              `<preview-view>${pairPreviewView.toUpperCase()}</preview-view>`,
            ].join("\n")
          : "<!-- No XML-ready POST record is currently available for paired POST/PATCH generation for the selected family and variant -->"
      : xmlMode === "single"
      ? selectedXmlRecord
        ? xmlPreview?.xml ??
          [
            "<!-- Generate XML to load the schema-valid Push message preview -->",
            `<catalogue-number>${selectedXmlRecord.catalogue_number ?? "PENDING"}</catalogue-number>`,
            `<udi-di>${selectedXmlRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
          ].join("\n")
        : "<!-- No XML-ready record is currently available for the selected family and variant -->"
      : xmlMode === "marketInfo"
      ? selectedXmlRecord
        ? xmlMarketInfoPreview?.xml ??
          [
            "<!-- Generate XML to load the MARKET_INFO.PUT Push message preview -->",
            `<catalogue-number>${selectedXmlRecord.catalogue_number ?? "PENDING"}</catalogue-number>`,
            `<udi-di>${selectedXmlRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
            "<service>MARKET_INFO.PUT</service>",
          ].join("\n")
        : "<!-- No XML-ready record is currently available for MARKET_INFO.PUT generation for the selected family and variant -->"
      : xmlBatchPreview?.selected_chunk_xml ??
        [
          "<!-- Generate XML to preview the selected variant batch -->",
          `<product-family>${selectedXmlFamilySummary?.product_family ?? "PENDING"}</product-family>`,
          `<product-variant>${selectedXmlVariantSummary?.product_variant ?? "PENDING"}</product-variant>`,
          `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
        ].join("\n");
  const selectedBatchValidation =
    xmlMode === "pair"
      ? pairPreviewView === "post"
        ? xmlPairPreview?.post_validation ?? null
        : xmlPairPreview?.patch_validation ?? null
      : xmlMode === "single"
        ? xmlPreview?.validation ?? null
        : xmlMode === "marketInfo"
          ? xmlMarketInfoPreview?.validation ?? null
        : xmlBatchPreview?.selected_chunk_validation ?? null;
  const pairPostValidation = xmlPairPreview?.post_validation ?? null;
  const pairPatchValidation = xmlPairPreview?.patch_validation ?? null;
  const validationStatusLabel = selectedBatchValidation
    ? selectedBatchValidation.valid
      ? "Schema valid"
      : "Schema invalid"
    : "Awaiting validation";
  const selectedSchemaLabel = selectedBatchValidation
    ? formatSchemaPathForInlineNote(selectedBatchValidation.schema_path)
    : null;
  const xmlModeLabel =
    xmlMode === "pair"
      ? "Post + Patch"
      : xmlMode === "single"
        ? "Single XML"
        : xmlMode === "marketInfo"
          ? "Market Info"
          : "Batch XML";
  const xmlModeDescription =
    xmlMode === "pair"
      ? "Generate a create/update comparison for one XML-ready device record."
      : xmlMode === "single"
        ? "Generate one wrapped Push message for a selected XML-ready device record."
        : xmlMode === "marketInfo"
          ? "Generate one standalone MARKET_INFO.PUT message for a selected XML-ready record."
          : "Generate a chunked batch package for every XML-ready row in the selected variant.";
  const xmlWorkspaceTitle =
    xmlMode === "pair"
      ? "Comparison Workspace"
      : xmlMode === "single"
        ? "Single Record Workspace"
        : xmlMode === "marketInfo"
          ? "Market Info Workspace"
          : "Batch Workspace";
  const activePreviewLabel =
    xmlMode === "pair"
      ? pairPreviewView === "post"
        ? "Post"
        : "Patch"
      : xmlMode === "single"
        ? "Single XML"
        : xmlMode === "marketInfo"
          ? "Market Info"
          : `Batch Chunk ${selectedXmlChunkSequence}`;
  const activePreviewFileName =
    xmlMode === "pair"
      ? pairPreviewView === "post"
        ? xmlPairPreview?.post_file_name ?? null
        : xmlPairPreview?.patch_file_name ?? null
      : xmlMode === "single"
        ? xmlPreview?.file_name ?? null
        : xmlMode === "marketInfo"
          ? xmlMarketInfoPreview?.file_name ?? null
          : xmlBatchPreview?.selected_chunk_file_name ?? null;
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
  const selectedWorkbookVariantMappings = variantMappings
    .filter((mapping) => mapping.workbook === selectedWorkbookSummary?.workbook)
    .map((mapping) => ({
      ...mapping,
      submission_operation:
        validationVariantOperationLookup.get(`${mapping.workbook}::${mapping.sheet}`) ?? mapping.submission_operation,
    }));
  const selectedSheetVariantMapping =
    selectedWorkbookVariantMappings.find(
      (mapping) => mapping.workbook === selectedSheet?.workbook && mapping.sheet === selectedSheet?.sheet,
    ) ?? null;
  const matchedVariantCount = variantMappings.filter((mapping) => mapping.match_status === "matched").length;
  const excludedVariantCount = variantMappings.filter((mapping) => mapping.match_status === "excluded").length;
  const unmatchedVariantCount = variantMappings.filter((mapping) => mapping.match_status === "unmatched").length;
  const orderedVariantMappings = [...variantMappings].sort((left, right) => {
    const order = { matched: 0, unmatched: 1, excluded: 2 };
    return order[left.match_status] - order[right.match_status];
  });
  const familyWorkbookSummaries = visibleWorkbooks.map((workbook) => {
    const family = workbookFamilyLabel(workbook.workbook);
    const variantSummariesForWorkbook = validationVariantSummaries.filter(
      (summary) => summary.source_workbook === workbook.workbook,
    );
    return {
      family,
      rows: workbook.total_rows,
      postVariants: variantSummariesForWorkbook.filter((summary) => summary.submission_operation === "POST").length,
      patchVariants: variantSummariesForWorkbook.filter((summary) => summary.submission_operation === "PATCH").length,
    };
  });

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
    if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    try {
      if (xmlMode === "pair") {
        if (!selectedXmlPairRecord?.catalogue_number) {
          return;
        }
        const preview = await api.previewXmlPostPatchPair(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedXmlPairRecord.catalogue_number,
        );
        setXmlPairPreview(preview);
      } else if (xmlMode === "single") {
        if (!selectedXmlRecord?.catalogue_number) {
          return;
        }
        const preview = await api.previewXmlRecord(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedXmlRecord.catalogue_number,
        );
        setXmlPreview(preview);
      } else if (xmlMode === "marketInfo") {
        if (!selectedXmlRecord?.catalogue_number) {
          return;
        }
        const preview = await api.previewXmlMarketInfoPut(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedXmlRecord.catalogue_number,
        );
        setXmlMarketInfoPreview(preview);
      } else {
        const preview = await api.previewXmlBatch(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedXmlChunkSequence,
        );
        setXmlBatchPreview(preview);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate XML preview.");
    } finally {
      setIsGeneratingXml(false);
    }
  }

  async function downloadXmlRecord(): Promise<void> {
    if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    try {
      const { blob, fileName } =
        xmlMode === "pair" && selectedXmlPairRecord?.catalogue_number
          ? await api.downloadXmlPostPatchPair(
              selectedXmlFamilySummary.product_family,
              selectedXmlVariantSummary.product_variant,
              selectedXmlPairRecord.catalogue_number,
            )
          : xmlMode === "single" && selectedXmlRecord?.catalogue_number
          ? await api.downloadXmlRecord(
              selectedXmlFamilySummary.product_family,
              selectedXmlVariantSummary.product_variant,
              selectedXmlRecord.catalogue_number,
            )
          : xmlMode === "marketInfo" && selectedXmlRecord?.catalogue_number
          ? await api.downloadXmlMarketInfoPut(
              selectedXmlFamilySummary.product_family,
              selectedXmlVariantSummary.product_variant,
              selectedXmlRecord.catalogue_number,
            )
          : await api.downloadXmlBatch(
              selectedXmlFamilySummary.product_family,
              selectedXmlVariantSummary.product_variant,
            );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        fileName ??
        (xmlMode === "pair"
          ? `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-${selectedXmlPairRecord?.catalogue_number ?? "pair"}-post-patch-pair.zip`
          : xmlMode === "single"
          ? xmlPreview?.file_name ??
            `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-${selectedXmlRecord?.catalogue_number ?? "record"}.xml`
          : xmlMode === "marketInfo"
          ? xmlMarketInfoPreview?.file_name ??
            `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-${selectedXmlRecord?.catalogue_number ?? "record"}-market-info-put.xml`
          : xmlBatchPreview?.package_file_name ??
            `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-batch-package.zip`);
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
              <h1>Validate Multi-Family Canonical Readiness</h1>
              <p className="hero-copy">
                Review readiness across in-scope product families, drill down into product variants,
                and inspect row-level canonical evidence before XML generation.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <p className="eyebrow">XML Generation</p>
              <h1>Generate Product Variant EUDAMED XML</h1>
              <p className="hero-copy">
                Produce previewable wrapped `Push` messages for XML-ready product-variant rows, validate
                them against the local schema set, and prepare controlled manual submission files.
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
              <span className="status-pill ok">MDR UDI-DI first load</span>
              <p className="status-detail">
                <span className="inline-stat-pill">{uniqueCanonicalFieldCount} unique canonical fields</span>
                are currently represented by {canonicalFieldCount} mapping review rows.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <span className="status-label">Validation scope</span>
              <span className="status-pill ok">{canonicalValidation?.family_scope ?? "Loading scope"}</span>
              <p className="status-detail">
                {trackedValidationFieldCount
                  ? `${trackedValidationFieldCount} unique canonical fields are currently carried into validation.`
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
                  ? `${xmlReadyRecords.length} validated product-variant row${xmlReadyRecords.length === 1 ? "" : "s"} are currently eligible for XML generation.`
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
                    <span className="status-pill ok compact">{family.postVariants} POST variants</span>
                    <span className="status-pill warn compact">{family.patchVariants} PATCH variants</span>
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
                  <span className="status-pill ok compact">{selectedColumn}</span>
                  <span className="status-pill ok compact">{scopeLabel}</span>
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
        isLoadingCanonicalReview ? (
          renderLoadingPanel(
            "Loading canonical review",
            "Preparing the current mapping review bundle and reference-aligned entity summary.",
          )
        ) : (
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
                  {uniqueCanonicalFieldCount} unique canonical fields are currently defined for review across {canonicalEntityCount} canonical entity groups and {logicalSchemaTypeCount} logical schema types referenced, represented by {canonicalFieldCount} mapping rows.
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
                <span className="summary-label">Direct Fields</span>
                <p>
                  {directCount} fields map directly from workbook meaning into the canonical layer without
                  extra transformation logic.
                </p>
              </div>
              <div className="canonical-summary-item">
                <span className="summary-label">Derived And Normalized Fields</span>
                <p className="canonical-summary-inline">
                  {contextHeavyCount} fields need normalization or derivation so business meaning stays
                  stable before schema-specific codes or combined values are applied.
                  <span className="canonical-inline-pill-row">
                    <span className="canonical-entity-pill">{derivedRows.length} derived</span>
                    <span className="canonical-entity-pill">{normalizedRows.length} normalized</span>
                  </span>
                </p>
              </div>
              <div className="canonical-summary-item">
                <span className="summary-label">Repeated Structures And Known Gaps</span>
                <p className="canonical-summary-inline">
                  {repeatedCount + gapCount} fields are represented as repeated business structures or visible review gaps.
                  <span className="canonical-inline-pill-row">
                    <span className="canonical-entity-pill">{repeatedCount} repeated</span>
                    <span className="canonical-entity-pill">{gapCount} gaps</span>
                    <span className="canonical-entity-pill">Market Availability</span>
                    <span className="canonical-entity-pill">Storage Conditions</span>
                    <span className="canonical-entity-pill">Critical Warnings</span>
                  </span>
                </p>
              </div>
            </div>
          </section>
          <section className="panel">
            <details className="group-accordion">
              <summary>
                <span>Source Sheet To Basic UDI Variant</span>
                <span className="status-pill ok compact">{matchedVariantCount} matched</span>
              </summary>
              <div className="accordion-body">
                <table className="mapping-contract-table">
                  <thead>
                    <tr>
                      <th>Workbook</th>
                      <th>Source sheet</th>
                      <th>Basic UDI variant</th>
                      <th>Basic UDI-DI</th>
                      <th>Registration mode</th>
                      <th>Review status</th>
                      <th>Review notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedVariantMappings.map((mapping) => (
                      <tr key={`${mapping.workbook}-${mapping.sheet}`}>
                        <td>{mapping.workbook}</td>
                        <td>{mapping.sheet}</td>
                        <td>{mapping.device_model ?? "Pending"}</td>
                        <td>{mapping.basic_udi_di ?? "N/A"}</td>
                        <td>{mapping.submission_operation ?? "N/A"}</td>
                        <td>
                          <span
                            className={
                              mapping.match_status === "matched"
                                ? "status-pill ok compact"
                                : mapping.match_status === "excluded"
                                  ? "status-pill danger compact"
                                  : "status-pill warn compact"
                            }
                          >
                            {titleCaseToken(mapping.match_status)}
                          </span>
                        </td>
                        <td>{mapping.notes.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
          <section className="panel">
            <details className="group-accordion">
              <summary>
                <span>Canonical Mapping</span>
                <span className="status-pill ok compact">{uniqueCanonicalFieldCount} unique fields</span>
              </summary>
              <div className="accordion-body">
                <p className="panel-copy canonical-schema-pill-copy">
                  <span className="canonical-schema-label">EUDAMED Schema Use:</span>
                  <br />
                  {schemaScopeGroups.flatMap(([family, schemaNames]) =>
                    Array.from(schemaNames).map((schemaName) => (
                      <span className="inline-stat-pill canonical-schema-pill" key={`mapping-${family}-${schemaName}`}>
                        {schemaName}
                      </span>
                    )),
                  )}
                </p>
                <table className="mapping-contract-table">
                  <colgroup>
                    <col className="mapping-col-excel" />
                    <col className="mapping-col-canonical" />
                    <col className="mapping-col-schema" />
                    <col className="mapping-col-schema" />
                    <col className="mapping-col-type" />
                    <col className="mapping-col-schema" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Source workbook field</th>
                      <th>Canonical meaning</th>
                      <th>EUDAMED target</th>
                      <th>Schema file</th>
                      <th>Mapping method</th>
                      <th>Review notes</th>
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
                        <td>{row.schemaFile}</td>
                        <td>
                          <span className="status-pill ok compact">{titleCaseToken(row.classification)}</span>
                        </td>
                        <td>{row.reviewNotes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </section>
        )
      ) : null}

      {activeTab === "canonicalValidation" ? (
        isLoadingCanonicalValidation ? (
          renderLoadingPanel(
            "Loading canonical validation",
            "Reading in-scope workbook rows and assembling completeness and XML-readiness results.",
          )
        ) : (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Total source rows</span>
              <strong>{canonicalValidation?.total_source_records ?? 0}</strong>
              <p>Rows parsed across the current in-scope and deferred workbook sheets.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Rows in validation scope</span>
              <strong>{canonicalValidation?.validation_subset_records ?? 0}</strong>
              <p>Rows currently covered by active variant-level canonical validation.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Canonical-ready rows</span>
              <strong>{canonicalValidation?.ready_records ?? 0}</strong>
              <p>Rows complete against the current canonical-required field set.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">XML-ready rows</span>
              <strong>{canonicalValidation?.xml_ready_records ?? 0}</strong>
              <p>Rows currently complete enough for downstream XML projection.</p>
            </div>
          </section>

          <section className="panel scope-banner-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Validation Scope</span>
                <h2>Multi-Family Variant Validation</h2>
              </div>
            </div>
            <p className="panel-copy">
              {canonicalValidation?.scope_note ??
                "Variant-level canonical validation is loading from the active workbook and Basic UDI sources."}
            </p>
            <p className="panel-copy scope-note-secondary">
              {canonicalValidation?.validation_note ??
                "Validation semantics are loading from the current canonical bundle."}
            </p>
            <div className="queue-summary">
              <div className="queue-chip">
                <strong>{validationFamilySummaries.length}</strong>
                <span>families in scope</span>
              </div>
              <div className="queue-chip">
                <strong>{validationVariantSummaries.length}</strong>
                <span>variants in scope</span>
              </div>
              <div className="queue-chip">
                <strong>{trackedValidationFieldCount}</strong>
                <span>unique canonical fields</span>
              </div>
              <div className="queue-chip">
                <strong>{canonicalValidation?.tracked_required_fields ?? 0}</strong>
                <span>required for completeness</span>
              </div>
              <div className="queue-chip">
                <strong>{canonicalValidation?.tracked_xml_required_fields ?? 0}</strong>
                <span>required for XML</span>
              </div>
              <div className="queue-chip">
                <strong>{canonicalValidation?.deferred_scope_summaries.length ?? 0}</strong>
                <span>deferred sheets</span>
              </div>
            </div>
          </section>

          <section className="content-grid validation-layout validation-step-grid">
            <details
              className="panel group-accordion validation-equal-panel validation-summary-panel"
              open={validationStepsOpen}
              onToggle={(event) => setValidationStepsOpen(event.currentTarget.open)}
            >
              <summary>
                <span>Step 1: Select Product Family</span>
              </summary>
              <div className="accordion-body">
                <p className="panel-copy">
                  Start by selecting a product family to surface its variants and related validation statistics.
                </p>
                <div className="draft-list">
                  {validationFamilySummaries.map((summary) => {
                    const isSelected = summary.product_family === selectedFamilySummary?.product_family;
                    return (
                      <button
                        key={summary.product_family}
                        className={isSelected ? "sheet-card active validation-sample-card" : "sheet-card validation-sample-card"}
                        type="button"
                        onClick={() => setSelectedValidationFamily(summary.product_family)}
                      >
                        <span className="sheet-title">{summary.product_family}</span>
                        <small>
                          {summary.variant_count} variants · {summary.total_records} rows
                        </small>
                        <small>
                          {summary.ready_records} ready · {summary.blocked_records} blocked
                        </small>
                        <small>
                          XML {summary.xml_ready_records} ready · {summary.xml_blocked_records} blocked
                        </small>
                        <small>
                          POST {summary.post_records} · PATCH {summary.patch_records}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>

            <details
              className="panel group-accordion validation-equal-panel validation-blockers-panel"
              open={validationStepsOpen}
              onToggle={(event) => setValidationStepsOpen(event.currentTarget.open)}
            >
              <summary>
                <span>Step 2: Select Product Variant</span>
              </summary>
              <div className="accordion-body">
                <p className="panel-copy">
                  Review readiness and blocker statistics for variants inside the selected family.
                </p>
                <div className="draft-list">
                  {selectedFamilyVariantSummaries.map((summary) => {
                    const isSelected = summary.product_variant === selectedVariantSummary?.product_variant;
                    return (
                      <button
                        key={summary.product_variant}
                        className={isSelected ? "sheet-card active validation-sample-card" : "sheet-card validation-sample-card"}
                        type="button"
                        onClick={() => setSelectedValidationVariant(summary.product_variant)}
                      >
                        <span className="sheet-title">{summary.product_variant}</span>
                        <small>
                          {summary.submission_operation ?? "N/A"} · {summary.total_records} rows
                        </small>
                        <small>
                          {summary.ready_records} ready · {summary.blocked_records} blocked
                        </small>
                        <small>
                          XML {summary.xml_ready_records} ready · {summary.xml_blocked_records} blocked
                        </small>
                        <small>
                          {summary.missing_required_field_total} missing required fields
                        </small>
                        <small>
                          {summary.missing_xml_required_field_total} missing XML-required fields
                        </small>
                        {summary.common_blockers.length ? (
                          <small>{summary.common_blockers.join(" | ")}</small>
                        ) : null}
                        {summary.common_xml_blockers.length ? (
                          <small>XML: {summary.common_xml_blockers.join(" | ")}</small>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>

            <details
              className="panel group-accordion validation-equal-panel validation-samples-panel"
              open={validationStepsOpen}
              onToggle={(event) => setValidationStepsOpen(event.currentTarget.open)}
            >
              <summary>
                <span>Step 3: Review Sample Data</span>
              </summary>
              <div className="accordion-body">
                <p className="panel-copy">
                  Review representative sample rows for the selected variant before drilling into field-level canonical evidence.
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
                        <span className="sheet-title">{record.product_variant}</span>
                        <small>{record.catalogue_number}</small>
                        <small>{record.trade_name ?? "No trade name"}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          </section>

          <section className="content-grid validation-layout single-panel-grid">
            <details className="panel group-accordion validation-selected-panel" open={false}>
              <summary>
                <span>
                  {selectedValidationRecord
                    ? `Canonical Model for ${selectedValidationRecord.product_family} / ${selectedValidationRecord.product_variant} / ${selectedValidationRecord.catalogue_number ?? "No sample"}`
                    : "Canonical Model"}
                </span>
                {selectedValidationRecord ? (
                  <span className="status-pill ok compact">{selectedValidationRecord.submission_operation ?? "No operation"}</span>
                ) : null}
              </summary>
              <div className="accordion-body">
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
                      <strong>{selectedValidationRecord.product_family}</strong>
                      <span>product family</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedValidationRecord.product_variant}</strong>
                      <span>product variant</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{basicUdiMatchLabel(selectedValidationRecord.reference_match_status)}</strong>
                      <span>basic UDI match</span>
                    </div>
                  </div>
                  <div className="workflow-note validation-record-note">
                    <strong>{selectedValidationRecord.trade_name}</strong>
                    <span>UDI-DI {selectedValidationRecord.primary_udi_di} · Issuing entity {selectedValidationRecord.issuing_entity ?? "Unknown"}</span>
                  </div>
                  <section className="summary-grid validation-record-grid">
                    <div className="summary-card">
                      <span className="summary-label">Canonical mapped fields</span>
                      <strong>{selectedValidationRecord.completeness.mapped_required_fields}</strong>
                      <p>{selectedValidationRecord.completeness.total_required_fields} required fields tracked.</p>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">Canonical missing fields</span>
                      <strong>{selectedValidationRecord.completeness.missing_required_fields}</strong>
                      <p>Remaining blockers for this sample row.</p>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">XML mapped fields</span>
                      <strong>{selectedValidationRecord.xml_readiness.mapped_required_fields}</strong>
                      <p>{selectedValidationRecord.xml_readiness.total_required_fields} XML-required fields tracked.</p>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">XML missing fields</span>
                      <strong>{selectedValidationRecord.xml_readiness.missing_required_fields}</strong>
                      <p>Remaining XML blockers for this sample row.</p>
                    </div>
                  </section>
                  <div className="draft-list">
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Repeated Structure Preview</strong>
                        <span className="status-pill ok compact">
                          {selectedValidationRecord.market_availability_items.length +
                            selectedValidationRecord.storage_condition_items.length +
                            selectedValidationRecord.critical_warning_items.length}
                        </span>
                      </div>
                      <div className="queue-summary validation-pill-row">
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.market_availability_items.length}</strong>
                          <span>market availability items</span>
                        </div>
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.storage_condition_items.length}</strong>
                          <span>storage condition items</span>
                        </div>
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.critical_warning_items.length}</strong>
                          <span>critical warning items</span>
                        </div>
                        {selectedMarketAvailabilityExample ? (
                          <div className="queue-chip">
                            <strong>Market Availability</strong>
                            <span>
                              {selectedMarketAvailabilityExample.country}
                              {selectedMarketAvailabilityExample.original_placed_on_market ? " · first EU market" : ""}
                            </span>
                          </div>
                        ) : null}
                        {selectedStorageExample ? (
                          <div className="queue-chip">
                            <strong>Storage Condition</strong>
                            <span>
                              {selectedStorageExample.item_type ?? "Unspecified"} {"->"} {selectedStorageExample.normalized_code ?? "No code"}
                            </span>
                          </div>
                        ) : null}
                        {selectedWarningExample ? (
                          <div className="queue-chip">
                            <strong>Critical Warning</strong>
                            <span>
                              {selectedWarningExample.item_type ?? "Unspecified"} {"->"} {selectedWarningExample.normalized_code ?? "No code"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Canonical Blockers</strong>
                        <span className={selectedOpenBlockerPreview.length ? "status-pill warn compact" : "status-pill ok compact"}>
                          {selectedOpenBlockerPreview.length}
                        </span>
                      </div>
                      {selectedOpenBlockerPreview.length ? (
                        <ul className="compact-list validation-highlight-list">
                          {selectedOpenBlockerPreview.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="panel-copy">No blocker fields remain missing for this sample row.</p>
                      )}
                    </div>
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>XML Blockers</strong>
                        <span className={selectedXmlBlockerPreview.length ? "status-pill warn compact" : "status-pill ok compact"}>
                          {selectedXmlBlockerPreview.length}
                        </span>
                      </div>
                      {selectedXmlBlockerPreview.length ? (
                        <ul className="compact-list validation-highlight-list">
                          {selectedXmlBlockerPreview.map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="panel-copy">No XML blocker fields remain missing for this sample row.</p>
                      )}
                    </div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Canonical field</th>
                        <th>Current value</th>
                        <th>Source</th>
                        <th>Review note</th>
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
                          <td>{field.value ?? "Missing"}</td>
                          <td>
                            <span
                              className={
                                field.source === "missing"
                                  ? "status-pill warn compact"
                                  : "status-pill ok compact"
                              }
                            >
                              {titleCaseToken(field.source)}
                            </span>
                            <div className="field-source-note">{field.source_detail}</div>
                          </td>
                          <td>{field.review_note ?? "No additional review note recorded."}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </>
                ) : (
                  <p className="panel-copy">No rows are currently available for the selected family and variant.</p>
                )}
              </div>
            </details>
          </section>

        </section>
        )
      ) : null}

      {activeTab === "xml" ? (
        isLoadingCanonicalValidation ? (
          renderLoadingPanel(
            "Loading XML workspace",
            "Preparing validated device records required for XML preview and batch generation.",
          )
        ) : (
        <section className="tab-stack">
          <section className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Validated rows</span>
              <strong>{xmlValidationRecords.length}</strong>
              <p>Rows available from the current Canonical Validation workspace.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">XML-ready rows</span>
              <strong>{xmlReadyRecords.length}</strong>
              <p>Rows currently eligible for generic single-record XML generation.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Blocked rows</span>
              <strong>{xmlBlockedRecords.length}</strong>
              <p>Rows that would need canonical validation fixes before XML generation should include them.</p>
            </div>
            <div className="summary-card">
              <span className="summary-label">Current mode</span>
              <strong>{xmlModeLabel}</strong>
              <p>{xmlModeDescription}</p>
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
              This workspace now consumes the aligned Canonical Validation output. Select a product family,
              product variant, and then generate either a single sample XML or a variant-scoped batch package.
            </p>
            <div className="queue-summary">
              <div className="queue-chip">
                <strong>{canonicalValidation?.family_scope ?? "Loading scope"}</strong>
                <span>generation scope</span>
              </div>
              <div className="queue-chip">
                <strong>{xmlFamilySummaries.length}</strong>
                <span>families in scope</span>
              </div>
              <div className="queue-chip">
                <strong>{selectedXmlVariantSummaries.length}</strong>
                <span>variants in selected family</span>
              </div>
              <div className="queue-chip">
                <strong>{xmlBlockedRecords.length}</strong>
                <span>rows excluded until resolved</span>
              </div>
            </div>
          </section>

          <section className="content-grid validation-layout xml-selection-grid">
            <div className="panel validation-equal-panel validation-summary-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Step 1</span>
                  <h2>Select Product Family</h2>
                </div>
              </div>
              <p className="panel-copy">Start by selecting the product family whose XML-ready variants you want to inspect.</p>
              <div className="draft-list">
                {xmlFamilySummaries.map((summary) => {
                  const isSelected = summary.product_family === selectedXmlFamilySummary?.product_family;
                  return (
                    <button
                      key={summary.product_family}
                      className={isSelected ? "sheet-card active validation-sample-card" : "sheet-card validation-sample-card"}
                      type="button"
                      onClick={() => setSelectedXmlFamily(summary.product_family)}
                    >
                      <span className="sheet-title">{summary.product_family}</span>
                      <small>
                        {summary.variant_count} variants · {summary.total_records} rows
                      </small>
                      <small>
                        XML {summary.xml_ready_records} ready · {summary.xml_blocked_records} blocked
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="panel validation-equal-panel validation-blockers-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Step 2</span>
                  <h2>Select Product Variant</h2>
                </div>
              </div>
              <p className="panel-copy">Choose one variant inside the selected family.</p>
              <div className="draft-list">
                {selectedXmlVariantSummaries.map((summary) => {
                  const isSelected = summary.product_variant === selectedXmlVariantSummary?.product_variant;
                  return (
                    <button
                      key={summary.product_variant}
                      className={isSelected ? "sheet-card active validation-sample-card" : "sheet-card validation-sample-card"}
                      type="button"
                      onClick={() => setSelectedXmlVariant(summary.product_variant)}
                    >
                      <span className="sheet-title">{summary.product_variant}</span>
                      <small>
                        {summary.submission_operation ?? "N/A"} · {summary.total_records} rows
                      </small>
                      <small>
                        XML {summary.xml_ready_records} ready · {summary.xml_blocked_records} blocked
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel xml-full-workspace-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">XML Workspace</span>
                <h2>{xmlWorkspaceTitle}</h2>
              </div>
            </div>
            <div className="xml-header-band">
              <div className="xml-mode-toggle xml-top-tabs">
                <button
                  className={xmlMode === "pair" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("pair")}
                >
                  Post + Patch
                </button>
                <button
                  className={xmlMode === "single" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("single")}
                >
                  Single XML
                </button>
                <button
                  className={xmlMode === "marketInfo" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("marketInfo")}
                >
                  Market Info
                </button>
                <button
                  className={xmlMode === "batch" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("batch")}
                >
                  Batch XML
                </button>
              </div>
              <div className="xml-header-context">
                <div className="xml-header-context-block">
                  <span className="summary-label">Purpose</span>
                  <strong>{xmlModeLabel}</strong>
                  <p>{xmlModeDescription}</p>
                </div>
                <div className="xml-header-context-block">
                  <span className="summary-label">Schema Set</span>
                  <strong>Message.xsd envelope</strong>
                  <p>{selectedSchemaLabel ?? "Wrapped EUDAMED service-message validation will appear after preview generation."}</p>
                </div>
                <div className="xml-header-context-block">
                  <span className="summary-label">Current Scope</span>
                  <strong>{selectedXmlFamilySummary?.product_family ?? "No family selected"}</strong>
                  <p>{selectedXmlVariantSummary?.product_variant ?? "No variant selected"}</p>
                </div>
              </div>
            </div>
            <div className="xml-focus-layout">
              <div className="xml-preview-surface">
                <div className="section-heading xml-preview-heading">
                  <div>
                    <span className="section-kicker">Preview</span>
                    <h2>
                      {xmlMode === "pair"
                        ? "Post + Patch Preview"
                        : xmlMode === "single"
                          ? "Single Record XML Preview"
                          : xmlMode === "marketInfo"
                            ? "Market Info Preview"
                            : "Batch XML Preview"}
                    </h2>
                  </div>
                  {xmlMode === "pair" ? (
                    <div className="xml-mode-toggle xml-sub-tabs xml-compare-toggle">
                      <button
                        className={pairPreviewView === "post" ? "action-button xml-mode-button xml-compare-button active" : "ghost-button xml-mode-button xml-compare-button"}
                        type="button"
                        onClick={() => setPairPreviewView("post")}
                      >
                        Post
                      </button>
                      <button
                        className={pairPreviewView === "patch" ? "action-button xml-mode-button xml-compare-button active" : "ghost-button xml-mode-button xml-compare-button"}
                        type="button"
                        onClick={() => setPairPreviewView("patch")}
                      >
                        Patch
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="xml-preview-meta">
                  <div className="xml-preview-meta-block">
                    <span className="summary-label">Active view</span>
                    <strong>{activePreviewLabel}</strong>
                  </div>
                  <div className="xml-preview-meta-block">
                    <span className="summary-label">Validation</span>
                    <span className={selectedBatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                      {validationStatusLabel}
                    </span>
                  </div>
                  <div className="xml-preview-meta-block">
                    <span className="summary-label">Schema</span>
                    <strong>{selectedSchemaLabel ?? "Message.xsd pending"}</strong>
                  </div>
                  <div className="xml-preview-meta-block">
                    <span className="summary-label">File</span>
                    <strong>{activePreviewFileName ?? "Not generated yet"}</strong>
                  </div>
                </div>
                <pre className="xml-preview-block">
                  <code>{xmlPreviewLines}</code>
                </pre>
                <div className="workflow-note">
                  <strong>Preview status</strong>
                  <span>
                    {xmlMode === "pair"
                      ? xmlPairPreview
                        ? `Pair preview generated for ${xmlPairPreview.product_family} / ${xmlPairPreview.product_variant} / ${xmlPairPreview.catalogue_number}. Currently showing ${pairPreviewView.toUpperCase()}.`
                        : "No paired XML preview generated yet for the selected row."
                      : xmlMode === "single"
                        ? xmlPreview
                          ? `Preview generated for ${xmlPreview.product_family} / ${xmlPreview.product_variant} / ${xmlPreview.catalogue_number}.`
                          : "No XML preview generated yet for the selected row."
                        : xmlMode === "marketInfo"
                          ? xmlMarketInfoPreview
                            ? `MARKET_INFO.PUT preview generated for ${xmlMarketInfoPreview.product_family} / ${xmlMarketInfoPreview.product_variant} / ${xmlMarketInfoPreview.catalogue_number}.`
                            : "No MARKET_INFO.PUT preview generated yet for the selected row."
                          : xmlBatchPreview
                            ? `Batch preview generated for ${xmlBatchPreview.product_family} / ${xmlBatchPreview.product_variant}, chunk ${xmlBatchPreview.selected_chunk_sequence}.`
                            : "No batch XML preview generated yet for the selected variant."}
                  </span>
                </div>
              </div>

              <div className="xml-sidebar-surface">
                <div className="draft-actions-bar xml-actions-bar">
                  <button
                    className="action-button"
                    type="button"
                    onClick={() => void generateXmlPreview()}
                    disabled={
                      (xmlMode === "pair" && !selectedXmlPairRecord) ||
                      (xmlMode === "single" && !selectedXmlRecord) ||
                      (xmlMode === "marketInfo" && !selectedXmlRecord) ||
                      !selectedXmlVariantSummary ||
                      isGeneratingXml
                    }
                  >
                    {isGeneratingXml
                      ? "Generating..."
                      : xmlMode === "pair"
                        ? "Generate Post + Patch"
                        : xmlMode === "single"
                          ? "Generate XML"
                          : xmlMode === "marketInfo"
                            ? "Generate Market Info"
                            : "Generate Batch Preview"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void generateXmlPreview()}
                    disabled={
                      (xmlMode === "pair" && !selectedXmlPairRecord) ||
                      (xmlMode === "single" && !selectedXmlRecord) ||
                      (xmlMode === "marketInfo" && !selectedXmlRecord) ||
                      !selectedXmlVariantSummary ||
                      isGeneratingXml
                    }
                  >
                    Validate Against XSD
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void downloadXmlRecord()}
                    disabled={
                      (xmlMode === "pair" && !selectedXmlPairRecord) ||
                      (xmlMode === "single" && !selectedXmlRecord) ||
                      (xmlMode === "marketInfo" && !selectedXmlRecord) ||
                      !selectedXmlVariantSummary ||
                      isGeneratingXml
                    }
                  >
                    {xmlMode === "pair"
                      ? "Download Pair Package"
                      : xmlMode === "single"
                        ? "Download XML"
                        : xmlMode === "marketInfo"
                          ? "Download Market Info"
                          : "Download Batch Package"}
                  </button>
                </div>
                {xmlMode === "pair" ? (
                  selectedXmlPairRecord ? (
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedXmlPairRecord.catalogue_number}</strong>
                          <span className="status-pill ok compact">Post source</span>
                        </div>
                        <p className="draft-meta">
                          {selectedXmlPairRecord.product_family} / {selectedXmlPairRecord.product_variant}
                        </p>
                        <p className="panel-copy">{selectedXmlPairRecord.trade_name ?? "No trade name"}</p>
                        <p className="panel-copy">
                          UDI-DI {selectedXmlPairRecord.primary_udi_di} · Issuing entity {selectedXmlPairRecord.issuing_entity ?? "Unknown"}
                        </p>
                        <div className="family-scope-pill-row xml-status-row">
                          <span className={basicUdiMatchPillClass(selectedXmlPairRecord.reference_match_status)}>
                            {basicUdiMatchLabel(selectedXmlPairRecord.reference_match_status)}
                          </span>
                        </div>
                        <p className="panel-copy">
                          Compare an accepted-shape create message with the equivalent first update message for the same device record.
                        </p>
                        <div className="family-scope-pill-row xml-status-row">
                          <span className={pairPostValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            Post {pairPostValidation ? (pairPostValidation.valid ? "valid" : "invalid") : "awaiting preview"}
                          </span>
                          <span className={pairPatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            Patch {pairPatchValidation ? (pairPatchValidation.valid ? "valid" : "invalid") : "awaiting preview"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="panel-copy">No XML-ready POST record is currently available for paired POST/PATCH generation for the selected family and variant.</p>
                  )
                ) : xmlMode === "single" ? (
                  selectedXmlRecord ? (
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedXmlRecord.catalogue_number}</strong>
                          <span className="status-pill ok compact">{selectedXmlRecord.submission_operation ?? "No operation"}</span>
                        </div>
                        <p className="draft-meta">
                          {selectedXmlRecord.product_family} / {selectedXmlRecord.product_variant}
                        </p>
                        <p className="panel-copy">{selectedXmlRecord.trade_name ?? "No trade name"}</p>
                        <p className="panel-copy">
                          UDI-DI {selectedXmlRecord.primary_udi_di} · Issuing entity {selectedXmlRecord.issuing_entity ?? "Unknown"}
                        </p>
                        <div className="family-scope-pill-row xml-status-row">
                          <span className={basicUdiMatchPillClass(selectedXmlRecord.reference_match_status)}>
                            {basicUdiMatchLabel(selectedXmlRecord.reference_match_status)}
                          </span>
                        </div>
                        <p className="panel-copy">
                          Review one XML-ready sample row before moving to batch generation.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="panel-copy">No XML-ready sample row is currently available for the selected family and variant.</p>
                  )
                ) : xmlMode === "marketInfo" ? (
                  selectedXmlRecord ? (
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedXmlRecord.catalogue_number}</strong>
                          <span className="status-pill ok compact">Market info</span>
                        </div>
                        <p className="draft-meta">
                          {selectedXmlRecord.product_family} / {selectedXmlRecord.product_variant}
                        </p>
                        <p className="panel-copy">{selectedXmlRecord.trade_name ?? "No trade name"}</p>
                        <p className="panel-copy">
                          UDI-DI {selectedXmlRecord.primary_udi_di} · Issuing entity {selectedXmlRecord.issuing_entity ?? "Unknown"}
                        </p>
                        <div className="family-scope-pill-row xml-status-row">
                          <span className={basicUdiMatchPillClass(selectedXmlRecord.reference_match_status)}>
                            {basicUdiMatchLabel(selectedXmlRecord.reference_match_status)}
                          </span>
                        </div>
                        <p className="panel-copy">
                          Review a standalone market information update message using the record's current `marketInfos` collection.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="panel-copy">No XML-ready sample row is currently available for MARKET_INFO.PUT generation for the selected family and variant.</p>
                  )
                ) : selectedXmlVariantSummary ? (
                  <div className="draft-list xml-record-stack">
                    <div className="draft-card xml-record-card">
                      <div className="draft-card-head">
                        <strong>{selectedXmlVariantSummary.product_variant}</strong>
                        <span className="status-pill ok compact">{selectedXmlVariantSummary.submission_operation ?? "No operation"}</span>
                      </div>
                      <p className="draft-meta">
                        {selectedXmlFamilySummary?.product_family} / {selectedXmlVariantSummary.product_variant}
                      </p>
                      <p className="panel-copy">
                        {selectedXmlVariantSummary.xml_ready_records} XML-ready rows will be grouped into {selectedXmlVariantChunkCount} batch file
                        {selectedXmlVariantChunkCount === 1 ? "" : "s"} at up to 300 rows per file.
                      </p>
                      <p className="panel-copy">
                        {selectedXmlVariantSummary.xml_blocked_records} row{selectedXmlVariantSummary.xml_blocked_records === 1 ? "" : "s"} remain excluded until resolved.
                      </p>
                      <label className="field-label" htmlFor="xml-batch-chunk-sequence">
                        Preview batch chunk
                      </label>
                      <select
                        id="xml-batch-chunk-sequence"
                        className="rule-select"
                        value={selectedXmlChunkSequence}
                        onChange={(event) => setSelectedXmlChunkSequence(Number(event.target.value))}
                      >
                        {Array.from({ length: selectedXmlVariantChunkCount }, (_, index) => index + 1).map((sequence) => (
                          <option key={sequence} value={sequence}>
                            Chunk {sequence} of {selectedXmlVariantChunkCount}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="panel-copy">No XML-ready variant batch is currently available for the selected family and variant.</p>
                )}
                <div className="workflow-note">
                  <strong>
                    {xmlMode === "pair"
                      ? "Paired POST/PATCH review"
                      : xmlMode === "single"
                        ? "Single-record review"
                        : xmlMode === "marketInfo"
                          ? "Standalone market-info review"
                          : "Variant-batch scope"}
                  </strong>
                  <span>
                    {xmlMode === "pair"
                      ? "Use one current POST-classified device to compare an accepted-shape POST against an equivalent first PATCH with e:version = 2."
                      : xmlMode === "single"
                        ? "Use the auto-selected sample row to confirm payload shape and schema validity before reviewing batch output."
                        : xmlMode === "marketInfo"
                          ? "Use one XML-ready record to inspect the standalone MARKET_INFO.PUT wrapper and its current marketInfos collection."
                          : "Batch generation remains strictly within the selected product variant and only includes XML-ready rows."}
                  </span>
                </div>
                <div className="draft-list xml-validation-stack">
                  <div className="draft-card">
                    <div className="draft-card-head">
                      <strong>Schema target</strong>
                      <span className="status-pill ok compact">Message.xsd</span>
                    </div>
                    <p className="panel-copy">
                      Generated XML is validated against the wrapped EUDAMED service-message schema set rooted at `Message.xsd`.
                    </p>
                  </div>
                  <div className="draft-card">
                    <div className="draft-card-head">
                      <strong>{xmlMode === "pair" ? "Active preview validation" : "Validation output"}</strong>
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
                            {xmlMode === "pair"
                              ? `The generated ${pairPreviewView.toUpperCase()} preview validates cleanly.`
                              : xmlMode === "single"
                                ? "The generated single-record Push message validates cleanly."
                                : xmlMode === "marketInfo"
                                  ? "The generated MARKET_INFO.PUT Push message validates cleanly."
                                  : "The generated variant-batch Push message validates cleanly."}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="panel-copy">
                        {xmlMode === "pair"
                          ? "Generate a paired preview to inspect the POST and PATCH schema validation outcomes."
                          : xmlMode === "single"
                            ? "Generate a single-record preview to inspect the schema validation outcome."
                            : xmlMode === "marketInfo"
                              ? "Generate a MARKET_INFO.PUT preview to inspect the schema validation outcome."
                              : "Generate a variant-batch preview to inspect the schema validation outcome."}
                      </p>
                    )}
                  </div>
                  {xmlMode === "pair" ? (
                    <>
                      <div className="draft-card">
                        <div className="draft-card-head">
                          <strong>POST validation</strong>
                          <span className={pairPostValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            {pairPostValidation ? (pairPostValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
                          </span>
                        </div>
                        <p className="panel-copy">{pairPostValidation?.schema_path ?? "Generate a pair preview to validate the POST XML."}</p>
                      </div>
                      <div className="draft-card">
                        <div className="draft-card-head">
                          <strong>PATCH validation</strong>
                          <span className={pairPatchValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            {pairPatchValidation ? (pairPatchValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
                          </span>
                        </div>
                        <p className="panel-copy">{pairPatchValidation?.schema_path ?? "Generate a pair preview to validate the equivalent PATCH XML."}</p>
                      </div>
                    </>
                  ) : null}
                  {xmlMode === "batch" && xmlBatchPreview ? (
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Batch chunk summary</strong>
                        <span className="status-pill ok compact">
                          {xmlBatchPreview.chunk_count} chunk{xmlBatchPreview.chunk_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="panel-copy">
                        Selected file: {xmlBatchPreview.selected_chunk_file_name} · {xmlBatchPreview.selected_chunk_record_count} rows
                      </p>
                      <div className="roadmap-list">
                        {xmlBatchPreview.chunks.slice(0, 6).map((chunk) => (
                          <div className="roadmap-item" key={chunk.file_name}>
                            <strong>{chunk.file_name}</strong>
                            <p>
                              {chunk.record_count} rows · {chunk.first_catalogue_number ?? "?"} to {chunk.last_catalogue_number ?? "?"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </section>
        )
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
                {documentationGroups.map((group) => (
                  <div className="documentation-toc-group" key={group.id}>
                    <div className="documentation-toc-group-title">{group.title}</div>
                    {group.sectionIds.map((sectionId) => {
                      const section = documentationSections.find((entry) => entry.id === sectionId);
                      if (!section) {
                        return null;
                      }
                      return (
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
                      );
                    })}
                  </div>
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
