from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.routing import APIRoute
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.schemas.note_crypto import PrepareTransition, TransitionAction
from app.services import note_crypto as service

class MetadataRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def limited(request):
            if request.method != "POST":
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
def prepare(body: PrepareTransition, auth=Depends(access)):
    value = service.prepare(auth(body.owner_id), body)
    created = value.pop("created")
    return JSONResponse(value, status_code=201 if created else 200)


@router.get("/status")
def status(transition_id: UUID | None = None, args=Depends(keys)):
    return service.status(*args, str(transition_id) if transition_id else None)


@router.get("/manifest")
def manifest(transition_id: UUID, limit: int = Query(default=100, ge=1, le=500),
             cursor: str | None = Query(default=None, max_length=2048), args=Depends(keys)):
    return service.manifest(*args, str(transition_id), limit, cursor)


@router.get("/source")
def source(transition_id: UUID, kind: Literal["note_body", "revision_snapshot", "revision_before", "inventory_snapshot",
           "offline_snapshot", "reserved_offline_snapshot"], representation_id: str = Query(max_length=120),
           slot: Literal["content", "after", "before", "current", "snapshot"] = Query(),
           source_etag: UUID = Query(), args=Depends(keys)):
    return service.source(*args, str(transition_id), {"kind": kind, "id": representation_id, "slot": slot}, str(source_etag))


@router.post("/renew")
def renew(body: TransitionAction, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "renew")


@router.post("/abort")
def abort(body: TransitionAction, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "abort")
