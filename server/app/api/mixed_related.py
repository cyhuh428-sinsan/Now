from fastapi import APIRouter, Depends, Request

from app.api.note_mixed import MixedRoute, response, query
from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.schemas.mixed_related import Initial, Replan, LinkedCommit, Transcript
from app.schemas import note_mixed as wire
from app.services import note_mixed_operations as ops
from app.services import note_mixed_related as service

router = APIRouter(prefix="/api/v2/notes/mixed-analysis-writes", route_class=MixedRoute,
    dependencies=[Depends(require_client_api_access)])


@router.post("/prepare")
def prepare(body: Initial, auth=Depends(access)):
    return response(service.prepare(auth(body.owner_id), body))


@router.post("/replan")
def replan(body: Replan, auth=Depends(access)):
    return response(service.prepare(auth(body.owner_id), body, replan=True))


def transport(purpose):
    routes = APIRouter(route_class=MixedRoute)

    @routes.get("/status")
    def status(request: Request, auth=Depends(access)):
        b = query(request, wire.Operation)
        return response(service.status(auth(b.owner_id), b, purpose))

    @routes.get("/manifest")
    def manifest(request: Request, auth=Depends(access)):
        b = query(request, wire.WriteManifest)
        return response(ops.manifest(auth(b.owner_id), b, purpose))

    @routes.get("/source")
    def source(request: Request, auth=Depends(access)):
        b = query(request, wire.Source)
        return response(ops.source(auth(b.owner_id), b, purpose))

    @routes.get("/staged")
    def staged(request: Request, auth=Depends(access)):
        b = query(request, wire.Staged)
        return response(ops.staged(auth(b.owner_id), b, purpose))

    @routes.put("/chunks")
    def upload(body: wire.Upload, auth=Depends(access)):
        return response(ops.upload(auth(body.owner_id), body, purpose))

    @routes.post("/entries/seal")
    def seal(body: wire.Seal, auth=Depends(access)):
        return response(ops.seal(auth(body.owner_id), body, purpose))

    @routes.post("/renew")
    def renew(body: wire.Action, auth=Depends(access)):
        return response(ops.action(auth(body.owner_id), body, purpose, "renew"))

    @routes.post("/abort")
    def abort(body: wire.Action, auth=Depends(access)):
        return response(ops.action(auth(body.owner_id), body, purpose, "abort"))

    @routes.post("/commit")
    def commit(body: LinkedCommit, auth=Depends(access)):
        return response(service.commit(auth(body.owner_id), body, purpose))

    return routes


router.include_router(transport(service.MA))

transcript_router = APIRouter(prefix="/api/v2/notes/mixed-transcript-writes", route_class=MixedRoute,
    dependencies=[Depends(require_client_api_access)])


@transcript_router.post("/prepare")
def prepare_transcript(body: Transcript, auth=Depends(access)):
    return response(service.prepare_transcript(auth(body.owner_id), body))


transcript_router.include_router(transport(service.MT))
