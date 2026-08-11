from __future__ import annotations

from xml.etree import ElementTree

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

    def critical_warning_codes(self) -> list[dict[str, str]]:
        schema_path = self.settings.schema_dir / "data" / "Entity" / "Device" / "CommonDeviceType.xsd"
        namespace = {"xs": "http://www.w3.org/2001/XMLSchema"}
        root = ElementTree.parse(schema_path).getroot()
        options: list[dict[str, str]] = []
        enum_parent = root.find(".//xs:simpleType[@name='CriticalWarningEnum']", namespace)
        if enum_parent is None:
            return options
        for enum in enum_parent.findall(".//xs:enumeration", namespace):
            code = enum.attrib.get("value")
            if not code:
                continue
            documentation = enum.find(".//xs:documentation", namespace)
            description = " ".join((documentation.text or "").split()) if documentation is not None else ""
            options.append({"code": code, "description": description})
        return options
