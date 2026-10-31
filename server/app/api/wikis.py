from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select

from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.models.library import LibraryResource
from app.schemas.note_v2 import PutNote, ImportBranches
from app.services.library import resource_payload
from app.services import wikis as service

router = APIRouter(prefix="/api/v1/wikis", tags=["wikis"],
                   dependencies=[Depends(require_client_api_access)])


@router.get("")
def listing(owner_id: str = Query(min_length=1, max_length=80), include_deleted: bool = False, auth=Depends(access)):
    db = auth(owner_id)
    stmt = select(LibraryResource).where(LibraryResource.owner_id == owner_id, LibraryResource.kind == "wikis")
    if not include_deleted:
        stmt = stmt.where(LibraryResource.deleted_at.is_(None))
    return {"status": "ok", "items": [resource_payload(row) for row in db.scalars(stmt.order_by(LibraryResource.id))]}


@router.get("/{wiki_id}")
def get(wiki_id: UUID, owner_id: str = Query(min_length=1, max_length=80), auth=Depends(access)):
    return service.get(auth(owner_id), owner_id, str(wiki_id))


@router.put("/{wiki_id}/current")
def current(wiki_id: UUID, body: PutNote, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), str(wiki_id), body, "put")


@router.post("/{wiki_id}/revisions/import")
def branches(wiki_id: UUID, body: ImportBranches, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), str(wiki_id), body, "import")
