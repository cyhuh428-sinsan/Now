from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.note_crypto import MetadataRoute, keys
from app.api.note_v2 import access
from app.api.note_protected_write import key, response
from app.core.security import require_client_api_access
from app.schemas.note_protected_import import PrepareImport, ImportAction, ImportChunk, ImportSeal
from app.services import note_protected_import as service, note_crypto_storage as storage

router = APIRouter(prefix="/api/v2/notes/protected-imports", tags=["protected-note-import"], route_class=MetadataRoute,
                   dependencies=[Depends(require_client_api_access)])


def import_ids(value):
    if "transition_id" in value:
        value["import_id"] = value.pop("transition_id")
    return value


@router.post("")
def prepare(body: PrepareImport, auth=Depends(access)):
    return response(service.prepare(auth(body.owner_id), body))


@router.get("/status")
def status(import_id: UUID, args=Depends(keys)):
    return service.status(*args, str(import_id))


@router.get("/manifest")
def manifest(import_id: UUID, limit: int = Query(default=100, ge=1, le=500),
             cursor: str | None = Query(default=None, max_length=2048), args=Depends(keys)):
    return service.manifest(*args, str(import_id), limit, cursor)


@router.post("/renew")
def renew(body: ImportAction, auth=Depends(access)):
    return response(service.action(auth(body.owner_id), body, "renew"))


@router.post("/abort")
def abort(body: ImportAction, auth=Depends(access)):
    return response(service.action(auth(body.owner_id), body, "abort"))


@router.put("/chunks")
def chunk(body: ImportChunk, auth=Depends(access)):
    return import_ids(storage.put_chunk(auth(body.owner_id), body, service.PURPOSE))


@router.post("/entries/seal")
def seal(body: ImportSeal, auth=Depends(access)):
    return import_ids(storage.seal(auth(body.owner_id), body, service.PURPOSE))


@router.get("/staged")
def staged(import_id: UUID, kind: str, representation_id: str, slot: str, source_etag: UUID,
           chunk_index: int = Query(ge=0), args=Depends(keys)):
    return storage.staged(*args, str(import_id), key(kind, representation_id, slot), str(source_etag), chunk_index, service.PURPOSE)


@router.get("/source")
def source(import_id: UUID, kind: str, representation_id: str, slot: str,
           representation_etag: str = Query(pattern=r"^[0-9a-f]{64}$"), chunk_index: int = Query(ge=0), args=Depends(keys)):
    return service.source(*args, str(import_id), key(kind, representation_id, slot), representation_etag, chunk_index)
