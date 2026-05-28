# Canonical

## Purpose

The `Canonical` area is the mapping-definition review layer between the source workbooks and later XML generation. It translates workbook fields into stable regulatory meaning and presents two linked review surfaces:

- `Source Sheet To Basic UDI Variant`
- `Canonical Mapping`

## Current Decisions

- the canonical model is driven by the needs of the EUDAMED Device schema
- the first release is focused on `UDI-DI` device details and market information
- the current regulatory scope is `MDR` only
- the first upload phase is focused on `UDI-DI` business content, but the generated XML artifact is a wrapped service `Push` message rooted at `Message.xsd`
- `Basic UDI` records remain contextual linkage rather than the primary first-phase upload object, but the authoritative source is now `data/basic_udi_reference/BasicUDIs.xlsx`
- the model must still preserve both `BasicDevice` meaning and `DeviceRecord` meaning
- the canonical layer is schema-informed, not a direct copy of the XSD structure
- the current phase uses non-persistent Pydantic domain models
- no database is part of the current implementation design
- workbook analysis is responsible for producing the normalized, traceable inputs needed by canonical mapping
- every field currently present in the shared Excel workbooks is being treated as mandatory for first-load preparation unless QMS says otherwise
- Basic UDI linkage is now variant-level rather than one shared family-level context
- market-availability meaning should be represented as repeated per-country items rather than one flat country-list field
- the current XML direction is variant-scoped, so single-record and family-batch XML generation will later run per product variant
- repeated workbook areas should be assembled first as canonical list items and then normalized to schema enum codes through explicit rule files

## Reference Implementation

The first-pass canonical field model is defined in `backend/app/canonical_models.py`.

The current read-only mapping review artifact is stored under `config/canonical_mapping/` and exposed through the backend `canonical-review` API.

The review artifact now reflects the wider XML-facing field set used by the current `MDR` `UDI-DI` preparation path. In practice, that means the canonical review is no longer limited to a narrow workbook-to-canonical preview. It now also documents the derived and reference-backed fields needed to produce schema-valid `Push` message content for variant-scoped upload preparation.

The current object set is:

- `SourceReference`
- `NormalizationEvidence`
- `Manufacturer`
- `BasicDevice`
- `StorageCondition`
- `CriticalWarning`
- `MarketAvailability`
- `DeviceRecord`
- `ValidationIssue`
- `CanonicalDeviceBundle`

## Design Intent

The canonical layer should:

- preserve workbook provenance
- record normalization outcomes
- separate `BasicDevice` concerns from `DeviceRecord` concerns while making clear that `DeviceRecord` is the primary first-phase review object
- make schema projection possible without embedding workbook-specific assumptions into XML generation
- expose data gaps explicitly rather than hiding them
- surface all first-phase mapping assumptions for human and QMS review

The `Canonical` tab should present the mapping contract in a review-friendly way:

- keep variant-level Basic UDI linkage visible
- use a summary-first explanation of the business layer before the mapping contract
- keep the review tables available on demand through closed accordions so the main screen stays readable

The canonical layer should not:

- mirror a workbook template
- become a persistence model in the current phase
- collapse basic-level and device-level meaning into one flat record
- force a fake value where the source data does not support one
- hide a first-phase assumption such as `MDR only`, wrapped `Push` message output, or `Basic UDI` already preloaded

## First-Phase Delivery Scope

- target data:
  - `UDI-DI` device details and market information
- target legislation:
  - `MDR`
- target schema understanding:
  - wrapped `Message.xsd` service-message output carrying `MDRBasicUDI` and `MDRUDIDIData` content
- current submission mode:
  - manual XML handoff for human testing in the production environment if needed
- current access constraint:
  - no approved Playground actor is available yet

## First-Phase Mandatory Rule

- for the current design baseline, every field present in the shared Excel spreadsheets is treated as mandatory for first-load preparation
- if a workbook field appears in scope but cannot be populated reliably, the canonical layer should flag that as a review issue rather than silently downgrade it
- if a value is already managed outside this load, such as previously loaded `Basic UDI` records, the canonical layer should mark it as contextual rather than as an upload omission

