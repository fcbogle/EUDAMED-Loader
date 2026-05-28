# Workbooks

## Purpose

The `Workbooks` area is the intake and source-review stage for the application. It focuses on understanding the source Excel files, profiling workbook and sheet structure, and surfacing where the selected workbook or sheet looks sparse, incomplete, or likely to need later normalization attention.

## What The User Does Here

- review workbook inventory and workbook-family variants
- review product-family registration/update totals at a glance
- inspect the selected workbook and selected sheet
- review sheet-level profiling and missing-data signals
- inspect deeper profile and normalization detail when needed
- use the tab as read-only source evidence before canonical review begins
- confirm that the source Excel files remain unchanged

## Key Principle

The source workbooks are treated as input evidence. The current `Workbooks` experience is primarily read-only: it helps the reviewer understand what is in the source files and what may need attention later, without editing the underlying spreadsheet files.

## Current Decisions

- the source Excel workbooks will remain unchanged
- `data/basic_udi_reference/BasicUDIs.xlsx` is now the authoritative Basic UDI source workbook
- `data/basic_udi_reference/uat-eudamed_mdr_products_tracekey_sample_data.xlsx` is retained only as a temporary legacy comparison source
- workbook issues are handled through normalization and interpretation rules in the application rather than by editing source files
- workbook analysis should prepare the data needed by the canonical device model
- the current phase does not introduce database persistence
- the five main family workbooks currently remain in scope for active variant mapping
- `Template for Accessories_Footspares EUDAMED.xlsx` is temporarily excluded from active variant mapping until QMS clarifies the accessory Basic UDI split
- the active workbook inventory intentionally hides the excluded accessories workbook from the main review list
- the current UI flow is:
  - workbook summary
  - product-family registration/update overview
  - inventory
  - selected workbook
  - selected sheet
  - review signals
  - deeper profile and normalization detail

## How This Supports The Application

The `Workbooks` area is responsible for producing a trustworthy preparation layer for the canonical model. In practice, that means:

- identifying which workbook sheet maps to which `BasicUDIs.xlsx` `Device Model`
- identifying which workbook fields support `BasicDevice` meaning
- identifying which workbook fields support `DeviceRecord` meaning
- recording where the source data is incomplete, inconsistent, or only partially aligned with the schema
- carrying normalization outcomes forward as evidence for canonical mapping
- making temporary exclusions explicit instead of hiding ambiguous source-to-Basic UDI joins

## Expected Outputs

- workbook and sheet inventory
- active workbook scope for variant mapping
- product-family row totals with `POST` and `PATCH` split
- column profiling summaries
- detected missing-data and normalization review signals
- YAML normalization rules
- a cleaner preparation layer for canonical mapping
