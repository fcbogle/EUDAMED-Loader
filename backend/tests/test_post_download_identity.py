"""POST download identity guards run before registration lookup or packaging."""
from types import SimpleNamespace

import pytest

from app.services.xml_generation import XmlGenerationService


def download_with_identity(primary_udi_di, lookup):
    service = object.__new__(XmlGenerationService)
    record = SimpleNamespace(product_family="Synthetic", product_variant="Synthetic",
                             primary_udi_di=primary_udi_di)
    service.selector = SimpleNamespace(find_xml_ready_record=lambda **kwargs: record)
    service.testing_state_store = SimpleNamespace(has_successful_primary_udi_post=lookup)
    # Exercise the download body without request-scope initialisation or database access.
    return service.download_post_package.__wrapped__(service, product_family="Synthetic",
        product_variant="Synthetic", catalogue_number="SYN-1")


@pytest.mark.parametrize("identifier", [None, "", "   "])
def test_unresolved_udi_blocks_post_before_registration_lookup(identifier):
    def forbidden_lookup(**kwargs):
        pytest.fail("An unresolved identifier must not reach the registration lookup")
    with pytest.raises(ValueError, match="Device UDI-DI is required"):
        download_with_identity(identifier, forbidden_lookup)


def test_resolved_udi_preserves_leading_zeros_and_registered_post_block():
    seen = []
    def registered(**kwargs):
        seen.append(kwargs["primary_udi_di"])
        return True
    with pytest.raises(ValueError, match="already has registration evidence"):
        download_with_identity(" 05000000000001 ", registered)
    assert seen == ["05000000000001"]
