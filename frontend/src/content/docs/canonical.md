# Canonical

## Purpose

The `Canonical` area is the mapping-definition layer between the source workbooks and XML generation. It translates workbook fields into stable regulatory meaning and makes the `Excel -> Canonical -> Schema` path visible for first-phase review.

## Current Decisions

- the canonical model is driven by the needs of the EUDAMED Device schema
- the first release is focused on `UDI-DI` device details and market information
- the current regulatory scope is `MDR` only
- the first upload phase is aligned to `UDIDIType.xsd`
- `Basic UDI` records are already loaded manually and are treated as contextual linkage rather than the primary first-phase upload object
- the model must still preserve both `BasicDevice` meaning and `DeviceRecord` meaning
- the canonical layer is schema-informed, not a direct copy of the XSD structure
- the current phase uses non-persistent Pydantic domain models
- no database is part of the current implementation design
- workbook analysis is responsible for producing the normalized, traceable inputs needed by canonical mapping
- every field currently present in the shared Excel workbooks is being treated as mandatory for first-load preparation unless QMS says otherwise

## Reference Implementation

The first-pass canonical field model is defined in `backend/app/canonical_models.py`.

The current read-only mapping review artifact is stored under `config/canonical_mapping/` and exposed through the backend `canonical-review` API.

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

- keep the main mapping path visible
- hide secondary rationale behind drill-down detail
- let the user inspect assumptions without overwhelming the first screen

The canonical layer should not:

- mirror a workbook template
- become a persistence model in the current phase
- collapse basic-level and device-level meaning into one flat record
- force a fake value where the source data does not support one
- hide a first-phase assumption such as `MDR only`, `UDIDIType.xsd only`, or `Basic UDI already preloaded`

## First-Phase Delivery Scope

- target data:
  - `UDI-DI` device details and market information
- target legislation:
  - `MDR`
- target schema understanding:
  - `UDIDIType.xsd`
- current submission mode:
  - manual XML handoff for human testing in the production environment if needed
- current access constraint:
  - no approved Playground actor is available yet

## First-Phase Mandatory Rule

- for the current design baseline, every field present in the shared Excel spreadsheets is treated as mandatory for first-load preparation
- if a workbook field appears in scope but cannot be populated reliably, the canonical layer should flag that as a review issue rather than silently downgrade it
- if a value is already managed outside this load, such as previously loaded `Basic UDI` records, the canonical layer should mark it as contextual rather than as an upload omission

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

Represents the basic-level device meaning required by the Device schema and keeps it distinct from device-level UDI-DI record data. In the current first phase this object is mainly retained for context, linkage, and audit because the `Basic UDI` records have already been loaded separately.

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

- no confirmed workbook field for `BasicDevice.basic_udi_di`
- no confirmed workbook field for manufacturer `SRN`
- no confirmed dedicated intended-purpose narrative field
- `DeviceRecord.basic_device_ref` is structurally planned but not yet populated by an implemented mapper
- the workbook has unlabeled fields such as `Unlabeled column (..., column 36)` and `Unlabeled column (..., column 37)` that currently have no canonical destination
- row-level canonical preview generation is not implemented yet
- source-to-canonical mapping is documented, but not yet executed by a mapping service

## Expected Outputs

- draft canonical entities
- complete workbook-to-canonical mapping reference
- explicit gap documentation
- validation issue summaries
- QMS-reviewed data ready for XML package generation
- a clear relationship between `BasicDevice` and `DeviceRecord`
