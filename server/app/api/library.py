from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.library import LibraryResource
from app.schemas.library import Mutation, ResourceWrite
from app.services.library import library_user, mutate, resource_payload


def resource_router(kind: str) -> APIRouter:
    routes = APIRouter(prefix=f"/api/v1/{kind}", tags=[kind],
                       dependencies=[Depends(require_client_api_access)])

    @routes.get("")
    def list_resources(owner_id: str = Query(max_length=80), include_deleted: bool = False,
                       user_token: str | None = Header(None, alias="X-Now-User-Token"),
                       web_token: str | None = Header(None, alias="X-Now-Web-Session"),
                       db: Session = Depends(get_db)):
        owner = library_user(db, owner_id, user_token, web_token)
        stmt = select(LibraryResource).where(LibraryResource.owner_id == owner, LibraryResource.kind == kind)
        if not include_deleted:
            stmt = stmt.where(LibraryResource.deleted_at.is_(None))
        rows = db.scalars(stmt.order_by(LibraryResource.id)).all()
        return {"status": "ok", "items": [resource_payload(row) for row in rows]}

    @routes.put("/{resource_id}")
    def put_resource(resource_id: UUID, body: ResourceWrite,
                     user_token: str | None = Header(None, alias="X-Now-User-Token"),
                     web_token: str | None = Header(None, alias="X-Now-Web-Session"),
                     db: Session = Depends(get_db)):
        owner = library_user(db, body.owner_id, user_token, web_token)
        return mutate(db, owner_id=owner, kind=kind, resource_id=str(resource_id), body=body)

    @routes.delete("/{resource_id}")
    def delete_resource(resource_id: UUID, body: Mutation,
                        user_token: str | None = Header(None, alias="X-Now-User-Token"),
                        web_token: str | None = Header(None, alias="X-Now-Web-Session"),
                        db: Session = Depends(get_db)):
        owner = library_user(db, body.owner_id, user_token, web_token)
        return mutate(db, owner_id=owner, kind=kind, resource_id=str(resource_id), body=body, deleting=True)

    return routes


router = APIRouter()
router.include_router(resource_router("templates"))
router.include_router(resource_router("saved-queries"))
