import { useState } from "react";

import type { XmlMode } from "./useXmlOperationAssessment";
import { createMarketInfoScenarioId, type MarketInfoScenarioItem } from "./xmlMarketInfoState";

export function useXmlWorkspaceState<PatchScenarioId extends string>(initialPatchScenarioId: PatchScenarioId) {
  const [xmlMode, setXmlMode] = useState<XmlMode>("post");
  const [selectedXmlRecordKey, setSelectedXmlRecordKey] = useState<string | null>(null);
  const [selectedBulkPatchBasicUdiDi, setSelectedBulkPatchBasicUdiDi] = useState<string>("");
  const [selectedBulkMarketInfoBasicUdiDi, setSelectedBulkMarketInfoBasicUdiDi] = useState<string>("");
  const [selectedXmlChunkSequence, setSelectedXmlChunkSequence] = useState<number>(1);
  const [selectedBulkRecordCount, setSelectedBulkRecordCount] = useState<number>(1);
  const [selectedPatchScenarioId, setSelectedPatchScenarioId] = useState<PatchScenarioId>(initialPatchScenarioId);
  const [marketInfoVersionInput, setMarketInfoVersionInput] = useState<string>("1");
  const [acceptedMarketInfoItems, setAcceptedMarketInfoItems] = useState<MarketInfoScenarioItem[] | null>(null);
  const [marketInfoScenarioItems, setMarketInfoScenarioItems] = useState<MarketInfoScenarioItem[]>([
    { id: createMarketInfoScenarioId(), country: "", originalPlacedOnMarket: false },
  ]);
  const [bulkMarketInfoScenarioItems, setBulkMarketInfoScenarioItems] = useState<MarketInfoScenarioItem[]>([
    { id: createMarketInfoScenarioId(), country: "", originalPlacedOnMarket: false },
  ]);
  const [xmlActionMessage, setXmlActionMessage] = useState<string | null>(null);
  const [isGeneratingXml, setIsGeneratingXml] = useState<boolean>(false);
  const [isDownloadingXml, setIsDownloadingXml] = useState<boolean>(false);

  return {
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
    acceptedMarketInfoItems,
    setAcceptedMarketInfoItems,
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
  };
}