## Current State

- the canonical review now supports variant-level Basic UDI linkage across all in-scope non-accessories product families
- `Basic UDI` context is resolved from `BasicUDIs.xlsx` rather than from one shared family-level workbook assumption
- in-scope workbook sheets now map to specific `BasicUDIs.xlsx` `Device Model` rows
- `Manufacturer SRN`, `Authorised Representative SRN`, `Basic risk class`, `Basic model`, and other `MDRBasicUDI` fields are now represented in the review artifact as derived/reference-backed mappings
- `Manufacturer SRN` and `Authorised Representative SRN` are now modeled as supplemental legacy tracekey enrichments because the authoritative `BasicUDIs.xlsx` workbook does not currently carry those SRN values
- `Operation` is now treated as explicit submission-intent metadata that later drives `POST` vs `PATCH` service behavior
- source `Version` is preserved as an internal marker for now and is not yet treated as authoritative EUDAMED entity version
- `UDI-DI identifier`, `Basic UDI identifier`, `number of reuses`, `base quantity`, and other XML-facing `UDIDIData` fields are now represented explicitly rather than remaining implicit in the review
- `Market Availability`, `Storage Conditions`, and `Critical Warnings` are now represented as repeated canonical structures where applicable
- the main UI now presents:
  - top-level variant/source summary cards
  - a four-part `Business Layer` summary, including canonical field count, canonical entity groups, and logical schema types referenced
  - a closed `Source Sheet To Basic UDI Variant` review table
  - a closed `Canonical Mapping` review table with schema-use pills and per-row schema-file references

## Review Surfaces

The current `Canonical` UI is organized to support QMS review rather than developer-only inspection.

### `Source Sheet To Basic UDI Variant`

This table is the product-variant linkage review surface. It is intended to answer:

- which source workbook sheet is being treated as which product variant
- which `Basic UDI-DI` record is being linked
- whether the linked variant is currently treated as `POST` or `PATCH`
- whether the linkage is matched, excluded, or still needs attention

### `Canonical Mapping`

This table is the field-level mapping contract. It is intended to answer:

- which source workbook field is being used
- what canonical meaning the application assigns to it
- what EUDAMED target it maps to
- which schema file currently carries that target
- whether the mapping is direct, derived, normalized, repeated, or a gap
- what assumptions or review notes still apply

## Schema Coverage

The current canonical review spans more than one logical schema layer.

- business payload schemas:
  - `UDIDIType`
  - `BasicUDIType`
  - `DeviceBasicUDIType`
  - `MDRBasicUDIType`
  - `CommonDeviceType`
- market information schemas:
  - `MarketInfoType`
  - `MarketInfosType`
- service-envelope schema:
  - `ServiceType`
- base entity metadata:
  - `Entity`
- device-data payload schemas:
  - `UDIDIDataType`
  - `DeviceUDIDIDataType`

This matters because the canonical layer is no longer only a business-payload mapping surface. It now also carries fields that later feed:

- wrapped service-message behavior
- per-variant market-availability structures
- base entity metadata decisions that still require QMS confirmation

In the current UI, these schema references are shown primarily as logical schema types under `EUDAMED Schema Use:`. Physical `.xsd` files are not summarized as a separate top-level count; instead, they are shown row-by-row in the `Canonical Mapping` table where they add direct traceability value.

## Resolved And Unresolved Items

The current canonical review should be read as a mixture of:

- resolved schema mappings
- resolved enrichment rules
- remaining business or source-data questions

### Resolved Schema Mapping Example

The `URL for additional information (as electronic instructions for use):` field is now mapped to:

- `UDIDIType/website`

That means the field is no longer only preserved as a visible canonical placeholder. It now has a concrete schema target in the local EUDAMED `UDIDI` model.

### Remaining Unresolved Or Partially Resolved Items

The remaining items are narrower than before and fall into different categories.

- `basic_device.intended_purpose_summary`
  - current issue:
    - no confirmed source field exists in the current workbook set
  - interpretation:
    - source-data gap more than schema-file uncertainty
