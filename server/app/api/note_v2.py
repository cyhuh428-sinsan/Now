from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.schemas.note_v2 import ImportBranches, PutNote, RestoreNote, RevisionRef
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
            auth=Depends(access)):
    return service.current(auth(owner_id), owner_id, local_id)


@router.get("/revisions")
def revisions(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
              limit: int = Query(default=50, ge=1, le=100), cursor: str | None = None, auth=Depends(access)):
    return service.list_revisions(auth(owner_id), owner_id, local_id, limit, cursor)


@router.get("/revision")
def revision(owner_id: str = Query(min_length=1, max_length=80), local_id: str = Query(max_length=120),
             revision_kind: Literal["note_revision", "offline_branch"] = Query(), revision_id: UUID = Query(), auth=Depends(access)):
    return service.read_revision(auth(owner_id), owner_id, local_id, RevisionRef(kind=revision_kind, id=str(revision_id)))


@router.put("/current")
def put(body: PutNote, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), body, "put")


@router.post("/restore")
def restore(body: RestoreNote, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), body, "restore")


@router.post("/revisions/import")
def import_branches(body: ImportBranches, auth=Depends(access)):
    return service.mutate(auth(body.owner_id), body, "import")
