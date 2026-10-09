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
    # Imported current snapshots provide the full baseline without inventing POST history.
    from app.services.accepted_evidence import imported_baseline
    baseline = imported_baseline(connection, int(subject['id']))
    if baseline is not None:
        return baseline
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
    state = (json_state(subject['latest_successful_patch_state_json'])
            or json_state(subject['latest_successful_state_json'])
            or accepted_post_state(connection, subject))
    versions = [subject[key] for key in ('latest_successful_version', 'latest_successful_patch_version')
                if key in subject.keys() and subject[key]]
    return state if all(state_matches_version(state, version) for version in versions) else None


def state_matches_version(state: dict[str, Any] | None, version: object) -> bool:
    """Historical payloads must not masquerade as a newer accepted version."""
    return state is not None and (not version or str(state.get('version')) == str(version))


def accepted_market_state(connection: sqlite3.Connection, subject: sqlite3.Row) -> dict[str, Any] | None:
    state = json_state(subject['latest_successful_market_info_state_json'])
    if state is not None:
        return state if state_matches_version(state, subject['latest_successful_market_info_version']) else None
    post = accepted_post_state(connection, subject)
    if post is not None and isinstance(post.get('market_countries'), list):
        state = {'version': '1', 'market_countries': post['market_countries']}
        return state if state_matches_version(state, subject['latest_successful_market_info_version']) else None
    return None
