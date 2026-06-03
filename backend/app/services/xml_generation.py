from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO
import json
from typing import Any
from uuid import uuid4
from zipfile import ZIP_DEFLATED, ZipFile

import lxml.etree as etree

from app.services.canonical_validation import CanonicalValidationService
from app.services.xml_validation import XmlValidationService
from app.validation_models import CanonicalValidationRecord
from app.xml_models import (
    BatchXmlChunkSummary,
    BatchXmlPreview,
    CriticalWarningXmlItem,
    SingleRecordXmlPreview,
    StorageConditionXmlItem,
    XmlGenerationScopeBundle,
    XmlGenerationSelectionSummary,
)

MAX_BATCH_RECORDS = 300
MESSAGE_SCHEMA_VERSION = "3.0.30"
SERVICE_ID = "UDI_DI"
XmlElement = Any

MESSAGE_NS = "https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1"
SERVICE_NS = "https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1"
DEVICE_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Device/v1"
BASIC_UDI_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Device/BasicUDI/v1"
UDIDI_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/UDIDI/v1"
ENTITY_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/v1"
COMMON_DEVICE_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Device/CommonDevice/v1"
LANGUAGE_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Common/LanguageSpecific/v1"
MARKET_INFO_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/MktInfo/MarketInfo/v1"
XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"

NSMAP = {
    "m": MESSAGE_NS,
    "s": SERVICE_NS,
    "device": DEVICE_NS,
    "basicudi": BASIC_UDI_NS,
    "udidi": UDIDI_NS,
    "e": ENTITY_NS,
    "commondi": COMMON_DEVICE_NS,
    "lsn": LANGUAGE_NS,
    "marketinfo": MARKET_INFO_NS,
    "xsi": XSI_NS,
}

LANGUAGE_CODE_MAP = {
    "english": "EN",
    "french": "FR",
    "german": "DE",
    "dutch": "NL",
    "spanish": "ES",
    "italian": "IT",
    "portuguese": "PT",
}

EU_COUNTRY_CODE_MAP = {
    "austria": "AT",
    "belgium": "BE",
    "bulgaria": "BG",
    "croatia": "HR",
    "cyprus": "CY",
    "czech republic": "CZ",
    "czechia": "CZ",
    "denmark": "DK",
    "estonia": "EE",
    "finland": "FI",
    "france": "FR",
    "germany": "DE",
    "greece": "EL",
    "hungary": "HU",
    "ireland": "IE",
    "italy": "IT",
    "latvia": "LV",
    "lithuania": "LT",
    "luxembourg": "LU",
    "malta": "MT",
    "netherlands": "NL",
    "poland": "PL",
    "portugal": "PT",
    "romania": "RO",
    "slovakia": "SK",
    "slovenia": "SI",
    "spain": "ES",
    "sweden": "SE",
}


