import { matchesModelSearch } from "./modelSearch";
import { DeviceModelFilter, mergeModelOptions } from "./components/DeviceModelFilter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBulkPostedCohorts } from "./useBulkPostedCohorts";

import { ApiError, api, type RecordReadiness } from "./api";
import architectureDefinitionDocumentation from "../../docs/architecture-definition-draft.md?raw";
import sessionHandoffDocumentation from "../../docs/session-handoff.md?raw";
import architecturePositionDocumentation from "./content/docs/architecture-position.md?raw";
import { BulkMarketInfoWorkspace } from "./components/BulkMarketInfoWorkspace";
import { BulkMarketInfoPreviewPanel } from "./components/BulkMarketInfoPreviewPanel";
import { BulkPatchWorkspace } from "./components/BulkPatchWorkspace";
import { BulkPostWorkspace } from "./components/BulkPostWorkspace";
import { BulkXmlPreviewPanel } from "./components/BulkXmlPreviewPanel";
import { MarketInfoPreviewPanel } from "./components/MarketInfoPreviewPanel";
import { MarketInfoScenarioCard } from "./components/MarketInfoScenarioCard";
import canonicalValidationDocumentation from "./content/docs/canonical-validation.md?raw";
import { PatchPreviewPanel } from "./components/PatchPreviewPanel";
import { PatchScenarioCard } from "./components/PatchScenarioCard";
import { PostPreviewPanel } from "./components/PostPreviewPanel";
import { RegistrationStateWorkspace } from "./components/RegistrationStateWorkspace";
import { SubmissionBatchHistory } from "./components/SubmissionBatchHistory";
import { TestingSummaryWorkspace } from "./components/TestingSummaryWorkspace";
import { XmlOperationAssessmentPanel } from "./components/XmlOperationAssessmentPanel";
import { EnvironmentBanner } from "./components/EnvironmentBanner";
import { DeviceModelSelector } from "./components/DeviceModelSelector";
import { XmlValidationStack } from "./components/XmlValidationStack";
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
import { resolveMarketCountryCode } from "./marketCountryReference";
import { buildBulkPatchBaselineSummary } from "./bulkPatchBaselineSummary";
import { usePatchScenarioState } from "./usePatchScenarioState";
import { useBulkScopeState } from "./useBulkScopeState";
import { useXmlOperationAssessment } from "./useXmlOperationAssessment";
import { useXmlPreviewGeneration } from "./useXmlPreviewGeneration";
import { useXmlPreviewState } from "./useXmlPreviewState";
import { useXmlWorkspaceState } from "./useXmlWorkspaceState";
import { buildPatchScenarioInputs, resolveBulkCatalogueNumbers } from "./xmlActionInputs";
import { useSuccessXmlUpload } from "./useSuccessXmlUpload";
import {
  assessmentEvidenceBoolean,
  assessmentEvidenceNumber,
  assessmentEvidenceString,
  assessmentEvidenceStringArray,
  operationAssessmentStatusClass,
  operationAssessmentStatusLabel,
} from "./xmlOperationAssessmentView";
import {
  basicUdiDiForRecord,
  buildCurrentMarketInfoItemsForCatalogue,
  buildMarketInfoScenarioItems,
  buildSelectionAnchor,
  createMarketInfoScenarioId,
  fieldValue,
  parseBooleanString,
  parseCatalogueNumberList,
} from "./xmlMarketInfoState";
import { extractXmlStructureSections } from "./xmlPreviewStructure";
import {
  resolveBulkChunkSummaryTitle,
  resolveGenericPreviewStatusMessage,
  resolveGenericPreviewTitle,
  resolveSelectedBatchValidation,
  resolveSelectedBulkChunkCount,
  resolveSelectedBulkPreview,
  resolveXmlAssessmentSummaryRows,
  resolveXmlModeUi,
  resolveXmlPreviewLines,
} from "./xmlWorkspaceView";
import type {
  BulkPatchPreview,
  BulkMarketInfoPreview,
  BulkUdidiPostPreview,
  CanonicalValidationBundle,
  CanonicalReviewBundle,
  CriticalWarningCodeOption,
  DatabaseHealthSummary,
  DatabaseSchemaSummary,
  DeviceSubjectSummary,
  ImportedWorkbookSummary,
  MarketCountryReferenceEntry,
  TestingSubjectReadModelSummary,
  TestingEventReadModelEntry,
  TestingWorkspaceSummary,
  WorkbookImportSnapshotSummary,
} from "./types";
import {
  findRecordByCatalogueNumber,
  resolveMarketInfoRequestArgs,
  resolvePatchRequestArgs,
  resolvePatchWorkspaceRecord,
  resolvePostWorkspaceRecord,
} from "./xmlWorkspace";

type MainTab = "workbooks" | "canonicalValidation" | "xml" | "registrationState" | "testingSummary" | "documentation";
type SubmissionDataTab = "activity" | "snapshot";
type EudamedStatus = "EUDAMED Candidate" | "EUDAMED Accepted";
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

type BulkPreviewMode = "bulkUdidiPost" | "bulkPatch" | "bulkMarketInfo";
type ValidationReviewTab = "canonicalMapping" | "sourceSheetBasicUdi";

type BulkExclusionSummary = {
  key: string;
  title: string;
  detail: string;
};

function normalizeFamilyValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function familyLabelVariants(value: string | null | undefined): string[] {
  const raw = value ?? "";
  const parts = raw
    .split("/")
    .map((part) => normalizeFamilyValue(part))
    .filter(Boolean);
  const variants = new Set<string>();
  const full = normalizeFamilyValue(raw);
  if (full) {
    variants.add(full);
  }
  parts.forEach((part) => variants.add(part));
  return Array.from(variants);
}

function familyLabelsOverlap(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftVariants = familyLabelVariants(left);
  const rightVariants = familyLabelVariants(right);
  return leftVariants.some((variant) => rightVariants.includes(variant));
}

function resolveTestingSummaryLatestOperationLabel(subjects: TestingSubjectReadModelSummary[]): string {
  const latestSubject = subjects.reduce<TestingSubjectReadModelSummary | null>((currentLatest, candidate) => {
    if (!currentLatest) {
      return candidate;
    }
    const currentTimestamp = currentLatest.latest_tested_at ?? "";
    const candidateTimestamp = candidate.latest_tested_at ?? "";
    if (candidateTimestamp > currentTimestamp) {
      return candidate;
    }
    if (candidateTimestamp < currentTimestamp) {
      return currentLatest;
    }
    return Number(candidate.id) > Number(currentLatest.id) ? candidate : currentLatest;
  }, null);
  if (!latestSubject) {
    return "No success";
  }
  if (latestSubject.latest_success_message_type === "MARKET_INFO.PUT") {
    return latestSubject.latest_successful_market_info_version
      ? `Market Info · market v${latestSubject.latest_successful_market_info_version}`
      : "Market Info";
  }
  if (latestSubject.latest_success_message_type === "UDI_DI.PATCH") {
    return latestSubject.latest_successful_version ? `PATCH · v${latestSubject.latest_successful_version}` : "PATCH";
  }
  if (latestSubject.latest_success_message_type === "DEVICE.POST") {
    return "Parent POST · v1";
  }
  if (latestSubject.latest_success_message_type === "UDI_DI.POST") {
    return "Child POST · v1";
  }
  if (latestSubject.latest_successful_version) {
    return `v${latestSubject.latest_successful_version}`;
  }
  return "Recorded";
}

function resolveTestingSummaryLatestPatchLabel(subjects: TestingSubjectReadModelSummary[]): string {
  const latestPatchVersion = subjects.reduce((max, subject) => {
    const versionNumber = Number(subject.latest_successful_version ?? "0");
    return Number.isFinite(versionNumber) && versionNumber > max ? versionNumber : max;
  }, 0);
  return latestPatchVersion > 0 ? `v${latestPatchVersion}` : "v-";
}

function resolveTestingSummaryLatestMarketInfoLabel(subjects: TestingSubjectReadModelSummary[]): string {
  const latestMarketInfoVersion = subjects.reduce((max, subject) => {
    const versionNumber = Number(subject.latest_successful_market_info_version ?? "0");
    return Number.isFinite(versionNumber) && versionNumber > max ? versionNumber : max;
  }, 0);
  if (latestMarketInfoVersion > 0) {
    return `market v${latestMarketInfoVersion}`;
  }
  return subjects.some((subject) => subject.latest_success_message_type === "MARKET_INFO.PUT") ? "Recorded" : "v-";
}

function resolveTestingEventOperationLabel(event: TestingEventReadModelEntry): string {
  if (event.message_type === "DEVICE.POST") {
    return "Basic UDI-DI POST";
  }
  if (event.message_type === "UDI_DI.POST") {
    return "Device UDI-DI POST";
  }
  if (event.message_type === "UDI_DI.PATCH") {
    return "PATCH";
  }
  if (event.message_type === "MARKET_INFO.PUT") {
    return "Market Info";
  }
  return event.message_type ?? "Recorded";
}

function resolveTestingEventVersionLabel(event: TestingEventReadModelEntry): string {
  if (event.message_type === "MARKET_INFO.PUT") {
    return event.version ? `market v${event.version}` : "Recorded";
  }
  return event.version ? `v${event.version}` : "v1";
}

function resolveNextIncrementalVersion(value: string | null | undefined, fallback = "1"): string {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return String(Math.trunc(parsed) + 1);
}

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

function summarizeBulkExcludedRecords(
  mode: BulkPreviewMode,
  preview: BulkUdidiPostPreview | BulkPatchPreview | BulkMarketInfoPreview,
): BulkExclusionSummary[] {
  const familyVariantLabel = `${preview.product_family} / ${preview.product_variant}`;
  const excludedRecords = preview.excluded_records;
  if (!excludedRecords.length) {
    return [];
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
    key: `bulk-generic-${index}`,
    title: pluralize(count, "record"),
    detail: `${pluralize(count, "record")} in ${familyVariantLabel} ${count === 1 ? "was" : "were"} excluded from ${
      mode === "bulkPatch" ? "Bulk PATCH" : "Bulk Market Info"
    }: ${reasonMessage}`,
  }));
}