- `basic_device.source_version_marker`
  - current issue:
    - the workbook `Version` field is still treated as internal submission metadata
  - interpretation:
    - the team has not yet confirmed whether it should populate real EUDAMED `Entity/version`
- `device_record.secondary_identifier`
  - current issue:
    - the exact downstream XML-facing schema placement still needs confirmation in the next XML-focused phase
- `manufacturer.manufacturer_srn`
  - current state:
    - the field is no longer unresolved for current review or validation
    - it is supplemented from `data/basic_udi_reference/uat-eudamed_mdr_products_tracekey_sample_data.xlsx`
  - interpretation:
    - the remaining question is governance and source ownership, not absence of a current value
- `basic_device.authorised_representative_srn`
  - current state:
    - the field is likewise supplemented from `data/basic_udi_reference/uat-eudamed_mdr_products_tracekey_sample_data.xlsx`
  - interpretation:
    - the remaining question is whether this supplemental legacy source should remain the long-term owner for SRN values

### Important Distinction

Two different questions appear in the canonical review and should not be confused.

- value resolved by enrichment:
  - the application can determine the value from a trusted joined or derived source such as `BasicUDIs.xlsx`
- schema target confirmed:
  - the application has identified the exact logical schema path and, where possible, the underlying `.xsd` file

A field can be resolved in the first sense without yet being fully confirmed in the second.

## Enum Strategy

The current enum strategy is deliberately explicit and reviewable.

- workbook phrases are preserved as source evidence
- canonical repeated items carry both:
  - the raw workbook phrase
  - the normalized schema code
- normalization rules live in `config/normalization/` rather than being hidden in the XML renderer
- comments and free text remain separate from enum codes

For the current implemented workbook examples, the normalization mappings are:

- `Lower limit of temp` -> `SHC006`
- `Upper limit of temp` -> `SHC007`
- `Consult instructions for use` -> `CW010`

The supporting rule files are:

- `config/normalization/storage_handling_condition_primary.yaml`
- `config/normalization/storage_handling_condition_secondary.yaml`
- `config/normalization/critical_warning_type.yaml`

This keeps the mapping contract auditable:

- source phrase
- normalization rule
- canonical repeated item
- schema enum value

## Mapping Principles

Each canonical field should be classified as one of:

- direct:
  - copied from a source column with no normalization needed
- normalized:
  - copied from a source column after normalization rules are applied
- derived:
  - inferred from multiple workbook fields or from workflow context
- repeated:
  - collected into a repeating substructure such as storage conditions or warnings
- gap:
  - required or useful canonical meaning with no current workbook source

Every canonical field should also be traceable to:

- workbook
- sheet
- source column
- source row when row-level canonical previews are added

## Canonical Object Breakdown

## `SourceReference`

### Purpose

Captures provenance for every meaningful canonical value.

### Fields

- `workbook`
- `sheet`
- `row_index`
- `source_column`

### Mapping notes

- `workbook` maps from the workbook filename
- `sheet` maps from the workbook tab name
- `source_column` maps from the original source header
- `row_index` is currently a planned field for later row-level mapping output

## `NormalizationEvidence`

### Purpose

Explains when a canonical value was shaped by a normalization rule rather than copied directly from source.

### Fields

- `source_field`
- `raw_value`
- `normalized_value`
- `rule_file`

### Current examples

- `UDI-DI status e.g. On the EU market`
- `Select the language e.g English`

## `Manufacturer`

### Purpose

Holds manufacturer- or issuer-level information that should not be stored only as device-level flat text.

### Fields

- `issuing_entity`
- `manufacturer_srn`
- `designed_by_another_legal_entity`
- `source_refs`

### Mapping notes

#### `issuing_entity`

- classification:
  - direct
- source column:
  - `Issuing Entity e.g. GS1`
- current observed value pattern:
  - strongly constant in current data

#### `manufacturer_srn`

- classification:
  - gap
- current source:
  - no confirmed workbook column

#### `designed_by_another_legal_entity`

- classification:
  - direct
- source column:
  - `Is the device designed and manufactured by another legal or natural person? E.g. NO`

## `BasicDevice`

### Purpose

