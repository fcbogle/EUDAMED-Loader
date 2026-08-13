from __future__ import annotations

from dataclasses import dataclass, replace

from app.config import get_settings
from app.validation_models import CanonicalValidationRecord
from app.xml_models import CriticalWarningXmlItem, PatchStateSnapshot, StorageConditionXmlItem

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


@dataclass(frozen=True)
class DeviceXmlRecord:
    product_family: str
    product_variant: str
    submission_operation: str | None
    catalogue_number: str
    trade_name: str | None
    primary_udi_di: str
    issuing_entity: str
    language_code: str | None
    basic_identifier_code: str
    basic_identifier_issuing_entity: str
    device_identifier_code: str
    device_identifier_issuing_entity: str
    risk_class: str
    model_name: str
    manufacturer_srn: str
    authorised_representative_srn: str | None
    human_tissues_cells: bool
    animal_tissues_cells: bool
    human_product_check: bool
    medicinal_product_check: bool
    basic_device_type: str
    active: bool
    administering_medicine: bool
    implantable: bool
    measuring_function: bool
    reusable: bool
    nomenclature_codes: list[str]
    status_code: str
    production_identifier: str | None
    reference_number: str
    secondary_identifier_code: str | None
    secondary_identifier_issuing_entity: str | None
    sterile: bool
    sterilization: bool
    source_version_marker: str | None
    number_of_reuses: int
    contains_latex: bool
    reprocessed: bool
    market_countries: list[tuple[str, bool]]
    base_quantity: int | None
    storage_conditions: list[StorageConditionXmlItem]
    critical_warnings: list[CriticalWarningXmlItem]
    post_payload_mode: str = "device"
    service_id_override: str | None = None
    patch_version_override: str | None = None
    include_market_infos_in_patch: bool = False


@dataclass(frozen=True)
class MarketInfoXmlRecord:
    product_family: str
    product_variant: str
    catalogue_number: str
    primary_udi_di: str
    manufacturer_srn: str
    device_identifier_code: str
    device_identifier_issuing_entity: str
    market_countries: list[tuple[str, bool]]


