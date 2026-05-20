from __future__ import annotations

from app.services.excel_profile import ExcelProfiler


def test_build_headers_uses_sheet_based_label_for_unlabeled_columns() -> None:
    headers = ExcelProfiler._build_headers(("Named field", None, ""), sheet_name="Knee Devices")

    assert headers == [
        "Named field",
        "Unlabeled column (Knee Devices, column 2)",
        "Unlabeled column (Knee Devices, column 3)",
    ]