Represents the basic-level device meaning required by the Device schema and keeps it distinct from device-level UDI-DI record data. In the current first phase this object is mainly retained for context, linkage, and audit, but it is now resolved per product variant rather than one shared family bundle.

### Fields

- `basic_udi_di`
- `regulation`
- `nomenclature_code`
- `intended_purpose_summary`
- `annex_xvi_other_purpose`
- `clinical_investigation`
- `source_refs`

### Mapping notes

#### `basic_udi_di`

- classification:
  - derived
- current source:
  - expected to come from the previously registered `Basic UDI` reference list rather than from this first upload workbook set
- discussion note:
  - keep the field explicit for linkage and later schema projection, but do not treat it as a first-phase workbook gap by default
  - this value is required for UDI-DI upload even though it is not expected to be carried in the workbook itself

#### `regulation`

- classification:
  - derived
- current source:
  - not directly carried in the workbook template
- current confirmed project constraint:
  - `MDR`
- discussion note:
  - this is now a confirmed first-phase scope rule from QMS, though the source of truth should still move to explicit configuration later

#### `nomenclature_code`

- classification:
  - direct
- source column:
  - `Enter a nomenclature code (EMDN code) e.g starts with Y06xxxx then click Find`

#### `intended_purpose_summary`

- classification:
  - gap
- current source:
  - no dedicated narrative intended-purpose field found in the workbook template
- possible future source:
  - declarations, IFU material, or external regulatory source documents

#### `annex_xvi_other_purpose`

- classification:
  - direct
- source column:
  - `Intended purpose other than medical (Annex XVI) e.g. NO`

#### `clinical_investigation`

- classification:
  - direct
- source column:
  - `Clinical Investigation e.g. NO`

## `StorageCondition`

### Purpose

Represents one storage or handling rule attached to a device record.

### Fields

- `condition_type`
- `description`
- `sequence`
- `source_refs`

### Mapping notes

- classification:
  - repeated
- source columns:
  - `Storage/handling conditions, if applicable e.g. YES`
  - `Storage /handling conditions type e.g. Lower limit of temp`
  - `Description e.g. taken from IFU Technical Data page Storage Temp range e.g. -15C`
  - `Add another Storage/handling condition e.g. Upper limit of temp`
  - `Description e.g. taken from IFU Technical Data page Storage Temp range e.g. +50C`
- discussion note:
  - the workbook template suggests at least two storage-condition slots; the canonical model should treat these as a list rather than fixed paired columns

## `CriticalWarning`

### Purpose

Represents one warning or contraindication entry attached to a device record.

### Fields

- `warning_type`
- `description`
- `source_refs`

### Mapping notes

- classification:
  - repeated
- source columns:
  - `Critical warnings or contra-indications, if applicable e.g. Yes`
  - `Critical warning type e.g. Consult instructions for use`
- current limitation:
  - the workbook template exposes warning presence and warning type more clearly than a rich warning narrative

## `MarketAvailability`

### Purpose

Separates market-state information from the core device identity record. QMS has confirmed that market information is in scope for the first release, so this object is part of the first-phase upload preparation baseline rather than an optional later extension.

### Fields

- `market_status`
- `first_eu_market_country`
- `source_refs`

### Mapping notes

#### `market_status`

- classification:
  - normalized
- source column:
  - `UDI-DI status e.g. On the EU market`
- current normalization examples:
  - `On the EU Market` -> `On the EU market`
  - `On the market` -> `On the EU market`
  - `On the EU` -> `On the EU market`

#### `first_eu_market_country`

- classification:
  - direct
- source column:
  - `Member state where first placed on the EU market e.g. Germany`

## `DeviceRecord`

### Purpose

Holds the device-level UDI-DI meaning that will later project into the device-specific side of the Device schema. This is the primary canonical review object for the first upload phase.

### Fields

- `basic_device_ref`
- `primary_udi_di`
- `catalogue_number`
- `secondary_udi_di_applicable`
- `trade_name`
- `language`
- `quantity`
- `direct_marking`
- `udi_pi_type`
- `clinical_size_applicable`
- `single_use`
- `max_reuses_applicable`
- `sterilisation_before_use`
- `sterile`
- `contains_latex`
- `cmr_present`
- `endocrine_disruptor_present`
- `reprocessed_single_use`
- `human_tissue_present`
- `animal_tissue_present`
- `medicinal_substance_present`
- `blood_plasma_derivative_present`
- `storage_conditions`
- `warnings`
- `market_availability`
- `normalization_log`
- `source_refs`

