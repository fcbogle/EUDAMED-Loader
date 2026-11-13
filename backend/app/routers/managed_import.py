"""Environment-bound Import Management; no import occurs without explicit confirmation."""
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
from typing import Literal

router=APIRouter(prefix='/input-batches',tags=['Import Management'])


def execute(action):
    try:return action()
    except FileNotFoundError as exc:raise HTTPException(404,'Saved import or file not found') from exc
    except PermissionError as exc:raise HTTPException(403,str(exc)) from exc
    except sqlite3.Error as exc:raise HTTPException(409,'The active database cannot be read; no import was completed') from exc
    except (ValueError,KeyError,TypeError,OSError) as exc:raise HTTPException(409,str(exc)) from exc


def workflow():return execute(lambda:ImportWorkflow(get_settings()))


class Revision(BaseModel):
    revision: str = Field(pattern=r'^[a-f0-9]{32}$')


class Confirmation(Revision):
    confirmed_by: str = Field(min_length=1,max_length=500)
    confirmed: bool
    target_environment: Literal["dev", "prod"]


@router.get('/sessions')
def imports():return execute(lambda:workflow().list())


@router.get('/sessions/{identifier}')
def saved_import(identifier: str):return execute(lambda:workflow().get(identifier))


@router.put('/sessions/{identifier}')
async def save_import(identifier: str, request: Request):
    instance=workflow()  # Validate target paths before reading uploaded bytes.
    maximum=instance.drafts.batches.max_total_bytes * 4 // 3 + 1024 * 1024
    content=bytearray()
    async for chunk in request.stream():
        if len(content)+len(chunk)>maximum:raise HTTPException(413,'Source upload exceeds the active environment limit')
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
    return execute(lambda:workflow().confirm(identifier,request.revision,request.confirmed_by,request.confirmed,request.target_environment))


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
    sheet.append(['Source','Issue','Severity','File','Worksheet','Row','Device UDI-DI','Basic UDI-DI','Details','Action','Family','Model'])
    for group in report['groups']:
        for record in group['records']:
            detail=record.get('detail') or ''
            if record.get('fields'):detail += ('\n' if detail else '') + json.dumps(record['fields'],ensure_ascii=False)
            sheet.append([str(value or '')[:32767] for value in (record.get('source',group['source']),group['title'],group['severity'],record.get('file'),record.get('sheet'),record.get('row'),record.get('identifier',record.get('udi_di')),record.get('basic_udi_di'),detail,group['action'],record.get('product_family'),record.get('product_variant'))])
    for row in sheet:
        for cell in row:cell.data_type='s';cell.number_format='@'
    sheet.freeze_panes='A2';sheet.auto_filter.ref=sheet.dimensions
    data=BytesIO();book.save(data);book.close()
    return Response(data.getvalue(),media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':'attachment; filename="source-findings.xlsx"'})
