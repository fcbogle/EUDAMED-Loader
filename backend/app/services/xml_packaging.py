from __future__ import annotations

import json
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile


class XmlPackageBuilder:
    @staticmethod
    def build_archive(
        *,
        package_file_name: str,
        members: list[tuple[str, bytes]],
        manifest: dict,
    ) -> tuple[str, bytes]:
        buffer = BytesIO()
        with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
            for file_name, payload in members:
                archive.writestr(file_name, payload)
            archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        return package_file_name, buffer.getvalue()

    @staticmethod
    def file_name(*, product_family: str, product_variant: str, catalogue_number: str) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"{XmlPackageBuilder._safe_catalogue_number(catalogue_number)}.xml"
        )

    @staticmethod
    def operation_file_name(
        *,
        product_family: str,
        product_variant: str,
        operation: str,
        catalogue_number: str,
    ) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"{operation.lower()}-{XmlPackageBuilder._safe_catalogue_number(catalogue_number)}.xml"
        )

    @staticmethod
    def batch_file_name(
        *,
        product_family: str,
        product_variant: str,
        sequence: int,
        total_chunks: int,
    ) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"batch-{sequence:02d}-of-{total_chunks:02d}.xml"
        )

    @staticmethod
    def batch_package_file_name(*, product_family: str, product_variant: str) -> str:
        return f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-batch-package.zip"

    @staticmethod
    def post_patch_pair_package_file_name(
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"post-patch-pair-{XmlPackageBuilder._safe_catalogue_number(catalogue_number)}.zip"
        )

    @staticmethod
    def operation_package_file_name(
        *,
        product_family: str,
        product_variant: str,
        operation: str,
        catalogue_number: str,
    ) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"{operation.lower()}-{XmlPackageBuilder._safe_catalogue_number(catalogue_number)}.zip"
        )

    @staticmethod
    def scenario_package_file_name(
        *,
        product_family: str,
        product_variant: str,
        scenario_id: str,
        catalogue_number: str,
    ) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"patch-{scenario_id.replace('_', '-')}-{XmlPackageBuilder._safe_catalogue_number(catalogue_number)}.zip"
        )

    @staticmethod
    def market_info_file_name(
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> str:
        return (
            f"{XmlPackageBuilder._slugify(product_family)}-{XmlPackageBuilder._slugify(product_variant)}-"
            f"market-info-put-{XmlPackageBuilder._safe_catalogue_number(catalogue_number)}.xml"
        )

    @staticmethod
    def _slugify(token: str) -> str:
        normalized = token.lower().replace(" / ", "-").replace("/", "-")
        return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in normalized).strip("-")

    @staticmethod
    def _safe_catalogue_number(catalogue_number: str) -> str:
        return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in catalogue_number)
