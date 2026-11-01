"""Minimal Dev import workflow and separately retained read-only reconciliation."""
import sqlite3
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ValidationError
from app.config import get_settings
from app.services.dev_batch_preparation import DevBatchPreparation
from app.services.source_batch_receipt import MAX_REQUEST_BYTES
from app.services.source_review_drafts import DraftRequest
from app.services.import_workflow import ImportWorkflow
from app.services.playground_reconciliation import PlaygroundReconciliation

router=APIRouter(prefix='/dev-input-batches',tags=['Dev import'])


def service():
    try:return DevBatchPreparation(get_settings())
    except PermissionError as exc:raise HTTPException(403,str(exc)) from exc
    except ValueError as exc:raise HTTPException(400,str(exc)) from exc


def execute(action):
    try:return action()
    except FileNotFoundError as exc:raise HTTPException(404,'Saved import or file not found') from exc
    except PermissionError as exc:raise HTTPException(403,str(exc)) from exc
    except sqlite3.Error as exc:raise HTTPException(409,'Dev database cannot be read; no import was completed') from exc
    except (ValueError,KeyError,TypeError,OSError) as exc:raise HTTPException(409,str(exc)) from exc


def workflow():return ImportWorkflow(service().settings)


class Revision(BaseModel):
    revision: str = Field(pattern=r'^[a-f0-9]{32}$')


class Confirmation(Revision):
    confirmed_by: str = Field(min_length=1,max_length=500)
    confirmed: bool


@router.get('/sessions')
def imports():return execute(lambda:workflow().list())


@router.get('/sessions/{identifier}')
def saved_import(identifier: str):return execute(lambda:workflow().get(identifier))


@router.put('/sessions/{identifier}')
async def save_import(identifier: str, request: Request):
    instance=workflow()  # Dev guard before reading any uploaded bytes.
    content=bytearray()
    async for chunk in request.stream():
        if len(content)+len(chunk)>MAX_REQUEST_BYTES:raise HTTPException(413,'Source upload exceeds 60 MB')
        content.extend(chunk)
    try:payload=DraftRequest.model_validate_json(content)
    except ValidationError as exc:
        raise HTTPException(422,'; '.join(str(e['msg']) for e in exc.errors(include_input=False))[:1200]) from exc
    return await run_in_threadpool(lambda:execute(lambda:instance.save(identifier,payload)))


@router.post('/sessions/{identifier}/review')
def review_import(identifier: str, request: Revision):
    return execute(lambda:workflow().review(identifier,request.revision))


@router.post('/sessions/{identifier}/workbook')
def create_workbook(identifier: str, request: Revision):
    return execute(lambda:workflow().prepare(identifier,request.revision))


@router.post('/sessions/{identifier}/import')
def import_batch(identifier: str, request: Confirmation):
    return execute(lambda:workflow().confirm(identifier,request.revision,request.confirmed_by,request.confirmed))


@router.get('/sessions/{identifier}/workbook')
def download_workbook(identifier: str):
    instance=workflow();session=execute(lambda:instance.get(identifier))
    if not session['workbook']:raise HTTPException(409,'Create the workbook first')
    _,path,_=execute(lambda:instance.batches.artifact(session['batch_id'],session['workbook']['artifact_id']))
    return FileResponse(path,filename=path.name,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@router.get('/sessions/{identifier}/findings')
def download_findings(identifier: str):
    import json
    from io import BytesIO
    from openpyxl import Workbook
    from fastapi.responses import Response
    instance=workflow()
    path,state=execute(lambda:instance.drafts._load(identifier))
    if not state.get('review_id'):raise HTTPException(409,'Review source data first')
    report=execute(lambda:json.loads(instance.drafts._safe(path/'reviews'/(state['review_id']+'.json')).read_text()))
    book=Workbook();sheet=book.active;sheet.title='Source findings'
    sheet.append(['Source','Issue','Severity','File','Worksheet','Row','Device UDI-DI','Basic UDI-DI','Details','Action'])
    for group in report['groups']:
        for record in group['records']:
            detail=record.get('detail') or json.dumps(record.get('fields',[]),ensure_ascii=False)
            sheet.append([str(value or '')[:32767] for value in (record.get('source',group['source']),group['title'],group['severity'],record.get('file'),record.get('sheet'),record.get('row'),record.get('identifier',record.get('udi_di')),record.get('basic_udi_di'),detail,group['action'])])
    for row in sheet:
        for cell in row:cell.data_type='s';cell.number_format='@'
    sheet.freeze_panes='A2';sheet.auto_filter.ref=sheet.dimensions
    data=BytesIO();book.save(data);book.close()
    return Response(data.getvalue(),media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="source-findings.xlsx"'})


# This is an independent, actively used reconciliation API, not an import action.
@router.post("/{batch_id}/baseline-assessment")
def assess_playground_baseline(batch_id: str):
    settings = service().settings  # Enforce Dev-only before any database access.
    return execute(lambda: PlaygroundReconciliation(settings).create_report(batch_id))


@router.get("/{batch_id}/baseline-assessment/{report_id}/{kind}")
def download_baseline_assessment(batch_id: str, report_id: str, kind: str):
    settings = service().settings
    path = execute(lambda: PlaygroundReconciliation(settings).artifact(batch_id, report_id, kind))
    return FileResponse(path, filename=path.name, media_type="application/json" if kind == "json" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
