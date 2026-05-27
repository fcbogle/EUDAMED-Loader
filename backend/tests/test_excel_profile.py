from __future__ import annotations

from app.services.excel_profile import ExcelProfiler


def test_build_headers_uses_sheet_based_label_for_unlabeled_columns() -> None:
    headers = ExcelProfiler._build_headers(("Named field", None, ""), sheet_name="Knee Devices")

    assert headers == [
        "Named field",
        "Unlabeled column (Knee Devices, column 2)",
        "Unlabeled column (Knee Devices, column 3)",
    ]


def test_list_workbooks_marks_accessories_workbook_out_of_scope() -> None:
    summaries = ExcelProfiler().list_workbooks()

    accessories = next(
        summary
        for summary in summaries
        if summary.workbook == "Template for Accessories_Footspares EUDAMED.xlsx"
    )

    assert accessories.in_scope_for_variant_mapping is False
    assert accessories.notes


def test_list_reference_workbooks_includes_authoritative_and_legacy_sources() -> None:
    summaries = ExcelProfiler().list_reference_workbooks()

    statuses = {summary.workbook: summary.source_status for summary in summaries}

    assert statuses["BasicUDIs.xlsx"] == "authoritative"
    assert statuses["uat-eudamed_mdr_products_tracekey_sample_data.xlsx"] == "legacy"
