from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.api.note_crypto import MetadataRoute, keys
from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.schemas.note_crypto import RepresentationKey
from app.schemas.note_protected_write import Quote, QuoteCommit, QuoteChunk, QuoteSeal, QuoteAction
from app.services import note_protected_write as service, note_crypto as prep, note_crypto_storage as storage

router = APIRouter(prefix="/api/v2/notes/protected-writes", tags=["protected-note-writes"], route_class=MetadataRoute,
                   dependencies=[Depends(require_client_api_access)])


def response(value):
    status = value.pop("http_status", 200)
    if "created" in value:
        status = 201 if value.pop("created") else 200
    return JSONResponse(value, status_code=status, headers={"Cache-Control": "no-store"})


@router.post("/quote")
def quote(body: Quote, auth=Depends(access)):
    return response(service.quote(auth(body.owner_id), body))


@router.get("/status")
def status(quote_id: UUID, args=Depends(keys)):
    return service.status(*args, str(quote_id))


@router.get("/manifest")
def manifest(quote_id: UUID, limit: int = Query(default=100, ge=1, le=500), cursor: str | None = Query(default=None, max_length=2048), args=Depends(keys)):
    return prep.manifest(*args, str(quote_id), limit, cursor, "protected_write")


@router.post("/renew")
def renew(body: QuoteAction, auth=Depends(access)):
    return response(service.action(auth(body.owner_id), body, "renew"))


@router.post("/abort")
def abort(body: QuoteAction, auth=Depends(access)):
    return response(service.action(auth(body.owner_id), body, "abort"))


def quote_ids(value):
    if "transition_id" in value:
        value["quote_id"] = value.pop("transition_id")
    return value


@router.put("/chunks")
def chunk(body: QuoteChunk, auth=Depends(access)):
    return quote_ids(storage.put_chunk(auth(body.owner_id), body, "protected_write"))


@router.post("/entries/seal")
def seal(body: QuoteSeal, auth=Depends(access)):
    return quote_ids(storage.seal(auth(body.owner_id), body, "protected_write"))


def key(kind, ident, slot):
    try:
        return RepresentationKey(kind=kind, id=ident, slot=slot).model_dump()
    except ValueError:
        storage.error("invalid_representation_key", 422)


@router.get("/staged")
def staged(quote_id: UUID, kind: str, representation_id: str, slot: str, source_etag: UUID, chunk_index: int = Query(ge=0), args=Depends(keys)):
    return storage.staged(*args, str(quote_id), key(kind, representation_id, slot), str(source_etag), chunk_index, "protected_write")


@router.get("/source")
def source(quote_id: UUID, kind: str, representation_id: str, slot: str,
           representation_etag: str = Query(pattern=r"^[0-9a-f]{64}$"), chunk_index: int = Query(ge=0), args=Depends(keys)):
    return service.source(*args, str(quote_id), key(kind, representation_id, slot), representation_etag, chunk_index)


@router.post("/commit")
def commit(body: QuoteCommit, auth=Depends(access)):
    return response(service.commit(auth(body.owner_id), body))
