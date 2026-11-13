"""Read-only model reconciliation from application data and retained Data Import extracts."""
import sqlite3

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from lxml import etree
from pydantic import ValidationError

from app.config import get_settings
from app.services.ra_reporting import StoredDeviceComparisonReport, ReportRequest
from app.services.retained_eudamed_extracts import RetainedEudamedExtracts

router = APIRouter(prefix='/reporting', tags=['Reporting'])


@router.get('/device-comparison/source')
def device_comparison_source(response: Response):
    response.headers['Cache-Control'] = 'no-store'
    try:
        settings = get_settings()
        StoredDeviceComparisonReport(settings)  # Environment/path guard before source access.
        return {'environment': settings.environment, **RetainedEudamedExtracts(settings).status()}
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(409, 'Retained Data Import extract storage cannot be read') from exc


@router.post('/device-comparison')
async def device_comparison(request: Request):
    try:
        service = StoredDeviceComparisonReport(get_settings())
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except (ValueError, OSError) as exc:
        raise HTTPException(409, 'Reporting storage cannot be read; no application data was changed') from exc
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > 16 * 1024:
            raise HTTPException(413, 'Report options exceed the request limit')
        content.extend(chunk)
    try:
        payload = ReportRequest.model_validate_json(content)
    except ValidationError as exc:
        raise HTTPException(422, 'Reporting accepts report options only. Manage EUDAMED extracts through Data Import.') from exc
    try:
        return await run_in_threadpool(service.generate, payload)
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    except (ValueError, KeyError, TypeError, etree.XMLSyntaxError) as exc:
        raise HTTPException(409, str(exc)) from exc
    except (sqlite3.Error, OSError) as exc:
        raise HTTPException(409, 'Extracts or database cannot be read; no application data was changed') from exc


@router.post('/submission-activity')
async def submission_activity(request: Request):
    from app.services.submission_activity_report import SubmissionActivityReport
    try:
        service = SubmissionActivityReport(get_settings())
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > 16 * 1024:
            raise HTTPException(413, 'Report options exceed the request limit')
        content.extend(chunk)
    try:
        payload = ReportRequest.model_validate_json(content)
    except ValidationError as exc:
        raise HTTPException(422, 'Select report options only') from exc
    try:
        return await run_in_threadpool(service.generate, payload.include_device_details)
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(409, str(exc)) from exc
    except (sqlite3.Error, OSError) as exc:
        raise HTTPException(409, 'Submission activity cannot be read; no application data was changed') from exc


@router.get('/submission-activity/responses/{event_id}')
def submission_response(event_id: int):
    from contextlib import closing
    from app.services.submission_activity_report import SubmissionActivityReport, OPERATIONS
    try:
        service = SubmissionActivityReport(get_settings())
    except PermissionError as exc:
        raise HTTPException(403, str(exc)) from exc
    try:
        with closing(sqlite3.connect(service.database.as_uri() + '?mode=ro', uri=True)) as c:
            row = c.execute("SELECT message_type,raw_xml FROM testing_events WHERE id=? AND status IN ('SUCCESS','ERROR')", (event_id,)).fetchone()
        if not row or row[0] not in OPERATIONS or not row[1]:
            raise HTTPException(404, 'Retained response XML is unavailable')
        return Response(row[1].encode('utf-8'), media_type='application/xml', headers={
            'Content-Disposition': f'attachment; filename="retained-response-{event_id}.xml"', 'Cache-Control':'no-store'})
    except sqlite3.Error as exc:
        raise HTTPException(409, 'Retained response cannot be read') from exc
