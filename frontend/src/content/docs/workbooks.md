# Workbooks

## Purpose

The `Workbooks` area is the intake and preparation stage for the application. It focuses on understanding the source Excel files, profiling workbook and sheet structure, and configuring how the application should interpret noisy or inconsistent source values.

## What The User Does Here

- review workbook families and sheet variants
- inspect sheet-level profiling results
- identify parsing and normalization issues
- accept recommended normalization fixes
- confirm that the source Excel files remain unchanged

## Key Principle

The source workbooks are treated as input evidence. When the UI offers a fix, the application is updating its own normalization and interpretation rules rather than editing the underlying spreadsheet files.

## Current Decisions

- the source Excel workbooks will remain unchanged
- workbook issues are handled through normalization and interpretation rules in the application
- workbook analysis should prepare the data needed by the canonical device model
- the current phase does not introduce database persistence

## How This Connects Forward

The `Workbooks` area is responsible for producing a trustworthy preparation layer for the canonical model. In practice, that means:

- identifying which workbook fields support `BasicDevice` meaning
- identifying which workbook fields support `DeviceRecord` meaning
- recording where the source data is incomplete, inconsistent, or only partially aligned with the schema
- carrying normalization outcomes forward as evidence for canonical mapping

## Expected Outputs

- workbook and sheet inventory
- column profiling summaries
- detected parsing issues
- YAML normalization rules
- a cleaner preparation layer for canonical mapping
