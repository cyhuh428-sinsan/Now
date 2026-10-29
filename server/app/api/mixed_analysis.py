from fastapi import APIRouter, Depends, Request

from app.api.note_mixed import MixedRoute, response, query
from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.schemas import mixed_analysis as wire
from app.services import mixed_analysis as service

router = APIRouter(prefix="/api/v2/notes/mixed-analysis-claims", route_class=MixedRoute,
    dependencies=[Depends(require_client_api_access)])


@router.post("")
def claim(body: wire.Claim, auth=Depends(access)):
    return response(service.claim(auth(body.owner_id), body))


@router.get("/status")
def status(request: Request, auth=Depends(access)):
    b = query(request, wire.Execution)
    return service.status(auth(b.owner_id), b)


@router.get("/source")
def source(request: Request, auth=Depends(access)):
    b = query(request, wire.Source)
    return service.source(auth(b.owner_id), b)


@router.post("/dispatch")
def dispatch(body: wire.Dispatch, auth=Depends(access)):
    return service.dispatch(auth(body.owner_id), body)


@router.post("/renew")
def renew(body: wire.Action, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "renew")


@router.post("/cancel")
def cancel(body: wire.Action, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "cancel")


@router.post("/settle")
def settle(body: wire.Settle, auth=Depends(access)):
    return service.settle(auth(body.owner_id), body)
