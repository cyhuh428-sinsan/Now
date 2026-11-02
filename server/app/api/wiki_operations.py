from fastapi import APIRouter, Body, Depends, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.schemas.wiki import Ident
from app.schemas.wiki_operations import PrepareAny, CommitOperation, AbortOperation
from app.services import wiki_operations as service


class OperationRoute(APIRoute):
    def get_route_handler(self):
        handler=super().get_route_handler()
        async def checked(request):
            try:
                return await handler(request)
            except RequestValidationError:
                return JSONResponse({"detail":{"code":"invalid_request"}},status_code=422,
                                    headers={"Cache-Control":"no-store"})
        return checked


router=APIRouter(prefix="/api/v1/wiki-operations",tags=["wiki-operations"],route_class=OperationRoute,
                 dependencies=[Depends(require_client_api_access)])


@router.post("/prepare")
def prepare(body: PrepareAny = Body(), auth=Depends(access)):
    return service.prepare_operation(auth(body.owner_id),body)


@router.post("/{operation_id}/commit")
def commit(operation_id: Ident, body: CommitOperation, auth=Depends(access)):
    return service.commit_operation(auth(body.owner_id),operation_id,body)


@router.post("/{operation_id}/abort")
def abort(operation_id: Ident, body: AbortOperation, auth=Depends(access)):
    return service.abort_operation(auth(body.owner_id),operation_id,body)


@router.get("/{operation_id}")
def status(operation_id: Ident, owner_id: str=Query(min_length=1,max_length=80), auth=Depends(access)):
    return service.get_operation(auth(owner_id),owner_id,operation_id)