### Identity and naming mappings

#### `basic_device_ref`

- classification:
  - derived
- current source:
  - should link the device record to the correct previously loaded `Basic UDI` context
- current status:
  - relationship placeholder that should be preserved even if the source workbook does not directly populate it

#### `primary_udi_di`

- classification:
  - direct
- source column variants:
  - `UDI-DI code e.g. taken from ist page of DoC (Note: needs to be 14 digits long, add zero to front of code)`
  - `UDI-DI code e.g. taken from 2nd page of DoC (Note: needs to be 14 digits long, add zero to front of code)`
- discussion note:
  - the variant labels should collapse onto the same canonical field

#### `catalogue_number`

- classification:
  - direct
- source column variants:
  - `Reference/ Catalogue number e.g . Taken from Product code in second page of DoC`
  - `Reference/ Catalogue number e.g . Taken from Product code on second page of DoC`

#### `trade_name`

- classification:
  - direct
- source column:
  - `Trade Name applicable e.g. YES (use Decription detail from second page of DoC`

#### `language`

- classification:
  - normalized
- source column:
  - `Select the language e.g English`

### Identification and UDI behavior mappings

#### `secondary_udi_di_applicable`

- classification:
  - direct
- source column:
  - `UDI-DI from another entity (secondary) applicable e.g. No`

#### `quantity`

- classification:
  - direct
- source column:
  - `Quantity of device e.g. 1`

#### `direct_marking`

- classification:
  - direct
- source column:
  - `Is the device directly marked? E.g. NO`

#### `udi_pi_type`

- classification:
  - normalized
- source column:
  - `Type of UDI-PI e.g. select Serial number and Manufacturing Date`
- discussion note:
  - current source shows formatting variants that should normalize to one canonical value

### Device property mappings

#### `clinical_size_applicable`

- classification:
  - direct
- source column:
  - `Clinical size applicable e.g. NO`

#### `single_use`

- classification:
  - direct
- source column:
  - `Labelled as single use e.g.NO`

#### `max_reuses_applicable`

- classification:
  - direct
- source column:
  - `Maximum number of reuses applicable e.g. NO`

#### `sterilisation_before_use`

- classification:
  - direct
- source column:
  - `Need for sterilsation before use e.g. NO`

#### `sterile`

- classification:
  - direct
- source column:
  - `Device labelled as sterile e.g. NO`

#### `contains_latex`

- classification:
  - direct
- source column:
  - `Containing latex e.g. NO`

#### `cmr_present`

- classification:
  - direct
- source column:
  - `Labelled for presence of Carcinogenic, Mutagenic and toxic to Reproduction (CMR) substances of category 1A or 1B e.g. NO`

#### `endocrine_disruptor_present`

- classification:
  - direct
- source column:
  - `Labelled for presence of substances with endocrine-disrupting properties e.g. NO`

#### `reprocessed_single_use`

- classification:
  - direct
- source column:
  - `Reprocessed single use device e.g. NO`

#### `human_tissue_present`

- classification:
  - direct
- source column:
  - `Presence of human tissues or cells, or their derivatives e.g. NO`

#### `animal_tissue_present`

- classification:
  - direct
- source column:
  - `Presence of animal tissues or cells, or their derivatives e.g. NO`

#### `medicinal_substance_present`

- classification:
  - direct
- source column:
  - `Presence of a substance which, if used separately, may be considered to be a medicinal product e.g. NO`

#### `blood_plasma_derivative_present`

- classification:
  - direct
- source column:
  - `Presence of a substance which, if used separately, may be considered to be a medicinal product derived from human blood or human plasma e.g. NO`

### Repeating and related mappings

#### `storage_conditions`

- classification:
  - repeated
- source:
  - mapped through `StorageCondition`

#### `warnings`

- classification:
  - repeated
