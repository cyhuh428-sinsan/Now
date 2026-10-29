from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.note_crypto import MetadataRoute
from app.api.note_v2 import access
from app.api.note_protected_write import response
from app.core.security import require_client_api_access
from app.schemas.related_text import DrainPrepare, DrainAction
from app.models.note import AnalysisJob, Recording
from app.services import related_drain as drain, related_text as linked, note_crypto as prep

router = APIRouter(route_class=MetadataRoute, dependencies=[Depends(require_client_api_access)])


@router.post("/api/v2/notes/related-drains")
def prepare(body: DrainPrepare, auth=Depends(access)):
    return response(drain.prepare(auth(body.owner_id), body))


@router.get("/api/v2/notes/related-drains/status")
def status(owner_id: str, local_id: str, device_id: str, server_instance_id: UUID, drain_id: UUID, auth=Depends(access)):
    return drain.status(auth(owner_id), owner_id, local_id, device_id, str(drain_id), str(server_instance_id))


@router.post("/api/v2/notes/related-drains/renew")
def renew(body: DrainAction, auth=Depends(access)):
    return response(drain.action(auth(body.owner_id), body, "renew"))


@router.post("/api/v2/notes/related-drains/abort")
def abort(body: DrainAction, auth=Depends(access)):
    return response(drain.action(auth(body.owner_id), body, "abort"))


def typed_rows(db, owner, local, device, model, ident=None):
    prep.authenticate_actor(db, owner, device)
    statement = select(model).where(model.owner_id == owner, model.note_local_id == local).order_by(model.id)
    if ident is not None:
        statement = statement.where(model.id == ident)
    rows = list(db.scalars(statement))
    if ident is not None and not rows:
        linked.error("related_not_found", 404)
    slots = linked.slots(db, owner, local)
    from app.models.note_history import NoteHead
    head = db.get(NoteHead, (owner, local))
    protected = head is not None and head.crypto_epoch > 0
    descriptors = {}
    if protected:
        from app.services.note_crypto_storage import live_entries
        descriptors = {linked.canonical(d["key"]): d for d, raw in live_entries(db, owner, local)}
    result = []
    for row in rows:
        fields = {"id": row.id, "owner_id": owner, "note_local_id": local, "created_at": row.created_at,
                  "updated_at": row.updated_at, "locked": protected, "required_capability": "related_text_read_v1",
                  "slot_descriptors": []}
        if isinstance(row, AnalysisJob):
            fields.update(job_type=row.job_type, status=row.status, execution_mode="client_cipher" if protected else "server_plain")
        else:
            fields.update(file_name=row.file_name, content_type=row.content_type, local_id=row.local_id)
        for k, target, meta, raw in slots:
            if type(target) is not model or target.id != row.id:
                continue
            fields["slot_descriptors"].append(descriptors[linked.canonical(k)] if protected else {
                "key": k, "representation_kind": meta.representation_kind, "representation_epoch": 0,
                "slot_version": meta.slot_version, "is_null": meta.is_null})
        result.append(fields)
    return {"schema_version": 2, "items": result, "protected_analysis_execution_v1": False, "full_protection_complete": False}


@router.get("/api/v2/analysis/jobs")
def jobs(owner_id: str, local_id: str, device_id: str, representation_schema: int = Query(ge=2, le=2), auth=Depends(access)):
    return typed_rows(auth(owner_id), owner_id, local_id, device_id, AnalysisJob)


@router.get("/api/v2/analysis/jobs/{job_id}")
def job(job_id: int, owner_id: str, local_id: str, device_id: str, representation_schema: int = Query(ge=2, le=2), auth=Depends(access)):
    return typed_rows(auth(owner_id), owner_id, local_id, device_id, AnalysisJob, job_id)


@router.get("/api/v2/recordings")
def recordings(owner_id: str, local_id: str, device_id: str, representation_schema: int = Query(ge=2, le=2), auth=Depends(access)):
    return typed_rows(auth(owner_id), owner_id, local_id, device_id, Recording)
