from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request as StreamRequest
import json
from pydantic import ValidationError

from app.api.note_v2 import access
from app.core.security import require_client_api_access
from app.services import note_mixed_read as read
from app.schemas import note_mixed as wire
from app.services.note_crypto_fence import error
from app.services import note_mixed_operations as ops
from app.services.note_crypto_storage import strict_object


class MixedRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()
        large_plain_commit = self.path.endswith(("/current-plain/commit", "/mixed-writes/commit", "/mixed-imports/commit"))

        async def invoke(request):
            try:
                return await handler(request)
            except RequestValidationError:
                return JSONResponse({"detail": {"code": "invalid_request", "required_schema_version": None}, "operation": None},
                    status_code=422, headers={"Cache-Control": "no-store"})
            except HTTPException as exc:
                detail = dict(exc.detail) if isinstance(exc.detail, dict) else {"code": str(exc.detail)}
                detail.setdefault("required_schema_version", None)
                return JSONResponse({"detail": detail, "operation": None}, status_code=exc.status_code,
                    headers={**(exc.headers or {}), "Cache-Control": "no-store"})

        async def checked(request):
            if request.method not in ("POST", "PUT"):
                return await invoke(request)
            chunks, size = [], 0
            async for chunk in request.stream():
                size += len(chunk)
                if not large_plain_commit and size > 1048576:
                    return JSONResponse({"detail": {"code": "metadata_request_too_large", "required_schema_version": None}, "operation": None}, status_code=413, headers={"Cache-Control": "no-store"})
                chunks.append(chunk)
            payload, delivered = b"".join(chunks), False
            try:
                json.loads(payload, object_pairs_hook=strict_object)
            except (ValueError, UnicodeError):
                return JSONResponse({"detail": {"code": "invalid_request", "required_schema_version": None}, "operation": None}, status_code=422, headers={"Cache-Control": "no-store"})

            async def receive():
                nonlocal delivered
                if delivered:
                    return await request.receive()
                delivered = True
                return {"type": "http.request", "body": payload, "more_body": False}
            return await invoke(StreamRequest(request.scope, receive))
        return checked

router = APIRouter(prefix="/api/v2/notes/mixed-representations", tags=["note-mixed"], route_class=MixedRoute, dependencies=[Depends(require_client_api_access)])
operations_router = APIRouter(prefix="/api/v2/notes", tags=["note-mixed-operations"], route_class=MixedRoute, dependencies=[Depends(require_client_api_access)])


def query(request, model):
    if len(request.query_params.multi_items()) != len(request.query_params):
        error("invalid_request", 422)
    values = dict(request.query_params)
    try:
        for field in ("schema_version", "limit", "chunk_index", "target_epoch", "child_level"):
            if field in values:
                if str(int(values[field])) != values[field]:
                    raise ValueError()
                values[field] = int(values[field])
        if "child_deleted" in values:
            if values["child_deleted"] not in ("true", "false"):
                raise ValueError()
            values["child_deleted"] = values["child_deleted"] == "true"
        return model.model_validate(values)
    except (ValidationError, ValueError):
        error("invalid_request", 422)


@operations_router.get("/protection-targets")
def protection_targets(request: Request, auth=Depends(access)):
    from app.services.protection_targets import list_targets
    b = query(request, wire.ProtectionTargetsQuery)
    return JSONResponse(list_targets(auth(b.owner_id), b), headers={"Cache-Control": "no-store"})


@router.get("/context")
def context(request: Request, auth=Depends(access)):
    b = query(request, wire.Access)
    return read.context(auth(b.owner_id), b.owner_id, b.local_id, b.device_id, b.server_instance_id)


@operations_router.get("/mixed-writes/parent-context")
def parent_context(request: Request, auth=Depends(access)):
    from app.services.note_mixed_write import parent_lookup as lookup
    b = query(request, wire.ParentQuery)
    return lookup(auth(b.owner_id), b)


@operations_router.post("/mixed-writes/quote")
def write_quote(body: wire.WriteQuote, auth=Depends(access)):
    from app.services.note_mixed_write import prepare
    return response(prepare(auth(body.owner_id), body))


@operations_router.post("/mixed-imports/prepare")
def import_prepare(body: wire.MixedImportPrepare, auth=Depends(access)):
    from app.services.note_mixed_import import prepare
    return response(prepare(auth(body.owner_id), body))


def semantic_purpose(request):
    return "mixed_offline_import" if "/mixed-imports/" in request.url.path else "mixed_note_write"


@operations_router.get("/mixed-imports/status")
@operations_router.get("/mixed-writes/status")
def write_status(request: Request, auth=Depends(access)):
    b = query(request, wire.Operation)
    return response(ops.status(auth(b.owner_id), b, semantic_purpose(request)))


@operations_router.get("/mixed-imports/manifest")
@operations_router.get("/mixed-writes/manifest")
def write_manifest(request: Request, auth=Depends(access)):
    b = query(request, wire.WriteManifest)
    return response(ops.manifest(auth(b.owner_id), b, semantic_purpose(request)))


@operations_router.get("/mixed-imports/source")
@operations_router.get("/mixed-writes/source")
def write_source(request: Request, auth=Depends(access)):
    b = query(request, wire.Source)
    return response(ops.source(auth(b.owner_id), b, semantic_purpose(request)))


@operations_router.get("/mixed-imports/staged")
@operations_router.get("/mixed-writes/staged")
def write_staged(request: Request, auth=Depends(access)):
    b = query(request, wire.Staged)
    return response(ops.staged(auth(b.owner_id), b, semantic_purpose(request)))


