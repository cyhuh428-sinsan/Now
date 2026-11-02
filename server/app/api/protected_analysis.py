from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.note_crypto import MetadataRoute
from app.api.note_v2 import access
from app.api.note_protected_write import response
from app.core.security import require_client_api_access
from app.schemas.protected_analysis import Claim, Dispatch, ClaimAction, Settle, ResultPrepare, Replan, TranscriptPrepare
from app.services import protected_analysis as service
from app.services import related_writes as writes
from app.api.related_writes import write_routes

router = APIRouter(prefix="/api/v2/notes/protected-analysis", route_class=MetadataRoute,
    dependencies=[Depends(require_client_api_access)])


@router.post("/claims")
def claim(body: Claim, auth=Depends(access)):
    return response(service.claim(auth(body.owner_id), body))


@router.get("/claims/status")
def status(owner_id: str, local_id: str, device_id: str, server_instance_id: UUID, execution_id: UUID, auth=Depends(access)):
    return service.status(auth(owner_id), owner_id, local_id, device_id, str(server_instance_id), str(execution_id))


@router.post("/claims/dispatch")
def dispatch(body: Dispatch, auth=Depends(access)):
    return service.dispatch(auth(body.owner_id), body)


@router.post("/claims/renew")
def renew(body: ClaimAction, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "renew")


@router.post("/claims/abort")
def abort(body: ClaimAction, auth=Depends(access)):
    return service.action(auth(body.owner_id), body, "abort")


@router.post("/claims/settle")
def settle(body: Settle, auth=Depends(access)):
    return service.settle(auth(body.owner_id), body)


@router.post("/result-prepare")
def prepare(body: ResultPrepare, auth=Depends(access)):
    return response(writes.prepare_analysis(auth(body.owner_id), body))


@router.post("/replans")
def replan(body: Replan, auth=Depends(access)):
    return response(writes.prepare_analysis(auth(body.owner_id), body, replan=True))


router.include_router(write_routes(writes.ANALYSIS))

transcript_router = APIRouter(prefix="/api/v2/notes/protected-transcripts", route_class=MetadataRoute,
    dependencies=[Depends(require_client_api_access)])


@transcript_router.post("/prepare")
def transcript(body: TranscriptPrepare, auth=Depends(access)):
    return response(writes.prepare_transcript(auth(body.owner_id), body))


transcript_router.include_router(write_routes(writes.TRANSCRIPT))