- source:
  - mapped through `CriticalWarning`

#### `market_availability`

- classification:
  - structured
- source:
  - mapped through `MarketAvailability`

#### `normalization_log`

- classification:
  - derived
- source:
  - generated from accepted normalization rules and source-value transformations

## `ValidationIssue`

### Purpose

Represents a data-quality or mapping problem discovered during canonical preparation.

### Fields

- `severity`
- `code`
- `message`
- `canonical_path`
- `source_ref`

### Current role

- report missing basic-level fields such as `basic_udi_di`
- report unmapped source columns
- report unexpected nulls or suspicious source patterns

## `CanonicalDeviceBundle`

### Purpose

Represents the canonical payload for one mapped device context.

### Fields

- `manufacturer`
- `basic_device`
- `device_record`
- `validation_issues`

### Discussion note

This bundle is a useful working contract for previewing how one workbook row or row-group would become a schema-ready device submission unit without introducing persistence yet.

## Source-to-Canonical Mapping Summary

### Workbook identity and provenance

- workbook filename -> `SourceReference.workbook`
- sheet name -> `SourceReference.sheet`
- source header label -> `SourceReference.source_column`
- row index -> `SourceReference.row_index` when row-level mapping is implemented

### Manufacturer mappings

- `Issuing Entity e.g. GS1` -> `Manufacturer.issuing_entity`
- `Is the device designed and manufactured by another legal or natural person? E.g. NO` -> `Manufacturer.designed_by_another_legal_entity`
- no current workbook source -> `Manufacturer.manufacturer_srn`

### BasicDevice mappings

- `Enter a nomenclature code (EMDN code) e.g starts with Y06xxxx then click Find` -> `BasicDevice.nomenclature_code`
- `Intended purpose other than medical (Annex XVI) e.g. NO` -> `BasicDevice.annex_xvi_other_purpose`
- `Clinical Investigation e.g. NO` -> `BasicDevice.clinical_investigation`
- derived from workflow context -> `BasicDevice.regulation`
- no current workbook source -> `BasicDevice.basic_udi_di`
- no current workbook source -> `BasicDevice.intended_purpose_summary`

### DeviceRecord mappings

- `UDI-DI code ... ist page ...` -> `DeviceRecord.primary_udi_di`
- `UDI-DI code ... 2nd page ...` -> `DeviceRecord.primary_udi_di`
- `Reference/ Catalogue number ... in second page ...` -> `DeviceRecord.catalogue_number`
- `Reference/ Catalogue number ... on second page ...` -> `DeviceRecord.catalogue_number`
- `Trade Name applicable ...` -> `DeviceRecord.trade_name`
- `Select the language e.g English` -> `DeviceRecord.language`
- `UDI-DI from another entity (secondary) applicable e.g. No` -> `DeviceRecord.secondary_udi_di_applicable`
- `Is the device directly marked? E.g. NO` -> `DeviceRecord.direct_marking`
- `Quantity of device e.g. 1` -> `DeviceRecord.quantity`
- `Type of UDI-PI e.g. select Serial number and Manufacturing Date` -> `DeviceRecord.udi_pi_type`
- `Clinical size applicable e.g. NO` -> `DeviceRecord.clinical_size_applicable`
- `Labelled as single use e.g.NO` -> `DeviceRecord.single_use`
- `Maximum number of reuses applicable e.g. NO` -> `DeviceRecord.max_reuses_applicable`
- `Need for sterilsation before use e.g. NO` -> `DeviceRecord.sterilisation_before_use`
- `Device labelled as sterile e.g. NO` -> `DeviceRecord.sterile`
- `Containing latex e.g. NO` -> `DeviceRecord.contains_latex`
- `Labelled for presence of Carcinogenic, Mutagenic and toxic to Reproduction (CMR) substances of category 1A or 1B e.g. NO` -> `DeviceRecord.cmr_present`
- `Labelled for presence of substances with endocrine-disrupting properties e.g. NO` -> `DeviceRecord.endocrine_disruptor_present`
- `Reprocessed single use device e.g. NO` -> `DeviceRecord.reprocessed_single_use`
- `Presence of human tissues or cells, or their derivatives e.g. NO` -> `DeviceRecord.human_tissue_present`
- `Presence of animal tissues or cells, or their derivatives e.g. NO` -> `DeviceRecord.animal_tissue_present`
- `Presence of a substance which, if used separately, may be considered to be a medicinal product e.g. NO` -> `DeviceRecord.medicinal_substance_present`
- `Presence of a substance which, if used separately, may be considered to be a medicinal product derived from human blood or human plasma e.g. NO` -> `DeviceRecord.blood_plasma_derivative_present`
- storage-handling columns -> `DeviceRecord.storage_conditions`
- warning columns -> `DeviceRecord.warnings`
- market-status columns -> `DeviceRecord.market_availability`
- normalization outcomes -> `DeviceRecord.normalization_log`

