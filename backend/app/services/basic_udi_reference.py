from __future__ import annotations

from dataclasses import dataclass

from openpyxl import load_workbook

from app.canonical_models import VariantMappingSummary
from app.config import get_settings


@dataclass(frozen=True)
class BasicUdiReferenceRow:
    device_model: str
    basic_udi_di: str
    submission_operation: str | None
    source_version_marker: str | None
    first_eu_market_country: str | None
    available_market_countries: tuple[str, ...]


class BasicUdiReferenceService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def list_variant_mappings(self) -> list[VariantMappingSummary]:
        reference_rows = self._rows_by_device_model()
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

    def _rows_by_device_model(self) -> dict[str, BasicUdiReferenceRow]:
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
                device_model=device_model,
                basic_udi_di=self._cell(row, index, "Basic UDI-DI code"),
                submission_operation=self._cell(row, index, "Operation") or None,
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
