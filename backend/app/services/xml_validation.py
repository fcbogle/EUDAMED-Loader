from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from lxml import etree

from app.config import get_settings
from app.xml_models import XmlValidationIssue, XmlValidationResult


class XmlValidationService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.schema_path = self.settings.schema_dir / "service" / "Message.xsd"
        self.project_root = Path(__file__).resolve().parents[3]

    def validate_message(self, xml_bytes: bytes) -> XmlValidationResult:
        document = etree.fromstring(xml_bytes)
        schema = self._message_schema(self.schema_path)
        valid = schema.validate(document)
        errors = [
            XmlValidationIssue(
                line=entry.line,
                column=entry.column,
                message=entry.message,
            )
            for entry in schema.error_log
        ]
        return XmlValidationResult(
            valid=valid,
            schema_path=self._display_schema_path(self.schema_path),
            errors=errors,
        )

    def _display_schema_path(self, schema_path: Path) -> str:
        try:
            return str(schema_path.relative_to(self.project_root))
        except ValueError:
            return str(schema_path)

    @staticmethod
    @lru_cache(maxsize=1)
    def _message_schema(schema_path: Path) -> etree.XMLSchema:
        schema_document = etree.parse(str(schema_path))
        return etree.XMLSchema(schema_document)
