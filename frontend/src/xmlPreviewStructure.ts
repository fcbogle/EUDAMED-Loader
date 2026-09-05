export type XmlStructureSection = {
  id: string;
  label: string;
  detail: string;
  lineStart: number;
  lineEnd: number;
};

export function extractXmlStructureSections(xml: string): XmlStructureSection[] {
  const lines = xml.split("\n");
  const markers: Array<{ match: (line: string) => boolean; label: string; detail: string }> = [
    { match: (line) => line.includes("<m:Push"), label: "Message envelope", detail: "Push wrapper, correlation, message, and service metadata." },
    { match: (line) => line.includes("<m:recipient>"), label: "Recipient and service", detail: "EUDAMED node routing and service operation details." },
    { match: (line) => line.includes("<m:payload>"), label: "Payload root", detail: "Start of the DEVICE.POST payload." },
    { match: (line) => line.includes("<device:UDIDIData"), label: "Device registration", detail: "Top-level UDI-DI registration object." },
    { match: (line) => line.includes("<udidi:identifier>"), label: "Device UDI-DI", detail: "Primary device identifier and issuing entity." },
    { match: (line) => line.includes("<udidi:basicUDIIdentifier>"), label: "Basic UDI-DI parent", detail: "Parent family or variant registration identity." },
    { match: (line) => line.includes("<udidi:status>") || line.includes("<e:state>"), label: "Registration and market state", detail: "Registration status and on-market state values." },
    { match: (line) => line.includes("<udidi:MDNCodes>") || line.includes("<udidi:deviceClassification>"), label: "Classification", detail: "Classification fields such as MDN and related metadata." },
    { match: (line) => line.includes("<udidi:tradeName>") || line.includes("<udidi:tradeNames>") || line.includes("<udidi:deviceName>"), label: "Commercial presentation", detail: "Trade names and user-facing device naming." },
    { match: (line) => line.includes("<udidi:referenceNumber>") || line.includes("<udidi:productionIdentifier>"), label: "Reference and production identifiers", detail: "Catalogue, reference, and production identifier content." },
    { match: (line) => line.includes("<udidi:description>") || line.includes("<udidi:intendedPurpose>") || line.includes("<udidi:additionalDescription>"), label: "Description and intended use", detail: "Narrative description and intended-purpose text." },
    { match: (line) => line.includes("<udidi:criticalWarnings>") || line.includes("<udidi:storageHandlingConditions>") || line.includes("<udidi:singleUse>"), label: "Warnings and handling", detail: "Warnings, storage handling, and use-condition fields." },
  ];

  const starts = markers
    .map((marker, index) => {
      const lineStart = lines.findIndex((line) => marker.match(line));
      return lineStart < 0 ? null : { id: `xml-structure-${index}`, label: marker.label, detail: marker.detail, lineStart };
    })
    .filter((marker): marker is { id: string; label: string; detail: string; lineStart: number } => marker !== null)
    .sort((left, right) => left.lineStart - right.lineStart);

  if (starts.length < 1) {
    return [{ id: "xml-structure-empty", label: "Preview pending", detail: "Generate a POST preview to inspect the XML structure.", lineStart: 0, lineEnd: Math.max(lines.length - 1, 0) }];
  }

  return starts.map((section, index) => ({
    ...section,
    lineEnd: (starts[index + 1]?.lineStart ?? lines.length) - 1,
  }));
}
