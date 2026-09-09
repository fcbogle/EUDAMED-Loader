from __future__ import annotations

from collections import Counter
from collections.abc import Sequence

from app.models import OperationAssessment, OperationAssessmentIdentityScope, OperationAssessmentType
from app.services.testing_read_model import TestingReadModelService
from app.services.xml_generation import XmlGenerationService
from app.validation_models import CanonicalValidationRecord
from app.xml_models import BulkXmlExcludedRecord


class OperationAssessmentService:
    def __init__(self) -> None:
        self.xml_service = XmlGenerationService(require_import=True)
        self.testing_read_model = TestingReadModelService()
        self.testing_state_store = self.xml_service.testing_state_store

    def record_readiness(self) -> list[dict[str, object]]:
        """The same per-record rules used by operation assessment, for dashboard counts."""
        try:
            records = self.xml_service._validation_bundle().records
        except ValueError:
            return []  # First-run UI: import is required before any operation is eligible.
        result = []
        for record in records:
            if record.xml_readiness.status != "complete" or (record.submission_operation or "").upper() != "POST":
                continue
            post = self._assess_single_post_record(record)
            patch = self._assess_single_patch_record(record)
            market = self._assess_single_market_info_record(record)
            result.append({
                "product_family": record.product_family,
                "product_variant": record.product_variant,
                "catalogue_number": record.catalogue_number,
                "primary_udi_di": record.primary_udi_di,
                "basic_udi_di": post.evidence.get("candidate_basic_udi_di"),
                "parent_registered": bool(post.evidence.get("parent_registration_known")),
                "post_ready": post.status == "available",
                "child_post_ready": post.status == "available" and bool(post.evidence.get("parent_registration_known")),
                "patch_ready": patch.status == "available",
                "market_info_ready": market.status == "available",
            })
        return result

    def assess_single_post(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str | None = None,
    ) -> OperationAssessment:
        candidate_records, _, _ = self.xml_service._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        if catalogue_number:
            target_record = self._find_record(candidate_records, catalogue_number)
            if target_record is None:
                return self._blocked_assessment(
                    operation_type="single_post",
                    product_family=product_family,
                    product_variant=product_variant,
                    catalogue_number=catalogue_number,
                    summary_message="POST is not currently available for the selected device.",
                    blocking_reasons=[
                        "The selected catalogue number is not currently an XML-ready POST row for this family and variant."
                    ],
                    evidence={
                        "candidate_catalogue_number": catalogue_number,
                        "xml_ready": False,
                    },
                )
            return self._assess_single_post_record(target_record)

        available_record = None
        available_assessment: OperationAssessment | None = None
        blocked_reasons: list[str] = []
        blocked_assessments: list[OperationAssessment] = []
        for record in candidate_records:
            assessment = self._assess_single_post_record(record)
            if assessment.status == "available":
                available_assessment = assessment
                return assessment
            blocked_reasons.extend(assessment.blocking_reasons)
            blocked_assessments.append(assessment)
            if available_record is None:
                available_record = record

        blocking_reasons = self._deduplicated_reasons(blocked_reasons)
        if not candidate_records:
            blocking_reasons = ["No XML-ready POST rows are currently available for this family and variant."]
        first_catalogue_number = available_record.catalogue_number if available_record is not None else None
        first_blocked_assessment = blocked_assessments[0] if blocked_assessments else None
        parent_registered_without_next_child = bool(
            blocked_assessments
            and all(bool(assessment.evidence.get("parent_registration_known")) for assessment in blocked_assessments)
            and all(bool(assessment.evidence.get("child_registration_known")) for assessment in blocked_assessments)
        )
        summary_message = "POST is not currently available for the selected family and variant."
        if parent_registered_without_next_child:
            summary_message = (
                "The Basic UDI-DI is already registered and no further Device UDI-DI POST candidates are currently "
                "available for this family and variant."
            )
        return self._blocked_assessment(
            operation_type="single_post",
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=first_catalogue_number,
            summary_message=summary_message,
            blocking_reasons=blocking_reasons,
            evidence={
                "candidate_catalogue_number": first_catalogue_number,
                "candidate_basic_udi_di": (
                    first_blocked_assessment.evidence.get("candidate_basic_udi_di") if first_blocked_assessment else None
                ),
                "parent_registration_known": (
                    first_blocked_assessment.evidence.get("parent_registration_known") if first_blocked_assessment else None
                ),
                "child_registration_known": (
                    first_blocked_assessment.evidence.get("child_registration_known") if first_blocked_assessment else None
                ),
                "xml_ready": bool(candidate_records),
            },
        )

    def assess_single_patch(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str | None = None,
    ) -> OperationAssessment:
        candidate_records, _, _ = self.xml_service._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        if catalogue_number:
            target_record = self._find_record(candidate_records, catalogue_number)
            if target_record is None:
                return self._blocked_assessment(
                    operation_type="single_patch",
                    product_family=product_family,
                    product_variant=product_variant,
                    catalogue_number=catalogue_number,
                    summary_message="PATCH is not currently available for the selected device.",
                    blocking_reasons=[
                        "The selected catalogue number is not currently an XML-ready POST row for this family and variant."
                    ],
                    evidence={
                        "catalogue_number": catalogue_number,
                        "reviewed_post_baseline_present": False,
                        "tracked_registration_known": False,
                    },
                )
            return self._assess_single_patch_record(target_record)

        blocked_reasons: list[str] = []
        fallback_record: CanonicalValidationRecord | None = None
        available_assessments: list[OperationAssessment] = []
        for record in candidate_records:
            assessment = self._assess_single_patch_record(record)
            if assessment.status == "available":
                available_assessments.append(assessment)
                continue
            blocked_reasons.extend(assessment.blocking_reasons)
            if fallback_record is None:
                fallback_record = record

        if available_assessments:
            return min(available_assessments, key=self._single_patch_priority_key)

        blocking_reasons = self._deduplicated_reasons(blocked_reasons)
        if not candidate_records:
            blocking_reasons = ["No XML-ready POST rows are currently available for this family and variant."]
        return self._blocked_assessment(
            operation_type="single_patch",
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=fallback_record.catalogue_number if fallback_record is not None else None,
            summary_message="PATCH is not currently available for the selected family and variant.",
            blocking_reasons=blocking_reasons,
            evidence={
                "catalogue_number": fallback_record.catalogue_number if fallback_record is not None else None,
                "reviewed_post_baseline_present": False,
                "tracked_registration_known": False,
            },
        )

    def assess_single_market_info(
        self,
        *,
        product_family: str,
        product_variant: str,
        catalogue_number: str | None = None,
    ) -> OperationAssessment:
        candidate_records, _, _ = self.xml_service._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        if catalogue_number:
            target_record = self._find_record(candidate_records, catalogue_number)
            if target_record is None:
                return self._blocked_assessment(
                    operation_type="single_market_info",
                    product_family=product_family,
                    product_variant=product_variant,
                    catalogue_number=catalogue_number,
                    summary_message="Market Info is not currently available for the selected device.",
                    blocking_reasons=[
                        "The selected catalogue number is not currently an XML-ready record for this family and variant."
                    ],
                    evidence={
                        "catalogue_number": catalogue_number,
                        "primary_udi_di": None,
                        "tracked_registration_known": False,
                        "current_market_info_version": None,
                        "current_market_country_count": 0,
                        "accepted_state_source": None,
                    },
                )
            return self._assess_single_market_info_record(target_record)

        blocked_reasons: list[str] = []
        fallback_record: CanonicalValidationRecord | None = None
        for record in candidate_records:
            assessment = self._assess_single_market_info_record(record)
            if assessment.status == "available":
                return assessment
            blocked_reasons.extend(assessment.blocking_reasons)
            if fallback_record is None:
                fallback_record = record

        blocking_reasons = self._deduplicated_reasons(blocked_reasons)
        if not candidate_records:
            blocking_reasons = ["No XML-ready POST rows are currently available for this family and variant."]
        return self._blocked_assessment(
            operation_type="single_market_info",
            product_family=product_family,
            product_variant=product_variant,
            catalogue_number=fallback_record.catalogue_number if fallback_record is not None else None,
            summary_message="Market Info is not currently available for the selected family and variant.",
            blocking_reasons=blocking_reasons,
            evidence={
                "catalogue_number": fallback_record.catalogue_number if fallback_record is not None else None,
                "primary_udi_di": fallback_record.primary_udi_di if fallback_record is not None else None,
                "tracked_registration_known": False,
                "current_market_info_version": None,
                "current_market_country_count": 0,
                "accepted_state_source": None,
            },
        )

    def assess_bulk_post(
        self,
        *,
        product_family: str,
        product_variant: str,
    ) -> OperationAssessment:
        candidate_records, variant_excluded_records, _ = self.xml_service._variant_post_records_with_exclusions(
            product_family=product_family,
            product_variant=product_variant,
            record_count=None,
        )
        parent_records, _, eligible_parent_group_count = self.xml_service._deduplicate_bulk_basic_udi_posts(
            product_family=product_family,
            product_variant=product_variant,
            records=list(candidate_records),
            excluded_records=[],
        )
        child_records, _, eligible_child_record_count = self.xml_service._bulk_udidi_post_candidates(
            product_family=product_family,
            product_variant=product_variant,
            records=list(candidate_records),
            excluded_records=[],
        )
        posted_parent_groups = self.testing_state_store.posted_parent_groups(
            product_family=product_family,
            product_variant=product_variant,
        )
        available_basic_udi_di_groups = sorted(
            {
                basic_udi_di
                for basic_udi_di in [
                    *[self.xml_service._bulk_record_summary(record).basic_udi_di for record in parent_records],
                    *[self.xml_service._bulk_record_summary(record).basic_udi_di for record in child_records],
                ]
                if basic_udi_di
            }
        )
        unposted_parent_group_count = eligible_parent_group_count
        status = "available" if eligible_parent_group_count > 0 or eligible_child_record_count > 0 else "blocked"
        blocking_reasons: list[str] = []
        if status == "blocked":
            if not candidate_records:
                blocking_reasons.append("No XML-ready POST rows are currently available for this family and variant.")
            if posted_parent_groups:
                blocking_reasons.append("Tracked Basic UDI-DI registrations exist, but no Device UDI-DI POST rows are currently eligible.")
            if not posted_parent_groups and not candidate_records:
                blocking_reasons.append("No parent Basic UDI-DI seed rows are currently eligible for bulk POST.")
            if variant_excluded_records:
                blocking_reasons.extend(self._summarize_excluded_reasons(variant_excluded_records))
            blocking_reasons = self._deduplicated_reasons(blocking_reasons)

        if status == "available":
            if eligible_parent_group_count > 0 and eligible_child_record_count > 0:
                summary_message = (
                    f"Bulk POST is available. {eligible_parent_group_count} parent Basic UDI-DI groups and "
                    f"{eligible_child_record_count} Device UDI-DI records are currently eligible."
                )
                recommended_next_action = "Use Single POST for new parents or Bulk POST for children of registered parents."
            elif eligible_parent_group_count > 0:
                summary_message = (
                    f"Bulk POST is available. {eligible_parent_group_count} parent Basic UDI-DI groups can be posted now."
                )
                recommended_next_action = "Use Single POST to register each new Basic UDI-DI with its first device."
            else:
                summary_message = (
                    f"Bulk POST is available. {eligible_child_record_count} Device UDI-DI records can be posted under already registered parents."
                )
                recommended_next_action = "Generate the child Bulk POST package for the eligible UDI-DI records."
        else:
            summary_message = "Bulk POST is not currently available for the selected family and variant."
            recommended_next_action = "Review XML readiness and tracked Playground registrations before retrying Bulk POST."

        return OperationAssessment(
            operation_type="bulk_post",
            status=status,
            summary_message=summary_message,
            blocking_reasons=blocking_reasons,
            recommended_next_action=recommended_next_action,
            eligible_record_count=max(eligible_parent_group_count, eligible_child_record_count),
            identity_scope=OperationAssessmentIdentityScope(
                product_family=product_family,
                product_variant=product_variant,
            ),
            evidence={
                "eligible_parent_group_count": eligible_parent_group_count,
                "eligible_child_record_count": eligible_child_record_count,
                "posted_parent_group_count": len(posted_parent_groups),
                "unposted_parent_group_count": unposted_parent_group_count,
                "available_basic_udi_di_groups": available_basic_udi_di_groups,
            },
        )

    def assess_bulk_patch(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str | None = None,
    ) -> OperationAssessment:
        parent_groups = self.testing_state_store.posted_parent_groups(
            product_family=product_family,
            product_variant=product_variant,
        )
        if not parent_groups:
            return self._blocked_assessment(
                operation_type="bulk_patch",
                product_family=product_family,
                product_variant=product_variant,
                summary_message="Bulk PATCH is not currently available for the selected family and variant.",
                blocking_reasons=[
                    "No Basic UDI-DI parent group currently has tracked posted child devices available for PATCH."
                ],
                evidence={
                    "eligible_parent_group_count": 0,
                    "selected_basic_udi_di": None,
                    "eligible_child_record_count": 0,
                    "latest_version_summary": [],
                    "available_parent_groups": [],
                },
            )

        if not basic_udi_di:
            return OperationAssessment(
                operation_type="bulk_patch",
                status="attention",
                summary_message=(
                    f"Bulk PATCH can proceed, but you must select one of the {len(parent_groups)} available Basic UDI-DI parent groups first."
                ),
                blocking_reasons=["Select a Basic UDI-DI parent group before generating Bulk PATCH XML."],
                recommended_next_action="Choose a Basic UDI-DI parent group, then select the PATCH scenario.",
                eligible_record_count=0,
                identity_scope=OperationAssessmentIdentityScope(
                    product_family=product_family,
                    product_variant=product_variant,
                ),
                evidence={
                    "eligible_parent_group_count": len(parent_groups),
                    "selected_basic_udi_di": None,
                    "eligible_child_record_count": 0,
                    "latest_version_summary": [],
                    "available_parent_groups": parent_groups,
                },
            )

        posted_entries = self.testing_state_store.posted_entries(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
        )
        try:
            selected_records, eligible_child_records, missing_variant_records = self.xml_service._bulk_patch_selected_records(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                record_count=max(len(posted_entries), 1),
            )
        except ValueError as exc:
            return self._blocked_assessment(
                operation_type="bulk_patch",
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                summary_message="Bulk PATCH is not currently available for the selected Basic UDI-DI parent.",
                blocking_reasons=[str(exc)],
                evidence={
                    "eligible_parent_group_count": len(parent_groups),
                    "selected_basic_udi_di": basic_udi_di,
                    "eligible_child_record_count": len(posted_entries),
                    "latest_version_summary": self._latest_version_summary(posted_entries),
                    "available_parent_groups": parent_groups,
                },
            )

        market_info_candidate_count = sum(
            1
            for record in selected_records
            if self.xml_service._bulk_patch_market_info_change_reason(record=record)
        )
        patch_ready_record_count = len(selected_records) - market_info_candidate_count
        status = "available"
        blocking_reasons: list[str] = []
        if missing_variant_records:
            status = "attention"
            blocking_reasons.append(
                f"{len(missing_variant_records)} tracked posted device(s) are not currently XML-ready and would be excluded from Bulk PATCH."
            )
        if market_info_candidate_count:
            status = "attention"
            blocking_reasons.append(
                f"{market_info_candidate_count} device(s) require Market Info handling and would be excluded from Bulk PATCH."
            )
        if patch_ready_record_count < 1:
            status = "blocked"
        summary_message = (
            f"Bulk PATCH is available for Basic UDI-DI {basic_udi_di}. "
            f"{patch_ready_record_count} device record(s) are currently ready for PATCH."
        )
        if status == "attention":
            summary_message = (
                f"Bulk PATCH is partially available for Basic UDI-DI {basic_udi_di}. "
                f"{patch_ready_record_count} device record(s) are ready, but some tracked posted devices require a separate workflow."
            )
        elif status == "blocked":
            summary_message = (
                f"Bulk PATCH is not currently available for Basic UDI-DI {basic_udi_di}. "
                "The selected device scope requires Market Info handling first."
            )

        return OperationAssessment(
            operation_type="bulk_patch",
            status=status,
            summary_message=summary_message,
            blocking_reasons=blocking_reasons,
            recommended_next_action="Choose the PATCH scenario and generate the Bulk PATCH package for the selected parent group.",
            eligible_record_count=patch_ready_record_count,
            identity_scope=OperationAssessmentIdentityScope(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
            ),
            evidence={
                "eligible_parent_group_count": len(parent_groups),
                "selected_basic_udi_di": basic_udi_di,
                "eligible_child_record_count": eligible_child_records,
                "market_info_candidate_count": market_info_candidate_count,
                "latest_version_summary": self._latest_version_summary(posted_entries),
                "available_parent_groups": parent_groups,
            },
        )

    def assess_bulk_market_info(
        self,
        *,
        product_family: str,
        product_variant: str,
        basic_udi_di: str | None = None,
    ) -> OperationAssessment:
        parent_groups = self.testing_state_store.posted_parent_groups(
            product_family=product_family,
            product_variant=product_variant,
        )
        if not parent_groups:
            return self._blocked_assessment(
                operation_type="bulk_market_info",
                product_family=product_family,
                product_variant=product_variant,
                summary_message="Bulk Market Info is not currently available for the selected family and variant.",
                blocking_reasons=[
                    "No Basic UDI-DI parent group currently has tracked posted child devices available for Market Info."
                ],
                evidence={
                    "eligible_parent_group_count": 0,
                    "selected_basic_udi_di": None,
                    "eligible_child_record_count": 0,
                    "market_info_ready_record_count": 0,
                    "current_market_info_version_summary": [],
                    "market_info_state_mismatch_count": 0,
                    "missing_variant_record_count": 0,
                    "available_parent_groups": [],
                },
            )

        if not basic_udi_di:
            return OperationAssessment(
                operation_type="bulk_market_info",
                status="attention",
                summary_message=(
                    f"Bulk Market Info can proceed, but you must select one of the {len(parent_groups)} available "
                    "Basic UDI-DI parent groups first."
                ),
                blocking_reasons=["Select a Basic UDI-DI parent group before generating Bulk Market Info XML."],
                recommended_next_action="Choose a Basic UDI-DI parent group, then review the shared market-country scenario.",
                eligible_record_count=0,
                identity_scope=OperationAssessmentIdentityScope(
                    product_family=product_family,
                    product_variant=product_variant,
                ),
                evidence={
                    "eligible_parent_group_count": len(parent_groups),
                    "selected_basic_udi_di": None,
                    "eligible_child_record_count": 0,
                    "market_info_ready_record_count": 0,
                    "current_market_info_version_summary": [],
                    "market_info_state_mismatch_count": 0,
                    "missing_variant_record_count": 0,
                    "available_parent_groups": parent_groups,
                },
            )

        posted_entries = self.testing_state_store.posted_entries(
            product_family=product_family,
            product_variant=product_variant,
            basic_udi_di=basic_udi_di,
        )
        try:
            selected_records, eligible_child_records, missing_variant_records = self.xml_service._bulk_patch_selected_records(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                record_count=max(len(posted_entries), 1),
                operation_label="bulk Market Info",
            )
        except ValueError as exc:
            return self._blocked_assessment(
                operation_type="bulk_market_info",
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
                summary_message="Bulk Market Info is not currently available for the selected Basic UDI-DI parent.",
                blocking_reasons=[str(exc)],
                evidence={
                    "eligible_parent_group_count": len(parent_groups),
                    "selected_basic_udi_di": basic_udi_di,
                    "eligible_child_record_count": len(posted_entries),
                    "market_info_ready_record_count": 0,
                    "current_market_info_version_summary": [],
                    "market_info_state_mismatch_count": 0,
                    "missing_variant_record_count": 0,
                    "available_parent_groups": parent_groups,
                },
            )

        ready_record_count = 0
        current_versions: set[str] = set()
        accepted_state_sources: set[str] = set()
        blocking_reasons: list[str] = []
        for record in selected_records:
            market_info_record, baseline_market_countries, current_version = self.xml_service._market_info_record_with_latest_state(
                record=record
            )
            ready_record_count += 1
            current_versions.add(current_version)
            accepted_state_sources.add(
                "sqlite_latest_successful_market_info"
                if baseline_market_countries != market_info_record.market_countries
                else "canonical_market_info_projection"
            )

        status = "available"
        if ready_record_count < 1:
            status = "blocked"
            if missing_variant_records:
                blocking_reasons.append(
                    f"{len(missing_variant_records)} tracked posted device(s) are not currently XML-ready and cannot be included."
                )
        elif missing_variant_records:
            status = "attention"
            if missing_variant_records:
                blocking_reasons.append(
                    f"{len(missing_variant_records)} tracked posted device(s) are not currently XML-ready and would be excluded from Bulk Market Info."
                )

        version_summary = self._sorted_versions(current_versions)
        if status == "available":
            summary_message = (
                f"Bulk Market Info is available for Basic UDI-DI {basic_udi_di}. "
                f"{ready_record_count} device record(s) are currently ready for one shared market-information update."
            )
        elif ready_record_count > 0:
            summary_message = (
                f"Bulk Market Info is partially available for Basic UDI-DI {basic_udi_di}. "
                f"{ready_record_count} device record(s) can be generated, but some selected devices would be excluded."
            )
        else:
            summary_message = "Bulk Market Info is not currently available for the selected Basic UDI-DI parent."

        return OperationAssessment(
            operation_type="bulk_market_info",
            status=status,
            summary_message=summary_message,
            blocking_reasons=blocking_reasons,
            recommended_next_action=(
                "Review the selected parent scope and generate the shared Bulk Market Info package."
                if status == "available"
                else "Align the selected cohort to one accepted market-country baseline before generating Bulk Market Info."
            ),
            eligible_record_count=ready_record_count,
            identity_scope=OperationAssessmentIdentityScope(
                product_family=product_family,
                product_variant=product_variant,
                basic_udi_di=basic_udi_di,
            ),
            evidence={
                "eligible_parent_group_count": len(parent_groups),
                "selected_basic_udi_di": basic_udi_di,
                "eligible_child_record_count": eligible_child_records,
                "market_info_ready_record_count": ready_record_count,
                "current_market_info_version_summary": version_summary,
                "market_info_state_mismatch_count": 0,
                "missing_variant_record_count": len(missing_variant_records),
                "accepted_state_sources": sorted(accepted_state_sources),
                "available_parent_groups": parent_groups,
            },
        )

    def _assess_single_post_record(self, record: CanonicalValidationRecord) -> OperationAssessment:
        basic_udi_di = self.xml_service._bulk_record_summary(record).basic_udi_di
        parent_registration_known = bool(
            basic_udi_di
            and self.testing_state_store.has_successful_basic_udi_post(
                product_family=record.product_family,
                product_variant=record.product_variant,
                basic_udi_di=basic_udi_di,
            )
        )
        child_registration_known = bool(
            record.primary_udi_di
            and self.testing_state_store.has_successful_primary_udi_post(
                product_family=record.product_family,
                product_variant=record.product_variant,
                primary_udi_di=record.primary_udi_di,
            )
        )
        xml_ready = record.xml_readiness.status == "complete"
        evidence = {
            "candidate_catalogue_number": record.catalogue_number,
            "candidate_primary_udi_di": record.primary_udi_di,
            "candidate_basic_udi_di": basic_udi_di,
            "parent_registration_known": parent_registration_known,
            "child_registration_known": child_registration_known,
            "xml_ready": xml_ready,
        }
        if not xml_ready:
            return self._blocked_assessment(
                operation_type="single_post",
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
                summary_message="POST is not currently available for the selected device.",
                blocking_reasons=["The selected device is not currently XML-ready."],
                evidence=evidence,
            )
        if child_registration_known:
            return self._blocked_assessment(
                operation_type="single_post",
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
                summary_message="POST is not currently available for the selected device.",
                blocking_reasons=[
                    "This Device UDI-DI already has a tracked successful registration, so a new POST should not be generated."
                ],
                evidence=evidence,
            )
        if parent_registration_known:
            summary_message = (
                f"POST is available for {record.catalogue_number}. The Basic UDI-DI is already registered, so this can proceed as a Device UDI-DI POST."
            )
            recommended_next_action = "Generate the single-device child POST XML for this catalogue number."
        else:
            summary_message = (
                f"POST is available for {record.catalogue_number}. This record can seed a new Basic UDI-DI parent registration."
            )
            recommended_next_action = "Generate the single-device POST XML and review it before submission."
        return OperationAssessment(
            operation_type="single_post",
            status="available",
            summary_message=summary_message,
            blocking_reasons=[],
            recommended_next_action=recommended_next_action,
            eligible_record_count=1,
            identity_scope=OperationAssessmentIdentityScope(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
            ),
            evidence=evidence,
        )

    def _assess_single_patch_record(self, record: CanonicalValidationRecord) -> OperationAssessment:
        basic_udi_di = self.xml_service._bulk_record_summary(record).basic_udi_di
        # Compatibility evidence: POST review history is not a prerequisite for drafting.
        reviewed_post_baseline_present = self.testing_state_store.has_reviewed_post(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=record.catalogue_number or "",
        )
        tracked_registration_known = bool(
            record.primary_udi_di
            and self.testing_state_store.has_successful_primary_udi_post(
                product_family=record.product_family,
                product_variant=record.product_variant,
                primary_udi_di=record.primary_udi_di,
            )
        )
        patch_state_resolution = self.testing_state_store.latest_successful_patch_state(
            product_family=record.product_family,
            product_variant=record.product_variant,
            catalogue_number=record.catalogue_number or "",
        )
        latest_accepted_version = patch_state_resolution.state.version if patch_state_resolution else ("1" if tracked_registration_known else None)
        latest_successful_scenario_id = patch_state_resolution.scenario_id if patch_state_resolution else None
        market_info_change_reason = self.xml_service._bulk_patch_market_info_change_reason(record=record)
        evidence = {
            "catalogue_number": record.catalogue_number,
            "primary_udi_di": record.primary_udi_di,
            "basic_udi_di": basic_udi_di,
            "tracked_registration_known": tracked_registration_known,
            "latest_accepted_version": latest_accepted_version,
            "latest_successful_scenario_id": latest_successful_scenario_id,
            "reviewed_post_baseline_present": reviewed_post_baseline_present,
            "market_info_change_reason": market_info_change_reason,
        }
        blocking_reasons: list[str] = []
        if not tracked_registration_known:
            blocking_reasons.append(
                "This device does not yet have a tracked successful Playground registration, so PATCH cannot be generated."
            )
        if market_info_change_reason:
            blocking_reasons.append(market_info_change_reason)
        if blocking_reasons:
            return self._blocked_assessment(
                operation_type="single_patch",
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
                summary_message=(
                    "PATCH is not currently available for the selected device because Market Information requires a separate workflow."
                    if market_info_change_reason
                    else "PATCH is not currently available for the selected device."
                ),
                blocking_reasons=blocking_reasons,
                evidence=evidence,
            )

        summary_message = (
            f"PATCH is available for {record.catalogue_number}. "
            f"The next PATCH will build from tracked version {latest_accepted_version or '1'}."
        )
        return OperationAssessment(
            operation_type="single_patch",
            status="available",
            summary_message=summary_message,
            blocking_reasons=[],
            recommended_next_action="Choose the PATCH scenario and generate the single-device PATCH package.",
            eligible_record_count=1,
            identity_scope=OperationAssessmentIdentityScope(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
            ),
            evidence=evidence,
        )

    def _assess_single_market_info_record(self, record: CanonicalValidationRecord) -> OperationAssessment:
        tracked_registration_known = bool(
            record.primary_udi_di
            and self.testing_state_store.has_successful_primary_udi_post(
                product_family=record.product_family,
                product_variant=record.product_variant,
                primary_udi_di=record.primary_udi_di,
            )
        )
        evidence = {
            "catalogue_number": record.catalogue_number,
            "primary_udi_di": record.primary_udi_di,
            "tracked_registration_known": tracked_registration_known,
            "current_market_info_version": None,
            "current_market_country_count": 0,
            "current_market_countries": [],
            "accepted_state_source": None,
        }
        if not tracked_registration_known:
            return self._blocked_assessment(
                operation_type="single_market_info",
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
                summary_message="Market Info is not currently available for the selected device.",
                blocking_reasons=[
                    "The selected device does not yet have a tracked successful Device UDI-DI registration available for Market Info."
                ],
                evidence=evidence,
            )

        market_info_record, baseline_market_countries, current_version = self.xml_service._market_info_record_with_latest_state(
            record=record
        )
        evidence["current_market_info_version"] = current_version
        evidence["current_market_country_count"] = len(market_info_record.market_countries)
        evidence["current_market_countries"] = [
            {
                "country": country_code,
                "original_placed_on_market": original_placed_on_market,
            }
            for country_code, original_placed_on_market in market_info_record.market_countries
        ]
        evidence["accepted_state_source"] = (
            "sqlite_latest_successful_market_info"
            if baseline_market_countries != market_info_record.market_countries
            else "canonical_market_info_projection"
        )

        return OperationAssessment(
            operation_type="single_market_info",
            status="available",
            summary_message=(
                f"Market Info is available for {record.catalogue_number}. "
                "This registered device can receive a standalone market-information update."
            ),
            blocking_reasons=[],
            recommended_next_action="Review the current market-country baseline, then generate the standalone Market Info update.",
            eligible_record_count=1,
            identity_scope=OperationAssessmentIdentityScope(
                product_family=record.product_family,
                product_variant=record.product_variant,
                catalogue_number=record.catalogue_number,
            ),
            evidence=evidence,
        )

    @staticmethod
    def _single_patch_priority_key(assessment: OperationAssessment) -> tuple[int, int, str]:
        version_text = assessment.evidence.get("latest_accepted_version")
        try:
            version_number = int(str(version_text).strip()) if version_text is not None else 999999
        except (TypeError, ValueError):
            version_number = 999999
        catalogue_number = str(assessment.evidence.get("catalogue_number") or "").strip()
        return (version_number, version_number, catalogue_number)

    @staticmethod
    def _find_record(records: list[CanonicalValidationRecord], catalogue_number: str) -> CanonicalValidationRecord | None:
        normalized_catalogue_number = catalogue_number.strip()
        for record in records:
            if (record.catalogue_number or "").strip() == normalized_catalogue_number:
                return record
        return None

    @staticmethod
    def _deduplicated_reasons(reasons: list[str]) -> list[str]:
        deduplicated: list[str] = []
        seen: set[str] = set()
        for reason in reasons:
            normalized = reason.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            deduplicated.append(normalized)
        return deduplicated

    @staticmethod
    def _summarize_excluded_reasons(excluded_records: Sequence[BulkXmlExcludedRecord]) -> list[str]:
        counter = Counter()
        for record in excluded_records:
            reason_message = record.reason_message
            if reason_message:
                counter[reason_message] += 1
        return [message for message, _count in counter.most_common(3)]

    @staticmethod
    def _latest_version_summary(entries: list[dict[str, object]]) -> list[str]:
        versions = {
            str(entry.get("latest_version") or "").strip()
            for entry in entries
            if str(entry.get("latest_version") or "").strip()
        }
        return OperationAssessmentService._sorted_versions(versions)

    @staticmethod
    def _sorted_versions(versions: set[str] | list[str]) -> list[str]:
        return sorted({str(version).strip() for version in versions if str(version).strip()}, key=lambda value: int(value) if value.isdigit() else value)

    @staticmethod
    def _blocked_assessment(
        *,
        operation_type: OperationAssessmentType,
        product_family: str,
        product_variant: str,
        summary_message: str,
        blocking_reasons: list[str],
        evidence: dict[str, object],
        catalogue_number: str | None = None,
        basic_udi_di: str | None = None,
    ) -> OperationAssessment:
        return OperationAssessment(
            operation_type=operation_type,
            status="blocked",
            summary_message=summary_message,
            blocking_reasons=blocking_reasons,
            recommended_next_action=None,
            eligible_record_count=0,
            identity_scope=OperationAssessmentIdentityScope(
                product_family=product_family,
                product_variant=product_variant,
                catalogue_number=catalogue_number,
                basic_udi_di=basic_udi_di,
            ),
            evidence=evidence,
        )
