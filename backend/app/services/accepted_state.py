"""Accepted snapshots shared by read models and XML generation.

Generated drafts are usable only when linked to a successful acknowledgement.
Legacy partial snapshots remain readable; new snapshots retain the full device record.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any


def json_state(value: object) -> dict[str, Any] | None:
    try:
        parsed = json.loads(str(value)) if value else None
    except (ValueError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def accepted_post_state(connection: sqlite3.Connection, subject: sqlite3.Row) -> dict[str, Any] | None:
    state = json_state(subject['latest_successful_post_state_json'])
    if state is not None:
        return state
    # Compatibility with acknowledgements predating the accepted POST projection.
    row = connection.execute('''
        SELECT generated.state_after_json FROM testing_events success
        JOIN testing_events generated ON generated.subject_id = success.subject_id
          AND generated.message_type = success.message_type
          AND generated.status = 'GENERATED'
          AND generated.correlation_id = success.correlation_id
        WHERE success.subject_id = ? AND success.status = 'SUCCESS'
          AND success.message_type IN ('DEVICE.POST', 'UDI_DI.POST')
          AND generated.state_after_json IS NOT NULL
        ORDER BY success.event_index DESC,
          (COALESCE(generated.message_id, '') = COALESCE(success.message_id, '')) DESC,
          generated.event_index DESC LIMIT 1
    ''', (subject['id'],)).fetchone()
    return json_state(row['state_after_json']) if row else None


def accepted_device_state(connection: sqlite3.Connection, subject: sqlite3.Row) -> dict[str, Any] | None:
    return (json_state(subject['latest_successful_patch_state_json'])
            or json_state(subject['latest_successful_state_json'])
            or accepted_post_state(connection, subject))


def accepted_market_state(connection: sqlite3.Connection, subject: sqlite3.Row) -> dict[str, Any] | None:
    state = json_state(subject['latest_successful_market_info_state_json'])
    if state is not None:
        return state
    post = accepted_post_state(connection, subject)
    if post is not None and isinstance(post.get('market_countries'), list):
        return {'version': '1', 'market_countries': post['market_countries']}
    return None
