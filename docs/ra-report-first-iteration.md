# Model Reconciliation Summary

Updated November 13, 2026. This is the only active report under **Reporting**.
The owner has narrowed the first reporting release to a model summary. Submission
Activity is removed from Reporting; its earlier documentation and implementation
are retained as historical work. No evidence or submission history is deleted.

## Using the summary

Open **Reporting → Model Reconciliation Summary**, then **Generate summary**.
It uses the latest suitable complete EUDAMED XML set retained through Data Import.
Reporting has no upload control or extract selector. New/corrected extracts enter
through Import Data. The displayed extract dates and database import identify
what was compared; this is a comparison with a dated extract, not a live portal query.

The owner confirmed **current stored device data against the EUDAMED extract**.
The summary reads canonical device fields and structured items from the database
import displayed in the report. Accepted registration snapshots, outgoing payloads,
submission history, unaccepted drafts and source workbook files do not supply
fallback values. A device can match without any submission history when its
current stored attributes agree with the extract.

## One row per model

| Column | Meaning |
| --- | --- |
| Model | Application family/model grouping; family shown when names repeat |
| Database devices | Unique scoped database device records in that model |
| Compared | Database devices matched to an issuer-qualified identity in the extract |
| Matching | Compared devices with all supported attributes matching |
| Data exceptions | Compared devices with differing/missing attributes or unsupported comparison scope |
| Not in extract | Registration coverage; these devices are outside the comparison denominator |
| EUDAMED only | Registered extract identities missing from the database; shown when present |
| Unresolved identity | Database identities that cannot be assigned to the compared/absent sets; shown when present |
| Status | Green **Registered data matches**, amber **Data exceptions**, or neutral **No devices compared** |

Matching plus data exceptions equals **Compared**, not the full database total.
Compared plus Not in extract plus Unresolved identity equals Database devices.
Several differing fields on one compared device count as one exception.
Awaiting registration is an expected workflow state. Devices absent from the extract
are coverage information and do not make a model amber; absence alone also does not
prove that a device is unregistered.

Green means every compared registered device agrees across the supported fields,
with no assigned EUDAMED-only device missing its application record. Models with no
compared devices are neutral unless an EUDAMED-only registered record needs attention.
A wholly unregistered model is never described as 100% matched. Missing or differing
attributes on a compared registered device make the model amber. EUDAMED-only records
remain separately highlighted because they represent missing application records,
not devices awaiting registration.

An EUDAMED-only identity is assigned using a uniquely linked Basic UDI-DI. Where that
link cannot identify one application model, it remains visible as an explicitly
unlinked EUDAMED model row, rather than being guessed into an existing model.
Totals include these rows. Neither identifiers nor individual devices are displayed.

There are no model drill-downs, device lists or device-detail export options in this
iteration. **Download summary Excel** contains Context and Models only. It records
comparison basis, source dates/scope, field coverage and model totals, with no
individual device worksheet. The summary API response also omits device rows and
grouped findings. Detailed investigation is deferred until this summary is agreed.

## Comparison scope and sources

**Comparison details** contains supported attributes, selection/scope notes and any
excluded retained sets. The selected set is checked again during generation, so a
new extract imported after the page opened is identified by the generated result.
No usable extract means no assessment; it is never presented as a zero-exception
report. Selection uses recorded export dates and verified retained manifests/pages,
not file modification times. Declared complete pages do not establish that the
operator exported every model or used no portal business filters.

The comparison checks supported child-device attributes and Market Info
country/original-placement attributes. Registration transaction versions/dates are not current canonical device
attributes and are excluded. Parent attributes, unsupported multilingual projections
and live portal changes are also outside scope. Missing values and unsupported projections prevent an all-match outcome.
Optional nulls agree only when explicitly stored; ordering alone does not change
code/country sets. No source values, accepted state or workflow history are updated.

Reporting supports both Dev / Playground and Production, with separate database
and retained extract sources. Production uses its existing schema 3.0.30 profile;
no schema, profile, migration or database import is needed to enable reporting.
Database connections use SQLite read-only mode and query-only transactions.
The active Production endpoint accepts the model summary only; archived detailed
and Submission Activity reports remain unavailable in Production.

A suitable Production extract must already be retained through Production Data
Import. Dev extracts and historical acceptance snapshots are never substituted.
If none is available, generation stays disabled and the operator is directed to
Data Import. Source review and workbook preparation can retain the XML set without
confirming a database import; confirmation of the final import is a separate action.
Production source limits follow Data Import: 500 files / 256 MB per set, with
20 MB per XML file. Dev retains its existing 100-file / 60 MB set limits.

Current stored boolean/quantity values are parsed without defaulting missing values
to false or zero. Number of reuses supports the official schema's `-1` not-applicable
value; base quantity, when populated, must be positive. Existing country/language/code
normalisation conventions are reused. Questioned countries and unusable structured
item mappings remain exceptions. Optional nulls/empty lists agree only when stored
explicitly; missing fields remain unknown.