type DocumentationSection = {
  id:
    | "architectureDefinition"
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
    | "sessionHandoff"
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

export function App() {
  const [recordReadiness, setRecordReadiness] = useState<RecordReadiness[]>([]);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(true);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("workbooks");
  const [submissionDataTab, setSubmissionDataTab] = useState<SubmissionDataTab>("snapshot");
  const [activeDocumentationSection, setActiveDocumentationSection] = useState<
    DocumentationSection["id"]
  >("projectStructure");
  const [latestWorkbookImportSummary, setLatestWorkbookImportSummary] = useState<WorkbookImportSnapshotSummary | null>(null);
  const [databaseSchemaSummary, setDatabaseSchemaSummary] = useState<DatabaseSchemaSummary | null>(null);
  const [databaseHealthSummary, setDatabaseHealthSummary] = useState<DatabaseHealthSummary | null>(null);
  const [deviceSubjects, setDeviceSubjects] = useState<DeviceSubjectSummary[]>([]);
  const workbookImportMonitoringRequestRef = useRef<number>(0);
  const [workbookImportSummaryError, setWorkbookImportSummaryError] = useState<string | null>(null);
  const [hasWorkbookImportSnapshot, setHasWorkbookImportSnapshot] = useState<boolean>(false);
  const [isLoadingWorkbookImportMonitoring, setIsLoadingWorkbookImportMonitoring] = useState<boolean>(true);
  const [isRunningWorkbookImport, setIsRunningWorkbookImport] = useState<boolean>(false);
  const [workbookImportActionMessage, setWorkbookImportActionMessage] = useState<string | null>(null);
  const [canonicalReview, setCanonicalReview] = useState<CanonicalReviewBundle | null>(null);
  const [canonicalValidation, setCanonicalValidation] = useState<CanonicalValidationBundle | null>(null);
  const [selectedValidationRecordKey, setSelectedValidationRecordKey] = useState<string | null>(null);
  const [validationModelSearch, setValidationModelSearch] = useState("");
  const [selectedValidationFamily, setSelectedValidationFamily] = useState<string>("");
  const [selectedValidationVariant, setSelectedValidationVariant] = useState<string>("");
  const [selectedValidationReviewTab, setSelectedValidationReviewTab] = useState<ValidationReviewTab>("sourceSheetBasicUdi");
  const [selectedDeviceSubjectFamily, setSelectedDeviceSubjectFamily] = useState<string>("");
  const [selectedDeviceSubjectVariant, setSelectedDeviceSubjectVariant] = useState<string>("");
  const [selectedXmlFamily, setSelectedXmlFamily] = useState<string | null>(null);
  const [selectedXmlVariant, setSelectedXmlVariant] = useState<string | null>(null);
  const [selectedRegistrationStateFamily, setSelectedRegistrationStateFamily] = useState<string>("");
  const [selectedRegistrationStateVariant, setSelectedRegistrationStateVariant] = useState<string>("");
  const [selectedRegistrationStateStatus, setSelectedRegistrationStateStatus] = useState<string>("");
  const [registrationStateSearch, setRegistrationStateSearch] = useState<string>("");
  const [registrationStateActionableOnly, setRegistrationStateActionableOnly] = useState<boolean>(false);
  const [testingSummarySearch, setTestingSummarySearch] = useState("");
  const [selectedTestingSummaryFamily, setSelectedTestingSummaryFamily] = useState<string>("");
  const [selectedTestingSummaryVariant, setSelectedTestingSummaryVariant] = useState<string>("");
  const [testingSubjectSummaries, setTestingSubjectSummaries] = useState<TestingSubjectReadModelSummary[]>([]);
  const [testingSummaryWorkspaceSummary, setTestingSummaryWorkspaceSummary] = useState<TestingWorkspaceSummary | null>(null);
  const [testingSummarySubjectSummaries, setTestingSummarySubjectSummaries] = useState<TestingSubjectReadModelSummary[]>([]);
  const [testingSummaryEvents, setTestingSummaryEvents] = useState<TestingEventReadModelEntry[]>([]);
  const [marketCountryReference, setMarketCountryReference] = useState<MarketCountryReferenceEntry[]>([]);
  const [isLoadingTestingSubjectSummaries, setIsLoadingTestingSubjectSummaries] = useState<boolean>(false);
  const [showMarketInfoRefreshState, setShowMarketInfoRefreshState] = useState<boolean>(false);
  const [isLoadingTestingSummary, setIsLoadingTestingSummary] = useState<boolean>(false);
  const [testingSummaryError, setTestingSummaryError] = useState<string | null>(null);
  const [patchScenarioStatuses] = useState<Record<PatchScenarioId, EudamedStatus>>({
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
  const {
    xmlMode,
    setXmlMode,
    selectedXmlRecordKey,
    setSelectedXmlRecordKey,
    selectedBulkPatchBasicUdiDi,
    setSelectedBulkPatchBasicUdiDi,
    selectedBulkMarketInfoBasicUdiDi,
    setSelectedBulkMarketInfoBasicUdiDi,
    selectedXmlChunkSequence,
    setSelectedXmlChunkSequence,
    selectedBulkRecordCount,
    setSelectedBulkRecordCount,
    selectedPatchScenarioId,
    setSelectedPatchScenarioId,
    marketInfoVersionInput,
    setMarketInfoVersionInput,
    marketInfoScenarioItems,
    setMarketInfoScenarioItems,
    bulkMarketInfoScenarioItems,
    setBulkMarketInfoScenarioItems,
    xmlActionMessage,
    setXmlActionMessage,
    isGeneratingXml,
    setIsGeneratingXml,
    isDownloadingXml,
    setIsDownloadingXml,
  } = useXmlWorkspaceState<PatchScenarioId>("equivalent_first_patch");
  const {
    patch: {
      scopeMode: bulkPatchScopeMode,
      setScopeMode: setBulkPatchScopeMode,
      catalogueNumbers: selectedBulkPatchCatalogueNumbers,
      setCatalogueNumbers: setSelectedBulkPatchCatalogueNumbers,
      catalogueFilter: bulkPatchCatalogueFilter,
      setCatalogueFilter: setBulkPatchCatalogueFilter,
      importText: bulkPatchImportText,
      setImportText: setBulkPatchImportText,
    },
    marketInfo: {
      scopeMode: bulkMarketInfoScopeMode,
      setScopeMode: setBulkMarketInfoScopeMode,
      catalogueNumbers: selectedBulkMarketInfoCatalogueNumbers,
      setCatalogueNumbers: setSelectedBulkMarketInfoCatalogueNumbers,
      catalogueFilter: bulkMarketInfoCatalogueFilter,
      setCatalogueFilter: setBulkMarketInfoCatalogueFilter,
      importText: bulkMarketInfoImportText,
      setImportText: setBulkMarketInfoImportText,
    },
    udidiPost: {
      scopeMode: bulkUdidiPostScopeMode,
      setScopeMode: setBulkUdidiPostScopeMode,
      catalogueNumbers: selectedBulkUdidiPostCatalogueNumbers,
      setCatalogueNumbers: setSelectedBulkUdidiPostCatalogueNumbers,
      catalogueFilter: bulkUdidiPostCatalogueFilter,
      setCatalogueFilter: setBulkUdidiPostCatalogueFilter,
      importText: bulkUdidiPostImportText,
      setImportText: setBulkUdidiPostImportText,
    },
  } = useBulkScopeState();
  const [error, setError] = useState<string | null>(null);
  const [criticalWarningCodeOptions, setCriticalWarningCodeOptions] = useState<CriticalWarningCodeOption[]>([]);
  const {
    xmlBulkUdidiPostPreview,
    setXmlBulkUdidiPostPreview,
    xmlPairPreview,
    setXmlPairPreview,
    xmlMarketInfoPreview,
    setXmlMarketInfoPreview,
    xmlPatchPreview,
    setXmlPatchPreview,
    xmlBulkPatchPreview,
    setXmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
    setXmlBulkMarketInfoPreview,
    selectedPostXmlSectionId,
    setSelectedPostXmlSectionId,
    selectedMarketInfoXmlSectionId,
    setSelectedMarketInfoXmlSectionId,
    selectedBulkXmlSectionId,
    setSelectedBulkXmlSectionId,
    selectedBulkMarketInfoXmlSectionId,
    setSelectedBulkMarketInfoXmlSectionId,
    selectedPatchXmlSectionId,
    setSelectedPatchXmlSectionId,
  } = useXmlPreviewState();
  const [isLoadingCanonicalReview, setIsLoadingCanonicalReview] = useState<boolean>(false);
  const [isLoadingCanonicalValidation, setIsLoadingCanonicalValidation] = useState<boolean>(false);
  const documentationSections: DocumentationSection[] = [
    {
      id: "projectStructure",
      title: "Project Overview",
      markdown: projectStructureDocumentation,
    },
    {
      id: "architectureDefinition",
      title: "Architecture Definition Draft",
      markdown: architectureDefinitionDocumentation,
    },
    {
      id: "sessionHandoff",
      title: "Session Handoff",
      markdown: sessionHandoffDocumentation,
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
      sectionIds: ["projectStructure", "architectureDefinition", "sessionHandoff", "architecturePosition", "roadmap"],
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
    setIsLoadingWorkbookImportMonitoring(true);
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
    setIsLoadingWorkbookImportMonitoring(false);
  }

  async function runWorkbookImportFromUi(): Promise<void> {
    setIsRunningWorkbookImport(true);
    setWorkbookImportActionMessage(null);
    setError(null);
    try {
      await api.runWorkbookImport({
        imported_by: "ui",
        label: `UI import ${new Date().toISOString()}`,
      });
      await loadWorkbookImportMonitoring();
      await loadCanonicalValidationBundle(true);
      setWorkbookImportActionMessage(null);
    } catch (requestError) {
      setWorkbookImportActionMessage(null);
      setError(requestError instanceof Error ? requestError.message : "Failed to run workbook import.");
    } finally {
      setIsRunningWorkbookImport(false);
    }
  }

  useEffect(() => {
    void Promise.all([
      loadWorkbookImportMonitoring(),
      api.criticalWarningCodes(),
      api.marketCountryReference(),
    ])
      .then(([
        _workbookImportMonitoringLoaded,
        criticalWarningCodes,
        marketCountryReferenceData,
      ]) => {
        setCriticalWarningCodeOptions(criticalWarningCodes);
        setMarketCountryReference(marketCountryReferenceData);
      })
      .catch((requestError: Error) => setError(requestError.message));
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
        activeTab === "registrationState" ||
        activeTab === "testingSummary") &&
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
        activeTab === "registrationState" ||
        activeTab === "testingSummary") &&
      latestImportBatchId !== undefined &&
      canonicalValidation &&
      canonicalValidation.source_import_batch_id !== latestImportBatchId
    ) {
      void loadCanonicalValidationBundle(true);
    }
  }, [activeTab, latestWorkbookImportSummary, canonicalValidation]);

  useEffect(() => {
    const availableVariants = Array.from(
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
    );
    if (!selectedDeviceSubjectVariant) {
      return;
    }
    if (availableVariants.includes(selectedDeviceSubjectVariant)) {
      return;
    }
    setSelectedDeviceSubjectVariant("");
  }, [deviceSubjects, selectedDeviceSubjectFamily, selectedDeviceSubjectVariant]);

  useEffect(() => {
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
        (!selectedValidationVariant || record.product_variant === selectedValidationVariant) &&
        matchesModelSearch(validationModelSearch, record.product_family, record.product_variant, basicUdiDiForRecord(record)),
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
  }, [canonicalValidation, selectedValidationFamily, selectedValidationVariant, selectedValidationRecordKey, validationModelSearch]);

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
    if (!canonicalValidation?.family_summaries.length) {
      if (selectedTestingSummaryFamily) {
        setSelectedTestingSummaryFamily("");
      }
      return;
    }
    if (!selectedTestingSummaryFamily) {
      return;
    }
    if (canonicalValidation.family_summaries.some((summary) => summary.product_family === selectedTestingSummaryFamily)) {
      return;
    }
    setSelectedTestingSummaryFamily("");
  }, [canonicalValidation, selectedTestingSummaryFamily]);

  useEffect(() => {
    const availableVariants = (canonicalValidation?.variant_summaries ?? [])
      .filter((summary) => (selectedTestingSummaryFamily ? summary.product_family === selectedTestingSummaryFamily : false))
      .map((summary) => summary.product_variant);
    if (!selectedTestingSummaryVariant) {
      return;
    }
    if (availableVariants.includes(selectedTestingSummaryVariant)) {
      return;
    }
    setSelectedTestingSummaryVariant("");
  }, [canonicalValidation, selectedTestingSummaryFamily, selectedTestingSummaryVariant]);
  useEffect(() => {
    if (!canonicalValidation?.family_summaries.length) {
      if (selectedRegistrationStateFamily) {
        setSelectedRegistrationStateFamily("");
      }
      return;
    }
    if (!selectedRegistrationStateFamily) {
      return;
    }
    if (canonicalValidation.family_summaries.some((summary) => summary.product_family === selectedRegistrationStateFamily)) {
      return;
    }
    setSelectedRegistrationStateFamily("");
  }, [canonicalValidation, selectedRegistrationStateFamily]);
  useEffect(() => {
    const availableVariants = Array.from(
      new Set(
        (canonicalValidation?.variant_summaries ?? [])
          .filter((summary) => (selectedRegistrationStateFamily ? summary.product_family === selectedRegistrationStateFamily : false))
          .map((summary) => summary.product_variant),
      ),
    );
    if (!selectedRegistrationStateVariant) {
      return;
    }
    if (availableVariants.includes(selectedRegistrationStateVariant)) {
      return;
    }
    setSelectedRegistrationStateVariant("");
  }, [canonicalValidation, selectedRegistrationStateFamily, selectedRegistrationStateVariant]);

  const variantMappings = canonicalReview?.variant_mappings ?? [];
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
  const canonicalValidationRecords = canonicalValidation?.records ?? [];
  const validationFamilySummaries = canonicalValidation?.family_summaries ?? [];
  const validationVariantSummaries = canonicalValidation?.variant_summaries ?? [];
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
      (!selectedValidationVariant || record.product_variant === selectedValidationVariant) &&
        matchesModelSearch(validationModelSearch, record.product_family, record.product_variant, basicUdiDiForRecord(record)),
  );
  const sampleValidationRecords = selectedVariantRecords.slice(0, 8);
  const selectedValidationRecord =
    sampleValidationRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    selectedVariantRecords.find((record) => record.catalogue_number === selectedValidationRecordKey) ??
    sampleValidationRecords[0] ??
    selectedVariantRecords[0] ??
    null;
  const selectedValidationScopeRows = validationModelSearch.trim() ? selectedVariantRecords.length :
    selectedVariantSummary?.total_records ??
    selectedFamilySummary?.total_records ??
    canonicalValidation?.validation_subset_records ??
    0;
  const selectedValidationReadyRows = validationModelSearch.trim() ? selectedVariantRecords.filter(record => !record.blockers.length).length :
    selectedVariantSummary?.ready_records ??
    selectedFamilySummary?.ready_records ??
    canonicalValidation?.ready_records ??
    0;
  const selectedValidationBlockedRows = validationModelSearch.trim() ? selectedVariantRecords.filter(record => record.blockers.length > 0).length :
    selectedVariantSummary?.blocked_records ??
    selectedFamilySummary?.blocked_records ??
    canonicalValidation?.blocked_records ??
    0;
  const selectedValidationXmlReadyRows = validationModelSearch.trim() ? selectedVariantRecords.filter(record => !record.xml_blockers.length).length :
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
  const selectedStorageExample = selectedValidationRecord?.storage_condition_items[0] ?? null;
  const selectedWarningExample = selectedValidationRecord?.critical_warning_items[0] ?? null;
  const selectedMarketAvailabilityExample = selectedValidationRecord?.market_availability_items[0] ?? null;
  const selectedOpenBlockerPreview = selectedValidationRecord?.blockers.slice(0, 3) ?? [];
  const selectedXmlBlockerPreview = selectedValidationRecord?.xml_blockers.slice(0, 3) ?? [];
  const canonicalMappingRowLookup = new Map(canonicalMappingRows.map((row) => [row.canonicalPath, row]));
  const selectedValidationMappingRows = (selectedValidationRecord?.fields ?? []).map((field) => ({
    field,
    review: canonicalMappingRowLookup.get(field.canonical_path) ?? null,
  }));
  const latestImportBatch = latestWorkbookImportSummary?.import_batch ?? null;
  const importedWorkbooks = latestWorkbookImportSummary?.imported_workbooks ?? [];
  const importTableCounts = latestWorkbookImportSummary?.table_counts ?? [];
  const importOperationCounts = latestWorkbookImportSummary?.operation_counts ?? [];
  const canonicalProjectionStatus = latestWorkbookImportSummary?.canonical_projection_status ?? "missing";
  const mergedSourceRowCount = latestWorkbookImportSummary?.merged_source_row_count ?? 0;
  const distinctSubjectCount = latestImportBatch?.device_subject_count ?? 0;
  const workbookDuplicateRowCount = latestWorkbookImportSummary?.workbook_duplicate_row_count ?? 0;
  const workbookDuplicateGroupCount = latestWorkbookImportSummary?.workbook_duplicate_group_count ?? 0;
  const unresolvedIdentityRowCount = latestWorkbookImportSummary?.unresolved_identity_row_count ?? 0;
  const sourceRowTableCount = latestImportBatch?.source_row_count ?? 0;
  const deviceSubjectTableCount = latestImportBatch?.device_subject_count ?? 0;
  const filteredDeviceSubjects = deviceSubjects.filter(
    (subject) =>
      (!selectedDeviceSubjectFamily || subject.product_family === selectedDeviceSubjectFamily) &&
      (!selectedDeviceSubjectVariant || subject.product_variant === selectedDeviceSubjectVariant),
  );
  const monitoredTables = databaseSchemaSummary?.tables ?? [];
  const healthIssues = databaseHealthSummary?.issues ?? [];
  const indexedTableCount = monitoredTables.filter((table) => table.indexes.length > 0).length;
  const foreignKeyCount = monitoredTables.reduce((sum, table) => sum + table.foreign_keys.length, 0);
  const postDeviceSubjectCount =
    importOperationCounts.find((entry) => entry.submission_operation === "POST")?.device_subject_count ?? 0;
  const patchDeviceSubjectCount =
    importOperationCounts.find((entry) => entry.submission_operation === "PATCH")?.device_subject_count ?? 0;
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
          label: "Synced",
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
    : isLoadingWorkbookImportMonitoring
      ? {
          label: "Loading snapshot",
          className: "warn",
          detail: "Checking the current SQLite-backed submission snapshot.",
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
  const xmlValidationRecords = canonicalValidationRecords;
  const xmlReadyRecords = xmlValidationRecords.filter((record) => record.xml_readiness.status === "complete");
  const xmlBlockedRecords = xmlValidationRecords.filter((record) => record.xml_readiness.status !== "complete");
  const xmlModelOptions = useMemo(() => {
    const parents = new Map<string, Set<string>>();
    for (const record of xmlValidationRecords) {
      const key = JSON.stringify([record.product_family, record.product_variant]);
      const basic = basicUdiDiForRecord(record);
      if (basic) {
        const values = parents.get(key) ?? new Set<string>();
        values.add(basic);
        parents.set(key, values);
      }
    }
    return validationVariantSummaries.map(summary => ({
      family: summary.product_family,
      variant: summary.product_variant,
      basicUdiDis: [...(parents.get(JSON.stringify([summary.product_family, summary.product_variant])) ?? [])].sort(),
      total: summary.total_records,
      ready: summary.xml_ready_records,
      blocked: summary.xml_blocked_records,
    })).sort((a, b) => a.variant.localeCompare(b.variant) || a.family.localeCompare(b.family));
  }, [xmlValidationRecords, validationVariantSummaries]);
  const deviceSubjectModelOptions = mergeModelOptions([
    ...deviceSubjects.map(subject => ({
      family: subject.product_family ?? "",
      variant: subject.product_variant ?? "",
      basicUdiDis: xmlModelOptions.find(model => model.family === subject.product_family && model.variant === subject.product_variant)?.basicUdiDis ?? [],
    })),
  ]);
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
  const selectedXmlFamilyLabel =
    selectedXmlFamily ?? selectedXmlFamilySummary?.product_family ?? xmlFamilySummaries[0]?.product_family ?? "No family selected";
  const selectedXmlVariantLabel =
    selectedXmlVariant ??
    selectedXmlVariantSummary?.product_variant ??
    selectedXmlVariantSummaries[0]?.product_variant ??
    "No variant selected";
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
  const readinessByDevice = useMemo(() => {
    const index = new Map<string, RecordReadiness[]>();
    for (const entry of recordReadiness) {
      const key = JSON.stringify([entry.product_variant, entry.catalogue_number]);
      const candidates = index.get(key) ?? [];
      candidates.push(entry);
      index.set(key, candidates);
    }
    return index;
  }, [recordReadiness]);
  const readinessForRecord = (record: { product_family: string | null; product_variant: string | null; catalogue_number: string | null }) =>
    readinessByDevice.get(JSON.stringify([record.product_variant, record.catalogue_number]))
      ?.find((entry) => familyLabelsOverlap(entry.product_family, record.product_family));
  useEffect(() => {
    if (!canonicalValidation) return;
    let cancelled = false;
    setIsLoadingReadiness(true);
    setReadinessError(null);
    void api.operationReadiness().then((rows) => { if (!cancelled) setRecordReadiness(rows); })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRecordReadiness([]);
        setReadinessError(error instanceof Error ? error.message : "Operation readiness is unavailable.");
        setError(error instanceof Error ? error.message : "Operation readiness is unavailable.");
      }).finally(() => { if (!cancelled) setIsLoadingReadiness(false); });
    return () => { cancelled = true; };
  }, [canonicalValidation, testingSubjectSummaries, testingSummarySubjectSummaries]);
  const selectedBulkEligiblePostRecords = selectedXmlVariantRecords.filter(
    (record) => (record.submission_operation ?? "").toUpperCase() === "POST",
  );
  const selectedBulkEligiblePostCount = selectedBulkEligiblePostRecords.length;
  const selectedExactAvailablePostCount = selectedBulkEligiblePostRecords.filter((record) => readinessForRecord(record)?.post_ready).length;
  const selectedPatchTrackedBaseCount = testingSubjectSummaries.filter((summary) => readinessForRecord(summary)?.patch_ready).length;
  const {
    parents: bulkPatchPostedParents,
    patchEntries: bulkPatchPostedEntries,
    marketEntries: bulkMarketInfoPostedEntries,
  } = useBulkPostedCohorts(
    selectedXmlFamilySummary?.product_family,
    selectedXmlVariantSummary?.product_variant,
    selectedBulkPatchBasicUdiDi,
    selectedBulkMarketInfoBasicUdiDi,
    testingSubjectSummaries,
    setError,
  );
  const bulkMarketInfoPostedParents = bulkPatchPostedParents;
  const selectedBulkEligibleUdidiPostCount = selectedBulkEligiblePostRecords.filter((record) => readinessForRecord(record)?.child_post_ready).length;
  const bulkUdidiPostEntries = selectedBulkEligiblePostRecords
    .filter((record) => Boolean(record.catalogue_number) && readinessForRecord(record)?.child_post_ready)
    .map((record) => ({
      catalogue_number: record.catalogue_number as string,
      primary_udi_di: record.primary_udi_di ?? null,
    }));
  const bulkUdidiPostCatalogueNumbers = bulkUdidiPostEntries.map((entry) => entry.catalogue_number);
  const bulkUdidiPostCatalogueNumberSet = new Set(bulkUdidiPostCatalogueNumbers);
  const bulkUdidiPostImportedCatalogueNumbers = parseCatalogueNumberList(bulkUdidiPostImportText);
  const bulkUdidiPostImportedMatchedCatalogueNumbers = bulkUdidiPostImportedCatalogueNumbers.filter((catalogueNumber) =>
    bulkUdidiPostCatalogueNumberSet.has(catalogueNumber),
  );
  const bulkUdidiPostFilteredEntries = bulkUdidiPostEntries.filter((entry) =>
    !bulkUdidiPostCatalogueFilter.trim() || entry.catalogue_number.toLowerCase().includes(bulkUdidiPostCatalogueFilter.trim().toLowerCase()),
  );
  const effectiveBulkUdidiPostCatalogueNumbers =
    bulkUdidiPostScopeMode === "all_posted"
      ? bulkUdidiPostCatalogueNumbers
      : bulkUdidiPostScopeMode === "next_10"
        ? bulkUdidiPostCatalogueNumbers.slice(0, 10)
        : bulkUdidiPostScopeMode === "next_25"
          ? bulkUdidiPostCatalogueNumbers.slice(0, 25)
          : bulkUdidiPostScopeMode === "next_100"
            ? bulkUdidiPostCatalogueNumbers.slice(0, 100)
            : bulkUdidiPostScopeMode === "selected_catalogue_numbers"
              ? selectedBulkUdidiPostCatalogueNumbers.filter((catalogueNumber) => bulkUdidiPostCatalogueNumberSet.has(catalogueNumber))
              : bulkUdidiPostImportedMatchedCatalogueNumbers;
  const displayedBulkPatchParentOptions = bulkPatchPostedParents;
  const selectedBulkPatchParentGroup =
    displayedBulkPatchParentOptions.find((group) => group.basic_udi_di === selectedBulkPatchBasicUdiDi) ??
    displayedBulkPatchParentOptions[0] ??
    null;
  const displayedBulkMarketInfoParentOptions =
    bulkMarketInfoPostedParents;
  const selectedBulkMarketInfoParentGroup =
    displayedBulkMarketInfoParentOptions.find((group) => group.basic_udi_di === selectedBulkMarketInfoBasicUdiDi) ??
    displayedBulkMarketInfoParentOptions[0] ??
    null;
  const bulkPatchPostedCatalogueNumbers = bulkPatchPostedEntries
    .map((entry) => entry.catalogue_number)
    .filter((catalogueNumber): catalogueNumber is string => Boolean(catalogueNumber));
  const bulkMarketInfoPostedCatalogueNumbers = bulkMarketInfoPostedEntries
    .map((entry) => entry.catalogue_number)
    .filter((catalogueNumber): catalogueNumber is string => Boolean(catalogueNumber));
  const bulkPatchPostedCatalogueSet = new Set(bulkPatchPostedCatalogueNumbers);
  const bulkMarketInfoPostedCatalogueSet = new Set(bulkMarketInfoPostedCatalogueNumbers);
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
  const bulkMarketInfoFilteredPostedEntries =
    bulkMarketInfoScopeMode !== "selected_catalogue_numbers" || !bulkMarketInfoCatalogueFilter.trim()
      ? bulkMarketInfoPostedEntries
      : bulkMarketInfoPostedEntries.filter((entry) =>
          (entry.catalogue_number ?? "").toLowerCase().includes(bulkMarketInfoCatalogueFilter.trim().toLowerCase()),
        );
  const bulkMarketInfoImportedCatalogueNumbers = parseCatalogueNumberList(bulkMarketInfoImportText);
  const bulkMarketInfoImportedMatchedEntries = bulkMarketInfoPostedEntries.filter(
    (entry) => entry.catalogue_number && bulkMarketInfoImportedCatalogueNumbers.includes(entry.catalogue_number),
  );
  const bulkMarketInfoImportedMatchedCatalogueNumbers = bulkMarketInfoImportedMatchedEntries
    .map((entry) => entry.catalogue_number)
    .filter((catalogueNumber): catalogueNumber is string => Boolean(catalogueNumber));
  const bulkMarketInfoImportedNotFoundCatalogueNumbers = bulkMarketInfoImportedCatalogueNumbers.filter(
    (catalogueNumber) => !bulkMarketInfoPostedCatalogueSet.has(catalogueNumber),
  );
  const registrationStateStatusOptions = [
    "POST ready",
    "Child POST ready",
    "PATCH ready",
    "Market Info ready",
    "Mixed",
    "Blocked",
    "Loading",
    "Unavailable",
  ];
  const searchedTestingSubjects = testingSummarySubjectSummaries.filter(subject =>
    matchesModelSearch(testingSummarySearch, subject.product_family, subject.product_variant, subject.basic_udi_di));
  const searchedTestingEvents = testingSummaryEvents.filter(event =>
    matchesModelSearch(testingSummarySearch, event.product_family, event.product_variant, event.basic_udi_di));
  const searchedTestingRecords = xmlReadyRecords.filter(record =>
    matchesModelSearch(testingSummarySearch, record.product_family, record.product_variant, basicUdiDiForRecord(record)));
  const searchedTestingWorkspaceSummary = testingSummarySearch.trim() && testingSummaryWorkspaceSummary ? {
    ...testingSummaryWorkspaceSummary,
    successful_device_post_count: searchedTestingEvents.filter(event => event.status === "SUCCESS" && event.message_type === "DEVICE.POST").length,
    successful_child_post_count: searchedTestingEvents.filter(event => event.status === "SUCCESS" && event.message_type === "UDI_DI.POST").length,
    successful_patch_count: searchedTestingEvents.filter(event => event.status === "SUCCESS" && event.message_type === "UDI_DI.PATCH").length,
    latest_tested_at: searchedTestingEvents.map(event => event.tested_at).filter((date): date is string => Boolean(date)).sort().reverse()[0] ?? null,
  } : testingSummaryWorkspaceSummary;
  const testingSummaryXmlReadyPostRecords = searchedTestingRecords.filter((record) => {
    if ((record.submission_operation ?? "").toUpperCase() !== "POST") {
      return false;
    }
    if (selectedTestingSummaryFamily && !familyLabelsOverlap(record.product_family, selectedTestingSummaryFamily)) {
      return false;
    }
    if (selectedTestingSummaryVariant && record.product_variant !== selectedTestingSummaryVariant) {
      return false;
    }
    return true;
  });
  const testingSummarySuccessfulPrimaryUdiSet = new Set(
    searchedTestingSubjects
      .filter((summary) => summary.has_successful_device_post || summary.has_successful_child_post_or_patch || summary.post_success)
      .map((summary) => (summary.primary_udi_di ?? "").trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );
  const testingSummaryRegisteredBasicUdiSet = new Set(
    searchedTestingSubjects
      .filter((summary) => summary.post_success && summary.basic_udi_di)
      .map((summary) => summary.basic_udi_di as string),
  );
  const testingSummaryAvailablePostCount = testingSummaryXmlReadyPostRecords.filter((record) => {
    const primaryUdiDi = (record.primary_udi_di ?? "").trim().toLowerCase();
    return primaryUdiDi ? !testingSummarySuccessfulPrimaryUdiSet.has(primaryUdiDi) : true;
  }).length;
  const testingSummaryAvailableBulkPostCount = testingSummaryXmlReadyPostRecords.filter((record) => {
    const primaryUdiDi = (record.primary_udi_di ?? "").trim().toLowerCase();
    const basicUdiDi = basicUdiDiForRecord(record);
    return (
      typeof basicUdiDi === "string" &&
      (!primaryUdiDi || !testingSummarySuccessfulPrimaryUdiSet.has(primaryUdiDi)) &&
      testingSummaryRegisteredBasicUdiSet.has(basicUdiDi)
    );
  }).length;
  const testingSummaryPatchReadyCount = searchedTestingSubjects.filter((summary) => readinessForRecord(summary)?.patch_ready).length;
  const testingSummaryRows = (canonicalValidation?.variant_summaries ?? [])
    .filter((summary) => (selectedTestingSummaryFamily ? summary.product_family === selectedTestingSummaryFamily : true))
    .filter((summary) => (selectedTestingSummaryVariant ? summary.product_variant === selectedTestingSummaryVariant : true))
    .filter(summary => matchesModelSearch(testingSummarySearch, summary.product_family, summary.product_variant,
      ...xmlModelOptions.filter(model => model.family === summary.product_family && model.variant === summary.product_variant).flatMap(model => model.basicUdiDis),
      ...testingSummarySubjectSummaries.filter(subject => familyLabelsOverlap(subject.product_family, summary.product_family) && subject.product_variant === summary.product_variant).map(subject => subject.basic_udi_di)))
    .map((summary) => {
      const matchingRecords = searchedTestingRecords.filter(
        (record) =>
          familyLabelsOverlap(record.product_family, summary.product_family) &&
          record.product_variant === summary.product_variant &&
          (record.submission_operation ?? "").toUpperCase() === "POST",
      );
      const matchingSubjects = searchedTestingSubjects.filter(
        (subject) => familyLabelsOverlap(subject.product_family, summary.product_family) && subject.product_variant === summary.product_variant,
      );
      const rowRegisteredBasicUdiSet = new Set(
        matchingSubjects
          .filter((subject) => subject.post_success && subject.basic_udi_di)
          .map((subject) => subject.basic_udi_di as string),
      );
      const rowBasicUdiCodes = Array.from(
        new Set(
          [
            ...matchingSubjects.map((subject) => subject.basic_udi_di),
            ...matchingRecords.map((record) => basicUdiDiForRecord(record)),
          ].filter((value): value is string => Boolean(value)),
        ),
      );
      const availableChildPostCount = matchingRecords.filter((record) => readinessForRecord(record)?.child_post_ready).length;
      const patchReadyCount = matchingSubjects.filter(
        (subject) => readinessForRecord(subject)?.patch_ready,
      ).length;
      const patchCompletedCount = matchingSubjects.filter((subject) => Number(subject.latest_successful_version ?? "0") > 1).length;
      const availablePostCount = matchingRecords.filter((record) => readinessForRecord(record)?.post_ready).length;
      const parentRegisteredCount = rowRegisteredBasicUdiSet.size;
      const successfulChildPostCount = matchingSubjects.filter((subject) => subject.has_successful_child_post_or_patch).length;
      const marketInfoReadyCount = matchingSubjects.filter(
        (subject) =>
          readinessForRecord(subject)?.market_info_ready,
      ).length;
      const marketInfoCompletedCount = matchingSubjects.filter(
        (subject) =>
          Boolean(subject.latest_successful_market_info_version) || subject.latest_success_message_type === "MARKET_INFO.PUT",
      ).length;
      const statusLabel =
        patchReadyCount > 0
          ? "PATCH ready"
          : availablePostCount > 0
            ? "POST ready"
            : parentRegisteredCount > 0
              ? "In progress"
              : "Blocked";
      const statusClassName =
        patchReadyCount > 0 || availablePostCount > 0
          ? "status-pill ok compact"
          : parentRegisteredCount > 0
            ? "status-pill warn compact"
            : "status-pill danger compact";
      return {
        key: `${summary.product_family}::${summary.product_variant}`,
        productFamily: summary.product_family,
        productVariant: summary.product_variant,
        basicUdiDiLabel:
          rowBasicUdiCodes.length === 1
            ? rowBasicUdiCodes[0]
            : rowBasicUdiCodes.length > 1
              ? `${rowBasicUdiCodes.length} tracked parents`
              : "Not resolved",
        parentRegistered: parentRegisteredCount > 0,
        parentRegisteredCount,
        successfulChildPostCount,
        availableChildPostCount,
        patchReadyCount,
        patchCompletedCount,
        marketInfoReadyCount,
        marketInfoCompletedCount,
        latestPatchLabel: resolveTestingSummaryLatestPatchLabel(matchingSubjects),
        latestMarketInfoLabel: resolveTestingSummaryLatestMarketInfoLabel(matchingSubjects),
        statusLabel,
        statusClassName,
      };
    })
    .sort((left, right) => {
      const familyCompare = left.productFamily.localeCompare(right.productFamily);
      return familyCompare !== 0 ? familyCompare : left.productVariant.localeCompare(right.productVariant);
    });
  const registrationStateRows = Array.from(
    ((): Map<
      string,
      {
        productFamily: string;
        productVariant: string;
        basicUdiDi: string;
        records: typeof xmlReadyRecords;
        subjects: TestingSubjectReadModelSummary[];
      }
    > => {
      const grouped = new Map<
        string,
        {
          productFamily: string;
          productVariant: string;
          basicUdiDi: string;
          records: typeof xmlReadyRecords;
          subjects: TestingSubjectReadModelSummary[];
        }
      >();
      const includeFamily = (family: string | null | undefined) =>
        !selectedRegistrationStateFamily || familyLabelsOverlap(family, selectedRegistrationStateFamily);
      const includeVariant = (variant: string | null | undefined) =>
        !selectedRegistrationStateVariant || variant === selectedRegistrationStateVariant;
      for (const record of xmlReadyRecords) {
        if ((record.submission_operation ?? "").toUpperCase() !== "POST") {
          continue;
        }
        if (!includeFamily(record.product_family) || !includeVariant(record.product_variant)) {
          continue;
        }
        const basicUdiDi = basicUdiDiForRecord(record);
        if (!basicUdiDi) {
          continue;
        }
        const key = `${record.product_family}::${record.product_variant}::${basicUdiDi}`;
        const group = grouped.get(key) ?? {
          productFamily: record.product_family,
          productVariant: record.product_variant,
          basicUdiDi,
          records: [],
          subjects: [],
        };
        group.records.push(record);
        grouped.set(key, group);
      }
      for (const subject of testingSummarySubjectSummaries) {
        if (!includeFamily(subject.product_family) || !includeVariant(subject.product_variant)) {
          continue;
        }
        const basicUdiDi = (subject.basic_udi_di ?? "").trim();
        if (!basicUdiDi) {
          continue;
        }
        const key = `${subject.product_family}::${subject.product_variant}::${basicUdiDi}`;
        const group = grouped.get(key) ?? {
          productFamily: subject.product_family ?? "Not resolved",
          productVariant: subject.product_variant ?? "Not resolved",
          basicUdiDi,
          records: [],
          subjects: [],
        };
        group.subjects.push(subject);
        grouped.set(key, group);
      }
      return grouped;
    })().values(),
  )
    .map((group) => {
      const availableRecords = group.records.filter((record) => readinessForRecord(record)?.post_ready);
      const parentRegistered = group.subjects.some((subject) => subject.post_success);
      const patchReadyCount = group.subjects.filter(
        (subject) => readinessForRecord(subject)?.patch_ready,
      ).length;
      const marketInfoReadyCount = group.subjects.filter(
        (subject) =>
          readinessForRecord(subject)?.market_info_ready,
      ).length;
      const seedPostCount = parentRegistered ? 0 : availableRecords.length > 0 ? 1 : 0;
      const childPostCount = parentRegistered ? availableRecords.length : 0;
      const actionableModeCount = [seedPostCount > 0, childPostCount > 0, patchReadyCount > 0, marketInfoReadyCount > 0].filter(Boolean).length;
      let statusLabel = "Blocked";
      let statusClassName = "status-pill danger compact";
      if (actionableModeCount > 1) {
        statusLabel = "Mixed";
        statusClassName = "status-pill warn compact";
      } else if (seedPostCount > 0) {
        statusLabel = "POST ready";
        statusClassName = "status-pill ok compact";
      } else if (childPostCount > 0) {
        statusLabel = "Child POST ready";
        statusClassName = "status-pill ok compact";
      } else if (patchReadyCount > 0) {
        statusLabel = "PATCH ready";
        statusClassName = "status-pill ok compact";
      } else if (marketInfoReadyCount > 0) {
        statusLabel = "Market Info ready";
        statusClassName = "status-pill ok compact";
      }
      const latestLabel = resolveTestingSummaryLatestOperationLabel(group.subjects);
      const readinessMissing = actionableModeCount === 0 &&
        [...group.records, ...group.subjects].some((record) => !readinessForRecord(record));
      if (isLoadingReadiness) {
        statusLabel = "Loading";
        statusClassName = "status-pill warn compact";
      } else if (readinessError || readinessMissing) {
        statusLabel = "Unavailable";
        statusClassName = "status-pill warn compact";
      }
      const nextActionLabel =
        isLoadingReadiness ? "Checking readiness" : readinessError || readinessMissing ? "Readiness unavailable" :
        seedPostCount > 0
          ? "Register Basic UDI-DI"
          : childPostCount > 0
            ? "Run child POST"
            : patchReadyCount > 0
              ? "Run PATCH"
              : marketInfoReadyCount > 0
                ? "Run Market Info"
                : "No action";
      return {
        key: `${group.productFamily}::${group.productVariant}::${group.basicUdiDi}`,
        productFamily: group.productFamily,
        productVariant: group.productVariant,
        basicUdiDiLabel: group.basicUdiDi,
        parentStatusLabel: parentRegistered ? "Registered" : "Not registered",
        parentStatusClassName: parentRegistered ? "status-pill ok compact" : "status-pill warn compact",
        seedPostCount,
        eligibleChildDeviceCount: availableRecords.length,
        childPostCount,
        patchCount: patchReadyCount,
        marketInfoCount: marketInfoReadyCount,
        latestLabel,
        nextActionLabel,
        statusLabel,
        statusClassName,
        actionableCount: seedPostCount + childPostCount + patchReadyCount + marketInfoReadyCount,
      };
    })
    .filter((row) => (selectedRegistrationStateStatus ? row.statusLabel === selectedRegistrationStateStatus : true))
    .filter((row) => (registrationStateActionableOnly ? row.actionableCount > 0 : true))
    .filter((row) => {
      const query = registrationStateSearch.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return (
        row.productFamily.toLowerCase().includes(query) ||
        row.productVariant.toLowerCase().includes(query) ||
        row.basicUdiDiLabel.toLowerCase().includes(query) ||
        row.nextActionLabel.toLowerCase().includes(query)
      );
    })
    .sort((left, right) => {
      const familyCompare = left.productFamily.localeCompare(right.productFamily);
      if (familyCompare !== 0) {
        return familyCompare;
      }
      const variantCompare = left.productVariant.localeCompare(right.productVariant);
      if (variantCompare !== 0) {
        return variantCompare;
      }
      return left.basicUdiDiLabel.localeCompare(right.basicUdiDiLabel);
    });
  const registrationStateMetrics = [
    {
      label: "Parent groups",
      value: `${registrationStateRows.length}`,
      detail: "in scope",
    },
    {
      label: "Seed POST",
      value: `${registrationStateRows.reduce((total, row) => total + row.seedPostCount, 0)}`,
      detail: "next parent actions",
      className: "summary-card-kpi-post",
    },
    {
      label: "Child POST",
      value: `${registrationStateRows.reduce((total, row) => total + row.childPostCount, 0)}`,
      detail: "available",
      className: "summary-card-kpi-post",
    },
    {
      label: "PATCH",
      value: `${registrationStateRows.reduce((total, row) => total + row.patchCount, 0)}`,
      detail: "ready",
      className: "summary-card-kpi-patch",
    },
    {
      label: "Market Info",
      value: `${registrationStateRows.reduce((total, row) => total + row.marketInfoCount, 0)}`,
      detail: "ready",
    },
    {
      label: "Parents registered",
      value: `${registrationStateRows.filter((row) => row.parentStatusLabel === "Registered").length}`,
      detail: "tracked",
    },
  ];
  const testingSummaryMetrics = [
    {
      label: "Parent POST",
      value: `${searchedTestingWorkspaceSummary?.successful_device_post_count ?? 0}`,
      detail: testingSummarySearch.trim() && testingSummaryEvents.length >= 10000 ? "successful (loaded events only)" : "successful",
      className: "summary-card-kpi-post",
    },
    {
      label: "Child POST",
      value: `${searchedTestingWorkspaceSummary?.successful_child_post_count ?? 0}`,
      detail: testingSummarySearch.trim() && testingSummaryEvents.length >= 10000 ? "successful (loaded events only)" : "successful",
      className: "summary-card-kpi-post",
    },
    {
      label: "PATCH",
      value: `${searchedTestingWorkspaceSummary?.successful_patch_count ?? 0}`,
      detail: testingSummarySearch.trim() && testingSummaryEvents.length >= 10000 ? "successful (loaded events only)" : "successful",
      className: "summary-card-kpi-patch",
    },
    {
      label: "POST Ready",
      value: `${testingSummaryAvailablePostCount}`,
      detail: "available",
    },
    {
      label: "PATCH Ready",
      value: `${testingSummaryPatchReadyCount}`,
      detail: "available",
    },
    {
      label: "Bulk Child POST",
      value: `${testingSummaryAvailableBulkPostCount}`,
      detail: "available",
    },
  ];
  const testingSummaryRecentSubjects = [...searchedTestingSubjects]
    .filter((summary) => Boolean(summary.latest_tested_at))
    .sort((left, right) => (right.latest_tested_at ?? "").localeCompare(left.latest_tested_at ?? ""))
    .slice(0, 5);
  const testingSummaryEventRows = searchedTestingEvents.map((event) => ({
    key: `${event.id}`,
    testedAt: event.tested_at ?? "Not recorded",
    productFamily: event.product_family ?? "Not resolved",
    productVariant: event.product_variant ?? "Not resolved",
    catalogueNumber: event.catalogue_number ?? event.primary_udi_di ?? "Not resolved",
    operationLabel: resolveTestingEventOperationLabel(event),
    versionLabel: resolveTestingEventVersionLabel(event),
    scenarioLabel: event.scenario_label ?? event.scenario_id ?? "Standard",
    resultLabel: event.status ?? "SUCCESS",
    detailsSummary: event.details_summary,
    addedCountries: event.added_countries,
    removedCountries: event.removed_countries,
    originalMarketBefore: event.original_market_before,
    originalMarketAfter: event.original_market_after,
  }));
  const effectiveBulkPatchCatalogueNumbers =
    bulkPatchScopeMode === "all_posted"
      ? bulkPatchPostedCatalogueNumbers
      : bulkPatchScopeMode === "next_10"
        ? bulkPatchPostedCatalogueNumbers.slice(0, 10)
        : bulkPatchScopeMode === "next_25"
          ? bulkPatchPostedCatalogueNumbers.slice(0, 25)
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
    bulkPatchPostedEntries.length;
  const canRunBulkPatch =
    Boolean(selectedBulkPatchParentGroup) &&
    (
      (bulkPatchScopeMode === "all_posted" && selectedBulkPatchEligibleCount > 0) ||
      ((bulkPatchScopeMode === "next_10" || bulkPatchScopeMode === "next_25") && selectedBulkPatchSelectedCount > 0) ||
      (bulkPatchScopeMode !== "all_posted" && selectedBulkPatchSelectedCount > 0)
    );
  const bulkPatchReadinessReason = !selectedBulkPatchParentGroup
    ? "No Basic UDI-DI parent is selected."
    : bulkPatchScopeMode === "all_posted" && selectedBulkPatchEligibleCount < 1
      ? "No posted child devices are currently available under the selected parent."
      : bulkPatchScopeMode === "next_10" && selectedBulkPatchSelectedCount < 1
        ? "No posted child devices are currently available for the next 10-device PATCH scope."
      : bulkPatchScopeMode === "next_25" && selectedBulkPatchSelectedCount < 1
        ? "No posted child devices are currently available for the next 25-device PATCH scope."
      : bulkPatchScopeMode === "selected_catalogue_numbers" && selectedBulkPatchSelectedCount < 1
        ? "Select at least one posted catalogue number."
      : bulkPatchScopeMode === "import_catalogue_list" && selectedBulkPatchSelectedCount < 1
        ? "Import at least one posted catalogue number that matches the selected parent."
        : "Ready.";
  const bulkPatchScopeLabel =
    bulkPatchScopeMode === "all_posted"
      ? "All posted devices"
      : bulkPatchScopeMode === "next_10"
        ? "Next 10 devices"
      : bulkPatchScopeMode === "next_25"
        ? "Next 25 devices"
      : bulkPatchScopeMode === "selected_catalogue_numbers"
        ? "Selected catalogue numbers"
        : "Import catalogue list";
  const effectiveBulkMarketInfoCatalogueNumbers =
    bulkMarketInfoScopeMode === "all_posted"
      ? bulkMarketInfoPostedCatalogueNumbers
      : bulkMarketInfoScopeMode === "next_10"
        ? bulkMarketInfoPostedCatalogueNumbers.slice(0, 10)
        : bulkMarketInfoScopeMode === "next_25"
          ? bulkMarketInfoPostedCatalogueNumbers.slice(0, 25)
          : bulkMarketInfoScopeMode === "selected_catalogue_numbers"
            ? selectedBulkMarketInfoCatalogueNumbers
            : bulkMarketInfoImportedMatchedCatalogueNumbers;
  const effectiveBulkMarketInfoCatalogueSet = new Set(effectiveBulkMarketInfoCatalogueNumbers);
  const selectedBulkMarketInfoEntries = bulkMarketInfoPostedEntries.filter(
    (entry) => entry.catalogue_number && effectiveBulkMarketInfoCatalogueSet.has(entry.catalogue_number),
  );
  const bulkMarketInfoSelectionVersions = Array.from(
    new Set(
      selectedBulkMarketInfoEntries
        .map((entry) => entry.latest_market_info_version)
        .filter((version): version is string => Boolean(version)),
    ),
  ).sort((left, right) => Number(left) - Number(right));
  const bulkMarketInfoCurrentVersionSummary =
    bulkMarketInfoSelectionVersions.length < 1
      ? "market v1 baseline"
      : bulkMarketInfoSelectionVersions.length === 1
        ? `all market v${bulkMarketInfoSelectionVersions[0]}`
        : `market v${bulkMarketInfoSelectionVersions[0]} to v${bulkMarketInfoSelectionVersions[bulkMarketInfoSelectionVersions.length - 1]}`;
  const bulkMarketInfoNextVersionSummary =
    bulkMarketInfoSelectionVersions.length < 1
      ? "market v2"
      : bulkMarketInfoSelectionVersions.length === 1
        ? `market v${Number(bulkMarketInfoSelectionVersions[0]) + 1}`
        : `market v${Number(bulkMarketInfoSelectionVersions[0]) + 1} to v${Number(bulkMarketInfoSelectionVersions[bulkMarketInfoSelectionVersions.length - 1]) + 1}`;
  const selectedBulkMarketInfoSelectedCount = effectiveBulkMarketInfoCatalogueNumbers.length;
  const selectedBulkMarketInfoEligibleCount =
    selectedBulkMarketInfoParentGroup?.posted_child_count ??
    bulkMarketInfoPostedEntries.length;
  const canRunBulkMarketInfo =
    Boolean(selectedBulkMarketInfoParentGroup) &&
    (
      (bulkMarketInfoScopeMode === "all_posted" && selectedBulkMarketInfoEligibleCount > 0) ||
      ((bulkMarketInfoScopeMode === "next_10" || bulkMarketInfoScopeMode === "next_25") && selectedBulkMarketInfoSelectedCount > 0) ||
      (bulkMarketInfoScopeMode !== "all_posted" && selectedBulkMarketInfoSelectedCount > 0)
    );
  const bulkMarketInfoReadinessReason = !selectedBulkMarketInfoParentGroup
    ? "No Basic UDI-DI parent is selected."
    : bulkMarketInfoScopeMode === "all_posted" && selectedBulkMarketInfoEligibleCount < 1
      ? "No posted child devices are currently available under the selected parent."
      : bulkMarketInfoScopeMode === "next_10" && selectedBulkMarketInfoSelectedCount < 1
        ? "No posted child devices are currently available for the next 10-device Market Info scope."
      : bulkMarketInfoScopeMode === "next_25" && selectedBulkMarketInfoSelectedCount < 1
        ? "No posted child devices are currently available for the next 25-device Market Info scope."
      : bulkMarketInfoScopeMode === "selected_catalogue_numbers" && selectedBulkMarketInfoSelectedCount < 1
        ? "Select at least one posted catalogue number."
      : bulkMarketInfoScopeMode === "import_catalogue_list" && selectedBulkMarketInfoSelectedCount < 1
        ? "Import at least one posted catalogue number that matches the selected parent."
        : "Ready.";
  const selectedBulkMarketInfoBaselineCatalogueNumber =
    effectiveBulkMarketInfoCatalogueNumbers[0] ??
    bulkMarketInfoPostedCatalogueNumbers[0] ??
    null;
  const selectedBulkMarketInfoCurrentItems = buildCurrentMarketInfoItemsForCatalogue({
    catalogueNumber: selectedBulkMarketInfoBaselineCatalogueNumber,
    testingSubjectSummaries,
    selectedXmlVariantRecords,
  });
  const normalizedBulkMarketInfoScenarioItems = bulkMarketInfoScenarioItems
    .map((item) => ({
      country: resolveMarketCountryCode(marketCountryReference, item.country),
      original_placed_on_market: item.originalPlacedOnMarket,
    }))
    .filter((item, index, items) => item.country && items.findIndex((candidate) => candidate.country === item.country) === index);
  const isBulkMarketInfoScenarioReady =
    Boolean(selectedBulkMarketInfoParentGroup) && normalizedBulkMarketInfoScenarioItems.length > 0 && selectedBulkMarketInfoSelectedCount > 0;
  const bulkMarketInfoReadinessMessage = !selectedBulkMarketInfoParentGroup
    ? "Select a posted Basic UDI-DI parent to continue."
    : normalizedBulkMarketInfoScenarioItems.length < 1
      ? "Add at least one country to generate the bulk Market Info package."
      : selectedBulkMarketInfoSelectedCount < 1
        ? bulkMarketInfoReadinessReason
        : `Ready to generate Bulk Market Info for ${selectedBulkMarketInfoSelectedCount} device${
            selectedBulkMarketInfoSelectedCount === 1 ? "" : "s"
          }.`;
  const {
    xmlOperationAssessment,
    setXmlOperationAssessment,
    xmlOperationAssessmentError,
    setXmlOperationAssessmentError,
    isLoadingXmlOperationAssessment,
  } = useXmlOperationAssessment({
    activeTab,
    xmlMode,
    selectedProductFamily: selectedXmlFamilySummary?.product_family,
    selectedProductVariant: selectedXmlVariantSummary?.product_variant,
    selectedPatchCatalogueNumber: selectedXmlRecordKey,
    selectedBulkPatchBasicUdiDi,
    selectedBulkMarketInfoBasicUdiDi,
  });
  const isMarketInfoContextRefreshing =
    activeTab === "xml" &&
    (xmlMode === "marketInfo" || xmlMode === "bulkMarketInfo") &&
    (isLoadingTestingSubjectSummaries || isLoadingCanonicalValidation);
  const visibleMarketInfoRefreshState =
    (xmlMode === "marketInfo" || xmlMode === "bulkMarketInfo") &&
    (showMarketInfoRefreshState || isMarketInfoContextRefreshing || isLoadingXmlOperationAssessment);
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
  const assessedCurrentMarketInfoVersionSummary = assessmentEvidenceStringArray(xmlOperationAssessment, "current_market_info_version_summary");
  const assessedPatchLatestAcceptedVersion = assessmentEvidenceString(xmlOperationAssessment, "latest_accepted_version");
  const assessedPostReviewHistory = assessmentEvidenceBoolean(xmlOperationAssessment, "reviewed_post_baseline_present");
  const assessedPatchTrackedRegistration = assessmentEvidenceBoolean(xmlOperationAssessment, "tracked_registration_known");
  const assessedPatchCandidateCatalogueNumber = assessmentEvidenceString(xmlOperationAssessment, "catalogue_number");
  const assessedPatchCandidatePrimaryUdiDi = assessmentEvidenceString(xmlOperationAssessment, "primary_udi_di");
  const assessedMarketInfoCurrentVersion = assessmentEvidenceString(xmlOperationAssessment, "current_market_info_version");
  const assessedMarketInfoCandidateCatalogueNumber = assessmentEvidenceString(xmlOperationAssessment, "catalogue_number");
  const assessedMarketInfoCandidatePrimaryUdiDi = assessmentEvidenceString(xmlOperationAssessment, "primary_udi_di");
  const assessedPostCandidateCatalogueNumber = assessmentEvidenceString(xmlOperationAssessment, "candidate_catalogue_number");
  const assessedPostCandidatePrimaryUdiDi = assessmentEvidenceString(xmlOperationAssessment, "candidate_primary_udi_di");
  const hasResolvedPostAssessmentCandidate = Boolean(assessedPostCandidateCatalogueNumber || assessedPostCandidatePrimaryUdiDi);
  const selectedPostCandidateRecord = findRecordByCatalogueNumber(
    selectedXmlVariantRecords,
    assessedPostCandidateCatalogueNumber,
  );
  const selectedPatchDeviceRecords = selectedXmlVariantRecords.filter((record) =>
    testingSubjectSummaries.some(
      (summary) =>
        (summary.catalogue_number === record.catalogue_number ||
          (record.primary_udi_di && summary.primary_udi_di === record.primary_udi_di)) &&
        (summary.post_success || summary.has_successful_device_post || summary.has_successful_child_post_or_patch),
    ),
  );
  const selectedPatchRecord = findRecordByCatalogueNumber(selectedPatchDeviceRecords, selectedXmlRecordKey);
  const selectedPatchWorkspaceRecord = resolvePatchWorkspaceRecord(
    selectedXmlVariantRecords,
    selectedPatchRecord?.catalogue_number ?? assessedPatchCandidateCatalogueNumber,
    selectedPatchRecord ?? selectedXmlPairRecord,
  );
  const selectedXmlMarketInfoRecord = selectedXmlRecord ?? selectedXmlPairRecord;
  const selectedMarketInfoRecord = findRecordByCatalogueNumber(selectedPatchDeviceRecords, selectedXmlRecordKey);
  const selectedMarketInfoWorkspaceRecord = selectedMarketInfoRecord ?? findRecordByCatalogueNumber(
    selectedXmlVariantRecords,
    assessedMarketInfoCandidateCatalogueNumber,
  ) ?? selectedXmlMarketInfoRecord;
  const selectedPairRequestArgs = resolvePatchRequestArgs(selectedPatchWorkspaceRecord, {
    assessedCatalogueNumber: assessedPatchCandidateCatalogueNumber,
    assessedPrimaryUdiDi: assessedPatchCandidatePrimaryUdiDi,
    selectedProductFamily: selectedXmlFamilySummary?.product_family,
    selectedProductVariant: selectedXmlVariantSummary?.product_variant,
  });
  const selectedMarketInfoRequestArgs = resolveMarketInfoRequestArgs(selectedMarketInfoWorkspaceRecord, {
    assessedCatalogueNumber: assessedMarketInfoCandidateCatalogueNumber,
    assessedPrimaryUdiDi: assessedMarketInfoCandidatePrimaryUdiDi,
    selectedProductFamily: selectedXmlFamilySummary?.product_family,
    selectedProductVariant: selectedXmlVariantSummary?.product_variant,
  });
  const hasSelectedPatchBaselinePost = Boolean(selectedPatchWorkspaceRecord);
  const hasLoadedPatchBaseline = Boolean(
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
    xmlMode === "bulkUdidiPost"
        ? assessedBulkChildRecordCount ?? selectedBulkEligibleUdidiPostCount
        : xmlMode === "bulkPatch"
          ? selectedBulkPatchEligibleCount
          : selectedBulkMarketInfoEligibleCount;
  const normalizedBulkRecordCount = Math.min(Math.max(selectedBulkRecordCount, 1), Math.max(selectedBulkCapacity, 1));
  const selectedBulkChunkCount = resolveSelectedBulkChunkCount({
    xmlMode,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
    normalizedBulkRecordCount,
    selectedBulkPatchSelectedCount: xmlMode === "bulkMarketInfo" ? selectedBulkMarketInfoSelectedCount : selectedBulkPatchSelectedCount,
    selectedXmlVariantChunkCount,
  });
  const selectedBulkPreview = resolveSelectedBulkPreview({
    xmlMode,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
  });
  const selectedBulkExclusionSummaries = selectedBulkPreview
    ? summarizeBulkExcludedRecords(
        xmlMode === "bulkUdidiPost" ? "bulkUdidiPost" : xmlMode === "bulkPatch" ? "bulkPatch" : "bulkMarketInfo",
        selectedBulkPreview,
      )
    : [];
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
    const parentOption = displayedBulkMarketInfoParentOptions[0]?.basic_udi_di ?? "";
    if (
      selectedBulkMarketInfoBasicUdiDi &&
      displayedBulkMarketInfoParentOptions.some((group) => group.basic_udi_di === selectedBulkMarketInfoBasicUdiDi)
    ) {
      return;
    }
    setSelectedBulkMarketInfoBasicUdiDi(parentOption);
  }, [displayedBulkMarketInfoParentOptions, selectedBulkMarketInfoBasicUdiDi]);
  useEffect(() => {
    if (!selectedXmlFamilySummary || !selectedXmlVariantSummary) {
      setTestingSubjectSummaries([]);
      setIsLoadingTestingSubjectSummaries(false);
      return;
    }
    let cancelled = false;
    setIsLoadingTestingSubjectSummaries(true);
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
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTestingSubjectSummaries(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedXmlFamilySummary?.product_family, selectedXmlVariantSummary?.product_variant]);
  useEffect(() => {
    if (!(xmlMode === "marketInfo" || xmlMode === "bulkMarketInfo")) {
      setShowMarketInfoRefreshState(false);
      return;
    }
    if (isMarketInfoContextRefreshing) {
      setShowMarketInfoRefreshState(true);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setShowMarketInfoRefreshState(false);
    }, 450);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [xmlMode, isMarketInfoContextRefreshing]);
  useEffect(() => {
    if (
      activeTab !== "xml" ||
      (xmlMode !== "marketInfo" && xmlMode !== "bulkMarketInfo") ||
      !selectedXmlFamilySummary ||
      !selectedXmlVariantSummary
    ) {
      return;
    }
    setShowMarketInfoRefreshState(true);
    const timeoutId = window.setTimeout(() => {
      setShowMarketInfoRefreshState(false);
    }, 900);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    xmlMode,
    selectedXmlFamilySummary?.product_family,
    selectedXmlVariantSummary?.product_variant,
    selectedBulkMarketInfoBasicUdiDi,
  ]);
  useEffect(() => {
    if (activeTab !== "testingSummary" && activeTab !== "registrationState") {
      return;
    }
    const scopedFamily = activeTab === "registrationState" ? selectedRegistrationStateFamily : selectedTestingSummaryFamily;
    const scopedVariant = activeTab === "registrationState" ? selectedRegistrationStateVariant : selectedTestingSummaryVariant;
    let cancelled = false;
    setIsLoadingTestingSummary(true);
    setTestingSummaryError(null);
    void Promise.all([
      api.testingWorkspaceSummary({
        product_family: scopedFamily || undefined,
        product_variant: scopedVariant || undefined,
      }),
      api.testingSubjectSummaries({
        product_family: scopedFamily || undefined,
        product_variant: scopedVariant || undefined,
        limit: 10000,
      }),
      activeTab === "testingSummary"
        ? api.testingEvents({
            product_family: scopedFamily || undefined,
            product_variant: scopedVariant || undefined,
            limit: 10000,
          })
        : Promise.resolve([]),
    ])
      .then(([summary, subjectSummaries, events]) => {
        if (cancelled) {
          return;
        }
        setTestingSummaryWorkspaceSummary(summary);
        setTestingSummarySubjectSummaries(subjectSummaries);
        setTestingSummaryEvents(events);
      })
      .catch((requestError: Error) => {
        if (cancelled) {
          return;
        }
        setTestingSummaryWorkspaceSummary(null);
        setTestingSummarySubjectSummaries([]);
        setTestingSummaryEvents([]);
        setTestingSummaryError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTestingSummary(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    selectedRegistrationStateFamily,
    selectedRegistrationStateVariant,
    selectedTestingSummaryFamily,
    selectedTestingSummaryVariant,
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
    if (!selectedBulkMarketInfoParentGroup) {
      setSelectedBulkMarketInfoCatalogueNumbers([]);
      return;
    }
    setBulkMarketInfoCatalogueFilter("");
    setBulkMarketInfoImportText("");
  }, [selectedBulkMarketInfoParentGroup?.basic_udi_di]);
  useEffect(() => {
    const filtered = selectedBulkPatchCatalogueNumbers.filter((catalogueNumber) => bulkPatchPostedCatalogueSet.has(catalogueNumber));
    if (filtered.length === selectedBulkPatchCatalogueNumbers.length) {
      return;
    }
    setSelectedBulkPatchCatalogueNumbers(filtered);
  }, [bulkPatchPostedCatalogueNumbers.join("|")]);
  useEffect(() => {
    const filtered = selectedBulkMarketInfoCatalogueNumbers.filter((catalogueNumber) => bulkMarketInfoPostedCatalogueSet.has(catalogueNumber));
    if (filtered.length === selectedBulkMarketInfoCatalogueNumbers.length) {
      return;
    }
    setSelectedBulkMarketInfoCatalogueNumbers(filtered);
  }, [bulkMarketInfoPostedCatalogueNumbers.join("|")]);
  const selectedPatchScenario =
    PATCH_SCENARIOS.find((scenario) => scenario.id === selectedPatchScenarioId) ?? PATCH_SCENARIOS[0];
  const selectedPatchScenarioStatus = patchScenarioStatuses[selectedPatchScenario.id];
  const selectedPatchScenarioImplemented = selectedPatchScenario.implemented;
  const bulkPatchBaselineSummary = buildBulkPatchBaselineSummary({
    scenarioId: selectedPatchScenario.id,
    entries: selectedBulkPatchEntries,
  });
  const selectedLatestPatchState = xmlPairPreview?.latest_successful_patch_state ?? null;
  const selectedPatchWarningCodes = selectedLatestPatchState
    ? selectedLatestPatchState.critical_warnings.map((item) => item.code).filter((value) => value)
    : (selectedPatchWorkspaceRecord?.critical_warning_items ?? [])
        .map((item) => item.normalized_code?.trim() || item.item_type?.trim() || "")
        .filter((value) => value);
  const selectedPatchWarningDescriptions = selectedLatestPatchState
    ? selectedLatestPatchState.critical_warnings
        .map((item) => item.comment?.trim() || "")
        .filter((value) => value)
    : (selectedPatchWorkspaceRecord?.critical_warning_items ?? [])
        .map((item) => item.description?.trim() || "")
        .filter((value) => value);
  const selectedPatchStorageConditionMap = new Map(
    selectedLatestPatchState
      ? selectedLatestPatchState.storage_conditions.map((item) => [item.code, item.comment ?? "None"])
      : (selectedPatchWorkspaceRecord?.storage_condition_items ?? [])
          .filter((item) => item.normalized_code)
          .map((item) => [item.normalized_code ?? "", item.description ?? "None"]),
  );
  const selectedCurrentTradeName =
    selectedLatestPatchState?.trade_name ?? selectedPatchWorkspaceRecord?.trade_name ?? null;
  const selectedCurrentBaseQuantity =
    selectedLatestPatchState?.base_quantity ??
    (fieldValue(selectedPatchWorkspaceRecord, "device_record.base_quantity")
      ? Number(fieldValue(selectedPatchWorkspaceRecord, "device_record.base_quantity"))
      : null);
  const selectedCurrentSterile =
    selectedLatestPatchState?.sterile ?? parseBooleanString(fieldValue(selectedPatchWorkspaceRecord, "device_record.sterile"));
  const selectedCurrentLatex =
    selectedLatestPatchState?.contains_latex ??
    parseBooleanString(fieldValue(selectedPatchWorkspaceRecord, "device_record.contains_latex"));
  const selectedCurrentStatusCode =
    selectedLatestPatchState?.status_code ?? fieldValue(selectedPatchWorkspaceRecord, "device_record.status");
  const isSharedAnchorLoading =
    (xmlMode === "post" || xmlMode === "patch" || xmlMode === "marketInfo") &&
    Boolean(selectedPairRequestArgs) &&
    !xmlPairPreview;
  const {
    patchVersionInput,
    setPatchVersionInput,
    patchTradeNameInput,
    setPatchTradeNameInput,
    patchWarningCodeInput,
    setPatchWarningCodeInput,
    patchWarningCommentInput,
    setPatchWarningCommentInput,
    patchBaseQuantityInput,
    setPatchBaseQuantityInput,
    patchSterileInput,
    setPatchSterileInput,
    patchLatexInput,
    setPatchLatexInput,
    patchStatusCodeInput,
    setPatchStatusCodeInput,
    patchStorageConditionInputs,
    setPatchStorageConditionInputs,
    currentAcceptedPatchVersion,
    currentAcceptedPatchLabel,
    patchDraftComparisonRows,
    selectedWarningRequiresComment,
    isPatchScenarioReady,
    patchScenarioReadinessMessage,
    hasCurrentGeneratedPatchPreview,
  } = usePatchScenarioState({
    selectedXmlFamily,
    selectedXmlVariant,
    selectedXmlRecordKey,
    selectedPatchScenario,
    selectedPatchWorkspaceRecordTradeName: selectedPatchWorkspaceRecord?.trade_name ?? null,
    selectedPatchWorkspaceCatalogueNumber: selectedPatchWorkspaceRecord?.catalogue_number ?? null,
    selectedCurrentTradeName,
    selectedCurrentBaseQuantity,
    selectedCurrentSterile,
    selectedCurrentLatex,
    selectedCurrentStatusCode,
    selectedPatchWarningCodes,
    selectedPatchStorageConditionMap,
    hasLoadedPatchBaseline,
    isSharedAnchorLoading,
    xmlPairPreview,
    xmlPatchPreview,
    selectedPairRequestArgs,
    setXmlPatchPreview,
  });
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
          true,
        );
        if (!cancelled) {
          setXmlPairPreview(preview);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setXmlPairPreview(null);
          setError(error instanceof Error ? error.message : "Accepted baseline is unavailable.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    testingSubjectSummaries,
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
    setXmlBulkUdidiPostPreview(null);
    setXmlBulkPatchPreview(null);
    setXmlBulkMarketInfoPreview(null);
  }, [selectedXmlFamily, selectedXmlVariant]);
  useEffect(() => {
    setMarketInfoScenarioItems(
      buildMarketInfoScenarioItems(selectedXmlMarketInfoRecord?.market_availability_items ?? []),
    );
    setMarketInfoVersionInput("1");
    setXmlMarketInfoPreview(null);
  }, [
    selectedXmlMarketInfoRecord?.catalogue_number,
    selectedXmlMarketInfoRecord?.product_family,
    selectedXmlMarketInfoRecord?.product_variant,
  ]);
  useEffect(() => {
    setXmlMarketInfoPreview(null);
  }, [marketInfoScenarioItems]);
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
    setXmlBulkUdidiPostPreview(null);
  }, [selectedBulkRecordCount]);
  useEffect(() => {
    setBulkMarketInfoScenarioItems(
      buildMarketInfoScenarioItems(
        selectedBulkMarketInfoCurrentItems.map((item) => ({
          country: item.country,
          original_placed_on_market: item.originalPlacedOnMarket,
        })),
      ),
    );
    setXmlBulkMarketInfoPreview(null);
  }, [selectedBulkMarketInfoBaselineCatalogueNumber, selectedBulkMarketInfoParentGroup?.basic_udi_di]);
  useEffect(() => {
    setXmlBulkMarketInfoPreview(null);
  }, [bulkMarketInfoScenarioItems]);
  const selectedPairAnchor =
    xmlPairPreview?.registered_device_anchor ??
    ((xmlMode === "patch" || xmlMode === "marketInfo") && selectedPairRequestArgs
      ? buildSelectionAnchor(selectedPairRequestArgs)
      : null);
  const selectedMarketInfoAnchor =
    xmlMarketInfoPreview?.registered_device_anchor ??
    (selectedMarketInfoRequestArgs ? buildSelectionAnchor(selectedMarketInfoRequestArgs) : null);
  const selectedMarketInfoSummary =
    testingSubjectSummaries.find(
      (summary) =>
        (selectedMarketInfoAnchor?.catalogue_number && summary.catalogue_number === selectedMarketInfoAnchor.catalogue_number) ||
        (selectedMarketInfoAnchor?.primary_udi_di && summary.primary_udi_di === selectedMarketInfoAnchor.primary_udi_di),
    ) ?? null;
  const selectedMarketInfoTrackedVersion = [
    selectedMarketInfoSummary?.latest_successful_market_info_version,
    selectedMarketInfoSummary?.latest_observed_market_info_version,
  ].reduce<string | null>((highestVersion, candidateVersion) => {
    const candidate = Number(candidateVersion ?? "0");
    const highest = Number(highestVersion ?? "0");
    return Number.isFinite(candidate) && candidate > highest ? String(candidate) : highestVersion;
  }, null);
  const selectedTrackedMarketInfoItems = useMemo(
    () =>
      selectedMarketInfoSummary?.latest_successful_market_info_state?.market_countries?.map(
        (item: { country: string; original_placed_on_market: boolean }, index) => ({
          id: `tracked-market-${index}-${item.country}`,
          country: item.country,
          originalPlacedOnMarket: item.original_placed_on_market,
        }),
      ) ?? [],
    [selectedMarketInfoSummary?.latest_successful_market_info_state],
  );
  const selectedCurrentMarketInfoItems =
    (selectedTrackedMarketInfoItems.length > 0
      ? selectedTrackedMarketInfoItems
      : (selectedXmlMarketInfoRecord?.market_availability_items ?? []).map((item, index) => ({
          id: `current-market-${index}-${item.country}`,
          country: item.country,
          originalPlacedOnMarket: item.original_placed_on_market,
        })));
  useEffect(() => {
    if (!selectedXmlMarketInfoRecord?.catalogue_number && !selectedMarketInfoAnchor?.catalogue_number) {
      return;
    }
    setMarketInfoVersionInput(resolveNextIncrementalVersion(selectedMarketInfoTrackedVersion, "1"));
  }, [
    selectedXmlMarketInfoRecord?.catalogue_number,
    selectedMarketInfoAnchor?.catalogue_number,
    selectedMarketInfoTrackedVersion,
  ]);
  useEffect(() => {
    if (selectedTrackedMarketInfoItems.length < 1) {
      return;
    }
    setMarketInfoScenarioItems(selectedTrackedMarketInfoItems.map((item) => ({ ...item })));
  }, [
    selectedMarketInfoAnchor?.catalogue_number,
    selectedMarketInfoAnchor?.primary_udi_di,
    selectedTrackedMarketInfoItems,
  ]);
  const selectedTestingAnchor =
    xmlMode === "marketInfo"
        ? selectedMarketInfoAnchor
        : xmlPatchPreview?.registered_device_anchor ?? selectedPairAnchor;
  const normalizedMarketInfoScenarioItems = marketInfoScenarioItems
    .map((item) => ({
      country: resolveMarketCountryCode(marketCountryReference, item.country),
      original_placed_on_market: item.originalPlacedOnMarket,
    }))
    .filter((item, index, items) => item.country && items.findIndex((candidate) => candidate.country === item.country) === index);
  const normalizedMarketInfoVersion = marketInfoVersionInput.trim();
  const isMarketInfoVersionReady = /^\d+$/.test(normalizedMarketInfoVersion) && Number(normalizedMarketInfoVersion) >= 1;
  const canRunMarketInfoFromAssessment = Boolean(selectedMarketInfoRequestArgs) && xmlOperationAssessment?.status === "available";
  const isMarketInfoScenarioReady = canRunMarketInfoFromAssessment && normalizedMarketInfoScenarioItems.length > 0 && isMarketInfoVersionReady;
  const marketInfoReadinessMessage = !canRunMarketInfoFromAssessment
    ? "No registered device anchor is currently available for MARKET_INFO.PUT generation."
    : !normalizedMarketInfoVersion
      ? "Enter the Market Info version to test before generating the update."
      : !isMarketInfoVersionReady
        ? "Market Info version must be a positive integer."
    : normalizedMarketInfoScenarioItems.length < 1
      ? "Add at least one country to generate a standalone market information update."
      : `Ready to generate a standalone market information update with ${normalizedMarketInfoScenarioItems.length} countr${
          normalizedMarketInfoScenarioItems.length === 1 ? "y" : "ies"
        }.`;
  const selectedPostWorkspaceRecord = resolvePostWorkspaceRecord(
    xmlPairPreview,
    selectedPostCandidateRecord,
    xmlOperationAssessment?.status === "available",
  );
  const successXmlUploadScope =
    selectedXmlFamilySummary &&
    selectedXmlVariantSummary
      ? {
          productFamily: selectedXmlFamilySummary.product_family,
          productVariant: selectedXmlVariantSummary.product_variant,
          mode: xmlMode,
          catalogueNumber: xmlMode === "patch" ? selectedPairRequestArgs?.catalogue_number
            : xmlMode === "marketInfo" ? selectedMarketInfoRequestArgs?.catalogue_number : null,
          basicUdiDi:
            xmlMode === "bulkPatch"
              ? selectedBulkPatchBasicUdiDi || null
              : xmlMode === "bulkMarketInfo"
                ? selectedBulkMarketInfoBasicUdiDi || null
                : null,
        }
      : null;
  const {
    isUploadingSuccessXml,
    successXmlInputRef: postSuccessXmlInputRef,
    handleUploadSuccessXmlClick,
    handleSuccessXmlSelected: handlePostSuccessXmlSelected,
  } = useSuccessXmlUpload({
    scope: successXmlUploadScope,
    setError,
    setXmlActionMessage,
    setTestingSubjectSummaries,
    setXmlOperationAssessment,
    setXmlOperationAssessmentError,
    clearPreviewState: () => {
      setXmlBulkUdidiPostPreview(null);
      setXmlBulkPatchPreview(null);
      setXmlBulkMarketInfoPreview(null);
      setXmlPairPreview(null);
      setXmlMarketInfoPreview(null);
      setXmlPatchPreview(null);
      setSelectedPostXmlSectionId(null);
      setSelectedMarketInfoXmlSectionId(null);
      setSelectedPatchXmlSectionId(null);
    },
  });
  const isPostWorkspaceReady = Boolean(selectedXmlFamilySummary && selectedXmlVariantSummary);
  const canRunPostFromAssessment =
    isPostWorkspaceReady && xmlOperationAssessment?.status === "available";
  const canRunPatchFromAssessment =
    isPatchScenarioReady && xmlOperationAssessment?.status === "available";
  const canRunBulkUdidiPostFromAssessment =
    Boolean(selectedXmlVariantSummary) && (assessedBulkChildRecordCount ?? 0) > 0;
  const canRunBulkPatchFromAssessment =
    Boolean(selectedBulkPatchParentGroup) &&
    (xmlOperationAssessment?.status === "available" || xmlOperationAssessment?.status === "attention") &&
    (xmlOperationAssessment?.eligible_record_count ?? 0) > 0 &&
    canRunBulkPatch;
  const canRunBulkMarketInfoFromAssessment =
    Boolean(selectedBulkMarketInfoParentGroup) &&
    (xmlOperationAssessment?.status === "available" || xmlOperationAssessment?.status === "attention") &&
    (xmlOperationAssessment?.eligible_record_count ?? 0) > 0 &&
    canRunBulkMarketInfo &&
    isBulkMarketInfoScenarioReady;
  const xmlPreviewLines = resolveXmlPreviewLines({
    xmlMode,
    xmlPairPreview,
    selectedPostWorkspaceRecord,
    selectedXmlRecord,
    selectedXmlMarketInfoRecord,
    xmlMarketInfoPreview,
    xmlPatchPreview,
    selectedPatchScenarioId: selectedPatchScenario.id,
    selectedPatchScenarioStatus,
    selectedPatchScenarioTarget: selectedPatchScenario.target,
    patchVersionInput,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
    selectedXmlFamilyProductFamily: selectedXmlFamilySummary?.product_family ?? null,
    selectedXmlVariantProductVariant: selectedXmlVariantSummary?.product_variant ?? null,
    normalizedBulkRecordCount,
    selectedXmlChunkSequence,
  });
  const postXmlStructureSections = xmlMode === "post" ? extractXmlStructureSections(xmlPreviewLines) : [];
  const selectedPostXmlSection =
    xmlMode === "post"
      ? postXmlStructureSections.find((section) => section.id === selectedPostXmlSectionId) ?? postXmlStructureSections[0] ?? null
      : null;
  const postXmlPreviewLineRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const postXmlPreviewContainerRef = useRef<HTMLPreElement | null>(null);
  const marketInfoXmlStructureSections = xmlMode === "marketInfo" ? extractXmlStructureSections(xmlPreviewLines) : [];
  const selectedMarketInfoXmlSection =
    xmlMode === "marketInfo"
      ? marketInfoXmlStructureSections.find((section) => section.id === selectedMarketInfoXmlSectionId) ??
        marketInfoXmlStructureSections[0] ??
        null
      : null;
  const marketInfoXmlPreviewLineRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const marketInfoXmlPreviewContainerRef = useRef<HTMLPreElement | null>(null);
  const bulkMarketInfoXmlStructureSections = xmlMode === "bulkMarketInfo" ? extractXmlStructureSections(xmlPreviewLines) : [];
  const selectedBulkMarketInfoXmlSection =
    xmlMode === "bulkMarketInfo"
      ? bulkMarketInfoXmlStructureSections.find((section) => section.id === selectedBulkMarketInfoXmlSectionId) ??
        bulkMarketInfoXmlStructureSections[0] ??
        null
      : null;
  const bulkMarketInfoXmlPreviewLineRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const bulkMarketInfoXmlPreviewContainerRef = useRef<HTMLPreElement | null>(null);
  const bulkXmlStructureSections =
    xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" ? extractXmlStructureSections(xmlPreviewLines) : [];
  const selectedBulkXmlSection =
    xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch"
      ? bulkXmlStructureSections.find((section) => section.id === selectedBulkXmlSectionId) ?? bulkXmlStructureSections[0] ?? null
      : null;
  const bulkXmlPreviewLineRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const bulkXmlPreviewContainerRef = useRef<HTMLPreElement | null>(null);
  const patchXmlStructureSections = xmlMode === "patch" ? extractXmlStructureSections(xmlPreviewLines) : [];
  const selectedPatchXmlSection =
    xmlMode === "patch"
      ? patchXmlStructureSections.find((section) => section.id === selectedPatchXmlSectionId) ?? patchXmlStructureSections[0] ?? null
      : null;
  const patchXmlPreviewLineRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const patchXmlPreviewContainerRef = useRef<HTMLPreElement | null>(null);
  const selectedBatchValidation = resolveSelectedBatchValidation({
    xmlMode,
    xmlPairPreview,
    xmlMarketInfoPreview,
    xmlPatchPreview,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
  });
  const validationStatusLabel = selectedBatchValidation
    ? selectedBatchValidation.valid
      ? "Schema valid"
      : "Schema invalid"
    : "Awaiting validation";
  const selectedSchemaLabel = selectedBatchValidation
    ? formatSchemaPathForInlineNote(selectedBatchValidation.schema_path)
    : null;
  const genericPreviewTitle = resolveGenericPreviewTitle(xmlMode);
  const genericPreviewStatusMessage = resolveGenericPreviewStatusMessage({
    xmlMode,
    xmlMarketInfoPreview,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
  });
  const bulkChunkSummaryTitle = resolveBulkChunkSummaryTitle(xmlMode);
  const patchPreviewStatusMessage = xmlPatchPreview
    ? `Scenario-derived PATCH preview loaded for ${xmlPatchPreview.product_family} / ${xmlPatchPreview.product_variant} / ${xmlPatchPreview.catalogue_number}.`
    : hasLoadedPatchBaseline
      ? "No generated PATCH scenario preview loaded yet for the accepted device baseline."
      : hasSelectedPatchBaselinePost
        ? "Load the accepted baseline for this exact record before generating a PATCH scenario."
        : "No baseline POST is currently available for the selected family and variant.";
  const marketInfoPreviewStatusMessage = xmlMarketInfoPreview
    ? `Market Info preview generated for ${xmlMarketInfoPreview.product_family} / ${xmlMarketInfoPreview.product_variant} / ${xmlMarketInfoPreview.catalogue_number}.`
    : selectedTestingAnchor
      ? `Awaiting preview for ${selectedTestingAnchor.catalogue_number}.`
      : "No registered testing anchor is currently available for MARKET_INFO.PUT generation.";
  const bulkMarketInfoPreviewStatusMessage = xmlBulkMarketInfoPreview
    ? `Bulk Market Info preview generated for chunk ${xmlBulkMarketInfoPreview.selected_chunk_sequence} of ${xmlBulkMarketInfoPreview.chunk_count} with ${xmlBulkMarketInfoPreview.selected_chunk_record_count} device${xmlBulkMarketInfoPreview.selected_chunk_record_count === 1 ? "" : "s"}.`
    : selectedBulkMarketInfoParentGroup
      ? `Awaiting preview for ${selectedBulkMarketInfoSelectedCount} selected device${selectedBulkMarketInfoSelectedCount === 1 ? "" : "s"} under ${selectedBulkMarketInfoParentGroup.basic_udi_di}.`
      : "No registered Basic UDI-DI parent is currently available for bulk MARKET_INFO.PUT generation.";
  const bulkPreviewStructureTitle =
    xmlMode === "bulkPatch"
      ? "Bulk PATCH structure"
      : "Bulk DEVICE UDI-DI POST structure";
  const bulkPreviewStructureSubtitle =
    xmlMode === "bulkPatch"
      ? "Navigate the main batch PATCH message sections."
      : "Navigate the main batch POST message sections.";
  const xmlModeUi = resolveXmlModeUi(xmlMode);
  const xmlModeLabel = xmlModeUi.label;
  const xmlModeDescription = xmlModeUi.description;
  const xmlWorkspaceTitle = xmlModeUi.workspaceTitle;
  const xmlAssessmentTitle = xmlModeUi.assessmentTitle;
  const xmlAssessmentSummaryRows = resolveXmlAssessmentSummaryRows({
    xmlMode,
    xmlOperationAssessment,
    assessedPatchLatestAcceptedVersion,
    assessedPostReviewHistory,
    assessedPatchTrackedRegistration,
    assessedMarketInfoCurrentVersion,
    assessedSelectedBasicUdiDi,
    assessedLatestVersionSummary,
    assessedCurrentMarketInfoVersionSummary,
    assessedBulkParentGroupCount,
    assessedBulkChildRecordCount,
    assessedUnpostedParentGroupCount,
    assessmentEvidenceString,
    assessmentEvidenceBoolean,
    assessmentEvidenceNumber,
  });
  const activePreviewLabel =
    xmlMode === "post"
      ? "Post"
      : xmlMode === "marketInfo"
        ? "Market Info"
          : xmlMode === "patch"
            ? "Patch"
            : `${xmlMode === "bulkUdidiPost" ? "Bulk UDI-DI POST" : xmlMode === "bulkPatch" ? "Bulk PATCH" : "Bulk Market Info"} Chunk ${selectedXmlChunkSequence}`;
  const activePreviewFileName =
    xmlMode === "post"
      ? xmlPairPreview?.post_file_name ?? null
      : xmlMode === "marketInfo"
        ? xmlMarketInfoPreview?.file_name ?? null
          : xmlMode === "patch"
            ? xmlPatchPreview?.derived_patch_file_name ?? null
            : xmlMode === "bulkUdidiPost"
              ? xmlBulkUdidiPostPreview?.selected_chunk_file_name ?? null
              : xmlMode === "bulkPatch"
                ? xmlBulkPatchPreview?.selected_chunk_file_name ?? null
                : xmlBulkMarketInfoPreview?.selected_chunk_file_name ?? null;
  const canGenerateCurrentXml =
    xmlMode === "post"
      ? canRunPostFromAssessment
      : xmlMode === "marketInfo"
          ? isMarketInfoScenarioReady
          : xmlMode === "patch"
            ? canRunPatchFromAssessment
            : xmlMode === "bulkUdidiPost"
                ? canRunBulkUdidiPostFromAssessment && effectiveBulkUdidiPostCatalogueNumbers.length > 0
                : xmlMode === "bulkPatch"
                  ? canRunBulkPatchFromAssessment
                  : canRunBulkMarketInfoFromAssessment;
  const canDownloadCurrentXml =
    xmlMode === "post"
      ? Boolean(xmlPairPreview)
      : xmlMode === "marketInfo"
          ? Boolean(canRunMarketInfoFromAssessment && xmlMarketInfoPreview)
          : xmlMode === "patch"
            ? Boolean(hasLoadedPatchBaseline && hasCurrentGeneratedPatchPreview)
            : xmlMode === "bulkUdidiPost"
              ? canRunBulkUdidiPostFromAssessment && effectiveBulkUdidiPostCatalogueNumbers.length > 0
              : xmlMode === "bulkPatch"
                ? canRunBulkPatchFromAssessment
                : canRunBulkMarketInfoFromAssessment;
  useEffect(() => {
    if (xmlMode !== "post") {
      return;
    }
    if (postXmlStructureSections.length < 1) {
      setSelectedPostXmlSectionId(null);
      return;
    }
    if (!selectedPostXmlSectionId || !postXmlStructureSections.some((section) => section.id === selectedPostXmlSectionId)) {
      setSelectedPostXmlSectionId(postXmlStructureSections[0].id);
    }
  }, [xmlMode, postXmlStructureSections, selectedPostXmlSectionId]);

  useEffect(() => {
    if (xmlMode !== "post" || !selectedPostXmlSection) {
      return;
    }
    const container = postXmlPreviewContainerRef.current;
    const targetLine = postXmlPreviewLineRefs.current[selectedPostXmlSection.lineStart];
    if (!container || !targetLine) {
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = targetLine.getBoundingClientRect().top;
    const nextScrollTop = container.scrollTop + (targetTop - containerTop) - 12;
    container.scrollTo({ top: Math.max(nextScrollTop, 0), behavior: "auto" });
  }, [xmlMode, selectedPostXmlSection?.id, selectedPostXmlSection?.lineStart]);

  useEffect(() => {
    if (xmlMode !== "marketInfo") {
      return;
    }
    if (marketInfoXmlStructureSections.length < 1) {
      setSelectedMarketInfoXmlSectionId(null);
      return;
    }
    if (
      !selectedMarketInfoXmlSectionId ||
      !marketInfoXmlStructureSections.some((section) => section.id === selectedMarketInfoXmlSectionId)
    ) {
      setSelectedMarketInfoXmlSectionId(marketInfoXmlStructureSections[0].id);
    }
  }, [xmlMode, marketInfoXmlStructureSections, selectedMarketInfoXmlSectionId]);

  useEffect(() => {
    if (xmlMode !== "marketInfo" || !selectedMarketInfoXmlSection) {
      return;
    }
    const container = marketInfoXmlPreviewContainerRef.current;
    const targetLine = marketInfoXmlPreviewLineRefs.current[selectedMarketInfoXmlSection.lineStart];
    if (!container || !targetLine) {
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = targetLine.getBoundingClientRect().top;
    const nextScrollTop = container.scrollTop + (targetTop - containerTop) - 12;
    container.scrollTo({ top: Math.max(nextScrollTop, 0), behavior: "auto" });
  }, [xmlMode, selectedMarketInfoXmlSection?.id, selectedMarketInfoXmlSection?.lineStart]);

  useEffect(() => {
    if (xmlMode !== "bulkMarketInfo") {
      return;
    }
    if (bulkMarketInfoXmlStructureSections.length < 1) {
      setSelectedBulkMarketInfoXmlSectionId(null);
      return;
    }
    if (
      !selectedBulkMarketInfoXmlSectionId ||
      !bulkMarketInfoXmlStructureSections.some((section) => section.id === selectedBulkMarketInfoXmlSectionId)
    ) {
      setSelectedBulkMarketInfoXmlSectionId(bulkMarketInfoXmlStructureSections[0].id);
    }
  }, [xmlMode, bulkMarketInfoXmlStructureSections, selectedBulkMarketInfoXmlSectionId]);

  useEffect(() => {
    if (xmlMode !== "bulkMarketInfo" || !selectedBulkMarketInfoXmlSection) {
      return;
    }
    const container = bulkMarketInfoXmlPreviewContainerRef.current;
    const targetLine = bulkMarketInfoXmlPreviewLineRefs.current[selectedBulkMarketInfoXmlSection.lineStart];
    if (!container || !targetLine) {
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = targetLine.getBoundingClientRect().top;
    const nextScrollTop = container.scrollTop + (targetTop - containerTop) - 12;
    container.scrollTo({ top: Math.max(nextScrollTop, 0), behavior: "auto" });
  }, [xmlMode, selectedBulkMarketInfoXmlSection?.id, selectedBulkMarketInfoXmlSection?.lineStart]);

  useEffect(() => {
    if (xmlMode !== "bulkUdidiPost" && xmlMode !== "bulkPatch") {
      return;
    }
    if (bulkXmlStructureSections.length < 1) {
      setSelectedBulkXmlSectionId(null);
      return;
    }
    if (!selectedBulkXmlSectionId || !bulkXmlStructureSections.some((section) => section.id === selectedBulkXmlSectionId)) {
      setSelectedBulkXmlSectionId(bulkXmlStructureSections[0].id);
    }
  }, [xmlMode, bulkXmlStructureSections, selectedBulkXmlSectionId]);

  useEffect(() => {
    if ((xmlMode !== "bulkUdidiPost" && xmlMode !== "bulkPatch") || !selectedBulkXmlSection) {
      return;
    }
    const container = bulkXmlPreviewContainerRef.current;
    const targetLine = bulkXmlPreviewLineRefs.current[selectedBulkXmlSection.lineStart];
    if (!container || !targetLine) {
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = targetLine.getBoundingClientRect().top;
    const nextScrollTop = container.scrollTop + (targetTop - containerTop) - 12;
    container.scrollTo({ top: Math.max(nextScrollTop, 0), behavior: "auto" });
  }, [xmlMode, selectedBulkXmlSection?.id, selectedBulkXmlSection?.lineStart]);

  useEffect(() => {
    if (xmlMode !== "patch") {
      return;
    }
    if (patchXmlStructureSections.length < 1) {
      setSelectedPatchXmlSectionId(null);
      return;
    }
    if (!selectedPatchXmlSectionId || !patchXmlStructureSections.some((section) => section.id === selectedPatchXmlSectionId)) {
      setSelectedPatchXmlSectionId(patchXmlStructureSections[0].id);
    }
  }, [xmlMode, patchXmlStructureSections, selectedPatchXmlSectionId]);

  useEffect(() => {
    if (xmlMode !== "patch" || !selectedPatchXmlSection) {
      return;
    }
    const container = patchXmlPreviewContainerRef.current;
    const targetLine = patchXmlPreviewLineRefs.current[selectedPatchXmlSection.lineStart];
    if (!container || !targetLine) {
      return;
    }
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = targetLine.getBoundingClientRect().top;
    const nextScrollTop = container.scrollTop + (targetTop - containerTop) - 12;
    container.scrollTo({ top: Math.max(nextScrollTop, 0), behavior: "auto" });
  }, [xmlMode, selectedPatchXmlSection?.id, selectedPatchXmlSection?.lineStart]);
  const orderedVariantMappings = [...variantMappings].sort((left, right) => {
    const order = { matched: 0, unmatched: 1, excluded: 2 };
    return order[left.match_status] - order[right.match_status];
  });
  const selectedValidationVariantMappings = orderedVariantMappings.filter((mapping) => {
    if (!matchesModelSearch(validationModelSearch, workbookFamilyLabel(mapping.workbook), mapping.device_model, mapping.basic_udi_di)) return false;
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
  const importedWorkbookRowLeader =
    [...importedWorkbooks].sort((left, right) => right.row_count - left.row_count)[0] ?? null;

  function currentMarketInfoScenarioInputs(): Array<{ country: string; original_placed_on_market: boolean }> {
    return normalizedMarketInfoScenarioItems;
  }

  function currentPatchScenarioInputs(): Record<string, unknown> {
    return buildPatchScenarioInputs({
      scenarioId: selectedPatchScenario.id,
      implemented: selectedPatchScenario.implemented,
      tradeName: patchTradeNameInput,
      warningCode: patchWarningCodeInput,
      warningComment: patchWarningCommentInput,
      baseQuantity: patchBaseQuantityInput,
      sterile: patchSterileInput,
      containsLatex: patchLatexInput,
      statusCode: patchStatusCodeInput,
      storageConditions: patchStorageConditionInputs,
    });
  }

  async function resolveBulkPatchCatalogueNumbers(): Promise<string[]> {
    return resolveBulkCatalogueNumbers({
      hasParent: Boolean(selectedBulkPatchParentGroup),
      scopeMode: bulkPatchScopeMode,
      postedCatalogueNumbers: bulkPatchPostedCatalogueNumbers,
      effectiveCatalogueNumbers: effectiveBulkPatchCatalogueNumbers,
      selectedCatalogueNumbers: selectedBulkPatchCatalogueNumbers,
      importedMatchedCatalogueNumbers: bulkPatchImportedMatchedCatalogueNumbers,
    });
  }

  async function resolveBulkMarketInfoCatalogueNumbers(): Promise<string[]> {
    return resolveBulkCatalogueNumbers({
      hasParent: Boolean(selectedBulkMarketInfoParentGroup),
      scopeMode: bulkMarketInfoScopeMode,
      postedCatalogueNumbers: bulkMarketInfoPostedCatalogueNumbers,
      effectiveCatalogueNumbers: effectiveBulkMarketInfoCatalogueNumbers,
      selectedCatalogueNumbers: selectedBulkMarketInfoCatalogueNumbers,
      importedMatchedCatalogueNumbers: bulkMarketInfoImportedMatchedCatalogueNumbers,
    });
  }

  const { generateXmlPreview, downloadXmlRecord } = useXmlPreviewGeneration({
    previewSelectionKey: JSON.stringify([
      activeTab, selectedXmlRecordKey,
      bulkPatchScopeMode, effectiveBulkPatchCatalogueNumbers, selectedBulkPatchCatalogueNumbers,
      bulkPatchImportedMatchedCatalogueNumbers,
      bulkMarketInfoScopeMode, effectiveBulkMarketInfoCatalogueNumbers, selectedBulkMarketInfoCatalogueNumbers,
      bulkMarketInfoImportedMatchedCatalogueNumbers,
    ]),
    acceptedStateToken: testingSubjectSummaries,
    xmlMode,
    selectedXmlFamilySummary,
    selectedXmlVariantSummary,
    selectedXmlRecord,
    selectedMarketInfoRequestArgs,
    selectedPairRequestArgs,
    selectedPatchScenarioId: selectedPatchScenario.id,
    patchVersionInput,
    normalizedMarketInfoVersion,
    currentMarketInfoScenarioInputs,
    currentPatchScenarioInputs,
    normalizedBulkRecordCount,
    selectedXmlChunkSequence,
    effectiveBulkUdidiPostCatalogueNumbers,
    selectedBulkMarketInfoParentGroup,
    normalizedBulkMarketInfoScenarioItems,
    resolveBulkMarketInfoCatalogueNumbers,
    selectedBulkPatchParentGroup,
    resolveBulkPatchCatalogueNumbers,
    setXmlBulkUdidiPostPreview,
    setXmlPairPreview,
    setXmlMarketInfoPreview,
    setXmlPatchPreview,
    setXmlBulkPatchPreview,
    setXmlBulkMarketInfoPreview,
    setError,
    setXmlActionMessage,
    setIsGeneratingXml,
    xmlPairPreview,
    xmlMarketInfoPreview,
    xmlPatchPreview,
    xmlBulkUdidiPostPreview,
    xmlBulkPatchPreview,
    xmlBulkMarketInfoPreview,
    selectedXmlMarketInfoRecord,
    selectedXmlPairRecord,
    setIsDownloadingXml,
  });

  return (
    <main className="app-shell">
      <EnvironmentBanner />
      <nav className="top-nav">
        <div className="brand-block">
          <span className="brand-kicker">Regulatory Data Preparation</span>
          <div className="nav-title-block">
            <strong>EUDAMED Profiling Workspace</strong>
            <span className="nav-subtitle">
              Submission data, validation, testing, and tracking
            </span>
          </div>
        </div>
        <div className="nav-links nav-links-grouped">
          <div className="nav-group">
            <span className="nav-group-label">Data Views</span>
            <div className="nav-group-buttons">
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
                className={activeTab === "registrationState" ? "nav-link active" : "nav-link"}
                type="button"
                onClick={() => setActiveTab("registrationState")}
              >
                Registration State
              </button>
            </div>
          </div>
          <div className="nav-group">
            <span className="nav-group-label">Testing Workspaces</span>
            <div className="nav-group-buttons">
              <button
                className={activeTab === "xml" ? "nav-link active nav-link-primary" : "nav-link nav-link-primary"}
                type="button"
                onClick={() => setActiveTab("xml")}
              >
                EUDAMED Testing
              </button>
              <button
                className={activeTab === "testingSummary" ? "nav-link active" : "nav-link"}
                type="button"
                onClick={() => setActiveTab("testingSummary")}
              >
                Testing Summary
              </button>
            </div>
          </div>
          <div className="nav-group nav-group-reference">
            <span className="nav-group-label">Documentation</span>
            <div className="nav-group-buttons">
              <button
                className={activeTab === "documentation" ? "nav-link active nav-link-reference" : "nav-link nav-link-reference"}
                type="button"
                onClick={() => setActiveTab("documentation")}
              >
                Documentation
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy-block">
          {activeTab === "workbooks" ? (
            <>
              <p className="eyebrow">Operational Data</p>
              <h1>Submission Data</h1>
              <p className="hero-copy hero-copy-compact">
                Review imported workbook state, device coverage, XML readiness, duplicates, and current SQLite status.
              </p>
            </>
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <p className="eyebrow">Canonical Validation</p>
              <h1>Canonical Validation</h1>
              <p className="hero-copy">
                Review family and variant readiness, then inspect source-to-canonical mapping before XML generation.
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <p className="eyebrow">EUDAMED Testing</p>
              <h1>EUDAMED Testing Workspace</h1>
              <p className="hero-copy">
                Assess availability, generate POST, PATCH, and bulk XML, validate locally, and prepare controlled Playground test files.
              </p>
            </>
          ) : null}
          {activeTab === "testingSummary" ? (
            <>
              <p className="eyebrow">Testing Summary</p>
              <h1>EUDAMED Testing Snapshot</h1>
              <p className="hero-copy">
                Review recorded testing outcomes, Basic UDI-DI registration status, and the next available POST and PATCH actions.
              </p>
            </>
          ) : null}
          {activeTab === "registrationState" ? (
            <>
              <p className="eyebrow">Registration State</p>
              <h1>Registration State</h1>
              <p className="hero-copy">
                Review family and variant registration status, Basic UDI-DI coverage, and the next available POST, PATCH, and Market Info actions.
              </p>
            </>
          ) : null}
          {activeTab === "documentation" ? (
            <>
              <p className="eyebrow">Documentation</p>
              <h1>Architecture And Workflow Notes</h1>
              <p className="hero-copy">
                Review the current architecture position, workflow design, implementation notes, and roadmap.
              </p>
            </>
          ) : null}
        </div>
        <aside className="status-card">
          {activeTab === "workbooks" ? (
            isLoadingWorkbookImportMonitoring ? (
              <>
                <span className="status-label">Data Snapshot</span>
                <span className={`status-pill ${submissionSnapshotStatus.className}`}>{submissionSnapshotStatus.label}</span>
                <p className="status-detail status-detail-tight">{submissionSnapshotStatus.detail}</p>
              </>
            ) : (
              <>
                <span className="status-label">Data Snapshot</span>
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
                    Last import: <span className="status-detail-emphasis">{formatIsoDateTime(latestImportBatch.imported_at)}</span>.
                  </p>
                ) : (
                  <p className="status-detail status-detail-tight">
                    {submissionSnapshotStatus.detail}
                  </p>
                )}
                {workbookImportActionMessage ? <p className="status-detail status-detail-tight">{workbookImportActionMessage}</p> : null}
              </>
            )
          ) : null}
          {activeTab === "canonicalValidation" ? (
            <>
              <span className="status-label">Validation Snapshot</span>
              <span className="status-pill ok">Validation ready</span>
              <p className="status-detail">
                {latestImportBatch
                  ? <>
                      Showing validated data mapped from source Excel for XML generation in{" "}
                      <span className="status-detail-emphasis">batch #{latestImportBatch.import_batch_id}</span>.
                    </>
                  : "Showing validated data mapped from source Excel for XML generation."}
              </p>
            </>
          ) : null}
          {activeTab === "xml" ? (
            <>
              <span className="status-label">Testing Snapshot</span>
              <span className={xmlReadyRecords.length ? "status-pill ok" : "status-pill warn"}>
                {xmlReadyRecords.length ? "Testing workspace ready" : "Testing workspace blocked"}
              </span>
              <p className="status-detail">
                {xmlReadyRecords.length
                  ? <>
                      <span className="status-detail-emphasis">{xmlReadyRecords.length}</span>{" "}
                      XML-ready record{xmlReadyRecords.length === 1 ? "" : "s"} available across the testing workspaces.
                    </>
                  : "Waiting for validation-ready records."}
              </p>
            </>
          ) : null}
          {activeTab === "testingSummary" ? (
            <>
              <span className="status-label">Testing state</span>
              <span className="status-pill ok">SQLite live</span>
              <p className="status-detail">
                {testingSummaryWorkspaceSummary
                  ? `${testingSummaryWorkspaceSummary.successful_device_post_count + testingSummaryWorkspaceSummary.successful_child_post_count + testingSummaryWorkspaceSummary.successful_patch_count} successful testing event${testingSummaryWorkspaceSummary.successful_device_post_count + testingSummaryWorkspaceSummary.successful_child_post_count + testingSummaryWorkspaceSummary.successful_patch_count === 1 ? "" : "s"} recorded in the current scope.`
                  : "Testing summary loads the current SQLite-backed Playground state."}
              </p>
            </>
          ) : null}
          {activeTab === "registrationState" ? (
            <>
              <span className="status-label">Registration state</span>
              <span className="status-pill ok">SQLite live</span>
              <p className="status-detail">
                <span className="status-detail-emphasis">{registrationStateRows.length}</span> parent group
                {registrationStateRows.length === 1 ? "" : "s"} tracked in the current scope.
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
          <section className="submission-data-tabs" aria-label="Submission Data workspace">
            <button
              className={submissionDataTab === "snapshot" ? "submission-data-tab active" : "submission-data-tab"}
              type="button"
              onClick={() => setSubmissionDataTab("snapshot")}
            >
              Data Snapshot
            </button>
            <button
              className={submissionDataTab === "activity" ? "submission-data-tab active" : "submission-data-tab"}
              type="button"
              onClick={() => setSubmissionDataTab("activity")}
            >
              EUDAMED Activity
            </button>
          </section>
          {submissionDataTab === "activity" ? <SubmissionBatchHistory modelOptions={xmlModelOptions} /> : null}
          {submissionDataTab === "snapshot" ? (
            <>
          {!isLoadingWorkbookImportMonitoring && !hasWorkbookImportSnapshot && !workbookImportSummaryError ? (
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
              <DeviceModelFilter options={deviceSubjectModelOptions} family={selectedDeviceSubjectFamily} variant={selectedDeviceSubjectVariant}
                onChange={(family, variant) => { setSelectedDeviceSubjectFamily(family); setSelectedDeviceSubjectVariant(variant); }} />
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
                  <span>Operational Data Rows</span>
                </div>
                <div className="queue-chip">
                  <strong>{latestImportBatch ? testingStateTables.reduce((sum, table) => sum + table.row_count, 0) : "N/A"}</strong>
                  <span>Testing Data Rows</span>
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
              <DeviceModelFilter options={xmlModelOptions} family={selectedValidationFamily} variant={selectedValidationVariant}
                searchQuery={validationModelSearch}
                onSearchChange={(query) => {
                  setValidationModelSearch(query);
                  if (query.trim()) { setSelectedValidationFamily(""); setSelectedValidationVariant(""); }
                }}
                onChange={(family, variant) => { setSelectedValidationFamily(family); setSelectedValidationVariant(variant); }} />
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
              <p className="panel-copy">No rows match the selected device model and search.</p>
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
            <div className="summary-card summary-card-kpi summary-card-kpi-primary">
              <span className="summary-label">Validated rows</span>
              <strong>{xmlValidationRecords.length}</strong>
              <p>Rows available from the current Canonical Validation workspace.</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-post">
              <span className="summary-label">XML-ready rows</span>
              <strong>{xmlReadyRecords.length}</strong>
              <p>Rows currently eligible for EUDAMED XML generation workflows.</p>
            </div>
            <div className="summary-card summary-card-kpi summary-card-kpi-warn">
              <span className="summary-label">Blocked rows</span>
              <strong>{xmlBlockedRecords.length}</strong>
              <p>Rows that would need canonical validation fixes before XML generation should include them.</p>
            </div>
            <div
              className={`summary-card summary-card-kpi ${
                xmlMode === "patch" || xmlMode === "bulkPatch"
                  ? "summary-card-kpi-patch"
                  : xmlMode === "post" || xmlMode === "bulkUdidiPost"
                    ? "summary-card-kpi-post"
                    : "summary-card-kpi-secondary"
              }`}
            >
              <span className="summary-label">Current mode</span>
              <strong>{xmlModeLabel}</strong>
              <p>{xmlModeDescription}</p>
            </div>
          </section>

          {(() => {
            const xmlOperationSummary = (() => {
              if (xmlMode === "post") {
                return {
                  count: xmlOperationAssessment?.eligible_record_count ?? (selectedPostWorkspaceRecord ? 1 : 0),
                  noun: "POST candidate",
                };
              }
              if (xmlMode === "patch") {
                return {
                  count: xmlOperationAssessment?.eligible_record_count ?? (selectedXmlRecord ? 1 : 0),
                  noun: "PATCH candidate",
                };
              }

              if (xmlMode === "bulkUdidiPost") {
                return {
                  count: assessedBulkChildRecordCount ?? selectedBulkEligibleUdidiPostCount,
                  noun: "child POST record",
                };
              }
              if (xmlMode === "bulkPatch") {
                return {
                  count: xmlOperationAssessment?.eligible_record_count ?? selectedBulkPatchSelectedCount,
                  noun: "PATCH record",
                };
              }
              return {
                count: xmlReadyRecords.length,
                noun: "XML-ready row",
              };
            })();
            const xmlScopeSummary = (() => {
              if (xmlMode === "post") {
                return {
                  count: selectedExactAvailablePostCount,
                  noun: "available POST in variant",
                };
              }
              if (xmlMode === "patch") {
                return {
                  count: selectedPatchTrackedBaseCount,
                  noun: "tracked PATCH base in variant",
                };
              }

              if (xmlMode === "bulkUdidiPost") {
                return {
                  count: assessedBulkChildRecordCount ?? selectedBulkEligibleUdidiPostCount,
                  noun: "eligible child row in variant",
                };
              }
              if (xmlMode === "bulkPatch") {
                return {
                  count: selectedBulkPatchEligibleCount,
                  noun: "posted row in scope",
                };
              }
              return {
                count: xmlReadyRecords.length,
                noun: "XML-ready row",
              };
            })();

            const xmlWorkspaceStatus =
              xmlOperationAssessment
                ? {
                    label:
                      xmlOperationAssessment.status === "available"
                        ? "Ready"
                        : xmlOperationAssessment.status === "attention"
                          ? "Warning"
                          : "Blocked",
                    className:
                      xmlOperationAssessment.status === "available"
                        ? "ok"
                        : xmlOperationAssessment.status === "attention"
                          ? "warn"
                          : "danger",
                    detail: `${xmlOperationSummary.count} ${xmlOperationSummary.count === 1 ? "next" : ""} ${xmlOperationSummary.noun}${xmlOperationSummary.count === 1 ? "" : "s"}`.replace("  ", " "),
                  }
                : xmlReadyRecords.length === 0
                  ? { label: "Blocked", className: "danger", detail: "No XML-ready rows" }
                  : xmlBlockedRecords.length > 0
                    ? { label: "Warning", className: "warn", detail: `${xmlBlockedRecords.length} excluded row${xmlBlockedRecords.length === 1 ? "" : "s"}` }
                    : { label: "Ready", className: "ok", detail: `${xmlReadyRecords.length} XML-ready row${xmlReadyRecords.length === 1 ? "" : "s"}` };
            const operationMetricLabel =
              xmlMode === "post"
                ? "next POST candidate"
                : xmlMode === "patch"
                  ? "next PATCH candidate"
                  : xmlMode === "bulkUdidiPost"
                      ? "next child POST scope"
                      : xmlMode === "bulkPatch"
                        ? "next PATCH scope"
                        : "next-action count";

            return (
          <section className="panel scope-banner-panel">
            <div className="device-subject-summary-head">
              <div>
                <span className="section-kicker">Validation Status</span>
                <strong>
                  {selectedXmlVariant
                    ? `${selectedXmlFamilyLabel} / ${selectedXmlVariantLabel}`
                    : selectedXmlFamilyLabel}
                </strong>
                <p className="panel-copy">
                  The selected {xmlModeLabel} operation is summarised below with the next recommended action and the current family/variant scope.
                </p>
              </div>
              <div className="operation-summary-pill-row">
                <span className={`status-pill ${xmlWorkspaceStatus.className} compact`}>
                  {xmlWorkspaceStatus.label} · {xmlWorkspaceStatus.detail}
                </span>
                <span className="status-pill ok compact">
                  In scope · {xmlScopeSummary.count} {xmlScopeSummary.noun}{xmlScopeSummary.count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className="device-subject-metric-grid">
              <div className="queue-chip">
                <strong>{xmlOperationSummary.count}</strong>
                <span>{operationMetricLabel}</span>
              </div>
              <div className="queue-chip">
                <strong>{xmlScopeSummary.count}</strong>
                <span>rows in scope</span>
              </div>
              <div className="queue-chip">
                <strong>{selectedXmlVariantSummaries.length}</strong>
                <span>variants in selected family</span>
              </div>
              <div className="queue-chip">
                <strong>{xmlBlockedRecords.length}</strong>
                <span>{xmlBlockedRecords.length ? "excluded rows" : "rows excluded"}</span>
              </div>
            </div>
          </section>
            );
          })()}

          <DeviceModelSelector
            options={xmlModelOptions}
            selectedFamily={selectedXmlFamilySummary?.product_family ?? null}
            selectedVariant={selectedXmlVariantSummary?.product_variant ?? null}
            onSelect={(family, variant) => {
              setSelectedXmlFamily(family);
              setSelectedXmlVariant(variant);
            }}
          />

          <section className="panel xml-full-workspace-panel">
            <div className="section-heading">
              <div>
                <span className="section-kicker">XML Workspace</span>
                <h2>{xmlWorkspaceTitle}</h2>
              </div>
            </div>
	            <div className="xml-header-band">
	              <div className="xml-mode-groups">
	                <div className="xml-mode-group">
	                  <div className="xml-mode-group-head">
	                    <span className="section-kicker">Single device</span>
	                  </div>
	                  <div className="xml-mode-toggle xml-top-tabs">
                    <button
                      className={xmlMode === "post" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                      type="button"
                      onClick={() => setXmlMode("post")}
                    >
                      Single POST
                    </button>
	                    <button
	                      className={xmlMode === "patch" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
	                      type="button"
	                      onClick={() => setXmlMode("patch")}
	                    >
	                      Single PATCH
	                    </button>
	                  </div>
	                </div>
	                <div className="xml-mode-group">
	                  <div className="xml-mode-group-head">
                    <span className="section-kicker">Multiple devices</span>
                  </div>
                  <div className="xml-mode-toggle xml-top-tabs">
                    <button
                      className={xmlMode === "bulkUdidiPost" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
                      type="button"
                      onClick={() => setXmlMode("bulkUdidiPost")}
                    >
                      Bulk POST
                    </button>
	                    <button
	                      className={xmlMode === "bulkPatch" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
	                      type="button"
	                      onClick={() => setXmlMode("bulkPatch")}
	                    >
	                      Bulk PATCH
	                    </button>
	                  </div>
	                </div>
	                <div className="xml-mode-group">
	                  <div className="xml-mode-group-head">
	                    <span className="section-kicker">Market info</span>
	                  </div>
	                  <div className="xml-mode-toggle xml-top-tabs xml-top-tabs-two-up">
	                    <button
	                      className={xmlMode === "marketInfo" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
	                      type="button"
	                      onClick={() => setXmlMode("marketInfo")}
	                    >
	                      Single Market Info
	                    </button>
	                    <button
	                      className={xmlMode === "bulkMarketInfo" ? "action-button xml-mode-button active" : "ghost-button xml-mode-button"}
	                      type="button"
	                      onClick={() => setXmlMode("bulkMarketInfo")}
	                    >
	                      Bulk Market Info
	                    </button>
	                  </div>
	                </div>
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
                        ? selectedXmlFamilyLabel
                        : xmlMode === "patch" && !hasLoadedPatchBaseline
                          ? "No accepted baseline"
                          : selectedTestingAnchor?.product_family ?? "No testing anchor"
                      : selectedXmlFamilyLabel}
                  </strong>
                  <p>
                    {xmlMode === "post" || xmlMode === "marketInfo" || xmlMode === "patch"
                      ? xmlMode === "post"
                        ? selectedXmlVariantLabel
                        : xmlMode === "patch" && !hasLoadedPatchBaseline
                          ? "Select a variant with an XML-ready POST record"
                          : selectedTestingAnchor?.product_variant ?? "No anchor variant"
                      : selectedXmlVariantLabel}
                  </p>
                </div>
              </div>
            </div>
            {xmlMode === "marketInfo" || xmlMode === "patch" ? (
              <div className="xml-anchor-panel">
                <div className="xml-anchor-strip">
                  <div className="xml-anchor-header">
                    <div>
                      <span className="section-kicker">Parent Registration</span>
                      <h3>Registered Anchor</h3>
                    </div>
                    <span className="status-pill ok compact">
                      {selectedTestingAnchor?.eudamed_status ?? "Loading anchor"}
                    </span>
                  </div>
                  {selectedTestingAnchor ? (
                    <div className="queue-summary xml-anchor-summary xml-anchor-summary-compact">
                      <div className="queue-chip">
                        <strong>{selectedTestingAnchor.catalogue_number}</strong>
                        <span>Parent catalogue</span>
                      </div>
                      <div className="queue-chip">
                        <strong>{selectedTestingAnchor.primary_udi_di}</strong>
                        <span>Device UDI-DI</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                {!selectedTestingAnchor ? (
                  <p className="panel-copy">The accepted baseline device anchor has not loaded yet.</p>
                ) : null}
              </div>
            ) : null}
            {(xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" || xmlMode === "bulkMarketInfo") && selectedXmlVariantSummary ? (
              xmlMode === "bulkUdidiPost" ? (
                <div className="draft-card bulk-patch-summary-bar">
                  <div className="draft-card-head">
                    <strong>Bulk UDI-DI POST summary</strong>
                    <span className={selectedBulkRecordCount > 0 ? "status-pill ok compact" : "status-pill warn compact"}>
                      {selectedBulkRecordCount > 0
                        ? `${selectedBulkRecordCount} device${selectedBulkRecordCount === 1 ? "" : "s"}`
                        : "No devices selected"}
                      </span>
                  </div>
                  {isLoadingXmlOperationAssessment ? (
                    <div className="xml-refresh-indicator" aria-live="polite">
                      <strong>Refreshing...</strong>
                      <span>Updating the bulk DEVICE UDI-DI POST scope for the selected family and variant.</span>
                    </div>
                  ) : null}
                  <div className="bulk-patch-summary-row">
                    <div className="bulk-patch-summary-metrics">
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Eligible child devices</strong>
                        <span>{selectedBulkEligibleUdidiPostCount || "None available"}</span>
                        {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Number of devices</strong>
                        <span>{selectedBulkRecordCount || "Not selected"}</span>
                        {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Variant</strong>
                        <span>{selectedXmlFamilySummary?.product_family} / {selectedXmlVariantSummary.product_variant}</span>
                        {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Preview chunk</strong>
                        <span>Chunk {selectedXmlChunkSequence} of {selectedBulkChunkCount}</span>
                        {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                      </div>
                    </div>
                  </div>
                  <p className="panel-copy bulk-patch-summary-status">
                    {selectedXmlVariantSummary.xml_blocked_records} row{selectedXmlVariantSummary.xml_blocked_records === 1 ? "" : "s"} remain excluded until resolved.
                  </p>
                </div>
              ) : xmlMode === "bulkPatch" ? (
              <div className="draft-card bulk-patch-summary-bar">
                <div className="draft-card-head">
                  <strong>Bulk PATCH summary</strong>
                  <span className={selectedBulkPatchSelectedCount > 0 ? "status-pill ok compact" : "status-pill warn compact"}>
                    {selectedBulkPatchSelectedCount > 0
                      ? `${selectedBulkPatchSelectedCount} child device${selectedBulkPatchSelectedCount === 1 ? "" : "s"}`
                      : "No posted devices"}
                    </span>
                </div>
                {isLoadingXmlOperationAssessment ? (
                  <div className="xml-refresh-indicator" aria-live="polite">
                    <strong>Refreshing...</strong>
                    <span>Updating the bulk PATCH scope for the selected family and variant.</span>
                  </div>
                ) : null}
                <div className="bulk-patch-summary-row">
                  <div className="bulk-patch-summary-metrics">
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>Basic UDI-DI</strong>
                      <span>{selectedBulkPatchParentGroup?.basic_udi_di ?? "No posted parent"}</span>
                      {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                    </div>
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>Number of devices</strong>
                      <span>{selectedBulkPatchSelectedCount > 0 ? selectedBulkPatchSelectedCount : "No posted devices"}</span>
                      {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                    </div>
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>PATCH option</strong>
                      <span>{patchScenarioOptionLabel(selectedPatchScenario)}</span>
                      {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                    </div>
                    <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                      <strong>Scope</strong>
                      <span>{selectedBulkPatchSelectedCount > 0 ? bulkPatchScopeLabel : "Not available"}</span>
                      {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                    </div>
                  </div>
                </div>
                <p className="panel-copy bulk-patch-summary-status">{bulkPatchActionStatus}</p>
              </div>
              ) : (
                <div className="draft-card bulk-patch-summary-bar market-info-summary-bar">
                  <div className="draft-card-head">
                    <strong>Bulk Market Info summary</strong>
                    <span className={selectedBulkMarketInfoSelectedCount > 0 ? "status-pill ok compact" : "status-pill warn compact"}>
                      {selectedBulkMarketInfoSelectedCount > 0
                        ? `${selectedBulkMarketInfoSelectedCount} child device${selectedBulkMarketInfoSelectedCount === 1 ? "" : "s"}`
                        : "No posted devices"}
                    </span>
                  </div>
                  <div className="bulk-patch-summary-row">
                    <div className="bulk-patch-summary-metrics">
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Basic UDI-DI</strong>
                        <span>{selectedBulkMarketInfoParentGroup?.basic_udi_di ?? "No posted parent"}</span>
                        {isLoadingXmlOperationAssessment ? <span className="xml-refresh-inline">Refreshing...</span> : null}
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Devices selected</strong>
                        <span>{selectedBulkMarketInfoSelectedCount > 0 ? selectedBulkMarketInfoSelectedCount : "No posted devices"}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Current countries</strong>
                        <span>{selectedBulkMarketInfoCurrentItems.length}</span>
                      </div>
                      <div className="workflow-note patch-readiness-note bulk-patch-summary-tile">
                        <strong>Proposed countries</strong>
                        <span>{normalizedBulkMarketInfoScenarioItems.length}</span>
                      </div>
                    </div>
                  </div>
                  <p className="panel-copy bulk-patch-summary-status">{bulkMarketInfoReadinessMessage}</p>
                </div>
              )
            ) : null}
            {(
              <XmlOperationAssessmentPanel
                xmlMode={xmlMode}
                xmlAssessmentTitle={xmlAssessmentTitle}
                isLoadingXmlOperationAssessment={isLoadingXmlOperationAssessment}
                xmlOperationAssessment={xmlOperationAssessment}
                statusClassName={
                  isLoadingXmlOperationAssessment
                    ? "status-pill warn compact"
                    : xmlOperationAssessment
                      ? `status-pill ${operationAssessmentStatusClass(xmlOperationAssessment.status)} compact`
                      : "status-pill warn compact"
                }
                statusLabel={
                  isLoadingXmlOperationAssessment
                    ? "Assessing"
                    : xmlOperationAssessment
                      ? operationAssessmentStatusLabel(xmlOperationAssessment.status)
                      : "Unavailable"
                }
                xmlAssessmentSummaryRows={xmlAssessmentSummaryRows}
                xmlOperationAssessmentError={xmlOperationAssessmentError}
                hasResolvedPostAssessmentCandidate={hasResolvedPostAssessmentCandidate}
                assessedPostCandidateCatalogueNumber={assessedPostCandidateCatalogueNumber}
                assessedPostCandidatePrimaryUdiDi={assessedPostCandidatePrimaryUdiDi}
                selectedXmlFamily={selectedXmlFamilySummary?.product_family ?? null}
                selectedXmlVariant={selectedXmlVariantSummary?.product_variant ?? null}
                selectedBulkEligiblePostCount={selectedBulkEligiblePostCount}
                selectedXmlVariantXmlReadyRecords={selectedXmlVariantSummary?.xml_ready_records ?? 0}
                selectedXmlVariantBlockedRecords={selectedXmlVariantSummary?.xml_blocked_records ?? 0}
                selectedXmlVariantTotalRecords={selectedXmlVariantSummary?.total_records ?? 0}
              />
            )}
            {xmlMode === "post" ? (
              <PostPreviewPanel
                postSuccessXmlInputRef={postSuccessXmlInputRef}
                handlePostSuccessXmlSelected={handlePostSuccessXmlSelected}
                canGenerateCurrentXml={canGenerateCurrentXml}
                canDownloadCurrentXml={canDownloadCurrentXml}
                isGeneratingXml={isGeneratingXml}
                isDownloadingXml={isDownloadingXml}
                isUploadingSuccessXml={isUploadingSuccessXml}
                onGeneratePreview={() => void generateXmlPreview()}
                onDownload={() => void downloadXmlRecord()}
                onUploadClick={handleUploadSuccessXmlClick}
                xmlActionMessage={xmlActionMessage}
                isRefreshing={isLoadingXmlOperationAssessment}
                xmlPairPreview={xmlPairPreview}
                selectedPostWorkspaceRecord={selectedPostWorkspaceRecord}
                activePreviewLabel={activePreviewLabel}
                selectedBatchValidation={selectedBatchValidation}
                validationStatusLabel={validationStatusLabel}
                selectedSchemaLabel={selectedSchemaLabel}
                activePreviewFileName={activePreviewFileName}
                postXmlStructureSections={postXmlStructureSections}
                selectedPostXmlSection={selectedPostXmlSection}
                onSelectSection={setSelectedPostXmlSectionId}
                xmlPreviewLines={xmlPreviewLines}
                postXmlPreviewLineRefs={postXmlPreviewLineRefs}
                postXmlPreviewContainerRef={postXmlPreviewContainerRef}
              />
            ) : (
            <div
              className={
                xmlMode === "patch"
                  ? "xml-focus-layout patch-focus-layout"
                  : xmlMode === "marketInfo"
                    ? "xml-focus-layout market-info-focus-layout"
                  : "xml-focus-layout bulk-patch-focus-layout"
              }
            >
              <div className="xml-preview-surface">
                {xmlMode === "patch" ? (
                  <PatchPreviewPanel
                    postSuccessXmlInputRef={postSuccessXmlInputRef}
                    handlePostSuccessXmlSelected={handlePostSuccessXmlSelected}
                    canGenerateCurrentXml={canGenerateCurrentXml}
                    canDownloadCurrentXml={canDownloadCurrentXml}
                    isGeneratingXml={isGeneratingXml}
                    isDownloadingXml={isDownloadingXml}
                    isUploadingSuccessXml={isUploadingSuccessXml}
                    onGeneratePreview={() => void generateXmlPreview()}
                    onDownload={() => void downloadXmlRecord()}
                    onUploadClick={handleUploadSuccessXmlClick}
                    xmlActionMessage={xmlActionMessage}
                    isRefreshing={isLoadingXmlOperationAssessment}
                    patchPreviewStatusMessage={patchPreviewStatusMessage}
                    activePreviewLabel={activePreviewLabel}
                    selectedBatchValidation={selectedBatchValidation}
                    validationStatusLabel={validationStatusLabel}
                    selectedSchemaLabel={selectedSchemaLabel}
                    activePreviewFileName={activePreviewFileName}
                    patchXmlStructureSections={patchXmlStructureSections}
                    selectedPatchXmlSection={selectedPatchXmlSection}
                    onSelectSection={setSelectedPatchXmlSectionId}
                    xmlPreviewLines={xmlPreviewLines}
                    patchXmlPreviewLineRefs={patchXmlPreviewLineRefs}
                    patchXmlPreviewContainerRef={patchXmlPreviewContainerRef}
                  />
                ) : xmlMode === "marketInfo" ? (
                  <>
                    <MarketInfoScenarioCard
                      countryReference={marketCountryReference}
                      catalogueNumber={selectedTestingAnchor?.catalogue_number ?? null}
                      primaryUdiDi={selectedTestingAnchor?.primary_udi_di ?? null}
                      marketInfoDeviceOptions={selectedPatchDeviceRecords
                        .filter((record): record is typeof record & { catalogue_number: string } => Boolean(record.catalogue_number))
                        .map((record) => ({
                          catalogueNumber: record.catalogue_number,
                          primaryUdiDi: record.primary_udi_di,
                        }))}
                      onMarketInfoDeviceChange={(catalogueNumber) => {
                        setSelectedXmlRecordKey(catalogueNumber);
                        setMarketInfoScenarioItems([]);
                        setXmlMarketInfoPreview(null);
                      }}
                      productFamily={selectedTestingAnchor?.product_family ?? selectedXmlFamilyLabel}
                      productVariant={selectedTestingAnchor?.product_variant ?? selectedXmlVariantLabel}
                      marketInfoVersion={marketInfoVersionInput}
                      onMarketInfoVersionChange={setMarketInfoVersionInput}
                      currentMarketItems={selectedCurrentMarketInfoItems}
                      draftMarketItems={marketInfoScenarioItems}
                      onAddCountry={(country) =>
                        setMarketInfoScenarioItems((current) => {
                          const normalizedCountry = country.trim();
                          if (!normalizedCountry || current.some((item) => item.country === normalizedCountry)) {
                            return current;
                          }
                          return [
                            ...current,
                            {
                              id: createMarketInfoScenarioId(),
                              country: normalizedCountry,
                              originalPlacedOnMarket: current.length === 0,
                            },
                          ];
                        })
                      }
                      onSetOriginalCountry={(country) =>
                        setMarketInfoScenarioItems((current) =>
                          current.map((item) => ({
                            ...item,
                            originalPlacedOnMarket: item.country === country,
                          })),
                        )
                      }
                      onRemoveCountry={(country) =>
                        setMarketInfoScenarioItems((current) => {
                          if (current.length <= 1) {
                            return current;
                          }
                          const removedItem = current.find((item) => item.country === country);
                          const remainingItems = current.filter((item) => item.country !== country);
                          if (removedItem?.originalPlacedOnMarket && remainingItems.length > 0) {
                            return remainingItems.map((item, index) => ({
                              ...item,
                              originalPlacedOnMarket: index === 0,
                            }));
                          }
                          return remainingItems;
                        })
                      }
                      readinessMessage={marketInfoReadinessMessage}
                      isReady={isMarketInfoScenarioReady}
                      isRefreshing={visibleMarketInfoRefreshState}
                    />
                    <MarketInfoPreviewPanel
                      successXmlInputRef={postSuccessXmlInputRef}
                      handleSuccessXmlSelected={handlePostSuccessXmlSelected}
                      canGenerateCurrentXml={canGenerateCurrentXml}
                      canDownloadCurrentXml={canDownloadCurrentXml}
                      isGeneratingXml={isGeneratingXml}
                      isDownloadingXml={isDownloadingXml}
                      isUploadingSuccessXml={isUploadingSuccessXml}
                      onGeneratePreview={() => void generateXmlPreview()}
                      onDownload={() => void downloadXmlRecord()}
                      onUploadClick={handleUploadSuccessXmlClick}
                      xmlActionMessage={xmlActionMessage}
                      isRefreshing={visibleMarketInfoRefreshState}
                      previewStatusMessage={marketInfoPreviewStatusMessage}
                      activePreviewLabel={activePreviewLabel}
                      selectedBatchValidation={selectedBatchValidation}
                      validationStatusLabel={validationStatusLabel}
                      selectedSchemaLabel={selectedSchemaLabel}
                      activePreviewFileName={activePreviewFileName}
                      marketInfoXmlStructureSections={marketInfoXmlStructureSections}
                      selectedMarketInfoXmlSection={selectedMarketInfoXmlSection}
                      onSelectSection={setSelectedMarketInfoXmlSectionId}
                      xmlPreviewLines={xmlPreviewLines}
                      marketInfoXmlPreviewLineRefs={marketInfoXmlPreviewLineRefs}
                      marketInfoXmlPreviewContainerRef={marketInfoXmlPreviewContainerRef}
                    />
                  </>
                ) : xmlMode === "bulkMarketInfo" ? (
                  <BulkMarketInfoPreviewPanel
                    successXmlInputRef={postSuccessXmlInputRef}
                    handleSuccessXmlSelected={handlePostSuccessXmlSelected}
                    canGenerateCurrentXml={canGenerateCurrentXml}
                    canDownloadCurrentXml={canDownloadCurrentXml}
                    isGeneratingXml={isGeneratingXml}
                    isDownloadingXml={isDownloadingXml}
                    isUploadingSuccessXml={isUploadingSuccessXml}
                    onGeneratePreview={() => void generateXmlPreview()}
                    onDownload={() => void downloadXmlRecord()}
                    onUploadClick={handleUploadSuccessXmlClick}
                    xmlActionMessage={xmlActionMessage}
                    isRefreshing={visibleMarketInfoRefreshState}
                    previewStatusMessage={bulkMarketInfoPreviewStatusMessage}
                    activePreviewLabel={activePreviewLabel}
                    selectedBatchValidation={selectedBatchValidation}
                    validationStatusLabel={validationStatusLabel}
                    selectedSchemaLabel={selectedSchemaLabel}
                    activePreviewFileName={activePreviewFileName}
                    marketInfoXmlStructureSections={bulkMarketInfoXmlStructureSections}
                    selectedMarketInfoXmlSection={selectedBulkMarketInfoXmlSection}
                    onSelectSection={setSelectedBulkMarketInfoXmlSectionId}
                    xmlPreviewLines={xmlPreviewLines}
                    marketInfoXmlPreviewLineRefs={bulkMarketInfoXmlPreviewLineRefs}
                    marketInfoXmlPreviewContainerRef={bulkMarketInfoXmlPreviewContainerRef}
                  />
                ) : (
                  <BulkXmlPreviewPanel
                    successXmlInputRef={postSuccessXmlInputRef}
                    handleSuccessXmlSelected={handlePostSuccessXmlSelected}
                    title={genericPreviewTitle}
                    generateButtonLabel={
                      xmlMode === "bulkUdidiPost"
                          ? "Generate Bulk DEVICE UDI-DI POST"
                          : "Generate Bulk PATCH"
                    }
                    downloadButtonLabel={
                      xmlMode === "bulkUdidiPost"
                          ? "Download Bulk DEVICE UDI-DI POST ZIP"
                          : "Download Bulk PATCH ZIP"
                    }
                    canGenerateCurrentXml={canGenerateCurrentXml}
                    canDownloadCurrentXml={canDownloadCurrentXml}
                    isGeneratingXml={isGeneratingXml}
                    isDownloadingXml={isDownloadingXml}
                    isUploadingSuccessXml={isUploadingSuccessXml}
                    onGeneratePreview={() => void generateXmlPreview()}
                    onDownload={() => void downloadXmlRecord()}
                    onUploadClick={handleUploadSuccessXmlClick}
                    xmlActionMessage={xmlActionMessage}
                    isRefreshing={isLoadingXmlOperationAssessment}
                    activePreviewLabel={activePreviewLabel}
                    selectedBatchValidation={selectedBatchValidation}
                    validationStatusLabel={validationStatusLabel}
                    selectedSchemaLabel={selectedSchemaLabel}
                    activePreviewFileName={activePreviewFileName}
                    previewStatusMessage={genericPreviewStatusMessage}
                    xmlPreviewLines={xmlPreviewLines}
                    structureTitle={bulkPreviewStructureTitle}
                    structureSubtitle={bulkPreviewStructureSubtitle}
                    xmlStructureSections={bulkXmlStructureSections}
                    selectedXmlSection={selectedBulkXmlSection}
                    onSelectSection={setSelectedBulkXmlSectionId}
                    xmlPreviewLineRefs={bulkXmlPreviewLineRefs}
                    xmlPreviewContainerRef={bulkXmlPreviewContainerRef}
                  />
                )}
              </div>

              <div className="xml-sidebar-surface">
                {xmlMode === "patch" ? (
                  selectedPatchWorkspaceRecord ? (
                    <PatchScenarioCard
                      selectedPatchScenarioLabel={selectedPatchScenario.label}
                      selectedPatchScenarioStatus={selectedPatchScenarioStatus}
                      selectedPatchWorkspaceCatalogueNumber={selectedPatchWorkspaceRecord.catalogue_number}
                      patchDeviceOptions={selectedPatchDeviceRecords
                        .filter((record): record is typeof record & { catalogue_number: string } => Boolean(record.catalogue_number))
                        .map((record) => ({
                          catalogueNumber: record.catalogue_number,
                          primaryUdiDi: record.primary_udi_di,
                        }))}
                      onPatchDeviceChange={(catalogueNumber) => {
                        setSelectedXmlRecordKey(catalogueNumber);
                        setXmlPairPreview(null);
                        setXmlPatchPreview(null);
                      }}
                      currentAcceptedPatchLabel={currentAcceptedPatchLabel}
                      hasLoadedPatchBaseline={hasLoadedPatchBaseline}
                      selectedPatchScenarioSummary={selectedPatchScenario.summary}
                      patchDraftComparisonRows={patchDraftComparisonRows}
                      currentAcceptedPatchVersion={currentAcceptedPatchVersion}
                      patchVersionInput={patchVersionInput}
                      patchScenarioOptions={PATCH_SCENARIOS.map((scenario) => ({
                        id: scenario.id,
                        label: patchScenarioOptionLabel(scenario),
                      }))}
                      selectedPatchScenarioId={selectedPatchScenario.id}
                      onScenarioChange={(scenarioId) => setSelectedPatchScenarioId(scenarioId as PatchScenarioId)}
                      onPatchVersionChange={setPatchVersionInput}
                      selectedPatchScenarioImplemented={selectedPatchScenarioImplemented}
                      selectedPatchScenarioOptionsSummary={selectedPatchScenario.optionsSummary}
                      patchTradeNameInput={patchTradeNameInput}
                      onPatchTradeNameChange={setPatchTradeNameInput}
                      patchBaseQuantityInput={patchBaseQuantityInput}
                      onPatchBaseQuantityChange={setPatchBaseQuantityInput}
                      selectedCurrentBaseQuantity={selectedCurrentBaseQuantity}
                      patchSterileInput={patchSterileInput}
                      onPatchSterileChange={setPatchSterileInput}
                      selectedCurrentSterile={selectedCurrentSterile}
                      patchLatexInput={patchLatexInput}
                      onPatchLatexChange={setPatchLatexInput}
                      selectedCurrentLatex={selectedCurrentLatex}
                      patchStatusCodeInput={patchStatusCodeInput}
                      onPatchStatusCodeChange={setPatchStatusCodeInput}
                      selectedCurrentStatusCode={selectedCurrentStatusCode}
                      selectedPatchWarningCodes={selectedPatchWarningCodes}
                      selectedPatchWarningDescriptions={selectedPatchWarningDescriptions}
                      criticalWarningCodeOptions={criticalWarningCodeOptions}
                      patchWarningCodeInput={patchWarningCodeInput}
                      onPatchWarningCodeChange={setPatchWarningCodeInput}
                      selectedWarningRequiresComment={selectedWarningRequiresComment}
                      patchWarningCommentInput={patchWarningCommentInput}
                      onPatchWarningCommentChange={setPatchWarningCommentInput}
                      patchStorageConditionInputs={patchStorageConditionInputs}
                      setPatchStorageConditionInputs={setPatchStorageConditionInputs}
                      patchScenarioReadinessMessage={patchScenarioReadinessMessage}
                      xmlPatchPreview={xmlPatchPreview}
                    />
                  ) : null
                ) : xmlMode === "bulkUdidiPost" || xmlMode === "bulkPatch" || xmlMode === "bulkMarketInfo" ? (
                  xmlMode === "bulkPatch" ? (
                    <BulkPatchWorkspace
                      familyVariantLabel={`${selectedXmlFamilyLabel} / ${selectedXmlVariantLabel}`}
                      isRefreshing={isLoadingXmlOperationAssessment}
                      displayedBulkPatchParentOptions={displayedBulkPatchParentOptions}
                      selectedBulkPatchParentGroup={selectedBulkPatchParentGroup}
                      onSelectParent={(basicUdiDi) => {
                        setSelectedBulkPatchBasicUdiDi(basicUdiDi);
                        setSelectedXmlChunkSequence(1);
                        setXmlBulkPatchPreview(null);
                      }}
                      selectedBulkPatchSelectedCount={selectedBulkPatchSelectedCount}
                      bulkPatchScopeMode={bulkPatchScopeMode}
                      onScopeModeChange={(value) => {
                        setBulkPatchScopeMode(value);
                        setSelectedXmlChunkSequence(1);
                        setXmlBulkPatchPreview(null);
                      }}
                      bulkPatchPostedEntries={bulkPatchPostedEntries}
                      bulkPatchCatalogueFilter={bulkPatchCatalogueFilter}
                      onBulkPatchCatalogueFilterChange={setBulkPatchCatalogueFilter}
                      bulkPatchFilteredPostedEntries={bulkPatchFilteredPostedEntries}
                      selectedBulkPatchCatalogueNumbers={selectedBulkPatchCatalogueNumbers}
                      setSelectedBulkPatchCatalogueNumbers={setSelectedBulkPatchCatalogueNumbers}
                      bulkPatchImportText={bulkPatchImportText}
                      onBulkPatchImportTextChange={setBulkPatchImportText}
                      bulkPatchImportedCatalogueNumbersCount={bulkPatchImportedCatalogueNumbers.length}
                      bulkPatchImportedMatchedCatalogueNumbersCount={bulkPatchImportedMatchedCatalogueNumbers.length}
                      bulkPatchImportedNotFoundCatalogueNumbersCount={bulkPatchImportedNotFoundCatalogueNumbers.length}
                      patchScenarioStatusLabel={selectedPatchScenario.testStatus}
                      patchScenarioOptions={PATCH_SCENARIOS.map((scenario) => ({
                        id: scenario.id,
                        label: patchScenarioOptionLabel(scenario),
                      }))}
                      selectedPatchScenarioId={selectedPatchScenario.id}
                      onPatchScenarioChange={(scenarioId) => setSelectedPatchScenarioId(scenarioId as PatchScenarioId)}
                      selectedPatchScenarioSummary={selectedPatchScenario.summary}
                      selectedPatchScenarioOptionsSummary={selectedPatchScenario.optionsSummary}
                      selectedPatchScenarioImplemented={selectedPatchScenarioImplemented}
                      bulkPatchBaselineSummary={bulkPatchBaselineSummary}
                      patchTradeNameInput={patchTradeNameInput}
                      onPatchTradeNameChange={setPatchTradeNameInput}
                      patchBaseQuantityInput={patchBaseQuantityInput}
                      onPatchBaseQuantityChange={setPatchBaseQuantityInput}
                      patchStatusCodeInput={patchStatusCodeInput}
                      onPatchStatusCodeChange={setPatchStatusCodeInput}
                      patchSterileInput={patchSterileInput}
                      onPatchSterileChange={setPatchSterileInput}
                      patchLatexInput={patchLatexInput}
                      onPatchLatexChange={setPatchLatexInput}
                      patchWarningCodeInput={patchWarningCodeInput}
                      onPatchWarningCodeChange={setPatchWarningCodeInput}
                      selectedWarningRequiresComment={selectedWarningRequiresComment}
                      patchWarningCommentInput={patchWarningCommentInput}
                      onPatchWarningCommentChange={setPatchWarningCommentInput}
                      criticalWarningCodeOptions={criticalWarningCodeOptions}
                      patchStorageConditionInputs={patchStorageConditionInputs}
                      setPatchStorageConditionInputs={setPatchStorageConditionInputs}
                      selectedBatchValidation={selectedBatchValidation}
                    />
                  ) : xmlMode === "bulkMarketInfo" ? (
                  <BulkMarketInfoWorkspace
                      familyVariantLabel={`${selectedXmlFamilyLabel} / ${selectedXmlVariantLabel}`}
                      isRefreshing={false}
                      displayedBulkMarketInfoParentOptions={displayedBulkMarketInfoParentOptions}
                      selectedBulkMarketInfoParentGroup={selectedBulkMarketInfoParentGroup}
                      onSelectParent={(basicUdiDi) => {
                        setSelectedBulkMarketInfoBasicUdiDi(basicUdiDi);
                        setSelectedXmlChunkSequence(1);
                        setXmlBulkMarketInfoPreview(null);
                      }}
                      selectedBulkMarketInfoSelectedCount={selectedBulkMarketInfoSelectedCount}
                      bulkMarketInfoCurrentVersionSummary={bulkMarketInfoCurrentVersionSummary}
                      bulkMarketInfoNextVersionSummary={bulkMarketInfoNextVersionSummary}
                      bulkMarketInfoScopeMode={bulkMarketInfoScopeMode}
                      onScopeModeChange={(value) => {
                        setBulkMarketInfoScopeMode(value);
                        setSelectedXmlChunkSequence(1);
                        setXmlBulkMarketInfoPreview(null);
                      }}
                      bulkMarketInfoPostedEntries={bulkMarketInfoPostedEntries}
                      bulkMarketInfoCatalogueFilter={bulkMarketInfoCatalogueFilter}
                      onBulkMarketInfoCatalogueFilterChange={setBulkMarketInfoCatalogueFilter}
                      bulkMarketInfoFilteredPostedEntries={bulkMarketInfoFilteredPostedEntries}
                      selectedBulkMarketInfoCatalogueNumbers={selectedBulkMarketInfoCatalogueNumbers}
                      setSelectedBulkMarketInfoCatalogueNumbers={setSelectedBulkMarketInfoCatalogueNumbers}
                      bulkMarketInfoImportText={bulkMarketInfoImportText}
                      onBulkMarketInfoImportTextChange={setBulkMarketInfoImportText}
                      bulkMarketInfoImportedCatalogueNumbersCount={bulkMarketInfoImportedCatalogueNumbers.length}
                      bulkMarketInfoImportedMatchedCatalogueNumbersCount={bulkMarketInfoImportedMatchedCatalogueNumbers.length}
                      bulkMarketInfoImportedNotFoundCatalogueNumbersCount={bulkMarketInfoImportedNotFoundCatalogueNumbers.length}
                      countryReference={marketCountryReference}
                      currentMarketItems={selectedBulkMarketInfoCurrentItems}
                      draftMarketItems={bulkMarketInfoScenarioItems}
                      onAddCountry={(country) =>
                        setBulkMarketInfoScenarioItems((current) => {
                          const normalizedCountry = country.trim();
                          if (!normalizedCountry || current.some((item) => item.country === normalizedCountry)) {
                            return current;
                          }
                          return [
                            ...current,
                            {
                              id: createMarketInfoScenarioId(),
                              country: normalizedCountry,
                              originalPlacedOnMarket: current.length === 0,
                            },
                          ];
                        })
                      }
                      onSetOriginalCountry={(country) =>
                        setBulkMarketInfoScenarioItems((current) =>
                          current.map((item) => ({
                            ...item,
                            originalPlacedOnMarket: item.country === country,
                          })),
                        )
                      }
                      onRemoveCountry={(country) =>
                        setBulkMarketInfoScenarioItems((current) => {
                          if (current.length <= 1) {
                            return current;
                          }
                          const removedItem = current.find((item) => item.country === country);
                          const remainingItems = current.filter((item) => item.country !== country);
                          if (removedItem?.originalPlacedOnMarket && remainingItems.length > 0) {
                            return remainingItems.map((item, index) => ({
                              ...item,
                              originalPlacedOnMarket: index === 0,
                            }));
                          }
                          return remainingItems;
                        })
                      }
                      readinessMessage={bulkMarketInfoReadinessMessage}
                      isReady={isBulkMarketInfoScenarioReady}
                      selectedBatchValidation={selectedBatchValidation}
                    />
                  ) : (
                  <BulkPostWorkspace
                    familyVariantLabel={`${selectedXmlFamilyLabel} / ${selectedXmlVariantLabel}`}
                    title={"Bulk DEVICE UDI-DI POST"}
                      isRefreshing={visibleMarketInfoRefreshState}
                    stepOneTitle={"Child registration scope"}
                    stepOneCount={selectedBulkEligibleUdidiPostCount}
                    stepOneLabel={"eligible device"}
                    stepOneCopy={
                      "These Device UDI-DI child registrations are currently available under tracked Basic UDI-DI parents."
                    }
                    stepOneFooter={undefined}
                    selectedBulkRecordCount={effectiveBulkUdidiPostCatalogueNumbers.length}
                    onSelectedBulkRecordCountChange={(count) => {
                      setSelectedBulkRecordCount(count);
                      setSelectedXmlChunkSequence(1);
                    }}
                    selectedBulkCapacity={bulkUdidiPostEntries.length}
                    bulkUdidiPostScopeMode={bulkUdidiPostScopeMode}
                    onBulkUdidiPostScopeModeChange={(value) => {
                      setBulkUdidiPostScopeMode(value);
                      setSelectedXmlChunkSequence(1);
                    }}
                    bulkUdidiPostEntries={bulkUdidiPostEntries}
                    bulkUdidiPostCatalogueFilter={bulkUdidiPostCatalogueFilter}
                    onBulkUdidiPostCatalogueFilterChange={setBulkUdidiPostCatalogueFilter}
                    bulkUdidiPostFilteredEntries={bulkUdidiPostFilteredEntries}
                    selectedBulkUdidiPostCatalogueNumbers={selectedBulkUdidiPostCatalogueNumbers}
                    setSelectedBulkUdidiPostCatalogueNumbers={setSelectedBulkUdidiPostCatalogueNumbers}
                    bulkUdidiPostImportText={bulkUdidiPostImportText}
                    onBulkUdidiPostImportTextChange={setBulkUdidiPostImportText}
                    bulkUdidiPostImportedCatalogueNumbersCount={bulkUdidiPostImportedCatalogueNumbers.length}
                    bulkUdidiPostImportedMatchedCatalogueNumbersCount={bulkUdidiPostImportedMatchedCatalogueNumbers.length}
                    bulkUdidiPostImportedNotFoundCatalogueNumbersCount={bulkUdidiPostImportedCatalogueNumbers.length - bulkUdidiPostImportedMatchedCatalogueNumbers.length}
                    selectedXmlChunkSequence={selectedXmlChunkSequence}
                    onSelectedXmlChunkSequenceChange={setSelectedXmlChunkSequence}
                    selectedBulkChunkCount={selectedBulkChunkCount}
                    selectedChunkSummaryText={
                      selectedBulkPreview
                        ? `Selected file: ${selectedBulkPreview.selected_chunk_file_name} · ${selectedBulkPreview.selected_chunk_record_count} rows`
                        : "Generate a preview to inspect the selected chunk."
                    }
                    selectedBatchValidation={selectedBatchValidation}
                  />
                  )
                ) : (
                  <p className="panel-copy">No XML-ready bulk scope is currently available for the selected family and variant.</p>
                )}
                <XmlValidationStack
                  showGenericValidationCards={
                    xmlMode !== "bulkPatch" && xmlMode !== "bulkUdidiPost" && xmlMode !== "patch"
                  }
                  xmlModeLabel={
                    xmlMode
                  }
                  selectedBatchValidation={selectedBatchValidation}
                  xmlPatchValidationSchemaPath={xmlPatchPreview?.derived_patch_validation.schema_path ?? null}
                  xmlPatchValidationValid={xmlPatchPreview ? xmlPatchPreview.derived_patch_validation.valid : null}
                  selectedBulkPreview={selectedBulkPreview}
                  bulkChunkSummaryTitle={bulkChunkSummaryTitle}
                  selectedBulkExclusionSummaries={selectedBulkExclusionSummaries}
                />
              </div>
            </div>
            )}
          </section>
        </section>
        )
      ) : null}

      {activeTab === "testingSummary" ? (
        isLoadingCanonicalValidation && !canonicalValidation ? (
          renderLoadingPanel(
            "Loading testing summary",
            "Preparing the current SQLite-backed testing position and available next actions.",
          )
        ) : (
          <TestingSummaryWorkspace
            isLoading={isLoadingTestingSummary}
            error={testingSummaryError}
            searchText={testingSummarySearch}
            onSearchChange={setTestingSummarySearch}
            selectedFamily={selectedTestingSummaryFamily}
            selectedVariant={selectedTestingSummaryVariant}
            modelOptions={xmlModelOptions}
            onModelChange={(family, variant) => {
              setSelectedTestingSummaryFamily(family);
              setSelectedTestingSummaryVariant(variant);
            }}
            onClearFilters={() => {
              setTestingSummarySearch("");
              setSelectedTestingSummaryFamily("");
              setSelectedTestingSummaryVariant("");
            }}
            workspaceSummary={searchedTestingWorkspaceSummary}
            metrics={testingSummaryMetrics}
            rows={testingSummaryRows}
            eventRows={testingSummaryEventRows}
            recentSubjects={testingSummaryRecentSubjects}
          />
        )
      ) : null}

      {activeTab === "registrationState" ? (
        isLoadingCanonicalValidation && !canonicalValidation ? (
          renderLoadingPanel(
            "Loading registration state",
            "Preparing the current parent registration footprint and next available actions.",
          )
        ) : (
          <RegistrationStateWorkspace
            isLoading={isLoadingTestingSummary || isLoadingReadiness}
            error={testingSummaryError ?? readinessError}
            selectedFamily={selectedRegistrationStateFamily}
            selectedVariant={selectedRegistrationStateVariant}
            selectedStatus={selectedRegistrationStateStatus}
            searchText={registrationStateSearch}
            actionableOnly={registrationStateActionableOnly}
            modelOptions={xmlModelOptions}
            statusOptions={registrationStateStatusOptions}
            metrics={isLoadingReadiness || readinessError
              ? registrationStateMetrics.map((metric) => ({ ...metric, value: "—" }))
              : registrationStateMetrics}
            rows={registrationStateRows}
            onModelChange={(family, variant) => {
              setSelectedRegistrationStateFamily(family);
              setSelectedRegistrationStateVariant(variant);
            }}
            onStatusChange={setSelectedRegistrationStateStatus}
            onSearchChange={setRegistrationStateSearch}
            onActionableOnlyChange={setRegistrationStateActionableOnly}
            onReset={() => {
              setSelectedRegistrationStateFamily("");
              setSelectedRegistrationStateVariant("");
              setSelectedRegistrationStateStatus("");
              setRegistrationStateSearch("");
              setRegistrationStateActionableOnly(false);
            }}
          />
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
