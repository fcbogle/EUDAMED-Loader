# XML Sample Comparison

## Purpose

This note keeps only the conclusions from comparing project XML with colleague-provided samples.

## Current Conclusions

- local XSD validity does not prove live service compatibility
- the scaffold currently uses:
  - `POST -> DEVICE.POST`
  - `PATCH -> UDI_DI.PATCH`
- equivalent first `PATCH` handling is special:
  - it should preserve `marketInfos` from the equivalent `POST`
  - it should use explicit lifecycle metadata

## Remaining Questions

- whether later standalone market-information maintenance should use a separate submission scenario
- whether any additional PATCH-only business fields are required in live EUDAMED behavior
- whether the XML-facing field contract should be simplified further before submission workflow is added
