import { useState } from "react";

export type NavigationPage =
  | "sourceFiles" | "createImportWorkbook" | "assessmentImport" | "importHistory"
  | "workbooks" | "canonicalValidation" | "registrationState"
  | "xml" | "testingSummary"
  | "registrationSnapshot" | "eudamedComparison" | "documentation";

type Area = "imports" | "data" | "eudamed" | "reporting" | "help";
type NavigationGroup = { id: Area; label: string; pages: { id: NavigationPage; label: string }[] };

export function ApplicationNavigation({ activePage, onSelect, xmlWorkspaceLabel, summaryWorkspaceLabel }: {
  activePage: NavigationPage;
  onSelect: (page: NavigationPage) => void;
  xmlWorkspaceLabel: string;
  summaryWorkspaceLabel: string;
}) {
  const [lastPages, setLastPages] = useState<Partial<Record<Area, NavigationPage>>>({});
  const groups: NavigationGroup[] = [
    { id: "imports", label: "Import Management", pages: [
      { id: "sourceFiles", label: "1. Import Source Files" },
      { id: "createImportWorkbook", label: "2. Create Import Workbook" },
      { id: "assessmentImport", label: "3. Assess & Import Workbook" },
      { id: "importHistory", label: "Import History" },
    ] },
    { id: "data", label: "Data Views", pages: [
      { id: "workbooks", label: "Submission Data" },
      { id: "canonicalValidation", label: "Canonical Validation" },
      { id: "registrationState", label: "Registration State" },
    ] },
    { id: "eudamed", label: "EUDAMED", pages: [
      { id: "xml", label: xmlWorkspaceLabel },
      { id: "testingSummary", label: summaryWorkspaceLabel },
    ] },
    { id: "reporting", label: "Reporting", pages: [
      { id: "registrationSnapshot", label: "Registration Snapshot" },
      { id: "eudamedComparison", label: "EUDAMED Comparison" },
    ] },
    { id: "help", label: "Help", pages: [{ id: "documentation", label: "Documentation" }] },
  ];
  const activeGroup = groups.find((group) => group.pages.some((page) => page.id === activePage))!;

  function selectArea(group: NavigationGroup) {
    setLastPages((previous) => ({ ...previous, [activeGroup.id]: activePage }));
    onSelect(group.id === activeGroup.id ? activePage : lastPages[group.id] ?? group.pages[0].id);
  }

  return (
    <div className="application-navigation">
      <div className="navigation-areas" role="group" aria-label="Application areas">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={group.id === activeGroup.id ? "navigation-area active" : "navigation-area"}
            aria-pressed={group.id === activeGroup.id}
            onClick={() => selectArea(group)}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div className="navigation-pages" role="group" aria-label={`${activeGroup.label} pages`}>
        {activeGroup.pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={page.id === activePage ? "navigation-page active" : "navigation-page"}
            aria-current={page.id === activePage ? "page" : undefined}
            onClick={() => onSelect(page.id)}
          >
            {page.label}
          </button>
        ))}
      </div>
    </div>
  );
}
