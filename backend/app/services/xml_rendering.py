from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import lxml.etree as etree

from app.config import Settings
from app.services.xml_projection import DeviceXmlRecord, MarketInfoXmlRecord
from app.xml_models import CriticalWarningXmlItem, StorageConditionXmlItem

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
MKTINFO_NS = "https://ec.europa.eu/tools/eudamed/dtx/datamodel/Entity/MktInfo/v1"
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
    "mktinfo": MKTINFO_NS,
    "marketinfo": MARKET_INFO_NS,
    "xsi": XSI_NS,
}


class EudamedMessageRenderer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def render_message(self, record: DeviceXmlRecord) -> bytes:
        return self.render_message_records([record])

    def render_market_info_message(self, record: MarketInfoXmlRecord) -> bytes:
        root = etree.Element(self._q(MESSAGE_NS, "Push"), nsmap=NSMAP)
        root.set("version", self.settings.eudamed_message_schema_version)

        self._append_text(root, MESSAGE_NS, "correlationID", str(uuid4()))
        self._append_text(root, MESSAGE_NS, "creationDateTime", datetime.now(UTC).replace(microsecond=0).isoformat())
        self._append_text(root, MESSAGE_NS, "messageID", str(uuid4()))
        root.append(
            self._endpoint_element(
                tag_name="recipient",
                node_actor_code="EUDAMED",
                service_operation="PUT",
                service_id=self.settings.eudamed_market_info_service_id,
            )
        )

        payload = etree.SubElement(root, self._q(MESSAGE_NS, "payload"))
        payload.append(self._market_info_payload(record))

        root.append(
            self._endpoint_element(
                tag_name="sender",
                node_actor_code=record.manufacturer_srn,
                service_operation="PUT",
                service_id=self.settings.eudamed_market_info_service_id,
            )
        )

        return etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)

    def render_message_records(self, records: list[DeviceXmlRecord]) -> bytes:
        root = etree.Element(self._q(MESSAGE_NS, "Push"), nsmap=NSMAP)
        root.set("version", self.settings.eudamed_message_schema_version)

        self._append_text(root, MESSAGE_NS, "correlationID", str(uuid4()))
        self._append_text(root, MESSAGE_NS, "creationDateTime", datetime.now(UTC).replace(microsecond=0).isoformat())
        self._append_text(root, MESSAGE_NS, "messageID", str(uuid4()))
        first_operation = self._normalized_operation(records[0].submission_operation)
        first_service_id = records[0].service_id_override or self._service_id_for_operation(first_operation)
        root.append(
            self._endpoint_element(
                tag_name="recipient",
                node_actor_code="EUDAMED",
                service_operation=first_operation,
                service_id=first_service_id,
            )
        )

        payload = etree.SubElement(root, self._q(MESSAGE_NS, "payload"))
        for record in records:
            payload.append(self._payload_element(record))

        root.append(
            self._endpoint_element(
                tag_name="sender",
                node_actor_code=records[0].manufacturer_srn,
                service_operation=first_operation,
                service_id=first_service_id,
            )
        )

        return etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)

    def render_batch_from_strings(self, messages: list[str]) -> bytes:
        if not messages:
            raise ValueError("At least one XML message is required.")

        roots = [etree.fromstring(message.encode("utf-8")) for message in messages]
        payload_children = [self._single_payload_child(root) for root in roots]
        first_operation = self._message_operation(roots[0])
        sender_code = self._message_sender_code(roots[0])

        root = etree.Element(self._q(MESSAGE_NS, "Push"), nsmap=NSMAP)
        root.set("version", self.settings.eudamed_message_schema_version)

        self._append_text(root, MESSAGE_NS, "correlationID", str(uuid4()))
        self._append_text(root, MESSAGE_NS, "creationDateTime", datetime.now(UTC).replace(microsecond=0).isoformat())
        self._append_text(root, MESSAGE_NS, "messageID", str(uuid4()))
        root.append(
            self._endpoint_element(
                tag_name="recipient",
                node_actor_code="EUDAMED",
                service_operation=first_operation,
                service_id=self._service_id_for_operation(first_operation),
            )
        )

        payload = etree.SubElement(root, self._q(MESSAGE_NS, "payload"))
        for child in payload_children:
            payload.append(child)

        root.append(
            self._endpoint_element(
                tag_name="sender",
                node_actor_code=sender_code,
                service_operation=first_operation,
                service_id=self._service_id_for_operation(first_operation),
            )
        )

        return etree.tostring(root, encoding="utf-8", xml_declaration=True, pretty_print=True)

    def _endpoint_element(
        self,
        *,
        tag_name: str,
        node_actor_code: str,
        service_operation: str,
        service_id: str,
    ) -> XmlElement:
        endpoint = etree.Element(self._q(MESSAGE_NS, tag_name))
        node = etree.SubElement(endpoint, self._q(MESSAGE_NS, "node"))
        self._append_text(node, SERVICE_NS, "nodeActorCode", node_actor_code)
        service = etree.SubElement(endpoint, self._q(MESSAGE_NS, "service"))
        self._append_text(service, SERVICE_NS, "serviceID", service_id)
        self._append_text(service, SERVICE_NS, "serviceOperation", service_operation)
        return endpoint

    def _payload_element(self, record: DeviceXmlRecord) -> XmlElement:
        profile = self._profile_for_operation(record.submission_operation)
        if self._normalized_operation(record.submission_operation) == "POST" and record.post_payload_mode == "udidi_only":
            return self._udidi_data_element(record)
        if profile == "device_post":
            return self._device_payload(record)
        return self._udidi_data_element(record)

    def _device_payload(self, record: DeviceXmlRecord) -> XmlElement:
        device = etree.Element(self._q(DEVICE_NS, "Device"))
        device.set(self._q(XSI_NS, "type"), "device:MDRDeviceType")
        device.append(self._basic_udi_element(record))
        device.append(self._udidi_data_element(record))
        return device

    def _basic_udi_element(self, record: DeviceXmlRecord) -> XmlElement:
        basic_udi = etree.Element(self._q(DEVICE_NS, "MDRBasicUDI"))
        self._append_text(basic_udi, ENTITY_NS, "state", "REGISTERED")
        self._append_text(basic_udi, BASIC_UDI_NS, "riskClass", record.risk_class)

        model_name = etree.SubElement(basic_udi, self._q(BASIC_UDI_NS, "modelName"))
        self._append_text(model_name, COMMON_DEVICE_NS, "name", record.model_name)

        basic_udi.append(
            self._di_identifier_element(
                di_code=record.basic_identifier_code,
                issuing_entity_code=record.basic_identifier_issuing_entity,
            )
        )
        self._append_text(basic_udi, BASIC_UDI_NS, "animalTissuesCells", self._bool_text(record.animal_tissues_cells))
        if record.authorised_representative_srn:
            self._append_text(basic_udi, BASIC_UDI_NS, "ARActorCode", record.authorised_representative_srn)
        self._append_text(basic_udi, BASIC_UDI_NS, "humanTissuesCells", self._bool_text(record.human_tissues_cells))
        self._append_text(basic_udi, BASIC_UDI_NS, "MFActorCode", record.manufacturer_srn)
        self._append_text(basic_udi, BASIC_UDI_NS, "humanProductCheck", self._bool_text(record.human_product_check))
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

    def _udidi_data_element(self, record: DeviceXmlRecord) -> XmlElement:
        profile = self._profile_for_operation(record.submission_operation)
        if self._normalized_operation(record.submission_operation) == "POST" and record.post_payload_mode == "udidi_only":
            udidi = etree.Element(self._q(DEVICE_NS, "UDIDIData"))
            udidi.set(self._q(XSI_NS, "type"), "udidi:MDRUDIDIDataType")
        elif profile == "device_post":
            udidi = etree.Element(self._q(DEVICE_NS, "MDRUDIDIData"))
        else:
            udidi = etree.Element(self._q(DEVICE_NS, "UDIDIData"))
            udidi.set(self._q(XSI_NS, "type"), "udidi:MDRUDIDIDataType")
        self._append_text(udidi, ENTITY_NS, "state", "REGISTERED")
        if self._normalized_operation(record.submission_operation) == "PATCH":
            version_marker = record.patch_version_override or record.source_version_marker
            if version_marker:
                self._append_text(udidi, ENTITY_NS, "version", version_marker)
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
        if record.market_countries and (profile != "udidi_patch" or record.include_market_infos_in_patch):
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

    def _market_info_payload(self, record: MarketInfoXmlRecord) -> XmlElement:
        payload = etree.Element(self._q(MKTINFO_NS, "DTXMarketInfo"))
        payload.append(
            self._di_identifier_element(
                di_code=record.device_identifier_code,
                issuing_entity_code=record.device_identifier_issuing_entity,
                tag_name="uDIDIIdentifier",
                namespace=MARKET_INFO_NS,
            )
        )
        payload.append(self._market_infos_wrapper_element(record.market_countries, record.market_info_version))
        return payload

    def _market_infos_wrapper_element(self, items: list[tuple[str, bool]], version: str) -> XmlElement:
        market_infos = etree.Element(self._q(MARKET_INFO_NS, "marketInfos"))
        self._append_text(market_infos, ENTITY_NS, "state", "REGISTERED")
        self._append_text(market_infos, ENTITY_NS, "version", version)
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

    @staticmethod
    def _single_payload_child(root: XmlElement) -> XmlElement:
        payload = root.find(f"{{{MESSAGE_NS}}}payload")
        if payload is None or len(payload) != 1:
            raise ValueError("Each XML message must contain exactly one payload child.")
        return payload[0]

    @staticmethod
    def _message_operation(root: XmlElement) -> str:
        recipient = root.find(f"{{{MESSAGE_NS}}}recipient")
        if recipient is None:
            raise ValueError("XML message is missing recipient metadata.")
        service = recipient.find(f"{{{MESSAGE_NS}}}service")
        if service is None:
            raise ValueError("XML message is missing recipient service metadata.")
        operation = service.findtext(f"{{{SERVICE_NS}}}serviceOperation")
        if not operation:
            raise ValueError("XML message is missing recipient service operation.")
        return operation.upper()

    @staticmethod
    def _message_sender_code(root: XmlElement) -> str:
        sender = root.find(f"{{{MESSAGE_NS}}}sender")
        if sender is None:
            raise ValueError("XML message is missing sender metadata.")
        node = sender.find(f"{{{MESSAGE_NS}}}node")
        if node is None:
            raise ValueError("XML message is missing sender node metadata.")
        node_actor_code = node.findtext(f"{{{SERVICE_NS}}}nodeActorCode")
        if not node_actor_code:
            raise ValueError("XML message is missing sender node actor code.")
        return node_actor_code

    def _language_optional_texts(self, text: str, *, language: str) -> XmlElement:
        comments = etree.Element(self._q(COMMON_DEVICE_NS, "comments"))
        name = etree.SubElement(comments, self._q(LANGUAGE_NS, "name"))
        self._append_text(name, LANGUAGE_NS, "language", language)
        self._append_text(name, LANGUAGE_NS, "textValue", text)
        return comments

    def _profile_for_operation(self, submission_operation: str | None) -> str:
        operation = self._normalized_operation(submission_operation)
        if operation == "PATCH":
            return self.settings.eudamed_patch_profile
        return self.settings.eudamed_post_profile

    def _service_id_for_operation(self, submission_operation: str | None) -> str:
        operation = self._normalized_operation(submission_operation)
        if operation == "PATCH":
            return self.settings.eudamed_patch_service_id
        return self.settings.eudamed_post_service_id

    @staticmethod
    def _normalized_operation(submission_operation: str | None) -> str:
        return (submission_operation or "POST").upper()

    @staticmethod
    def _bool_text(value: bool) -> str:
        return "true" if value else "false"

    @staticmethod
    def _q(namespace: str, tag_name: str) -> etree.QName:
        return etree.QName(namespace, tag_name)
