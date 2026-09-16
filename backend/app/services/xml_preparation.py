"""Request-local XML preparation; no artifacts survive an operation call."""
from dataclasses import dataclass
from functools import wraps
from typing import Any

from app.xml_models import BulkPostPreview, BulkUdidiPostPreview, BulkPatchPreview


@dataclass
class PreparedXmlBatch:
    preview: BulkPostPreview | BulkUdidiPostPreview | BulkPatchPreview
    members: list[tuple[str, bytes]]
    contexts: list[tuple[str, dict[str, Any]]]


def xml_operation(method):
    """Share canonical selection and one state transaction across nested calls."""
    @wraps(method)
    def wrapped(self, *args, **kwargs):
        with self.selector.request_scope(self.canonical_projection_service):
            # Projection recovery may write SQLite. Finish it before opening the
            # accepted-state snapshot, so it cannot contend with our own reader.
            self._validation_bundle()
            with self.testing_state_store.generation_scope(
                product_family=kwargs.get('product_family'), product_variant=kwargs.get('product_variant'),
            ):
                return method(self, *args, **kwargs)
    return wrapped
