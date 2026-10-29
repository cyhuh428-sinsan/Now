from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from fastapi.routing import APIRoute
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.schemas.note_crypto import PrepareTransition, TransitionAction, UploadChunk, SealEntry, CommitTransition, RepresentationKey
from app.services import note_crypto as service
from app.services import note_crypto_storage as storage
from app.schemas.related_text import PrepareRelated, CommitRelated

class MetadataRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def limited(request):
            if request.method not in ("POST", "PUT"):
                return await handler(request)
            chunks, size = [], 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 1024 * 1024:
                    return JSONResponse({"detail": {"code": "metadata_request_too_large"}}, status_code=413,
                                        headers={"Cache-Control": "no-store"})
                chunks.append(chunk)
            payload, delivered = b"".join(chunks), False

            async def receive():
                nonlocal delivered
                if delivered:
                    return await request.receive()
                delivered = True
                return {"type": "http.request", "body": payload, "more_body": False}
            return await handler(Request(request.scope, receive))
        return limited


router = APIRouter(prefix="/api/v2/notes/crypto-transitions", tags=["note-crypto-preparation"], route_class=MetadataRoute,
                   dependencies=[Depends(require_client_api_access)])


def keys(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
         device_id: str = Query(min_length=1, max_length=120), auth=Depends(access)):
    return auth(owner_id), owner_id, local_id, device_id


@router.post("")
def prepare(body: Annotated[PrepareTransition | PrepareRelated, Body(discriminator="schema_version")], auth=Depends(access)):
    value = service.prepare(auth(body.owner_id), body)
    created = value.pop("created")
    return JSONResponse(value, status_code=201 if created else 200)


@router.get("/status")
def status(transition_id: UUID | None = None, args=Depends(keys)):
    return service.status(*args, str(transition_id) if transition_id else None)


@router.get("/manifest")
def manifest(transition_id: UUID, limit: int = Query(default=100, ge=1, le=500),
             cursor: str | None = Query(default=None, max_length=4096), manifest_schema: int | None = Query(default=None, ge=2, le=2),
             metadata_manifest_digest: str | None = Query(default=None, pattern=r"^[0-9a-f]{64}$"), args=Depends(keys)):
    return service.manifest(*args, str(transition_id), limit, cursor, manifest_schema=manifest_schema, metadata_digest=metadata_manifest_digest)


@router.get("/source")
def source(transition_id: UUID, kind: str, representation_id: str = Query(max_length=120), slot: str = Query(),
           source_etag: UUID | None = None, source_schema: int | None = Query(default=None, ge=2, le=2),
           metadata_manifest_digest: str | None = Query(default=None, pattern=r"^[0-9a-f]{64}$"), args=Depends(keys)):
    try:
        key = RepresentationKey(kind=kind, id=representation_id, slot=slot).model_dump()
    except ValueError:
        storage.error("invalid_representation_key", 422)
    if source_schema is None and source_etag is None:
        storage.error("source_etag_required", 422)
    return service.source(*args, str(transition_id), key, str(source_etag) if source_etag else None, source_schema, metadata_manifest_digest)


@router.post("/renew")
def renew(body: TransitionAction, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "renew")


@router.post("/abort")
def abort(body: TransitionAction, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "abort")


@router.put("/chunks")
def upload_chunk(body: UploadChunk, auth=Depends(access)):
    return storage.put_chunk(auth(body.owner_id), body)


@router.post("/entries/seal")
def seal(body: SealEntry, auth=Depends(access)):
    return storage.seal(auth(body.owner_id), body)


@router.post("/commit")
def commit(body: Annotated[CommitTransition | CommitRelated, Body(discriminator="schema_version")], auth=Depends(access)):
    return storage.commit(auth(body.owner_id), body)


@router.get("/staged")
def staged(transition_id: UUID, kind: str, representation_id: str, slot: str, source_etag: UUID,
           chunk_index: int = Query(ge=0), read_schema: int | None = Query(default=None, ge=2, le=2),
           metadata_manifest_digest: str | None = Query(default=None, pattern=r"^[0-9a-f]{64}$"), args=Depends(keys)):
    try:
        key = RepresentationKey(kind=kind, id=representation_id, slot=slot)
    except ValueError:
        storage.error("invalid_representation_key", 422)
    return storage.staged(*args, str(transition_id), key.model_dump(), str(source_etag), chunk_index,
        read_schema=read_schema, metadata_digest=metadata_manifest_digest)
