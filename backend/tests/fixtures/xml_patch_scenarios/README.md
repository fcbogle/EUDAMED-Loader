This fixture area stores proven XML PATCH scenario baselines and future scenario variants.

Structure:

- `equivalent_baseline/`
  - golden POST/PATCH pairs that have already been proven to work
- future scenario folders
  - PATCH variants derived from a proven baseline pair, such as trade-name edits or warning changes

The first baseline fixture was copied from the manually verified ZIP package:

- `Echelon-Echelon VAC-EVAC22L1S-post-patch-pair.zip`

These files are intended to anchor regression tests before scenario-driven PATCH generation is added.

First-wave non-market PATCH scenarios to derive from the proven baseline:

- `trade_name_edit/`
- `warning_add/`
- `storage_condition_edit/`
- `secondary_identifier_add/`

Each scenario folder should contain:

- a scenario manifest describing the intended delta from the baseline PATCH
- a generated PATCH XML once the scenario values have been agreed
- optional assertions or notes about the expected changed elements
