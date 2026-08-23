type XmlStatusStripProps = {
  schemaTargetLabel?: string;
  validationStatusLabel: string;
  validationValid: boolean | null;
  className?: string;
};

export function XmlStatusStrip({
  schemaTargetLabel = "Schema target: Message.xsd",
  validationStatusLabel,
  validationValid,
  className = "validation-pill-row bulk-patch-pill-row",
}: XmlStatusStripProps) {
  return (
    <div className={className}>
      <span className="status-pill ok compact bulk-patch-status-pill">{schemaTargetLabel}</span>
      <span
        className={
          validationValid ? "status-pill ok compact bulk-patch-status-pill" : "status-pill warn compact bulk-patch-status-pill"
        }
      >
        Validation output: {validationStatusLabel}
      </span>
    </div>
  );
}
