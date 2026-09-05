import { useState } from "react";

import type { XmlMode } from "./useXmlOperationAssessment";

export function useXmlWorkspaceState() {
  const [xmlMode, setXmlMode] = useState<XmlMode>("post");
  const [selectedXmlRecordKey, setSelectedXmlRecordKey] = useState<string | null>(null);
  const [selectedBulkPatchBasicUdiDi, setSelectedBulkPatchBasicUdiDi] = useState<string>("");
  const [selectedBulkMarketInfoBasicUdiDi, setSelectedBulkMarketInfoBasicUdiDi] = useState<string>("");
  const [selectedXmlChunkSequence, setSelectedXmlChunkSequence] = useState<number>(1);
  const [selectedBulkRecordCount, setSelectedBulkRecordCount] = useState<number>(1);

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
  };
}
