# Software Engineering Patterns

## Current Patterns

- layered backend: routers, services, models
- canonical intermediary between source workbooks and XML
- configuration-driven normalization rules
- read-only source evidence handling
- bounded batch generation

## Why They Matter Here

- workbook parsing stays separate from XML rendering
- validation can evolve without rewriting source profiling
- normalization rules remain visible in configuration
- XML generation depends on validated business meaning, not raw workbook shape

## Current Weak Spot

The main design gap is naming consistency between the declared canonical models and the XML-facing validation/XML contract. That should be tightened before adding more downstream workflow.
