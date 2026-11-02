from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, Query
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.schemas.note_v2 import ImportBranches, PutNote, RestoreNote, RevisionRef
from app.schemas.note_protected_import import ImportCommit
from app.services import note_v2 as service
from app.services.library import library_user

router = APIRouter(prefix="/api/v2/notes", tags=["note-history"], dependencies=[Depends(require_client_api_access)])


def access(db: Session = Depends(get_db), user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
           web_token: str | None = Header(default=None, alias="X-Now-Web-Session")):
    def authenticate(owner):
        actual = library_user(db, owner, user_token, web_token)
        if actual != owner:
            service.error("owner_mismatch", 403)
        return db
    return authenticate


@router.get("/current")
def current(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
            representation_schema: int | None = Query(default=None, ge=2, le=2), device_id: str | None = None,
            auth=Depends(access)):
    if representation_schema == 2:
        from app.services.note_crypto_storage import typed_current
        return typed_current(auth(owner_id), owner_id, local_id, device_id)
    return service.current(auth(owner_id), owner_id, local_id)


@router.get("/revisions")
def revisions(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
              limit: int = Query(default=50, ge=1, le=100), cursor: str | None = None, auth=Depends(access)):
    return service.list_revisions(auth(owner_id), owner_id, local_id, limit, cursor)


@router.get("/revision")
def revision(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
             revision_kind: Literal["note_revision", "offline_branch"] = Query(), revision_id: UUID = Query(),
             representation_schema: int | None = Query(default=None, ge=2, le=2), device_id: str | None = None, auth=Depends(access)):
    if representation_schema == 2:
        from app.services.note_crypto_storage import typed_revision
        return typed_revision(auth(owner_id), owner_id, local_id, device_id, RevisionRef(kind=revision_kind, id=str(revision_id)))
    return service.read_revision(auth(owner_id), owner_id, local_id, RevisionRef(kind=revision_kind, id=str(revision_id)))


def catalog_scope(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
                  device_id: str = Query(min_length=1, max_length=120), representation_schema: int = Query(ge=2, le=2),
                  server_instance_id: UUID | None = None, crypto_epoch: int | None = Query(default=None, ge=1),
                  head_version: int | None = Query(default=None, ge=0), head_revision_id: UUID | None = None,
                  history_generation: int | None = Query(default=None, ge=0), identity_state: str | None = None,
                  current_exists: bool | None = None, catalog_digest: str | None = Query(default=None, pattern=r"^[0-9a-f]{64}$"),
                  auth=Depends(access)):
    expected = None
    supplied = [server_instance_id, crypto_epoch, head_version, history_generation, catalog_digest]
    if any(value is not None for value in supplied):
        if not all(value is not None for value in supplied):
            service.error("incomplete_catalog_context", 422)
        expected = {"server_instance_id": str(server_instance_id), "crypto_epoch": crypto_epoch, "head_version": head_version,
                    "history_generation": history_generation, "catalog_digest": catalog_digest}
        if head_revision_id is not None:
            expected["head_revision_id"] = str(head_revision_id)
        if identity_state is not None:
            expected["identity_state"] = identity_state
        if current_exists is not None:
            expected["current_exists"] = current_exists
    return auth(owner_id), owner_id, local_id, device_id, expected


@router.get("/representations")
def representations(limit: int = Query(default=100, ge=1, le=500), cursor: str | None = Query(default=None, max_length=4096),
                    args=Depends(catalog_scope)):
    from app.services.note_crypto_storage import representations as read
    db, owner, local, device, expected = args
    return read(db, owner, local, device, limit, cursor, expected)


@router.get("/representation")
def representation(kind: str, representation_id: str, slot: str,
                   representation_etag: str = Query(pattern=r"^[0-9a-f]{64}$"), chunk_index: int = Query(ge=0), args=Depends(catalog_scope)):
    from app.schemas.note_crypto import RepresentationKey
    from app.services.note_crypto_storage import live_chunk
    db, owner, local, device, expected = args
    if expected is None:
        service.error("incomplete_catalog_context", 422)
    try:
        key = RepresentationKey(kind=kind, id=representation_id, slot=slot)
    except ValueError:
        service.error("invalid_representation_key", 422)
    return live_chunk(db, owner, local, device, key.model_dump(), representation_etag, chunk_index, expected)


@router.put("/current")
def put(body: PutNote, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), body, "put")


@router.post("/restore")
def restore(body: RestoreNote, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), body, "restore")


@router.post("/revisions/import")
def import_branches(body: Annotated[ImportBranches | ImportCommit, Body(discriminator="schema_version")], auth=Depends(access)):
    if isinstance(body, ImportCommit):
        from app.api.note_protected_write import response
        from app.services.note_protected_import import commit
        return response(commit(auth(body.owner_id), body))
    return service.mutate(auth(body.owner_id), body, "import")