class DeviceXmlRecord:
    def __init__(
        self,
        *,
        product_family: str,
        product_variant: str,
        submission_operation: str | None,
        catalogue_number: str,
        trade_name: str | None,
        primary_udi_di: str,
        issuing_entity: str,
        language_code: str | None,
        basic_identifier_code: str,
        basic_identifier_issuing_entity: str,
        device_identifier_code: str,
        device_identifier_issuing_entity: str,
        risk_class: str,
        model_name: str,
        manufacturer_srn: str,
        authorised_representative_srn: str | None,
        human_tissues_cells: bool,
        animal_tissues_cells: bool,
        human_product_check: bool,
        medicinal_product_check: bool,
        basic_device_type: str,
        active: bool,
        administering_medicine: bool,
        implantable: bool,
        measuring_function: bool,
        reusable: bool,
        nomenclature_codes: list[str],
        status_code: str,
        production_identifier: str | None,
        reference_number: str,
        secondary_identifier_code: str | None,
        secondary_identifier_issuing_entity: str | None,
        sterile: bool,
        sterilization: bool,
        source_version_marker: str | None,
        number_of_reuses: int,
        contains_latex: bool,
        reprocessed: bool,
        market_countries: list[tuple[str, bool]],
        base_quantity: int | None,
        storage_conditions: list[StorageConditionXmlItem],
        critical_warnings: list[CriticalWarningXmlItem],
    ) -> None:
        self.product_family = product_family
        self.product_variant = product_variant
        self.submission_operation = submission_operation
        self.catalogue_number = catalogue_number
        self.trade_name = trade_name
        self.primary_udi_di = primary_udi_di
        self.issuing_entity = issuing_entity
        self.language_code = language_code
        self.basic_identifier_code = basic_identifier_code
        self.basic_identifier_issuing_entity = basic_identifier_issuing_entity
        self.device_identifier_code = device_identifier_code
        self.device_identifier_issuing_entity = device_identifier_issuing_entity
        self.risk_class = risk_class
        self.model_name = model_name
        self.manufacturer_srn = manufacturer_srn
        self.authorised_representative_srn = authorised_representative_srn
        self.human_tissues_cells = human_tissues_cells
        self.animal_tissues_cells = animal_tissues_cells
        self.human_product_check = human_product_check
        self.medicinal_product_check = medicinal_product_check
        self.basic_device_type = basic_device_type
        self.active = active
        self.administering_medicine = administering_medicine
        self.implantable = implantable
        self.measuring_function = measuring_function
        self.reusable = reusable
        self.nomenclature_codes = nomenclature_codes
        self.status_code = status_code
        self.production_identifier = production_identifier
        self.reference_number = reference_number
        self.secondary_identifier_code = secondary_identifier_code
        self.secondary_identifier_issuing_entity = secondary_identifier_issuing_entity
        self.sterile = sterile
        self.sterilization = sterilization
        self.source_version_marker = source_version_marker
        self.number_of_reuses = number_of_reuses
        self.contains_latex = contains_latex
        self.reprocessed = reprocessed
        self.market_countries = market_countries
        self.base_quantity = base_quantity
        self.storage_conditions = storage_conditions
        self.critical_warnings = critical_warnings


