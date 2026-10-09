"""Shared evidence predicates; imported baselines never count as upload successes."""
from __future__ import annotations

import sqlite3
from app.services.accepted_state import json_state


def imported_event_sql(alias: str = "event") -> str:
    return (f"({alias}.status = 'IMPORTED' AND {alias}.event_kind = 'BASELINE_IMPORT' "
            f"AND {alias}.message_type = 'PRODUCTION_EXPORT.SNAPSHOT' "
            f"AND {alias}.accepted_state_source = 'production_export' AND {alias}.state_after_json IS NOT NULL)")


def registration_event_sql(alias: str = "event", *, parent: bool = False) -> str:
    operations = "('DEVICE.POST')" if parent else "('DEVICE.POST', 'UDI_DI.POST', 'UDI_DI.PATCH')"
    return f"(({alias}.status = 'SUCCESS' AND {alias}.message_type IN {operations}) OR {imported_event_sql(alias)})"


def imported_baseline(connection: sqlite3.Connection, subject_id: int) -> dict | None:
    row = connection.execute(f"SELECT event.state_after_json FROM testing_events event WHERE event.subject_id=? AND {imported_event_sql()} ORDER BY event.id DESC LIMIT 1",(subject_id,)).fetchone()
    return json_state(row[0]) if row else None
