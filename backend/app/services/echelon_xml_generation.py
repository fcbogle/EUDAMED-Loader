from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from lxml import etree

from app.services.echelon_validation import EchelonValidationService
from app.services.xml_validation import XmlValidationService
from app.validation_models import EchelonValidationRecord
from app.xml_models import (
    CriticalWarningXmlItem,
    EchelonXmlRecord,
    SingleRecordXmlPreview,
    StorageConditionXmlItem,
)

MESSAGE_NS = "https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Message/v1"
SERVICE_NS = "https://ec.europa.eu/tools/eudamed/dtx/servicemodel/Service/v1"
DEVICE_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Device/v1"
BASIC_UDI_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/Device/BasicUDI/v1"
UDIDI_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/UDIDI/v1"
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


class EchelonXmlGenerationService:
    def __init__(self) -> None:
        self.validation_service = EchelonValidationService()
        self.xml_validation_service = XmlValidationService()

    def preview_single_record(self, catalogue_number: str) -> SingleRecordXmlPreview:
        record = self._find_validation_record(catalogue_number)
        xml_record = self._to_xml_record(record)
        xml_bytes = self._render_push_message(xml_record)
        validation = self.xml_validation_service.validate_message(xml_bytes)
        return SingleRecordXmlPreview(
            catalogue_number=xml_record.catalogue_number,
            trade_name=xml_record.trade_name,
            primary_udi_di=xml_record.primary_udi_di,
            file_name=self._file_name(xml_record.catalogue_number),
            xml=xml_bytes.decode("utf-8"),
            validation=validation,
        )

    def download_single_record(self, catalogue_number: str) -> tuple[str, bytes]:
        preview = self.preview_single_record(catalogue_number)
        return preview.file_name, preview.xml.encode("utf-8")

    def _find_validation_record(self, catalogue_number: str) -> EchelonValidationRecord:
        bundle = self.validation_service.build_validation_bundle()
        for record in bundle.records:
            if record.catalogue_number == catalogue_number:
                if record.after_completeness.status != "complete":
                    raise ValueError(f"Record {catalogue_number} is not XML-ready.")
                return record
        raise ValueError(f"Catalogue number {catalogue_number} was not found in the Echelon validation bundle.")

    def _to_xml_record(self, record: EchelonValidationRecord) -> EchelonXmlRecord:
        field_map = {field.canonical_path: field.after_value for field in record.fields}
        issuing_entity, basic_identifier_code = self._split_di_identifier(
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
        return EchelonXmlRecord(
            catalogue_number=self._required(field_map, "device_record.catalogue_number"),
            trade_name=field_map.get("device_record.trade_name"),
            primary_udi_di=self._required(field_map, "device_record.primary_udi_di"),
            issuing_entity=self._required(field_map, "manufacturer.issuing_entity"),
            language_code=self._language_code(self._required(field_map, "device_record.language")),
            basic_udi_di=self._required(field_map, "basic_device.basic_udi_di"),
            basic_identifier_code=basic_identifier_code,
            basic_identifier_issuing_entity=issuing_entity,
            device_identifier_code=device_identifier_code,
            device_identifier_issuing_entity=device_issuing_entity,
            risk_class=self._required(field_map, "basic_device.risk_class"),
            model=field_map.get("basic_device.model"),
            model_name=self._required(field_map, "basic_device.model_name"),
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
            sterilization=self._bool(self._required(field_map, "device_record.sterilization")),
            number_of_reuses=int(self._required(field_map, "device_record.number_of_reuses")),
            contains_latex=self._bool(self._required(field_map, "device_record.contains_latex")),
            reprocessed=self._bool(self._required(field_map, "device_record.reprocessed")),
            first_eu_market_country=self._country_code(field_map.get("device_record.market_availability.first_eu_market_country")),
            base_quantity=self._optional_int(field_map.get("device_record.base_quantity")),
            storage_conditions=self._storage_condition_items(record),
            critical_warnings=self._critical_warning_items(record),
        )

    def _render_push_message(self, record: EchelonXmlRecord) -> bytes:
        root = etree.Element(self._q(MESSAGE_NS, "Push"), nsmap=NSMAP)
        root.set("version", "3.0.28")

        self._append_text(root, MESSAGE_NS, "correlationID", str(uuid4()))
        self._append_text(root, MESSAGE_NS, "creationDateTime", datetime.now(UTC).replace(microsecond=0).isoformat())
        self._append_text(root, MESSAGE_NS, "messageID", str(uuid4()))
        root.append(self._endpoint_element(tag_name="recipient", node_actor_code="EUDAMED"))

        payload = etree.SubElement(root, self._q(MESSAGE_NS, "payload"))
        payload.append(self._device_payload(record))

        root.append(self._endpoint_element(tag_name="sender", node_actor_code=record.manufacturer_srn))

        return etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)

    def _endpoint_element(self, *, tag_name: str, node_actor_code: str) -> etree._Element:
        endpoint = etree.Element(self._q(MESSAGE_NS, tag_name))
        node = etree.SubElement(endpoint, self._q(MESSAGE_NS, "node"))
        self._append_text(node, SERVICE_NS, "nodeActorCode", node_actor_code)
        service = etree.SubElement(endpoint, self._q(MESSAGE_NS, "service"))
        self._append_text(service, SERVICE_NS, "serviceID", "DEVICE")
        self._append_text(service, SERVICE_NS, "serviceOperation", "POST")
        return endpoint

    def _device_payload(self, record: EchelonXmlRecord) -> etree._Element:
        device = etree.Element(self._q(DEVICE_NS, "Device"))
        device.set(self._q(XSI_NS, "type"), "device:MDRDeviceType")
        device.append(self._basic_udi_element(record))
        device.append(self._udidi_data_element(record))
        return device

    def _basic_udi_element(self, record: EchelonXmlRecord) -> etree._Element:
        basic_udi = etree.Element(self._q(DEVICE_NS, "MDRBasicUDI"))
        self._append_text(basic_udi, BASIC_UDI_NS, "riskClass", record.risk_class)

        model_name = etree.SubElement(basic_udi, self._q(BASIC_UDI_NS, "modelName"))
        if record.model:
            self._append_text(model_name, COMMON_DEVICE_NS, "model", record.model)
        self._append_text(model_name, COMMON_DEVICE_NS, "name", record.model_name)

        basic_udi.append(
            self._di_identifier_element(
                di_code=record.basic_identifier_code,
                issuing_entity_code=record.basic_identifier_issuing_entity,
            )
        )
        self._append_text(
            basic_udi,
            BASIC_UDI_NS,
            "animalTissuesCells",
            self._bool_text(record.animal_tissues_cells),
        )
        if record.authorised_representative_srn:
            self._append_text(basic_udi, BASIC_UDI_NS, "ARActorCode", record.authorised_representative_srn)
        self._append_text(
            basic_udi,
            BASIC_UDI_NS,
            "humanTissuesCells",
            self._bool_text(record.human_tissues_cells),
        )
        self._append_text(basic_udi, BASIC_UDI_NS, "MFActorCode", record.manufacturer_srn)
        self._append_text(
            basic_udi,
            BASIC_UDI_NS,
            "humanProductCheck",
            self._bool_text(record.human_product_check),
        )
        self._append_text(
            basic_udi,
            BASIC_UDI_NS,
            "medicinalProductCheck",
            self._bool_text(record.medicinal_product_check),
        )
        self._append_text(basic_udi, BASIC_UDI_NS, "type", record.basic_device_type)
        self._append_text(basic_udi, COMMON_DEVICE_NS, "active", self._bool_text(record.active))
        self._append_text(
            basic_udi,
            COMMON_DEVICE_NS,
            "administeringMedicine",
            self._bool_text(record.administering_medicine),
        )
        self._append_text(basic_udi, COMMON_DEVICE_NS, "implantable", self._bool_text(record.implantable))
        self._append_text(
            basic_udi,
            COMMON_DEVICE_NS,
            "measuringFunction",
            self._bool_text(record.measuring_function),
        )
        self._append_text(basic_udi, COMMON_DEVICE_NS, "reusable", self._bool_text(record.reusable))
        return basic_udi

    def _udidi_data_element(self, record: EchelonXmlRecord) -> etree._Element:
        udidi = etree.Element(self._q(DEVICE_NS, "MDRUDIDIData"))
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
        if record.trade_name:
            trade_names = etree.SubElement(udidi, self._q(UDIDI_NS, "tradeNames"))
            trade_name = etree.SubElement(trade_names, self._q(LANGUAGE_NS, "name"))
            self._append_text(trade_name, LANGUAGE_NS, "language", record.language_code)
            self._append_text(trade_name, LANGUAGE_NS, "textValue", record.trade_name)
        if record.storage_conditions:
            udidi.append(self._storage_conditions_element(record.storage_conditions))
        if record.critical_warnings:
            udidi.append(self._critical_warnings_element(record.critical_warnings))
        self._append_text(udidi, UDIDI_NS, "numberOfReuses", str(record.number_of_reuses))
        if record.first_eu_market_country:
            udidi.append(self._market_infos_element(record.first_eu_market_country))
        if record.base_quantity is not None:
            self._append_text(udidi, UDIDI_NS, "baseQuantity", str(record.base_quantity))
        self._append_text(udidi, UDIDI_NS, "latex", self._bool_text(record.contains_latex))
        self._append_text(udidi, UDIDI_NS, "reprocessed", self._bool_text(record.reprocessed))
        return udidi

    def _market_infos_element(self, country_code: str) -> etree._Element:
        market_infos = etree.Element(self._q(UDIDI_NS, "marketInfos"))
        market_info = etree.SubElement(market_infos, self._q(MARKET_INFO_NS, "marketInfo"))
        self._append_text(market_info, MARKET_INFO_NS, "country", country_code)
        self._append_text(market_info, MARKET_INFO_NS, "originalPlacedOnTheMarket", "true")
        return market_infos

    def _storage_conditions_element(self, items: list[StorageConditionXmlItem]) -> etree._Element:
        storage_conditions = etree.Element(self._q(UDIDI_NS, "storageHandlingConditions"))
        for item in items:
            condition = etree.SubElement(storage_conditions, self._q(COMMON_DEVICE_NS, "condition"))
            if item.comment:
                condition.append(self._language_optional_texts(item.comment, language="ANY"))
            self._append_text(condition, COMMON_DEVICE_NS, "storageHandlingConditionValue", item.code)
        return storage_conditions

    def _critical_warnings_element(self, items: list[CriticalWarningXmlItem]) -> etree._Element:
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
    ) -> etree._Element:
        identifier = etree.Element(self._q(namespace, tag_name))
        self._append_text(identifier, COMMON_DEVICE_NS, "DICode", di_code)
        self._append_text(identifier, COMMON_DEVICE_NS, "issuingEntityCode", issuing_entity_code)
        return identifier

    @staticmethod
    def _append_text(parent: etree._Element, namespace: str, tag_name: str, value: str) -> etree._Element:
        element = etree.SubElement(parent, etree.QName(namespace, tag_name))
        element.text = value
        return element

    def _language_optional_texts(self, text: str, *, language: str) -> etree._Element:
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
    def _storage_condition_items(record: EchelonValidationRecord) -> list[StorageConditionXmlItem]:
        items: list[StorageConditionXmlItem] = []
        for item in record.storage_condition_items:
            if item.normalized_code is None:
                raise ValueError(
                    f"Storage condition item {item.sequence} for {record.catalogue_number} is missing a schema enum mapping."
                )
            items.append(StorageConditionXmlItem(code=item.normalized_code, comment=item.description))
        return items

    @staticmethod
    def _critical_warning_items(record: EchelonValidationRecord) -> list[CriticalWarningXmlItem]:
        items: list[CriticalWarningXmlItem] = []
        for item in record.critical_warning_items:
            if item.normalized_code is None:
                raise ValueError(
                    f"Critical warning item {item.sequence} for {record.catalogue_number} is missing a schema enum mapping."
                )
            items.append(CriticalWarningXmlItem(code=item.normalized_code, comment=item.description))
        return items

    @staticmethod
    def _q(namespace: str, tag_name: str) -> etree.QName:
        return etree.QName(namespace, tag_name)

    @staticmethod
    def _file_name(catalogue_number: str) -> str:
        safe_catalogue = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in catalogue_number)
        return f"echelon-{safe_catalogue}.xml"

    @staticmethod
    def _language_code(value: str) -> str:
        token = value.strip().lower()
        return LANGUAGE_CODE_MAP.get(token, value.strip().upper())

    @staticmethod
    def _country_code(value: str | None) -> str | None:
        if value in (None, ""):
            return None
        token = value.strip().lower()
        return EU_COUNTRY_CODE_MAP.get(token, value.strip().upper())
