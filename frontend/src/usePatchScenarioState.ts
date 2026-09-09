import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { GeneratedPatchScenarioPreview, PostRegistrationPreview } from "./types";

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

type PatchScenarioSelection = {
  id: PatchScenarioId;
  target: string;
  implemented: boolean;
};

type PatchScenarioComparisonRow = {
  label: string;
  before: string;
  after: string;
};

type UsePatchScenarioStateArgs = {
  selectedXmlFamily: string | null;
  selectedXmlVariant: string | null;
  selectedXmlRecordKey: string | null;
  selectedPatchScenario: PatchScenarioSelection;
  selectedPatchWorkspaceRecordTradeName: string | null;
  selectedPatchWorkspaceCatalogueNumber: string | null;
  selectedCurrentTradeName: string | null;
  selectedCurrentBaseQuantity: number | null;
  selectedCurrentSterile: boolean | null;
  selectedCurrentLatex: boolean | null;
  selectedCurrentStatusCode: string | null;
  selectedPatchWarningCodes: string[];
  selectedPatchStorageConditionMap: Map<string, string>;
  hasLoadedPatchBaseline: boolean;
  isSharedAnchorLoading: boolean;
  xmlPairPreview: PostRegistrationPreview | null;
  xmlPatchPreview: GeneratedPatchScenarioPreview | null;
  selectedPairRequestArgs:
    | {
        product_family: string;
        product_variant: string;
        catalogue_number: string;
        primary_udi_di: string | null;
      }
    | null;
  setXmlPatchPreview: Dispatch<SetStateAction<GeneratedPatchScenarioPreview | null>>;
};

export function usePatchScenarioState({
  selectedXmlFamily,
  selectedXmlVariant,
  selectedXmlRecordKey,
  selectedPatchScenario,
  selectedPatchWorkspaceRecordTradeName,
  selectedPatchWorkspaceCatalogueNumber,
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
}: UsePatchScenarioStateArgs) {
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

  useEffect(() => {
    if (selectedPatchScenario.id !== "equivalent_first_patch" && isSharedAnchorLoading) {
      return;
    }
    const latestSuccessfulVersion = Number(xmlPairPreview?.latest_successful_patch_state?.version ?? "1");
    const nextVersion =
      selectedPatchScenario.id === "equivalent_first_patch"
        ? "2"
        : Number.isInteger(latestSuccessfulVersion) && latestSuccessfulVersion >= 1
          ? String(latestSuccessfulVersion + 1)
          : "2";
    setPatchVersionInput(nextVersion);
    setXmlPatchPreview(null);
    if (xmlPairPreview?.latest_successful_patch_state) {
      setPatchTradeNameInput(xmlPairPreview.latest_successful_patch_state.trade_name ?? "");
    } else if (selectedPatchWorkspaceRecordTradeName) {
      setPatchTradeNameInput(selectedPatchWorkspaceRecordTradeName);
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
    selectedPatchScenario.id,
    selectedXmlRecordKey,
    xmlPairPreview,
    selectedPatchWorkspaceRecordTradeName,
    selectedCurrentBaseQuantity,
    selectedCurrentSterile,
    selectedCurrentLatex,
    selectedCurrentStatusCode,
    isSharedAnchorLoading,
    setXmlPatchPreview,
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
    setXmlPatchPreview,
  ]);

  const matchesSelectedPatchPreview = Boolean(
    xmlPatchPreview &&
      selectedPairRequestArgs &&
      xmlPatchPreview.catalogue_number === selectedPairRequestArgs.catalogue_number &&
      xmlPatchPreview.product_family === selectedPairRequestArgs.product_family &&
      xmlPatchPreview.product_variant === selectedPairRequestArgs.product_variant &&
      xmlPatchPreview.scenario_id === selectedPatchScenario.id,
  );

  const currentAcceptedPatchVersion = xmlPairPreview?.latest_successful_patch_state
    ? Number(xmlPairPreview.latest_successful_patch_state.version)
    : 1;
  const currentAcceptedPatchLabel = xmlPairPreview?.latest_successful_patch_state
    ? `Latest successful PATCH version ${xmlPairPreview.latest_successful_patch_state.version}`
    : "Accepted POST version 1";
  const requiredPatchVersion = selectedPatchScenario.id === "equivalent_first_patch" ? 2 : currentAcceptedPatchVersion + 1;
  const currentPatchVersion = Number(patchVersionInput);

  const patchDraftComparisonRows: PatchScenarioComparisonRow[] = matchesSelectedPatchPreview && xmlPatchPreview
    ? xmlPatchPreview.field_deltas.map((delta) => ({
        label: delta.label,
        before: delta.before_value ?? "None",
        after: delta.after_value ?? "None",
      }))
    : selectedPatchWorkspaceCatalogueNumber
      ? selectedPatchScenario.id === "equivalent_first_patch"
        ? [
            { label: "PATCH Version", before: "1", after: "2" },
          ]
        : !selectedPatchScenario.implemented
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
  const isPatchVersionValid = Number.isInteger(currentPatchVersion) && currentPatchVersion === requiredPatchVersion;
  const isPatchScenarioReady =
    hasLoadedPatchBaseline &&
    selectedPatchScenario.implemented &&
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

  const patchScenarioReadinessMessage = !selectedPatchWorkspaceCatalogueNumber
    ? "Select an XML-ready device with a successful registration first."
    : !hasLoadedPatchBaseline
      ? "Load the accepted baseline for this exact selected record before drafting a PATCH."
      : !patchVersionInput.trim()
        ? "Enter the required PATCH version integer."
        : !selectedPatchScenario.implemented
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

  return {
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
    matchesSelectedPatchPreview,
    currentAcceptedPatchVersion,
    currentAcceptedPatchLabel,
    requiredPatchVersion,
    patchDraftComparisonRows,
    selectedWarningRequiresComment,
    isPatchVersionValid,
    isPatchScenarioReady,
    patchScenarioReadinessMessage,
    hasCurrentGeneratedPatchPreview: Boolean(matchesSelectedPatchPreview && xmlPatchPreview),
  };
}