class DeviceXmlProjectionBuilder:
    def __init__(self) -> None:
        self.settings = get_settings()

    def build_device_record(self, record: CanonicalValidationRecord) -> DeviceXmlRecord:
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
        manufacturer_srn = self._resolved_manufacturer_srn(
            self._required(field_map, "manufacturer.manufacturer_srn")
        )
        authorised_representative_srn = self._resolved_authorised_representative_srn(
            field_map.get("basic_device.authorised_representative_srn")
        )
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
            manufacturer_srn=manufacturer_srn,
            authorised_representative_srn=authorised_representative_srn,
            human_tissues_cells=self._bool(self._required(field_map, "basic_device.human_tissues_cells")),
            animal_tissues_cells=self._bool(self._required(field_map, "basic_device.animal_tissues_cells")),
            human_product_check=self._bool(self._required(field_map, "basic_device.human_product_check")),
            medicinal_product_check=self._bool(self._required(field_map, "basic_device.medicinal_product_check")),
            basic_device_type=self._required(field_map, "basic_device.device_type"),
            active=self._bool(self._required(field_map, "basic_device.active")),
            administering_medicine=self._bool(
                self._required(field_map, "basic_device.administering_medicinal_product")
            ),
            implantable=self._bool(self._required(field_map, "basic_device.implantable")),
            measuring_function=self._bool(self._required(field_map, "basic_device.measuring_function")),
            reusable=self._bool(self._required(field_map, "basic_device.reusable_surgical_instrument")),
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

    @staticmethod
    def build_udidi_post_record(post_record: DeviceXmlRecord) -> DeviceXmlRecord:
        return replace(
            post_record,
            submission_operation="POST",
            post_payload_mode="udidi_only",
            service_id_override="UDI_DI",
        )

    @staticmethod
    def build_equivalent_first_patch(post_record: DeviceXmlRecord) -> DeviceXmlRecord:
        return DeviceXmlRecord(
            product_family=post_record.product_family,
            product_variant=post_record.product_variant,
            submission_operation="PATCH",
            catalogue_number=post_record.catalogue_number,
            trade_name=post_record.trade_name,
            primary_udi_di=post_record.primary_udi_di,
            issuing_entity=post_record.issuing_entity,
            language_code=post_record.language_code,
            basic_identifier_code=post_record.basic_identifier_code,
            basic_identifier_issuing_entity=post_record.basic_identifier_issuing_entity,
            device_identifier_code=post_record.device_identifier_code,
            device_identifier_issuing_entity=post_record.device_identifier_issuing_entity,
            risk_class=post_record.risk_class,
            model_name=post_record.model_name,
            manufacturer_srn=post_record.manufacturer_srn,
            authorised_representative_srn=post_record.authorised_representative_srn,
            human_tissues_cells=post_record.human_tissues_cells,
            animal_tissues_cells=post_record.animal_tissues_cells,
            human_product_check=post_record.human_product_check,
            medicinal_product_check=post_record.medicinal_product_check,
            basic_device_type=post_record.basic_device_type,
            active=post_record.active,
            administering_medicine=post_record.administering_medicine,
            implantable=post_record.implantable,
            measuring_function=post_record.measuring_function,
            reusable=post_record.reusable,
            nomenclature_codes=post_record.nomenclature_codes,
            status_code=post_record.status_code,
            production_identifier=post_record.production_identifier,
            reference_number=post_record.reference_number,
            secondary_identifier_code=post_record.secondary_identifier_code,
            secondary_identifier_issuing_entity=post_record.secondary_identifier_issuing_entity,
            sterile=post_record.sterile,
            sterilization=post_record.sterilization,
            source_version_marker="2",
            number_of_reuses=post_record.number_of_reuses,
            contains_latex=post_record.contains_latex,
            reprocessed=post_record.reprocessed,
            market_countries=post_record.market_countries,
            base_quantity=post_record.base_quantity,
            storage_conditions=post_record.storage_conditions,
            critical_warnings=post_record.critical_warnings,
            patch_version_override="2",
            include_market_infos_in_patch=True,
        )

    @staticmethod
    def build_patch_record_from_state(
        post_record: DeviceXmlRecord,
        patch_state: PatchStateSnapshot,
    ) -> DeviceXmlRecord:
        baseline_patch_record = DeviceXmlProjectionBuilder.build_equivalent_first_patch(post_record)
        return replace(
            baseline_patch_record,
            trade_name=patch_state.trade_name,
            base_quantity=(
                patch_state.base_quantity
                if patch_state.base_quantity is not None
                else baseline_patch_record.base_quantity
            ),
            sterile=patch_state.sterile if patch_state.sterile is not None else baseline_patch_record.sterile,
            contains_latex=(
                patch_state.contains_latex
                if patch_state.contains_latex is not None
                else baseline_patch_record.contains_latex
            ),
            status_code=patch_state.status_code or baseline_patch_record.status_code,
            storage_conditions=list(patch_state.storage_conditions),
            critical_warnings=list(patch_state.critical_warnings),
            source_version_marker=patch_state.version,
            patch_version_override=patch_state.version,
            include_market_infos_in_patch=True,
        )

    @staticmethod
    def build_trade_name_edit_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        new_trade_name: str,
        patch_version: str,
    ) -> DeviceXmlRecord:
        return replace(
            baseline_patch_record,
            trade_name=new_trade_name,
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    @staticmethod
    def build_warning_add_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        new_warning_code: str,
        new_warning_comment: str | None,
        patch_version: str,
    ) -> DeviceXmlRecord:
        return replace(
            baseline_patch_record,
            critical_warnings=[CriticalWarningXmlItem(code=new_warning_code, comment=new_warning_comment)],
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    @staticmethod
    def build_storage_condition_edit_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        condition_updates: dict[str, str],
        patch_version: str,
    ) -> DeviceXmlRecord:
        updated_conditions = [
            StorageConditionXmlItem(
                code=item.code,
                comment=condition_updates.get(item.code, item.comment),
            )
            for item in baseline_patch_record.storage_conditions
        ]
        return replace(
            baseline_patch_record,
            storage_conditions=updated_conditions,
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    @staticmethod
    def build_base_quantity_edit_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        new_base_quantity: int,
        patch_version: str,
    ) -> DeviceXmlRecord:
        return replace(
            baseline_patch_record,
            base_quantity=new_base_quantity,
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    @staticmethod
    def build_sterile_edit_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        new_sterile: bool,
        patch_version: str,
    ) -> DeviceXmlRecord:
        return replace(
            baseline_patch_record,
            sterile=new_sterile,
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    @staticmethod
    def build_latex_edit_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        new_contains_latex: bool,
        patch_version: str,
    ) -> DeviceXmlRecord:
        return replace(
            baseline_patch_record,
            contains_latex=new_contains_latex,
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    @staticmethod
    def build_status_code_edit_patch(
        baseline_patch_record: DeviceXmlRecord,
        *,
        new_status_code: str,
        patch_version: str,
    ) -> DeviceXmlRecord:
        return replace(
            baseline_patch_record,
            status_code=new_status_code,
            source_version_marker=patch_version,
            patch_version_override=patch_version,
        )

    def build_market_info_record(self, record: CanonicalValidationRecord) -> MarketInfoXmlRecord:
        field_map = {field.canonical_path: field.value for field in record.fields}
        device_identifier_issuing_entity, device_identifier_code = self._split_di_identifier(
            self._required(field_map, "device_record.identifier")
        )
        market_countries = self._market_country_items(record)
        if not market_countries:
            raise ValueError(
                f"Catalogue number {record.catalogue_number} has no market-info items available for MARKET_INFO.PUT generation."
            )
        manufacturer_srn = self._resolved_manufacturer_srn(
            self._required(field_map, "manufacturer.manufacturer_srn")
        )
        return MarketInfoXmlRecord(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=self._required(field_map, "device_record.catalogue_number"),
            primary_udi_di=self._required(field_map, "device_record.primary_udi_di"),
            manufacturer_srn=manufacturer_srn,
            device_identifier_code=device_identifier_code,
            device_identifier_issuing_entity=device_identifier_issuing_entity,
            market_countries=market_countries,
        )

    def _resolved_manufacturer_srn(self, source_manufacturer_srn: str) -> str:
        return self.settings.eudamed_manufacturer_srn_override or source_manufacturer_srn

    def _resolved_authorised_representative_srn(
        self,
        source_authorised_representative_srn: str | None,
    ) -> str | None:
        if self.settings.eudamed_suppress_authorised_representative:
            return None
        if self.settings.eudamed_authorised_representative_srn_override:
            return self.settings.eudamed_authorised_representative_srn_override
        return source_authorised_representative_srn

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
            code = DeviceXmlProjectionBuilder._country_code(item.country)
            if code:
                countries.append((code, item.original_placed_on_market))
        return countries

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
