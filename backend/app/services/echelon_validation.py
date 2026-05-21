from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet

from app.config import get_settings
from app.validation_models import (
    CompletenessSnapshot,
    EchelonValidationBundle,
    EchelonValidationRecord,
    ExcludedSheetSummary,
    MatchStatus,
    ValidationFieldValue,
    ValueSourceType,
)

SOURCE_WORKBOOK_NAME = "Template for Echelon family EUDAMED.xlsx"
REFERENCE_WORKBOOK_NAME = "uat-eudamed_mdr_products_tracekey_sample_data.xlsx"
HEADER_SENTINEL = "UDI-DI code"

ISSUING_ENTITY_HEADER = "Issuing Entity e.g. GS1"
UDI_DI_HEADER = "UDI-DI code e.g. taken from 2nd page of DoC (Note: needs to be 14 digits long, add zero to front of code)"
SECONDARY_UDI_HEADER = "UDI-DI from another entity (secondary) applicable e.g. No"
EMDN_HEADER = "Enter a nomenclature code (EMDN code) e.g starts with Y06xxxx then click Find"
TRADE_NAME_HEADER = "Trade Name applicable e.g. YES (use  Decription detail from second page of DoC"
LANGUAGE_HEADER = "Select the language e.g English"
CATALOGUE_HEADERS = (
    "Reference/ Catalogue number e.g . Taken from Product code in second page of DoC",
    "Reference/ Catalogue number e.g . Taken from Product code on second page of DoC",
)
QUANTITY_HEADER = "Quantity of device e.g. 1"
UDI_PI_HEADER = "Type of UDI-PI e.g. select Serial number and Manufacturing Date"
STATUS_HEADER = "UDI-DI status e.g. On the EU market"
STERILE_HEADER = "Device labelled as sterile e.g. NO"
LATEX_HEADER = "Containing latex e.g. NO"

PRODUCT_TEMPLATE_HEADER = "Product Template"
PRODUCT_MASTER_HEADER = "Product Master"
PRODUCT_CODE_VALUE_HEADER = "Product Code (Value)"
PRODUCT_NAME_HEADER = "Name"
MATERIAL_NUMBER_HEADER = "Material Number"
REFERENCE_NUMBER_HEADER = "Reference Number"
MANUFACTURER_CODE_HEADER = "Manufacturer Code"


@dataclass(frozen=True)
class SourceRow:
    sheet_name: str
    row_index: int
    values: dict[str, object | None]


