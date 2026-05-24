# Workbooks

## Purpose

The `Workbooks` area is the intake and source-review stage for the application. It focuses on understanding the source Excel files, profiling workbook and sheet structure, and surfacing where the selected workbook or sheet looks sparse, incomplete, or likely to need later normalization attention.

## What The User Does Here

- review workbook inventory and workbook-family variants
- inspect the selected workbook and selected sheet
- review sheet-level profiling and missing-data signals
- inspect deeper profile and normalization detail when needed
- use the tab as read-only source evidence before canonical review begins
- confirm that the source Excel files remain unchanged

## Key Principle

The source workbooks are treated as input evidence. The current `Workbooks` experience is primarily read-only: it helps the reviewer understand what is in the source files and what may need attention later, without editing the underlying spreadsheet files.

## Current Decisions

- the source Excel workbooks will remain unchanged
- workbook issues are handled through normalization and interpretation rules in the application rather than by editing source files
- workbook analysis should prepare the data needed by the canonical device model
- the current phase does not introduce database persistence
- the current UI flow is:
  - inventory
  - selected workbook
  - selected sheet
  - review signals
  - deeper profile and normalization detail

## How This Supports The Application

The `Workbooks` area is responsible for producing a trustworthy preparation layer for the canonical model. In practice, that means:

- identifying which workbook fields support `BasicDevice` meaning
- identifying which workbook fields support `DeviceRecord` meaning
- recording where the source data is incomplete, inconsistent, or only partially aligned with the schema
- carrying normalization outcomes forward as evidence for canonical mapping

## Expected Outputs

- workbook and sheet inventory
- column profiling summaries
- detected missing-data and normalization review signals
- YAML normalization rules
- a cleaner preparation layer for canonical mapping