class XmlGenerationService:
    def __init__(self) -> None:
        self.validation_service = CanonicalValidationService()
        self.xml_validation_service = XmlValidationService()

    def generation_scope(self) -> XmlGenerationScopeBundle:
        bundle = self.validation_service.build_validation_bundle()
        families = [
            XmlGenerationSelectionSummary(
                product_family=summary.product_family,
                product_variant="All variants",
                submission_operation=None,
                total_records=summary.total_records,
                xml_ready_records=summary.xml_ready_records,
                xml_blocked_records=summary.xml_blocked_records,
            )
            for summary in bundle.family_summaries
        ]
        return XmlGenerationScopeBundle(
            family_scope=bundle.family_scope,
            scope_note=(
                "XML generation now follows Canonical Validation scope. Select a product family and "
                "product variant, then generate XML only from rows that are currently XML-ready."
            ),
            total_xml_ready_records=bundle.xml_ready_records,
            families=families,
        )

    def preview_single_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> SingleRecordXmlPreview:
        record = self._find_validation_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        xml_record = self._to_xml_record(record)
        xml_bytes = self._render_push_message(xml_record)
        validation = self.xml_validation_service.validate_message(xml_bytes)
        return SingleRecordXmlPreview(
            product_family=record.product_family,
            product_variant=record.product_variant,
            submission_operation=record.submission_operation,
            catalogue_number=xml_record.catalogue_number,
            trade_name=xml_record.trade_name,
            primary_udi_di=xml_record.primary_udi_di,
            file_name=self._file_name(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=xml_record.catalogue_number,
            ),
            xml=xml_bytes.decode("utf-8"),
            validation=validation,
        )

    def download_single_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> tuple[str, bytes]:
        preview = self.preview_single_record(
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=catalogue_number,
        )
        return preview.file_name, preview.xml.encode("utf-8")

    def preview_batch(
        self,
        *,
        product_family: str,
        product_variant: str,
        chunk_sequence: int = 1,
    ) -> BatchXmlPreview:
        bundle = self.validation_service.build_validation_bundle()
        records = self._xml_ready_variant_records(
            bundle.records,
            product_family=product_family,
            product_variant=product_variant,
        )
        if not records:
            raise ValueError(
                f"No XML-ready records are currently available for batch generation for "
                f"{product_family} / {product_variant}."
            )

        record_chunks = self._chunk_records(records)
        xml_chunks: list[tuple[int, list[CanonicalValidationRecord], bytes]] = []
        chunk_summaries: list[BatchXmlChunkSummary] = []
        total_chunks = len(record_chunks)
        for sequence, chunk_records in enumerate(record_chunks, start=1):
            xml_records = [self._to_xml_record(record) for record in chunk_records]
            xml_bytes = self._render_push_message_records(xml_records)
            validation = self.xml_validation_service.validate_message(xml_bytes)
            file_name = self._batch_file_name(
                product_family=product_family,
                product_variant=product_variant,
                sequence=sequence,
                total_chunks=total_chunks,
            )
            xml_chunks.append((sequence, chunk_records, xml_bytes))
            chunk_summaries.append(
                BatchXmlChunkSummary(
                    sequence=sequence,
                    file_name=file_name,
                    record_count=len(chunk_records),
                    first_catalogue_number=chunk_records[0].catalogue_number if chunk_records else None,
                    last_catalogue_number=chunk_records[-1].catalogue_number if chunk_records else None,
                    validation=validation,
                )
            )

        if chunk_sequence < 1 or chunk_sequence > total_chunks:
            raise ValueError(f"Batch chunk {chunk_sequence} is out of range. Valid chunks are 1 to {total_chunks}.")

        selected_sequence, selected_records, selected_xml_bytes = xml_chunks[chunk_sequence - 1]
        selected_summary = chunk_summaries[chunk_sequence - 1]
        variant_summary = next(
            (
                summary
                for summary in bundle.variant_summaries
                if summary.product_family == product_family and summary.product_variant == product_variant
            ),
            None,
        )
        excluded_records = variant_summary.xml_blocked_records if variant_summary else 0
        return BatchXmlPreview(
            product_family=product_family,
            product_variant=product_variant,
            submission_operation=records[0].submission_operation,
            package_file_name=self._batch_package_file_name(
                product_family=product_family,
                product_variant=product_variant,
            ),
            total_ready_records=len(records),
            excluded_records=excluded_records,
            max_records_per_file=MAX_BATCH_RECORDS,
            chunk_count=total_chunks,
            selected_chunk_sequence=selected_sequence,
            selected_chunk_file_name=selected_summary.file_name,
            selected_chunk_record_count=len(selected_records),
            selected_chunk_xml=selected_xml_bytes.decode("utf-8"),
            selected_chunk_validation=selected_summary.validation,
            chunks=chunk_summaries,
        )

    def download_batch(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> tuple[str, bytes]:
        bundle = self.validation_service.build_validation_bundle()
        records = self._xml_ready_variant_records(
            bundle.records,
            product_family=product_family,
            product_variant=product_variant,
        )
        if not records:
            raise ValueError(
                f"No XML-ready records are currently available for batch generation for "
                f"{product_family} / {product_variant}."
            )

        record_chunks = self._chunk_records(records)
        package_file_name = self._batch_package_file_name(
            product_family=product_family,
            product_variant=product_variant,
        )
        variant_summary = next(
            (
                summary
                for summary in bundle.variant_summaries
                if summary.product_family == product_family and summary.product_variant == product_variant
            ),
            None,
        )
        excluded_records = variant_summary.xml_blocked_records if variant_summary else 0

        buffer = BytesIO()
        with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
            manifest_chunks = []
            total_chunks = len(record_chunks)
            for sequence, chunk_records in enumerate(record_chunks, start=1):
                file_name = self._batch_file_name(
                    product_family=product_family,
                    product_variant=product_variant,
                    sequence=sequence,
                    total_chunks=total_chunks,
                )
                xml_records = [self._to_xml_record(record) for record in chunk_records]
                xml_bytes = self._render_push_message_records(xml_records)
                validation = self.xml_validation_service.validate_message(xml_bytes)
                archive.writestr(file_name, xml_bytes)
                manifest_chunks.append(
                    {
                        "sequence": sequence,
                        "file_name": file_name,
                        "record_count": len(chunk_records),
                        "first_catalogue_number": chunk_records[0].catalogue_number if chunk_records else None,
                        "last_catalogue_number": chunk_records[-1].catalogue_number if chunk_records else None,
                        "valid": validation.valid,
                        "error_count": len(validation.errors),
                    }
                )

            manifest = {
                "package_file_name": package_file_name,
                "product_family": product_family,
                "product_variant": product_variant,
                "submission_operation": records[0].submission_operation,
                "total_ready_records": len(records),
                "excluded_records": excluded_records,
                "max_records_per_file": MAX_BATCH_RECORDS,
                "chunk_count": len(record_chunks),
                "chunks": manifest_chunks,
            }
            archive.writestr("manifest.json", json.dumps(manifest, indent=2))

        return package_file_name, buffer.getvalue()

    def _find_validation_record(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str,
    ) -> CanonicalValidationRecord:
        bundle = self.validation_service.build_validation_bundle()
        for record in bundle.records:
            if (
                record.product_family == product_family
                and record.product_variant == product_variant
                and record.catalogue_number == catalogue_number
                and record.xml_readiness.status == "complete"
            ):
                return record
        raise ValueError(
            f"Catalogue number {catalogue_number} was not found as an XML-ready record for "
            f"{product_family} / {product_variant}."
        )

    @staticmethod
    def _xml_ready_variant_records(
        records: list[CanonicalValidationRecord],
        *,
        product_family: str,
        product_variant: str,
    ) -> list[CanonicalValidationRecord]:
        return [
            record
            for record in records
            if record.product_family == product_family
            and record.product_variant == product_variant
            and record.xml_readiness.status == "complete"
        ]

    @staticmethod
    def _chunk_records(
        records: list[CanonicalValidationRecord], max_records_per_file: int = MAX_BATCH_RECORDS
    ) -> list[list[CanonicalValidationRecord]]:
        return [
            records[index : index + max_records_per_file]
            for index in range(0, len(records), max_records_per_file)
        ]

    def _to_xml_record(self, record: CanonicalValidationRecord) -> DeviceXmlRecord:
        field_map = {field.canonical_path: field.value for field in record.fields}
        basic_issuing_entity, basic_identifier_code = self._split_di_identifier(
            self._required(field_map, "device_record.basic_udi_identifier")
        )
        device_issuing_entity, device_identifier_code = self._split_di_identifier(
            self._required(field_map, "device_record.identifier")
        )
        secondary_identifier = field_map.get("device_record.secondary_identifier")
        secondary_identifier_code = None
        secondary_identifier_issuing_entity = None
        if secondary_identifier:
            secondary_identifier_issuing_entity, secondary_identifier_code = self._split_di_identifier(
                secondary_identifier
            )
        language_value = field_map.get("device_record.language")
        return DeviceXmlRecord(
            product_family=record.product_family,
            product_variant=record.product_variant,
            submission_operation=record.submission_operation,
            catalogue_number=self._required(field_map, "device_record.catalogue_number"),
            trade_name=field_map.get("device_record.trade_name"),
            primary_udi_di=self._required(field_map, "device_record.primary_udi_di"),
            issuing_entity=self._required(field_map, "manufacturer.issuing_entity"),
            language_code=self._language_code(language_value) if language_value else None,
            basic_identifier_code=basic_identifier_code,
            basic_identifier_issuing_entity=basic_issuing_entity,
            device_identifier_code=device_identifier_code,
            device_identifier_issuing_entity=device_issuing_entity,
            risk_class=self._risk_class(self._required(field_map, "basic_device.risk_class")),
            model_name=self._required(field_map, "basic_device.device_model"),
            manufacturer_srn=self._required(field_map, "manufacturer.manufacturer_srn"),
            authorised_representative_srn=field_map.get("basic_device.authorised_representative_srn"),
            human_tissues_cells=self._bool(self._required(field_map, "basic_device.human_tissues_cells")),
            animal_tissues_cells=self._bool(self._required(field_map, "basic_device.animal_tissues_cells")),
            human_product_check=self._bool(self._required(field_map, "basic_device.human_product_check")),
            medicinal_product_check=self._bool(self._required(field_map, "basic_device.medicinal_product_check")),
            basic_device_type=self._required(field_map, "basic_device.type"),
            active=self._bool(self._required(field_map, "basic_device.active")),
            administering_medicine=self._bool(self._required(field_map, "basic_device.administering_medicine")),
            implantable=self._bool(self._required(field_map, "basic_device.implantable")),
            measuring_function=self._bool(self._required(field_map, "basic_device.measuring_function")),
            reusable=self._bool(self._required(field_map, "basic_device.reusable")),
            nomenclature_codes=self._split_codes(self._required(field_map, "basic_device.nomenclature_code")),
            status_code=self._required(field_map, "device_record.status"),
            production_identifier=field_map.get("device_record.production_identifier"),
            reference_number=self._required(field_map, "device_record.catalogue_number"),
            secondary_identifier_code=secondary_identifier_code,
            secondary_identifier_issuing_entity=secondary_identifier_issuing_entity,
            sterile=self._bool(self._required(field_map, "device_record.sterile")),
            sterilization=self._bool(self._required(field_map, "device_record.sterilisation_before_use")),
            source_version_marker=field_map.get("basic_device.source_version_marker"),
            number_of_reuses=int(self._required(field_map, "device_record.number_of_reuses")),
            contains_latex=self._bool(self._required(field_map, "device_record.contains_latex")),
            reprocessed=self._bool(self._required(field_map, "device_record.reprocessed")),
            market_countries=self._market_country_items(record),
            base_quantity=self._optional_int(field_map.get("device_record.base_quantity")),
            storage_conditions=self._storage_condition_items(record),
            critical_warnings=self._critical_warning_items(record),
        )

    def _render_push_message(self, record: DeviceXmlRecord) -> bytes:
        return self._render_push_message_records([record])

    def _render_push_message_records(self, records: list[DeviceXmlRecord]) -> bytes:
        root = etree.Element(self._q(MESSAGE_NS, "Push"), nsmap=NSMAP)
        root.set("version", MESSAGE_SCHEMA_VERSION)

        self._append_text(root, MESSAGE_NS, "correlationID", str(uuid4()))
        self._append_text(root, MESSAGE_NS, "creationDateTime", datetime.now(UTC).replace(microsecond=0).isoformat())
        self._append_text(root, MESSAGE_NS, "messageID", str(uuid4()))
        root.append(
            self._endpoint_element(
                tag_name="recipient",
                node_actor_code="EUDAMED",
                service_operation=records[0].submission_operation or "POST",
            )
        )

        payload = etree.SubElement(root, self._q(MESSAGE_NS, "payload"))
        for record in records:
            payload.append(self._udidi_data_element(record))

        root.append(
            self._endpoint_element(
                tag_name="sender",
                node_actor_code=records[0].manufacturer_srn,
                service_operation=records[0].submission_operation or "POST",
            )
        )

        return etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)

    def _endpoint_element(self, *, tag_name: str, node_actor_code: str, service_operation: str) -> XmlElement:
        endpoint = etree.Element(self._q(MESSAGE_NS, tag_name))
        node = etree.SubElement(endpoint, self._q(MESSAGE_NS, "node"))
        self._append_text(node, SERVICE_NS, "nodeActorCode", node_actor_code)
        service = etree.SubElement(endpoint, self._q(MESSAGE_NS, "service"))
        self._append_text(service, SERVICE_NS, "serviceID", SERVICE_ID)
        self._append_text(service, SERVICE_NS, "serviceOperation", service_operation)
        return endpoint

    def _udidi_data_element(self, record: DeviceXmlRecord) -> XmlElement:
        udidi = etree.Element(self._q(DEVICE_NS, "UDIDIData"))
        udidi.set(self._q(XSI_NS, "type"), "udidi:MDRUDIDIDataType")
        self._append_text(udidi, ENTITY_NS, "state", "REGISTERED")
        if (record.submission_operation or "").upper() == "PATCH" and record.source_version_marker:
            self._append_text(udidi, ENTITY_NS, "version", record.source_version_marker)
        udidi.append(
            self._di_identifier_element(
                di_code=record.device_identifier_code,
                issuing_entity_code=record.device_identifier_issuing_entity,
                namespace=UDIDI_NS,
            )
        )
        status = etree.SubElement(udidi, self._q(UDIDI_NS, "status"))
        self._append_text(status, COMMON_DEVICE_NS, "code", record.status_code)
        udidi.append(
            self._di_identifier_element(
                tag_name="basicUDIIdentifier",
                di_code=record.basic_identifier_code,
                issuing_entity_code=record.basic_identifier_issuing_entity,
                namespace=UDIDI_NS,
            )
        )
        self._append_text(udidi, UDIDI_NS, "MDNCodes", " ".join(record.nomenclature_codes))
        if record.production_identifier:
            self._append_text(udidi, UDIDI_NS, "productionIdentifier", record.production_identifier)
        self._append_text(udidi, UDIDI_NS, "referenceNumber", record.reference_number)
        if record.secondary_identifier_code and record.secondary_identifier_issuing_entity:
            udidi.append(
                self._di_identifier_element(
                    tag_name="secondaryIdentifier",
                    di_code=record.secondary_identifier_code,
                    issuing_entity_code=record.secondary_identifier_issuing_entity,
                    namespace=UDIDI_NS,
                )
            )
        self._append_text(udidi, UDIDI_NS, "sterile", self._bool_text(record.sterile))
        self._append_text(udidi, UDIDI_NS, "sterilization", self._bool_text(record.sterilization))
        if record.trade_name and record.language_code:
            trade_names = etree.SubElement(udidi, self._q(UDIDI_NS, "tradeNames"))
            trade_name = etree.SubElement(trade_names, self._q(LANGUAGE_NS, "name"))
            self._append_text(trade_name, LANGUAGE_NS, "language", record.language_code)
            self._append_text(trade_name, LANGUAGE_NS, "textValue", record.trade_name)
        if record.storage_conditions:
            udidi.append(self._storage_conditions_element(record.storage_conditions))
        if record.critical_warnings:
            udidi.append(self._critical_warnings_element(record.critical_warnings))
        self._append_text(udidi, UDIDI_NS, "numberOfReuses", str(record.number_of_reuses))
        if record.market_countries:
            udidi.append(self._market_infos_element(record.market_countries))
        if record.base_quantity is not None:
            self._append_text(udidi, UDIDI_NS, "baseQuantity", str(record.base_quantity))
        self._append_text(udidi, UDIDI_NS, "latex", self._bool_text(record.contains_latex))
        self._append_text(udidi, UDIDI_NS, "reprocessed", self._bool_text(record.reprocessed))
        return udidi

    def _market_infos_element(self, items: list[tuple[str, bool]]) -> XmlElement:
        market_infos = etree.Element(self._q(UDIDI_NS, "marketInfos"))
        self._append_text(market_infos, ENTITY_NS, "state", "REGISTERED")
        for country_code, original in items:
            market_info = etree.SubElement(market_infos, self._q(MARKET_INFO_NS, "marketInfo"))
            self._append_text(market_info, MARKET_INFO_NS, "country", country_code)
            self._append_text(
                market_info,
                MARKET_INFO_NS,
                "originalPlacedOnTheMarket",
                "true" if original else "false",
            )
        return market_infos

    def _storage_conditions_element(self, items: list[StorageConditionXmlItem]) -> XmlElement:
        storage_conditions = etree.Element(self._q(UDIDI_NS, "storageHandlingConditions"))
        for item in items:
            condition = etree.SubElement(storage_conditions, self._q(COMMON_DEVICE_NS, "condition"))
            if item.comment:
                condition.append(self._language_optional_texts(item.comment, language="ANY"))
            self._append_text(condition, COMMON_DEVICE_NS, "storageHandlingConditionValue", item.code)
        return storage_conditions

    def _critical_warnings_element(self, items: list[CriticalWarningXmlItem]) -> XmlElement:
        critical_warnings = etree.Element(self._q(UDIDI_NS, "criticalWarnings"))
        for item in items:
            warning = etree.SubElement(critical_warnings, self._q(COMMON_DEVICE_NS, "warning"))
            if item.comment:
                warning.append(self._language_optional_texts(item.comment, language="ANY"))
            self._append_text(warning, COMMON_DEVICE_NS, "warningValue", item.code)
        return critical_warnings

    def _di_identifier_element(
        self,
        *,
        di_code: str,
        issuing_entity_code: str,
        tag_name: str = "identifier",
        namespace: str = BASIC_UDI_NS,
    ) -> XmlElement:
        identifier = etree.Element(self._q(namespace, tag_name))
        self._append_text(identifier, COMMON_DEVICE_NS, "DICode", di_code)
        self._append_text(identifier, COMMON_DEVICE_NS, "issuingEntityCode", issuing_entity_code)
        return identifier

    @staticmethod
    def _append_text(parent: XmlElement, namespace: str, tag_name: str, value: str) -> XmlElement:
        element = etree.SubElement(parent, etree.QName(namespace, tag_name))
        element.text = value
        return element

    def _language_optional_texts(self, text: str, *, language: str) -> XmlElement:
        comments = etree.Element(self._q(COMMON_DEVICE_NS, "comments"))
        name = etree.SubElement(comments, self._q(LANGUAGE_NS, "name"))
        self._append_text(name, LANGUAGE_NS, "language", language)
        self._append_text(name, LANGUAGE_NS, "textValue", text)
        return comments

    @staticmethod
    def _required(values: dict[str, str | None], key: str) -> str:
        value = values.get(key)
        if value in (None, ""):
            raise ValueError(f"Required canonical field {key} is missing for XML generation.")
        return value

    @staticmethod
    def _split_di_identifier(value: str) -> tuple[str, str]:
        issuing_entity, _, di_code = value.partition(":")
        if not issuing_entity or not di_code:
            raise ValueError(f"DI identifier {value!r} is not in issuing-entity form.")
        return issuing_entity, di_code

    @staticmethod
    def _bool(value: str) -> bool:
        return value.strip().lower() == "true"

    @staticmethod
    def _bool_text(value: bool) -> str:
        return "true" if value else "false"

    @staticmethod
    def _optional_int(value: str | None) -> int | None:
        if value in (None, ""):
            return None
        return int(value)

    @staticmethod
    def _split_codes(value: str) -> list[str]:
        return [token for token in value.replace(",", " ").split() if token]

    @staticmethod
    def _storage_condition_items(record: CanonicalValidationRecord) -> list[StorageConditionXmlItem]:
        items: list[StorageConditionXmlItem] = []
        for item in record.storage_condition_items:
            if item.normalized_code is None:
                raise ValueError(
                    f"Storage condition item {item.sequence} for {record.catalogue_number} is missing a schema enum mapping."
                )
            items.append(StorageConditionXmlItem(code=item.normalized_code, comment=item.description))
        return items

    @staticmethod
    def _critical_warning_items(record: CanonicalValidationRecord) -> list[CriticalWarningXmlItem]:
        items: list[CriticalWarningXmlItem] = []
        for item in record.critical_warning_items:
            if item.normalized_code is None:
                raise ValueError(
                    f"Critical warning item {item.sequence} for {record.catalogue_number} is missing a schema enum mapping."
                )
            items.append(CriticalWarningXmlItem(code=item.normalized_code, comment=item.description))
        return items

    @staticmethod
    def _market_country_items(record: CanonicalValidationRecord) -> list[tuple[str, bool]]:
        countries: list[tuple[str, bool]] = []
        for item in record.market_availability_items:
            code = XmlGenerationService._country_code(item.country)
            if code:
                countries.append((code, item.original_placed_on_market))
        return countries

    @staticmethod
    def _q(namespace: str, tag_name: str) -> etree.QName:
        return etree.QName(namespace, tag_name)

    @staticmethod
    def _slugify(token: str) -> str:
        normalized = token.lower().replace(" / ", "-").replace("/", "-")
        return "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in normalized).strip("-")

    @classmethod
    def _file_name(cls, *, product_family: str, product_variant: str, catalogue_number: str) -> str:
        return (
            f"{cls._slugify(product_family)}-{cls._slugify(product_variant)}-"
            f"{''.join(char if char.isalnum() or char in {'-', '_'} else '-' for char in catalogue_number)}.xml"
        )

    @classmethod
    def _batch_file_name(
        cls,
        *,
        product_family: str,
        product_variant: str,
        sequence: int,
        total_chunks: int,
    ) -> str:
        return (
            f"{cls._slugify(product_family)}-{cls._slugify(product_variant)}-"
            f"batch-{sequence:02d}-of-{total_chunks:02d}.xml"
        )

    @classmethod
    def _batch_package_file_name(cls, *, product_family: str, product_variant: str) -> str:
        return f"{cls._slugify(product_family)}-{cls._slugify(product_variant)}-batch-package.zip"

    @staticmethod
    def _language_code(value: str) -> str:
        token = value.strip().lower()
        return LANGUAGE_CODE_MAP.get(token, value.strip().upper())

    @staticmethod
    def _country_code(value: str | None) -> str | None:
        if value in (None, ""):
            return None
        token = value.strip().lower()
        extended_map = {
            **EU_COUNTRY_CODE_MAP,
            "norway": "NO",
            "iceland": "IS",
            "liechtenstein": "LI",
            "turkey": "TR",
            "northern ireland": "XI",
        }
        return extended_map.get(token, value.strip().upper())

    @staticmethod
    def _risk_class(value: str) -> str:
        token = value.strip().upper().replace(" ", "_")
        if token == "CLASS_IIA":
            return "CLASS_IIA"
        if token == "CLASS_IIB":
            return "CLASS_IIB"
        if token == "CLASS_III":
            return "CLASS_III"
        if token == "CLASS_I":
            return "CLASS_I"
        return token