class EchelonValidationService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def build_validation_bundle(self) -> EchelonValidationBundle:
        source_workbook = self.settings.excel_dir / SOURCE_WORKBOOK_NAME
        reference_workbook = self.settings.basic_udi_reference_dir / REFERENCE_WORKBOOK_NAME

        source_rows = self._load_source_rows(source_workbook)
        reference_context = self._load_reference_context(reference_workbook)

        included_records: list[EchelonValidationRecord] = []
        excluded_by_sheet: dict[str, int] = {}

        for row in source_rows:
            catalogue_number = self._catalogue_number(row.values)
            reference_match = reference_context.get(catalogue_number) if catalogue_number else None
            if not reference_match:
                excluded_by_sheet[row.sheet_name] = excluded_by_sheet.get(row.sheet_name, 0) + 1
                continue
            included_records.append(self._build_record(source_workbook.name, row, reference_match))

        excluded_records = sum(excluded_by_sheet.values())
        tracked_required_fields = len(included_records[0].fields) if included_records else 0

        return EchelonValidationBundle(
            family_scope="Echelon only",
            scope_note=(
                "Only Echelon source rows with matching Basic UDI reference coverage are included in "
                "this validation subset. Other Echelon rows remain parsed but excluded from mapping preview."
            ),
            validation_note=(
                "Completeness is measured against the tracked canonical fields currently modeled for this "
                "preview. XML projection still remains a downstream step."
            ),
            source_workbook=source_workbook.name,
            total_source_records=len(source_rows),
            validation_subset_records=len(included_records),
            excluded_records=excluded_records,
            matched_reference_records=len(included_records),
            tracked_required_fields=tracked_required_fields,
            before_complete_records=sum(
                1 for record in included_records if record.before_completeness.status == "complete"
            ),
            after_complete_records=sum(
                1 for record in included_records if record.after_completeness.status == "complete"
            ),
            excluded_sheet_summaries=[
                ExcludedSheetSummary(
                    sheet_name=sheet_name,
                    record_count=record_count,
                    reason="No Basic UDI-DI reference coverage is currently available for these rows.",
                )
                for sheet_name, record_count in sorted(excluded_by_sheet.items())
            ],
            records=included_records,
        )

    def _build_record(
        self,
        workbook_name: str,
        row: SourceRow,
        reference_match: dict[str, dict[str, object | None]],
    ) -> EchelonValidationRecord:
        source_values = row.values
        basic_product = reference_match["basic_product"]
        basic_details = reference_match["basic_details"]
        udi_details = reference_match["udi_details"]
        match_status: MatchStatus = "matched"

        fields = [
            self._field(
                canonical_path="manufacturer.issuing_entity",
                business_label="Issuing Entity",
                before_value=self._string_value(source_values.get(ISSUING_ENTITY_HEADER)),
                after_value=self._string_value(source_values.get(ISSUING_ENTITY_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{ISSUING_ENTITY_HEADER}",
            ),
            self._field(
                canonical_path="manufacturer.manufacturer_srn",
                business_label="Manufacturer SRN",
                before_value=None,
                after_value=self._string_value(basic_details.get(MANUFACTURER_CODE_HEADER)),
                before_source="missing",
                after_source="basic_udi_reference",
                source_detail="MDR-Basic!Manufacturer Code",
                update_reason="Resolved from the Basic UDI reference workbook.",
            ),
            self._field(
                canonical_path="basic_device.basic_udi_di",
                business_label="Basic UDI-DI",
                before_value=None,
                after_value=self._string_value(basic_product.get(PRODUCT_CODE_VALUE_HEADER)),
                before_source="missing",
                after_source="basic_udi_reference",
                source_detail="Products!Product Code (Value)",
                update_reason="Added from the matched Basic UDI product row.",
            ),
            self._field(
                canonical_path="basic_device.regulation",
                business_label="Regulation",
                before_value="MDR",
                after_value="MDR",
                before_source="derived",
                after_source="derived",
                source_detail="QMS scope decision",
            ),
            self._field(
                canonical_path="basic_device.nomenclature_code",
                business_label="EMDN Code",
                before_value=self._string_value(source_values.get(EMDN_HEADER)),
                after_value=self._string_value(source_values.get(EMDN_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{EMDN_HEADER}",
            ),
            self._field(
                canonical_path="device_record.basic_device_ref",
                business_label="Basic Device Reference",
                before_value=None,
                after_value=self._string_value(basic_product.get(PRODUCT_CODE_VALUE_HEADER)),
                before_source="missing",
                after_source="basic_udi_reference",
                source_detail="Products!Product Code (Value)",
                update_reason="Linked by matching source catalogue number to the reference workbook UDI row.",
            ),
            self._field(
                canonical_path="device_record.primary_udi_di",
                business_label="Primary UDI-DI",
                before_value=self._string_value(source_values.get(UDI_DI_HEADER)),
                after_value=self._string_value(source_values.get(UDI_DI_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{UDI_DI_HEADER}",
            ),
            self._field(
                canonical_path="device_record.catalogue_number",
                business_label="Catalogue Number",
                before_value=self._catalogue_number(source_values),
                after_value=self._catalogue_number(source_values),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!Reference/ Catalogue number",
            ),
            self._field(
                canonical_path="device_record.trade_name",
                business_label="Trade Name",
                before_value=self._string_value(source_values.get(TRADE_NAME_HEADER)),
                after_value=self._string_value(source_values.get(TRADE_NAME_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{TRADE_NAME_HEADER}",
            ),
            self._field(
                canonical_path="device_record.language",
                business_label="Language",
                before_value=self._string_value(source_values.get(LANGUAGE_HEADER)),
                after_value=self._string_value(source_values.get(LANGUAGE_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{LANGUAGE_HEADER}",
            ),
            self._field(
                canonical_path="device_record.quantity",
                business_label="Quantity",
                before_value=self._string_value(source_values.get(QUANTITY_HEADER)),
                after_value=self._string_value(source_values.get(QUANTITY_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{QUANTITY_HEADER}",
            ),
            self._field(
                canonical_path="device_record.udi_pi_type",
                business_label="UDI-PI Type",
                before_value=self._string_value(source_values.get(UDI_PI_HEADER)),
                after_value=self._string_value(source_values.get(UDI_PI_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{UDI_PI_HEADER}",
            ),
            self._field(
                canonical_path="device_record.secondary_udi_di_applicable",
                business_label="Secondary UDI-DI Applicable",
                before_value=self._normalized_yes_no(source_values.get(SECONDARY_UDI_HEADER)),
                after_value=self._normalized_yes_no(source_values.get(SECONDARY_UDI_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{SECONDARY_UDI_HEADER}",
            ),
            self._field(
                canonical_path="device_record.sterile",
                business_label="Sterile",
                before_value=self._normalized_yes_no(source_values.get(STERILE_HEADER)),
                after_value=self._normalized_yes_no(source_values.get(STERILE_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{STERILE_HEADER}",
            ),
            self._field(
                canonical_path="device_record.contains_latex",
                business_label="Contains Latex",
                before_value=self._normalized_yes_no(source_values.get(LATEX_HEADER)),
                after_value=self._normalized_yes_no(source_values.get(LATEX_HEADER)),
                before_source="workbook",
                after_source="workbook",
                source_detail=f"{row.sheet_name}!{LATEX_HEADER}",
            ),
            self._field(
                canonical_path="device_record.market_availability.market_status",
                business_label="Market Status",
                before_value=self._string_value(source_values.get(STATUS_HEADER)),
                after_value=self._string_value(source_values.get(STATUS_HEADER))
                or self._string_value(udi_details.get("Device Status")),
                before_source="workbook",
                after_source="workbook" if source_values.get(STATUS_HEADER) else "basic_udi_reference",
                source_detail=f"{row.sheet_name}!{STATUS_HEADER} / MDR-UDI!Device Status",
            ),
        ]

        before_blockers = [
            f"{field.business_label} is not populated before Basic UDI enrichment."
            for field in fields
            if field.before_value is None
        ]
        after_blockers = [
            f"{field.business_label} remains missing after Basic UDI enrichment."
            for field in fields
            if field.after_value is None
        ]

        return EchelonValidationRecord(
            source_workbook=workbook_name,
            source_sheet=row.sheet_name,
            source_row_index=row.row_index,
            trade_name=self._string_value(source_values.get(TRADE_NAME_HEADER)),
            primary_udi_di=self._string_value(source_values.get(UDI_DI_HEADER)),
            catalogue_number=self._catalogue_number(source_values),
            issuing_entity=self._string_value(source_values.get(ISSUING_ENTITY_HEADER)),
            reference_match_status=match_status,
            basic_reference_material_number=self._string_value(basic_product.get(MATERIAL_NUMBER_HEADER)),
            basic_reference_name=self._string_value(basic_product.get(PRODUCT_NAME_HEADER)),
            before_completeness=self._completeness_snapshot(fields, state="before"),
            after_completeness=self._completeness_snapshot(fields, state="after"),
            before_blockers=before_blockers,
            after_blockers=after_blockers,
            fields=fields,
        )

    def _load_source_rows(self, workbook_path: Path) -> list[SourceRow]:
        workbook = load_workbook(workbook_path, read_only=True, data_only=True)
        rows: list[SourceRow] = []
        for sheet_name in workbook.sheetnames:
            worksheet = workbook[sheet_name]
            header_row_index: int | None = None
            headers: list[str] | None = None
            for row_index, row in enumerate(worksheet.iter_rows(values_only=True), start=1):
                values = list(row)
                if headers is None and any(
                    isinstance(value, str) and HEADER_SENTINEL in value for value in values if value
                ):
                    headers = [str(value).strip() if value is not None else "" for value in values]
                    header_row_index = row_index
                    continue
                if headers is None or header_row_index is None or row_index <= header_row_index:
                    continue
                if not any(value not in (None, "") for value in values):
                    continue
                mapped_values: dict[str, object | None] = {
                    headers[index]: values[index] if index < len(values) else None
                    for index in range(len(headers))
                    if headers[index]
                }
                rows.append(SourceRow(sheet_name=sheet_name, row_index=row_index, values=mapped_values))
        return rows

    def _load_reference_context(
        self, workbook_path: Path
    ) -> dict[str, dict[str, dict[str, object | None]]]:
        workbook = load_workbook(workbook_path, read_only=True, data_only=True)
        product_rows = self._sheet_rows(workbook["Products"])
        basic_rows = self._sheet_rows(workbook["MDR-Basic"])
        udi_rows = self._sheet_rows(workbook["MDR-UDI"])

        basic_products = {
            self._string_value(row.get(MATERIAL_NUMBER_HEADER)): row
            for row in product_rows
            if row.get(PRODUCT_TEMPLATE_HEADER) == "EUDAMED Basic UDI-DI"
        }
        udi_products = {
            self._string_value(row.get(MATERIAL_NUMBER_HEADER)): row
            for row in product_rows
            if row.get(PRODUCT_TEMPLATE_HEADER) == "EUDAMED UDI-DI"
        }
        basic_details = {
            self._string_value(row.get(MATERIAL_NUMBER_HEADER)): row for row in basic_rows
        }
        udi_details = {
            self._string_value(row.get(REFERENCE_NUMBER_HEADER)): row for row in udi_rows
        }

        context: dict[str, dict[str, dict[str, object | None]]] = {}
        for reference_number, udi_row in udi_details.items():
            if not reference_number:
                continue
            udi_product = udi_products.get(reference_number)
            if not udi_product:
                continue
            basic_material_number = self._string_value(udi_product.get(PRODUCT_MASTER_HEADER))
            basic_product = basic_products.get(basic_material_number)
            basic_detail_row = basic_details.get(basic_material_number)
            if not basic_product or not basic_detail_row:
                continue
            context[reference_number] = {
                "basic_product": basic_product,
                "basic_details": basic_detail_row,
                "udi_details": udi_row,
            }
        return context

    @staticmethod
    def _sheet_rows(worksheet: Worksheet) -> list[dict[str, object | None]]:
        rows = list(worksheet.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(value).strip() if value is not None else "" for value in rows[0]]
        output: list[dict[str, object | None]] = []
        for row in rows[1:]:
            if not any(value not in (None, "") for value in row):
                continue
            output.append(
                {
                    headers[index]: row[index] if index < len(row) else None
                    for index in range(len(headers))
                    if headers[index]
                }
            )
        return output

    @staticmethod
    def _field(
        *,
        canonical_path: str,
        business_label: str,
        before_value: str | None,
        after_value: str | None,
        before_source: ValueSourceType,
        after_source: ValueSourceType,
        source_detail: str,
        update_reason: str | None = None,
    ) -> ValidationFieldValue:
        return ValidationFieldValue(
            canonical_path=canonical_path,
            business_label=business_label,
            before_value=before_value,
            after_value=after_value,
            before_source=before_source,
            after_source=after_source,
            source_detail=source_detail,
            update_reason=update_reason,
        )

    @staticmethod
    def _completeness_snapshot(
        fields: list[ValidationFieldValue], *, state: Literal["before", "after"]
    ) -> CompletenessSnapshot:
        values = [field.before_value if state == "before" else field.after_value for field in fields if field.required]
        mapped_required_fields = sum(1 for value in values if value is not None)
        total_required_fields = len(values)
        missing_required_fields = total_required_fields - mapped_required_fields
        return CompletenessSnapshot(
            mapped_required_fields=mapped_required_fields,
            total_required_fields=total_required_fields,
            missing_required_fields=missing_required_fields,
            status="complete" if missing_required_fields == 0 else "incomplete",
        )

    @staticmethod
    def _catalogue_number(values: dict[str, object | None]) -> str | None:
        for header in CATALOGUE_HEADERS:
            value = values.get(header)
            if value not in (None, ""):
                return str(value).strip()
        return None

    @staticmethod
    def _string_value(value: object | None) -> str | None:
        if value in (None, ""):
            return None
        return str(value).strip()

    @staticmethod
    def _normalized_yes_no(value: object | None) -> str | None:
        if value in (None, ""):
            return None
        token = str(value).strip().lower()
        if token in {"yes", "true"}:
            return "Yes"
        if token in {"no", "false"}:
            return "No"
        return str(value).strip()
