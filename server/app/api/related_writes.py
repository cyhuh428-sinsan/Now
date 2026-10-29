from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.note_crypto import MetadataRoute
from app.api.note_v2 import access
from app.api.note_protected_write import response, key
from app.core.security import require_client_api_access
from app.schemas.note_crypto import UploadChunk, SealEntry
from app.schemas.protected_analysis import Commit, WriteAction
from app.services import related_writes as service, note_crypto_storage as storage


def write_routes(purpose):
    router = APIRouter(route_class=MetadataRoute, dependencies=[Depends(require_client_api_access)])

    def args(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
        device_id: str = Query(min_length=1, max_length=120), server_instance_id: UUID = Query(), auth=Depends(access)):
        return auth(owner_id), owner_id, local_id, device_id, str(server_instance_id)

    @router.get("/status")
    def status(write_id: UUID, context=Depends(args)):
        return service.status(*context, str(write_id), purpose)

    @router.get("/manifest")
    def manifest(write_id: UUID, metadata_manifest_digest: str = Query(pattern=r"^[0-9a-f]{64}$"),
        limit: int = Query(default=100, ge=1, le=500), cursor: str | None = Query(default=None, max_length=4096), context=Depends(args)):
        return service.manifest(*context, str(write_id), purpose, metadata_manifest_digest, limit, cursor)

    @router.put("/chunks")
    def chunk(body: UploadChunk, auth=Depends(access)):
        return storage.put_chunk(auth(body.owner_id), body, purpose)

    @router.post("/entries/seal")
    def seal(body: SealEntry, auth=Depends(access)):
        return storage.seal(auth(body.owner_id), body, purpose)

    @router.get("/staged")
    def staged(write_id: UUID, kind: str, representation_id: str, slot: str, source_etag: UUID,
        metadata_manifest_digest: str = Query(pattern=r"^[0-9a-f]{64}$"), chunk_index: int = Query(ge=0), context=Depends(args)):
        db, owner, local, device, instance = context
        row = service.own(db, owner, local, device, instance, str(write_id), purpose, creator=True)
        if metadata_manifest_digest != row.manifest_digest:
            storage.error("manifest_changed")
        k = key(kind, representation_id, slot)
        result = storage.staged(db, owner, local, device, row.id, k, str(source_etag), chunk_index, purpose)
        c = service.fixed(row)
        result.update(metadata_context=service.metadata(row, c), metadata_manifest_digest=row.manifest_digest,
            slot_version=next(s["source_slot_version"] for s in c["slots"] if s["key"] == k))
        return result

    @router.post("/commit")
    def commit(body: Commit, auth=Depends(access)):
        return response(service.commit(auth(body.owner_id), body, purpose))

    @router.post("/renew")
    def renew(body: WriteAction, auth=Depends(access)):
        return service.action(auth(body.owner_id), body, purpose, "renew")

    @router.post("/abort")
    def abort(body: WriteAction, auth=Depends(access)):
        return service.action(auth(body.owner_id), body, purpose, "abort")

    return router
