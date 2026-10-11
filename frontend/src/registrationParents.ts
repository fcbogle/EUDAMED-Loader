import type { RegistrationChild, RegistrationSummaryGroup } from "./types";

export type RegistrationParent = {
  key: string; basicUdiDi: string; issuer: string | null; models: string[]; groupKeys: string[];
  registered: boolean; total: number; registeredChildren: number; awaiting: number; unknown: number;
  childPostReady: number; awaitingBlocked: number; parentPostReady: boolean;
  patchReady: number; marketInfoReady: number;
};

export function registrationParents(groups: RegistrationSummaryGroup[]): RegistrationParent[] {
  const parents = new Map<string, RegistrationParent>();
  for (const group of groups) {
    const key = group.parent_key || group.key;
    const parent = parents.get(key) ?? {
      key, basicUdiDi: group.basic_udi_di, issuer: group.parent_issuing_entity,
      models: [], groupKeys: [], registered: false, total: 0, registeredChildren: 0,
      awaiting: 0, unknown: 0, childPostReady: 0, awaitingBlocked: 0, parentPostReady: false,
      patchReady: 0, marketInfoReady: 0,
    };
    const model = `${group.product_family} / ${group.product_variant}`;
    if (!parent.models.includes(model)) parent.models.push(model);
    parent.groupKeys.push(group.key);
    parent.registered ||= group.parent_registered;
    parent.parentPostReady ||= group.parent_post_ready;
    parent.total += group.total_devices;
    parent.registeredChildren += group.registered_devices;
    parent.awaiting += group.awaiting_devices;
    parent.unknown += group.unknown_devices;
    parent.childPostReady += group.child_post_ready;
    parent.awaitingBlocked += group.awaiting_blocked;
    parent.patchReady += group.patch_ready;
    parent.marketInfoReady += group.market_info_ready;
    parents.set(key, parent);
  }
  return [...parents.values()];
}

export function parentNextStep(parent: RegistrationParent): string {
  if (!parent.issuer) return "Resolve parent identity";
  if (parent.unknown > 0) return "Confirm unknown registration status";
  if (parent.childPostReady > 0) return "Review Bulk UDI-DI POST";
  if (!parent.registered && parent.parentPostReady) return "Review parent POST";
  if (parent.awaitingBlocked > 0) return "Review registration exceptions";
  if (parent.patchReady > 0 || parent.marketInfoReady > 0) return "Review updates if needed";
  return "No available XML action";
}

export function childXmlActions(child: RegistrationChild): string {
  const actions: string[] = [];
  if (child.child_post_ready) actions.push("Child POST ready");
  else if (child.post_ready) actions.push("Parent + child POST candidate");
  if (child.patch_ready) actions.push("PATCH ready");
  if (child.market_info_ready) actions.push("Market Info ready");
  return actions.join(" · ") || "No available XML action";
}
