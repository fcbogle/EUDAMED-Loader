from __future__ import annotations

from dataclasses import dataclass

from openpyxl import load_workbook

from app.canonical_models import SubmissionOperation, VariantMappingSummary
from app.config import get_settings


@dataclass(frozen=True)
class BasicUdiReferenceRow:
    applicable_regulation: str | None
    issuing_entity: str | None
    device_model: str
    basic_udi_di: str
    device_type: str | None
    special_device_type: str | None
    risk_class: str | None
    implantable: str | None
    measuring_function: str | None
    reusable_surgical_instrument: str | None
    active_device: str | None
    administering_medicinal_product: str | None
    device_model_applicable: str | None
    additional_information_url: str | None
    submission_operation: SubmissionOperation | None
    source_version_marker: str | None
    first_eu_market_country: str | None
    available_market_countries: tuple[str, ...]


class BasicUdiReferenceService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def list_variant_mappings(self) -> list[VariantMappingSummary]:
        reference_rows = self.rows_by_device_model()
        mappings: list[VariantMappingSummary] = []

        for workbook_path in sorted(self.settings.excel_dir.glob("*.xlsx")):
            workbook = load_workbook(workbook_path, read_only=True, data_only=True)
            workbook_excluded = workbook_path.name in self.settings.excluded_excel_workbook_names
            exclusion_notes = (
                ["Excluded from active variant-level mapping pending QMS clarification."]
                if workbook_excluded
                else []
            )

            for worksheet in workbook.worksheets:
                reference = reference_rows.get(worksheet.title)
                if workbook_excluded:
                    mappings.append(
                        VariantMappingSummary(
                            workbook=workbook_path.name,
                            sheet=worksheet.title,
                            device_model=None,
                            basic_udi_di=None,
                            submission_operation=None,
                            source_version_marker=None,
                            first_eu_market_country=None,
                            available_market_country_count=0,
                            match_status="excluded",
                            notes=exclusion_notes,
                        )
                    )
                    continue

                if reference is None:
                    mappings.append(
                        VariantMappingSummary(
                            workbook=workbook_path.name,
                            sheet=worksheet.title,
                            device_model=None,
                            basic_udi_di=None,
                            submission_operation=None,
                            source_version_marker=None,
                            first_eu_market_country=None,
                            available_market_country_count=0,
                            match_status="unmatched",
                            notes=[
                                "No exact Device Model match was found in the authoritative BasicUDIs.xlsx workbook."
                            ],
                        )
                    )
                    continue

                mappings.append(
                    VariantMappingSummary(
                        workbook=workbook_path.name,
                        sheet=worksheet.title,
                        device_model=reference.device_model,
                        basic_udi_di=reference.basic_udi_di,
                        submission_operation=reference.submission_operation,
                        source_version_marker=reference.source_version_marker,
                        first_eu_market_country=reference.first_eu_market_country,
                        available_market_country_count=len(reference.available_market_countries),
                        match_status="matched",
                        notes=["Exact sheet-to-Device Model match from the authoritative Basic UDI workbook."],
                    )
                )

        return mappings

    def rows_by_device_model(self) -> dict[str, BasicUdiReferenceRow]:
        workbook = load_workbook(self.settings.basic_udi_reference_workbook, read_only=True, data_only=True)
        worksheet = workbook["BasicUDI"]
        rows = list(worksheet.iter_rows(values_only=True))
        headers = [self._stringify(cell) for cell in rows[0]]
        index = {header: i for i, header in enumerate(headers) if header}

        references: dict[str, BasicUdiReferenceRow] = {}
        for row in rows[1:]:
            device_model = self._cell(row, index, "Device Model")
            if not device_model:
                continue
            references[device_model] = BasicUdiReferenceRow(
                applicable_regulation=self._cell(row, index, "Applicable regulation") or None,
                issuing_entity=self._cell(row, index, "Issuing Entity") or None,
                device_model=device_model,
                basic_udi_di=self._cell(row, index, "Basic UDI-DI code"),
                device_type=self._cell(
                    row,
                    index,
                    "Is it a System or Procedure Pack which is a Device in itself?",
                )
                or None,
                special_device_type=self._cell(row, index, "Special device type") or None,
                risk_class=self._cell(row, index, "Risk class") or None,
                implantable=self._cell(row, index, "Implantable") or None,
                measuring_function=self._cell(row, index, "Measuring function") or None,
                reusable_surgical_instrument=self._cell(row, index, "Reusable surgical instrument") or None,
                active_device=self._cell(row, index, "Active device") or None,
                administering_medicinal_product=self._cell(
                    row,
                    index,
                    "Device intended to administer and/or remove medicinal product",
                )
                or None,
                device_model_applicable=self._cell(row, index, "Device model applicable") or None,
                additional_information_url=self._cell(
                    row,
                    index,
                    "URL for additional information (as electronic instructions for use):",
                )
                or None,
                submission_operation=self._submission_operation(self._cell(row, index, "Operation")),
                source_version_marker=self._cell(row, index, "Version") or None,
                first_eu_market_country=self._cell(
                    row,
                    index,
                    "Member State of the placing on the EU market of the Device:",
                )
                or None,
                available_market_countries=tuple(
                    country
                    for country in (
                        item.strip()
                        for item in self._cell(
                            row,
                            index,
                            "Member States where device is or is to be made available on the market:",
                        ).split(";")
                    )
                    if country
                ),
            )
        return references

    @staticmethod
    def _cell(row: tuple[object | None, ...], index: dict[str, int], header: str) -> str:
        position = index.get(header)
        if position is None or position >= len(row):
            return ""
        return BasicUdiReferenceService._stringify(row[position])

    @staticmethod
    def _stringify(value: object | None) -> str:
        if value is None:
            return ""
        return " ".join(str(value).split())

    @staticmethod
    def _submission_operation(value: str) -> SubmissionOperation | None:
        token = value.strip().upper()
        if token == "POST":
            return "POST"
        if token == "PATCH":
            return "PATCH"
        if token == "PUT":
            return "PUT"
        if token == "GET":
            return "GET"
        return None