## Mapping Examples

## Example 1: Market status normalization

- source field:
  - `UDI-DI status e.g. On the EU market`
- raw workbook value:
  - `On the market`
- normalized value:
  - `On the EU market`
- canonical result:
  - `device_record.market_availability.market_status = "On the EU market"`
- evidence recorded:
  - `NormalizationEvidence(source_field="UDI-DI status e.g. On the EU market", raw_value="On the market", normalized_value="On the EU market")`

## Example 2: Device identity mapping

- source fields:
  - `UDI-DI code e.g. taken from 2nd page of DoC (Note: needs to be 14 digits long, add zero to front of code)`
  - `Reference/ Catalogue number e.g . Taken from Product code on second page of DoC`
  - `Trade Name applicable e.g. YES (use Decription detail from second page of DoC`
- example source values:
  - `05050649104909`
  - `ECER22L1S`
  - `ECHELONER 22L CAT1-EXT. FOOT PROS'S`
- canonical result:
  - `device_record.primary_udi_di = "05050649104909"`
  - `device_record.catalogue_number = "ECER22L1S"`
  - `device_record.trade_name = "ECHELONER 22L CAT1-EXT. FOOT PROS'S"`

## Example 3: Basic-level nomenclature mapping

- source field:
  - `Enter a nomenclature code (EMDN code) e.g starts with Y06xxxx then click Find`
- example source value:
  - `Y062409`
- canonical result:
  - `basic_device.nomenclature_code = "Y062409"`

## Example 4: Storage-condition grouping

- source fields:
  - `Storage /handling conditions type e.g. Lower limit of temp`
  - `Description e.g. taken from IFU Technical Data page Storage Temp range e.g. -15C`
  - `Add another Storage/handling condition e.g. Upper limit of temp`
  - `Description e.g. taken from IFU Technical Data page Storage Temp range e.g. +50C`
- canonical result:
  - `device_record.storage_conditions = [StorageCondition(...), StorageCondition(...)]`

## Known Gaps and Open Issues

- `BasicDevice.basic_udi_di` is no longer a source-workbook gap; it is now resolved from the authoritative `BasicUDIs.xlsx` workbook after variant-level sheet matching
- manufacturer and authorised representative `SRN` values are currently supplied by the legacy tracekey workbook rather than by the authoritative `BasicUDIs.xlsx` workbook, so the remaining question is long-term source ownership rather than current absence
- several XML-facing `BasicDevice` properties are now carried as explicit canonical review fields even where the current source remains provisional or incomplete
- no confirmed dedicated intended-purpose narrative field
- `DeviceRecord.basic_device_ref` is now populated through the current validation-aligned canonical path, but later XML generation still needs to consume it directly
- the workbook has unlabeled fields such as `Unlabeled column (..., column 36)` and `Unlabeled column (..., column 37)` that currently have no canonical destination
- row-level canonical review is now surfaced operationally through `Canonical Validation`, while the `Canonical` tab remains the mapping-contract surface
- source-to-canonical mapping is now executed in validation-oriented services, but later XML generation still needs to consume that aligned field set directly

## Expected Outputs

- draft canonical entities
- complete workbook-to-canonical mapping reference
- explicit gap documentation
- validation issue summaries
- QMS-reviewed data ready for XML package generation
- a clear relationship between `BasicDevice` and `DeviceRecord`
