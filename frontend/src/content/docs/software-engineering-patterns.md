# Software Engineering Patterns

## Purpose

The `Software Engineering Patterns` section explains the main design patterns already present in the application. Its purpose is to show why the project structure supports controlled growth, clearer reasoning, and safer extension into later capabilities such as submission history and EUDAMED machine-to-machine integration.

## SOLID

`SOLID` is a set of five software design principles used to make code easier to understand, extend, test, and maintain.

It stands for:

- `Single Responsibility Principle`
  - a class or module should have one main reason to change
- `Open/Closed Principle`
  - software should be open for extension, but closed for modification
- `Liskov Substitution Principle`
  - a subtype should be usable wherever its base type is expected without breaking behavior
- `Interface Segregation Principle`
  - code should not be forced to depend on interfaces it does not use
- `Dependency Inversion Principle`
  - higher-level logic should depend on abstractions rather than directly on low-level implementation details

In this project, the SOLID principles most clearly reflected in the design are:

- `Single Responsibility Principle`
  - routers handle HTTP/API requests
  - services handle business logic
  - canonical models represent regulatory meaning
  - validation models represent readiness and evidence
  - XML models represent preview, validation, and batch-output contracts
- `Open/Closed Principle`
  - normalization and enum-mapping rules can be extended through configuration files
  - new documentation sections can be added without redesigning the documentation system
  - future layers such as `Submission History` and `M2M Integration` can be added downstream of the current XML generation path
- `Dependency Inversion Principle`
  - higher-level application flow depends on defined models, routers, and services rather than on ad hoc direct transformation logic
  - the XML generation layer depends on validated canonical meaning rather than directly on raw workbook structure

## Layered Architecture

The application follows a layered structure.

- the frontend handles presentation and user interaction
- the router layer exposes backend functionality as HTTP endpoints
- the service layer performs business logic
- model layers define structured contracts for canonical, validation, and XML-facing data
- configuration and data folders hold rules, mappings, schemas, and source inputs

This keeps UI concerns, transport concerns, business rules, and output generation from being mixed together.

## Separation of Concerns

Each part of the application has a narrow role.

- `routers`
  - receive requests
  - delegate work
  - return structured responses
- `services`
  - implement the real business logic
- `canonical models`
  - represent stable regulatory meaning
- `validation models`
  - represent completeness and review evidence
- `xml models`
  - represent XML previews, validation outcomes, and batch outputs

This reduces coupling and makes the system easier to extend without rewriting unrelated parts.

## Canonical Intermediary Layer

One of the strongest patterns in the project is the use of an intermediary canonical model.

The application does not directly map:

`Excel input -> XML output`

Instead, it follows:

`Excel input -> Canonical meaning -> Validation -> XML output`

This prevents the project from becoming a brittle one-off transformation script and creates a stable business and regulatory layer between the source workbooks and the schema-facing XML output.

## Service Layer Pattern

The backend service classes encapsulate specific business use cases.

Examples include:

- workbook and schema inspection
- canonical review
- Echelon validation
- XML generation
- XML validation

This keeps routers thin and makes the core logic easier to test and reason about.

## Configuration-Driven Rules

Normalization and enum mapping rules are stored in configuration files rather than being hidden inside application code.

Examples include:

- `config/normalization/`
- `config/canonical_mapping/`

This pattern makes the rules more reviewable, more auditable, and easier to adjust without rewriting core transformation logic.

## Processing Pipeline

The application follows a staged processing pipeline.

- source Excel review
- normalization and interpretation
- canonical assembly
- canonical validation
- XML generation

Each stage adds structure and confidence before passing data to the next stage.

## Read-Only Source Evidence

The source workbooks are treated as input evidence rather than mutable application state.

The application does not attempt to repair the spreadsheets directly. Instead, it layers interpretation, normalization, and validation around the source files. This preserves provenance and makes review decisions traceable.

## Schema-Aware Output Adapter

The XML generation layer behaves like an adapter between internal regulatory meaning and external EUDAMED schema requirements.

It takes validated canonical meaning and projects it into wrapped EUDAMED service `Push` messages, rather than embedding workbook-specific logic directly in the XML output layer.

## Bounded Batch Processing

The batch XML design uses bounded chunking.

- only validation-ready records enter batch generation
- records are chunked into groups of at most `300`
- each chunk becomes its own schema-valid wrapped `Push` message

This pattern keeps batch generation aligned with schema constraints and prevents oversized or uncontrolled output messages.

## Extension-Friendly Boundaries

The current design leaves clean boundaries for future features.

Examples include:

- `Submission History`
  - to record prepared, submitted, accepted, and rejected payloads
- `M2M Integration`
  - to add AS4 / eDelivery transport downstream of XML generation

Because the current app already separates source review, canonical meaning, validation, and XML generation, those future additions can be introduced as new operational layers rather than as a rewrite of the preparation pipeline.
