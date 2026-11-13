# Archived Submission Activity report design

Archived November 13, 2026. The owner has narrowed Reporting to the
[Model Reconciliation Summary](ra-report-first-iteration.md). Submission Activity
is no longer offered in Reporting. The earlier implementation and evidence are
retained; the material below describes that earlier design.

## Model list and latest timing

The main table lists model names as hyperlinks, with no separate model selector
or model buttons. Each row shows latest usable recorded activity and its type,
latest ZIP download time, latest EUDAMED response time, ZIP record count, message
batch count and unlinked response-group count. Times display in UTC. Current
canonical model names are used for linked device subjects; recorded historical
labels are retained for evidence without a current relational model link.
Models in the current import with no activity remain visible.

Latest recorded activity means the latest usable timestamp among ZIP actions,
message generation/responses and explicitly unlinked response evidence. It does
not mean the exact time a ZIP was uploaded to EUDAMED. Records with missing or
unusable/timezone-less times remain in history and their count appears separately.
An unconfirmed historical ZIP generation is labelled accordingly, not as a download.

Follow a model hyperlink to the model's full activity history. It includes the same
latest record shown in the summary, marked Latest recorded activity, and all earlier
records. The model list remains visible for switching models; a link restores the
all-model history. History is paged at 25 records.

## ZIPs, batches and outcomes

A ZIP record shows its recorded generation/download times, filename, hash and flow.
An explicit `zip_download` review receipt establishes a recorded ZIP download/review
action. A generated ZIP without that receipt has no confirmed download timestamp.
Repeated downloads/identical filenames remain distinct recorded actions.

A message-batch record shows generation time, EUDAMED response time, operation,
batch/correlation reference and scoped entity outcomes. Status is calculated from
per-entity evidence rather than the cached overall batch flag:

- Awaiting response.
- Partially responded, where entities still have no response.
- Successful, failed or partial success after all known entities respond.
- Incomplete/conflicting evidence where outcomes cannot be established reliably.

A batch spanning several models appears in each relevant model's history with
that model's entity counts. Do not add model-level batch counts to infer unique
whole-application batches. Parent/basic-UDI and child/device entities are labelled
separately in optional detail. Repeated changes do not represent additional devices
registered. Accepted export baseline imports are not submission/upload activity.

Membership/event links and exact correlation plus membership establish associations.
The latest dated entity responses determine outcomes; conflicting or unorderable
statuses are not silently resolved using import order. Older responses with the
same exact batch lineage stay within that history. Response-only evidence without
a verified batch association appears as **Unlinked response**. No response is
attached to a ZIP by matching model name, filename or nearby dates.

The database does not consistently retain a package-to-message-batch association.
ZIP records and batches therefore remain separate. Their counts must not be called
portal-upload counts. A downloaded ZIP can exist without a recorded response; a
successful response can exist without a linked original ZIP. The report preserves
that distinction rather than fabricating a combined submission row.

## Evidence and attribution

Open **View record evidence** for dates, ZIP hash, response references, message and
correlation IDs, recorded transaction/submission IDs, error explanations and lineage
limitations. **Download retained response XML** is available where XML text remains
in the database. Missing files/references show unavailable/not recorded. The download
returns retained response text, not a reconstructed outgoing ZIP.

Individual entity identifiers/outcomes stay hidden until requested and are paged at
25 entries. Original outgoing ZIP/XML bytes are not reconstructed or claimed to be
retained by this report.

The following facts are not currently captured and remain **Not recorded**:

- Actual portal ZIP upload time and uploader.
- ZIP generator/downloader identity.
- Success XML importer identity.
- A separate application timestamp for importing the Success XML.

The EUDAMED response timestamp comes from response XML; it is not the application
import time. A delayed import must not change that interpretation. Operator names
are not inferred from the workstation or another activity. Authentication and future
attribution capture remain separate design work; no historical identities are filled.

## Excel and safety

**Download full report Excel** captures the whole generated report, independent of
the currently selected model. Context, model summaries, all history, response evidence
and record notes have separate sheets. Individual entity outcomes are included only
when selected before generation. Identifiers and formula-like strings are literal
Excel text. Long response lists use worksheet rows instead of oversized JSON cells.

Report generation uses one read-only/query-only SQLite snapshot. Response downloads
are read-only. No store constructors, schema migrations, imports, acceptance changes,
new authentication or EUDAMED transport are invoked. This first iteration is Dev-only;
Production integration requires separate review. Reports are not retained server-side;
download Excel to preserve the observation. This activity report is separate from
Stored Device Data Comparison and the planned Registration Evidence report.