@operations_router.post("/mixed-imports/renew")
@operations_router.post("/mixed-writes/renew")
def write_renew(request: Request, body: wire.Action, auth=Depends(access)):
    return response(ops.action(auth(body.owner_id), body, semantic_purpose(request), "renew"))


@operations_router.post("/mixed-imports/abort")
@operations_router.post("/mixed-writes/abort")
def write_abort(request: Request, body: wire.Action, auth=Depends(access)):
    return response(ops.action(auth(body.owner_id), body, semantic_purpose(request), "abort"))


@operations_router.put("/mixed-imports/chunks")
@operations_router.put("/mixed-writes/chunks")
def write_upload(request: Request, body: wire.Upload, auth=Depends(access)):
    return response(ops.upload(auth(body.owner_id), body, semantic_purpose(request)))


@operations_router.post("/mixed-imports/entries/seal")
@operations_router.post("/mixed-writes/entries/seal")
def write_seal(request: Request, body: wire.Seal, auth=Depends(access)):
    return response(ops.seal(auth(body.owner_id), body, semantic_purpose(request)))


@operations_router.post("/mixed-writes/commit")
def write_commit(body: wire.WriteCommit, auth=Depends(access)):
    from app.services.note_mixed_write import commit
    return response(commit(auth(body.owner_id), body))


@operations_router.post("/mixed-imports/commit")
def import_commit(body: wire.MixedImportCommit, auth=Depends(access)):
    from app.services.note_mixed_import import commit
    return response(commit(auth(body.owner_id), body))


@router.get("/catalog")
def catalog(request: Request, auth=Depends(access)):
    b = query(request, wire.Page)
    return read.catalog(auth(b.owner_id), b)


@router.get("/metadata")
def metadata(request: Request, auth=Depends(access)):
    b = query(request, wire.Item)
    return read.item(auth(b.owner_id), b)


@router.get("/representation")
def representation(request: Request, auth=Depends(access)):
    b = query(request, wire.Chunk)
    return read.item(auth(b.owner_id), b, raw=True)


@router.get("/current")
def current(request: Request, auth=Depends(access)):
    b = query(request, wire.Read)
    return read.current(auth(b.owner_id), b)


@router.get("/revision")
def revision(request: Request, auth=Depends(access)):
    b = query(request, wire.Revision)
    return read.revision(auth(b.owner_id), b)


def response(value):
    created = value.pop("created", False)
    status = value.pop("http_status", 201 if created else 200)
    return JSONResponse(value, status_code=status)


@operations_router.post("/current-plain/quote")
def quote(body: wire.PlainQuote, auth=Depends(access)):
    return response(ops.prepare(auth(body.owner_id), body, ops.CP))


@operations_router.post("/mixed-conversions/prepare")
def prepare(body: wire.ConversionPrepare, auth=Depends(access)):
    return response(ops.prepare(auth(body.owner_id), body, ops.RC))


def purpose(request):
    return ops.CP if "/current-plain/" in request.url.path else ops.RC


@operations_router.get("/current-plain/status")
@operations_router.get("/mixed-conversions/status")
def status(request: Request, auth=Depends(access)):
    b = query(request, wire.Operation)
    return response(ops.status(auth(b.owner_id), b, purpose(request)))


@operations_router.post("/current-plain/renew")
@operations_router.post("/mixed-conversions/renew")
def renew(request: Request, body: wire.Action, auth=Depends(access)):
    return response(ops.action(auth(body.owner_id), body, purpose(request), "renew"))


@operations_router.post("/current-plain/abort")
@operations_router.post("/mixed-conversions/abort")
def abort(request: Request, body: wire.Action, auth=Depends(access)):
    return response(ops.action(auth(body.owner_id), body, purpose(request), "abort"))


@operations_router.get("/current-plain/manifest")
@operations_router.get("/mixed-conversions/manifest")
def manifest(request: Request, auth=Depends(access)):
    b = query(request, wire.Manifest)
    return response(ops.manifest(auth(b.owner_id), b, purpose(request)))


@operations_router.get("/current-plain/source")
@operations_router.get("/mixed-conversions/source")
def source(request: Request, auth=Depends(access)):
    b = query(request, wire.Source)
    return response(ops.source(auth(b.owner_id), b, purpose(request)))


@operations_router.put("/current-plain/chunks")
@operations_router.put("/mixed-conversions/chunks")
def upload(request: Request, body: wire.Upload, auth=Depends(access)):
    return response(ops.upload(auth(body.owner_id), body, purpose(request)))


@operations_router.post("/current-plain/entries/seal")
@operations_router.post("/mixed-conversions/entries/seal")
def seal(request: Request, body: wire.Seal, auth=Depends(access)):
    return response(ops.seal(auth(body.owner_id), body, purpose(request)))


@operations_router.get("/current-plain/staged")
@operations_router.get("/mixed-conversions/staged")
def staged(request: Request, auth=Depends(access)):
    b = query(request, wire.Staged)
    return response(ops.staged(auth(b.owner_id), b, purpose(request)))


@operations_router.post("/current-plain/commit")
def plain_commit(body: wire.PlainCommit, auth=Depends(access)):
    return response(ops.commit(auth(body.owner_id), body, ops.CP))


@operations_router.post("/mixed-conversions/commit")
def conversion_commit(body: wire.ConversionCommit, auth=Depends(access)):
    return response(ops.commit(auth(body.owner_id), body, ops.RC))
