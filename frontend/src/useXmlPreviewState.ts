import { useState } from "react";

import type {
  BulkMarketInfoPreview,
  BulkPatchPreview,
  BulkUdidiPostPreview,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  PostRegistrationPreview,
} from "./types";

export function useXmlPreviewState() {
  const [xmlBulkUdidiPostPreview, setXmlBulkUdidiPostPreview] = useState<BulkUdidiPostPreview | null>(null);
  const [xmlPairPreview, setXmlPairPreview] = useState<PostRegistrationPreview | null>(null);
  const [xmlMarketInfoPreview, setXmlMarketInfoPreview] = useState<MarketInfoPutPreview | null>(null);
  const [xmlPatchPreview, setXmlPatchPreview] = useState<GeneratedPatchScenarioPreview | null>(null);
  const [xmlBulkPatchPreview, setXmlBulkPatchPreview] = useState<BulkPatchPreview | null>(null);
  const [xmlBulkMarketInfoPreview, setXmlBulkMarketInfoPreview] = useState<BulkMarketInfoPreview | null>(null);
  const [selectedPostXmlSectionId, setSelectedPostXmlSectionId] = useState<string | null>(null);
  const [selectedMarketInfoXmlSectionId, setSelectedMarketInfoXmlSectionId] = useState<string | null>(null);
  const [selectedBulkXmlSectionId, setSelectedBulkXmlSectionId] = useState<string | null>(null);
  const [selectedBulkMarketInfoXmlSectionId, setSelectedBulkMarketInfoXmlSectionId] = useState<string | null>(null);
  const [selectedPatchXmlSectionId, setSelectedPatchXmlSectionId] = useState<string | null>(null);

  return {
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
  };
}
