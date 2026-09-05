import { useState } from "react";

import type {
  BulkMarketInfoPreview,
  BulkPatchPreview,
  BulkPostPreview,
  BulkUdidiPostPreview,
  GeneratedPatchScenarioPreview,
  MarketInfoPutPreview,
  PostRegistrationPreview,
  SingleRecordXmlPreview,
} from "./types";

export function useXmlPreviewState() {
  const [xmlPreview, setXmlPreview] = useState<SingleRecordXmlPreview | null>(null);
  const [xmlBulkPostPreview, setXmlBulkPostPreview] = useState<BulkPostPreview | null>(null);
  const [xmlBulkUdidiPostPreview, setXmlBulkUdidiPostPreview] = useState<BulkUdidiPostPreview | null>(null);
  const [xmlPairPreview, setXmlPairPreview] = useState<PostRegistrationPreview | null>(null);
  const [xmlMarketInfoPreview, setXmlMarketInfoPreview] = useState<MarketInfoPutPreview | null>(null);
  const [xmlPatchPreview, setXmlPatchPreview] = useState<GeneratedPatchScenarioPreview | null>(null);
  const [xmlBulkPatchPreview, setXmlBulkPatchPreview] = useState<BulkPatchPreview | null>(null);
  const [xmlBulkMarketInfoPreview, setXmlBulkMarketInfoPreview] = useState<BulkMarketInfoPreview | null>(null);

  return {
    xmlPreview,
    setXmlPreview,
    xmlBulkPostPreview,
    setXmlBulkPostPreview,
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
  };
}
