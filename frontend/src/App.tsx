import { useEffect, useRef, useState } from "react";

import { ApiError, api } from "./api";
import architecturePositionDocumentation from "./content/docs/architecture-position.md?raw";
import canonicalValidationDocumentation from "./content/docs/canonical-validation.md?raw";
import dataInterpretationDocumentation from "./content/docs/data-interpretation.md?raw";
import eudamedServiceContractFindingsDocumentation from "./content/docs/eudamed-service-contract-findings.md?raw";
import eudamedTestingGenerationUiDocumentation from "./content/docs/eudamed-testing-generation-ui.md?raw";
import projectStructureDocumentation from "./content/docs/project-structure.md?raw";
import roadmapDocumentation from "./content/docs/roadmap.md?raw";
import softwareEngineeringPatternsDocumentation from "./content/docs/software-engineering-patterns.md?raw";
import testingScenariosDocumentation from "./content/docs/testing-scenarios.md?raw";
import workbooksDocumentation from "./content/docs/workbooks.md?raw";
import xmlGenerationDocumentation from "./content/docs/xml-generation.md?raw";
import xmlSampleComparisonDocumentation from "./content/docs/xml-sample-comparison.md?raw";
import type {
  BulkPatchPreview,
  BulkPatchPostedEntry,
  BulkPatchPostedParentGroup,
  BulkPostPreview,
  BulkUdidiPostPreview,
  CanonicalValidationBundle,
  CanonicalReviewBundle,
  CriticalWarningCodeOption,
  DatabaseHealthSummary,
  DatabaseSchemaSummary,
  DeviceSubjectSummary,
  DistinctValueProfile,
  GeneratedPatchScenarioPreview,
  ImportedWorkbookSummary,
  MarketInfoPutPreview,
  NormalizationRuleFile,
  OperationAssessment,
  PostRegistrationPreview,
  RegisteredDeviceAnchor,
  ReferenceWorkbookSummary,
  SchemaInventory,
  SheetProfile,
  SheetSummary,
  SingleRecordXmlPreview,
  TestingSubjectReadModelSummary,
  WorkbookImportDuplicateGroup,
  WorkbookImportSnapshotSummary,
  WorkbookSummary,
} from "./types";

const focusColumns = [
  "UDI-DI status e.g. On the EU market",
  "Select the language e.g English",
];

type MainTab = "workbooks" | "canonicalValidation" | "xml" | "generation" | "documentation";
type ScopeMode = "all" | "sheet";
type EudamedStatus = "EUDAMED Candidate" | "EUDAMED Accepted";
type BulkPatchScopeMode = "all_posted" | "selected_catalogue_numbers" | "import_catalogue_list";
type PatchScenarioId =
  | "equivalent_first_patch"
  | "trade_name_edit"
  | "warning_add"
  | "storage_condition_edit"
  | "base_quantity_edit"
  | "production_identifier_edit"
  | "sterile_edit"
  | "sterilization_edit"
  | "latex_edit"
  | "reprocessed_edit"
  | "number_of_reuses_edit"
  | "status_code_edit"
  | "mdn_codes_edit";

type PatchScenarioDefinition = {
  id: PatchScenarioId;
  label: string;
  target: string;
  summary: string;
  implemented: boolean;
  testStatus: "success" | "failure" | "untested";
  optionsSummary?: string;
};

type PatchScenarioComparisonRow = {
  label: string;
  before: string;
  after: string;
};

type SelectionAnchorInput = {
  product_family: string;
  product_variant: string;
  catalogue_number: string;
  primary_udi_di: string | null;
};

type BulkPreviewMode = "bulkPost" | "bulkUdidiPost" | "bulkPatch";
type ValidationReviewTab = "canonicalMapping" | "sourceSheetBasicUdi";

type BulkExclusionSummary = {
  key: string;
  title: string;
  detail: string;
};

const PATCH_SCENARIOS: PatchScenarioDefinition[] = [
  {
    id: "equivalent_first_patch",
    label: "Equivalent First Patch",
    target: "Full UDI-DI payload equality",
    summary: "Baseline Version 2 PATCH with no business-field change.",
    implemented: true,
    testStatus: "success",
  },
  {
    id: "trade_name_edit",
    label: "Trade Name Edit",
    target: "udidi:tradeNames",
    summary: "Candidate PATCH shape that updates the trade name text while keeping the baseline device identity unchanged.",
    implemented: true,
    testStatus: "success",
  },
  {
    id: "warning_add",
    label: "Critical Warnings",
    target: "udidi:criticalWarnings",
    summary: "Candidate PATCH shape that replaces the current warning set with the selected warning while keeping the baseline device identity unchanged.",
    implemented: true,
    testStatus: "success",
  },
  {
    id: "storage_condition_edit",
    label: "Storage Condition Edit",
    target: "udidi:storageHandlingConditions",
    summary: "Candidate PATCH shape that edits selected storage-condition comment text while preserving the baseline device identity.",
    implemented: true,
    testStatus: "success",
  },
  {
    id: "base_quantity_edit",
    label: "Base Quantity",
    target: "udidi:baseQuantity",
    summary: "Candidate PATCH shape for changing the device base quantity.",
    implemented: true,
    testStatus: "success",
    optionsSummary: "Any positive integer such as 1, 2, 10.",
  },
  {
    id: "production_identifier_edit",
    label: "Production Identifier",
    target: "udidi:productionIdentifier",
    summary: "Candidate PATCH shape for changing the UDI-PI control model.",
    implemented: false,
    testStatus: "untested",
    optionsSummary:
      "One or more of: BATCH_NUMBER, SOFTWARE_IDENTIFICATION, SERIALISATION_NUMBER, EXPIRATION_DATE, MANUFACTURING_DATE.",
  },
  {
    id: "sterile_edit",
    label: "Sterile",
    target: "udidi:sterile",
    summary: "Blocked by Playground testing. EUDAMED returned ERR-DTX-UDI-031-033.02 indicating that device labelled sterile is not updatable by PATCH.",
    implemented: false,
    testStatus: "failure",
    optionsSummary: "Do not use for PATCH generation unless EUDAMED business rules change.",
  },
  {
    id: "sterilization_edit",
    label: "Sterilization",
    target: "udidi:sterilization",
    summary: "Candidate PATCH shape for changing whether sterilisation before use is required.",
    implemented: false,
    testStatus: "untested",
    optionsSummary: "Boolean: true or false.",
  },
  {
    id: "latex_edit",
    label: "Latex",
    target: "udidi:latex",
    summary: "Blocked by Playground testing. EUDAMED returned ERR-DTX-UDI-031-033.02 indicating that containing latex is not updatable by PATCH.",
    implemented: false,
    testStatus: "failure",
    optionsSummary: "Do not use for PATCH generation unless EUDAMED business rules change.",
  },
  {
    id: "reprocessed_edit",
    label: "Reprocessed",
    target: "udidi:reprocessed",
    summary: "Candidate PATCH shape for changing the reprocessed flag.",
    implemented: false,
    testStatus: "untested",
    optionsSummary: "Boolean: true or false.",
  },
  {
    id: "number_of_reuses_edit",
    label: "Number Of Reuses",
    target: "udidi:numberOfReuses",
    summary: "Candidate PATCH shape for changing the declared number of reuses.",
    implemented: false,
    testStatus: "untested",
    optionsSummary: "Use -1 for not defined, 0 for single-use, or a positive integer.",
  },
  {
    id: "status_code_edit",
    label: "Status Code",
    target: "udidi:status/commondi:code",
    summary: "Candidate PATCH shape for changing the UDI-DI status code.",
    implemented: true,
    testStatus: "failure",
    optionsSummary:
      "One of: NOT_INTENDED_FOR_EU_MARKET, ON_THE_MARKET, NO_LONGER_PLACED_ON_THE_MARKET.",
  },
  {
    id: "mdn_codes_edit",
    label: "MDN Codes",
    target: "udidi:MDNCodes",
    summary: "Candidate PATCH shape for changing one or more nomenclature codes.",
    implemented: false,
    testStatus: "untested",
    optionsSummary: "One or more valid nomenclature codes. The schema does not enumerate them locally.",
  },
];

function patchScenarioOptionLabel(scenario: PatchScenarioDefinition): string {
  if (scenario.testStatus === "success") {
    return `${scenario.label} (success)`;
  }
  if (scenario.testStatus === "failure") {
    return `${scenario.label} (rejected)`;
  }
  if (scenario.testStatus === "untested") {
    return `${scenario.label} (untested)`;
  }
  return scenario.label;
}

function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}

function formatIsoDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function shortenHash(value: string): string {
  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function extractBasicUdiDi(reasonMessage: string): string | null {
  const match = reasonMessage.match(/Basic UDI-DI\s+([A-Za-z0-9.-]+)/i);
  return match?.[1] ?? null;
}

function summarizeBulkExcludedRecords(
  mode: BulkPreviewMode,
  preview: BulkPostPreview | BulkUdidiPostPreview | BulkPatchPreview,
): BulkExclusionSummary[] {
  const familyVariantLabel = `${preview.product_family} / ${preview.product_variant}`;
  const excludedRecords = preview.excluded_records;
  if (!excludedRecords.length) {
    return [];
  }

  if (mode === "bulkPost") {
    const duplicateByBasicUdi = new Map<string, number>();
    let parentAlreadyRegistered = 0;
    let missingBasicUdi = 0;
    let notPostOperation = 0;
    let notXmlReady = 0;

    for (const record of excludedRecords) {
      if (record.reason_code === "duplicate_basic_udi_di") {
        const basicUdiDi = extractBasicUdiDi(record.reason_message) ?? "Unknown";
        duplicateByBasicUdi.set(basicUdiDi, (duplicateByBasicUdi.get(basicUdiDi) ?? 0) + 1);
      } else if (record.reason_code === "parent_already_registered") {
        parentAlreadyRegistered += 1;
      } else if (record.reason_code === "missing_basic_udi_di") {
        missingBasicUdi += 1;
      } else if (record.reason_code === "not_post_operation") {
        notPostOperation += 1;
      } else if (record.reason_code === "xml_not_ready") {
        notXmlReady += 1;
      }
    }

    const summaries: BulkExclusionSummary[] = Array.from(duplicateByBasicUdi.entries()).map(([basicUdiDi, count]) => ({
      key: `duplicate-${basicUdiDi}`,
      title: basicUdiDi,
      detail: `${pluralize(count, "record")} in ${familyVariantLabel} ${count === 1 ? "is" : "are"} associated with Basic UDI-DI ${basicUdiDi}. Bulk Basic UDI POST keeps only one parent seed row for that Basic UDI-DI group.`,
    }));

    if (parentAlreadyRegistered > 0) {
      summaries.push({
        key: "parent-already-registered",
        title: "Already posted parents",
        detail: `${pluralize(parentAlreadyRegistered, "record")} in ${familyVariantLabel} ${parentAlreadyRegistered === 1 ? "belongs" : "belong"} to Basic UDI-DI parent groups that already have a successful parent DEVICE.POST.`,
      });
    }
    if (missingBasicUdi > 0) {
      summaries.push({
        key: "missing-basic-udi",
        title: "Missing Basic UDI-DI",
        detail: `${pluralize(missingBasicUdi, "record")} in ${familyVariantLabel} ${missingBasicUdi === 1 ? "does" : "do"} not resolve to a Basic UDI-DI and ${missingBasicUdi === 1 ? "cannot" : "cannot"} be used for Bulk Basic UDI POST.`,
      });
    }
    if (notPostOperation > 0) {
      summaries.push({
        key: "not-post-operation",
        title: "Non-POST rows",
        detail: `${pluralize(notPostOperation, "record")} in ${familyVariantLabel} ${notPostOperation === 1 ? "is" : "are"} not classified as POST rows and ${notPostOperation === 1 ? "was" : "were"} excluded from Bulk Basic UDI POST consideration.`,
      });
    }
    if (notXmlReady > 0) {
      summaries.push({
        key: "not-xml-ready",
        title: "Not XML-ready",
        detail: `${pluralize(notXmlReady, "record")} in ${familyVariantLabel} ${notXmlReady === 1 ? "is" : "are"} not XML-ready and ${notXmlReady === 1 ? "was" : "were"} excluded from Bulk Basic UDI POST consideration.`,
      });
    }
    return summaries;
  }

  if (mode === "bulkUdidiPost") {
    let parentNotRegistered = 0;
    let childAlreadyRegistered = 0;
    let missingBasicUdi = 0;
    let notPostOperation = 0;
    let notXmlReady = 0;

    for (const record of excludedRecords) {
      if (record.reason_code === "parent_not_registered") {
        parentNotRegistered += 1;
      } else if (record.reason_code === "child_already_registered") {
        childAlreadyRegistered += 1;
      } else if (record.reason_code === "missing_basic_udi_di") {
        missingBasicUdi += 1;
      } else if (record.reason_code === "not_post_operation") {
        notPostOperation += 1;
      } else if (record.reason_code === "xml_not_ready") {
        notXmlReady += 1;
      }
    }

    const summaries: BulkExclusionSummary[] = [];
    if (parentNotRegistered > 0) {
      summaries.push({
        key: "parent-not-registered",
        title: "Parent not yet posted",
        detail: `${pluralize(parentNotRegistered, "record")} in ${familyVariantLabel} ${parentNotRegistered === 1 ? "is" : "are"} waiting for a successful parent DEVICE.POST before Bulk UDI-DI POST can generate child registrations.`,
      });
    }
    if (childAlreadyRegistered > 0) {
      summaries.push({
        key: "child-already-registered",
        title: "Already registered Device UDI-DI",
        detail: `${pluralize(childAlreadyRegistered, "record")} in ${familyVariantLabel} ${childAlreadyRegistered === 1 ? "already has" : "already have"} a tracked successful Device UDI-DI registration and ${childAlreadyRegistered === 1 ? "was" : "were"} excluded from Bulk UDI-DI POST generation.`,
      });
    }
    if (missingBasicUdi > 0) {
      summaries.push({
        key: "missing-basic-udi",
        title: "Missing Basic UDI-DI",
        detail: `${pluralize(missingBasicUdi, "record")} in ${familyVariantLabel} ${missingBasicUdi === 1 ? "does" : "do"} not resolve to a Basic UDI-DI and ${missingBasicUdi === 1 ? "cannot" : "cannot"} be used for Bulk UDI-DI POST.`,
      });
    }
    if (notPostOperation > 0) {
      summaries.push({
        key: "not-post-operation",
        title: "Non-POST rows",
        detail: `${pluralize(notPostOperation, "record")} in ${familyVariantLabel} ${notPostOperation === 1 ? "is" : "are"} not classified as POST rows and ${notPostOperation === 1 ? "was" : "were"} excluded from Bulk UDI-DI POST consideration.`,
      });
    }
    if (notXmlReady > 0) {
      summaries.push({
        key: "not-xml-ready",
        title: "Not XML-ready",
        detail: `${pluralize(notXmlReady, "record")} in ${familyVariantLabel} ${notXmlReady === 1 ? "is" : "are"} not XML-ready and ${notXmlReady === 1 ? "was" : "were"} excluded from Bulk UDI-DI POST consideration.`,
      });
    }
    return summaries;
  }

  const byReason = new Map<string, number>();
  for (const record of excludedRecords) {
    byReason.set(record.reason_message, (byReason.get(record.reason_message) ?? 0) + 1);
  }
  return Array.from(byReason.entries()).map(([reasonMessage, count], index) => ({
    key: `bulk-patch-${index}`,
    title: pluralize(count, "record"),
    detail: `${pluralize(count, "record")} in ${familyVariantLabel} ${count === 1 ? "was" : "were"} excluded from Bulk PATCH: ${reasonMessage}`,
  }));
}

function buildBulkPatchPostedParentGroups(
  subjectSummaries: TestingSubjectReadModelSummary[],
): BulkPatchPostedParentGroup[] {
  const grouped = new Map<string, BulkPatchPostedParentGroup>();
  for (const summary of subjectSummaries) {
    if (!summary.post_success || !summary.has_successful_child_post_or_patch || !summary.basic_udi_di) {
      continue;
    }
    const existing = grouped.get(summary.basic_udi_di) ?? {
      basic_udi_di: summary.basic_udi_di,
      posted_child_count: 0,
      sample_catalogue_numbers: [],
    };
    existing.posted_child_count += 1;
    if (
      summary.catalogue_number &&
      existing.sample_catalogue_numbers.length < 10 &&
      !existing.sample_catalogue_numbers.includes(summary.catalogue_number)
    ) {
      existing.sample_catalogue_numbers.push(summary.catalogue_number);
    }
    grouped.set(summary.basic_udi_di, existing);
  }
  return Array.from(grouped.values()).sort((left, right) => left.basic_udi_di.localeCompare(right.basic_udi_di));
}

function buildBulkPatchPostedEntries(
  subjectSummaries: TestingSubjectReadModelSummary[],
  basicUdiDi: string | null,
): BulkPatchPostedEntry[] {
  if (!basicUdiDi) {
    return [];
  }
  const normalizedBasicUdiDi = basicUdiDi.trim().toLowerCase();
  return subjectSummaries
    .filter(
      (summary) =>
        summary.post_success &&
        summary.has_successful_child_post_or_patch &&
        (summary.basic_udi_di ?? "").trim().toLowerCase() === normalizedBasicUdiDi,
    )
    .map((summary) => ({
      catalogue_number: summary.catalogue_number,
      primary_udi_di: summary.primary_udi_di,
      basic_udi_di: summary.basic_udi_di,
      latest_version: summary.latest_successful_version,
      baseline_patch_success: summary.baseline_patch_success,
    }))
    .sort((left, right) => (left.catalogue_number ?? "").localeCompare(right.catalogue_number ?? ""));
}

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
    | "eudamedTestingGenerationUi"
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

function buildSelectionAnchor(record: SelectionAnchorInput): RegisteredDeviceAnchor {
  return {
    product_family: record.product_family,
    product_variant: record.product_variant,
    catalogue_number: record.catalogue_number,
    primary_udi_di: record.primary_udi_di ?? "Pending",
    post_file_name: "Pending preview",
    patch_file_name: "Pending preview",
    post_valid: false,
    patch_valid: false,
    eudamed_status: "Selection target",
  };
}

function fieldValue(record: { fields: Array<{ canonical_path: string; value: string | null }> } | null, canonicalPath: string): string | null {
  if (!record) {
    return null;
  }
  return record.fields.find((field) => field.canonical_path === canonicalPath)?.value ?? null;
}

function basicUdiDiForRecord(record: { fields: Array<{ canonical_path: string; value: string | null }> } | null): string | null {
  return (
    fieldValue(record, "basic_device.basic_udi_di") ??
    fieldValue(record, "device_record.basic_udi_identifier")
  );
}

function parseBooleanString(value: string | null | undefined): boolean | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

function parseCatalogueNumberList(value: string): string[] {
  const normalized = value
    .replace(/\r/g, "\n")
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(normalized));
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

function matchesReadModelFilter(values: Array<string | number | null | undefined>, filterValue: string): boolean {
  const normalizedFilter = filterValue.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }
  return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedFilter));
}

function operationAssessmentStatusClass(status: OperationAssessment["status"]): string {
  return status === "available" ? "ok" : status === "attention" ? "warn" : "danger";
}

function operationAssessmentStatusLabel(status: OperationAssessment["status"]): string {
  return status === "available" ? "Available" : status === "attention" ? "Attention" : "Blocked";
}

function assessmentEvidenceNumber(assessment: OperationAssessment | null, key: string): number | null {
  if (!assessment) {
    return null;
  }
  const value = assessment.evidence[key];
  return typeof value === "number" ? value : null;
}

