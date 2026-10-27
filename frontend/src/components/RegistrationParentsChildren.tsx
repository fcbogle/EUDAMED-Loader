import { Fragment, useEffect, useState } from "react";
import { api } from "../api";
import type { RegistrationChildrenPage, RegistrationSummary } from "../types";
import { childXmlActions, parentNextStep, registrationParents, type RegistrationParent } from "../registrationParents";

function ParentChildren({ parent, importBatchId }: { parent: RegistrationParent; importBatchId: number }) {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<RegistrationChildrenPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);
    api.registrationChildren({ basic_udi_di: parent.basicUdiDi, issuing_entity: parent.issuer!,
      group_keys: parent.groupKeys, import_batch_id: importBatchId, offset, limit: 20 })
      .then(result => { if (!cancelled) setPage(result); })
      .catch((failure: Error) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [parent, importBatchId, offset, retry]);

  if (error) return <div className="registration-children-detail" role="alert">
    <p>{error}</p><button type="button" className="ghost-button" onClick={() => setRetry(value => value + 1)}>Retry</button>
  </div>;
  if (!page) return <p className="registration-children-detail" role="status">Loading children…</p>;
  return <div className="registration-children-detail">
    <p className="panel-copy">Children in the current filter. Registration status and XML eligibility are shown separately.</p>
    {page.total !== parent.total ? <p role="status">The recorded state has changed. Refresh counts to update the parent row.</p> : null}
    <div className="testing-summary-table-shell">
      <table className="workbook-files-table registration-children-table">
        <caption className="visually-hidden">Children of {parent.basicUdiDi}</caption>
        <thead><tr><th>Model</th><th>Catalogue number</th><th>UDI-DI</th><th>Registration status</th><th>XML eligibility</th></tr></thead>
        <tbody>{page.children.map(child => <tr key={child.key}>
          <td>{child.product_family} / {child.product_variant}</td>
          <td>{child.catalogue_number || "Unavailable"}</td>
          <td><code>{child.issuing_entity}: {child.primary_udi_di}</code></td>
          <td><span className={`status-pill compact ${child.registration_status === "Registered" ? "ok" : "warn"}`}>{child.registration_status === "Awaiting registration" ? "Unregistered" : child.registration_status}</span></td>
          <td>{childXmlActions(child)}{child.registration_status === "Unknown" && child.post_ready ? <div className="panel-copy">Confirm registration status before POST.</div> : null}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!page.total ? <p>No reconciled children are available. Refresh counts.</p> : null}
    <div className="registration-children-pagination">
      <span>{page.total ? `${page.offset + 1}–${page.offset + page.children.length} of ${page.total}` : "0 children"}</span>
      <button type="button" className="ghost-button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - page.limit))}>Previous</button>
      <button type="button" className="ghost-button" disabled={offset + page.limit >= page.total} onClick={() => setOffset(offset + page.limit)}>Next</button>
    </div>
  </div>;
}

export function RegistrationParentsChildren({ summary }: { summary: RegistrationSummary }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // This component is remounted for each refreshed summary to discard stale drill-down state.
  const [parents] = useState(() => registrationParents(summary.groups));
  return <div>
    <p className="panel-copy">{parents.length} Basic UDI parent{parents.length === 1 ? "" : "s"} in the current filter. Open a parent to view its children.</p>
    <p className="panel-copy">Unregistered means present in the imported Template or BasicUDI workbook but absent from recorded EUDAMED evidence. Unknown means absent from all these sources. Identity checks control XML eligibility separately.</p>
    <div className="testing-summary-table-shell">
      <table className="workbook-files-table registration-parents-table">
        <caption className="visually-hidden">Parents and children registration overview</caption>
        <thead><tr><th>Model / Basic UDI-DI</th><th>Parent status</th><th>Children</th><th>Registered</th><th>Unregistered</th><th>Unknown</th><th>Child POST ready</th><th>Next step</th></tr></thead>
        <tbody>{parents.map((parent, index) => <Fragment key={parent.key}>
          <tr>
            <td><button type="button" className="registration-parent-toggle" disabled={!parent.issuer || summary.import_batch_id == null}
              aria-expanded={expanded === parent.key} aria-controls={`registration-parent-children-${index}`}
              onClick={() => setExpanded(value => value === parent.key ? null : parent.key)}>
              <span aria-hidden="true">{expanded === parent.key ? "▾" : "▸"}</span>
              <span><strong>{parent.models.join(" · ")}</strong><code>{parent.issuer ? `${parent.issuer}: ` : ""}{parent.basicUdiDi}</code></span>
            </button></td>
            <td><span className={`status-pill compact ${parent.registered ? "ok" : "warn"}`}>{parent.registrationStatus}</span></td>
            <td>{parent.total}</td><td>{parent.registeredChildren}</td><td>{parent.awaiting}</td><td>{parent.unknown}</td><td>{parent.childPostReady}</td><td>{parentNextStep(parent)}</td>
          </tr>
          {expanded === parent.key && summary.import_batch_id != null ? <tr id={`registration-parent-children-${index}`}><td colSpan={8}>
            <ParentChildren parent={parent} importBatchId={summary.import_batch_id} />
          </td></tr> : null}
        </Fragment>)}</tbody>
      </table>
    </div>
    {!parents.length ? <p>No parent groups match the current filter.</p> : null}
  </div>;
}
