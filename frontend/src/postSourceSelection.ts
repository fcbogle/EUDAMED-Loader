/** Operational eligibility comes from registration evidence, never source labels. */
export function postSourceSelectable(environment: string | null | undefined, _historicalOperation?: string | null): boolean {
  return environment === "dev" || environment === "prod";
}

export function registrationOperation(registered: boolean | undefined): "POST" | "PATCH" | null {
  return registered === undefined ? null : registered ? "PATCH" : "POST";
}

export function hasRegistrationEvidence(summary: {
  imported_baseline_present?: boolean;
  has_successful_device_post?: boolean;
  has_successful_child_post_or_patch?: boolean;
  post_success?: boolean;
}): boolean {
  // Legacy testing flags are deliberately excluded.
  return Boolean(summary.imported_baseline_present || summary.has_successful_device_post || summary.has_successful_child_post_or_patch);
}