function assessmentEvidenceString(assessment: OperationAssessment | null, key: string): string | null {
  if (!assessment) {
    return null;
  }
  const value = assessment.evidence[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function assessmentEvidenceBoolean(assessment: OperationAssessment | null, key: string): boolean | null {
  if (!assessment) {
    return null;
  }
  const value = assessment.evidence[key];
  return typeof value === "boolean" ? value : null;
}

function assessmentEvidenceStringArray(assessment: OperationAssessment | null, key: string): string[] {
  if (!assessment) {
    return [];
  }
  const value = assessment.evidence[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("workbooks");
  const [activeDocumentationSection, setActiveDocumentationSection] = useState<
    DocumentationSection["id"]
  >("projectStructure");
  const [workbooks, setWorkbooks] = useState<WorkbookSummary[]>([]);
  const [referenceWorkbooks, setReferenceWorkbooks] = useState<ReferenceWorkbookSummary[]>([]);
  const [latestWorkbookImportSummary, setLatestWorkbookImportSummary] = useState<WorkbookImportSnapshotSummary | null>(null);
  const [databaseSchemaSummary, setDatabaseSchemaSummary] = useState<DatabaseSchemaSummary | null>(null);
  const [databaseHealthSummary, setDatabaseHealthSummary] = useState<DatabaseHealthSummary | null>(null);
  const [deviceSubjects, setDeviceSubjects] = useState<DeviceSubjectSummary[]>([]);
  const workbookImportMonitoringRequestRef = useRef<number>(0);
  const [workbookImportSummaryError, setWorkbookImportSummaryError] = useState<string | null>(null);
  const [hasWorkbookImportSnapshot, setHasWorkbookImportSnapshot] = useState<boolean>(false);
  const [isRunningWorkbookImport, setIsRunningWorkbookImport] = useState<boolean>(false);
  const [workbookImportActionMessage, setWorkbookImportActionMessage] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<SheetSummary | null>(null);
  const [sheetProfile, setSheetProfile] = useState<SheetProfile | null>(null);
  const [distinctValues, setDistinctValues] = useState<DistinctValueProfile | null>(null);
  const [selectedColumn] = useState<string>(focusColumns[0]);
  const [rules, setRules] = useState<NormalizationRuleFile[]>([]);
  const [schemas, setSchemas] = useState<SchemaInventory | null>(null);
  const [canonicalReview, setCanonicalReview] = useState<CanonicalReviewBundle | null>(null);
  const [canonicalValidation, setCanonicalValidation] = useState<CanonicalValidationBundle | null>(null);
  const [selectedValidationRecordKey, setSelectedValidationRecordKey] = useState<string | null>(null);
  const [selectedValidationFamily, setSelectedValidationFamily] = useState<string>("");
  const [selectedValidationVariant, setSelectedValidationVariant] = useState<string>("");
  const [selectedValidationReviewTab, setSelectedValidationReviewTab] = useState<ValidationReviewTab>("canonicalMapping");
  const [selectedDeviceSubjectFamily, setSelectedDeviceSubjectFamily] = useState<string>("");
  const [selectedDeviceSubjectVariant, setSelectedDeviceSubjectVariant] = useState<string>("");
  const [selectedXmlFamily, setSelectedXmlFamily] = useState<string | null>(null);
  const [selectedXmlVariant, setSelectedXmlVariant] = useState<string | null>(null);
  const [selectedXmlRecordKey, setSelectedXmlRecordKey] = useState<string | null>(null);
  const [xmlMode, setXmlMode] = useState<"post" | "single" | "marketInfo" | "bulkPost" | "bulkUdidiPost" | "patch" | "bulkPatch">("post");
  const [selectedPatchScenarioId, setSelectedPatchScenarioId] = useState<PatchScenarioId>("equivalent_first_patch");
  const [selectedBulkPatchBasicUdiDi, setSelectedBulkPatchBasicUdiDi] = useState<string>("");
  const [bulkPatchScopeMode, setBulkPatchScopeMode] = useState<BulkPatchScopeMode>("all_posted");
  const [selectedBulkPatchCatalogueNumbers, setSelectedBulkPatchCatalogueNumbers] = useState<string[]>([]);
  const [bulkPatchCatalogueFilter, setBulkPatchCatalogueFilter] = useState<string>("");
  const [bulkPatchImportText, setBulkPatchImportText] = useState<string>("");
  const [testingSubjectSummaries, setTestingSubjectSummaries] = useState<TestingSubjectReadModelSummary[]>([]);
  const [xmlOperationAssessment, setXmlOperationAssessment] = useState<OperationAssessment | null>(null);
  const [xmlOperationAssessmentError, setXmlOperationAssessmentError] = useState<string | null>(null);
  const [isLoadingXmlOperationAssessment, setIsLoadingXmlOperationAssessment] = useState<boolean>(false);
  const [patchScenarioStatuses, setPatchScenarioStatuses] = useState<Record<PatchScenarioId, EudamedStatus>>({
    equivalent_first_patch: "EUDAMED Candidate",
    trade_name_edit: "EUDAMED Candidate",
    warning_add: "EUDAMED Candidate",
    storage_condition_edit: "EUDAMED Candidate",
    base_quantity_edit: "EUDAMED Candidate",
    production_identifier_edit: "EUDAMED Candidate",
    sterile_edit: "EUDAMED Candidate",
    sterilization_edit: "EUDAMED Candidate",
    latex_edit: "EUDAMED Candidate",
    reprocessed_edit: "EUDAMED Candidate",
    number_of_reuses_edit: "EUDAMED Candidate",
    status_code_edit: "EUDAMED Candidate",
    mdn_codes_edit: "EUDAMED Candidate",
  });
  const [selectedXmlChunkSequence, setSelectedXmlChunkSequence] = useState<number>(1);
  const [selectedBulkRecordCount, setSelectedBulkRecordCount] = useState<number>(1);
  const [scopeMode] = useState<ScopeMode>("all");
  const [showUnmappedOnly, setShowUnmappedOnly] = useState<boolean>(true);
  const [valueFilter, setValueFilter] = useState<string>("");
  const [draftActions, setDraftActions] = useState<DraftAction[]>([]);
  const [isApplyingRules, setIsApplyingRules] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [xmlActionMessage, setXmlActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [criticalWarningCodeOptions, setCriticalWarningCodeOptions] = useState<CriticalWarningCodeOption[]>([]);
  const [xmlPreview, setXmlPreview] = useState<SingleRecordXmlPreview | null>(null);
  const [xmlBulkPostPreview, setXmlBulkPostPreview] = useState<BulkPostPreview | null>(null);
  const [xmlBulkUdidiPostPreview, setXmlBulkUdidiPostPreview] = useState<BulkUdidiPostPreview | null>(null);
  const [xmlPairPreview, setXmlPairPreview] = useState<PostRegistrationPreview | null>(null);
  const [xmlMarketInfoPreview, setXmlMarketInfoPreview] = useState<MarketInfoPutPreview | null>(null);
  const [xmlPatchPreview, setXmlPatchPreview] = useState<GeneratedPatchScenarioPreview | null>(null);
  const [xmlBulkPatchPreview, setXmlBulkPatchPreview] = useState<BulkPatchPreview | null>(null);
  const [patchPreviewView, setPatchPreviewView] = useState<"base" | "derived">("derived");
  const [patchVersionInput, setPatchVersionInput] = useState<string>("3");
  const [patchTradeNameInput, setPatchTradeNameInput] = useState<string>("");
  const [patchWarningCodeInput, setPatchWarningCodeInput] = useState<string>("");
  const [patchWarningCommentInput, setPatchWarningCommentInput] = useState<string>("");
  const [patchBaseQuantityInput, setPatchBaseQuantityInput] = useState<string>("");
  const [patchSterileInput, setPatchSterileInput] = useState<string>("");
  const [patchLatexInput, setPatchLatexInput] = useState<string>("");
  const [patchStatusCodeInput, setPatchStatusCodeInput] = useState<string>("");
  const [patchStorageConditionInputs, setPatchStorageConditionInputs] = useState<Record<string, string>>({
    SHC006: "",
    SHC007: "",
  });
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
      id: "eudamedTestingGenerationUi",
      title: "EUDAMED Testing And Generation UI",
      markdown: eudamedTestingGenerationUiDocumentation,
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
      sectionIds: ["workbooks", "canonicalValidation", "dataInterpretation"],
    },
    {
      id: "xmlService",
      title: "XML And Service Design",
      sectionIds: ["xml", "xmlSampleComparison", "eudamedServiceContractFindings", "eudamedTestingGenerationUi"],
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
    setSelectedValidationFamily(canonicalValidationData.family_summaries[0]?.product_family ?? "");
    setSelectedValidationVariant(canonicalValidationData.variant_summaries[0]?.product_variant ?? "");
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

  async function loadCanonicalValidationBundle(forceRefresh = false): Promise<void> {
    if ((!forceRefresh && canonicalValidation) || isLoadingCanonicalValidation) {
      return;
    }
    setIsLoadingCanonicalValidation(true);
    try {
      const canonicalValidationData = await api.canonicalValidation();
      initializeCanonicalValidationState(canonicalValidationData);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 404) {
        setCanonicalValidation(null);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Failed to load canonical validation.");
      }
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

  async function loadWorkbookImportMonitoring(): Promise<void> {
    const requestId = workbookImportMonitoringRequestRef.current + 1;
    workbookImportMonitoringRequestRef.current = requestId;
    const workbookImportSummaryResult = await api
      .latestWorkbookImportSummary()
      .then((data) => ({ data, error: null as string | null, hasSnapshot: true }))
      .catch((requestError: Error) => {
        if (requestError instanceof ApiError && requestError.status === 404) {
          return { data: null, error: null, hasSnapshot: false };
        }
        return {
          data: null,
          error: requestError.message || "Workbook import summary is unavailable.",
          hasSnapshot: false,
        };
      });

    const databaseSchemaSummaryResult = await api
      .workbookImportSchemaSummary()
      .then((data) => ({ data, error: null as string | null }))
      .catch((requestError: Error) => ({
        data: null,
        error: requestError.message || "Database schema summary is unavailable.",
      }));

    const databaseHealthSummaryResult = await api
      .workbookImportHealthSummary()
      .then((data) => ({ data, error: null as string | null }))
      .catch((requestError: Error) => ({
        data: null,
        error: requestError.message || "Database health summary is unavailable.",
      }));

    const deviceSubjectsResult = await api
      .workbookImportDeviceSubjects({
        limit: 10000,
      })
      .then((data) => ({ data, error: null as string | null }))
      .catch((requestError: Error) => ({
        data: [] as DeviceSubjectSummary[],
        error: requestError.message || "Device subject summary is unavailable.",
      }));

    if (requestId !== workbookImportMonitoringRequestRef.current) {
      return;
    }

    setLatestWorkbookImportSummary(workbookImportSummaryResult.data);
    setDatabaseSchemaSummary(databaseSchemaSummaryResult.data);
    setDatabaseHealthSummary(databaseHealthSummaryResult.data);
    setDeviceSubjects(deviceSubjectsResult.data);
    setHasWorkbookImportSnapshot(workbookImportSummaryResult.hasSnapshot);
    const monitoringErrors = [
      workbookImportSummaryResult.error,
      databaseSchemaSummaryResult.error,
      databaseHealthSummaryResult.error,
      deviceSubjectsResult.error,
    ].filter(Boolean);
    setWorkbookImportSummaryError(monitoringErrors.length ? monitoringErrors.join(" ") : null);
  }

  async function runWorkbookImportFromUi(): Promise<void> {
    setIsRunningWorkbookImport(true);
    setWorkbookImportActionMessage(null);
    setError(null);
    try {
      const result = await api.runWorkbookImport({
        imported_by: "ui",
        label: `UI import ${new Date().toISOString()}`,
      });
      await loadWorkbookImportMonitoring();
      await loadCanonicalValidationBundle(true);
      setWorkbookImportActionMessage(
        `Workbook import completed. Batch #${result.import_batch_id} captured ${pluralize(result.source_row_count, "row")} across ${pluralize(result.workbook_count, "workbook")}.`,
      );
    } catch (requestError) {
      setWorkbookImportActionMessage(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to run workbook import.");
    } finally {
      setIsRunningWorkbookImport(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      api.workbooks(),
      api.referenceWorkbooks(),
      loadWorkbookImportMonitoring(),
      api.sheets(),
      api.normalizationRules(),
      api.distinctValues(selectedColumn),
      api.criticalWarningCodes(),
    ])
      .then(([
        workbookData,
        referenceWorkbookData,
        _workbookImportMonitoringLoaded,
        sheetData,
        ruleData,
        distinctData,
        criticalWarningCodes,
      ]) => {
        setWorkbooks(workbookData);
        setReferenceWorkbooks(referenceWorkbookData);
        setSheets(sheetData);
        setRules(ruleData);
        setDistinctValues(distinctData);
        setCriticalWarningCodeOptions(criticalWarningCodes);
        const firstVisibleWorkbook = workbookData.find((workbook) => workbook.in_scope_for_variant_mapping);
        const firstVisibleSheet =
          sheetData.find((sheet) => sheet.workbook === firstVisibleWorkbook?.workbook) ?? sheetData[0] ?? null;
        setSelectedSheet(firstVisibleSheet);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setIsLoadingStartup(false));
  }, []);

  useEffect(() => {
    if ((activeTab === "workbooks" || activeTab === "canonicalValidation") && !canonicalReview) {
      void loadCanonicalReviewBundle();
    }
  }, [activeTab, canonicalReview]);

  useEffect(() => {
    if (
      (activeTab === "canonicalValidation" ||
        activeTab === "xml" ||
        activeTab === "generation") &&
      !canonicalValidation
    ) {
      void loadCanonicalValidationBundle();
    }
  }, [activeTab, canonicalValidation]);

  useEffect(() => {
    const latestImportBatchId = latestWorkbookImportSummary?.import_batch.import_batch_id;
    if (
      (activeTab === "canonicalValidation" ||
        activeTab === "xml" ||
        activeTab === "generation") &&
      latestImportBatchId !== undefined &&
      canonicalValidation &&
      canonicalValidation.source_import_batch_id !== latestImportBatchId
    ) {
      void loadCanonicalValidationBundle(true);
    }
  }, [activeTab, latestWorkbookImportSummary, canonicalValidation]);

  useEffect(() => {
    if (activeTab === "workbooks" && !schemas) {
      void loadSchemaInventory();
    }
  }, [activeTab, schemas]);

  useEffect(() => {
    const availableVariants = (canonicalValidation?.variant_summaries ?? []).filter(
      (summary) =>
        (!selectedDeviceSubjectFamily || summary.product_family === selectedDeviceSubjectFamily) &&
        summary.xml_ready_records > 0,
    );
    if (!selectedDeviceSubjectVariant) {
      return;
    }
    if (availableVariants.some((summary) => summary.product_variant === selectedDeviceSubjectVariant)) {
      return;
    }
    setSelectedDeviceSubjectVariant("");
  }, [canonicalValidation, selectedDeviceSubjectFamily, selectedDeviceSubjectVariant]);

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
    setXmlBulkPostPreview(null);
    setXmlBulkUdidiPostPreview(null);
    setXmlPairPreview(null);
    setXmlMarketInfoPreview(null);
    setXmlPatchPreview(null);
    setXmlBulkPatchPreview(null);
  }, [selectedXmlRecordKey, selectedXmlFamily, selectedXmlVariant, selectedXmlChunkSequence]);

  useEffect(() => {
    if (!canonicalValidation?.family_summaries.length) {
      return;
    }
    if (!selectedValidationFamily) {
      return;
    }
    if (canonicalValidation.family_summaries.some((summary) => summary.product_family === selectedValidationFamily)) {
      return;
    }
    setSelectedValidationFamily(canonicalValidation.family_summaries[0]?.product_family ?? "");
  }, [canonicalValidation, selectedValidationFamily]);

  useEffect(() => {
    const familyVariantSummaries = (canonicalValidation?.variant_summaries ?? []).filter((summary) =>
      selectedValidationFamily ? summary.product_family === selectedValidationFamily : true,
    );
    if (!familyVariantSummaries.length) {
      return;
    }
    if (!selectedValidationVariant) {
      return;
    }
    if (familyVariantSummaries.some((summary) => summary.product_variant === selectedValidationVariant)) {
      return;
    }
    setSelectedValidationVariant("");
  }, [canonicalValidation, selectedValidationFamily, selectedValidationVariant]);

  useEffect(() => {
    const variantRecords = (canonicalValidation?.records ?? []).filter(
      (record) =>
        (!selectedValidationFamily || record.product_family === selectedValidationFamily) &&
        (!selectedValidationVariant || record.product_variant === selectedValidationVariant),
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
    if (activeTab === "generation" && xmlMode !== "post") {
      setXmlMode("post");
    }
  }, [activeTab, xmlMode]);

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
  const deviceSubjectFamilyOptions = (
    validationFamilySummaries.length
      ? Array.from(
          new Set(
            validationFamilySummaries
              .filter((summary) => summary.xml_ready_records > 0)
              .map((summary) => summary.product_family)
              .filter(Boolean),
          ),
        )
      : Array.from(
          new Set(
            deviceSubjects
              .map((subject) => subject.product_family)
              .filter((family): family is string => Boolean(family)),
          ),
        )
  ).sort((left, right) => left.localeCompare(right));
  const deviceSubjectVariantOptions = (
    validationVariantSummaries.length
      ? Array.from(
          new Set(
            validationVariantSummaries
              .filter(
                (summary) =>
                  summary.xml_ready_records > 0 &&
                  (!selectedDeviceSubjectFamily || summary.product_family === selectedDeviceSubjectFamily),
              )
              .map((summary) => summary.product_variant)
              .filter(Boolean),
          ),
        )
      : Array.from(
          new Set(
            deviceSubjects
              .filter(
                (subject) =>
                  (!selectedDeviceSubjectFamily || subject.product_family === selectedDeviceSubjectFamily) &&
                  subject.product_variant,
              )
              .map((subject) => subject.product_variant)
              .filter((variant): variant is string => Boolean(variant)),
          ),
        )
  ).sort((left, right) => left.localeCompare(right));
  const validationVariantOperationLookup = new Map(
    validationVariantSummaries.map((summary) => [
      `${summary.source_workbook}::${summary.source_sheet}`,
      summary.submission_operation,
    ]),
  );
  const selectedFamilySummary =
    (selectedValidationFamily
      ? validationFamilySummaries.find((summary) => summary.product_family === selectedValidationFamily) ?? null
      : null);
  const selectedFamilyVariantSummaries = validationVariantSummaries.filter(
    (summary) => (!selectedValidationFamily || summary.product_family === selectedValidationFamily),
  );
  const selectedVariantSummary =
    (selectedValidationVariant
      ? selectedFamilyVariantSummaries.find((summary) => summary.product_variant === selectedValidationVariant) ?? null
      : null);
  const selectedVariantRecords = canonicalValidationRecords.filter(
    (record) =>
      (!selectedValidationFamily || record.product_family === selectedValidationFamily) &&
      (!selectedValidationVariant || record.product_variant === selectedValidationVariant),
  );
  const sampleValidationRecords = selectedVariantRecords.slice(0, 8);
  const selectedValidationRecord =
    sampleValidationRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    selectedVariantRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    sampleValidationRecords[0] ??
    selectedVariantRecords[0] ??
    null;
  const selectedValidationScopeRows =
    selectedVariantSummary?.total_records ??
    selectedFamilySummary?.total_records ??
    canonicalValidation?.validation_subset_records ??
    0;
  const selectedValidationReadyRows =
    selectedVariantSummary?.ready_records ??
    selectedFamilySummary?.ready_records ??
    canonicalValidation?.ready_records ??
    0;
  const selectedValidationBlockedRows =
    selectedVariantSummary?.blocked_records ??
    selectedFamilySummary?.blocked_records ??
    canonicalValidation?.blocked_records ??
    0;
  const selectedValidationXmlReadyRows =
    selectedVariantSummary?.xml_ready_records ??
    selectedFamilySummary?.xml_ready_records ??
    canonicalValidation?.xml_ready_records ??
    0;
  const selectedValidationStatus =
    selectedValidationScopeRows === 0
      ? { label: "Stop", className: "danger" }
      : selectedValidationBlockedRows > 0
        ? { label: "Warning", className: "warn" }
        : { label: "Ready", className: "ok" };
  const blockerSummaries = canonicalValidation?.blocker_summaries ?? [];
  const topBlockerHighlights = [...blockerSummaries]
    .filter((summary) => summary.missing_count > 0)
    .sort((left, right) => right.missing_count - left.missing_count)
    .slice(0, 6);
  const selectedStorageExample = selectedValidationRecord?.storage_condition_items[0] ?? null;
  const selectedWarningExample = selectedValidationRecord?.critical_warning_items[0] ?? null;
  const selectedMarketAvailabilityExample = selectedValidationRecord?.market_availability_items[0] ?? null;
  const selectedOpenBlockerPreview = selectedValidationRecord?.blockers.slice(0, 3) ?? [];
  const selectedXmlBlockerPreview = selectedValidationRecord?.xml_blockers.slice(0, 3) ?? [];
  const selectedValidationFieldLookup = new Map(
    (selectedValidationRecord?.fields ?? []).map((field) => [field.canonical_path, field]),
  );
  const canonicalMappingRowLookup = new Map(canonicalMappingRows.map((row) => [row.canonicalPath, row]));
  const selectedValidationMappingRows = (selectedValidationRecord?.fields ?? []).map((field) => ({
    field,
    review: canonicalMappingRowLookup.get(field.canonical_path) ?? null,
  }));
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
  const latestImportBatch = latestWorkbookImportSummary?.import_batch ?? null;
  const importedWorkbooks = latestWorkbookImportSummary?.imported_workbooks ?? [];
  const importTableCounts = latestWorkbookImportSummary?.table_counts ?? [];
  const importOperationCounts = latestWorkbookImportSummary?.operation_counts ?? [];
  const canonicalProjectionStatus = latestWorkbookImportSummary?.canonical_projection_status ?? "missing";
  const mergedSourceRowCount = latestWorkbookImportSummary?.merged_source_row_count ?? 0;
  const distinctSubjectCount = latestImportBatch?.device_subject_count ?? 0;
  const workbookDuplicateRowCount = latestWorkbookImportSummary?.workbook_duplicate_row_count ?? 0;
  const workbookDuplicateGroupCount = latestWorkbookImportSummary?.workbook_duplicate_group_count ?? 0;
  const topDuplicateGroups = latestWorkbookImportSummary?.top_duplicate_groups ?? [];
  const unresolvedIdentityRowCount = latestWorkbookImportSummary?.unresolved_identity_row_count ?? 0;
  const sourceRowTableCount = latestImportBatch?.source_row_count ?? 0;
  const deviceSubjectTableCount = latestImportBatch?.device_subject_count ?? 0;
  const filteredDeviceSubjects = deviceSubjects.filter(
    (subject) =>
      (!selectedDeviceSubjectFamily || subject.product_family === selectedDeviceSubjectFamily) &&
      (!selectedDeviceSubjectVariant || subject.product_variant === selectedDeviceSubjectVariant),
  );
  const monitoredTables = databaseSchemaSummary?.tables ?? [];
  const healthTableSummaries = databaseHealthSummary?.table_summaries ?? [];
  const healthIssues = databaseHealthSummary?.issues ?? [];
  const indexedTableCount = monitoredTables.filter((table) => table.indexes.length > 0).length;
  const foreignKeyCount = monitoredTables.reduce((sum, table) => sum + table.foreign_keys.length, 0);
  const postDeviceSubjectCount =
    importOperationCounts.find((entry) => entry.submission_operation === "POST")?.device_subject_count ?? 0;
  const patchDeviceSubjectCount =
    importOperationCounts.find((entry) => entry.submission_operation === "PATCH")?.device_subject_count ?? 0;
  const unclassifiedDeviceSubjectCount =
    importOperationCounts
      .filter((entry) => entry.submission_operation !== "POST" && entry.submission_operation !== "PATCH")
      .reduce((sum, entry) => sum + entry.device_subject_count, 0);
  const identityIssueTableCount =
    importTableCounts.find((entry) => entry.table_name === "device_identity_issue")?.row_count ??
    0;
  const sourceSnapshotTables = importTableCounts.filter((entry) =>
    ["import_batch", "source_workbook", "source_row", "device_subject", "device_identity_issue"].includes(entry.table_name),
  );
  const testingStateTables = importTableCounts.filter((entry) =>
    ["testing_subjects", "testing_events", "reviewed_post_baselines"].includes(entry.table_name),
  );
  const submissionSnapshotStatus = latestImportBatch
    ? canonicalProjectionStatus === "ready"
      ? {
          label: "Projected",
          className: "ok",
          detail: `Workbook to SQLite and canonical projection are current for batch #${latestImportBatch.import_batch_id}.`,
        }
      : canonicalProjectionStatus === "stale"
        ? {
            label: "Projection stale",
            className: "warn",
            detail: `Workbook import exists for batch #${latestImportBatch.import_batch_id}, but the canonical projection no longer matches that batch.`,
          }
        : {
            label: "Projection missing",
            className: "danger",
            detail: `Workbook import exists for batch #${latestImportBatch.import_batch_id}, but the canonical projection is not currently available in SQLite.`,
          }
    : {
        label: hasWorkbookImportSnapshot
          ? "Snapshot pending"
          : workbookImportSummaryError
            ? "Snapshot unavailable"
            : "Import required",
        className: latestImportBatch ? "ok" : "warn",
        detail:
          !hasWorkbookImportSnapshot && !workbookImportSummaryError
            ? "No workbook import snapshot exists yet. Run the initial import to populate the SQLite-backed submission view."
            : workbookImportSummaryError
              ? workbookImportSummaryError
              : "Submission Data requires a workbook import before SQLite-backed monitoring and read-model panels can load.",
      };
  const canonicalProjectionUiStatus =
    canonicalValidation?.projection_status === "rebuilt"
      ? {
          label: "Projection rebuilt",
          className: "warn",
          detail:
            canonicalValidation.source_import_batch_id !== null
              ? `SQLite canonical projection was rebuilt for import batch #${canonicalValidation.source_import_batch_id} during this request.`
              : "SQLite canonical projection was rebuilt during this request.",
        }
      : canonicalValidation?.projection_status === "ready"
        ? {
            label: "SQLite ready",
            className: "ok",
            detail:
              canonicalValidation.source_import_batch_id !== null
                ? `Canonical validation is reading the current SQLite projection for import batch #${canonicalValidation.source_import_batch_id}.`
                : "Canonical validation is reading the current SQLite projection.",
          }
        : !latestImportBatch
          ? {
              label: "Import required",
              className: "warn",
              detail: "Canonical Validation now depends on the imported SQLite projection. Run Import Workbooks first.",
            }
          : {
              label: "Loading scope",
              className: "warn",
              detail: trackedValidationFieldCount
                ? `${trackedValidationFieldCount} unique canonical fields are currently carried into validation.`
                : "Loading validation subset...",
            };
  const selectedDeviceSubjectFamilySummary =
    validationFamilySummaries.find((summary) => summary.product_family === selectedDeviceSubjectFamily) ?? null;
  const selectedDeviceSubjectVariantSummary =
    validationVariantSummaries.find(
      (summary) =>
        summary.product_family === selectedDeviceSubjectFamily &&
        summary.product_variant === selectedDeviceSubjectVariant,
    ) ?? null;
  const fallbackDeviceSubjectFamilyCount = new Set(
    deviceSubjects
      .map((subject) => subject.product_family)
      .filter((family): family is string => Boolean(family)),
  ).size;
  const fallbackDeviceSubjectVariantCount = new Set(
    deviceSubjects
      .filter((subject) => !selectedDeviceSubjectFamily || subject.product_family === selectedDeviceSubjectFamily)
      .map((subject) => subject.product_variant)
      .filter((variant): variant is string => Boolean(variant)),
  ).size;
  const selectedDeviceSubjectScopeRows =
    selectedDeviceSubjectVariantSummary?.total_records ??
    selectedDeviceSubjectFamilySummary?.total_records ??
    (canonicalValidation ? canonicalValidation.validation_subset_records : filteredDeviceSubjects.length);
  const selectedDeviceSubjectXmlReadyRows =
    selectedDeviceSubjectVariantSummary?.xml_ready_records ??
    selectedDeviceSubjectFamilySummary?.xml_ready_records ??
    (canonicalValidation ? canonicalValidation.xml_ready_records : filteredDeviceSubjects.length);
  const selectedDeviceSubjectBlockedRows =
    selectedDeviceSubjectVariantSummary?.blocked_records ??
    selectedDeviceSubjectFamilySummary?.blocked_records ??
    0;
  const selectedDeviceSubjectStatus =
    selectedDeviceSubjectScopeRows === 0 || filteredDeviceSubjects.length === 0 || selectedDeviceSubjectXmlReadyRows === 0
      ? {
          label: "Stop",
          className: "danger",
        }
      : selectedDeviceSubjectBlockedRows > 0 || filteredDeviceSubjects.length < selectedDeviceSubjectXmlReadyRows
        ? {
            label: "Warning",
            className: "warn",
          }
        : {
            label: "Ready",
            className: "ok",
          };
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
  const selectedBulkEligiblePostRecords = selectedXmlVariantRecords.filter(
    (record) => (record.submission_operation ?? "").toUpperCase() === "POST",
  );
  const selectedBulkEligiblePostCount = selectedBulkEligiblePostRecords.length;
  const selectedBulkEligibleBasicUdiSet = new Set(
    selectedBulkEligiblePostRecords
      .map((record) => basicUdiDiForRecord(record))
      .filter((value): value is string => Boolean(value)),
  );
  const selectedBulkEligibleBasicUdiCount = selectedBulkEligibleBasicUdiSet.size;
  const bulkPatchPostedParents = buildBulkPatchPostedParentGroups(testingSubjectSummaries);
  const bulkPatchPostedEntries = buildBulkPatchPostedEntries(
    testingSubjectSummaries,
    selectedBulkPatchBasicUdiDi || null,
  );
  const postedBulkParentBasicUdiSet = new Set(
    bulkPatchPostedParents
      .map((group) => group.basic_udi_di)
      .filter((value): value is string => Boolean(value)),
  );
  const selectedBulkUnpostedBasicUdiCount = Array.from(selectedBulkEligibleBasicUdiSet).filter(
    (basicUdiDi) => !postedBulkParentBasicUdiSet.has(basicUdiDi),
  ).length;
  const selectedBulkEligibleUdidiPostCount = (() => {
    const groupedCounts = new Map<string, number>();
    for (const record of selectedBulkEligiblePostRecords) {
      const basicUdi = basicUdiDiForRecord(record);
      if (basicUdi) {
        groupedCounts.set(basicUdi, (groupedCounts.get(basicUdi) ?? 0) + 1);
      }
    }
    return Array.from(groupedCounts.values()).reduce((sum, count) => sum + Math.max(count - 1, 0), 0);
  })();
  const fallbackBulkPatchParentOptions = Array.from(
    selectedBulkEligiblePostRecords.reduce((groups, record) => {
      const basicUdi = basicUdiDiForRecord(record);
      if (!basicUdi) {
        return groups;
      }
      const existing = groups.get(basicUdi) ?? { totalRecords: 0, childCatalogueNumbers: [] as string[] };
      existing.totalRecords += 1;
      if (record.catalogue_number && record.primary_udi_di && !existing.childCatalogueNumbers.includes(record.catalogue_number)) {
        existing.childCatalogueNumbers.push(record.catalogue_number);
      }
      groups.set(basicUdi, existing);
      return groups;
    }, new Map<string, { totalRecords: number; childCatalogueNumbers: string[] }>()),
  )
    .map(([basic_udi_di, group]) => {
      const postedChildCount = Math.max(group.totalRecords - 1, 0);
      return {
        basic_udi_di,
        posted_child_count: postedChildCount,
        sample_catalogue_numbers: group.childCatalogueNumbers.slice(0, postedChildCount),
      };
    })
    .filter((group) => group.posted_child_count > 0);
  const displayedBulkPatchParentOptions =
    bulkPatchPostedParents.length > 0 ? bulkPatchPostedParents : fallbackBulkPatchParentOptions;
  const selectedBulkPatchParentGroup =
    displayedBulkPatchParentOptions.find((group) => group.basic_udi_di === selectedBulkPatchBasicUdiDi) ??
    displayedBulkPatchParentOptions[0] ??
    null;
  const selectedBulkPatchFallbackCatalogueNumbers = selectedBulkPatchParentGroup?.sample_catalogue_numbers ?? [];
  const bulkPatchPostedCatalogueNumbers = bulkPatchPostedEntries
    .map((entry) => entry.catalogue_number)
    .filter((catalogueNumber): catalogueNumber is string => Boolean(catalogueNumber));
  const bulkPatchPostedCatalogueSet = new Set(bulkPatchPostedCatalogueNumbers);
  const bulkPatchFilteredPostedEntries =
    bulkPatchScopeMode !== "selected_catalogue_numbers" || !bulkPatchCatalogueFilter.trim()
      ? bulkPatchPostedEntries
      : bulkPatchPostedEntries.filter((entry) =>
          (entry.catalogue_number ?? "").toLowerCase().includes(bulkPatchCatalogueFilter.trim().toLowerCase()),
        );
  const bulkPatchImportedCatalogueNumbers = parseCatalogueNumberList(bulkPatchImportText);
  const bulkPatchImportedMatchedEntries = bulkPatchPostedEntries.filter(
    (entry) => entry.catalogue_number && bulkPatchImportedCatalogueNumbers.includes(entry.catalogue_number),
  );
  const bulkPatchImportedMatchedCatalogueNumbers = bulkPatchImportedMatchedEntries
    .map((entry) => entry.catalogue_number)
    .filter((catalogueNumber): catalogueNumber is string => Boolean(catalogueNumber));
  const bulkPatchImportedNotFoundCatalogueNumbers = bulkPatchImportedCatalogueNumbers.filter(
    (catalogueNumber) => !bulkPatchPostedCatalogueSet.has(catalogueNumber),
  );
  const effectiveBulkPatchCatalogueNumbers =
    bulkPatchScopeMode === "all_posted"
      ? (bulkPatchPostedCatalogueNumbers.length > 0 ? bulkPatchPostedCatalogueNumbers : selectedBulkPatchFallbackCatalogueNumbers)
      : bulkPatchScopeMode === "selected_catalogue_numbers"
        ? selectedBulkPatchCatalogueNumbers
        : bulkPatchImportedMatchedCatalogueNumbers;
  const effectiveBulkPatchCatalogueSet = new Set(effectiveBulkPatchCatalogueNumbers);
  const selectedBulkPatchEntries = bulkPatchPostedEntries.filter(
    (entry) => entry.catalogue_number && effectiveBulkPatchCatalogueSet.has(entry.catalogue_number),
  );
  const selectedBulkPatchSelectedCount = effectiveBulkPatchCatalogueNumbers.length;
  const selectedBulkPatchEligibleCount =
    selectedBulkPatchParentGroup?.posted_child_count ??
    Math.max(bulkPatchPostedEntries.length, selectedBulkPatchFallbackCatalogueNumbers.length);
  const canRunBulkPatch =
    Boolean(selectedBulkPatchParentGroup) &&
    (
      (bulkPatchScopeMode === "all_posted" && selectedBulkPatchEligibleCount > 0) ||
      (bulkPatchScopeMode !== "all_posted" && selectedBulkPatchSelectedCount > 0)
    );
  const bulkPatchReadinessReason = !selectedBulkPatchParentGroup
    ? "No Basic UDI-DI parent is selected."
    : bulkPatchScopeMode === "all_posted" && selectedBulkPatchEligibleCount < 1
      ? "No posted child devices are currently available under the selected parent."
      : bulkPatchScopeMode === "selected_catalogue_numbers" && selectedBulkPatchSelectedCount < 1
        ? "Select at least one posted catalogue number."
      : bulkPatchScopeMode === "import_catalogue_list" && selectedBulkPatchSelectedCount < 1
        ? "Import at least one posted catalogue number that matches the selected parent."
        : "Ready.";
  const bulkPatchScopeLabel =
    bulkPatchScopeMode === "all_posted"
      ? "All posted devices"
      : bulkPatchScopeMode === "selected_catalogue_numbers"
        ? "Selected catalogue numbers"
        : "Import catalogue list";
  const bulkPatchSelectionExamples = effectiveBulkPatchCatalogueNumbers.slice(0, 5);
  const bulkPatchSelectionOverflowCount = Math.max(selectedBulkPatchSelectedCount - bulkPatchSelectionExamples.length, 0);
  const bulkPatchSelectionVersions = Array.from(
    new Set(
      selectedBulkPatchEntries
        .map((entry) => entry.latest_version)
        .filter((version): version is string => Boolean(version)),
    ),
  );
  const bulkPatchVersionSummary =
    bulkPatchSelectionVersions.length < 1
      ? null
      : bulkPatchSelectionVersions.length === 1
        ? `Current versions: all ${bulkPatchSelectionVersions[0]}`
        : `Current versions: ${bulkPatchSelectionVersions.join(", ")}`;
  const bulkPatchPreviewExcludedRecords = xmlBulkPatchPreview?.excluded_records ?? [];
  const bulkPatchPrePreviewExclusions =
    xmlMode === "bulkPatch" && bulkPatchScopeMode === "import_catalogue_list"
      ? bulkPatchImportedNotFoundCatalogueNumbers.map((catalogueNumber) => ({
          catalogue_number: catalogueNumber,
          primary_udi_di: null,
          reason_code: "not_found_under_parent",
          reason_message: "Catalogue number is not posted under the selected parent.",
        }))
      : [];
  const bulkPatchDisplayedExcludedRecords =
    bulkPatchPreviewExcludedRecords.length > 0 ? bulkPatchPreviewExcludedRecords : bulkPatchPrePreviewExclusions;
  const bulkPatchActionStatus = !selectedBulkPatchParentGroup
    ? "Select a posted Basic UDI-DI parent to continue."
    : !canRunBulkPatch
      ? bulkPatchReadinessReason
      : xmlBulkPatchPreview
        ? xmlBulkPatchPreview.excluded_record_count > 0
          ? `Preview ready. ${xmlBulkPatchPreview.included_record_count} devices will be generated and ${xmlBulkPatchPreview.excluded_record_count} will be excluded.`
          : `Preview ready. ${xmlBulkPatchPreview.included_record_count} devices will be generated.`
        : `Ready to generate bulk PATCH for ${selectedBulkPatchSelectedCount} device${selectedBulkPatchSelectedCount === 1 ? "" : "s"}.`;
  const assessedBulkParentGroupCount = assessmentEvidenceNumber(xmlOperationAssessment, "eligible_parent_group_count");
  const assessedBulkChildRecordCount = assessmentEvidenceNumber(xmlOperationAssessment, "eligible_child_record_count");
  const assessedUnpostedParentGroupCount = assessmentEvidenceNumber(xmlOperationAssessment, "unposted_parent_group_count");
  const assessedSelectedBasicUdiDi = assessmentEvidenceString(xmlOperationAssessment, "selected_basic_udi_di");
  const assessedLatestVersionSummary = assessmentEvidenceStringArray(xmlOperationAssessment, "latest_version_summary");
  const assessedPatchLatestAcceptedVersion = assessmentEvidenceString(xmlOperationAssessment, "latest_accepted_version");
  const assessedPatchReviewedBaseline = assessmentEvidenceBoolean(xmlOperationAssessment, "reviewed_post_baseline_present");
  const assessedPatchTrackedRegistration = assessmentEvidenceBoolean(xmlOperationAssessment, "tracked_registration_known");
  const assessedPostParentRegistrationKnown = assessmentEvidenceBoolean(xmlOperationAssessment, "parent_registration_known");
  const assessedPostCandidateCatalogueNumber = assessmentEvidenceString(xmlOperationAssessment, "candidate_catalogue_number");
  const selectedPostCandidateRecord =
    (assessedPostCandidateCatalogueNumber
      ? selectedXmlVariantRecords.find((record) => record.catalogue_number === assessedPostCandidateCatalogueNumber)
      : null) ?? null;
  const selectedXmlMarketInfoRecord = selectedXmlRecord ?? selectedXmlPairRecord;
  const selectedPairRequestArgs =
    selectedXmlPairRecord?.catalogue_number
      ? {
          product_family: selectedXmlPairRecord.product_family,
          product_variant: selectedXmlPairRecord.product_variant,
          catalogue_number: selectedXmlPairRecord.catalogue_number,
          primary_udi_di: selectedXmlPairRecord.primary_udi_di,
        }
      : null;
  const selectedMarketInfoRequestArgs =
    selectedXmlMarketInfoRecord?.catalogue_number
      ? {
          product_family: selectedXmlMarketInfoRecord.product_family,
          product_variant: selectedXmlMarketInfoRecord.product_variant,
          catalogue_number: selectedXmlMarketInfoRecord.catalogue_number,
          primary_udi_di: selectedXmlMarketInfoRecord.primary_udi_di,
        }
      : null;
  const hasSelectedPatchBaselinePost = Boolean(selectedXmlPairRecord);
  const hasReviewedPatchBaselinePost = Boolean(
    selectedPairRequestArgs &&
      xmlPairPreview &&
      xmlPairPreview.product_family === selectedPairRequestArgs.product_family &&
      xmlPairPreview.product_variant === selectedPairRequestArgs.product_variant &&
      xmlPairPreview.catalogue_number === selectedPairRequestArgs.catalogue_number,
  );
  const selectedXmlVariantChunkCount = selectedXmlVariantSummary
    ? Math.max(Math.ceil(selectedXmlVariantSummary.xml_ready_records / 300), 1)
    : 1;
  const selectedBulkCapacity =
    xmlMode === "bulkPost"
      ? assessedUnpostedParentGroupCount ?? selectedBulkUnpostedBasicUdiCount
      : xmlMode === "bulkUdidiPost"
        ? assessedBulkChildRecordCount ?? selectedBulkEligibleUdidiPostCount
        : selectedBulkPatchEligibleCount;
  const normalizedBulkRecordCount = Math.min(Math.max(selectedBulkRecordCount, 1), Math.max(selectedBulkCapacity, 1));
  const selectedBulkChunkCount =
    xmlMode === "bulkPost"
      ? xmlBulkPostPreview?.chunk_count ?? Math.max(Math.ceil(normalizedBulkRecordCount / 300), 1)
      : xmlMode === "bulkUdidiPost"
        ? xmlBulkUdidiPostPreview?.chunk_count ?? Math.max(Math.ceil(normalizedBulkRecordCount / 300), 1)
      : xmlMode === "bulkPatch"
        ? xmlBulkPatchPreview?.chunk_count ?? Math.max(Math.ceil(Math.max(selectedBulkPatchSelectedCount, 1) / 300), 1)
        : selectedXmlVariantChunkCount;
  const selectedBulkPreview =
    xmlMode === "bulkPost"
      ? xmlBulkPostPreview
        : xmlMode === "bulkUdidiPost"
        ? xmlBulkUdidiPostPreview
        : xmlMode === "bulkPatch"
          ? xmlBulkPatchPreview
          : null;
  const selectedBulkExclusionSummaries = selectedBulkPreview
    ? summarizeBulkExcludedRecords(
        xmlMode === "bulkPost" ? "bulkPost" : xmlMode === "bulkUdidiPost" ? "bulkUdidiPost" : "bulkPatch",
        selectedBulkPreview,
      )
    : [];
  const bulkPostReadinessMessage =
    (assessedUnpostedParentGroupCount ?? selectedBulkUnpostedBasicUdiCount) > 0
      ? `Ready to generate ${assessedUnpostedParentGroupCount ?? selectedBulkUnpostedBasicUdiCount} unposted Basic UDI-DI parent${(assessedUnpostedParentGroupCount ?? selectedBulkUnpostedBasicUdiCount) === 1 ? "" : "s"}.`
      : "All Basic UDI-DI parents for this variant already have successful parent DEVICE.POST entries. Use Bulk UDI-DI POST for additional child devices.";
  useEffect(() => {
    const parentOption = displayedBulkPatchParentOptions[0]?.basic_udi_di ?? "";
    if (
      selectedBulkPatchBasicUdiDi &&
      displayedBulkPatchParentOptions.some((group) => group.basic_udi_di === selectedBulkPatchBasicUdiDi)
    ) {
      return;
    }
    setSelectedBulkPatchBasicUdiDi(parentOption);
  }, [displayedBulkPatchParentOptions, selectedBulkPatchBasicUdiDi]);
  useEffect(() => {
    if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) {
      setTestingSubjectSummaries([]);
      return;
    }
    let cancelled = false;
    void api
      .testingSubjectSummaries({
        product_family: selectedXmlFamilySummary.product_family,
        product_variant: selectedXmlVariantSummary.product_variant,
        limit: 10000,
      })
      .then((response) => {
        if (!cancelled) {
          setTestingSubjectSummaries(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTestingSubjectSummaries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedXmlFamilySummary?.product_family, selectedXmlVariantSummary?.product_variant]);
  useEffect(() => {
    if (activeTab !== "xml") {
      return;
    }
    if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) {
      setXmlOperationAssessment(null);
      setXmlOperationAssessmentError(null);
      setIsLoadingXmlOperationAssessment(false);
      return;
    }
    if (xmlMode === "single" || xmlMode === "marketInfo") {
      setXmlOperationAssessment(null);
      setXmlOperationAssessmentError(null);
      setIsLoadingXmlOperationAssessment(false);
      return;
    }

    let cancelled = false;
    setIsLoadingXmlOperationAssessment(true);
    setXmlOperationAssessment(null);
    setXmlOperationAssessmentError(null);

    void (async () => {
      try {
        const assessment =
          xmlMode === "post"
            ? await api.assessSinglePost(
                selectedXmlFamilySummary.product_family,
                selectedXmlVariantSummary.product_variant,
              )
            : xmlMode === "patch"
              ? await api.assessSinglePatch(
                  selectedXmlFamilySummary.product_family,
                  selectedXmlVariantSummary.product_variant,
                  selectedPairRequestArgs?.catalogue_number ?? undefined,
                )
              : xmlMode === "bulkPatch"
                ? await api.assessBulkPatch(
                    selectedXmlFamilySummary.product_family,
                    selectedXmlVariantSummary.product_variant,
                    selectedBulkPatchBasicUdiDi || undefined,
                  )
                : await api.assessBulkPost(
                    selectedXmlFamilySummary.product_family,
                    selectedXmlVariantSummary.product_variant,
                  );
        if (!cancelled) {
          setXmlOperationAssessment(assessment);
        }
      } catch (requestError) {
        if (!cancelled) {
          setXmlOperationAssessment(null);
          setXmlOperationAssessmentError(
            requestError instanceof Error ? requestError.message : "Operation assessment is unavailable.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingXmlOperationAssessment(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    xmlMode,
    selectedXmlFamilySummary,
    selectedXmlVariantSummary,
    selectedPairRequestArgs?.catalogue_number,
    selectedBulkPatchBasicUdiDi,
  ]);
  useEffect(() => {
    if (!selectedBulkPatchParentGroup) {
      setSelectedBulkPatchCatalogueNumbers([]);
      return;
    }
    setBulkPatchCatalogueFilter("");
    setBulkPatchImportText("");
  }, [selectedBulkPatchParentGroup?.basic_udi_di]);
  useEffect(() => {
    const filtered = selectedBulkPatchCatalogueNumbers.filter((catalogueNumber) => bulkPatchPostedCatalogueSet.has(catalogueNumber));
    if (filtered.length === selectedBulkPatchCatalogueNumbers.length) {
      return;
    }
    setSelectedBulkPatchCatalogueNumbers(filtered);
  }, [bulkPatchPostedCatalogueNumbers.join("|")]);
  const bulkPatchIncludedByCatalogue = new Map(
    (xmlBulkPatchPreview?.included_records ?? []).map((record) => [record.catalogue_number, record]),
  );
  const bulkPatchExcludedByCatalogue = new Map(
    (xmlBulkPatchPreview?.excluded_records ?? [])
      .filter((record) => record.catalogue_number)
      .map((record) => [record.catalogue_number ?? "", record]),
  );
  const selectedPatchScenario =
    PATCH_SCENARIOS.find((scenario) => scenario.id === selectedPatchScenarioId) ?? PATCH_SCENARIOS[0];
  const selectedPatchScenarioStatus = patchScenarioStatuses[selectedPatchScenario.id];
  const selectedPatchScenarioImplemented = selectedPatchScenario.implemented;
  const selectedLatestPatchState = xmlPairPreview?.latest_successful_patch_state ?? null;
  const selectedPatchWarningCodes = selectedLatestPatchState
    ? selectedLatestPatchState.critical_warnings.map((item) => item.code).filter((value) => value)
    : (selectedXmlPairRecord?.critical_warning_items ?? [])
        .map((item) => item.normalized_code?.trim() || item.item_type?.trim() || "")
        .filter((value) => value);
  const selectedPatchWarningDescriptions = selectedLatestPatchState
    ? selectedLatestPatchState.critical_warnings
        .map((item) => item.comment?.trim() || "")
        .filter((value) => value)
    : (selectedXmlPairRecord?.critical_warning_items ?? [])
        .map((item) => item.description?.trim() || "")
        .filter((value) => value);
  const selectedPatchStorageConditionMap = new Map(
    selectedLatestPatchState
      ? selectedLatestPatchState.storage_conditions.map((item) => [item.code, item.comment ?? "None"])
      : (selectedXmlPairRecord?.storage_condition_items ?? [])
          .filter((item) => item.normalized_code)
          .map((item) => [item.normalized_code ?? "", item.description ?? "None"]),
  );
  const selectedCurrentTradeName =
    selectedLatestPatchState?.trade_name ?? selectedXmlPairRecord?.trade_name ?? null;
  const selectedCurrentBaseQuantity =
    selectedLatestPatchState?.base_quantity ??
    (fieldValue(selectedXmlPairRecord, "device_record.base_quantity")
      ? Number(fieldValue(selectedXmlPairRecord, "device_record.base_quantity"))
      : null);
  const selectedCurrentSterile =
    selectedLatestPatchState?.sterile ?? parseBooleanString(fieldValue(selectedXmlPairRecord, "device_record.sterile"));
  const selectedCurrentLatex =
    selectedLatestPatchState?.contains_latex ??
    parseBooleanString(fieldValue(selectedXmlPairRecord, "device_record.contains_latex"));
  const selectedCurrentStatusCode =
    selectedLatestPatchState?.status_code ?? fieldValue(selectedXmlPairRecord, "device_record.status");
  const isSharedAnchorLoading =
    (xmlMode === "post" || xmlMode === "patch" || xmlMode === "marketInfo") &&
    Boolean(selectedPairRequestArgs) &&
    !xmlPairPreview;
  useEffect(() => {
    if (!(xmlMode === "patch" || xmlMode === "marketInfo") || !selectedPairRequestArgs) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const preview = await api.previewXmlPostRegistration(
          selectedPairRequestArgs.product_family,
          selectedPairRequestArgs.product_variant,
          selectedPairRequestArgs.catalogue_number,
        );
        if (!cancelled) {
          setXmlPairPreview(preview);
        }
      } catch {
        // Keep the last loaded anchor state until the user explicitly regenerates or changes selection.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    xmlMode,
    selectedPairRequestArgs?.product_family,
    selectedPairRequestArgs?.product_variant,
    selectedPairRequestArgs?.catalogue_number,
  ]);
  useEffect(() => {
    if (!selectedPairRequestArgs || !xmlPairPreview) {
      return;
    }
    if (
      xmlPairPreview.product_family !== selectedPairRequestArgs.product_family ||
      xmlPairPreview.product_variant !== selectedPairRequestArgs.product_variant ||
      xmlPairPreview.catalogue_number !== selectedPairRequestArgs.catalogue_number
    ) {
      return;
    }
    setSelectedPatchScenarioId(
      resolveDefaultPatchScenarioId(xmlPairPreview.latest_successful_patch_scenario_id),
    );
  }, [
    selectedPairRequestArgs?.product_family,
    selectedPairRequestArgs?.product_variant,
    selectedPairRequestArgs?.catalogue_number,
    xmlPairPreview?.product_family,
    xmlPairPreview?.product_variant,
    xmlPairPreview?.catalogue_number,
    xmlPairPreview?.latest_successful_patch_scenario_id,
  ]);
  useEffect(() => {
    setSelectedBulkRecordCount(1);
    setSelectedXmlChunkSequence(1);
    setXmlBulkPostPreview(null);
    setXmlBulkUdidiPostPreview(null);
    setXmlBulkPatchPreview(null);
  }, [selectedXmlFamily, selectedXmlVariant]);
  useEffect(() => {
    if (selectedBulkRecordCount > Math.max(selectedBulkCapacity, 1)) {
      setSelectedBulkRecordCount(Math.max(selectedBulkCapacity, 1));
    }
  }, [selectedBulkCapacity, selectedBulkRecordCount]);
  useEffect(() => {
    setSelectedXmlChunkSequence(1);
    setXmlBulkPatchPreview(null);
  }, [selectedBulkPatchBasicUdiDi, selectedBulkPatchCatalogueNumbers, selectedPatchScenarioId]);
  useEffect(() => {
    if (selectedPatchScenarioId !== "equivalent_first_patch" && isSharedAnchorLoading) {
      return;
    }
    setPatchPreviewView("derived");
    const latestSuccessfulVersion = Number(xmlPairPreview?.latest_successful_patch_state?.version ?? "1");
    const nextVersion =
      selectedPatchScenarioId === "equivalent_first_patch"
        ? "2"
        : Number.isInteger(latestSuccessfulVersion) && latestSuccessfulVersion >= 1
          ? String(latestSuccessfulVersion + 1)
          : "2";
    setPatchVersionInput(nextVersion);
    setXmlPatchPreview(null);
    if (xmlPairPreview?.latest_successful_patch_state) {
      setPatchTradeNameInput(xmlPairPreview.latest_successful_patch_state.trade_name ?? "");
    } else if (selectedXmlPairRecord) {
      setPatchTradeNameInput(selectedXmlPairRecord.trade_name ?? "");
    } else {
      setPatchTradeNameInput("");
    }
    setPatchWarningCodeInput("");
    setPatchWarningCommentInput("");
    setPatchBaseQuantityInput(
      selectedCurrentBaseQuantity !== null && selectedCurrentBaseQuantity !== undefined
        ? String(selectedCurrentBaseQuantity)
        : "",
    );
    setPatchSterileInput(selectedCurrentSterile === null ? "" : selectedCurrentSterile ? "true" : "false");
    setPatchLatexInput(selectedCurrentLatex === null ? "" : selectedCurrentLatex ? "true" : "false");
    setPatchStatusCodeInput(selectedCurrentStatusCode ?? "");
    setPatchStorageConditionInputs({
      SHC006: "",
      SHC007: "",
    });
  }, [
    selectedXmlFamily,
    selectedXmlVariant,
    selectedPatchScenarioId,
    selectedXmlRecordKey,
    xmlPairPreview,
    selectedXmlPairRecord,
    selectedCurrentBaseQuantity,
    selectedCurrentSterile,
    selectedCurrentLatex,
    selectedCurrentStatusCode,
    isSharedAnchorLoading,
  ]);
  useEffect(() => {
    setXmlPatchPreview(null);
  }, [
    patchVersionInput,
    patchTradeNameInput,
    patchWarningCodeInput,
    patchWarningCommentInput,
    patchBaseQuantityInput,
    patchSterileInput,
    patchLatexInput,
    patchStatusCodeInput,
    patchStorageConditionInputs,
  ]);
  useEffect(() => {
    setXmlBulkPatchPreview(null);
  }, [
    selectedBulkRecordCount,
    selectedPatchScenarioId,
    patchTradeNameInput,
    patchWarningCodeInput,
    patchWarningCommentInput,
    patchBaseQuantityInput,
    patchSterileInput,
    patchLatexInput,
    patchStatusCodeInput,
    patchStorageConditionInputs,
  ]);
  useEffect(() => {
    setXmlBulkPostPreview(null);
  }, [selectedBulkRecordCount]);
  useEffect(() => {
    setXmlBulkUdidiPostPreview(null);
  }, [selectedBulkRecordCount]);
  const matchesSelectedPatchPreview = Boolean(
    xmlPatchPreview &&
      selectedPairRequestArgs &&
      xmlPatchPreview.catalogue_number === selectedPairRequestArgs.catalogue_number &&
      xmlPatchPreview.product_family === selectedPairRequestArgs.product_family &&
      xmlPatchPreview.product_variant === selectedPairRequestArgs.product_variant &&
      xmlPatchPreview.scenario_id === selectedPatchScenario.id,
  );
  const currentAcceptedPatchVersion = selectedLatestPatchState
    ? Number(selectedLatestPatchState.version)
    : 1;
  const currentAcceptedPatchLabel = selectedLatestPatchState
    ? `Latest successful PATCH version ${selectedLatestPatchState.version}`
    : "Accepted POST version 1";
  const requiredPatchVersion = selectedPatchScenario.id === "equivalent_first_patch" ? 2 : currentAcceptedPatchVersion + 1;
  const currentPatchVersion = Number(patchVersionInput);
  const hasReviewedGeneratedPatchPreview = Boolean(matchesSelectedPatchPreview && xmlPatchPreview);
  const patchDraftComparisonRows: PatchScenarioComparisonRow[] = matchesSelectedPatchPreview && xmlPatchPreview
    ? xmlPatchPreview.field_deltas.map((delta) => ({
        label: delta.label,
        before: delta.before_value ?? "None",
        after: delta.after_value ?? "None",
      }))
    : selectedXmlPairRecord
    ? selectedPatchScenario.id === "equivalent_first_patch"
      ? [
          {
            label: "PATCH Version",
            before: "1",
            after: "2",
          },
        ]
      : !selectedPatchScenarioImplemented
        ? [
            {
              label: "PATCH Version",
              before: String(currentAcceptedPatchVersion),
              after: patchVersionInput.trim() || "Pending input",
            },
            {
              label: "Candidate Target",
              before: "Current accepted device state",
              after: selectedPatchScenario.target,
            },
          ]
      : selectedPatchScenario.id === "trade_name_edit"
        ? [
            {
              label: "PATCH Version",
              before: String(currentAcceptedPatchVersion),
              after: patchVersionInput.trim() || "Pending input",
            },
            {
              label: "Trade Name",
              before: selectedCurrentTradeName ?? "None",
              after: patchTradeNameInput.trim() || "Pending input",
            },
          ]
        : selectedPatchScenario.id === "base_quantity_edit"
          ? [
              {
                label: "PATCH Version",
                before: String(currentAcceptedPatchVersion),
                after: patchVersionInput.trim() || "Pending input",
              },
              {
                label: "Base Quantity",
                before: selectedCurrentBaseQuantity !== null ? String(selectedCurrentBaseQuantity) : "None",
                after: patchBaseQuantityInput.trim() || "Pending input",
              },
            ]
        : selectedPatchScenario.id === "sterile_edit"
          ? [
              {
                label: "PATCH Version",
                before: String(currentAcceptedPatchVersion),
                after: patchVersionInput.trim() || "Pending input",
              },
              {
                label: "Sterile",
                before: selectedCurrentSterile === null ? "None" : selectedCurrentSterile ? "true" : "false",
                after: patchSterileInput.trim() || "Pending input",
              },
            ]
        : selectedPatchScenario.id === "latex_edit"
          ? [
              {
                label: "PATCH Version",
                before: String(currentAcceptedPatchVersion),
                after: patchVersionInput.trim() || "Pending input",
              },
              {
                label: "Latex",
                before: selectedCurrentLatex === null ? "None" : selectedCurrentLatex ? "true" : "false",
                after: patchLatexInput.trim() || "Pending input",
              },
            ]
        : selectedPatchScenario.id === "status_code_edit"
          ? [
              {
                label: "PATCH Version",
                before: String(currentAcceptedPatchVersion),
                after: patchVersionInput.trim() || "Pending input",
              },
              {
                label: "Status Code",
                before: selectedCurrentStatusCode ?? "None",
                after: patchStatusCodeInput.trim() || "Pending input",
              },
            ]
        : selectedPatchScenario.id === "warning_add"
          ? [
              {
                label: "PATCH Version",
                before: String(currentAcceptedPatchVersion),
                after: patchVersionInput.trim() || "Pending input",
              },
              {
                label: "Critical Warning",
                before: selectedPatchWarningCodes.join(", ") || "None",
                after: patchWarningCodeInput.trim()
                  ? patchWarningCommentInput.trim()
                    ? `${patchWarningCodeInput.trim()} (${patchWarningCommentInput.trim()})`
                    : patchWarningCodeInput.trim()
                  : "Pending input",
              },
            ]
          : [
              {
                label: "PATCH Version",
                before: String(currentAcceptedPatchVersion),
                after: patchVersionInput.trim() || "Pending input",
              },
              {
                label: "Storage Condition SHC006",
                before: selectedPatchStorageConditionMap.get("SHC006") ?? "None",
                after: patchStorageConditionInputs.SHC006?.trim() || "No change entered",
              },
              {
                label: "Storage Condition SHC007",
                before: selectedPatchStorageConditionMap.get("SHC007") ?? "None",
                after: patchStorageConditionInputs.SHC007?.trim() || "No change entered",
              },
            ]
    : [];
  const selectedWarningRequiresComment = patchWarningCodeInput.trim().toUpperCase() === "CW999";
  const isPatchVersionValid =
    Number.isInteger(currentPatchVersion) &&
    currentPatchVersion === requiredPatchVersion;
  const isPatchScenarioReady =
    hasReviewedPatchBaselinePost &&
    selectedPatchScenarioImplemented &&
    isPatchVersionValid &&
    (selectedPatchScenario.id === "equivalent_first_patch"
      ? true
      : selectedPatchScenario.id === "trade_name_edit"
      ? Boolean(patchTradeNameInput.trim())
      : selectedPatchScenario.id === "base_quantity_edit"
        ? Boolean(patchBaseQuantityInput.trim()) && Number.isInteger(Number(patchBaseQuantityInput)) && Number(patchBaseQuantityInput) > 0
      : selectedPatchScenario.id === "sterile_edit"
        ? patchSterileInput === "true" || patchSterileInput === "false"
      : selectedPatchScenario.id === "latex_edit"
        ? patchLatexInput === "true" || patchLatexInput === "false"
      : selectedPatchScenario.id === "status_code_edit"
        ? Boolean(patchStatusCodeInput.trim())
      : selectedPatchScenario.id === "warning_add"
        ? Boolean(patchWarningCodeInput.trim()) && (!selectedWarningRequiresComment || Boolean(patchWarningCommentInput.trim()))
        : Object.values(patchStorageConditionInputs).some((value) => value.trim()));
  const patchScenarioReadinessMessage = !selectedXmlPairRecord?.catalogue_number
    ? "Generate the baseline POST for an XML-ready POST record first."
    : !hasReviewedPatchBaselinePost
      ? "Generate and review the POST for this exact selected record before drafting a PATCH."
    : !patchVersionInput.trim()
      ? "Enter the required PATCH version integer."
      : !selectedPatchScenarioImplemented
        ? "This candidate scenario has been added to the design and dropdown, but XML generation is not implemented yet."
      : !isPatchVersionValid
        ? selectedPatchScenario.id === "equivalent_first_patch"
          ? "Equivalent First Patch must use PATCH version 2."
          : `PATCH version must be exactly ${requiredPatchVersion} based on the latest accepted state.`
        : selectedPatchScenario.id === "trade_name_edit" && !patchTradeNameInput.trim()
          ? "Enter the replacement trade name to define the after condition."
          : selectedPatchScenario.id === "base_quantity_edit" &&
              (!patchBaseQuantityInput.trim() || !Number.isInteger(Number(patchBaseQuantityInput)) || Number(patchBaseQuantityInput) <= 0)
            ? "Enter a positive integer base quantity."
          : selectedPatchScenario.id === "sterile_edit" && !(patchSterileInput === "true" || patchSterileInput === "false")
            ? "Choose true or false for the sterile flag."
          : selectedPatchScenario.id === "latex_edit" && !(patchLatexInput === "true" || patchLatexInput === "false")
            ? "Choose true or false for the latex flag."
          : selectedPatchScenario.id === "status_code_edit" && !patchStatusCodeInput.trim()
            ? "Choose the replacement status code."
          : selectedPatchScenario.id === "equivalent_first_patch"
            ? "Ready to generate the explicit version 2 PATCH that mirrors the accepted POST."
          : selectedPatchScenario.id === "warning_add" && !patchWarningCodeInput.trim()
            ? "Enter the replacement warning code to define the after condition."
            : selectedPatchScenario.id === "warning_add" && selectedWarningRequiresComment && !patchWarningCommentInput.trim()
              ? "Enter the warning comment required for CW999."
            : selectedPatchScenario.id === "storage_condition_edit" &&
                !Object.values(patchStorageConditionInputs).some((value) => value.trim())
              ? "Enter at least one replacement storage-condition comment to define the after condition."
              : "Ready to generate a derived PATCH preview from the current accepted device state.";
  const selectedPairAnchor =
    xmlPairPreview?.registered_device_anchor ??
    ((xmlMode === "patch" || xmlMode === "marketInfo") && selectedPairRequestArgs
      ? buildSelectionAnchor(selectedPairRequestArgs)
      : null);
  const selectedMarketInfoAnchor =
    xmlMarketInfoPreview?.registered_device_anchor ??
    (selectedMarketInfoRequestArgs ? buildSelectionAnchor(selectedMarketInfoRequestArgs) : null);
  const selectedTestingAnchor =
    xmlMode === "marketInfo"
        ? selectedMarketInfoAnchor
        : xmlPatchPreview?.registered_device_anchor ?? selectedPairAnchor;
  const selectedPostPreviewRecord =
    xmlPairPreview && selectedPostCandidateRecord
      ? {
          catalogue_number: xmlPairPreview.catalogue_number,
          product_family: xmlPairPreview.product_family ?? selectedPostCandidateRecord.product_family,
          product_variant: xmlPairPreview.product_variant ?? selectedPostCandidateRecord.product_variant,
          trade_name: selectedPostCandidateRecord.trade_name,
          primary_udi_di: xmlPairPreview.primary_udi_di,
          issuing_entity: selectedPostCandidateRecord.issuing_entity,
        }
      : null;
  const selectedPostWorkspaceRecord =
    selectedPostPreviewRecord ?? (xmlOperationAssessment?.status === "available" ? selectedPostCandidateRecord : null);
  const isOperationAssessmentMode =
    xmlMode === "post" ||
    xmlMode === "patch" ||
    xmlMode === "bulkPost" ||
    xmlMode === "bulkUdidiPost" ||
    xmlMode === "bulkPatch";
  const isPostWorkspaceReady = Boolean(selectedXmlFamilySummary && selectedXmlVariantSummary);
  const isPairWorkspaceReady = Boolean(selectedPairRequestArgs);
  const canRunPostFromAssessment =
    isPostWorkspaceReady && xmlOperationAssessment?.status === "available";
  const canRunPatchFromAssessment =
    isPatchScenarioReady && xmlOperationAssessment?.status === "available";
  const canRunBulkPostFromAssessment =
    Boolean(selectedXmlVariantSummary) && (assessedBulkParentGroupCount ?? 0) > 0;
  const canRunBulkUdidiPostFromAssessment =
    Boolean(selectedXmlVariantSummary) && (assessedBulkChildRecordCount ?? 0) > 0;
  const canRunBulkPatchFromAssessment =
    Boolean(selectedBulkPatchParentGroup) &&
    (xmlOperationAssessment?.status === "available" || xmlOperationAssessment?.status === "attention") &&
    (xmlOperationAssessment?.eligible_record_count ?? 0) > 0 &&
    canRunBulkPatch;
  const acceptedXmlModes = [
    {
      id: "post",
      label: "POST",
      status: "EUDAMED Accepted" as EudamedStatus,
      summary: "Accepted baseline POST generation for a selected XML-ready registration record.",
    },
  ];
  const xmlPreviewLines =
    xmlMode === "post"
      ? xmlPairPreview
        ? xmlPairPreview.post_xml
        : selectedPostWorkspaceRecord
          ? [
              "<!-- Generate POST XML to load the next available POST candidate preview -->",
              `<catalogue-number>${selectedPostWorkspaceRecord.catalogue_number}</catalogue-number>`,
              `<udi-di>${selectedPostWorkspaceRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
            ].join("\n")
          : "<!-- No available Device UDI-DI POST candidate is currently available for the selected family and variant -->"
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
      ? selectedXmlMarketInfoRecord
        ? xmlMarketInfoPreview?.xml ??
          [
            "<!-- Generate XML to load the MARKET_INFO.PUT Push message preview -->",
            `<catalogue-number>${selectedXmlMarketInfoRecord.catalogue_number}</catalogue-number>`,
            `<udi-di>${selectedXmlMarketInfoRecord.primary_udi_di ?? "PENDING"}</udi-di>`,
            "<service>MARKET_INFO.PUT</service>",
          ].join("\n")
        : "<!-- No XML-ready record is currently available for MARKET_INFO.PUT generation -->"
      : xmlMode === "patch"
      ? (xmlPatchPreview
          ? patchPreviewView === "base"
            ? xmlPatchPreview.base_xml
            : xmlPatchPreview.derived_patch_xml
          : [
              "<!-- Generate a scenario-derived PATCH preview built on the accepted POST or latest accepted PATCH -->",
              `<scenario-id>${selectedPatchScenario.id}</scenario-id>`,
              `<scenario-status>${selectedPatchScenarioStatus}</scenario-status>`,
              `<target>${selectedPatchScenario.target}</target>`,
              `<patch-version>${patchVersionInput || "PENDING"}</patch-version>`,
            ].join("\n"))
      : xmlMode === "bulkPost"
        ? xmlBulkPostPreview?.selected_chunk_xml ??
          [
            "<!-- Generate XML to preview the selected bulk Basic UDI POST chunk -->",
            `<product-family>${selectedXmlFamilySummary?.product_family ?? "PENDING"}</product-family>`,
            `<product-variant>${selectedXmlVariantSummary?.product_variant ?? "PENDING"}</product-variant>`,
            `<record-count>${normalizedBulkRecordCount}</record-count>`,
            `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
          ].join("\n")
        : xmlMode === "bulkUdidiPost"
          ? xmlBulkUdidiPostPreview?.selected_chunk_xml ??
            [
              "<!-- Generate XML to preview the selected bulk UDI-DI POST chunk -->",
              `<product-family>${selectedXmlFamilySummary?.product_family ?? "PENDING"}</product-family>`,
              `<product-variant>${selectedXmlVariantSummary?.product_variant ?? "PENDING"}</product-variant>`,
              `<record-count>${normalizedBulkRecordCount}</record-count>`,
              `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
            ].join("\n")
        : xmlBulkPatchPreview?.selected_chunk_xml ??
        [
          "<!-- Generate XML to preview the selected bulk PATCH chunk -->",
          `<product-family>${selectedXmlFamilySummary?.product_family ?? "PENDING"}</product-family>`,
          `<product-variant>${selectedXmlVariantSummary?.product_variant ?? "PENDING"}</product-variant>`,
          `<scenario-id>${selectedPatchScenario.id}</scenario-id>`,
          `<record-count>${normalizedBulkRecordCount}</record-count>`,
          `<chunk-sequence>${selectedXmlChunkSequence}</chunk-sequence>`,
        ].join("\n");
  const selectedBatchValidation =
    xmlMode === "post"
      ? xmlPairPreview?.post_validation ?? null
      : xmlMode === "single"
        ? xmlPreview?.validation ?? null
        : xmlMode === "marketInfo"
          ? xmlMarketInfoPreview?.validation ?? null
        : xmlMode === "patch"
          ? patchPreviewView === "base"
            ? xmlPatchPreview?.base_validation ?? null
            : xmlPatchPreview?.derived_patch_validation ?? null
        : xmlMode === "bulkPost"
          ? xmlBulkPostPreview?.selected_chunk_validation ?? null
          : xmlMode === "bulkUdidiPost"
            ? xmlBulkUdidiPostPreview?.selected_chunk_validation ?? null
          : xmlBulkPatchPreview?.selected_chunk_validation ?? null;
  const pairPostValidation = xmlPairPreview?.post_validation ?? null;
  const validationStatusLabel = selectedBatchValidation
    ? selectedBatchValidation.valid
      ? "Schema valid"
      : "Schema invalid"
    : "Awaiting validation";
  const selectedSchemaLabel = selectedBatchValidation
    ? formatSchemaPathForInlineNote(selectedBatchValidation.schema_path)
    : null;
  const xmlModeLabel =
    xmlMode === "post"
      ? "POST"
      : xmlMode === "single"
        ? "Single XML"
        : xmlMode === "marketInfo"
          ? "Market Info"
          : xmlMode === "patch"
            ? "Patch XML"
            : xmlMode === "bulkPost"
              ? "Bulk Basic UDI POST"
              : xmlMode === "bulkUdidiPost"
                ? "Bulk UDI-DI POST"
              : "Bulk PATCH";
  const xmlModeDescription =
    xmlMode === "post"
      ? "Generate one accepted registration POST for a selected XML-ready device record."
      : xmlMode === "single"
        ? "Generate one wrapped Push message for a selected XML-ready device record."
        : xmlMode === "marketInfo"
          ? "Generate one standalone MARKET_INFO.PUT message for a selected XML-ready record."
          : xmlMode === "patch"
            ? "Generate one scenario-derived PATCH draft at a time from the accepted POST or the latest accepted PATCH."
            : xmlMode === "bulkPost"
              ? "Generate one parent DEVICE.POST per Basic UDI-DI that is not already registered."
              : xmlMode === "bulkUdidiPost"
                ? "Generate Device UDI-DI POST messages only for devices under an already accepted Basic UDI-DI."
              : "Generate a chunked bulk PATCH package that applies one PATCH scenario across the selected bulk POST cohort.";
  const xmlWorkspaceTitle =
    xmlMode === "post"
      ? "POST Workspace"
      : xmlMode === "single"
        ? "Single Record Workspace"
        : xmlMode === "marketInfo"
          ? "Market Info Workspace"
          : xmlMode === "patch"
            ? "Patch Scenario Workspace"
            : xmlMode === "bulkPost"
              ? "Bulk Basic UDI POST Workspace"
              : xmlMode === "bulkUdidiPost"
              ? "Bulk UDI-DI POST Workspace"
              : "Bulk PATCH Workspace";
  const xmlAssessmentTitle =
    xmlMode === "post"
      ? "POST assessment"
      : xmlMode === "patch"
        ? "PATCH assessment"
        : xmlMode === "bulkPost"
          ? "Bulk Basic UDI POST assessment"
          : xmlMode === "bulkUdidiPost"
            ? "Bulk UDI-DI POST assessment"
            : "Bulk PATCH assessment";
  const xmlAssessmentSummaryRows =
    xmlMode === "post"
      ? [
          {
            label: "Candidate catalogue",
            value: assessmentEvidenceString(xmlOperationAssessment, "candidate_catalogue_number") ?? "Not resolved",
          },
          {
            label: "Basic UDI-DI",
            value: assessmentEvidenceString(xmlOperationAssessment, "candidate_basic_udi_di") ?? "Not resolved",
          },
          {
            label: "Parent registration",
            value:
              assessmentEvidenceBoolean(xmlOperationAssessment, "parent_registration_known") === null
                ? "Unknown"
                : assessmentEvidenceBoolean(xmlOperationAssessment, "parent_registration_known")
                  ? "Already registered"
                  : "Not yet registered",
          },
          {
            label: "Child registration",
            value:
              assessmentEvidenceBoolean(xmlOperationAssessment, "child_registration_known") === null
                ? "Unknown"
                : assessmentEvidenceBoolean(xmlOperationAssessment, "child_registration_known")
                  ? "Already registered"
                  : "Not yet registered",
          },
        ]
      : xmlMode === "patch"
        ? [
            {
              label: "Catalogue number",
              value: assessmentEvidenceString(xmlOperationAssessment, "catalogue_number") ?? "Not resolved",
            },
            {
              label: "Latest accepted version",
              value: assessedPatchLatestAcceptedVersion ?? "Not tracked",
            },
            {
              label: "Reviewed baseline POST",
              value:
                assessedPatchReviewedBaseline === null
                  ? "Unknown"
                  : assessedPatchReviewedBaseline
                    ? "Present"
                    : "Missing",
            },
            {
              label: "Tracked registration",
              value:
                assessedPatchTrackedRegistration === null
                  ? "Unknown"
                  : assessedPatchTrackedRegistration
                    ? "Present"
                    : "Missing",
            },
          ]
        : xmlMode === "bulkPatch"
          ? [
              {
                label: "Available parent groups",
                value: String(assessmentEvidenceNumber(xmlOperationAssessment, "eligible_parent_group_count") ?? 0),
              },
              {
                label: "Selected Basic UDI-DI",
                value: assessedSelectedBasicUdiDi ?? "Select a parent",
              },
              {
                label: "Eligible child devices",
                value: String(assessmentEvidenceNumber(xmlOperationAssessment, "eligible_child_record_count") ?? 0),
              },
              {
                label: "Tracked versions",
                value: assessedLatestVersionSummary.length > 0 ? assessedLatestVersionSummary.join(", ") : "Not tracked",
              },
            ]
          : [
              {
                label: "Eligible parent groups",
                value: String(assessedBulkParentGroupCount ?? 0),
              },
              {
                label: "Eligible child records",
                value: String(assessedBulkChildRecordCount ?? 0),
              },
              {
                label: "Posted parent groups",
                value: String(assessmentEvidenceNumber(xmlOperationAssessment, "posted_parent_group_count") ?? 0),
              },
              {
                label: "Unposted parent groups",
                value: String(assessedUnpostedParentGroupCount ?? 0),
              },
            ];
  const activePreviewLabel =
    xmlMode === "post"
      ? "Post"
      : xmlMode === "single"
        ? "Single XML"
        : xmlMode === "marketInfo"
        ? "Market Info"
          : xmlMode === "patch"
            ? patchPreviewView === "base"
              ? "Base Message"
              : "Derived Patch"
            : `${xmlMode === "bulkPost" ? "Bulk Basic UDI POST" : xmlMode === "bulkUdidiPost" ? "Bulk UDI-DI POST" : "Bulk PATCH"} Chunk ${selectedXmlChunkSequence}`;
  const activePreviewFileName =
    xmlMode === "post"
      ? xmlPairPreview?.post_file_name ?? null
      : xmlMode === "single"
        ? xmlPreview?.file_name ?? null
        : xmlMode === "marketInfo"
        ? xmlMarketInfoPreview?.file_name ?? null
          : xmlMode === "patch"
            ? patchPreviewView === "base"
              ? xmlPatchPreview?.base_file_name ?? null
              : xmlPatchPreview?.derived_patch_file_name ?? null
            : xmlMode === "bulkPost"
              ? xmlBulkPostPreview?.selected_chunk_file_name ?? null
              : xmlMode === "bulkUdidiPost"
                ? xmlBulkUdidiPostPreview?.selected_chunk_file_name ?? null
              : xmlBulkPatchPreview?.selected_chunk_file_name ?? null;
  const canGenerateCurrentXml =
    xmlMode === "post"
      ? canRunPostFromAssessment
      : xmlMode === "single"
        ? Boolean(selectedXmlRecord)
        : xmlMode === "marketInfo"
          ? Boolean(selectedTestingAnchor)
          : xmlMode === "patch"
            ? canRunPatchFromAssessment
            : xmlMode === "bulkPost"
              ? canRunBulkPostFromAssessment
              : xmlMode === "bulkUdidiPost"
                ? canRunBulkUdidiPostFromAssessment
                : canRunBulkPatchFromAssessment;
  const canDownloadCurrentXml =
    xmlMode === "post"
      ? Boolean(xmlPairPreview)
      : xmlMode === "single"
        ? Boolean(selectedXmlRecord)
        : xmlMode === "marketInfo"
          ? Boolean(selectedTestingAnchor)
          : xmlMode === "patch"
            ? Boolean(hasReviewedPatchBaselinePost && hasReviewedGeneratedPatchPreview)
            : xmlMode === "bulkPost"
              ? canRunBulkPostFromAssessment
              : xmlMode === "bulkUdidiPost"
                ? canRunBulkUdidiPostFromAssessment
                : canRunBulkPatchFromAssessment;
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
  const selectedValidationVariantMappings = orderedVariantMappings.filter((mapping) => {
    if (selectedVariantSummary) {
      return (
        mapping.workbook === selectedVariantSummary.source_workbook &&
        mapping.sheet === selectedVariantSummary.source_sheet
      );
    }
    if (selectedFamilySummary) {
      return workbookFamilyLabel(mapping.workbook) === selectedFamilySummary.product_family;
    }
    return true;
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
  const importedWorkbookRowLeader =
    [...importedWorkbooks].sort((left, right) => right.row_count - left.row_count)[0] ?? null;

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

  function currentPatchScenarioInputs(): Record<string, unknown> {
    if (selectedPatchScenario.id === "equivalent_first_patch" || !selectedPatchScenario.implemented) {
      return {};
    }
    if (selectedPatchScenario.id === "trade_name_edit") {
      return {
        new_trade_name: patchTradeNameInput,
      };
    }
    if (selectedPatchScenario.id === "warning_add") {
      return {
        new_warning_code: patchWarningCodeInput,
        new_warning_comment: patchWarningCommentInput || null,
      };
    }
    if (selectedPatchScenario.id === "base_quantity_edit") {
      return {
        new_base_quantity: Number(patchBaseQuantityInput),
      };
    }
    if (selectedPatchScenario.id === "sterile_edit") {
      return {
        new_sterile: patchSterileInput,
      };
    }
    if (selectedPatchScenario.id === "latex_edit") {
      return {
        new_contains_latex: patchLatexInput,
      };
    }
    if (selectedPatchScenario.id === "status_code_edit") {
      return {
        new_status_code: patchStatusCodeInput,
      };
    }
    return {
      updated_conditions: Object.entries(patchStorageConditionInputs)
        .filter(([, replacementComment]) => replacementComment.trim())
        .map(([conditionCode, replacementComment]) => ({
          condition_code: conditionCode,
          replacement_comment: replacementComment.trim(),
        })),
    };
  }

  async function resolveBulkPatchCatalogueNumbers(): Promise<string[]> {
    if (!selectedBulkPatchParentGroup) {
      return [];
    }
    if (bulkPatchScopeMode === "all_posted") {
      if (bulkPatchPostedCatalogueNumbers.length > 0) {
        return bulkPatchPostedCatalogueNumbers;
      }
      if (
        selectedBulkPatchFallbackCatalogueNumbers.length > 0 &&
        selectedBulkPatchFallbackCatalogueNumbers.length === selectedBulkPatchParentGroup.posted_child_count
      ) {
        return selectedBulkPatchFallbackCatalogueNumbers;
      }
      return selectedBulkPatchFallbackCatalogueNumbers;
    }
    if (bulkPatchScopeMode === "selected_catalogue_numbers") {
      return selectedBulkPatchCatalogueNumbers;
    }
    return bulkPatchImportedMatchedCatalogueNumbers;
  }

  async function generateXmlPreview(): Promise<void> {
    if (
      (xmlMode === "single" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") &&
      (!selectedXmlFamilySummary || !selectedXmlVariantSummary)
    ) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    setXmlActionMessage(null);
    try {
      if (xmlMode === "post") {
        if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) {
          return;
        }
        const preview = await api.previewNextXmlPostRegistration(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
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
        if (!selectedMarketInfoRequestArgs) {
          return;
        }
        const preview = await api.previewXmlMarketInfoPut(
          selectedMarketInfoRequestArgs.product_family,
          selectedMarketInfoRequestArgs.product_variant,
          selectedMarketInfoRequestArgs.catalogue_number,
        );
        setXmlMarketInfoPreview(preview);
      } else if (xmlMode === "patch") {
        if (!selectedPairRequestArgs) {
          return;
        }
        const preview = await api.previewGeneratedPatchScenario(
          selectedPairRequestArgs.product_family,
          selectedPairRequestArgs.product_variant,
          selectedPairRequestArgs.catalogue_number,
          selectedPatchScenario.id,
          patchVersionInput,
          currentPatchScenarioInputs(),
        );
        setXmlPatchPreview(preview);
      } else if (xmlMode === "bulkPost") {
        setXmlActionMessage("Generating Bulk Basic UDI POST preview...");
        const preview = await api.previewBulkPost(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          normalizedBulkRecordCount,
          selectedXmlChunkSequence,
        );
        setXmlBulkPostPreview(preview);
        setXmlActionMessage(
          `Bulk Basic UDI POST preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant}, chunk ${preview.selected_chunk_sequence}.`
        );
      } else if (xmlMode === "bulkUdidiPost") {
        setXmlActionMessage("Generating Bulk UDI-DI POST preview...");
        const preview = await api.previewBulkUdidiPost(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          normalizedBulkRecordCount,
          selectedXmlChunkSequence,
        );
        setXmlBulkUdidiPostPreview(preview);
        setXmlActionMessage(
          `Bulk UDI-DI POST preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant}, chunk ${preview.selected_chunk_sequence}.`
        );
      } else {
        setXmlActionMessage("Bulk PATCH action received. Preparing selection...");
        if (!selectedBulkPatchParentGroup) {
          setError("Select a Basic UDI-DI parent before generating Bulk PATCH.");
          setXmlActionMessage("Bulk PATCH is not ready: no Basic UDI-DI parent is selected.");
          return;
        }
        const bulkPatchCatalogueNumbers = await resolveBulkPatchCatalogueNumbers();
        if (bulkPatchCatalogueNumbers.length < 1) {
          setError("No posted devices are currently selected for Bulk PATCH.");
          setXmlActionMessage("Bulk PATCH is not ready: no posted devices are currently selected.");
          return;
        }
        setXmlActionMessage("Generating Bulk PATCH preview...");
        const preview = await api.previewBulkPatch(
          selectedXmlFamilySummary.product_family,
          selectedXmlVariantSummary.product_variant,
          selectedBulkPatchParentGroup.basic_udi_di,
          bulkPatchCatalogueNumbers.length,
          selectedPatchScenario.id,
          currentPatchScenarioInputs(),
          bulkPatchCatalogueNumbers,
          selectedXmlChunkSequence,
        );
        setXmlBulkPatchPreview(preview);
        setXmlActionMessage(
          `Bulk PATCH preview generated for ${selectedXmlFamilySummary.product_family} / ${selectedXmlVariantSummary.product_variant} / ${selectedBulkPatchParentGroup.basic_udi_di}.`
        );
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to generate XML preview.";
      setError(message);
      setXmlActionMessage(message);
    } finally {
      setIsGeneratingXml(false);
    }
  }

  async function downloadXmlRecord(): Promise<void> {
    if (
      (xmlMode === "single" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") &&
      (!selectedXmlFamilySummary || !selectedXmlVariantSummary)
    ) {
      return;
    }
    setIsGeneratingXml(true);
    setError(null);
    setXmlActionMessage("Preparing download...");
    try {
      const downloadResult =
        xmlMode === "post" && xmlPairPreview
          ? await api.downloadXmlPostPackage(
              xmlPairPreview.product_family ?? "",
              xmlPairPreview.product_variant ?? "",
              xmlPairPreview.catalogue_number,
            )
        : xmlMode === "single" && selectedXmlRecord?.catalogue_number
          ? await api.downloadXmlRecord(
              selectedXmlFamilySummary.product_family,
              selectedXmlVariantSummary.product_variant,
              selectedXmlRecord.catalogue_number,
            )
          : xmlMode === "marketInfo" && selectedMarketInfoRequestArgs
          ? await api.downloadXmlMarketInfoPut(
              selectedMarketInfoRequestArgs.product_family,
              selectedMarketInfoRequestArgs.product_variant,
              selectedMarketInfoRequestArgs.catalogue_number,
            )
          : xmlMode === "patch"
          ? await api.downloadGeneratedPatchScenario(
              selectedPairRequestArgs?.product_family ?? "",
              selectedPairRequestArgs?.product_variant ?? "",
              selectedPairRequestArgs?.catalogue_number ?? "",
              selectedPatchScenario.id,
              patchVersionInput,
              currentPatchScenarioInputs(),
            )
          : xmlMode === "bulkPost"
            ? await api.downloadBulkPost(
                selectedXmlFamilySummary.product_family,
                selectedXmlVariantSummary.product_variant,
                normalizedBulkRecordCount,
              )
            : xmlMode === "bulkUdidiPost"
              ? await api.downloadBulkUdidiPost(
                  selectedXmlFamilySummary.product_family,
                  selectedXmlVariantSummary.product_variant,
                  normalizedBulkRecordCount,
                )
            : await (async () => {
              if (!selectedBulkPatchParentGroup) {
                throw new Error("Select a Basic UDI-DI parent before downloading Bulk PATCH.");
              }
              const bulkPatchCatalogueNumbers = await resolveBulkPatchCatalogueNumbers();
              if (bulkPatchCatalogueNumbers.length < 1) {
                throw new Error("No posted devices are currently selected for Bulk PATCH.");
              }
              return api.downloadBulkPatch(
                selectedXmlFamilySummary.product_family,
                selectedXmlVariantSummary.product_variant,
                selectedBulkPatchParentGroup.basic_udi_di,
                bulkPatchCatalogueNumbers.length,
                selectedPatchScenario.id,
                currentPatchScenarioInputs(),
                bulkPatchCatalogueNumbers,
              );
            })();
      if (!downloadResult) {
        return;
      }
      const { blob, fileName } = downloadResult;
      if (!blob) {
        return;
      }
      const resolvedFileName =
        fileName ??
        (xmlMode === "single"
            ? xmlPreview?.file_name ??
              `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-${selectedXmlRecord?.catalogue_number ?? "record"}.xml`
          : xmlMode === "marketInfo"
              ? xmlMarketInfoPreview?.file_name ??
                `${selectedXmlMarketInfoRecord?.product_family ?? "device"}-${selectedXmlMarketInfoRecord?.product_variant ?? "variant"}-${selectedXmlMarketInfoRecord?.catalogue_number ?? "record"}-market-info-put.xml`
              : xmlMode === "patch"
                ? `${(
                    xmlPatchPreview?.derived_patch_file_name ??
                    `${selectedXmlPairRecord?.product_family ?? "device"}-${selectedXmlPairRecord?.product_variant ?? "variant"}-${selectedPatchScenario.id}.xml`
                  ).replace(/\.xml$/i, "")}.zip`
                : xmlMode === "bulkPost"
                  ? xmlBulkPostPreview?.package_file_name ??
                    `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-bulk-post-package.zip`
                  : xmlMode === "bulkUdidiPost"
                    ? xmlBulkUdidiPostPreview?.package_file_name ??
                      `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-bulk-udidi-post-package.zip`
                  : xmlBulkPatchPreview?.package_file_name ??
                    `${selectedXmlFamilySummary.product_family}-${selectedXmlVariantSummary.product_variant}-${selectedPatchScenario.id}-bulk-patch-package.zip`);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = resolvedFileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      setXmlActionMessage(
        xmlMode === "patch" || xmlMode === "bulkPatch"
          ? `Patch scenario ZIP download started for ${resolvedFileName}. If your browser does not prompt, check the default Downloads folder.`
          : `Download started for ${resolvedFileName}. If your browser does not prompt, check the default Downloads folder.`,
      );
      window.setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      }, 1500);
    } catch (requestError) {
      setXmlActionMessage(null);
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
              Submission data, canonical mapping, and EUDAMED XML preparation
            </span>
          </div>
        </div>
        <div className="nav-links">
          <button
            className={activeTab === "workbooks" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("workbooks")}
          >
            Submission Data
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
            EUDAMED Testing
          </button>
          <button
            className={activeTab === "generation" ? "nav-link active" : "nav-link"}
            type="button"
            onClick={() => setActiveTab("generation")}
          >
            EUDAMED Generation
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
              <h1>Submission Data</h1>
              <p className="hero-copy hero-copy-compact">
                Review imported workbook coverage, device counts, XML readiness, duplicates, and
                current SQLite status.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <p className="eyebrow">Canonical Validation</p>
              <h1>Canonical Validation</h1>
              <p className="hero-copy">
                Check which families and variants are ready for canonical use, then inspect the
                supporting source-to-canonical mapping before XML generation.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <p className="eyebrow">EUDAMED Testing</p>
              <h1>Review Candidate And Accepted EUDAMED XML</h1>
              <p className="hero-copy">
                Produce previewable wrapped `Push` messages, review accepted baseline POST XML with candidate
                PATCH scenarios, validate them against the local schema set, and prepare controlled external test files.
              </p>
            </>
          ) : null}
          {activeTab === "generation" ? (
            <>
              <p className="eyebrow">EUDAMED Generation</p>
              <h1>Generate Accepted EUDAMED XML Only</h1>
              <p className="hero-copy">
                Use only XML patterns with user-confirmed EUDAMED acceptance evidence when preparing real upload-oriented files.
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
              <span className="status-label">Current snapshot</span>
              <div className="status-card-toolbar">
                <button
                  className="action-button import-workbooks-button"
                  type="button"
                  onClick={() => void runWorkbookImportFromUi()}
                  disabled={isRunningWorkbookImport}
                >
                  {isRunningWorkbookImport ? "Importing Workbooks..." : "Import Workbooks"}
                </button>
                <span className={`status-pill ${submissionSnapshotStatus.className}`}>
                  {submissionSnapshotStatus.label}
                </span>
              </div>
              {latestImportBatch ? (
                <p className="status-detail status-detail-tight">
                  {`${submissionSnapshotStatus.detail} · Last import: ${formatIsoDateTime(latestImportBatch.imported_at)}`}
                </p>
              ) : (
                <p className="status-detail status-detail-tight">{submissionSnapshotStatus.detail}</p>
              )}
              {workbookImportActionMessage ? <p className="status-detail status-detail-tight">{workbookImportActionMessage}</p> : null}
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <span className="status-label">Validation scope</span>
              <span className={`status-pill ${canonicalProjectionUiStatus.className}`}>{canonicalProjectionUiStatus.label}</span>
              <p className="status-detail">
                {canonicalValidation?.family_scope
                  ? `${canonicalValidation.family_scope} · ${canonicalProjectionUiStatus.detail}`
                  : canonicalProjectionUiStatus.detail}
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <span className="status-label">Current phase</span>
              <span className={xmlReadyRecords.length ? "status-pill ok" : "status-pill warn"}>
                {xmlReadyRecords.length ? "Testing workspace ready" : "Testing workspace blocked"}
              </span>
              <p className="status-detail">
                {xmlReadyRecords.length
                  ? `${xmlReadyRecords.length} validated product-variant row${xmlReadyRecords.length === 1 ? "" : "s"} are currently eligible for EUDAMED testing workflows.`
                  : "EUDAMED testing remains downstream of canonical mapping and awaits validation-ready records."}
              </p>
            </>
          ) : null}
          {activeTab === "generation" ? (
            <>
              <span className="status-label">Accepted scope</span>
              <span className="status-pill ok">1 accepted XML pattern</span>
              <p className="status-detail">
                Only `POST` is currently marked `EUDAMED Accepted` and available for generation here.
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
          {!hasWorkbookImportSnapshot && !workbookImportSummaryError ? (
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Database Snapshot</span>
                  <h2>Run Initial Import</h2>
                </div>
              </div>
              <p className="panel-copy">
                No workbook import snapshot exists yet. Submission Data now depends on the imported SQLite snapshot, so the
                database-backed submission view and monitoring panels will populate only after the first import batch is created.
              </p>
              <div className="action-summary">
                <button
                  className="action-button import-workbooks-button"
                  type="button"
                  onClick={() => void runWorkbookImportFromUi()}
                  disabled={isRunningWorkbookImport}
                >
                  {isRunningWorkbookImport ? "Importing Workbooks..." : "Import Workbooks"}
                </button>
                {workbookImportActionMessage ? <span className="save-message">{workbookImportActionMessage}</span> : null}
              </div>
            </div>
          ) : null}
          {workbookImportSummaryError ? (
            <div className="panel error-banner">
              Workbook import monitoring is partially unavailable: {workbookImportSummaryError}. Any available SQLite-backed
              snapshot data will continue to render.
            </div>
          ) : null}
          <section className="summary-grid workbook-kpi-grid">
            <div className="summary-card summary-card-meta">
              <span className="summary-label">Import Batch</span>
              <strong>{latestImportBatch ? `#${latestImportBatch.import_batch_id}` : "N/A"}</strong>
              <p>{latestImportBatch ? formatIsoDateTime(latestImportBatch.imported_at) : "Not available"}</p>
              <p className="summary-meta-inline">
                {latestImportBatch ? `Imported by ${latestImportBatch.imported_by ?? "system"}` : "No import recorded"}
              </p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-primary">
              <span className="summary-label">Imported Rows</span>
              <strong>{latestImportBatch ? sourceRowTableCount : "N/A"}</strong>
              <p>Raw workbook rows</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-secondary">
              <span className="summary-label">Stable Subjects</span>
              <strong>{latestImportBatch ? deviceSubjectTableCount : "N/A"}</strong>
              <p>Current device identities</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-warn">
              <span className="summary-label">Merged Rows</span>
              <strong>{latestImportBatch ? mergedSourceRowCount : "N/A"}</strong>
              <p>Workbook rows merged into an existing device subject</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-post">
              <span className="summary-label">POST</span>
              <strong>{latestImportBatch ? postDeviceSubjectCount : "N/A"}</strong>
              <p>Registration subjects</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-patch">
              <span className="summary-label">PATCH</span>
              <strong>{latestImportBatch ? patchDeviceSubjectCount : "N/A"}</strong>
              <p>Update subjects</p>
            </div>
          </section>

          <section className="panel device-subject-summary-panel">
            <div className="device-subject-filter-column">
              <span className="section-kicker">Device Subjects</span>
              <label className="read-model-filter-control">
                <span>Family</span>
                <select
                  value={selectedDeviceSubjectFamily}
                  onChange={(event) => setSelectedDeviceSubjectFamily(event.target.value)}
                >
                  <option value="">All families</option>
                  {deviceSubjectFamilyOptions.map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </select>
              </label>
              <label className="read-model-filter-control">
                <span>Variant</span>
                <select
                  value={selectedDeviceSubjectVariant}
                  onChange={(event) => setSelectedDeviceSubjectVariant(event.target.value)}
                  disabled={!deviceSubjectVariantOptions.length}
                >
                  <option value="">All variants</option>
                  {deviceSubjectVariantOptions.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="device-subject-detail-column">
              <div className="device-subject-summary-head">
                <div>
                  <strong>
                    {selectedDeviceSubjectVariant
                      ? `${selectedDeviceSubjectFamily || "All families"} / ${selectedDeviceSubjectVariant}`
                      : selectedDeviceSubjectFamily || "All Device Subjects"}
                  </strong>
                  <p className="panel-copy">
                    {selectedDeviceSubjectVariantSummary
                      ? `${selectedDeviceSubjectVariantSummary.total_records} workbook rows mapped to this variant, ${selectedDeviceSubjectVariantSummary.xml_ready_records} XML-ready.`
                      : selectedDeviceSubjectFamilySummary
                        ? `${selectedDeviceSubjectFamilySummary.variant_count} variants in scope, ${selectedDeviceSubjectFamilySummary.total_records} workbook rows, ${selectedDeviceSubjectFamilySummary.xml_ready_records} XML-ready.`
                      : canonicalValidation
                        ? `${validationFamilySummaries.length} in-scope families and ${validationVariantSummaries.length} XML-ready variants are currently represented.`
                        : `${fallbackDeviceSubjectFamilyCount} families and ${fallbackDeviceSubjectVariantCount} variants are currently represented in SQLite device subjects.`}
                  </p>
                </div>
                <span className="status-pill ok compact">
                  {filteredDeviceSubjects.length} stable subjects
                </span>
              </div>
              <div className="device-subject-metric-grid">
                <div className="queue-chip">
                  <strong>{selectedDeviceSubjectScopeRows}</strong>
                  <span>rows in scope</span>
                </div>
                <div className="queue-chip">
                  <strong>{filteredDeviceSubjects.length}</strong>
                  <span>stable subjects</span>
                </div>
                <div className="queue-chip">
                  <strong>{selectedDeviceSubjectXmlReadyRows}</strong>
                  <span>XML-ready</span>
                </div>
                <div className="queue-chip">
                  <strong>{selectedDeviceSubjectBlockedRows}</strong>
                  <span>blocked</span>
                </div>
                <div className="device-subject-status-card">
                  <span className={`status-pill ${selectedDeviceSubjectStatus.className}`}>
                    {selectedDeviceSubjectStatus.label}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Database Tables</span>
                  <div className="section-title-with-icon">
                    <span className="section-title-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <ellipse cx="12" cy="5.5" rx="7" ry="3.5" />
                        <path d="M5 5.5v4c0 1.9 3.1 3.5 7 3.5s7-1.6 7-3.5v-4" />
                        <path d="M5 9.5v4c0 1.9 3.1 3.5 7 3.5s7-1.6 7-3.5v-4" />
                        <path d="M5 13.5v4c0 1.9 3.1 3.5 7 3.5s7-1.6 7-3.5v-4" />
                      </svg>
                    </span>
                    <h2>Table Footprint</h2>
                  </div>
                </div>
              </div>
              {!latestImportBatch ? (
                <p className="panel-copy">
                  Table counts are unavailable.
                </p>
              ) : null}
              <div className="queue-summary">
                <div className="queue-chip">
                  <strong>{latestImportBatch ? sourceSnapshotTables.reduce((sum, table) => sum + table.row_count, 0) : "N/A"}</strong>
                  <span>workbook snapshot tables</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? testingStateTables.reduce((sum, table) => sum + table.row_count, 0) : "N/A"}</strong>
                  <span>testing state tables</span>
                </div>
              </div>
              {latestImportBatch ? (
                <table className="table-footprint-table">
                  <thead>
                    <tr>
                      <th>Table</th>
                      <th>Rows</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importTableCounts.map((tableCount) => (
                      <tr key={tableCount.table_name}>
                        <td><strong>{tableCount.table_name}</strong></td>
                        <td>{tableCount.row_count}</td>
                        <td>{tableCount.summary_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>

            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Workbook Snapshot</span>
                  <div className="section-title-with-icon">
                    <span className="section-title-icon section-title-icon-excel" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                        <path d="M14 2v5h5" />
                        <path d="M8.5 10.5l3 5" />
                        <path d="M11.5 10.5l-3 5" />
                      </svg>
                    </span>
                    <h2>Workbook Files</h2>
                  </div>
                </div>
              </div>
              <div className="queue-summary">
                <div className="queue-chip">
                  <strong>{latestImportBatch?.workbook_count ?? "N/A"}</strong>
                  <span>workbooks</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? importedWorkbookRowLeader?.row_count ?? 0 : "N/A"}</strong>
                  <span>largest row count</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? importedWorkbookRowLeader?.workbook_name ?? "N/A" : "N/A"}</strong>
                  <span>largest workbook</span>
                </div>
              </div>
              {latestImportBatch ? (
                <table className="workbook-files-table">
                  <thead>
                    <tr>
                      <th>Workbook</th>
                      <th>Rows</th>
                      <th>Hash</th>
                      <th>Loaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedWorkbooks.map((workbook: ImportedWorkbookSummary) => (
                      <tr key={workbook.source_workbook_id}>
                        <td><strong>{workbook.workbook_name}</strong></td>
                        <td>{workbook.row_count}</td>
                        <td><code>{shortenHash(workbook.file_hash)}</code></td>
                        <td>{formatIsoDateTime(workbook.loaded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </section>

          <section className="content-grid single-panel-grid">
            <div className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Database Monitoring</span>
                  <h2>Schema and Health</h2>
                </div>
              </div>
              <div className="monitoring-chip-grid">
                <div className="queue-chip">
                  <strong>{databaseSchemaSummary?.table_count ?? "N/A"}</strong>
                  <span>tables</span>
                </div>
                <div className="queue-chip">
                  <strong>{databaseSchemaSummary ? indexedTableCount : "N/A"}</strong>
                  <span>indexed tables</span>
                </div>
                <div className="queue-chip">
                  <strong>{databaseSchemaSummary ? foreignKeyCount : "N/A"}</strong>
                  <span>foreign keys</span>
                </div>
                <div className="queue-chip">
                  <strong>{databaseHealthSummary ? healthIssues.length : "N/A"}</strong>
                  <span>health issues</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? distinctSubjectCount : "N/A"}</strong>
                  <span>distinct subjects</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? workbookDuplicateRowCount : "N/A"}</strong>
                  <span>workbook duplicates</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? workbookDuplicateGroupCount : "N/A"}</strong>
                  <span>duplicate groups</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? identityIssueTableCount : "N/A"}</strong>
                  <span>identity issues</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? unresolvedIdentityRowCount : "N/A"}</strong>
                  <span>unresolved rows</span>
                </div>
              </div>
              <div className="monitoring-detail-grid">
                <section className="monitoring-section">
                  <div className="monitoring-section-head">
                    <strong>Schema Health</strong>
                    <span>{databaseHealthSummary ? `${healthIssues.length} flagged` : "Unavailable"}</span>
                  </div>
                  {healthIssues.length ? (
                    <div className="roadmap-list monitoring-roadmap-list">
                      {healthIssues.slice(0, 6).map((issue) => (
                        <div className="roadmap-item" key={`${issue.code}-${issue.table_name ?? "global"}-${issue.message}`}>
                          <strong>{issue.table_name ? `${issue.table_name} · ${issue.code}` : issue.code}</strong>
                          <p>{issue.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="panel-copy">No current schema-health issues were reported by the monitoring snapshot.</p>
                  )}
                </section>
              </div>
            </div>
          </section>

        </>
      ) : null}

      {activeTab === "canonicalValidation" ? (
        isLoadingCanonicalValidation ? (
          renderLoadingPanel(
            "Loading canonical validation",
            "Reading the current SQLite canonical projection and assembling completeness and XML-readiness results.",
          )
        ) : !latestImportBatch ? (
          <section className="tab-stack">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">SQLite Projection</span>
                  <h2>Import Required</h2>
                </div>
              </div>
              <p className="panel-copy">
                Canonical Validation now depends on the imported SQLite projection. Run `Import Workbooks` in `Submission Data`
                before loading canonical validation.
              </p>
            </section>
          </section>
        ) : (
        <section className="tab-stack">
          <section className="summary-grid canonical-kpi-grid">
            <div className="summary-card summary-card-kpi summary-card-kpi-primary">
              <span className="summary-label">Total source rows</span>
              <strong>{canonicalValidation?.total_source_records ?? 0}</strong>
              <p>Rows parsed across the current in-scope and deferred workbook sheets.</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-primary">
              <span className="summary-label">Rows in validation scope</span>
              <strong>{canonicalValidation?.validation_subset_records ?? 0}</strong>
              <p>Rows currently covered by active variant-level canonical validation.</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-secondary">
              <span className="summary-label">Canonical-ready rows</span>
              <strong>{canonicalValidation?.ready_records ?? 0}</strong>
              <p>Rows complete against the current canonical-required field set.</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-post">
              <span className="summary-label">XML-ready rows</span>
              <strong>{canonicalValidation?.xml_ready_records ?? 0}</strong>
              <p>Rows currently complete enough for downstream XML projection.</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-primary">
              <span className="summary-label">Distinct Subjects</span>
              <strong>{latestImportBatch?.device_subject_count ?? 0}</strong>
              <p>Unique medical devices resolved from the current in-scope workbook rows.</p>
            </div>
          </section>

          <section className="panel device-subject-summary-panel validation-selection-panel">
            <div className="device-subject-filter-column">
              <span className="section-kicker">Canonical Model</span>
              <label className="read-model-filter-control">
                <span>Family</span>
                <select
                  value={selectedValidationFamily}
                  onChange={(event) => setSelectedValidationFamily(event.target.value)}
                >
                  <option value="">All families</option>
                  {validationFamilySummaries.map((summary) => (
                    <option key={summary.product_family} value={summary.product_family}>
                      {summary.product_family}
                    </option>
                  ))}
                </select>
              </label>
              <label className="read-model-filter-control">
                <span>Variant</span>
                <select
                  value={selectedValidationVariant}
                  onChange={(event) => setSelectedValidationVariant(event.target.value)}
                  disabled={!selectedFamilyVariantSummaries.length}
                >
                  <option value="">All variants</option>
                  {selectedFamilyVariantSummaries.map((summary) => (
                    <option key={summary.product_variant} value={summary.product_variant}>
                      {summary.product_variant}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="device-subject-detail-column">
              <div className="device-subject-summary-head">
                <div>
                  <strong>
                    {selectedValidationRecord
                      ? `${selectedValidationRecord.product_family} / ${selectedValidationRecord.product_variant}`
                      : selectedVariantSummary
                        ? `${selectedVariantSummary.product_family} / ${selectedVariantSummary.product_variant}`
                        : selectedFamilySummary?.product_family ?? "Canonical Validation Scope"}
                  </strong>
                  <p className="panel-copy">
                    {selectedValidationRecord
                      ? `${selectedValidationRecord.catalogue_number ?? "No catalogue"} · ${selectedValidationRecord.trade_name ?? "No trade name"}`
                      : selectedVariantSummary
                        ? `${selectedVariantSummary.submission_operation ?? "N/A"} scope with ${selectedVariantSummary.total_records} rows, ${selectedVariantSummary.xml_ready_records} XML-ready, and ${selectedVariantSummary.xml_blocked_records} XML-blocked.`
                        : selectedFamilySummary
                          ? `${selectedFamilySummary.variant_count} variants in scope, ${selectedFamilySummary.total_records} rows, ${selectedFamilySummary.xml_ready_records} XML-ready.`
                          : `${validationFamilySummaries.length} in-scope families and ${validationVariantSummaries.length} variants are currently represented.`}
                  </p>
                </div>
                <span className={`status-pill ${selectedValidationStatus.className} compact`}>
                  {selectedValidationStatus.label}
                </span>
              </div>
              <div className="device-subject-metric-grid">
                <div className="queue-chip">
                  <strong>{selectedValidationScopeRows}</strong>
                  <span>rows in scope</span>
                </div>
                <div className="queue-chip">
                  <strong>{selectedValidationReadyRows}</strong>
                  <span>canonical-ready</span>
                </div>
                <div className="queue-chip">
                  <strong>{selectedValidationXmlReadyRows}</strong>
                  <span>XML-ready</span>
                </div>
                <div className="queue-chip">
                  <strong>{selectedValidationBlockedRows}</strong>
                  <span>blocked rows</span>
                </div>
                <div className="device-subject-status-card">
                  <span className={`status-pill ${selectedValidationStatus.className}`}>
                    {selectedValidationRecord?.submission_operation ?? selectedVariantSummary?.submission_operation ?? "Scope"}
                  </span>
                </div>
              </div>
            </div>
            {selectedValidationRecord ? (
              <div className="validation-full-width-stack">
                <section className="validation-record-section">
                  <div className="validation-record-section-head">
                    <span className="section-kicker">Sample Device</span>
                  </div>
                  <div className="summary-grid validation-record-grid">
                    <div className="summary-card summary-card-kpi summary-card-kpi-primary">
                      <span className="summary-label">Catalogue</span>
                      <strong>{selectedValidationRecord.catalogue_number ?? "N/A"}</strong>
                      <p>Workbook catalogue/reference number.</p>
                    </div>
                    <div className="summary-card summary-card-kpi summary-card-kpi-primary">
                      <span className="summary-label">UDI-DI</span>
                      <strong>{selectedValidationRecord.primary_udi_di ?? "Missing"}</strong>
                      <p>Issuing entity {selectedValidationRecord.issuing_entity ?? "Unknown"}.</p>
                    </div>
                    <div className="summary-card summary-card-kpi summary-card-kpi-secondary">
                      <span className="summary-label">Required Missing</span>
                      <strong>{selectedValidationRecord.completeness.missing_required_fields}</strong>
                      <p>{selectedValidationRecord.completeness.total_required_fields} completeness fields tracked.</p>
                    </div>
                    <div className="summary-card summary-card-kpi summary-card-kpi-post">
                      <span className="summary-label">XML Missing</span>
                      <strong>{selectedValidationRecord.xml_readiness.missing_required_fields}</strong>
                      <p>{selectedValidationRecord.xml_readiness.total_required_fields} XML-required fields tracked.</p>
                    </div>
                  </div>
                </section>
                <div className="draft-card validation-mapping-panel">
                    <div className="draft-card-head">
                      <strong>{selectedValidationReviewTab === "canonicalMapping" ? "Canonical Mapping" : "Source Sheet to Basic UDI"}</strong>
                      <span className="status-pill ok compact">
                        {selectedValidationReviewTab === "canonicalMapping"
                          ? selectedValidationMappingRows.length
                          : selectedValidationVariantMappings.length}
                      </span>
                    </div>
                    <div className="xml-mode-toggle xml-top-tabs validation-review-tabs">
                      <button
                        className={
                          selectedValidationReviewTab === "sourceSheetBasicUdi"
                            ? "action-button xml-mode-button active"
                            : "ghost-button xml-mode-button"
                        }
                        type="button"
                        onClick={() => setSelectedValidationReviewTab("sourceSheetBasicUdi")}
                      >
                        Source Sheet to Basic UDI
                      </button>
                      <button
                        className={
                          selectedValidationReviewTab === "canonicalMapping"
                            ? "action-button xml-mode-button active"
                            : "ghost-button xml-mode-button"
                        }
                        type="button"
                        onClick={() => setSelectedValidationReviewTab("canonicalMapping")}
                      >
                        Canonical Mapping
                      </button>
                    </div>
                    <div className="validation-mapping-scroll">
                      {selectedValidationReviewTab === "canonicalMapping" ? (
                        <table className="mapping-contract-table validation-mapping-contract-table">
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
                            {selectedValidationMappingRows.map(({ field, review }) => (
                              <tr key={field.canonical_path}>
                                <td>{review?.excelField ?? field.source_detail ?? "Context / external reference"}</td>
                                <td>
                                  <strong>{review?.businessLabel ?? field.business_label}</strong>
                                  <br />
                                  <code>{field.canonical_path}</code>
                                  <div className="field-source-note">
                                    Current value: {field.value !== null && field.value !== undefined ? String(field.value) : "Missing"}
                                  </div>
                                </td>
                                <td>{review?.schemaTarget ?? "Not yet aligned"}</td>
                                <td>{review?.schemaFile ?? "Schema file under review"}</td>
                                <td>
                                  <span className="status-pill ok compact">
                                    {titleCaseToken(review?.classification ?? field.source ?? "derived")}
                                  </span>
                                </td>
                                <td>
                                  {review?.reviewNotes ??
                                    `${titleCaseToken(field.source)}${field.source_detail ? ` · ${field.source_detail}` : ""}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="mapping-contract-table validation-mapping-contract-table">
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
                            {selectedValidationVariantMappings.map((mapping) => (
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
                      )}
                    </div>
                  </div>
                <div className="draft-list validation-secondary-card-grid">
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
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>Structured Content</strong>
                        <span className="status-pill ok compact">
                          {selectedValidationRecord.market_availability_items.length +
                            selectedValidationRecord.storage_condition_items.length +
                            selectedValidationRecord.critical_warning_items.length}
                        </span>
                      </div>
                      <div className="queue-summary validation-pill-row">
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.market_availability_items.length}</strong>
                          <span>market availability</span>
                        </div>
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.storage_condition_items.length}</strong>
                          <span>storage conditions</span>
                        </div>
                        <div className="queue-chip">
                          <strong>{selectedValidationRecord.critical_warning_items.length}</strong>
                          <span>critical warnings</span>
                        </div>
                        {selectedMarketAvailabilityExample ? (
                          <div className="queue-chip">
                            <strong>Market</strong>
                            <span>
                              {selectedMarketAvailabilityExample.country}
                              {selectedMarketAvailabilityExample.original_placed_on_market ? " · first EU market" : ""}
                            </span>
                          </div>
                        ) : null}
                        {selectedStorageExample ? (
                          <div className="queue-chip">
                            <strong>Storage</strong>
                            <span>
                              {selectedStorageExample.item_type ?? "Unspecified"} {"->"} {selectedStorageExample.normalized_code ?? "No code"}
                            </span>
                          </div>
                        ) : null}
                        {selectedWarningExample ? (
                          <div className="queue-chip">
                            <strong>Warning</strong>
                            <span>
                              {selectedWarningExample.item_type ?? "Unspecified"} {"->"} {selectedWarningExample.normalized_code ?? "No code"}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                </div>
              </div>
            ) : (
              <p className="panel-copy">No rows are currently available for the selected family and variant.</p>
            )}
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
              <p>Rows currently eligible for EUDAMED XML generation workflows.</p>
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
                <h2>EUDAMED Testing Depends On Canonical Validation</h2>
              </div>
              <span className={xmlReadyRecords.length ? "status-pill ok compact" : "status-pill warn compact"}>
                {xmlReadyRecords.length ? "Validation-ready records available" : "Validation gate not yet met"}
              </span>
            </div>
            <p className="panel-copy">
              This workspace now consumes the aligned Canonical Validation output. Select a product family,
              product variant, and then generate either a registered-device message or a variant-scoped batch package.
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
                  className={xmlMode === "post" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("post")}
                >
                  POST
                </button>
                <button
                  className={xmlMode === "patch" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("patch")}
                >
                  Patch XML
                </button>
                <button
                  className={xmlMode === "marketInfo" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("marketInfo")}
                >
                  Market Info
                </button>
                <span className="xml-mode-divider" aria-hidden="true" />
                <button
                  className={xmlMode === "bulkPost" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("bulkPost")}
                >
                  Bulk Basic UDI POST
                </button>
                <button
                  className={xmlMode === "bulkUdidiPost" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("bulkUdidiPost")}
                >
                  Bulk UDI-DI POST
                </button>
                <button
                  className={xmlMode === "bulkPatch" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                  type="button"
                  onClick={() => setXmlMode("bulkPatch")}
                >
                  Bulk PATCH
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
                    <strong>
                    {xmlMode === "post" || xmlMode === "marketInfo" || xmlMode === "patch"
                      ? xmlMode === "post"
                        ? selectedXmlFamilySummary?.product_family ?? "No family selected"
                        : xmlMode === "patch" && !hasReviewedPatchBaselinePost
                          ? "No reviewed POST"
                          : selectedTestingAnchor?.product_family ?? "No testing anchor"
                      : selectedXmlFamilySummary?.product_family ?? "No family selected"}
                  </strong>
                  <p>
                    {xmlMode === "post" || xmlMode === "marketInfo" || xmlMode === "patch"
                      ? xmlMode === "post"
                        ? selectedXmlVariantSummary?.product_variant ?? "No variant selected"
                        : xmlMode === "patch" && !hasReviewedPatchBaselinePost
                          ? "Select a variant with an XML-ready POST record"
                          : selectedTestingAnchor?.product_variant ?? "No anchor variant"
                      : selectedXmlVariantSummary?.product_variant ?? "No variant selected"}
                  </p>
                </div>
              </div>
            </div>
            {xmlMode === "marketInfo" || xmlMode === "patch" ? (
              <div className="xml-anchor-panel">
                <div className="xml-anchor-header">
                  <div>
                    <span className="section-kicker">Registered Device Anchor</span>
                    <h3>Shared Testing Device</h3>
                  </div>
                  <span className="status-pill ok compact">
                    {selectedTestingAnchor?.eudamed_status ?? "Loading anchor"}
                  </span>
                </div>
                {selectedTestingAnchor ? (
                  <div className="queue-summary xml-anchor-summary">
                    <div className="queue-chip">
                      <strong>{selectedTestingAnchor.product_family}</strong>
                      <span>product family</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedTestingAnchor.product_variant}</strong>
                      <span>product variant</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedTestingAnchor.catalogue_number}</strong>
                      <span>catalogue number</span>
                    </div>
                    <div className="queue-chip">
                      <strong>{selectedTestingAnchor.primary_udi_di}</strong>
                      <span>Device UDI-DI</span>
                    </div>
                  </div>
                ) : (
                  <p className="panel-copy">The accepted baseline device anchor has not loaded yet.</p>
                )}
                <p className="panel-copy">
                  `POST`, `Market Info`, and all `Patch XML` scenarios are tied to this same registered device.
                </p>
              </div>
            ) : null}
            {(xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") && selectedXmlVariantSummary ? (
              xmlMode === "bulkPost" ? (
                <div className="draft-card bulk-patch-summary-bar">
                  <div className="draft-card-head">
                    <strong>Bulk POST summary</strong>
                    <span className={selectedBulkRecordCount > 0 ? "status-pill ok compact" : "status-pill warn compact"}>
                      {selectedBulkRecordCount > 0
                        ? `${selectedBulkRecordCount} device${selectedBulkRecordCount === 1 ? "" : "s"}`
                        : "No devices selected"}
                    </span>
                  </div>
                  <div className="bulk-patch-summary-row">
                    <div className="bulk-patch-summary-metrics">
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Basic UDI-DI parents</strong>
                        <span>{selectedBulkUnpostedBasicUdiCount || "None available"}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Number of devices</strong>
                        <span>{selectedBulkRecordCount || "Not selected"}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Variant</strong>
                        <span>{selectedXmlFamilySummary?.product_family} / {selectedXmlVariantSummary.product_variant}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Preview chunk</strong>
                        <span>Chunk {selectedXmlChunkSequence} of {selectedBulkChunkCount}</span>
                      </div>
                    </div>
                  </div>
                  <p className="panel-copy bulk-patch-summary-status">
                    {bulkPostReadinessMessage}
                  </p>
                </div>
              ) : xmlMode === "bulkUdidiPost" ? (
                <div className="draft-card bulk-patch-summary-bar">
                  <div className="draft-card-head">
                    <strong>Bulk UDI-DI POST summary</strong>
                    <span className={selectedBulkRecordCount > 0 ? "status-pill ok compact" : "status-pill warn compact"}>
                      {selectedBulkRecordCount > 0
                        ? `${selectedBulkRecordCount} device${selectedBulkRecordCount === 1 ? "" : "s"}`
                        : "No devices selected"}
                    </span>
                  </div>
                  <div className="bulk-patch-summary-row">
                    <div className="bulk-patch-summary-metrics">
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Eligible child devices</strong>
                        <span>{selectedBulkEligibleUdidiPostCount || "None available"}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Number of devices</strong>
                        <span>{selectedBulkRecordCount || "Not selected"}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Variant</strong>
                        <span>{selectedXmlFamilySummary?.product_family} / {selectedXmlVariantSummary.product_variant}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Preview chunk</strong>
                        <span>Chunk {selectedXmlChunkSequence} of {selectedBulkChunkCount}</span>
                      </div>
                    </div>
                  </div>
                  <p className="panel-copy bulk-patch-summary-status">
                    {selectedXmlVariantSummary.xml_blocked_records} row{selectedXmlVariantSummary.xml_blocked_records === 1 ? "" : "s"} remain excluded until resolved.
                  </p>
                </div>
              ) : (
              <div className="draft-card bulk-patch-summary-bar">
                <div className="draft-card-head">
                  <strong>Bulk PATCH summary</strong>
                  <span className={selectedBulkPatchSelectedCount > 0 ? "status-pill ok compact" : "status-pill warn compact"}>
                    {selectedBulkPatchSelectedCount > 0
                      ? `${selectedBulkPatchSelectedCount} child device${selectedBulkPatchSelectedCount === 1 ? "" : "s"}`
                      : "No posted devices"}
                  </span>
                </div>
                <div className="bulk-patch-summary-row">
                  <div className="bulk-patch-summary-metrics">
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>Basic UDI-DI</strong>
                      <span>{selectedBulkPatchParentGroup?.basic_udi_di ?? "No posted parent"}</span>
                    </div>
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>Number of devices</strong>
                      <span>{selectedBulkPatchSelectedCount > 0 ? selectedBulkPatchSelectedCount : "No posted devices"}</span>
                    </div>
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>PATCH option</strong>
                      <span>{patchScenarioOptionLabel(selectedPatchScenario)}</span>
                    </div>
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>Scope</strong>
                      <span>{selectedBulkPatchSelectedCount > 0 ? bulkPatchScopeLabel : "Not available"}</span>
                    </div>
                  </div>
                </div>
                <p className="panel-copy bulk-patch-summary-status">{bulkPatchActionStatus}</p>
              </div>
              )
            ) : null}
            {isOperationAssessmentMode ? (
              <div className="draft-card bulk-patch-summary-bar">
                <div className="draft-card-head">
                  <strong>{xmlAssessmentTitle}</strong>
                  <span
                    className={
                      isLoadingXmlOperationAssessment
                        ? "status-pill warn compact"
                        : xmlOperationAssessment
                          ? `status-pill ${operationAssessmentStatusClass(xmlOperationAssessment.status)} compact`
                          : "status-pill warn compact"
                    }
                  >
                    {isLoadingXmlOperationAssessment
                      ? "Assessing"
                      : xmlOperationAssessment
                        ? operationAssessmentStatusLabel(xmlOperationAssessment.status)
                        : "Unavailable"}
                  </span>
                </div>
                <div className="bulk-patch-summary-row">
                  <div className="bulk-patch-summary-metrics">
                    {xmlAssessmentSummaryRows.map((row) => (
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile" key={row.label}>
                        <strong>{row.label}</strong>
                        <span>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="panel-copy bulk-patch-summary-status">
                  {isLoadingXmlOperationAssessment
                    ? "Checking the selected operation against current canonical validation and tracked SQLite testing state."
                    : xmlOperationAssessment?.summary_message ??
                      xmlOperationAssessmentError ??
                      "Operation assessment is not available for this selection."}
                </p>
                {xmlOperationAssessment?.blocking_reasons.length ? (
                  <div className="roadmap-list">
                    {xmlOperationAssessment.blocking_reasons.map((reason, index) => (
                      <div className="roadmap-item" key={`${reason}-${index}`}>
                        <strong>{xmlOperationAssessment.status === "blocked" ? "Why blocked" : "Needs attention"}</strong>
                        <p>{reason}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {xmlOperationAssessment?.recommended_next_action ? (
                  <div className="workflow-note">
                    <strong>Recommended next action</strong>
                    <span>{xmlOperationAssessment.recommended_next_action}</span>
                  </div>
                ) : null}
              </div>
            ) : xmlMode === "marketInfo" ? (
              <div className="workflow-note">
                <strong>Assessment status</strong>
                <span>Market Info operational assessment is deferred and is not yet driven by the new backend contract.</span>
              </div>
            ) : null}
            <div className={xmlMode === "bulkPatch" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" ? "xml-focus-layout bulk-patch-focus-layout" : "xml-focus-layout"}>
              <div className="xml-preview-surface">
                <div className="section-heading xml-preview-heading">
                  <div>
                    <span className="section-kicker">Preview</span>
                    <h2>
                      {xmlMode === "post"
                        ? "POST Preview"
                        : xmlMode === "single"
                          ? "Single Record XML Preview"
                          : xmlMode === "marketInfo"
                            ? "Market Info Preview"
                            : xmlMode === "patch"
                              ? "Patch XML Preview"
                              : xmlMode === "bulkPost"
                                ? "Bulk Basic UDI POST Preview"
                                : xmlMode === "bulkUdidiPost"
                                  ? "Bulk UDI-DI POST Preview"
                                : "Bulk PATCH Preview"}
                    </h2>
                  </div>
                  {xmlMode === "patch" ? (
                    <div className="xml-mode-toggle xml-sub-tabs xml-compare-toggle">
                      <button
                        className={patchPreviewView === "base" ? "action-button xml-mode-button xml-compare-button active" : "ghost-button xml-mode-button xml-compare-button"}
                        type="button"
                        onClick={() => setPatchPreviewView("base")}
                      >
                        Base Message
                      </button>
                      <button
                        className={patchPreviewView === "derived" ? "action-button xml-mode-button xml-compare-button active" : "ghost-button xml-mode-button xml-compare-button"}
                        type="button"
                        onClick={() => setPatchPreviewView("derived")}
                      >
                        Derived Patch
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className={xmlMode === "bulkPatch" || xmlMode === "bulkPost" ? "xml-preview-meta bulk-patch-preview-meta" : "xml-preview-meta"}>
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
                    {xmlMode === "post"
                      ? xmlPairPreview
                        ? `POST preview generated for ${xmlPairPreview.product_family} / ${xmlPairPreview.product_variant} / ${xmlPairPreview.catalogue_number}.`
                        : selectedPostWorkspaceRecord
                          ? `No POST preview generated yet for the next available Device UDI-DI candidate ${selectedPostWorkspaceRecord.catalogue_number}.`
                          : "No available Device UDI-DI POST candidate is currently available for the selected family and variant."
                      : xmlMode === "single"
                        ? xmlPreview
                          ? `Preview generated for ${xmlPreview.product_family} / ${xmlPreview.product_variant} / ${xmlPreview.catalogue_number}.`
                          : "No XML preview generated yet for the selected row."
                        : xmlMode === "marketInfo"
                          ? xmlMarketInfoPreview
                            ? `MARKET_INFO.PUT preview generated for ${xmlMarketInfoPreview.product_family} / ${xmlMarketInfoPreview.product_variant} / ${xmlMarketInfoPreview.catalogue_number}.`
                            : "No MARKET_INFO.PUT preview generated yet for the registered testing anchor."
                          : xmlMode === "patch"
                            ? xmlPatchPreview
                              ? `Scenario-derived PATCH preview loaded for ${xmlPatchPreview.product_family} / ${xmlPatchPreview.product_variant} / ${xmlPatchPreview.catalogue_number}. Currently showing ${patchPreviewView === "base" ? "BASE" : "DERIVED"} XML.`
                              : hasReviewedPatchBaselinePost
                                ? "No generated PATCH scenario preview loaded yet for the reviewed POST baseline."
                                : hasSelectedPatchBaselinePost
                                  ? "Review the baseline POST first. Scenario PATCH generation stays blocked until that POST has been generated for this exact record."
                                  : "No baseline POST is currently available for the selected family and variant."
                          : xmlMode === "bulkPost"
                            ? xmlBulkPostPreview
                              ? `Bulk Basic UDI POST preview generated for ${xmlBulkPostPreview.product_family} / ${xmlBulkPostPreview.product_variant}, chunk ${xmlBulkPostPreview.selected_chunk_sequence}.`
                              : "No bulk Basic UDI POST preview generated yet for the selected variant."
                            : xmlMode === "bulkUdidiPost"
                              ? xmlBulkUdidiPostPreview
                                ? `Bulk UDI-DI POST preview generated for ${xmlBulkUdidiPostPreview.product_family} / ${xmlBulkUdidiPostPreview.product_variant}, chunk ${xmlBulkUdidiPostPreview.selected_chunk_sequence}.`
                                : "No bulk UDI-DI POST preview generated yet for the selected variant."
                            : xmlBulkPatchPreview
                              ? `Bulk PATCH preview generated for ${xmlBulkPatchPreview.product_family} / ${xmlBulkPatchPreview.product_variant} / ${xmlBulkPatchPreview.selected_basic_udi_di}, chunk ${xmlBulkPatchPreview.selected_chunk_sequence}.`
                              : "No bulk PATCH preview generated yet for the selected parent scope."}
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
                      ((xmlMode === "single" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") && !selectedXmlVariantSummary) ||
                      !canGenerateCurrentXml ||
                      isGeneratingXml
                    }
                  >
                    {isGeneratingXml
                      ? "Generating..."
                      : xmlMode === "post"
                        ? "Generate POST"
                        : xmlMode === "single"
                        ? "Generate XML"
                        : xmlMode === "marketInfo"
                          ? "Generate Market Info"
                          : xmlMode === "patch"
                            ? "Generate Patch Scenario"
                            : xmlMode === "bulkPost"
                              ? "Generate Bulk Basic UDI POST"
                              : xmlMode === "bulkUdidiPost"
                                ? "Generate Bulk UDI-DI POST"
                              : "Generate Bulk PATCH"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void generateXmlPreview()}
                    disabled={
                      ((xmlMode === "single" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") && !selectedXmlVariantSummary) ||
                      !canGenerateCurrentXml ||
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
                      ((xmlMode === "single" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") && !selectedXmlVariantSummary) ||
                      !canDownloadCurrentXml ||
                      isGeneratingXml
                    }
                  >
                    {xmlMode === "post"
                      ? "Download POST ZIP"
                      : xmlMode === "single"
                        ? "Download XML"
                      : xmlMode === "marketInfo"
                          ? "Download Market Info"
                          : xmlMode === "patch"
                            ? "Download Patch Scenario ZIP"
                            : xmlMode === "bulkPost"
                              ? "Download Bulk Basic UDI POST ZIP"
                              : xmlMode === "bulkUdidiPost"
                                ? "Download Bulk UDI-DI POST ZIP"
                              : "Download Bulk PATCH ZIP"}
                  </button>
                  {xmlActionMessage ? <span className="save-message">{xmlActionMessage}</span> : null}
                </div>
                {xmlMode === "post" ? (
                  selectedPostWorkspaceRecord ? (
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedPostWorkspaceRecord.catalogue_number}</strong>
                          <span className="status-pill ok compact">Next POST candidate</span>
                        </div>
                        <p className="draft-meta">
                          {selectedPostWorkspaceRecord.product_family} / {selectedPostWorkspaceRecord.product_variant}
                        </p>
                        {selectedPostWorkspaceRecord.trade_name ? (
                          <p className="panel-copy">{selectedPostWorkspaceRecord.trade_name}</p>
                        ) : null}
                        <p className="panel-copy">
                          Device UDI-DI {selectedPostWorkspaceRecord.primary_udi_di ?? "Unknown"} ·
                          {xmlOperationAssessment?.status === "available"
                            ? assessedPostParentRegistrationKnown
                              ? " available to register under the tracked Basic UDI-DI parent."
                              : " can seed a new Basic UDI-DI parent registration."
                            : " not currently available for POST."}
                        </p>
                        <p className="panel-copy">
                          {xmlOperationAssessment?.status === "available"
                            ? assessedPostParentRegistrationKnown
                              ? "The Basic UDI-DI is already registered. Review the next available Device UDI-DI POST candidate for this family and variant."
                              : "Review the next available POST candidate for this family and variant. This record will seed a new Basic UDI-DI parent registration."
                            : xmlOperationAssessment?.summary_message ??
                              "No available Device UDI-DI POST candidate is currently available for this family and variant."}
                        </p>
                        <div className="family-scope-pill-row xml-status-row">
                          <span className={pairPostValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            Post {pairPostValidation ? (pairPostValidation.valid ? "valid" : "invalid") : "awaiting preview"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="panel-copy">
                      {xmlOperationAssessment?.summary_message ??
                        "No available Device UDI-DI POST candidate is currently available for the selected family and variant."}
                    </p>
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
                  selectedTestingAnchor ? (
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedTestingAnchor.catalogue_number}</strong>
                          <span className="status-pill ok compact">Market info</span>
                        </div>
                        <p className="draft-meta">
                          {selectedTestingAnchor.product_family} / {selectedTestingAnchor.product_variant}
                        </p>
                        <p className="panel-copy">
                          UDI-DI {selectedTestingAnchor.primary_udi_di} · Registered device anchor
                        </p>
                        <p className="panel-copy">Review a standalone market information update message against the same registered device used for `POST` and the candidate patch scenarios.</p>
                      </div>
                    </div>
                  ) : (
                    <p className="panel-copy">No registered testing anchor is currently available for MARKET_INFO.PUT generation.</p>
                  )
                ) : xmlMode === "patch" ? (
                  selectedXmlPairRecord ? (
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedPatchScenario.label}</strong>
                          <span className={selectedPatchScenarioStatus === "EUDAMED Accepted" ? "status-pill ok compact" : "status-pill warn compact"}>
                            {selectedPatchScenarioStatus}
                          </span>
                        </div>
                        <p className="draft-meta">
                          Parent POST {selectedXmlPairRecord.catalogue_number} · Current accepted base {currentAcceptedPatchLabel}
                        </p>
                        <div className="family-scope-pill-row xml-status-row">
                          <span className={hasReviewedPatchBaselinePost ? "status-pill ok compact" : "status-pill warn compact"}>
                            {hasReviewedPatchBaselinePost ? "Baseline POST reviewed" : "Baseline POST required"}
                          </span>
                          <span className="status-pill ok compact">Parent POST</span>
                          <span className="status-pill ok compact">{selectedXmlPairRecord.catalogue_number}</span>
                        </div>
                        <p className="panel-copy">{selectedPatchScenario.summary}</p>
                        {hasReviewedPatchBaselinePost ? (
                          <>
                            <div className="patch-compare-grid">
                              <div className="patch-compare-card">
                                <span className="summary-label">Before</span>
                                <strong>{currentAcceptedPatchLabel}</strong>
                                <p>
                                  Parent POST {selectedXmlPairRecord.catalogue_number} · Version {String(currentAcceptedPatchVersion)}
                                </p>
                                <ul className="patch-compare-list">
                                  {patchDraftComparisonRows.map((row) => (
                                    <li key={`before-${row.label}`}>
                                      <strong>{row.label}</strong>
                                      <span>{row.before}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="patch-compare-card patch-compare-card-accent">
                                <span className="summary-label">After</span>
                                <strong>Derived scenario PATCH draft</strong>
                                <p>
                                  Same parent device lineage · Version {patchVersionInput.trim() || "Pending"}
                                </p>
                                <ul className="patch-compare-list">
                                  {patchDraftComparisonRows.map((row) => (
                                    <li key={`after-${row.label}`}>
                                      <strong>{row.label}</strong>
                                      <span>{row.after}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div className="patch-form-grid">
                              <div className="patch-field">
                                <label className="field-label" htmlFor="patch-scenario-selector">
                                  Candidate PATCH scenario
                                </label>
                                <select
                                  id="patch-scenario-selector"
                                  className="rule-select patch-select"
                                  value={selectedPatchScenario.id}
                                  onChange={(event) => setSelectedPatchScenarioId(event.target.value as PatchScenarioId)}
                                >
                                  {PATCH_SCENARIOS.map((scenario) => (
                                    <option key={scenario.id} value={scenario.id}>
                                      {patchScenarioOptionLabel(scenario)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="patch-field">
                                <label className="field-label" htmlFor="patch-version-input">
                                  Scenario PATCH version
                                </label>
                                <input
                                  id="patch-version-input"
                                  className="rule-select patch-select"
                                  type="number"
                                  min={2}
                                  step={1}
                                  value={patchVersionInput}
                                  onChange={(event) => setPatchVersionInput(event.target.value)}
                                />
                              </div>
                              <div className="patch-field patch-field-full">
                                <p className="panel-copy patch-field-note">
                                  Baseline `POST` is version `1`. Version `2` PATCHes are derived directly from the POST. Version `3+` PATCHes are derived from the latest successful PATCH tracked in YAML for this device.
                                </p>
                              </div>
                              {!selectedPatchScenarioImplemented ? (
                                <div className="patch-field patch-field-full">
                                  <div className="workflow-note patch-readiness-note">
                                    <strong>Design placeholder</strong>
                                    <span>
                                      This candidate scenario is now listed in the dropdown for design review, but XML generation is not implemented yet.
                                      {selectedPatchScenario.optionsSummary ? ` Allowed options: ${selectedPatchScenario.optionsSummary}` : ""}
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "equivalent_first_patch" ? (
                                <div className="patch-field patch-field-full">
                                  <p className="panel-copy">
                                    This option creates the explicit version `2` PATCH that mirrors the accepted POST and makes no business-field change.
                                  </p>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "trade_name_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="patch-trade-name-input">
                                    New trade name
                                  </label>
                                  <input
                                    id="patch-trade-name-input"
                                    className="rule-select patch-select"
                                    type="text"
                                    value={patchTradeNameInput}
                                    onChange={(event) => setPatchTradeNameInput(event.target.value)}
                                  />
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "base_quantity_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="patch-base-quantity-input">
                                    New base quantity
                                  </label>
                                  <input
                                    id="patch-base-quantity-input"
                                    className="rule-select patch-select"
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={patchBaseQuantityInput}
                                    onChange={(event) => setPatchBaseQuantityInput(event.target.value)}
                                  />
                                  <p className="field-source-note">
                                    Current value: {selectedCurrentBaseQuantity !== null ? selectedCurrentBaseQuantity : "None"}
                                  </p>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "sterile_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="patch-sterile-input">
                                    Sterile
                                  </label>
                                  <select
                                    id="patch-sterile-input"
                                    className="rule-select patch-select"
                                    value={patchSterileInput}
                                    onChange={(event) => setPatchSterileInput(event.target.value)}
                                  >
                                    <option value="">Select value</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                  <p className="field-source-note">
                                    Current value: {selectedCurrentSterile === null ? "None" : selectedCurrentSterile ? "true" : "false"}
                                  </p>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "latex_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="patch-latex-input">
                                    Latex
                                  </label>
                                  <select
                                    id="patch-latex-input"
                                    className="rule-select patch-select"
                                    value={patchLatexInput}
                                    onChange={(event) => setPatchLatexInput(event.target.value)}
                                  >
                                    <option value="">Select value</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                  <p className="field-source-note">
                                    Current value: {selectedCurrentLatex === null ? "None" : selectedCurrentLatex ? "true" : "false"}
                                  </p>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "status_code_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="patch-status-code-input">
                                    Status code
                                  </label>
                                  <select
                                    id="patch-status-code-input"
                                    className="rule-select patch-select"
                                    value={patchStatusCodeInput}
                                    onChange={(event) => setPatchStatusCodeInput(event.target.value)}
                                  >
                                    <option value="">Select value</option>
                                    <option value="NOT_INTENDED_FOR_EU_MARKET">NOT_INTENDED_FOR_EU_MARKET</option>
                                    <option value="ON_THE_MARKET">ON_THE_MARKET</option>
                                    <option value="NO_LONGER_PLACED_ON_THE_MARKET">NO_LONGER_PLACED_ON_THE_MARKET</option>
                                  </select>
                                  <p className="field-source-note">
                                    Current value: {selectedCurrentStatusCode ?? "None"}
                                  </p>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "warning_add" ? (
                                <>
                                  <div className="patch-field patch-field-full">
                                    <label className="field-label" htmlFor="patch-warning-current-input">
                                      Current critical warning set
                                    </label>
                                    <input
                                      id="patch-warning-current-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      value={selectedPatchWarningCodes.join(", ") || "None"}
                                      readOnly
                                    />
                                    {selectedPatchWarningDescriptions.length ? (
                                      <p className="field-source-note">
                                        {selectedPatchWarningDescriptions.join(" | ")}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="patch-field">
                                    <label className="field-label" htmlFor="patch-warning-code-input">
                                      Replacement warning code
                                    </label>
                                    <input
                                      id="patch-warning-code-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      list="critical-warning-code-options"
                                      value={patchWarningCodeInput}
                                      onChange={(event) => setPatchWarningCodeInput(event.target.value)}
                                    />
                                  </div>
                                  <datalist id="critical-warning-code-options">
                                    {criticalWarningCodeOptions.map((option) => (
                                      <option key={option.code} value={option.code}>
                                        {option.description ? `${option.code} - ${option.description}` : option.code}
                                      </option>
                                    ))}
                                  </datalist>
                                  {selectedWarningRequiresComment || patchWarningCommentInput.trim() ? (
                                    <div className="patch-field patch-field-full">
                                      <label className="field-label" htmlFor="patch-warning-comment-input">
                                        Warning comment
                                      </label>
                                      <input
                                        id="patch-warning-comment-input"
                                        className="rule-select patch-select"
                                        type="text"
                                        value={patchWarningCommentInput}
                                        onChange={(event) => setPatchWarningCommentInput(event.target.value)}
                                      />
                                    </div>
                                  ) : null}
                                </>
                              ) : null}
                              {selectedPatchScenario.id === "storage_condition_edit" ? (
                                <>
                                  <div className="patch-field">
                                    <label className="field-label" htmlFor="patch-storage-shc006-input">
                                      Storage condition SHC006
                                    </label>
                                    <input
                                      id="patch-storage-shc006-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      value={patchStorageConditionInputs.SHC006 ?? ""}
                                      onChange={(event) =>
                                        setPatchStorageConditionInputs((current) => ({
                                          ...current,
                                          SHC006: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="patch-field">
                                    <label className="field-label" htmlFor="patch-storage-shc007-input">
                                      Storage condition SHC007
                                    </label>
                                    <input
                                      id="patch-storage-shc007-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      value={patchStorageConditionInputs.SHC007 ?? ""}
                                      onChange={(event) =>
                                        setPatchStorageConditionInputs((current) => ({
                                          ...current,
                                          SHC007: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </>
                              ) : null}
                              <div className="patch-field patch-field-full">
                                <label className="field-label" htmlFor="patch-scenario-status">
                                  EUDAMED status
                                </label>
                                <select
                                  id="patch-scenario-status"
                                  className="rule-select patch-select"
                                  value={selectedPatchScenarioStatus}
                                  onChange={(event) =>
                                    setPatchScenarioStatuses((current) => ({
                                      ...current,
                                      [selectedPatchScenario.id]: event.target.value as EudamedStatus,
                                    }))
                                  }
                                >
                                  <option value="EUDAMED Candidate">EUDAMED Candidate</option>
                                  <option value="EUDAMED Accepted">EUDAMED Accepted</option>
                                </select>
                              </div>
                            </div>
                            <p className="panel-copy">
                              Target: `{selectedPatchScenario.target}`. Scenario PATCH drafts remain in `EUDAMED Testing`
                              until there is user-confirmed evidence of EUDAMED acceptance.
                            </p>
                            <div className="workflow-note patch-readiness-note">
                              <strong>Draft readiness</strong>
                              <span>{patchScenarioReadinessMessage}</span>
                            </div>
                          </>
                        ) : (
                          <div className="workflow-note patch-readiness-note">
                            <strong>POST review required</strong>
                            <span>
                              Generate and review `POST` for `{selectedXmlPairRecord.catalogue_number}` first.
                              Scenario drafting stays blocked until that exact baseline POST has been loaded in this session.
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="draft-card">
                        <div className="draft-card-head">
                          <strong>Generated XML Change Summary</strong>
                          <span className="status-pill ok compact">{xmlPatchPreview ? `${xmlPatchPreview.field_deltas.length} field changes` : "Awaiting preview"}</span>
                        </div>
                        {xmlPatchPreview ? (
                          <div className="roadmap-list">
                            {xmlPatchPreview.field_deltas.map((delta) => (
                              <div className="roadmap-item" key={delta.field_key}>
                                <strong>{delta.label}</strong>
                                <p>
                                  Before: {delta.before_value ?? "None"} | After: {delta.after_value ?? "None"}
                                </p>
                                <p>{delta.target_xpath_hint}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="panel-copy">
                            Generate a preview to confirm that the XML output matches the planned before/after business change shown above.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>No POST Baseline Available</strong>
                        <span className="status-pill warn compact">Scenario blocked</span>
                      </div>
                      <p className="panel-copy">
                        `Patch XML` requires a baseline `POST` record for the selected family and variant.
                      </p>
                      <p className="panel-copy">
                        No XML-ready `POST` record is currently available, so the baseline POST cannot be generated and scenario PATCH drafting is unavailable for this selection.
                      </p>
                    </div>
                  )
                ) : xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" ? (
                  <div className="draft-list xml-record-stack">
                    <div className="draft-card xml-record-card">
                      <div className="draft-card-head">
                        <strong>
                          {xmlMode === "bulkPatch" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost"
                            ? `${selectedXmlFamilySummary?.product_family} / ${selectedXmlVariantSummary.product_variant}`
                            : selectedXmlVariantSummary.product_variant}
                        </strong>
                        <span className="status-pill ok compact">
                          {xmlMode === "bulkPatch"
                            ? "Bulk PATCH"
                            : xmlMode === "bulkPost"
                              ? "Bulk POST"
                              : xmlMode === "bulkUdidiPost"
                                ? "Bulk UDI-DI POST"
                              : (selectedXmlVariantSummary.submission_operation ?? "No operation")}
                        </span>
                      </div>
                      {xmlMode !== "bulkPatch" && xmlMode !== "bulkPost" && xmlMode !== "bulkUdidiPost" ? (
                        <>
                          <p className="draft-meta">
                            {selectedXmlFamilySummary?.product_family} / {selectedXmlVariantSummary.product_variant}
                          </p>
                          <p className="panel-copy">
                            Select how many sibling Device UDI-DI registrations to include under the already accepted Basic UDI-DI parent.
                          </p>
                          <p className="panel-copy">
                            {selectedBulkEligibleUdidiPostCount} eligible Device UDI-DI registration{selectedBulkEligibleUdidiPostCount === 1 ? "" : "s"} in this variant can be used for Bulk UDI-DI POST.
                          </p>
                          <p className="panel-copy">
                            {selectedXmlVariantSummary.xml_blocked_records} row{selectedXmlVariantSummary.xml_blocked_records === 1 ? "" : "s"} remain excluded until resolved.
                          </p>
                        </>
                      ) : null}
                      {xmlMode === "bulkPatch" ? (
                        <>
                          <div className="bulk-patch-layout">
                            <div className="bulk-patch-config-column">
                            <div className="draft-card">
                              <div className="draft-card-head">
                                <strong>1. Choose posted parent</strong>
                                <span className="status-pill ok compact">
                                  {displayedBulkPatchParentOptions.length} available
                                </span>
                              </div>
                              <p className="panel-copy">
                                Confirm Basic UDI-DI for this PATCH.
                              </p>
                              <label className="field-label" htmlFor="xml-bulk-patch-parent-selector">
                                Basic UDI-DI parent
                              </label>
                              <select
                                id="xml-bulk-patch-parent-selector"
                                className="rule-select"
                                value={selectedBulkPatchParentGroup?.basic_udi_di ?? ""}
                                onChange={(event) => {
                                  setSelectedBulkPatchBasicUdiDi(event.target.value);
                                  setSelectedXmlChunkSequence(1);
                                  setXmlBulkPatchPreview(null);
                                }}
                              >
                                {displayedBulkPatchParentOptions.map((group) => (
                                  <option key={group.basic_udi_di} value={group.basic_udi_di}>
                                    {group.basic_udi_di} · {group.posted_child_count} posted device{group.posted_child_count === 1 ? "" : "s"}
                                  </option>
                                ))}
                              </select>
                              {displayedBulkPatchParentOptions.length ? (
                                <div className="bulk-parent-chip-row">
                                  {displayedBulkPatchParentOptions.map((group) => {
                                    const isSelected = group.basic_udi_di === selectedBulkPatchParentGroup?.basic_udi_di;
                                    return (
                                      <button
                                        key={group.basic_udi_di}
                                        type="button"
                                        className={isSelected ? "bulk-parent-chip active" : "bulk-parent-chip"}
                                        onClick={() => {
                                          setSelectedBulkPatchBasicUdiDi(group.basic_udi_di);
                                          setSelectedXmlChunkSequence(1);
                                          setXmlBulkPatchPreview(null);
                                        }}
                                      >
                                        {group.basic_udi_di} ({group.posted_child_count})
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>

                            <div className="draft-card">
                              <div className="draft-card-head">
                                <strong>2. Choose device scope</strong>
                                <span className="status-pill ok compact">{selectedBulkPatchSelectedCount} selected</span>
                              </div>
                              <p className="panel-copy">
                                Determine scope of this PATCH.
                              </p>
                              <label className="field-label" htmlFor="xml-bulk-patch-scope-mode">
                                Scope mode
                              </label>
                              <select
                                id="xml-bulk-patch-scope-mode"
                                className="rule-select"
                                value={bulkPatchScopeMode}
                                onChange={(event) => {
                                  setBulkPatchScopeMode(event.target.value as BulkPatchScopeMode);
                                  setSelectedXmlChunkSequence(1);
                                  setXmlBulkPatchPreview(null);
                                }}
                              >
                                <option value="all_posted">All posted devices</option>
                                <option value="selected_catalogue_numbers">Select catalogue numbers</option>
                                <option value="import_catalogue_list">Import catalogue list</option>
                              </select>
                              {bulkPatchScopeMode === "all_posted" ? (
                                <p className="panel-copy">
                                  Apply this PATCH to every posted Device UDI-DI record under the selected Basic UDI-DI.
                                </p>
                              ) : null}
                              {bulkPatchScopeMode === "selected_catalogue_numbers" ? (
                                <>
                                  <label className="field-label" htmlFor="xml-bulk-patch-catalogue-filter">
                                    Catalogue number filter
                                  </label>
                                  <input
                                    id="xml-bulk-patch-catalogue-filter"
                                    className="rule-select patch-select"
                                    type="text"
                                    placeholder={bulkPatchPostedEntries.length > 10 ? "Search posted catalogue numbers" : "Optional filter"}
                                    value={bulkPatchCatalogueFilter}
                                    onChange={(event) => setBulkPatchCatalogueFilter(event.target.value)}
                                  />
                                  {bulkPatchPostedEntries.length > 10 && !bulkPatchCatalogueFilter.trim() ? (
                                    <p className="panel-copy">
                                      Many posted devices are available. Enter a catalogue number filter to choose a subset.
                                    </p>
                                  ) : (
                                    <div className="bulk-posted-grid">
                                      {bulkPatchFilteredPostedEntries.map((entry, index) => {
                                        const catalogueNumber = entry.catalogue_number ?? "";
                                        const isSelected = selectedBulkPatchCatalogueNumbers.includes(catalogueNumber);
                                        return (
                                          <label className="roadmap-item compact-structured-item bulk-selection-card" key={`${catalogueNumber}-${index}`}>
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {
                                                setSelectedBulkPatchCatalogueNumbers((current) => (
                                                  current.includes(catalogueNumber)
                                                    ? current.filter((value) => value !== catalogueNumber)
                                                    : [...current, catalogueNumber]
                                                ));
                                                setSelectedXmlChunkSequence(1);
                                                setXmlBulkPatchPreview(null);
                                              }}
                                            />
                                            <span>
                                              <strong>{catalogueNumber || entry.primary_udi_di || "Unknown device"}</strong>
                                              <p>{entry.primary_udi_di ?? "Device UDI-DI pending"}</p>
                                              <p>Current version {entry.latest_version ?? "1"}</p>
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              ) : null}
                              {bulkPatchScopeMode === "import_catalogue_list" ? (
                                <>
                                  <label className="field-label" htmlFor="xml-bulk-patch-import-list">
                                    Catalogue numbers
                                  </label>
                                  <textarea
                                    id="xml-bulk-patch-import-list"
                                    className="rule-select patch-select"
                                    rows={6}
                                    placeholder={"One catalogue number per line, or comma-separated values."}
                                    value={bulkPatchImportText}
                                    onChange={(event) => setBulkPatchImportText(event.target.value)}
                                  />
                                  <p className="panel-copy">
                                    Imported {bulkPatchImportedCatalogueNumbers.length}. Matched {bulkPatchImportedMatchedCatalogueNumbers.length}. Not found {bulkPatchImportedNotFoundCatalogueNumbers.length}.
                                  </p>
                                </>
                              ) : null}
                            </div>

                            <div className="draft-card">
                              <div className="draft-card-head">
                                <strong>3. Choose PATCH scenario</strong>
                                <span className="status-pill ok compact">{selectedPatchScenario.testStatus}</span>
                              </div>
                              <p className="panel-copy">
                                Select PATCH operation for your chosen scope.
                              </p>
                              <label className="field-label" htmlFor="xml-bulk-patch-scenario-selector">
                                Bulk PATCH scenario
                              </label>
                              <select
                                id="xml-bulk-patch-scenario-selector"
                                className="rule-select"
                                value={selectedPatchScenario.id}
                                onChange={(event) => setSelectedPatchScenarioId(event.target.value as PatchScenarioId)}
                              >
                                {PATCH_SCENARIOS.map((scenario) => (
                                  <option key={scenario.id} value={scenario.id}>
                                    {patchScenarioOptionLabel(scenario)}
                                  </option>
                                ))}
                              </select>
                              <p className="panel-copy">{selectedPatchScenario.summary}</p>
                              {selectedPatchScenario.optionsSummary ? (
                                <p className="panel-copy">Options: {selectedPatchScenario.optionsSummary}</p>
                              ) : null}
                              {!selectedPatchScenarioImplemented ? (
                                <div className="workflow-note patch-readiness-note">
                                  <strong>Design placeholder</strong>
                                  <span>
                                    This candidate scenario is listed for design review, but XML generation is not implemented yet.
                                  </span>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "equivalent_first_patch" ? (
                                <p className="panel-copy">This option creates the explicit version `2` PATCH with no business-field change.</p>
                              ) : null}
                              {selectedPatchScenario.id === "trade_name_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="bulk-patch-trade-name-input">
                                    New trade name
                                  </label>
                                  <input
                                    id="bulk-patch-trade-name-input"
                                    className="rule-select patch-select"
                                    type="text"
                                    value={patchTradeNameInput}
                                    onChange={(event) => setPatchTradeNameInput(event.target.value)}
                                  />
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "base_quantity_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="bulk-patch-base-quantity-input">
                                    New base quantity
                                  </label>
                                  <input
                                    id="bulk-patch-base-quantity-input"
                                    className="rule-select patch-select"
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={patchBaseQuantityInput}
                                    onChange={(event) => setPatchBaseQuantityInput(event.target.value)}
                                  />
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "status_code_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="bulk-patch-status-code-input">
                                    Status code
                                  </label>
                                  <select
                                    id="bulk-patch-status-code-input"
                                    className="rule-select patch-select"
                                    value={patchStatusCodeInput}
                                    onChange={(event) => setPatchStatusCodeInput(event.target.value)}
                                  >
                                    <option value="">Select value</option>
                                    <option value="NOT_INTENDED_FOR_EU_MARKET">NOT_INTENDED_FOR_EU_MARKET</option>
                                    <option value="ON_THE_MARKET">ON_THE_MARKET</option>
                                    <option value="NO_LONGER_PLACED_ON_THE_MARKET">NO_LONGER_PLACED_ON_THE_MARKET</option>
                                  </select>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "sterile_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="bulk-patch-sterile-input">
                                    Sterile
                                  </label>
                                  <select
                                    id="bulk-patch-sterile-input"
                                    className="rule-select patch-select"
                                    value={patchSterileInput}
                                    onChange={(event) => setPatchSterileInput(event.target.value)}
                                  >
                                    <option value="">Select value</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "latex_edit" ? (
                                <div className="patch-field patch-field-full">
                                  <label className="field-label" htmlFor="bulk-patch-latex-input">
                                    Latex
                                  </label>
                                  <select
                                    id="bulk-patch-latex-input"
                                    className="rule-select patch-select"
                                    value={patchLatexInput}
                                    onChange={(event) => setPatchLatexInput(event.target.value)}
                                  >
                                    <option value="">Select value</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                  </select>
                                </div>
                              ) : null}
                              {selectedPatchScenario.id === "warning_add" ? (
                                <>
                                  <div className="patch-field patch-field-full">
                                    <label className="field-label" htmlFor="bulk-patch-warning-code-input">
                                      Replacement warning code
                                    </label>
                                    <input
                                      id="bulk-patch-warning-code-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      list="critical-warning-code-options"
                                      value={patchWarningCodeInput}
                                      onChange={(event) => setPatchWarningCodeInput(event.target.value)}
                                    />
                                  </div>
                                  {selectedWarningRequiresComment || patchWarningCommentInput.trim() ? (
                                    <div className="patch-field patch-field-full">
                                      <label className="field-label" htmlFor="bulk-patch-warning-comment-input">
                                        Warning comment
                                      </label>
                                      <input
                                        id="bulk-patch-warning-comment-input"
                                        className="rule-select patch-select"
                                        type="text"
                                        value={patchWarningCommentInput}
                                        onChange={(event) => setPatchWarningCommentInput(event.target.value)}
                                      />
                                    </div>
                                  ) : null}
                                </>
                              ) : null}
                              {selectedPatchScenario.id === "storage_condition_edit" ? (
                                <>
                                  <div className="patch-field">
                                    <label className="field-label" htmlFor="bulk-patch-storage-shc006-input">
                                      Storage condition SHC006
                                    </label>
                                    <input
                                      id="bulk-patch-storage-shc006-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      value={patchStorageConditionInputs.SHC006 ?? ""}
                                      onChange={(event) =>
                                        setPatchStorageConditionInputs((current) => ({
                                          ...current,
                                          SHC006: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="patch-field">
                                    <label className="field-label" htmlFor="bulk-patch-storage-shc007-input">
                                      Storage condition SHC007
                                    </label>
                                    <input
                                      id="bulk-patch-storage-shc007-input"
                                      className="rule-select patch-select"
                                      type="text"
                                      value={patchStorageConditionInputs.SHC007 ?? ""}
                                      onChange={(event) =>
                                        setPatchStorageConditionInputs((current) => ({
                                          ...current,
                                          SHC007: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </>
                              ) : null}
                            </div>
                            </div>
                          </div>
                          <div className="validation-pill-row bulk-patch-pill-row">
                            <span className="status-pill ok compact bulk-patch-status-pill">
                              Schema target: Message.xsd
                            </span>
                            <span
                              className={
                                selectedBatchValidation?.valid
                                  ? "status-pill ok compact bulk-patch-status-pill"
                                  : "status-pill warn compact bulk-patch-status-pill"
                              }
                            >
                              Validation output:{" "}
                              {selectedBatchValidation
                                ? selectedBatchValidation.valid
                                  ? "Schema valid"
                                  : "Schema invalid"
                                : "Awaiting preview"}
                            </span>
                          </div>
                        </>
                      ) : xmlMode === "bulkPost" ? (
                        <>
                          <div className="bulk-patch-layout">
                            <div className="bulk-patch-config-column">
                              <div className="draft-card">
                                <div className="draft-card-head">
                                  <strong>1. Confirm parent candidates</strong>
                                  <span className="status-pill ok compact">
                                    {selectedBulkUnpostedBasicUdiCount} available
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  Confirm Basic UDI-DI parent scope for this POST.
                                </p>
                                <label className="field-label" htmlFor="xml-bulk-post-parent-count">
                                  Basic UDI-DI parents
                                </label>
                                <div className="bulk-parent-chip-row">
                                  <span className="bulk-parent-chip active">
                                    {selectedBulkUnpostedBasicUdiCount} unposted parent{selectedBulkUnpostedBasicUdiCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  {bulkPostReadinessMessage}
                                </p>
                              </div>

                              <div className="draft-card">
                                <div className="draft-card-head">
                                  <strong>2. Choose record count</strong>
                                  <span className="status-pill ok compact">
                                    {selectedBulkRecordCount} selected
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  Determine scope of this POST.
                                </p>
                                <label className="field-label" htmlFor="xml-bulk-record-count">
                                  Number of devices
                                </label>
                                <select
                                  id="xml-bulk-record-count"
                                  className="rule-select"
                                  value={selectedBulkRecordCount}
                                  onChange={(event) => {
                                    setSelectedBulkRecordCount(Number(event.target.value));
                                    setSelectedXmlChunkSequence(1);
                                  }}
                                >
                                  {Array.from(
                                    { length: Math.max(Math.min(selectedBulkCapacity, 300), 1) },
                                    (_, index) => index + 1,
                                  ).map((count) => (
                                    <option key={count} value={count}>
                                      {count} device{count === 1 ? "" : "s"}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="draft-card">
                                <div className="draft-card-head">
                                  <strong>3. Prepare output</strong>
                                  <span className="status-pill ok compact">
                                    Chunk {selectedXmlChunkSequence} of {selectedBulkChunkCount}
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  Select preview output for your chosen scope.
                                </p>
                                <label className="field-label" htmlFor="xml-batch-chunk-sequence">
                                  Preview chunk
                                </label>
                                <select
                                  id="xml-batch-chunk-sequence"
                                  className="rule-select"
                                  value={selectedXmlChunkSequence}
                                  onChange={(event) => setSelectedXmlChunkSequence(Number(event.target.value))}
                                >
                                  {Array.from({ length: selectedBulkChunkCount }, (_, index) => index + 1).map((sequence) => (
                                    <option key={sequence} value={sequence}>
                                      Chunk {sequence} of {selectedBulkChunkCount}
                                    </option>
                                  ))}
                                </select>
                                <p className="panel-copy">
                                  {selectedBulkPreview
                                    ? `Selected file: ${selectedBulkPreview.selected_chunk_file_name} · ${selectedBulkPreview.selected_chunk_record_count} rows`
                                    : "Generate a preview to inspect the selected chunk."}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="validation-pill-row bulk-patch-pill-row">
                            <span className="status-pill ok compact bulk-patch-status-pill">
                              Schema target: Message.xsd
                            </span>
                            <span
                              className={
                                selectedBatchValidation?.valid
                                  ? "status-pill ok compact bulk-patch-status-pill"
                                  : "status-pill warn compact bulk-patch-status-pill"
                              }
                            >
                              Validation output:{" "}
                              {selectedBatchValidation
                                ? selectedBatchValidation.valid
                                  ? "Schema valid"
                                  : "Schema invalid"
                                : "Awaiting preview"}
                            </span>
                          </div>
                        </>
                      ) : xmlMode === "bulkUdidiPost" ? (
                        <>
                          <div className="bulk-patch-layout">
                            <div className="bulk-patch-config-column">
                              <div className="draft-card">
                                <div className="draft-card-head">
                                  <strong>1. Confirm existing parent</strong>
                                  <span className="status-pill ok compact">
                                    {selectedBulkEligibleUdidiPostCount} available
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  Confirm child scope under an existing Basic UDI-DI parent.
                                </p>
                                <label className="field-label" htmlFor="xml-bulk-udidi-post-count">
                                  Eligible Device UDI-DIs
                                </label>
                                <div className="bulk-parent-chip-row">
                                  <span className="bulk-parent-chip active">
                                    {selectedBulkEligibleUdidiPostCount} eligible device{selectedBulkEligibleUdidiPostCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </div>

                              <div className="draft-card">
                                <div className="draft-card-head">
                                  <strong>2. Choose record count</strong>
                                  <span className="status-pill ok compact">
                                    {selectedBulkRecordCount} selected
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  Determine scope of this POST.
                                </p>
                                <label className="field-label" htmlFor="xml-bulk-record-count">
                                  Number of devices
                                </label>
                                <select
                                  id="xml-bulk-record-count"
                                  className="rule-select"
                                  value={selectedBulkRecordCount}
                                  onChange={(event) => {
                                    setSelectedBulkRecordCount(Number(event.target.value));
                                    setSelectedXmlChunkSequence(1);
                                  }}
                                >
                                  {Array.from(
                                    { length: Math.max(Math.min(selectedBulkCapacity, 300), 1) },
                                    (_, index) => index + 1,
                                  ).map((count) => (
                                    <option key={count} value={count}>
                                      {count} device{count === 1 ? "" : "s"}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="draft-card">
                                <div className="draft-card-head">
                                  <strong>3. Prepare output</strong>
                                  <span className="status-pill ok compact">
                                    Chunk {selectedXmlChunkSequence} of {selectedBulkChunkCount}
                                  </span>
                                </div>
                                <p className="panel-copy">
                                  Select preview output for your chosen scope.
                                </p>
                                <label className="field-label" htmlFor="xml-batch-chunk-sequence">
                                  Preview chunk
                                </label>
                                <select
                                  id="xml-batch-chunk-sequence"
                                  className="rule-select"
                                  value={selectedXmlChunkSequence}
                                  onChange={(event) => setSelectedXmlChunkSequence(Number(event.target.value))}
                                >
                                  {Array.from({ length: selectedBulkChunkCount }, (_, index) => index + 1).map((sequence) => (
                                    <option key={sequence} value={sequence}>
                                      Chunk {sequence} of {selectedBulkChunkCount}
                                    </option>
                                  ))}
                                </select>
                                <p className="panel-copy">
                                  {selectedBulkPreview
                                    ? `Selected file: ${selectedBulkPreview.selected_chunk_file_name} · ${selectedBulkPreview.selected_chunk_record_count} rows`
                                    : "Generate a preview to inspect the selected chunk."}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="validation-pill-row bulk-patch-pill-row">
                            <span className="status-pill ok compact bulk-patch-status-pill">
                              Schema target: Message.xsd
                            </span>
                            <span
                              className={
                                selectedBatchValidation?.valid
                                  ? "status-pill ok compact bulk-patch-status-pill"
                                  : "status-pill warn compact bulk-patch-status-pill"
                              }
                            >
                              Validation output:{" "}
                              {selectedBatchValidation
                                ? selectedBatchValidation.valid
                                  ? "Schema valid"
                                  : "Schema invalid"
                                : "Awaiting preview"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="field-label" htmlFor="xml-bulk-record-count">
                            Record count
                          </label>
                          <select
                            id="xml-bulk-record-count"
                            className="rule-select"
                            value={selectedBulkRecordCount}
                            onChange={(event) => {
                              setSelectedBulkRecordCount(Number(event.target.value));
                              setSelectedXmlChunkSequence(1);
                            }}
                          >
                            {Array.from(
                              { length: Math.max(Math.min(selectedBulkCapacity, 300), 1) },
                              (_, index) => index + 1,
                            ).map((count) => (
                              <option key={count} value={count}>
                                {count} record{count === 1 ? "" : "s"}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      {xmlMode !== "bulkPost" && xmlMode !== "bulkUdidiPost" ? (
                        <>
                          <label className="field-label" htmlFor="xml-batch-chunk-sequence">
                            Preview chunk
                          </label>
                          <select
                            id="xml-batch-chunk-sequence"
                            className="rule-select"
                            value={selectedXmlChunkSequence}
                            onChange={(event) => setSelectedXmlChunkSequence(Number(event.target.value))}
                          >
                            {Array.from({ length: selectedBulkChunkCount }, (_, index) => index + 1).map((sequence) => (
                              <option key={sequence} value={sequence}>
                                Chunk {sequence} of {selectedBulkChunkCount}
                              </option>
                            ))}
                          </select>
                          {selectedBulkPreview ? (
                            <>
                              <p className="panel-copy">
                                Included {selectedBulkPreview.included_record_count} record{selectedBulkPreview.included_record_count === 1 ? "" : "s"}.
                                Excluded {selectedBulkPreview.excluded_record_count}.
                              </p>
                              <p className="panel-copy">
                                Selected file: {selectedBulkPreview.selected_chunk_file_name} · {selectedBulkPreview.selected_chunk_record_count} rows
                              </p>
                            </>
                          ) : !selectedBulkCapacity ? (
                            <p className="panel-copy">
                              No eligible Device UDI-DI registrations are available for this variant, so Bulk UDI-DI POST cannot be generated here.
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="panel-copy">No XML-ready bulk scope is currently available for the selected family and variant.</p>
                )}
                {xmlMode !== "bulkPatch" && xmlMode !== "bulkPost" && xmlMode !== "bulkUdidiPost" ? (
                  <div className="workflow-note">
                      <strong>
                        {xmlMode === "post"
                          ? "POST review"
                          : xmlMode === "single"
                            ? "Single-record review"
                            : xmlMode === "marketInfo"
                              ? "Standalone market-info review"
                              : xmlMode === "patch"
                                ? "Scenario PATCH review"
                                : "Bulk UDI-DI POST scope"}
                    </strong>
                    <span>
                      {xmlMode === "post"
                        ? "Use one current POST-classified device to confirm the accepted registration payload before generating PATCH scenarios."
                        : xmlMode === "single"
                          ? "Use the auto-selected sample row to confirm payload shape and schema validity before reviewing batch output."
                          : xmlMode === "marketInfo"
                            ? "Use one XML-ready record to inspect the standalone MARKET_INFO.PUT wrapper and its current marketInfos collection."
                            : xmlMode === "patch"
                              ? "Use one selected POST parent, then compare the derived scenario PATCH against the accepted POST or latest accepted PATCH before external EUDAMED testing."
                                : "Bulk UDI-DI POST emits standalone Device UDI-DI registrations and assumes the referenced Basic UDI-DI has already been accepted."}
                    </span>
                  </div>
                ) : null}
                <div className={xmlMode === "bulkPatch" || xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" ? "draft-list xml-validation-stack bulk-patch-validation-stack" : "draft-list xml-validation-stack"}>
                  {xmlMode !== "bulkPatch" && xmlMode !== "bulkPost" && xmlMode !== "bulkUdidiPost" ? (
                    <>
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
                          <strong>{xmlMode === "post" ? "Active preview validation" : "Validation output"}</strong>
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
                                {xmlMode === "post"
                                  ? "The generated POST preview validates cleanly."
                                  : xmlMode === "single"
                                    ? "The generated single-record Push message validates cleanly."
                                    : xmlMode === "marketInfo"
                                    ? "The generated MARKET_INFO.PUT Push message validates cleanly."
                                    : xmlMode === "patch"
                                        ? `The generated ${patchPreviewView === "base" ? "base" : "derived"} PATCH preview validates cleanly against the local schema set.`
                                      : xmlMode === "bulkUdidiPost"
                                          ? "The generated bulk UDI-DI POST Push message validates cleanly."
                                        : "The generated bulk PATCH Push message validates cleanly."}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="panel-copy">
                            {xmlMode === "post"
                              ? "Generate a POST preview to inspect the schema validation outcome."
                              : xmlMode === "single"
                                ? "Generate a single-record preview to inspect the schema validation outcome."
                                : xmlMode === "marketInfo"
                                  ? "Generate a MARKET_INFO.PUT preview to inspect the schema validation outcome."
                                  : xmlMode === "patch"
                                    ? "Generate the baseline and derived PATCH previews to inspect their schema validation outcomes."
                                  : xmlMode === "bulkUdidiPost"
                                      ? "Generate a bulk UDI-DI POST preview to inspect the schema validation outcome."
                                    : "Generate a bulk PATCH preview to inspect the schema validation outcome."}
                          </p>
                        )}
                      </div>
                    </>
                  ) : null}
                  {xmlMode === "patch" && xmlPatchPreview ? (
                    <>
                      <div className="draft-card">
                        <div className="draft-card-head">
                          <strong>Base message validation</strong>
                          <span className={xmlPatchPreview.base_validation.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            {xmlPatchPreview.base_validation.valid ? "Schema valid" : "Schema invalid"}
                          </span>
                        </div>
                        <p className="panel-copy">{xmlPatchPreview.base_validation.schema_path}</p>
                      </div>
                      <div className="draft-card">
                        <div className="draft-card-head">
                          <strong>Derived PATCH validation</strong>
                          <span className={xmlPatchPreview.derived_patch_validation.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                            {xmlPatchPreview.derived_patch_validation.valid ? "Schema valid" : "Schema invalid"}
                          </span>
                        </div>
                        <p className="panel-copy">{xmlPatchPreview.derived_patch_validation.schema_path}</p>
                      </div>
                    </>
                  ) : null}
                  {xmlMode === "post" ? (
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>POST validation</strong>
                        <span className={pairPostValidation?.valid ? "status-pill ok compact" : "status-pill warn compact"}>
                          {pairPostValidation ? (pairPostValidation.valid ? "Schema valid" : "Schema invalid") : "Awaiting preview"}
                        </span>
                      </div>
                      <p className="panel-copy">{pairPostValidation?.schema_path ?? "Generate a POST preview to validate the XML."}</p>
                    </div>
                  ) : null}
                  {(xmlMode === "bulkPost" || xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch") && selectedBulkPreview ? (
                    <div className="draft-card">
                      <div className="draft-card-head">
                        <strong>{xmlMode === "bulkPost" ? "Bulk Basic UDI POST chunk summary" : xmlMode === "bulkUdidiPost" ? "Bulk UDI-DI POST chunk summary" : "Bulk PATCH chunk summary"}</strong>
                        <span className="status-pill ok compact">
                          {selectedBulkPreview.chunk_count} chunk{selectedBulkPreview.chunk_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="panel-copy">
                        Selected file: {selectedBulkPreview.selected_chunk_file_name} · {selectedBulkPreview.selected_chunk_record_count} rows
                      </p>
                      <p className="panel-copy">
                        Included {selectedBulkPreview.included_record_count} · Excluded {selectedBulkPreview.excluded_record_count}
                      </p>
                      <div className="roadmap-list">
                        {selectedBulkPreview.chunks.slice(0, 6).map((chunk) => (
                          <div className="roadmap-item" key={chunk.file_name}>
                            <strong>{chunk.file_name}</strong>
                            <p>
                              {chunk.record_count} rows · {chunk.first_catalogue_number ?? "?"} to {chunk.last_catalogue_number ?? "?"}
                            </p>
                          </div>
                        ))}
                      </div>
                      {selectedBulkExclusionSummaries.length ? (
                        <div className="roadmap-list">
                          {selectedBulkExclusionSummaries.map((summary) => (
                            <div className="roadmap-item" key={summary.key}>
                              <strong>{summary.title}</strong>
                              <p>{summary.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </section>
        )
      ) : null}

      {activeTab === "generation" ? (
        isLoadingCanonicalValidation ? (
          renderLoadingPanel(
            "Loading accepted generation workspace",
            "Preparing validated device records required for accepted EUDAMED generation.",
          )
        ) : (
          <section className="tab-stack">
            <section className="summary-grid">
              <div className="summary-card">
                <span className="summary-label">Accepted XML patterns</span>
                <strong>{acceptedXmlModes.length}</strong>
                <p>Only user-confirmed EUDAMED accepted patterns appear in this workspace.</p>
              </div>
              <div className="summary-card">
                <span className="summary-label">Current accepted mode</span>
                <strong>POST</strong>
                <p>The accepted baseline POST remains the operationally enabled XML generation path.</p>
              </div>
              <div className="summary-card">
                <span className="summary-label">Candidate PATCH scenarios</span>
                <strong>{PATCH_SCENARIOS.length}</strong>
                <p>Candidate PATCH scenarios remain available in EUDAMED Testing until promoted.</p>
              </div>
              <div className="summary-card">
                <span className="summary-label">Validation-ready rows</span>
                <strong>{xmlReadyRecords.length}</strong>
                <p>Accepted generation is still downstream of canonical validation.</p>
              </div>
            </section>

            <section className="panel xml-full-workspace-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Accepted XML Only</span>
                  <h2>EUDAMED Generation Workspace</h2>
                </div>
              </div>
              <p className="panel-copy">
                Only `EUDAMED Accepted` XML patterns are available here. Use `EUDAMED Testing` to review and promote candidate patterns.
              </p>
              <div className="draft-list xml-record-stack">
                {acceptedXmlModes.map((mode) => (
                  <div className="draft-card xml-record-card" key={mode.id}>
                    <div className="draft-card-head">
                      <strong>{mode.label}</strong>
                      <span className="status-pill ok compact">{mode.status}</span>
                    </div>
                    <p className="panel-copy">{mode.summary}</p>
                  </div>
                ))}
              </div>
              {selectedXmlPairRecord ? (
                <div className="xml-focus-layout">
                  <div className="xml-preview-surface">
                    <div className="section-heading xml-preview-heading">
                      <div>
                        <span className="section-kicker">Accepted Preview</span>
                        <h2>POST</h2>
                      </div>
                    </div>
                    <pre className="xml-preview-block">
                      <code>
                        {xmlPairPreview
                          ? xmlPairPreview.post_xml
                          : [
                              "<!-- Generate the accepted POST preview -->",
                              `<catalogue-number>${selectedXmlPairRecord.catalogue_number ?? "PENDING"}</catalogue-number>`,
                            ].join("\n")}
                      </code>
                    </pre>
                  </div>
                  <div className="xml-sidebar-surface">
                    <div className="draft-actions-bar xml-actions-bar">
                      <button className="action-button" type="button" onClick={() => void generateXmlPreview()} disabled={!selectedXmlPairRecord || isGeneratingXml}>
                        {isGeneratingXml ? "Generating..." : "Generate Accepted POST"}
                      </button>
                      <button className="ghost-button" type="button" onClick={() => void generateXmlPreview()} disabled={!selectedXmlPairRecord || isGeneratingXml}>
                        Validate Against XSD
                      </button>
                      <button className="ghost-button" type="button" onClick={() => void downloadXmlRecord()} disabled={!selectedXmlPairRecord || isGeneratingXml}>
                        Download POST Package
                      </button>
                      {xmlActionMessage ? <span className="save-message">{xmlActionMessage}</span> : null}
                    </div>
                    <div className="draft-list xml-record-stack">
                      <div className="draft-card xml-record-card">
                        <div className="draft-card-head">
                          <strong>{selectedXmlPairRecord.catalogue_number}</strong>
                          <span className="status-pill ok compact">EUDAMED Accepted</span>
                        </div>
                        <p className="draft-meta">
                          {selectedXmlPairRecord.product_family} / {selectedXmlPairRecord.product_variant}
                        </p>
                        <p className="panel-copy">
                          Generate only the accepted baseline `POST` in this workspace.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="panel-copy">No XML-ready POST record is currently available for accepted `POST` generation for the selected family and variant.</p>
              )}
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
  function resolveDefaultPatchScenarioId(latestScenarioId: string | null | undefined): PatchScenarioId {
    if (!latestScenarioId) {
      return "equivalent_first_patch";
    }
    const matchedScenario = PATCH_SCENARIOS.find((scenario) => scenario.id === latestScenarioId);
    return matchedScenario ? matchedScenario.id : "equivalent_first_patch";
  }
