# Registration counts

Reviewed 11 October 2026 against the current service. Counts use recorded
acceptance evidence and, in Production, the prepared import classification.
The initial Production import on 10 October contained 10,026 devices, with five
review rows skipped. These are dated import findings, not live inventory totals.
Imported-baseline and confirmed template-only classification support is described
in [production-importer-design.md](production-importer-design.md).

## Registration views

Registration State has two internal tabs in both Dev and Production. **Registration
State** is the existing counts and operation table and remains the default.
**Parents & Children** groups the currently filtered model rows by issuer plus
Basic UDI-DI. Each parent shows its recorded status, total children, registered,
awaiting and unknown children, child POST readiness and a suggested next step.
Models sharing a regulatory parent appear together; different issuers remain
separate. Unresolved parent groups remain visible and cannot be expanded.

Both tabs share model/search, readiness-status and actionable filters. Counts in
the parent view cover children in that filter, not necessarily every child of a
parent. Expanding one parent loads child details through
`POST /api/xml/registration-children`, with 20 children per page in the UI (the API
allows up to 100). Previous/Next controls show the current range and total. Details
show model, catalogue number, issuer-qualified UDI-DI, registration status and
XML eligibility. Child details use the same deduplication, acceptance and
readiness calculation as the summary. Import changes are rejected with a refresh
message; refreshing counts clears expanded details. Unknown registration remains
unknown even if POST XML is eligible. Suggested actions do not generate or submit
XML. The new view does not change persistence or generation rules.

## Evidence and counting

Registration State and Testing Summary / Submission Summary now share
`POST /api/xml/registration-summary`. The response is calculated over the complete
SQLite snapshot for the latest import, not capped frontend subject or event lists.
Family, variant, parent-code search, readiness status and actionable filters are
applied before the summary totals are returned. The snapshot must belong to the
latest import; stale or concurrently changing import/acceptance state is rejected
with a refresh message.

Unique UDI-DI devices are identified by issuing entity plus UDI-DI. Basic UDI-DI
parents are counted separately by issuing entity plus Basic UDI-DI, including
when one parent appears in several family/variant rows. Family/variant labels do
not themselves define a regulatory parent or device identity.

A device is registered when successful DEVICE.POST, UDI_DI.POST or UDI_DI.PATCH
acceptance evidence can be matched to its current identity. Relational
`device_subject_id` links are preferred and checked against the identifier and
available issuer evidence. Unlinked successes require recoverable issuer
evidence. Parent-only DEVICE.POST successes count parents, not children.
Successful operation events are separate history metrics; repeat PATCH successes
never increase the number of registered devices. Reviewed/generated packages,
ERROR events, version numbers and the default `unregistered` value alone do not
prove registration status.

Devices without matched acceptance evidence are **unknown**, unless the trusted
Production import explicitly classifies their current identities as not registered.
Those Production identities count as **awaiting registration**, subdivided into
ready and blocked. Dev's default `unregistered` flag and a workbook POST
instruction are not negative-registration evidence. An empty database or an
unsuccessful submission does not establish that an identity is absent from EUDAMED.
Unknown identities must be checked against the agreed environment evidence.

POST XML eligibility is shown separately from registration status. Readiness
uses the same per-record operation assessment as XML generation, with additional
conservative exclusions for ambiguous issuing entities, unresolved parents,
conflicting duplicate drafts and open import identity issues. PATCH and Market
Info ready counts require matched accepted device identity as well as generation
eligibility. This change does not alter XML generation rules or submission
transport.

Unique-device totals cover identified devices in the current **canonical import
scope**. They are not an assertion that every workbook row is a device. The UI
shows whole-import source/canonical row totals, rows outside canonical scope,
unresolved/conflicting identities, duplicate identities, open identity issues and
acceptance subjects unmatched to current identities. These exceptions must be
reviewed before treating the displayed totals as the complete Production device
inventory. Conflicting identities are excluded and reported, not silently split
into multiple devices. Parent totals cover resolved parent identifiers.

The UI displays the import timestamp, latest recorded acceptance timestamp and
count calculation time. This is recorded local evidence for the selected
environment, not live EUDAMED synchronization. Failed or pending requests display
dashes. Refresh counts recalculates the same scope. Detailed history may still
load at most 10,000 events; its limitation is disclosed, while operation-history
totals come from the uncapped backend calculation. Whole-import exception counts
remain global when table filters are applied; history totals follow model/search
filters independently of readiness/actionable filters.

Synthetic tests cover identity deduplication/conflicts, separate issuer
identities, parent-only success, repeated operations, missing acceptance,
identifier changes, filtering, uncapped history, snapshot changes, actual POST
assessment rules, and unavailable UI counts.

## Production imported evidence

Imported export snapshots count as registration evidence for distinct devices and
parents/cohort eligibility. They have `IMPORTED` status and contribute zero upload
operation successes. Trusted template-only identities count as awaiting registration.
Actual Upload Success XML events continue to determine POST/PATCH/Market Info
operation counts and advance accepted states. Import eligibility and XML readiness
are reported separately; the five review rows are excluded from the initial import.
