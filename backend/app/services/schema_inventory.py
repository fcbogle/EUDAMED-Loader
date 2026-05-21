from __future__ import annotations

from app.config import get_settings
from app.models import SchemaFileSummary, SchemaInventory


class SchemaInventoryService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def inventory(self) -> SchemaInventory:
        device_files: list[SchemaFileSummary] = []
        service_files: list[SchemaFileSummary] = []
        for path in sorted(self.settings.schema_dir.rglob("*")):
            if not path.is_file() or any(part.startswith(".") for part in path.parts):
                continue
            relative_path = str(path.relative_to(self.settings.schema_dir))
            summary = SchemaFileSummary(
                relative_path=relative_path,
                category="device" if relative_path.startswith("data/") else "service",
                size_bytes=path.stat().st_size,
            )
            if summary.category == "device":
                device_files.append(summary)
            else:
                service_files.append(summary)
        return SchemaInventory(
            root=self.settings.schema_dir,
            total_files=len(device_files) + len(service_files),
            device_files=device_files,
            service_files=service_files,
        )
