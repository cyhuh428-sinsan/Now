from datetime import datetime
from html import escape
from pathlib import Path
from secrets import compare_digest
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, select, text

from app.core.capabilities import public_server_readiness_checks
from app.core.config import get_settings
from app.db import SessionLocal
from app.models.note import AnalysisJob, MessengerAttachment, Note, Recording, ReleaseEvidenceRecord, SyncLog, UserAccount, UserDevice, UserGroup
from app.services.messenger_storage import (
    messenger_storage_state,
    messenger_storage_usage,
    resolve_messenger_attachment_path,
)
from app.services.open_source_release import open_source_release_summary
from app.services.play_release import play_release_summary
from app.services.public_route import public_route_ops_check, public_route_summary
from app.services.release_evidence import release_evidence_summary, release_evidence_template
from app.services.release_readiness import release_readiness_summary
from app.services.user_accounts import (
    ensure_user_group,
    ensure_user_groups,
    create_user_account,
    issue_user_access_token,
    update_user_account,
    update_user_group,
)
from app.services.user_devices import set_user_device_active

router = APIRouter(tags=["monitor"])
basic_security = HTTPBasic(auto_error=False)


def _admin_nav_html() -> str:
    groups = [
        ("운영", [
            ("/admin", "관리"),
            ("/monitor", "모니터"),
            ("/admin/ops", "점검"),
            ("/admin/users", "사용자"),
            ("/admin/groups", "그룹"),
            ("/admin/devices", "기기"),
            ("/admin/sync", "동기화"),
            ("/admin/export", "내보내기"),
        ]),
        ("자료", [
            ("/admin/notes", "메모"),
            ("/admin/recordings", "녹음"),
            ("/admin/analysis", "분석"),
        ]),
        ("준비", [
            ("/admin/public", "공용 서버"),
            ("/admin/release", "1차 준비"),
            ("/admin/evidence", "수동 증빙"),
            ("/admin/mobile", "모바일 점검"),
            ("/admin/play", "Play 등록"),
            ("/admin/open-source", "공개 준비"),
            ("/admin/help", "도움말"),
            ("/docs", "API"),
        ]),
    ]
    parts: list[str] = []
    for index, (label, links) in enumerate(groups):
        if index:
            parts.append('<span class="nav-break"></span>')
        parts.append(f'<span class="nav-label">{escape(label)}</span>')
        parts.extend(
            f'<a href="{escape(href, quote=True)}">{escape(text)}</a>'
            for href, text in links
        )
    return "\n".join(parts)


def _admin_nav_css() -> str:
    return """
    .nav {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      max-width: 820px;
      justify-content: flex-end;
    }
    .nav a {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }
    .nav-break {
      flex-basis: 100%;
      height: 0;
    }
    .nav-label {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
    }
    """


def _require_monitor_access(
    credentials: HTTPBasicCredentials | None = Depends(basic_security),
) -> None:
    settings = get_settings()
    expected = settings.api_token
    if not expected:
        return
    if credentials and compare_digest(credentials.password, expected):
        return
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="admin token required",
        headers={"WWW-Authenticate": 'Basic realm="NowNote Admin"'},
    )


@router.get("/admin", include_in_schema=False)
def admin(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_html())


@router.get("/admin/analysis", include_in_schema=False)
def admin_analysis(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_analysis_html(request))


@router.get("/admin/notes", include_in_schema=False)
def admin_notes(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_notes_html(request))


@router.get("/admin/recordings", include_in_schema=False)
def admin_recordings(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_recordings_html(request))


@router.get("/admin/devices", include_in_schema=False)
def admin_devices(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_devices_html(request))


@router.post("/admin/devices/status", include_in_schema=False)
def admin_device_status(
    owner_id: str = Form(),
    device_id: str = Form(),
    action: str = Form(),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    if action not in {"activate", "deactivate"}:
        return RedirectResponse(url="/admin/devices", status_code=status.HTTP_303_SEE_OTHER)
    with SessionLocal() as db:
        set_user_device_active(
            db,
            owner_id=owner_id,
            device_id=device_id,
            is_active=action == "activate",
        )
        db.commit()
    return RedirectResponse(url="/admin/devices", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/admin/users", include_in_schema=False)
def admin_users(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_users_html(request))


@router.get("/admin/users/new", include_in_schema=False)
def admin_user_new(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_user_form_html())


@router.post("/admin/users/new", include_in_schema=False)
def admin_user_create(
    owner_id: str = Form(),
    password: str = Form(default=""),
    email: str = Form(default=""),
    display_name: str = Form(default=""),
    timezone: str = Form(default="Asia/Seoul"),
    group_name: str = Form(default="사용자"),
    two_factor_enabled: str | None = Form(default=None),
    is_active: str | None = Form(default=None),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    with SessionLocal() as db:
        user = create_user_account(
            db,
            owner_id=owner_id,
            password=password,
            email=email,
            display_name=display_name,
            timezone=timezone,
            group_name=group_name,
            two_factor_enabled=two_factor_enabled == "on",
            is_active=is_active == "on",
        )
        if user is None:
            return RedirectResponse(url="/admin/users", status_code=status.HTTP_303_SEE_OTHER)
        db.commit()
    return RedirectResponse(url="/admin/users", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/admin/users/edit", include_in_schema=False)
def admin_user_edit(
    owner_id: str = Query(),
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_user_edit_html(owner_id))


@router.post("/admin/users/edit", include_in_schema=False)
def admin_user_update(
    owner_id: str = Form(),
    password: str = Form(default=""),
    email: str = Form(default=""),
    display_name: str = Form(default=""),
    timezone: str = Form(default="Asia/Seoul"),
    group_name: str = Form(default="사용자"),
    two_factor_enabled: str | None = Form(default=None),
    is_active: str | None = Form(default=None),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    with SessionLocal() as db:
        update_user_account(
            db,
            owner_id=owner_id,
            password=password,
            email=email,
            display_name=display_name,
            timezone=timezone,
            group_name=group_name,
            two_factor_enabled=two_factor_enabled == "on",
            is_active=is_active == "on",
        )
        db.commit()
    return RedirectResponse(url="/admin/users", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/admin/users/token", include_in_schema=False)
def admin_user_issue_token(
    owner_id: str = Form(),
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    with SessionLocal() as db:
        issued = issue_user_access_token(db, owner_id=owner_id)
        if issued is None:
            return HTMLResponse(_admin_user_token_html(owner_id, "", "사용자를 찾을 수 없습니다."))
        user, raw_token = issued
        db.commit()
        return HTMLResponse(_admin_user_token_html(user.owner_id, raw_token, ""))


@router.post("/admin/users/bulk", include_in_schema=False)
def admin_user_bulk_update(
    owner_ids: list[str] = Form(default=[]),
    action: str = Form(default=""),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    if action not in {"activate", "deactivate"} or not owner_ids:
        return RedirectResponse(url="/admin/users", status_code=status.HTTP_303_SEE_OTHER)
    next_active = 1 if action == "activate" else 0
    with SessionLocal() as db:
        users = list(db.scalars(select(UserAccount).where(UserAccount.owner_id.in_(owner_ids))).all())
        for user in users:
            user.is_active = next_active
        db.commit()
    return RedirectResponse(url="/admin/users", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/admin/groups", include_in_schema=False)
def admin_groups(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_groups_html())


@router.post("/admin/groups/new", include_in_schema=False)
def admin_group_create(
    name: str = Form(),
    description: str = Form(default=""),
    invite_code: str = Form(default=""),
    sort_order: int = Form(default=100),
    is_active: str | None = Form(default=None),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    with SessionLocal() as db:
        ensure_user_group(
            db,
            name,
            description=description,
            sort_order=sort_order,
            is_active=is_active == "on",
            invite_code=invite_code,
        )
        db.commit()
    return RedirectResponse(url="/admin/groups", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/admin/groups/edit", include_in_schema=False)
def admin_group_update(
    group_id: int = Form(),
    name: str = Form(),
    description: str = Form(default=""),
    invite_code: str = Form(default=""),
    sort_order: int = Form(default=100),
    is_active: str | None = Form(default=None),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    with SessionLocal() as db:
        update_user_group(
            db,
            group_id=group_id,
            name=name,
            description=description,
            sort_order=sort_order,
            is_active=is_active == "on",
            invite_code=invite_code,
        )
        db.commit()
    return RedirectResponse(url="/admin/groups", status_code=status.HTTP_303_SEE_OTHER)


@router.get("/admin/ops", include_in_schema=False)
def admin_ops(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_ops_html())


@router.get("/admin/sync", include_in_schema=False)
def admin_sync(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_sync_html(request))


@router.get("/admin/export", include_in_schema=False)
def admin_export(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_export_html())


@router.get("/admin/help", include_in_schema=False)
def admin_help(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_help_html())


@router.get("/admin/public", include_in_schema=False)
def admin_public(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_public_html())


@router.get("/admin/release", include_in_schema=False)
def admin_release(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_release_html(request))


@router.get("/admin/evidence", include_in_schema=False)
def admin_evidence(
    request: Request,
    _: None = Depends(_require_monitor_access),
) -> HTMLResponse:
    return HTMLResponse(_admin_evidence_html(request))


@router.post("/admin/evidence/records", include_in_schema=False)
def admin_evidence_record_create(
    evidence_key: str = Form(default=""),
    result: str = Form(default="재확인 필요"),
    checked_by: str = Form(default=""),
    evidence_location: str = Form(default=""),
    actual_note: str = Form(default=""),
    memo: str = Form(default=""),
    return_to: str = Form(default="/admin/evidence"),
    _: None = Depends(_require_monitor_access),
) -> RedirectResponse:
    parts = evidence_key.split("||", 2)
    if len(parts) != 3 or not parts[0].strip() or not parts[2].strip():
        return RedirectResponse(url=_evidence_return_url(return_to, "error=invalid"), status_code=status.HTTP_303_SEE_OTHER)
    with SessionLocal() as db:
        db.add(
            ReleaseEvidenceRecord(
                group_name=parts[0].strip(),
                section=parts[1].strip(),
                label=parts[2].strip(),
                result=result.strip() or "재확인 필요",
                checked_by=checked_by.strip(),
                evidence_location=evidence_location.strip(),
                actual_note=actual_note.strip(),
                memo=memo.strip(),
                checked_at=datetime.utcnow(),
            )
        )
        db.commit()
    return RedirectResponse(url=_evidence_return_url(return_to, "saved=1"), status_code=status.HTTP_303_SEE_OTHER)


@router.get("/admin/play", include_in_schema=False)
def admin_play(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_play_html())


@router.get("/admin/open-source", include_in_schema=False)
def admin_open_source(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_open_source_html())


@router.get("/admin/mobile", include_in_schema=False)
def admin_mobile(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_mobile_html())


@router.get("/admin/recovery", include_in_schema=False)
def admin_recovery(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_recovery_html())


@router.get("/admin/deploy", include_in_schema=False)
def admin_deploy(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_deploy_html())


@router.get("/monitor", response_class=HTMLResponse, include_in_schema=False)
def monitor(_: None = Depends(_require_monitor_access)) -> str:
    settings = get_settings()
    status = "ready"
    db_status = "ready"
    error_message = ""
    note_count = 0
    active_note_count = 0
    recording_count = 0
    analysis_count = 0
    latest_note_at = None
    job_status_counts: dict[str, int] = {}

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            note_count = db.scalar(select(func.count()).select_from(Note)) or 0
            active_note_count = (
                db.scalar(
                    select(func.count())
                    .select_from(Note)
                    .where(Note.deleted_at.is_(None))
                )
                or 0
            )
            recording_count = db.scalar(select(func.count()).select_from(Recording)) or 0
            analysis_count = db.scalar(select(func.count()).select_from(AnalysisJob)) or 0
            latest_note_at = db.scalar(select(func.max(Note.updated_at)))
            rows = db.execute(
                select(AnalysisJob.status, func.count())
                .group_by(AnalysisJob.status)
                .order_by(AnalysisJob.status)
            ).all()
            job_status_counts = {status_name: count for status_name, count in rows}
    except Exception as exc:
        status = "error"
        db_status = "error"
        error_message = str(exc)

    auth_required = _api_token_badge(settings.api_token)
    server_name = escape(settings.server_name)
    status_label = _status_label(status)
    db_status_label = _status_label(db_status)
    latest_note_label = _format_datetime(latest_note_at)
    job_rows = _job_rows(job_status_counts)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>NowNote 모니터</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --red: #dc2626;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }}
    {_admin_nav_css()}
    .grid {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      min-height: 120px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 30px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .ok {{ color: var(--green); }}
    .bad {{ color: var(--red); }}
    .warn {{ color: var(--amber); }}
    section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    .filter-form {{
      display: grid;
      grid-template-columns: repeat(3, minmax(150px, 1fr)) auto;
      gap: 8px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: #fafafa;
    }}
    .filter-form input,
    .filter-form select {{
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: var(--panel);
      color: var(--text);
      font-size: 13px;
    }}
    .filter-form button {{
      min-height: 36px;
      border: 1px solid var(--blue);
      border-radius: 8px;
      padding: 0 12px;
      background: var(--blue);
      color: #fff;
      font-weight: 750;
      cursor: pointer;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    .notice {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 14px;
      line-height: 1.6;
    }}
    @media (max-width: 800px) {{
      header {{ display: block; }}
      .badge {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    }}
    @media (max-width: 520px) {{
      main {{ padding: 22px 12px 36px; }}
      .grid {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>{server_name}</h1>
        <div class="sub">NowNote 서버 모니터링 · 30초마다 자동 새로고침</div>
      </div>
      <nav class="nav" aria-label="관리 메뉴">
        {_admin_nav_html()}
      </nav>
    </header>

    <div class="badge" style="margin-bottom:14px;">API 토큰: {auth_required}</div>

    <div class="grid">
      <div class="card">
        <div class="label">API 상태</div>
        <div class="value {'ok' if status == 'ready' else 'bad'}">{status_label}</div>
      </div>
      <div class="card">
        <div class="label">DB 상태</div>
        <div class="value {'ok' if db_status == 'ready' else 'bad'}">{db_status_label}</div>
      </div>
      <div class="card">
        <div class="label">활성 메모</div>
        <div class="value">{active_note_count}</div>
      </div>
      <div class="card">
        <div class="label">녹음 파일</div>
        <div class="value">{recording_count}</div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>저장 현황</span>
        <span class="sub">마지막 메모 변경: {latest_note_label}</span>
      </div>
      <table>
        <tr><th>항목</th><th>값</th></tr>
        <tr><td>전체 메모</td><td>{note_count}</td></tr>
        <tr><td>활성 메모</td><td>{active_note_count}</td></tr>
        <tr><td>삭제 표시 메모</td><td>{note_count - active_note_count}</td></tr>
        <tr><td>녹음 파일</td><td>{recording_count}</td></tr>
        <tr><td>분석 작업</td><td>{analysis_count}</td></tr>
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>분석 작업 상태</span>
        <span class="sub">worker 처리 큐</span>
      </div>
      <table>
        <tr><th>상태</th><th>개수</th></tr>
        {job_rows}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return "-"
    return value.strftime("%Y-%m-%d %H:%M:%S")


def _status_label(status: str) -> str:
    labels = {
        "ready": "정상",
        "error": "오류",
    }
    return labels.get(status, status)


def _api_token_badge(api_token: str | None) -> str:
    if not api_token:
        return "미사용"
    if api_token.startswith("change-this"):
        return "예시값"
    return "사용"


def _job_rows(counts: dict[str, int]) -> str:
    if not counts:
        return '<tr><td colspan="2">분석 작업이 없습니다.</td></tr>'
    return "\n".join(
        f"<tr><td>{escape(status)}</td><td>{count}</td></tr>"
        for status, count in counts.items()
    )


def _error_block(message: str) -> str:
    if not message:
        return ""
    return f'<div class="error">오류: {escape(message)}</div>'


def _admin_html() -> str:
    settings = get_settings()
    error_message = ""
    note_type_counts: dict[str, int] = {}
    recording_count = 0
    latest_recording_at = None
    recent_jobs: list[AnalysisJob] = []

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            note_rows = db.execute(
                select(Note.note_type, func.count())
                .where(Note.deleted_at.is_(None))
                .group_by(Note.note_type)
                .order_by(Note.note_type)
            ).all()
            note_type_counts = {note_type: count for note_type, count in note_rows}
            recording_count = db.scalar(select(func.count()).select_from(Recording)) or 0
            latest_recording_at = db.scalar(select(func.max(Recording.updated_at)))
            recent_jobs = list(
                db.scalars(
                    select(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(10)
                ).all()
            )
    except Exception as exc:
        error_message = str(exc)

    api_token_state = "설정됨" if settings.api_token else "미설정"
    api_token_class = "ok" if settings.api_token else "warn"
    llm_state = _llm_state(settings.llm_provider, settings.openai_api_key)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --red: #dc2626;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    {_admin_nav_css()}
    .grid {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }}
    .card, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    .card {{
      padding: 18px;
      min-height: 122px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .ok {{ color: var(--green); }}
    .bad {{ color: var(--red); }}
    .warn {{ color: var(--amber); }}
    section {{
      margin-top: 14px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .notice {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fde68a;
      border-radius: 8px;
      background: #fffbeb;
      color: #92400e;
      font-size: 14px;
    }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    @media (max-width: 800px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
    @media (max-width: 520px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>NowNote 관리</h1>
        <div class="sub">읽기 전용 관리 화면 · 운영 설정과 처리 현황 확인</div>
      </div>
      <nav class="nav" aria-label="관리 메뉴">
        <span class="nav-label">운영</span>
        <a href="/monitor">모니터</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/users">사용자</a>
        <a href="/admin/groups">그룹</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/export">내보내기</a>
        <span class="nav-break"></span>
        <span class="nav-label">자료</span>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/analysis">분석</a>
        <span class="nav-break"></span>
        <span class="nav-label">준비</span>
        <a href="/admin/public">공용 서버</a>
        <a href="/admin/release">1차 준비</a>
        <a href="/admin/evidence">수동 증빙</a>
        <a href="/admin/mobile">모바일 점검</a>
        <a href="/admin/play">Play 등록</a>
        <a href="/admin/open-source">공개 준비</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API</a>
      </nav>
    </header>

    <div class="grid">
      <div class="card">
        <div class="label">API 토큰</div>
        <div class="value {api_token_class}">{api_token_state}</div>
      </div>
      <div class="card">
        <div class="label">LLM 제공자</div>
        <div class="value">{escape(settings.llm_provider)}</div>
        <div class="sub">{llm_state}</div>
      </div>
      <div class="card">
        <div class="label">녹음 저장소</div>
        <div class="value">{recording_count}</div>
        <div class="sub">최근 변경: {_format_datetime(latest_recording_at)}</div>
      </div>
    </div>

    {_admin_notice(settings.api_token)}

    <section>
      <div class="section-head">
        <span>메모 타입별 저장 현황</span>
        <span class="sub">삭제 표시 메모 제외</span>
      </div>
      <table>
        <tr><th>메모 타입</th><th>개수</th></tr>
        {_note_type_rows(note_type_counts)}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>최근 분석 작업</span>
        <span class="sub">최근 10건</span>
      </div>
      <table>
        <tr><th>ID</th><th>상태</th><th>유형</th><th>메모</th><th>생성 시각</th></tr>
        {_recent_job_rows(recent_jobs)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _llm_state(provider: str, api_key: str | None) -> str:
    if provider == "local":
        return "외부 LLM 없이 로컬 기본 처리"
    if api_key:
        return "외부 LLM 연결 정보 있음"
    return "외부 LLM API Key 미설정"


def _admin_notice(api_token: str | None) -> str:
    if api_token and not api_token.startswith("change-this"):
        return ""
    return (
        '<div class="notice">'
        "현재 API 토큰이 없거나 예시값입니다. 공용 서버로 열기 전에는 "
        "NOW_API_TOKEN을 긴 랜덤 토큰으로 반드시 변경해야 합니다."
        "</div>"
    )


def _note_type_rows(counts: dict[str, int]) -> str:
    if not counts:
        return '<tr><td colspan="2">저장된 메모가 없습니다.</td></tr>'
    return "\n".join(
        f"<tr><td>{escape(note_type)}</td><td>{count}</td></tr>"
        for note_type, count in counts.items()
    )


def _recent_job_rows(jobs: list[AnalysisJob]) -> str:
    if not jobs:
        return '<tr><td colspan="5">분석 작업이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td>{job.id}</td>"
        f"<td>{escape(job.status)}</td>"
        f"<td>{escape(job.job_type)}</td>"
        f"<td>{escape(job.note_local_id or '-')}</td>"
        f"<td>{_format_datetime(job.created_at)}</td>"
        "</tr>"
        for job in jobs
    )


def _admin_analysis_html(request: Request) -> str:
    error_message = ""
    status_counts: dict[str, int] = {}
    job_type_counts: dict[str, int] = {}
    recent_jobs: list[AnalysisJob] = []
    query = request.query_params
    owner_filter = (query.get("owner_id") or "").strip()
    status_filter = query.get("status") or "all"
    job_type_filter = (query.get("job_type") or "").strip()
    export_query = _analysis_export_query(owner_filter, status_filter, job_type_filter)
    export_url = "/api/v1/admin/export/analysis-jobs"
    if export_query:
        export_url = f"{export_url}?{export_query}"

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            status_rows = db.execute(
                select(AnalysisJob.status, func.count())
                .group_by(AnalysisJob.status)
                .order_by(AnalysisJob.status)
            ).all()
            type_rows = db.execute(
                select(AnalysisJob.job_type, func.count())
                .group_by(AnalysisJob.job_type)
                .order_by(AnalysisJob.job_type)
            ).all()
            status_counts = {status_name: count for status_name, count in status_rows}
            job_type_counts = {job_type: count for job_type, count in type_rows}
            stmt = select(AnalysisJob)
            if owner_filter:
                stmt = stmt.where(AnalysisJob.owner_id == owner_filter)
            if status_filter != "all":
                stmt = stmt.where(AnalysisJob.status == status_filter)
            if job_type_filter:
                stmt = stmt.where(AnalysisJob.job_type == job_type_filter)
            recent_jobs = list(db.scalars(stmt.order_by(AnalysisJob.created_at.desc()).limit(50)).all())
    except Exception as exc:
        error_message = str(exc)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 분석 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --red: #dc2626;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }}
    section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .mono {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    .actions form {{
      margin: 0;
      display: inline-flex;
    }}
    .actions button {{
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      font-weight: 650;
      cursor: pointer;
    }}
    .status {{
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 9px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 700;
    }}
    .status-done {{ background: #dcfce7; color: #166534; }}
    .status-failed {{ background: #fee2e2; color: #991b1b; }}
    .status-running {{ background: #fef3c7; color: #92400e; }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      .filter-form {{ grid-template-columns: 1fr; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>분석 관리</h1>
        <div class="sub">분석 작업 큐와 최근 처리 결과 확인</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/deploy">배포</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API 문서</a>
      </nav>
    </header>

    <div class="grid">
      <section>
        <div class="section-head">
          <span>상태별 작업 수</span>
          <span class="sub">queue status</span>
        </div>
        <table>
          <tr><th>상태</th><th>개수</th></tr>
          {_analysis_count_rows(status_counts)}
        </table>
      </section>

      <section>
        <div class="section-head">
          <span>유형별 작업 수</span>
          <span class="sub">job type</span>
        </div>
        <table>
          <tr><th>유형</th><th>개수</th></tr>
          {_analysis_count_rows(job_type_counts)}
        </table>
      </section>
    </div>

    <section>
      <div class="section-head">
        <span>최근 분석 작업 상세</span>
        <a href="{escape(export_url, quote=True)}">현재 조건 JSON</a>
      </div>
      <form class="filter-form" method="get" action="/admin/analysis">
        <input type="text" name="owner_id" value="{escape(owner_filter, quote=True)}" placeholder="Owner ID">
        <select name="status">
          {_analysis_status_options(status_filter)}
        </select>
        <input type="text" name="job_type" value="{escape(job_type_filter, quote=True)}" placeholder="작업 유형">
        <button type="submit">필터 적용</button>
      </form>
      <table>
        <tr>
          <th>ID</th>
          <th>상태</th>
          <th>유형</th>
          <th>메모</th>
          <th>입력</th>
          <th>결과/오류</th>
          <th>수정 시각</th>
        </tr>
        {_analysis_job_detail_rows(recent_jobs)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _analysis_count_rows(counts: dict[str, int]) -> str:
    if not counts:
        return '<tr><td colspan="2">분석 작업이 없습니다.</td></tr>'
    return "\n".join(
        f"<tr><td>{escape(name)}</td><td>{count}</td></tr>"
        for name, count in counts.items()
    )


def _analysis_status_options(selected: str) -> str:
    options = [
        ("all", "상태 전체"),
        ("queued", "queued"),
        ("running", "running"),
        ("done", "done"),
        ("failed", "failed"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _analysis_export_query(owner_id: str, status_filter: str, job_type: str) -> str:
    params = {}
    if owner_id:
        params["owner_id"] = owner_id
    if status_filter != "all":
        params["status"] = status_filter
    if job_type:
        params["job_type"] = job_type
    return urlencode(params)


def _analysis_job_detail_rows(jobs: list[AnalysisJob]) -> str:
    if not jobs:
        return '<tr><td colspan="7">분석 작업이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td>{job.id}</td>"
        f"<td>{_status_badge(job.status)}</td>"
        f"<td>{escape(job.job_type)}</td>"
        f"<td>{escape(job.note_local_id or '-')}</td>"
        f"<td class=\"mono\">{_short_text(job.input_text)}</td>"
        f"<td class=\"mono\">{_job_output(job)}</td>"
        f"<td>{_format_datetime(job.updated_at)}</td>"
        "</tr>"
        for job in jobs
    )


def _status_badge(value: str) -> str:
    class_name = {
        "done": "status status-done",
        "failed": "status status-failed",
        "running": "status status-running",
    }.get(value, "status")
    return f'<span class="{class_name}">{escape(value)}</span>'


def _job_output(job: AnalysisJob) -> str:
    if job.error_message:
        return _short_text(job.error_message)
    return _short_text(job.result_json)


def _short_text(value: str | None, limit: int = 180) -> str:
    if not value:
        return "-"
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return escape(normalized)
    return escape(f"{normalized[:limit]}...")


def _admin_notes_html(request: Request) -> str:
    error_message = ""
    type_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    owner_counts: dict[str, int] = {}
    recent_notes: list[Note] = []
    query = request.query_params
    owner_filter = (query.get("owner_id") or "").strip()
    note_type_filter = (query.get("note_type") or "").strip()
    source_filter = (query.get("source") or "").strip()
    search = (query.get("q") or "").strip()
    include_deleted_filter = query.get("include_deleted") or "all"
    export_query = _note_export_query(
        owner_filter,
        note_type_filter,
        source_filter,
        search,
        include_deleted_filter,
    )
    export_url = "/api/v1/admin/export/notes"
    if export_query:
        export_url = f"{export_url}?{export_query}"

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            type_rows = db.execute(
                select(Note.note_type, func.count())
                .where(Note.deleted_at.is_(None))
                .group_by(Note.note_type)
                .order_by(Note.note_type)
            ).all()
            source_rows = db.execute(
                select(Note.source, func.count())
                .where(Note.deleted_at.is_(None))
                .group_by(Note.source)
                .order_by(Note.source)
            ).all()
            owner_rows = db.execute(
                select(Note.owner_id, func.count())
                .where(Note.deleted_at.is_(None))
                .group_by(Note.owner_id)
                .order_by(func.count().desc())
                .limit(20)
            ).all()
            type_counts = {_label_or_empty(name): count for name, count in type_rows}
            source_counts = {_label_or_empty(name): count for name, count in source_rows}
            owner_counts = {owner_id: count for owner_id, count in owner_rows}
            stmt = select(Note)
            if owner_filter:
                stmt = stmt.where(Note.owner_id == owner_filter)
            if note_type_filter:
                stmt = stmt.where(Note.note_type == note_type_filter)
            if source_filter:
                stmt = stmt.where(Note.source == source_filter)
            if search:
                pattern = f"%{search}%"
                stmt = stmt.where((Note.title.ilike(pattern)) | (Note.content.ilike(pattern)))
            if include_deleted_filter == "no":
                stmt = stmt.where(Note.deleted_at.is_(None))
            elif include_deleted_filter == "only":
                stmt = stmt.where(Note.deleted_at.is_not(None))
            recent_notes = list(
                db.scalars(stmt.order_by(Note.updated_at.desc()).limit(100)).all()
            )
    except Exception as exc:
        error_message = str(exc)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 메모 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --red: #dc2626;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }}
    .filter-form {{
      display: grid;
      grid-template-columns: repeat(5, minmax(130px, 1fr)) auto;
      gap: 8px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: #fafafa;
    }}
    .filter-form input,
    .filter-form select {{
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: #fff;
    }}
    .filter-form button {{
      min-height: 36px;
      border: 1px solid var(--blue);
      border-radius: 8px;
      padding: 0 12px;
      background: var(--blue);
      color: #fff;
      font-weight: 750;
      cursor: pointer;
    }}
    section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .mono {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    .pill {{
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 9px;
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 700;
    }}
    .pill-deleted {{ background: #fee2e2; color: #991b1b; }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: 1fr; }}
      .filter-form {{ grid-template-columns: 1fr 1fr; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
      .filter-form {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>메모 관리</h1>
        <div class="sub">서버에 동기화된 메모 흐름 확인</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/analysis">분석</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API 문서</a>
      </nav>
    </header>

    <div class="grid">
      <section>
        <div class="section-head">
          <span>타입별 메모</span>
          <span class="sub">active only</span>
        </div>
        <table>
          <tr><th>타입</th><th>개수</th></tr>
          {_note_group_rows(type_counts)}
        </table>
      </section>

      <section>
        <div class="section-head">
          <span>소스별 메모</span>
          <span class="sub">active only</span>
        </div>
        <table>
          <tr><th>소스</th><th>개수</th></tr>
          {_note_group_rows(source_counts)}
        </table>
      </section>

      <section>
        <div class="section-head">
          <span>사용자별 메모</span>
          <span class="sub">상위 20개</span>
        </div>
        <table>
          <tr><th>Owner</th><th>개수</th></tr>
          {_note_group_rows(owner_counts)}
        </table>
      </section>
    </div>

    <section>
      <div class="section-head">
        <span>최근 변경 메모</span>
        <span><a href="{escape(export_url, quote=True)}">현재 조건 JSON</a></span>
      </div>
      <form class="filter-form" method="get" action="/admin/notes">
        <input type="text" name="owner_id" value="{escape(owner_filter, quote=True)}" placeholder="Owner ID">
        <input type="text" name="note_type" value="{escape(note_type_filter, quote=True)}" placeholder="메모 타입">
        <input type="text" name="source" value="{escape(source_filter, quote=True)}" placeholder="소스">
        <input type="text" name="q" value="{escape(search, quote=True)}" placeholder="제목/내용 검색">
        <select name="include_deleted">
          {_note_include_deleted_options(include_deleted_filter)}
        </select>
        <button type="submit">필터 적용</button>
      </form>
      <table>
        <tr>
          <th>ID</th>
          <th>상태</th>
          <th>타입</th>
          <th>레벨</th>
          <th>제목</th>
          <th>내용</th>
          <th>Owner / Device</th>
          <th>수정 시각</th>
        </tr>
        {_admin_note_rows(recent_notes)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _label_or_empty(value: str | None) -> str:
    return value or "-"


def _note_group_rows(counts: dict[str, int]) -> str:
    if not counts:
        return '<tr><td colspan="2">저장된 메모가 없습니다.</td></tr>'
    return "\n".join(
        f"<tr><td>{escape(name)}</td><td>{count}</td></tr>"
        for name, count in counts.items()
    )


def _admin_note_rows(notes: list[Note]) -> str:
    if not notes:
        return '<tr><td colspan="8">저장된 메모가 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td>{note.id}</td>"
        f"<td>{_note_state_badge(note)}</td>"
        f"<td>{escape(note.note_type)}</td>"
        f"<td>{note.level}</td>"
        f"<td>{escape(note.title)}</td>"
        f"<td class=\"mono\">{_short_text(note.content, 140)}</td>"
        f"<td class=\"mono\">{escape(note.owner_id)} / {escape(note.device_id)}</td>"
        f"<td>{_format_datetime(note.updated_at)}</td>"
        "</tr>"
        for note in notes
    )


def _note_state_badge(note: Note) -> str:
    if note.deleted_at is None:
        return '<span class="pill">active</span>'
    return '<span class="pill pill-deleted">deleted</span>'


def _admin_recordings_html(request: Request) -> str:
    error_message = ""
    content_type_counts: dict[str, int] = {}
    owner_counts: dict[str, int] = {}
    recent_recordings: list[Recording] = []
    latest_recording_at = None
    recording_total = 0
    transcript_count = 0
    query = request.query_params
    owner_filter = (query.get("owner_id") or "").strip()
    device_filter = (query.get("device_id") or "").strip()
    transcript_filter = query.get("transcript") or "all"
    export_query = _recording_export_query(owner_filter, device_filter, transcript_filter)
    export_url = "/api/v1/admin/export/recordings"
    if export_query:
        export_url = f"{export_url}?{export_query}"
    orphan_export_url = "/api/v1/admin/export/recording-orphans"
    missing_export_url = "/api/v1/admin/export/recording-missing-files"

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            content_type_rows = db.execute(
                select(Recording.content_type, func.count())
                .group_by(Recording.content_type)
                .order_by(Recording.content_type)
            ).all()
            owner_rows = db.execute(
                select(Recording.owner_id, func.count())
                .group_by(Recording.owner_id)
                .order_by(func.count().desc())
                .limit(20)
            ).all()
            content_type_counts = {
                _label_or_empty(content_type): count
                for content_type, count in content_type_rows
            }
            owner_counts = {owner_id: count for owner_id, count in owner_rows}
            recording_total = db.scalar(select(func.count()).select_from(Recording)) or 0
            transcript_count = (
                db.scalar(
                    select(func.count())
                    .select_from(Recording)
                    .where(Recording.transcript.is_not(None))
                )
                or 0
            )
            latest_recording_at = db.scalar(select(func.max(Recording.updated_at)))
            stmt = select(Recording)
            if owner_filter:
                stmt = stmt.where(Recording.owner_id == owner_filter)
            if device_filter:
                stmt = stmt.where(Recording.device_id == device_filter)
            if transcript_filter == "with":
                stmt = stmt.where(Recording.transcript.is_not(None))
            elif transcript_filter == "without":
                stmt = stmt.where(Recording.transcript.is_(None))
            recent_recordings = list(
                db.scalars(
                    stmt.order_by(Recording.updated_at.desc()).limit(100)
                ).all()
            )
    except Exception as exc:
        error_message = str(exc)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 녹음 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }}
    .card, section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .card {{
      margin-top: 0;
      padding: 18px;
      min-height: 116px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .mono {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    .notice {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 14px;
      line-height: 1.6;
    }}
    .actions form {{
      margin: 0;
      display: inline-flex;
    }}
    .actions button {{
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--text);
      font-weight: 650;
      cursor: pointer;
    }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>녹음 관리</h1>
        <div class="sub">서버에 저장된 원본 음성 파일 흐름 확인</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/analysis">분석</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API 문서</a>
      </nav>
    </header>

    <div class="grid">
      <div class="card">
        <div class="label">전체 녹음 파일</div>
        <div class="value">{recording_total}</div>
      </div>
      <div class="card">
        <div class="label">텍스트 변환 포함</div>
        <div class="value">{transcript_count}</div>
      </div>
      <div class="card">
        <div class="label">최근 변경</div>
        <div class="value">{_format_datetime(latest_recording_at)}</div>
      </div>
    </div>

    <div class="notice">
      저장소에 파일은 있지만 DB 메타데이터와 연결되지 않은 항목은
      <a href="{orphan_export_url}">고아 녹음 파일 JSON</a>에서 확인합니다.
      DB 메타데이터는 있지만 저장소에서 찾을 수 없는 항목은
      <a href="{missing_export_url}">누락 녹음 파일 JSON</a>에서 확인합니다.
      실제 삭제는 백업 확인 후 수동으로 진행합니다.
    </div>

    <div class="grid">
      <section>
        <div class="section-head">
          <span>파일 타입별</span>
          <span class="sub">content type</span>
        </div>
        <table>
          <tr><th>타입</th><th>개수</th></tr>
          {_note_group_rows(content_type_counts)}
        </table>
      </section>

      <section>
        <div class="section-head">
          <span>사용자별</span>
          <span class="sub">상위 20개</span>
        </div>
        <table>
          <tr><th>Owner</th><th>개수</th></tr>
          {_note_group_rows(owner_counts)}
        </table>
      </section>
    </div>

    <section>
      <div class="section-head">
        <span>최근 녹음 파일</span>
        <a href="{escape(export_url, quote=True)}">현재 조건 JSON</a>
      </div>
      <form method="get" action="/admin/recordings" style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr)) auto;gap:8px;padding:14px 18px;border-bottom:1px solid var(--line);background:#fafafa;">
        <input type="text" name="owner_id" value="{escape(owner_filter, quote=True)}" placeholder="Owner ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
        <input type="text" name="device_id" value="{escape(device_filter, quote=True)}" placeholder="Device ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
        <select name="transcript" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
          {_recording_transcript_options(transcript_filter)}
        </select>
        <button type="submit" style="min-height:36px;border:1px solid var(--blue);border-radius:8px;padding:0 12px;background:var(--blue);color:#fff;font-weight:750;">필터 적용</button>
      </form>
      <table>
        <tr>
          <th>ID</th>
          <th>파일명</th>
          <th>타입</th>
          <th>연결 메모</th>
          <th>Transcript</th>
          <th>Owner / Device</th>
          <th>수정 시각</th>
        </tr>
        {_admin_recording_rows(recent_recordings)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _admin_recording_rows(recordings: list[Recording]) -> str:
    if not recordings:
        return '<tr><td colspan="7">저장된 녹음 파일이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td>{recording.id}</td>"
        f"<td class=\"mono\">{escape(recording.file_name)}</td>"
        f"<td>{escape(recording.content_type)}</td>"
        f"<td>{escape(recording.note_local_id or '-')}</td>"
        f"<td class=\"mono\">{_short_text(recording.transcript, 140)}</td>"
        f"<td class=\"mono\">{escape(recording.owner_id)} / {escape(recording.device_id)}</td>"
        f"<td>{_format_datetime(recording.updated_at)}</td>"
        "</tr>"
        for recording in recordings
    )


def _note_include_deleted_options(selected: str) -> str:
    options = [
        ("all", "삭제 포함"),
        ("no", "삭제 제외"),
        ("only", "삭제만"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _note_export_query(
    owner_id: str,
    note_type: str,
    source: str,
    search: str,
    include_deleted_filter: str,
) -> str:
    params = {}
    if owner_id:
        params["owner_id"] = owner_id
    if note_type:
        params["note_type"] = note_type
    if source:
        params["source"] = source
    if search:
        params["q"] = search
    if include_deleted_filter == "no":
        params["include_deleted"] = "false"
    elif include_deleted_filter == "only":
        params["include_deleted"] = "true"
        params["deleted"] = "only"
    return urlencode(params)


def _recording_transcript_options(selected: str) -> str:
    options = [
        ("all", "텍스트 전체"),
        ("with", "텍스트 있음"),
        ("without", "텍스트 없음"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _recording_export_query(owner_id: str, device_id: str, transcript_filter: str) -> str:
    params = {}
    if owner_id:
        params["owner_id"] = owner_id
    if device_id:
        params["device_id"] = device_id
    if transcript_filter in {"with", "without"}:
        params["transcript_status"] = transcript_filter
    return urlencode(params)


def _admin_devices_html(request: Request) -> str:
    error_message = ""
    devices: dict[tuple[str, str], dict[str, object]] = {}
    query = request.query_params
    owner_filter = (query.get("owner_id") or "").strip()
    device_filter = (query.get("device_id") or "").strip()
    status_filter = query.get("status") or "all"
    export_query = _device_export_query(owner_filter, device_filter, status_filter)
    export_url = "/api/v1/admin/export/devices"
    if export_query:
        export_url = f"{export_url}?{export_query}"

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            registered_rows = db.scalars(
                select(UserDevice).order_by(
                    UserDevice.last_seen_at.desc().nullslast(),
                    UserDevice.updated_at.desc(),
                    UserDevice.id.desc(),
                )
            ).all()
            note_rows = db.execute(
                select(
                    Note.owner_id,
                    Note.device_id,
                    func.count(),
                    func.max(Note.updated_at),
                    func.max(Note.client_updated_at),
                )
                .where(Note.deleted_at.is_(None))
                .group_by(Note.owner_id, Note.device_id)
                .order_by(func.max(Note.updated_at).desc())
            ).all()
            recording_rows = db.execute(
                select(
                    Recording.owner_id,
                    Recording.device_id,
                    func.count(),
                    func.max(Recording.updated_at),
                )
                .group_by(Recording.owner_id, Recording.device_id)
            ).all()
            for device in registered_rows:
                devices[(device.owner_id, device.device_id)] = {
                    "owner_id": device.owner_id,
                    "device_id": device.device_id,
                    "device_status": "사용" if device.is_active else "비활성",
                    "note_count": 0,
                    "recording_count": 0,
                    "first_seen_at": device.first_seen_at,
                    "last_seen_at": device.last_seen_at,
                    "latest_note_at": None,
                    "latest_client_at": None,
                    "latest_recording_at": None,
                }
            for owner_id, device_id, count, latest_at, client_latest_at in note_rows:
                key = (owner_id, device_id)
                if key not in devices:
                    devices[key] = {
                        "owner_id": owner_id,
                        "device_id": device_id,
                        "device_status": "흔적만 있음",
                        "note_count": 0,
                        "recording_count": 0,
                        "first_seen_at": None,
                        "last_seen_at": None,
                        "latest_note_at": None,
                        "latest_client_at": None,
                        "latest_recording_at": None,
                    }
                devices[key]["note_count"] = count
                devices[key]["latest_note_at"] = latest_at
                devices[key]["latest_client_at"] = client_latest_at
            for owner_id, device_id, count, latest_at in recording_rows:
                key = (owner_id, device_id)
                if key not in devices:
                    devices[key] = {
                        "owner_id": owner_id,
                        "device_id": device_id,
                        "device_status": "흔적만 있음",
                        "note_count": 0,
                        "recording_count": 0,
                        "first_seen_at": None,
                        "last_seen_at": None,
                        "latest_note_at": None,
                        "latest_client_at": None,
                        "latest_recording_at": None,
                    }
                devices[key]["recording_count"] = count
                devices[key]["latest_recording_at"] = latest_at
    except Exception as exc:
        error_message = str(exc)

    device_rows = sorted(
        devices.values(),
        key=lambda item: (
            item["last_seen_at"] or item["latest_note_at"] or item["latest_recording_at"] or datetime.min
        ),
        reverse=True,
    )
    device_rows = _filter_device_rows(device_rows, owner_filter, device_filter, status_filter)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 기기 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .mono {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>기기 관리</h1>
        <div class="sub">서버에 연결된 owner/device별 동기화 흔적 확인</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/users">사용자</a>
        <a href="/admin/analysis">분석</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API 문서</a>
      </nav>
    </header>

    <div class="notice">
      이 화면은 owner/device별 사용 흔적과 기기 활성 상태를 확인합니다.
      비활성 기기는 동기화, 메모 저장, 녹음 업로드가 차단됩니다.
    </div>

    <section>
      <div class="section-head">
        <span>기기별 동기화 현황</span>
        <a href="{escape(export_url, quote=True)}">현재 조건 JSON</a>
      </div>
      <form method="get" action="/admin/devices" style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr)) auto;gap:8px;padding:14px 18px;border-bottom:1px solid var(--line);background:#fafafa;">
        <input type="text" name="owner_id" value="{escape(owner_filter, quote=True)}" placeholder="Owner ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
        <input type="text" name="device_id" value="{escape(device_filter, quote=True)}" placeholder="Device ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
        <select name="status" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
          {_device_status_options(status_filter)}
        </select>
        <button type="submit" style="min-height:36px;border:1px solid var(--blue);border-radius:8px;padding:0 12px;background:var(--blue);color:#fff;font-weight:750;">필터 적용</button>
      </form>
      <form method="post" action="/admin/devices/status" style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr)) auto;gap:8px;padding:14px 18px;border-bottom:1px solid var(--line);background:#fff;">
        <input type="text" name="owner_id" value="{escape(owner_filter, quote=True)}" placeholder="Owner ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;" required>
        <input type="text" name="device_id" value="{escape(device_filter, quote=True)}" placeholder="Device ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;" required>
        <select name="action" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
          <option value="activate">활성화</option>
          <option value="deactivate">비활성화</option>
        </select>
        <button type="submit" style="min-height:36px;border:1px solid var(--blue);border-radius:8px;padding:0 12px;background:#fff;color:var(--blue);font-weight:750;">상태 변경</button>
      </form>
      <table>
        <tr>
          <th>Owner</th>
          <th>Device</th>
          <th>상태</th>
          <th>메모</th>
          <th>녹음</th>
          <th>처음 확인</th>
          <th>마지막 확인</th>
          <th>마지막 메모 변경</th>
          <th>마지막 클라이언트 변경</th>
          <th>마지막 녹음 변경</th>
          <th>관리</th>
        </tr>
        {_admin_device_rows(device_rows)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _filter_device_rows(
    devices: list[dict[str, object]],
    owner_id: str,
    device_id: str,
    status_filter: str,
) -> list[dict[str, object]]:
    rows = devices
    if owner_id:
        rows = [device for device in rows if str(device["owner_id"]) == owner_id]
    if device_id:
        rows = [device for device in rows if str(device["device_id"]) == device_id]
    if status_filter == "active":
        rows = [device for device in rows if str(device["device_status"]) == "사용"]
    elif status_filter == "inactive":
        rows = [device for device in rows if str(device["device_status"]) == "비활성"]
    return rows


def _device_status_options(selected: str) -> str:
    options = [
        ("all", "상태 전체"),
        ("active", "사용"),
        ("inactive", "비활성"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _device_export_query(owner_id: str, device_id: str, status_filter: str) -> str:
    params = {}
    if owner_id:
        params["owner_id"] = owner_id
    if device_id:
        params["device_id"] = device_id
    if status_filter in {"active", "inactive"}:
        params["status"] = status_filter
    return urlencode(params)


def _admin_device_rows(devices: list[dict[str, object]]) -> str:
    if not devices:
        return '<tr><td colspan="11">연결된 기기 흔적이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td class=\"mono\">{escape(str(device['owner_id']))}</td>"
        f"<td class=\"mono\">{escape(str(device['device_id']))}</td>"
        f"<td>{escape(str(device['device_status']))}</td>"
        f"<td>{device['note_count']}</td>"
        f"<td>{device['recording_count']}</td>"
        f"<td>{_format_datetime(device['first_seen_at'])}</td>"
        f"<td>{_format_datetime(device['last_seen_at'])}</td>"
        f"<td>{_format_datetime(device['latest_note_at'])}</td>"
        f"<td>{_format_datetime(device['latest_client_at'])}</td>"
        f"<td>{_format_datetime(device['latest_recording_at'])}</td>"
        f"<td class=\"actions\">{_device_status_form(str(device['owner_id']), str(device['device_id']), str(device['device_status']))}</td>"
        "</tr>"
        for device in devices
    )


def _device_status_form(owner_id: str, device_id: str, device_status: str) -> str:
    is_inactive = device_status == "비활성"
    action = "activate" if is_inactive else "deactivate"
    label = "활성화" if is_inactive else "비활성"
    return f"""
      <form method="post" action="/admin/devices/status">
        <input type="hidden" name="owner_id" value="{escape(owner_id, quote=True)}">
        <input type="hidden" name="device_id" value="{escape(device_id, quote=True)}">
        <input type="hidden" name="action" value="{action}">
        <button type="submit">{label}</button>
      </form>
    """


def _admin_users_html(request: Request) -> str:
    error_message = ""
    users: list[UserAccount] = []
    group_counts: dict[str, int] = {}
    timezone_counts: dict[str, int] = {}
    query = request.query_params
    search = (query.get("q") or "").strip()
    status_filter = query.get("status") or "all"
    group_filter = (query.get("group") or "").strip()
    token_filter = query.get("token") or "all"
    export_query = _user_export_query(search, status_filter, group_filter, token_filter)
    export_url = "/api/v1/admin/export/users"
    if export_query:
        export_url = f"{export_url}?{export_query}"

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            stmt = select(UserAccount)
            if status_filter == "active":
                stmt = stmt.where(UserAccount.is_active == 1)
            elif status_filter == "inactive":
                stmt = stmt.where(UserAccount.is_active == 0)
            elif status_filter == "never_seen":
                stmt = stmt.where(UserAccount.last_seen_at.is_(None))
            if token_filter == "issued":
                stmt = stmt.where(UserAccount.access_token_hash.is_not(None))
            elif token_filter == "missing":
                stmt = stmt.where(UserAccount.access_token_hash.is_(None))
            if group_filter:
                stmt = stmt.where(UserAccount.group_name == group_filter)
            if search:
                keyword = f"%{search}%"
                stmt = stmt.where(
                    UserAccount.owner_id.ilike(keyword)
                    | UserAccount.email.ilike(keyword)
                    | UserAccount.display_name.ilike(keyword)
                )
            stmt = stmt.order_by(
                UserAccount.last_seen_at.desc().nullslast(),
                UserAccount.updated_at.desc(),
                UserAccount.id.desc(),
            )
            users = list(
                db.scalars(stmt).all()
            )
            group_rows = db.execute(
                select(UserAccount.group_name, func.count())
                .group_by(UserAccount.group_name)
                .order_by(func.count().desc(), UserAccount.group_name)
            ).all()
            timezone_rows = db.execute(
                select(UserAccount.timezone, func.count())
                .group_by(UserAccount.timezone)
                .order_by(func.count().desc(), UserAccount.timezone)
            ).all()
            group_counts = {group_name: count for group_name, count in group_rows}
            timezone_counts = {timezone_name: count for timezone_name, count in timezone_rows}
    except Exception as exc:
        error_message = str(exc)

    active_count = sum(1 for user in users if user.is_active)
    two_factor_count = sum(1 for user in users if user.two_factor_enabled)
    token_missing_count = sum(1 for user in users if not user.access_token_hash)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 사용자 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --red: #dc2626;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 32px 18px 48px; }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{ margin: 0; font-size: 30px; line-height: 1.2; }}
    a {{ color: var(--blue); text-decoration: none; font-weight: 650; }}
    .sub {{ margin-top: 8px; color: var(--muted); font-size: 14px; }}
    .nav {{ display: flex; gap: 10px; flex-wrap: wrap; }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    {_admin_nav_css()}
    .grid {{
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }}
    .card, section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .card {{ margin-top: 0; padding: 18px; min-height: 116px; }}
    .label {{ color: var(--muted); font-size: 13px; margin-bottom: 12px; }}
    .value {{ font-size: 24px; font-weight: 750; letter-spacing: 0; }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    .filter-form {{
      display: grid;
      grid-template-columns: minmax(180px, 1fr) 150px 150px auto;
      gap: 8px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: #fafafa;
    }}
    .filter-form input,
    .filter-form select {{
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: var(--panel);
      color: var(--text);
      font-size: 13px;
    }}
    .filter-form button {{
      min-height: 36px;
      border: 1px solid var(--blue);
      border-radius: 8px;
      padding: 0 12px;
      background: var(--blue);
      color: #fff;
      font-weight: 750;
      cursor: pointer;
    }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{ color: var(--muted); font-weight: 600; background: #fafafa; }}
    tr:last-child td {{ border-bottom: 0; }}
    .badge {{
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }}
    .ok {{ background: #dcfce7; color: #166534; }}
    .warn {{ background: #fef3c7; color: #92400e; }}
    .bad {{ background: #fee2e2; color: #991b1b; }}
    .mono {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      word-break: break-word;
    }}
    .actions a {{
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      font-size: 13px;
    }}
    .bulk-actions {{
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }}
    .bulk-actions button {{
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: var(--text);
      font-weight: 750;
      cursor: pointer;
    }}
    .bulk-actions button.danger {{
      border-color: #fecaca;
      color: #991b1b;
    }}
    .row-select {{
      width: 42px;
      text-align: center;
    }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      .grid {{ grid-template-columns: 1fr; }}
      .filter-form {{ grid-template-columns: 1fr; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>사용자 관리</h1>
        <div class="sub">시간대, 2단계 인증, 사용자 그룹, 접속 시간을 확인합니다.</div>
      </div>
      <nav class="nav" aria-label="관리 메뉴">
        {_admin_nav_html()}
      </nav>
    </header>

    <div class="grid">
      <div class="card"><div class="label">전체 사용자</div><div class="value">{len(users)}</div></div>
      <div class="card"><div class="label">활성 사용자</div><div class="value">{active_count}</div></div>
      <div class="card"><div class="label">2단계 인증 사용</div><div class="value">{two_factor_count}</div></div>
      <div class="card"><div class="label">토큰 없음</div><div class="value">{token_missing_count}</div></div>
      <div class="card"><div class="label">사용자 그룹</div><div class="value">{len(group_counts)}</div></div>
    </div>

    <section>
      <div class="section-head"><span>사용자 목록</span><span><a href="{escape(export_url, quote=True)}">현재 조건 JSON</a> · <a href="/admin/users/new">사용자 추가</a></span></div>
      <form class="filter-form" method="get" action="/admin/users">
        <input type="search" name="q" value="{escape(search, quote=True)}" placeholder="Owner, 이메일, 표시 이름 검색">
        <select name="status">
          {_user_status_options(status_filter)}
        </select>
        <select name="group">
          {_user_group_options(group_counts, group_filter)}
        </select>
        <select name="token">
          {_user_token_options(token_filter)}
        </select>
        <button type="submit">필터 적용</button>
      </form>
      <form method="post" action="/admin/users/bulk">
        <div class="bulk-actions">
          <button type="submit" name="action" value="activate">선택 활성</button>
          <button class="danger" type="submit" name="action" value="deactivate">선택 비활성</button>
        </div>
      <table>
        <tr><th class="row-select">선택</th><th>ID</th><th>Owner</th><th>표시 이름</th><th>시간대</th><th>2단계 인증</th><th>그룹</th><th>상태</th><th>토큰</th><th>토큰 사용</th><th>최근 접속</th><th>관리</th></tr>
        {_user_rows(users)}
      </table>
      </form>
    </section>

    <section>
      <div class="section-head"><span>그룹별 사용자</span><span><a href="/admin/groups">그룹 관리</a></span></div>
      <table><tr><th>그룹</th><th>사용자 수</th></tr>{_note_group_rows(group_counts)}</table>
    </section>

    <section>
      <div class="section-head"><span>시간대별 사용자</span><span class="sub">일자별 메모와 알림 기준</span></div>
      <table><tr><th>시간대</th><th>사용자 수</th></tr>{_note_group_rows(timezone_counts)}</table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _user_rows(users: list[UserAccount]) -> str:
    if not users:
        return '<tr><td colspan="12">조건에 맞는 사용자가 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td class=\"row-select\"><input type=\"checkbox\" name=\"owner_ids\" value=\"{escape(user.owner_id, quote=True)}\"></td>"
        f"<td>{user.id}</td>"
        f"<td class=\"mono\">{escape(user.owner_id)}</td>"
        f"<td>{escape(user.display_name or '-')}</td>"
        f"<td>{escape(user.timezone)}</td>"
        f"<td>{_simple_badge('ok' if user.two_factor_enabled else 'warn', '사용' if user.two_factor_enabled else '미사용')}</td>"
        f"<td>{escape(user.group_name)}</td>"
        f"<td>{_simple_badge('ok' if user.is_active else 'bad', '활성' if user.is_active else '비활성')}</td>"
        f"<td>{_simple_badge('ok' if user.access_token_hash else 'warn', '발급됨' if user.access_token_hash else '없음')}</td>"
        f"<td>{_format_datetime(user.access_token_last_used_at)}</td>"
        f"<td>{_format_datetime(user.last_seen_at)}</td>"
        f"<td class=\"actions\"><a href=\"/admin/users/edit?owner_id={escape(user.owner_id, quote=True)}\">수정</a></td>"
        "</tr>"
        for user in users
    )


def _user_status_options(selected: str) -> str:
    options = [
        ("all", "전체 상태"),
        ("active", "활성"),
        ("inactive", "비활성"),
        ("never_seen", "접속 기록 없음"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _user_group_options(group_counts: dict[str, int], selected: str) -> str:
    options = ['<option value="">전체 그룹</option>']
    for group_name in sorted(group_counts):
        options.append(
            f'<option value="{escape(group_name, quote=True)}" {"selected" if selected == group_name else ""}>{escape(group_name)}</option>'
        )
    return "\n".join(options)


def _user_token_options(selected: str) -> str:
    options = [
        ("all", "전체 토큰"),
        ("issued", "토큰 발급됨"),
        ("missing", "토큰 없음"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _user_export_query(search: str, status_filter: str, group_filter: str, token_filter: str) -> str:
    params = {}
    if search:
        params["q"] = search
    if status_filter in {"active", "inactive", "never_seen"}:
        params["status"] = status_filter
    if group_filter:
        params["group_name"] = group_filter
    if token_filter in {"issued", "missing"}:
        params["token"] = token_filter
    return urlencode(params)


def _group_select(name: str = "사용자") -> str:
    with SessionLocal() as db:
        groups = ensure_user_groups(db)
        group_items = [
            {
                "name": group.name,
                "is_active": bool(group.is_active),
            }
            for group in groups
        ]
        db.commit()
    options = []
    selected_exists = False
    for group in group_items:
        group_name = str(group["name"])
        if not group["is_active"] and group_name != name:
            continue
        selected = group_name == name
        selected_exists = selected_exists or selected
        options.append(
            f'<option value="{escape(group_name, quote=True)}" {"selected" if selected else ""}>{escape(group_name)}</option>'
        )
    if name and not selected_exists:
        options.insert(0, f'<option value="{escape(name, quote=True)}" selected>{escape(name)}</option>')
    return '<select name="group_name">' + "\n".join(options) + "</select>"


def _admin_groups_html() -> str:
    error_message = ""
    groups: list[dict[str, object]] = []
    user_counts: dict[str, int] = {}
    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            group_rows = ensure_user_groups(db)
            user_counts = dict(
                db.execute(
                    select(UserAccount.group_name, func.count())
                    .group_by(UserAccount.group_name)
                ).all()
            )
            groups = [
                {
                    "id": group.id,
                    "name": group.name,
                    "description": group.description or "",
                    "invite_code_enabled": bool(group.invite_code_hash),
                    "is_active": bool(group.is_active),
                    "sort_order": group.sort_order,
                }
                for group in group_rows
            ]
            db.commit()
    except Exception as exc:
        error_message = str(exc)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 그룹 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --red: #dc2626;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 32px 18px 48px; }}
    header {{ display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin-bottom: 22px; }}
    h1 {{ margin: 0; font-size: 30px; line-height: 1.2; }}
    a {{ color: var(--blue); text-decoration: none; font-weight: 650; }}
    .sub {{ margin-top: 8px; color: var(--muted); font-size: 14px; }}
    {_admin_nav_css()}
    section {{ margin-top: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }}
    .section-head {{ display: flex; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--line); font-weight: 700; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ padding: 13px 18px; border-bottom: 1px solid var(--line); text-align: left; font-size: 14px; vertical-align: top; }}
    th {{ color: var(--muted); font-weight: 600; background: #fafafa; }}
    input[type="text"], input[type="number"] {{ width: 100%; min-height: 36px; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; }}
    .inline-form {{ display: grid; grid-template-columns: 150px minmax(170px, 1fr) 150px 72px 76px auto; gap: 8px; align-items: center; }}
    button {{ min-height: 36px; padding: 0 12px; border: 1px solid var(--blue); border-radius: 8px; background: var(--blue); color: #fff; font-weight: 750; cursor: pointer; }}
    .badge {{ display: inline-flex; align-items: center; min-height: 26px; padding: 0 9px; border-radius: 999px; font-size: 12px; font-weight: 800; }}
    .ok {{ background: #dcfce7; color: #166534; }}
    .bad {{ background: #fee2e2; color: #991b1b; }}
    .error {{ margin-top: 14px; padding: 14px 16px; border: 1px solid #fecaca; border-radius: 8px; background: #fff1f2; color: #991b1b; font-size: 14px; }}
    @media (max-width: 760px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .inline-form {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 24px; }}
      main {{ padding: 22px 12px 36px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>그룹 관리</h1>
        <div class="sub">사용자 그룹을 먼저 만들고, 사용자 추가/수정 화면에서 선택합니다.</div>
      </div>
      <nav class="nav" aria-label="관리 메뉴">
        {_admin_nav_html()}
      </nav>
    </header>

    <section>
      <div class="section-head"><span>그룹 추가</span><span class="sub">권한 분류 이름을 명확하게 관리합니다.</span></div>
      <form class="inline-form" method="post" action="/admin/groups/new" style="padding:14px 18px;">
        <input type="text" name="name" required placeholder="그룹 이름">
        <input type="text" name="description" placeholder="설명">
        <input type="text" name="invite_code" placeholder="초대코드">
        <input type="number" name="sort_order" value="100" min="0" max="9999" aria-label="정렬">
        <label><input type="checkbox" name="is_active" checked> 활성</label>
        <button type="submit">추가</button>
      </form>
    </section>

    <section>
      <div class="section-head"><span>그룹 목록</span><span><a href="/api/v1/admin/groups">JSON</a></span></div>
      <table>
        <tr><th>그룹</th><th>설명</th><th>초대코드</th><th>사용자</th><th>상태</th><th>정렬</th><th>관리</th></tr>
        {_group_rows(groups, user_counts)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _group_rows(groups: list[dict[str, object]], user_counts: dict[str, int]) -> str:
    if not groups:
        return '<tr><td colspan="7">등록된 그룹이 없습니다.</td></tr>'
    rows = []
    for group in groups:
        group_id = int(group["id"])
        group_name = str(group["name"])
        description = str(group["description"])
        invite_code_enabled = bool(group.get("invite_code_enabled"))
        is_active = bool(group["is_active"])
        sort_order = int(group["sort_order"])
        rows.append(
            "<tr>"
            '<td colspan="7">'
            f'<form class="inline-form" method="post" action="/admin/groups/edit">'
            f'<input type="hidden" name="group_id" value="{group_id}">'
            f'<input type="text" name="name" value="{escape(group_name, quote=True)}" required>'
            f'<input type="text" name="description" value="{escape(description, quote=True)}">'
            f'<input type="text" name="invite_code" placeholder="{"새 코드 입력" if invite_code_enabled else "초대코드"}">'
            f'<span>{int(user_counts.get(group_name, 0))}명</span>'
            f'<label>{_simple_badge("ok" if is_active else "bad", "활성" if is_active else "비활성")} <input type="checkbox" name="is_active" {"checked" if is_active else ""}> 사용</label>'
            f'<input type="number" name="sort_order" value="{sort_order}" min="0" max="9999" aria-label="정렬">'
            '<button type="submit">저장</button>'
            "</form>"
            "</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _simple_badge(status: str, label: str) -> str:
    return f'<span class="badge {escape(status)}">{escape(label)}</span>'


def _admin_user_form_html() -> str:
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 사용자 추가</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{ max-width: 820px; margin: 0 auto; padding: 32px 18px 48px; }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{ margin: 0; font-size: 30px; line-height: 1.2; }}
    a {{ color: var(--blue); text-decoration: none; font-weight: 650; }}
    .sub {{ margin-top: 8px; color: var(--muted); font-size: 14px; }}
    form {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .row {{
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 16px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      align-items: center;
    }}
    .row:last-child {{ border-bottom: 0; }}
    label strong {{ display: block; margin-bottom: 4px; }}
    label span {{ color: var(--muted); font-size: 13px; }}
    input[type="text"], input[type="email"], select {{
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      font-size: 14px;
    }}
    .switch-row {{
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
    }}
    .actions {{
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 18px;
      background: #fafafa;
    }}
    button, .secondary {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: var(--text);
      font-weight: 750;
    }}
    button {{
      border-color: var(--blue);
      background: var(--blue);
      color: #fff;
      cursor: pointer;
    }}
    @media (max-width: 640px) {{
      main {{ padding: 22px 12px 36px; }}
      header {{ display: block; }}
      .row {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 24px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>사용자 추가</h1>
        <div class="sub">공용 서버 접속 전 사용자 ID를 미리 등록합니다.</div>
      </div>
      <a href="/admin/users">사용자 목록</a>
    </header>

    <form method="post" action="/admin/users/new">
      <div class="row">
        <label><strong>사용자 ID</strong><span>앱과 Web 설정의 사용자 ID</span></label>
        <input type="text" name="owner_id" required placeholder="local_user">
      </div>
      <div class="row">
        <label><strong>비밀번호</strong><span>Web 로그인에 사용하는 비밀번호</span></label>
        <input type="password" name="password" autocomplete="new-password" placeholder="Web을 사용할 경우 입력">
      </div>
      <div class="row">
        <label><strong>이메일</strong><span>로그인 계정 또는 연락용 주소</span></label>
        <input type="email" name="email">
      </div>
      <div class="row">
        <label><strong>표시 이름</strong><span>관리 화면에서 보이는 이름</span></label>
        <input type="text" name="display_name">
      </div>
      <div class="row">
        <label><strong>시간대</strong><span>일자별 메모와 알림 기준</span></label>
        <select name="timezone">
          {_timezone_options("Asia/Seoul")}
        </select>
      </div>
      <div class="row">
        <label><strong>사용자 그룹</strong><span>운영 권한 분류 기준</span></label>
        {_group_select("사용자")}
      </div>
      <div class="row">
        <label><strong>2단계 인증</strong><span>로그인 보안 사용 여부</span></label>
        <div class="switch-row"><input type="checkbox" name="two_factor_enabled"> 사용</div>
      </div>
      <div class="row">
        <label><strong>활성 상태</strong><span>서버 접속 허용 여부</span></label>
        <div class="switch-row"><input type="checkbox" name="is_active" checked> 활성</div>
      </div>
      <div class="actions">
        <a class="secondary" href="/admin/users">취소</a>
        <button type="submit">사용자 추가</button>
      </div>
    </form>
  </main>
</body>
</html>"""


def _admin_user_edit_html(owner_id: str) -> str:
    error_message = ""
    user: UserAccount | None = None
    with SessionLocal() as db:
        try:
            db.execute(text("select 1"))
            user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
        except Exception as exc:
            error_message = str(exc)

    if user is None:
        return f"""<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>사용자 없음</title></head>
<body><main><h1>사용자를 찾을 수 없습니다</h1><p>{escape(owner_id)}</p><p>{escape(error_message)}</p><a href="/admin/users">사용자 목록으로</a></main></body>
</html>"""

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 사용자 수정</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{ max-width: 820px; margin: 0 auto; padding: 32px 18px 48px; }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{ margin: 0; font-size: 30px; line-height: 1.2; }}
    a {{ color: var(--blue); text-decoration: none; font-weight: 650; }}
    .sub {{ margin-top: 8px; color: var(--muted); font-size: 14px; }}
    form {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .row {{
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 16px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      align-items: center;
    }}
    .row:last-child {{ border-bottom: 0; }}
    label strong {{ display: block; margin-bottom: 4px; }}
    label span {{ color: var(--muted); font-size: 13px; }}
    input[type="text"], input[type="email"], select {{
      width: 100%;
      min-height: 40px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      font-size: 14px;
    }}
    .switch-row {{
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 40px;
    }}
    .actions {{
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 18px;
      background: #fafafa;
    }}
    button, .secondary {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      color: var(--text);
      font-weight: 750;
    }}
    button {{
      border-color: var(--blue);
      background: var(--blue);
      color: #fff;
      cursor: pointer;
    }}
    @media (max-width: 640px) {{
      main {{ padding: 22px 12px 36px; }}
      header {{ display: block; }}
      .row {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 24px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>사용자 수정</h1>
        <div class="sub">{escape(user.owner_id)}</div>
      </div>
      <a href="/admin/users">사용자 목록</a>
    </header>

    <form method="post" action="/admin/users/edit">
      <input type="hidden" name="owner_id" value="{escape(user.owner_id, quote=True)}">
      <div class="row">
        <label><strong>비밀번호</strong><span>Web 로그인용 비밀번호. 비워두면 변경하지 않습니다.</span></label>
        <input type="password" name="password" autocomplete="new-password" placeholder="변경할 때만 입력">
      </div>
      <div class="row">
        <label><strong>이메일</strong><span>로그인 계정 또는 연락용 주소</span></label>
        <input type="email" name="email" value="{escape(user.email or '', quote=True)}">
      </div>
      <div class="row">
        <label><strong>표시 이름</strong><span>관리 화면에서 보이는 이름</span></label>
        <input type="text" name="display_name" value="{escape(user.display_name or '', quote=True)}">
      </div>
      <div class="row">
        <label><strong>시간대</strong><span>일자별 메모와 알림 기준</span></label>
        <select name="timezone">
          {_timezone_options(user.timezone)}
        </select>
      </div>
      <div class="row">
        <label><strong>사용자 그룹</strong><span>운영 권한 분류 기준</span></label>
        {_group_select(user.group_name)}
      </div>
      <div class="row">
        <label><strong>2단계 인증</strong><span>로그인 보안 사용 여부</span></label>
        <div class="switch-row"><input type="checkbox" name="two_factor_enabled" {'checked' if user.two_factor_enabled else ''}> 사용</div>
      </div>
      <div class="row">
        <label><strong>활성 상태</strong><span>서버 접속 허용 여부</span></label>
        <div class="switch-row"><input type="checkbox" name="is_active" {'checked' if user.is_active else ''}> 활성</div>
      </div>
      <div class="actions">
        <a class="secondary" href="/admin/users">취소</a>
        <button type="submit">사용자 저장</button>
      </div>
    </form>

    <form method="post" action="/admin/users/token" style="margin-top:14px;">
      <input type="hidden" name="owner_id" value="{escape(user.owner_id, quote=True)}">
      <div class="row">
        <label><strong>사용자별 접속 토큰</strong><span>공용 서버 준비용입니다. 발급된 토큰은 한 번만 표시됩니다.</span></label>
        <div class="switch-row">
          <span>{'발급됨' if user.access_token_hash else '아직 없음'}</span>
          <button type="submit">{'재발급' if user.access_token_hash else '발급'}</button>
        </div>
      </div>
      <div class="row">
        <label><strong>발급 시각</strong><span>마지막 사용자별 토큰 발급 시각</span></label>
        <div>{_format_datetime(user.access_token_issued_at)}</div>
      </div>
      <div class="row">
        <label><strong>마지막 사용</strong><span>사용자별 토큰이 마지막으로 검증된 시각</span></label>
        <div>{_format_datetime(user.access_token_last_used_at)}</div>
      </div>
    </form>
  </main>
</body>
</html>"""


def _admin_user_token_html(owner_id: str, token: str, error_message: str) -> str:
    token_block = (
        f"<pre>{escape(token)}</pre><p>이 토큰은 다시 표시되지 않습니다. 필요한 위치에 바로 입력해야 합니다.</p>"
        if token
        else f"<p>{escape(error_message or '토큰 발급에 실패했습니다.')}</p>"
    )
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 사용자 토큰</title>
  <style>
    body {{ margin:0; background:#f5f7fb; color:#111827; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }}
    main {{ max-width:820px; margin:0 auto; padding:32px 18px 48px; }}
    .card {{ background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; }}
    pre {{ white-space:pre-wrap; word-break:break-all; background:#0f172a; color:#e5e7eb; padding:14px; border-radius:8px; }}
    a {{ color:#2563eb; font-weight:700; text-decoration:none; }}
  </style>
</head>
<body>
  <main>
    <div class="card">
      <h1>사용자별 접속 토큰</h1>
      <p><strong>{escape(owner_id)}</strong></p>
      {token_block}
      <p><a href="/admin/users/edit?owner_id={escape(owner_id, quote=True)}">사용자 수정으로 돌아가기</a></p>
    </div>
  </main>
</body>
</html>"""


def _timezone_options(selected: str) -> str:
    timezones = [
        "Asia/Seoul",
        "UTC",
        "Asia/Tokyo",
        "Asia/Shanghai",
        "America/Los_Angeles",
        "America/New_York",
        "Europe/London",
    ]
    return "\n".join(
        f'<option value="{escape(timezone, quote=True)}" {"selected" if timezone == selected else ""}>{escape(timezone)}</option>'
        for timezone in timezones
    )


def _admin_ops_html() -> str:
    settings = get_settings()
    checks: list[dict[str, str]] = []

    db_status = "ok"
    db_message = "DB 연결 정상"
    failed_jobs = 0
    queued_jobs = 0
    running_jobs = 0
    deleted_notes = 0
    recordings_without_transcript = 0
    note_total = 0
    recording_total = 0
    user_total = 0
    inactive_users = 0
    users_without_seen = 0
    users_without_token = 0
    device_total = 0
    inactive_devices = 0
    orphan_recording_files = 0
    missing_recording_files = 0
    messenger_attachment_total = 0
    messenger_attachment_bytes = 0
    messenger_storage_files = 0
    messenger_storage_bytes = 0
    missing_messenger_attachments = 0

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            note_total = db.scalar(select(func.count()).select_from(Note)) or 0
            recording_total = db.scalar(select(func.count()).select_from(Recording)) or 0
            user_total = db.scalar(select(func.count()).select_from(UserAccount)) or 0
            inactive_users = (
                db.scalar(
                    select(func.count())
                    .select_from(UserAccount)
                    .where(UserAccount.is_active == 0)
                )
                or 0
            )
            users_without_seen = (
                db.scalar(
                    select(func.count())
                    .select_from(UserAccount)
                    .where(UserAccount.last_seen_at.is_(None))
                )
                or 0
            )
            users_without_token = (
                db.scalar(
                    select(func.count())
                    .select_from(UserAccount)
                    .where(UserAccount.access_token_hash.is_(None))
                )
                or 0
            )
            device_total = db.scalar(select(func.count()).select_from(UserDevice)) or 0
            inactive_devices = (
                db.scalar(
                    select(func.count())
                    .select_from(UserDevice)
                    .where(UserDevice.is_active == 0)
                )
                or 0
            )
            failed_jobs = _count_jobs_by_status(db, "failed")
            queued_jobs = _count_jobs_by_status(db, "queued")
            running_jobs = _count_jobs_by_status(db, "running")
            deleted_notes = (
                db.scalar(
                    select(func.count())
                    .select_from(Note)
                    .where(Note.deleted_at.is_not(None))
                )
                or 0
            )
            recordings_without_transcript = (
                db.scalar(
                    select(func.count())
                    .select_from(Recording)
                    .where(Recording.transcript.is_(None))
                )
                or 0
            )
            recording_storage_paths = list(db.scalars(select(Recording.storage_path)).all())
            orphan_recording_files = _recording_storage_orphan_count(
                settings.storage_dir,
                recording_storage_paths,
            )
            recording_rows = list(db.scalars(select(Recording)).all())
            missing_recording_files = len(_recording_missing_files(recording_rows))
            messenger_attachment_total = db.scalar(select(func.count()).select_from(MessengerAttachment)) or 0
            messenger_attachment_bytes = db.scalar(select(func.coalesce(func.sum(MessengerAttachment.size_bytes), 0))) or 0
            messenger_storage = messenger_storage_usage()
            messenger_storage_files = messenger_storage["files"]
            messenger_storage_bytes = messenger_storage["bytes"]
            attachment_rows = list(
                db.scalars(
                    select(MessengerAttachment).where(MessengerAttachment.deleted_at.is_(None))
                ).all()
            )
            missing_messenger_attachments = len(
                [item for item in attachment_rows if resolve_messenger_attachment_path(item.storage_path) is None]
            )
    except Exception as exc:
        db_status = "bad"
        db_message = f"DB 연결 오류: {exc}"

    checks.append({"name": "데이터베이스", "status": db_status, "message": db_message})
    storage_status, storage_message = _recording_storage_state(settings.storage_dir)
    checks.append(
        {
            "name": "녹음 저장소",
            "status": storage_status,
            "message": storage_message,
        }
    )
    messenger_storage_status, messenger_storage_message = messenger_storage_state()
    checks.append(
        {
            "name": "메신저 첨부 저장소",
            "status": messenger_storage_status,
            "message": messenger_storage_message,
        }
    )
    token_status, token_message = _api_token_state(settings.api_token)
    checks.append({"name": "API 토큰", "status": token_status, "message": token_message})
    checks.append(
        {
            "name": "공용 서버 인증",
            "status": "warn" if settings.user_token_required and users_without_token else "info",
            "message": _user_token_state(settings.user_token_required, users_without_token),
        }
    )
    checks.extend(public_server_readiness_checks())
    checks.append(public_route_ops_check())
    password_status, password_message = _database_password_state(settings.database_url)
    checks.append(
        {
            "name": "PostgreSQL 비밀번호",
            "status": password_status,
            "message": password_message,
        }
    )
    checks.append(
        {
            "name": "LLM 제공자",
            "status": "ok" if settings.llm_provider != "local" else "info",
            "message": _llm_state(settings.llm_provider, settings.openai_api_key),
        }
    )
    checks.append(
        {
            "name": "실패한 분석 작업",
            "status": "bad" if failed_jobs else "ok",
            "message": f"{failed_jobs}건",
        }
    )
    checks.append(
        {
            "name": "대기 중인 분석 작업",
            "status": "warn" if queued_jobs > 20 else "ok",
            "message": f"queued {queued_jobs}건, running {running_jobs}건",
        }
    )
    checks.append(
        {
            "name": "비활성 사용자",
            "status": "info" if inactive_users else "ok",
            "message": f"비활성 사용자 {inactive_users}명",
        }
    )
    checks.append(
        {
            "name": "접속 기록 없는 사용자",
            "status": "info" if users_without_seen else "ok",
            "message": f"최근 접속 기록 없음 {users_without_seen}명",
        }
    )
    checks.append(
        {
            "name": "비활성 기기",
            "status": "info" if inactive_devices else "ok",
            "message": f"등록 기기 {device_total}개, 비활성 기기 {inactive_devices}개",
        }
    )
    checks.append(
        {
            "name": "삭제 표시 메모",
            "status": "info" if deleted_notes else "ok",
            "message": f"삭제 표시 메모 {deleted_notes}건",
        }
    )
    checks.append(
        {
            "name": "텍스트 없는 녹음",
            "status": "info" if recordings_without_transcript else "ok",
            "message": f"transcript 없는 녹음 {recordings_without_transcript}건",
        }
    )
    checks.append(
        {
            "name": "고아 녹음 파일",
            "status": "warn" if orphan_recording_files else "ok",
            "message": f"DB 메타데이터 없이 저장소에 남은 파일 {orphan_recording_files}건",
        }
    )
    checks.append(
        {
            "name": "누락 녹음 파일",
            "status": "bad" if missing_recording_files else "ok",
            "message": f"DB 메타데이터는 있지만 저장소에서 찾을 수 없는 파일 {missing_recording_files}건",
        }
    )
    checks.append(
        {
            "name": "메신저 첨부 용량",
            "status": "ok",
            "message": (
                f"DB 첨부 {messenger_attachment_total}건/{messenger_attachment_bytes} bytes, "
                f"저장소 파일 {messenger_storage_files}건/{messenger_storage_bytes} bytes"
            ),
        }
    )
    checks.append(
        {
            "name": "누락 메신저 첨부",
            "status": "bad" if missing_messenger_attachments else "ok",
            "message": f"DB 메타데이터는 있지만 저장소에서 찾을 수 없는 메신저 첨부 {missing_messenger_attachments}건",
        }
    )
    checks.append(
        {
            "name": "백업/복구 절차",
            "status": "info",
            "message": "/admin/export에서 전체 백업과 status_counts.bad=0 검증, /admin/recovery에서 복구 기준 확인",
        }
    )

    summary_status = _ops_summary_status(checks)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 운영 점검</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --red: #dc2626;
      --amber: #d97706;
      --indigo: #4f46e5;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }}
    .card, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .card {{
      padding: 18px;
      min-height: 116px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    section {{ margin-top: 14px; }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .badge {{
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }}
    .ok {{ background: #dcfce7; color: #166534; }}
    .bad {{ background: #fee2e2; color: #991b1b; }}
    .warn {{ background: #fef3c7; color: #92400e; }}
    .info {{ background: #e0e7ff; color: #3730a3; }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>운영 점검</h1>
        <div class="sub">운영 전 점검 항목과 서버 이상 징후 확인</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/analysis">분석</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
      </nav>
    </header>

    <div class="grid">
      <div class="card">
        <div class="label">전체 상태</div>
        <div class="value">{summary_status}</div>
      </div>
      <div class="card">
        <div class="label">메모</div>
        <div class="value">{note_total}</div>
      </div>
      <div class="card">
        <div class="label">녹음 파일</div>
        <div class="value">{recording_total}</div>
      </div>
      <div class="card">
        <div class="label">사용자</div>
        <div class="value">{user_total}</div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>운영 점검</span>
        <span class="sub">읽기 전용 상태 진단</span>
      </div>
      <table>
        <tr><th>항목</th><th>상태</th><th>내용</th></tr>
        {_ops_check_rows(checks)}
      </table>
    </section>
  </main>
</body>
</html>"""


def _count_jobs_by_status(db, job_status: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(AnalysisJob)
            .where(AnalysisJob.status == job_status)
        )
        or 0
    )


def _ops_summary_status(checks: list[dict[str, str]]) -> str:
    statuses = {check["status"] for check in checks}
    if "bad" in statuses:
        return "주의 필요"
    if "warn" in statuses:
        return "점검 권장"
    return "정상"


def _ops_check_rows(checks: list[dict[str, str]]) -> str:
    return "\n".join(
        "<tr>"
        f"<td>{escape(check['name'])}</td>"
        f"<td><span class=\"badge {escape(check['status'])}\">{escape(check['status'])}</span></td>"
        f"<td>{escape(check['message'])}</td>"
        "</tr>"
        for check in checks
    )


def _recording_storage_state(storage_dir: str) -> tuple[str, str]:
    storage_path = Path(storage_dir)
    if not storage_path.exists():
        return "warn", f"녹음 저장소 경로 없음: {storage_dir}"
    if not storage_path.is_dir():
        return "bad", f"녹음 저장소가 디렉터리가 아님: {storage_dir}"
    return "ok", f"녹음 저장소 경로 확인됨: {storage_dir}"


def _recording_storage_orphan_count(storage_dir: str, recording_paths: list[str | None]) -> int:
    storage_path = Path(storage_dir)
    if not storage_path.exists() or not storage_path.is_dir():
        return 0

    storage_root = storage_path.resolve(strict=False)
    known_paths: set[Path] = set()
    for raw_path in recording_paths:
        if not raw_path:
            continue
        resolved_path = Path(raw_path).resolve(strict=False)
        try:
            resolved_path.relative_to(storage_root)
        except ValueError:
            continue
        known_paths.add(resolved_path)

    orphan_count = 0
    for path in storage_root.rglob("*"):
        if path.is_file() and path.resolve(strict=False) not in known_paths:
            orphan_count += 1
    return orphan_count


def _recording_missing_files(recordings: list[Recording]) -> list[dict[str, object]]:
    missing_files: list[dict[str, object]] = []
    for recording in recordings:
        if not recording.storage_path:
            missing_files.append(_recording_missing_file_item(recording, "storage_path empty"))
            continue
        path = Path(recording.storage_path)
        if not path.is_file():
            missing_files.append(_recording_missing_file_item(recording, "file not found"))
    return missing_files


def _recording_missing_file_item(recording: Recording, reason: str) -> dict[str, object]:
    return {
        "id": recording.id,
        "owner_id": recording.owner_id,
        "device_id": recording.device_id,
        "local_id": recording.local_id,
        "note_local_id": recording.note_local_id,
        "file_name": recording.file_name,
        "storage_path": recording.storage_path,
        "reason": reason,
        "updated_at": recording.updated_at,
    }


def _api_token_state(api_token: str | None) -> tuple[str, str]:
    if not api_token:
        return "warn", "로컬 개발은 가능하지만 공용 오픈 전 설정 필요"
    if api_token.startswith("change-this"):
        return "warn", ".env.example 예시 토큰 사용 중"
    return "ok", "설정됨"


def _database_password_state(database_url: str) -> tuple[str, str]:
    if "now-local-password" in database_url:
        return "warn", "기본 DB 비밀번호 사용 중"
    if "change-this-postgres-password" in database_url:
        return "warn", ".env.example 예시 DB 비밀번호 사용 중"
    return "ok", "기본 DB 비밀번호 아님"


def _user_token_state(required: bool, users_without_token: int) -> str:
    if required and users_without_token:
        return f"사용자별 토큰 필수, 토큰 없는 사용자 {users_without_token}명"
    if required:
        return "사용자별 토큰 필수, 모든 사용자 토큰 발급됨"
    if users_without_token:
        return f"개인 서버 기본값, 사용자별 토큰 선택 사용 가능, 토큰 없는 사용자 {users_without_token}명"
    return "개인 서버 기본값, 사용자별 토큰 선택 사용 가능"


def _admin_sync_html(request: Request) -> str:
    error_message = ""
    sync_total = 0
    latest_sync_at = None
    recent_logs: list[SyncLog] = []
    device_counts: dict[str, int] = {}
    query = request.query_params
    owner_filter = (query.get("owner_id") or "").strip()
    device_filter = (query.get("device_id") or "").strip()
    include_deleted_filter = query.get("include_deleted") or "all"
    export_query = _sync_export_query(owner_filter, device_filter, include_deleted_filter)
    export_url = "/api/v1/admin/export/sync-logs"
    if export_query:
        export_url = f"{export_url}?{export_query}"

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            sync_total = db.scalar(select(func.count()).select_from(SyncLog)) or 0
            latest_sync_at = db.scalar(select(func.max(SyncLog.created_at)))
            stmt = select(SyncLog)
            if owner_filter:
                stmt = stmt.where(SyncLog.owner_id == owner_filter)
            if device_filter:
                stmt = stmt.where(SyncLog.device_id == device_filter)
            if include_deleted_filter == "yes":
                stmt = stmt.where(SyncLog.include_deleted == 1)
            elif include_deleted_filter == "no":
                stmt = stmt.where(SyncLog.include_deleted == 0)
            recent_logs = list(
                db.scalars(
                    stmt.order_by(SyncLog.created_at.desc()).limit(100)
                ).all()
            )
            group_stmt = select(SyncLog.owner_id, SyncLog.device_id, func.count())
            if owner_filter:
                group_stmt = group_stmt.where(SyncLog.owner_id == owner_filter)
            if device_filter:
                group_stmt = group_stmt.where(SyncLog.device_id == device_filter)
            if include_deleted_filter == "yes":
                group_stmt = group_stmt.where(SyncLog.include_deleted == 1)
            elif include_deleted_filter == "no":
                group_stmt = group_stmt.where(SyncLog.include_deleted == 0)
            rows = db.execute(
                group_stmt.group_by(SyncLog.owner_id, SyncLog.device_id)
                .order_by(func.count().desc())
                .limit(30)
            ).all()
            device_counts = {
                f"{owner_id} / {device_id}": count
                for owner_id, device_id, count in rows
            }
    except Exception as exc:
        error_message = str(exc)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 동기화 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1180px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }}
    .card, section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .card {{
      margin-top: 0;
      padding: 18px;
      min-height: 116px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .mono {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }}
    .error {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fff1f2;
      color: #991b1b;
      font-size: 14px;
    }}
    @media (max-width: 900px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
    @media (max-width: 620px) {{
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>동기화 관리</h1>
        <div class="sub">앱과 서버 사이의 동기화 호출 이력 확인</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/admin/analysis">분석</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
      </nav>
    </header>

    <div class="grid">
      <div class="card">
        <div class="label">전체 동기화 호출</div>
        <div class="value">{sync_total}</div>
      </div>
      <div class="card">
        <div class="label">최근 동기화</div>
        <div class="value">{_format_datetime(latest_sync_at)}</div>
      </div>
      <div class="card">
        <div class="label">최근 목록</div>
        <div class="value">{len(recent_logs)}</div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>기기별 동기화 호출</span>
        <span class="sub">상위 30개</span>
      </div>
      <table>
        <tr><th>Owner / Device</th><th>호출 수</th></tr>
        {_note_group_rows(device_counts)}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>최근 동기화 이력</span>
        <a href="{escape(export_url, quote=True)}">현재 조건 JSON</a>
      </div>
      <form method="get" action="/admin/sync" style="display:grid;grid-template-columns:repeat(3,minmax(150px,1fr)) auto;gap:8px;padding:14px 18px;border-bottom:1px solid var(--line);background:#fafafa;">
        <input type="text" name="owner_id" value="{escape(owner_filter, quote=True)}" placeholder="Owner ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
        <input type="text" name="device_id" value="{escape(device_filter, quote=True)}" placeholder="Device ID" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
        <select name="include_deleted" style="min-height:36px;border:1px solid var(--line);border-radius:8px;padding:0 10px;">
          {_sync_include_deleted_options(include_deleted_filter)}
        </select>
        <button type="submit" style="min-height:36px;border:1px solid var(--blue);border-radius:8px;padding:0 12px;background:var(--blue);color:#fff;font-weight:750;">필터 적용</button>
      </form>
      <table>
        <tr>
          <th>ID</th>
          <th>Owner</th>
          <th>Device</th>
          <th>Push</th>
          <th>Pull</th>
          <th>삭제 포함</th>
          <th>updated_after</th>
          <th>시각</th>
        </tr>
        {_sync_log_rows(recent_logs)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _sync_log_rows(logs: list[SyncLog]) -> str:
    if not logs:
        return '<tr><td colspan="8">동기화 이력이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td>{log.id}</td>"
        f"<td class=\"mono\">{escape(log.owner_id)}</td>"
        f"<td class=\"mono\">{escape(log.device_id)}</td>"
        f"<td>{log.pushed_count}</td>"
        f"<td>{log.pulled_count}</td>"
        f"<td>{'yes' if log.include_deleted else 'no'}</td>"
        f"<td>{_format_datetime(log.updated_after)}</td>"
        f"<td>{_format_datetime(log.created_at)}</td>"
        "</tr>"
        for log in logs
    )


def _sync_include_deleted_options(selected: str) -> str:
    options = [
        ("all", "삭제 포함 전체"),
        ("yes", "삭제 포함만"),
        ("no", "삭제 미포함만"),
    ]
    return "\n".join(
        f'<option value="{escape(value, quote=True)}" {"selected" if selected == value else ""}>{escape(label)}</option>'
        for value, label in options
    )


def _sync_export_query(
    owner_id: str,
    device_id: str,
    include_deleted_filter: str,
) -> str:
    params = {}
    if owner_id:
        params["owner_id"] = owner_id
    if device_id:
        params["device_id"] = device_id
    if include_deleted_filter == "yes":
        params["include_deleted"] = "true"
    elif include_deleted_filter == "no":
        params["include_deleted"] = "false"
    return urlencode(params)


def _admin_export_html() -> str:
    summary = _export_summary_counts_for_page()
    export_links = [
        (
            "전체 백업",
            "/api/v1/admin/export/all",
            "메모, 녹음 메타데이터, 사용자, 분석 작업, 동기화 이력 전체",
            summary["total_export_items"],
        ),
        ("Notes", "/api/v1/admin/export/notes", "메모 전체 export", summary["notes"]),
        (
            "삭제 제외 메모",
            "/api/v1/admin/export/notes?include_deleted=false",
            "삭제 표시 제외 메모 export",
            summary["active_notes"],
        ),
        (
            "Recordings",
            "/api/v1/admin/export/recordings",
            "녹음 파일 메타데이터 export",
            summary["recordings"],
        ),
        (
            "고아 녹음 파일",
            "/api/v1/admin/export/recording-orphans",
            "DB 메타데이터 없이 저장소에 남은 파일 목록",
            summary["recording_orphan_files"],
        ),
        (
            "누락 녹음 파일",
            "/api/v1/admin/export/recording-missing-files",
            "DB 메타데이터는 있지만 저장소에서 찾을 수 없는 파일 목록",
            summary["recording_missing_files"],
        ),
        (
            "Users",
            "/api/v1/admin/export/users",
            "사용자 계정과 운영 메타데이터 export",
            summary["users"],
        ),
        (
            "기기",
            "/api/v1/admin/export/devices",
            "사용자별 기기 등록 상태 export",
            summary["devices"],
        ),
        (
            "분석 작업",
            "/api/v1/admin/export/analysis-jobs",
            "분석 작업 이력 export",
            summary["analysis_jobs"],
        ),
        (
            "동기화 이력",
            "/api/v1/admin/export/sync-logs",
            "동기화 호출 이력 export",
            summary["sync_logs"],
        ),
    ]
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 내보내기 관리</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      max-width: 820px;
      justify-content: flex-end;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .nav-break {{
      flex-basis: 100%;
      height: 0;
    }}
    .nav-label {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
    }}
    section {{
      margin-top: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 14px 0;
    }}
    .card {{
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 14px 16px;
    }}
    .label {{
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }}
    .value {{
      margin-top: 6px;
      font-size: 24px;
      font-weight: 800;
    }}
    .filter-form {{
      display: grid;
      grid-template-columns: repeat(3, minmax(150px, 1fr)) auto;
      gap: 8px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: #fafafa;
    }}
    .filter-form input,
    .filter-form select {{
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 10px;
      background: var(--panel);
      color: var(--text);
      font-size: 13px;
    }}
    .filter-form button {{
      min-height: 36px;
      border: 1px solid var(--blue);
      border-radius: 8px;
      padding: 0 12px;
      background: var(--blue);
      color: #fff;
      font-weight: 750;
      cursor: pointer;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .notice {{
      margin-top: 14px;
      padding: 14px 16px;
      border: 1px solid #fde68a;
      border-radius: 8px;
      background: #fffbeb;
      color: #92400e;
      font-size: 14px;
    }}
    .result-list {{
      margin: 0;
      padding: 14px 18px 16px 34px;
      font-size: 14px;
      line-height: 1.7;
    }}
    code, pre {{
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }}
    pre {{
      margin: 0;
      overflow-x: auto;
      padding: 14px 16px;
      background: #111827;
      color: #f9fafb;
      font-size: 13px;
      line-height: 1.55;
    }}
    @media (max-width: 760px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .cards {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
      th, td {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>내보내기 관리</h1>
        <div class="sub">운영 확인과 백업을 위한 읽기 전용 JSON 내보내기</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
      </nav>
    </header>

    <div class="notice">
      전체 백업 JSON에도 원본 음성 파일 자체는 포함하지 않고, 녹음 파일의 메타데이터만 export합니다.
      사용자별 접속 토큰 원문과 토큰 해시는 포함하지 않습니다.
      백업 JSON의 <code>content_sha256</code>과 응답 헤더 <code>X-Now-Backup-Sha256</code>로 내용 식별값을 확인할 수 있습니다.
      백업 파일 검증은 <code>POST /api/v1/admin/export/verify</code> API를 사용합니다.
    </div>

    <div class="cards">
      <div class="card"><div class="label">전체 메모</div><div class="value">{summary["notes"]}</div></div>
      <div class="card"><div class="label">삭제 표시</div><div class="value">{summary["deleted_notes"]}</div></div>
      <div class="card"><div class="label">녹음 메타</div><div class="value">{summary["recordings"]}</div></div>
      <div class="card"><div class="label">등록 기기</div><div class="value">{summary["devices"]}</div></div>
    </div>

    <section>
      <div class="section-head">
        <span>내보내기 링크</span>
        <a class="sub" href="/api/v1/admin/export/summary">요약 JSON</a>
      </div>
      <table>
        <tr><th>항목</th><th>설명</th><th>건수</th><th>링크</th></tr>
        {_export_link_rows(export_links)}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>백업 검증 요청 예시</span>
        <span class="sub">JSON</span>
      </div>
      <pre>{escape(_backup_verify_example())}</pre>
      <ul class="result-list">
        <li><code>status=ok</code>이면 백업 구조와 체크섬 기준이 정상입니다.</li>
        <li><code>status_counts.bad=0</code>이면 실패 검증 항목이 없다는 뜻입니다.</li>
        <li><code>warn</code> 또는 <code>bad</code>가 있으면 복구 작업 전에 <code>/admin/recovery</code>와 <code>/admin/ops</code>를 먼저 확인합니다.</li>
        <li>원본 음성 파일은 백업 JSON에 포함되지 않으므로 Docker 볼륨 또는 <code>NOW_STORAGE_DIR</code> 저장소를 별도로 보존합니다.</li>
      </ul>
    </section>
  </main>
</body>
</html>"""


def _admin_help_html() -> str:
    return """<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 도움말</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --soft: #eff6ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      max-width: 1040px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }
    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 20px;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
      font-size: 14px;
    }
    a {
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }
    .sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }
    .nav {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .nav a {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }
    .hero {
      padding: 22px;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: var(--soft);
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .card {
      padding: 18px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .card strong {
      display: block;
      margin-bottom: 8px;
      font-size: 16px;
    }
    ul {
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.65;
      font-size: 14px;
    }
    code {
      padding: 2px 6px;
      border-radius: 6px;
      background: #eef2ff;
      color: #1e3a8a;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
    }
    @media (max-width: 760px) {
      header { display: block; }
      .nav { margin-top: 14px; }
      main { padding: 22px 12px 36px; }
      h1 { font-size: 24px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>NowNote 도움말</h1>
        <div class="sub">단독 사용, 서버 연결, 운영 기준을 한 화면에서 확인합니다</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/users">사용자</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/release">1차 준비</a>
        <a href="/admin/mobile">모바일 점검</a>
        <a href="/admin/play">Play 등록</a>
        <a href="/admin/open-source">공개 준비</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API 문서</a>
      </nav>
    </header>

    <section class="hero">
      <h2>운영 기준</h2>
      <p>
        NowNote는 서버가 없어도 로컬 메모 프로그램으로 동작하고, 서버에 연결하면 기기 간 동기화와
        운영 백업을 사용할 수 있습니다. 개인 Docker 서버와 공용 NowNote 서버는 같은 서버 프로그램을
        사용하되, 토큰 발급과 사용자 관리는 운영 방식에 맞게 나뉩니다.
      </p>
    </section>

    <div class="grid">
      <section class="card">
        <strong>단독 사용자</strong>
        <p>모바일 앱, Web, 설치형 프로그램이 각 기기 안에서 메모를 저장합니다.</p>
        <ul>
          <li>서버 주소와 API 토큰이 없어도 사용할 수 있습니다.</li>
          <li>일자별 메모는 하나의 날짜 메모에 계속 추가합니다.</li>
          <li>지식 메모는 주제, 분류, 메모 3단계 구조를 기본으로 합니다.</li>
        </ul>
      </section>

      <section class="card">
        <strong>서버 연결 사용자</strong>
        <p>개인 서버 또는 공용 서버에 연결하여 메모와 녹음 메타데이터를 동기화합니다.</p>
        <ul>
          <li>앱/설치형 설정에는 서버 주소, 사용자 ID, 앱/설치형 접속 토큰을 입력합니다.</li>
          <li>사용자별 시간대, 2단계 인증 사용 여부, 그룹, 활성 상태를 관리합니다.</li>
          <li>2단계 인증 코드는 저장하지 않고 연결 확인 또는 로그인 확인 때만 입력합니다.</li>
          <li>동기화 상태는 <code>/admin/sync</code>와 <code>/admin/devices</code>에서 확인합니다.</li>
        </ul>
      </section>

      <section class="card">
        <strong>개인 Docker 서버</strong>
        <p>사용자가 직접 서버를 설치해 자기 자료를 자기 서버에 보관하는 방식입니다.</p>
        <ul>
          <li><code>.env</code>에서 <code>NOW_API_TOKEN</code>과 DB 비밀번호를 먼저 확정합니다.</li>
          <li>앱에는 <code>http://서버주소:8750</code> 형식으로 연결합니다.</li>
          <li>삭제 보관함의 비활성 백업은 자기 서버 안에서 유지하는 방향입니다.</li>
        </ul>
      </section>

      <section class="card">
        <strong>공용 NowNote 서버</strong>
        <p>운영자가 사용자와 기기별 접속 권한을 발급하고 관리하는 방식입니다.</p>
        <ul>
          <li>개인 서버는 단일 <code>NOW_API_TOKEN</code>으로 시작할 수 있고, 공용 서버는 사용자별 접속 토큰과 2단계 코드 검증을 함께 사용합니다.</li>
          <li>오픈 전에는 사용자별 접속 토큰 필수 모드와 사용자별 데이터 격리 점검을 통과해야 합니다.</li>
          <li>운영자는 <code>/admin/users</code>에서 사용자 활성 상태와 최근 접속 시간을 확인합니다.</li>
          <li>오픈 전에는 API 토큰, DB 비밀번호, LLM 제공자 상태를 <code>/admin/ops</code>에서 점검합니다.</li>
          <li>상세 기준은 <a href="/admin/public">공용 서버 준비</a> 화면에서 확인합니다.</li>
          <li><code>/admin/ops</code>는 사용자 토큰 확인 화면/API, 2단계 코드 검증, 기기 등록, 데이터 격리, 공개 운영 환경을 정보성 점검으로 보여줍니다.</li>
          <li>민감 메모 암호화는 로그인 사용자 기능으로 단계적으로 연결합니다.</li>
        </ul>
      </section>

      <section class="card">
        <strong>배포 체크리스트</strong>
        <p>WSL/Docker 서버 갱신은 소스 갱신, 환경 파일 확인, preflight, 컨테이너 시작, smoke test 순서로 진행합니다.</p>
        <ul>
          <li>배포 전 점검은 <code>scripts/preflight.py</code>를 사용합니다.</li>
          <li>서버 시작 후 <code>/health</code>, <code>/health/ready</code>, <code>/api/v1/server</code>를 확인합니다.</li>
          <li>배포 직후 <code>/admin/export</code>에서 전체 백업을 내려받고 백업 검증 결과를 확인합니다.</li>
          <li>상세 절차는 <a href="/admin/deploy">DEPLOY.md</a>를 기준으로 확인합니다.</li>
        </ul>
      </section>

      <section class="card">
        <strong>복구 절차</strong>
        <p>장애 발생 시에는 백업 JSON을 먼저 검증하고 DB/저장소 상태를 확인한 뒤 복구합니다.</p>
        <ul>
          <li>전체 백업은 <code>/admin/export</code>에서 내려받습니다.</li>
          <li>백업 검증은 <code>/api/v1/admin/export/verify</code>를 사용합니다.</li>
          <li><code>bad</code>가 있으면 복구를 시작하지 않고, <code>warn</code>은 <code>/admin/ops</code>에서 원인을 먼저 확인합니다.</li>
          <li>상세 절차는 <a href="/admin/recovery">RECOVERY.md</a>를 기준으로 확인합니다.</li>
        </ul>
      </section>
    </div>
  </main>
</body>
</html>"""


def _admin_release_html(request: Request) -> str:
    readiness = release_readiness_summary()
    evidence = release_evidence_summary()
    summary = readiness["summary"]
    status = readiness["status"]
    status_label = "마무리 완료" if status == "ready" else "마무리 진행 중"
    status_class = "ok" if status == "ready" else "warn"
    source = "docs/PHASE1_RELEASE_CHECKLIST.md" if readiness.get("source") else "체크리스트 파일 없음"
    saved_message = _release_evidence_saved_message(request)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 1차 릴리스 준비</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }}
    .card, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    .card {{
      padding: 18px;
      min-height: 112px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .ok {{ color: var(--green); }}
    .warn {{ color: var(--amber); }}
    .message {{
      margin-bottom: 14px;
      padding: 12px 14px;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      background: #f0fdf4;
      color: #166534;
      font-size: 14px;
      font-weight: 700;
    }}
    .message.error {{
      border-color: #fecaca;
      background: #fef2f2;
      color: #991b1b;
    }}
    section {{
      margin-top: 14px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    ul {{
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }}
    code {{
      padding: 2px 6px;
      border-radius: 6px;
      background: #eef2ff;
      color: #1e3a8a;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
    }}
    .action-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      padding: 16px 18px 18px;
    }}
    .action-card {{
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fbfdff;
    }}
    .action-card strong {{
      display: block;
      margin-bottom: 8px;
      font-size: 15px;
    }}
    .action-card p {{
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }}
    .action-card a {{
      display: inline-flex;
      margin: 4px 8px 0 0;
      font-size: 13px;
    }}
    .quick-form {{
      display: grid;
      grid-template-columns: minmax(140px, 1fr) minmax(180px, 1.4fr) auto;
      gap: 8px;
      align-items: start;
    }}
    .quick-form input {{
      width: 100%;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 7px 9px;
      font: inherit;
      font-size: 13px;
    }}
    .quick-form button {{
      min-height: 34px;
      border: 1px solid var(--blue);
      border-radius: 8px;
      padding: 0 10px;
      background: var(--blue);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }}
    @media (max-width: 800px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .cards {{ grid-template-columns: 1fr; }}
      .action-grid {{ grid-template-columns: 1fr; }}
      .quick-form {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>NowNote 1차 릴리스 준비</h1>
        <div class="sub">체크리스트 기준으로 완료 항목과 외부 확인이 필요한 항목을 봅니다</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/evidence">수동 증빙</a>
        <a href="/admin/mobile">모바일 점검</a>
        <a href="/admin/public">공용 서버</a>
        <a href="/admin/deploy">배포</a>
        <a href="/admin/help">도움말</a>
      </nav>
    </header>
    {saved_message}

    <div class="cards">
      <div class="card">
        <div class="label">상태</div>
        <div class="value {status_class}">{status_label}</div>
      </div>
      <div class="card">
        <div class="label">완료</div>
        <div class="value">{summary["done"]}/{summary["total"]}</div>
        <div class="sub">수동 증빙 반영 {summary.get("evidence_done", 0)}건</div>
      </div>
      <div class="card">
        <div class="label">남은 항목</div>
        <div class="value {status_class}">{summary["remaining"]}</div>
      </div>
      <div class="card">
        <div class="label">기준</div>
        <div class="value" style="font-size:16px;">{escape(source)}</div>
        <div class="sub"><a href="/api/v1/admin/release-readiness">JSON API</a></div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>영역별 진행</span>
        <span class="sub">체크리스트와 완료 증빙 기준</span>
      </div>
      <table>
        <tr><th>영역</th><th>진행</th><th>상태</th><th>남은 항목</th></tr>
        {_release_section_rows(readiness["sections"])}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>남은 항목 유형</span>
        <span class="sub">외부 조건별 분류</span>
      </div>
      <table>
        <tr><th>유형</th><th>개수</th><th>기준</th><th>다음 행동</th><th>항목</th></tr>
        {_release_blocker_rows(readiness["blockers"])}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>외부 작업 바로가기</span>
        <span class="sub">남은 항목을 실제 화면에서 처리할 때 필요한 값</span>
      </div>
      {_release_action_cards(readiness["blockers"])}
    </section>

    <section>
      <div class="section-head">
        <span>바로 완료 증빙 기록</span>
        <span class="sub">실제 확인이 끝난 항목만 완료로 저장</span>
      </div>
      <table>
        <tr><th>유형</th><th>항목</th><th>필요 증빙</th><th>완료 기록</th></tr>
        {_release_quick_evidence_rows(evidence["items"])}
      </table>
    </section>
  </main>
</body>
</html>"""


def _release_action_cards(blockers: list[dict]) -> str:
    cards = [
        """
        <div class="action-card">
          <strong>Nginx Proxy Manager</strong>
          <p>Proxy Host <code>nownote.sinsan.kr</code>의 Forward 값을 NowNote API 컨테이너로 유지합니다.</p>
          <ul>
            <li>Scheme: <code>http</code></li>
            <li>Forward Hostname/IP: <code>now-api</code></li>
            <li>Forward Port: <code>8080</code></li>
            <li>확인 URL: <code>https://nownote.sinsan.kr/api/v1/server</code></li>
          </ul>
          <p>NowNote Web을 루트 주소에서 엽니다. 루트 주소는 Web 프로그램으로 열고, 개인정보처리방침은 <code>/privacy</code>에서 제공합니다.</p>
          <a href="/admin/public">공용 서버 화면</a>
          <a href="/api/v1/admin/public-route">경로 점검 API</a>
        </div>
        """,
        """
        <div class="action-card">
          <strong>Play Console 내부 테스트</strong>
          <p>서명된 AAB를 내부 테스트 트랙에 업로드하고 Play Console 화면에서 최종 저장 상태를 확인합니다.</p>
          <ul>
            <li>AAB: <code>now_app/build/app/outputs/bundle/release/app-release.aab</code></li>
            <li>출시 노트: <code>now_app/docs/google_play_paste_ready_ko.md</code></li>
          </ul>
          <a href="/admin/play">Play 등록 화면</a>
        </div>
        """,
        """
        <div class="action-card">
          <strong>GitHub Actions Preflight</strong>
          <p>GitHub 화면에서 <code>NowNote Preflight</code>를 실행하거나 권한 토큰이 있는 환경에서 스크립트로 실행합니다.</p>
          <ul>
            <li><code>python scripts/dispatch_github_actions.py --ref main</code></li>
            <li><code>python scripts/check_github_actions_status.py --branch main</code></li>
          </ul>
          <a href="https://github.com/cyhuh428-sinsan/Now/actions/workflows/preflight.yml">Actions 화면</a>
          <a href="/admin/open-source">공개 준비 화면</a>
        </div>
        """,
    ]
    if not blockers:
        cards.append(
            """
            <div class="action-card">
              <strong>마무리 완료</strong>
              <p>남은 외부 작업이 없습니다. 운영 입력값은 재배포나 장애 대응 때 확인할 수 있도록 계속 표시합니다.</p>
            </div>
            """
        )
    else:
        cards.append(
            """
            <div class="action-card">
              <strong>기타 외부 확인</strong>
              <p>남은 항목의 실제 완료 조건을 확인한 뒤 바로 완료 증빙 기록에 증빙 위치와 확인 내용을 저장합니다.</p>
              <a href="/admin/evidence">수동 증빙 화면</a>
            </div>
            """
        )
    return '<div class="action-grid">' + "\n".join(cards) + "</div>"


def _release_quick_evidence_rows(items: list[dict]) -> str:
    if not items:
        return '<tr><td colspan="4">완료 증빙을 기록할 남은 항목이 없습니다.</td></tr>'
    rows = []
    for item in items:
        evidence_key = "||".join([item["group"], item["section"], item["label"]])
        evidence = "".join(f"<li>{escape(value)}</li>" for value in item["evidence"])
        rows.append(
            "<tr>"
            f"<td>{escape(item['group'])}</td>"
            f"<td><strong>{escape(item['label'])}</strong><div class=\"sub\">{escape(item['section'])}</div></td>"
            f"<td><ul>{evidence}</ul></td>"
            "<td>"
            '<form class="quick-form" method="post" action="/admin/evidence/records">'
            f'<input type="hidden" name="evidence_key" value="{escape(evidence_key, quote=True)}">'
            '<input type="hidden" name="result" value="완료">'
            '<input type="hidden" name="return_to" value="/admin/release">'
            '<input type="text" name="evidence_location" placeholder="증빙 위치" required>'
            '<input type="text" name="actual_note" placeholder="실제 확인 내용" required>'
            '<button type="submit">완료 기록</button>'
            "</form>"
            "</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _release_section_rows(sections: list[dict]) -> str:
    if not sections:
        return '<tr><td colspan="4">체크리스트 항목을 찾을 수 없습니다.</td></tr>'
    rows = []
    for section in sections:
        remaining = section["remaining"]
        status_class = "ok" if remaining == 0 else "warn"
        status_label = "완료" if remaining == 0 else f"남음 {remaining}개"
        remaining_items = [
            f"<li>{escape(item['label'])}</li>"
            for item in section["items"]
            if not item["checked"]
        ]
        rows.append(
            "<tr>"
            f"<td>{escape(section['name'])}</td>"
            f"<td>{section['done']}/{section['total']}</td>"
            f'<td class="{status_class}">{escape(status_label)}</td>'
            f"<td>{'<ul>' + ''.join(remaining_items) + '</ul>' if remaining_items else '-'}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _release_blocker_rows(blockers: list[dict]) -> str:
    if not blockers:
        return '<tr><td colspan="5">남은 항목이 없습니다.</td></tr>'
    rows = []
    for blocker in blockers:
        items = "".join(
            f"<li>[{escape(item['section'])}] {escape(item['label'])}</li>"
            for item in blocker["items"]
        )
        rows.append(
            "<tr>"
            f"<td>{escape(blocker['name'])}</td>"
            f"<td>{blocker['count']}</td>"
            f"<td>{escape(blocker['guidance'])}</td>"
            f"<td>{escape(blocker.get('next_action', '-'))}</td>"
            f"<td>{'<ul>' + items + '</ul>' if items else '-'}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _admin_evidence_html(request: Request) -> str:
    evidence = release_evidence_summary()
    template = release_evidence_template()
    records = _recent_release_evidence_records()
    latest_records = _latest_release_evidence_records()
    progress = _release_evidence_progress(evidence["items"], latest_records)
    summary = evidence["summary"]
    status = evidence["status"]
    status_label = "증빙 필요" if status == "manual" else "증빙 완료"
    status_class = "warn" if status == "manual" else "ok"
    saved_message = _release_evidence_saved_message(request)
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 수동 증빙</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --amber: #d97706;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }}
    .card, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    .card {{
      padding: 18px;
      min-height: 112px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .ok {{ color: var(--green); }}
    .warn {{ color: var(--amber); }}
    .pill {{
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      background: #f3f4f6;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }}
    .pill.ok {{
      background: #dcfce7;
      color: #166534;
    }}
    .pill.warn {{
      background: #fef3c7;
      color: #92400e;
    }}
    section {{
      margin-top: 14px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    .message {{
      margin-bottom: 14px;
      padding: 12px 14px;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      background: #f0fdf4;
      color: #166534;
      font-size: 14px;
      font-weight: 700;
    }}
    .message.error {{
      border-color: #fecaca;
      background: #fef2f2;
      color: #991b1b;
    }}
    .form-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 18px;
    }}
    .form-field {{
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }}
    .form-field.full {{ grid-column: 1 / -1; }}
    .form-field input,
    .form-field select,
    .form-field textarea {{
      width: 100%;
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--panel);
      color: var(--text);
      font: inherit;
      font-weight: 500;
    }}
    .form-field textarea {{
      min-height: 84px;
      resize: vertical;
    }}
    .form-actions {{
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 0 18px 18px;
    }}
    .form-actions button {{
      min-height: 38px;
      border: 1px solid var(--blue);
      border-radius: 8px;
      padding: 0 14px;
      background: var(--blue);
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }}
    ul {{
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }}
    code {{
      padding: 2px 6px;
      border-radius: 6px;
      background: #eef2ff;
      color: #1e3a8a;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
    }}
    pre {{
      margin: 0;
      padding: 18px;
      overflow: auto;
      white-space: pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
      line-height: 1.65;
      background: #0f172a;
      color: #e5e7eb;
    }}
    @media (max-width: 800px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .cards {{ grid-template-columns: 1fr; }}
      .form-grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>NowNote 수동 증빙</h1>
        <div class="sub">실제 기기, Play Console, 공용 서버처럼 사람이 확인해야 하는 항목의 증빙 기준입니다</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/release">1차 준비</a>
        <a href="/admin/mobile">모바일 점검</a>
        <a href="/admin/public">공용 서버</a>
        <a href="/admin/play">Play 등록</a>
        <a href="/admin/open-source">공개 준비</a>
      </nav>
    </header>
    {saved_message}

    <div class="cards">
      <div class="card">
        <div class="label">상태</div>
        <div class="value {status_class}">{status_label}</div>
      </div>
      <div class="card">
        <div class="label">증빙 필요 항목</div>
        <div class="value {status_class}">{summary["remaining"]}</div>
      </div>
      <div class="card">
        <div class="label">유형</div>
        <div class="value">{summary["groups"]}</div>
        <div class="sub"><a href="/api/v1/admin/release-evidence">JSON API</a> · <a href="/api/v1/admin/release-evidence-template">기록 템플릿 API</a></div>
      </div>
      <div class="card">
        <div class="label">증빙 완료 기록</div>
        <div class="value ok">{progress["done"]}/{progress["total"]}</div>
      </div>
      <div class="card">
        <div class="label">기록 있음</div>
        <div class="value">{progress["recorded"]}</div>
      </div>
      <div class="card">
        <div class="label">미기록</div>
        <div class="value warn">{progress["unrecorded"]}</div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>증빙 기록 템플릿</span>
        <span class="sub">실제 확인 후 작업 기록에 붙여넣기</span>
      </div>
      <pre>{escape(template["content"])}</pre>
    </section>

    <section>
      <div class="section-head">
        <span>증빙 기록 저장</span>
        <span class="sub">실제 확인이 끝난 항목만 저장</span>
      </div>
      <form method="post" action="/admin/evidence/records">
        <div class="form-grid">
          <label class="form-field full">항목
            <select name="evidence_key" required>
              {_release_evidence_option_rows(evidence["items"])}
            </select>
          </label>
          <label class="form-field">결과
            <select name="result">
              <option value="완료">완료</option>
              <option value="보류">보류</option>
              <option value="재확인 필요" selected>재확인 필요</option>
              <option value="미확인">미확인</option>
            </select>
          </label>
          <label class="form-field">확인자
            <input type="text" name="checked_by" placeholder="확인자 이름">
          </label>
          <label class="form-field full">증빙 위치
            <input type="text" name="evidence_location" placeholder="화면 경로, URL, 파일 경로, 실행 결과 위치">
          </label>
          <label class="form-field full">실제 확인 내용
            <textarea name="actual_note" placeholder="실제 확인한 내용"></textarea>
          </label>
          <label class="form-field full">메모
            <textarea name="memo" placeholder="추가 메모"></textarea>
          </label>
        </div>
        <div class="form-actions"><button type="submit">증빙 기록 저장</button></div>
      </form>
    </section>

    <section>
      <div class="section-head">
        <span>최근 증빙 기록</span>
        <span class="sub"><a href="/api/v1/admin/release-evidence-records">기록 JSON API</a></span>
      </div>
      <table>
        <tr><th>확인 시각</th><th>결과</th><th>유형</th><th>항목</th><th>확인자</th><th>증빙 위치</th><th>확인 내용</th></tr>
        {_release_evidence_record_rows(records)}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>수동 증빙 기준</span>
        <span class="sub">최근 기록 상태와 대조해 체크리스트 갱신</span>
      </div>
      <table>
        <tr><th>상태</th><th>유형</th><th>항목</th><th>필요 증빙</th><th>다음 행동</th><th>참고</th></tr>
        {_release_evidence_rows(evidence["items"], latest_records)}
      </table>
    </section>
  </main>
</body>
</html>"""


def _release_evidence_saved_message(request: Request) -> str:
    if request.query_params.get("saved") == "1":
        return '<div class="message">증빙 기록을 저장했습니다.</div>'
    if request.query_params.get("error") == "invalid":
        return '<div class="message error">증빙 항목을 선택해야 합니다.</div>'
    return ""


def _evidence_return_url(return_to: str, query: str) -> str:
    target = return_to.strip()
    if target not in {"/admin/evidence", "/admin/release"}:
        target = "/admin/evidence"
    return f"{target}?{query}"


def _release_evidence_option_rows(items: list[dict]) -> str:
    if not items:
        return '<option value="">남은 수동 증빙 항목 없음</option>'
    options = []
    for item in items:
        value = "||".join([item["group"], item["section"], item["label"]])
        label = f"[{item['group']}] {item['label']}"
        options.append(f'<option value="{escape(value, quote=True)}">{escape(label)}</option>')
    return "\n".join(options)


def _recent_release_evidence_records(limit: int = 20) -> list[ReleaseEvidenceRecord]:
    with SessionLocal() as db:
        return list(
            db.scalars(
                select(ReleaseEvidenceRecord)
                .order_by(ReleaseEvidenceRecord.checked_at.desc(), ReleaseEvidenceRecord.id.desc())
                .limit(limit)
            ).all()
        )


def _latest_release_evidence_records() -> dict[str, ReleaseEvidenceRecord]:
    latest: dict[str, ReleaseEvidenceRecord] = {}
    with SessionLocal() as db:
        records = db.scalars(
            select(ReleaseEvidenceRecord).order_by(
                ReleaseEvidenceRecord.checked_at.desc(),
                ReleaseEvidenceRecord.id.desc(),
            )
        ).all()
    for record in records:
        key = _release_evidence_record_key(record.group_name, record.section, record.label)
        latest.setdefault(key, record)
    return latest


def _release_evidence_record_key(group: str, section: str, label: str) -> str:
    return "||".join([group.strip(), section.strip(), label.strip()])


def _release_evidence_item_key(item: dict) -> str:
    return _release_evidence_record_key(item["group"], item["section"], item["label"])


def _release_evidence_progress(items: list[dict], latest_records: dict[str, ReleaseEvidenceRecord]) -> dict[str, int]:
    total = len(items)
    recorded = sum(1 for item in items if _release_evidence_item_key(item) in latest_records)
    done = sum(
        1
        for item in items
        if (record := latest_records.get(_release_evidence_item_key(item))) is not None and record.result == "완료"
    )
    return {
        "total": total,
        "done": done,
        "recorded": recorded,
        "unrecorded": max(total - recorded, 0),
    }


def _release_evidence_record_rows(records: list[ReleaseEvidenceRecord]) -> str:
    if not records:
        return '<tr><td colspan="7">저장된 증빙 기록이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td>{_format_datetime(record.checked_at)}</td>"
        f"<td>{escape(record.result)}</td>"
        f"<td>{escape(record.group_name)}</td>"
        f"<td><strong>{escape(record.label)}</strong><div class=\"sub\">{escape(record.section)}</div></td>"
        f"<td>{escape(record.checked_by or '-')}</td>"
        f"<td>{escape(_truncate(record.evidence_location or '-', 80))}</td>"
        f"<td>{escape(_truncate(record.actual_note or record.memo or '-', 100))}</td>"
        "</tr>"
        for record in records
    )


def _truncate(value: str, limit: int) -> str:
    normalized = " ".join(str(value).split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[:limit]}..."


def _release_evidence_rows(items: list[dict], latest_records: dict[str, ReleaseEvidenceRecord]) -> str:
    if not items:
        return '<tr><td colspan="6">남은 수동 증빙 항목이 없습니다.</td></tr>'
    rows = []
    for item in items:
        latest = latest_records.get(_release_evidence_item_key(item))
        status_cell = _release_evidence_status_cell(latest)
        evidence = "".join(f"<li>{escape(value)}</li>" for value in item["evidence"])
        references = "".join(f"<li><code>{escape(value)}</code></li>" for value in item["reference"])
        rows.append(
            "<tr>"
            f"<td>{status_cell}</td>"
            f"<td>{escape(item['group'])}</td>"
            f"<td><strong>{escape(item['label'])}</strong><div class=\"sub\">{escape(item['section'])}</div></td>"
            f"<td><ul>{evidence}</ul></td>"
            f"<td>{escape(item['action'])}</td>"
            f"<td><ul>{references}</ul></td>"
            "</tr>"
        )
    return "\n".join(rows)


def _release_evidence_status_cell(record: ReleaseEvidenceRecord | None) -> str:
    if record is None:
        return '<span class="pill warn">미기록</span>'
    css_class = "ok" if record.result == "완료" else "warn"
    detail = _format_datetime(record.checked_at)
    return (
        f'<span class="pill {css_class}">{escape(record.result)}</span>'
        f'<div class="sub">{escape(detail)}</div>'
    )


def _admin_play_html() -> str:
    readiness = play_release_summary()
    summary = readiness["summary"]
    status = readiness["status"]
    status_label = "등록 준비 확인 필요" if status == "manual" else "등록 준비 완료"
    status_class = "warn" if status == "manual" else "ok"
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote Google Play 등록 준비</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --amber: #d97706;
      --red: #dc2626;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }}
    .card, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    .card {{
      padding: 18px;
      min-height: 112px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .ok {{ color: var(--green); }}
    .warn {{ color: var(--amber); }}
    .bad {{ color: var(--red); }}
    section {{
      margin-top: 14px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    ul {{
      margin: 0;
      padding-left: 18px;
      color: var(--muted);
      line-height: 1.6;
    }}
    @media (max-width: 800px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .cards {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>NowNote Google Play 등록 준비</h1>
        <div class="sub">등록 문서, 이미지 초안, 수동 확인 항목을 확인합니다</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/release">1차 준비</a>
        <a href="/admin/evidence">수동 증빙</a>
        <a href="/admin/mobile">모바일 점검</a>
        <a href="/admin/open-source">공개 준비</a>
        <a href="/privacy">개인정보방침</a>
        <a href="/admin/deploy">배포</a>
        <a href="/admin/help">도움말</a>
      </nav>
    </header>

    <div class="cards">
      <div class="card">
        <div class="label">상태</div>
        <div class="value {status_class}">{status_label}</div>
      </div>
      <div class="card">
        <div class="label">자동 확인</div>
        <div class="value">{summary["auto_ok"]}/{summary["auto_total"]}</div>
      </div>
      <div class="card">
        <div class="label">경고</div>
        <div class="value {'bad' if summary['warnings'] else 'ok'}">{summary["warnings"]}</div>
      </div>
      <div class="card">
        <div class="label">수동 확인</div>
        <div class="value warn">{summary["manual"]}</div>
        <div class="sub"><a href="/api/v1/admin/play-release">JSON API</a></div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>자동 확인 항목</span>
        <span class="sub">문서와 이미지 초안 기준</span>
      </div>
      <table>
        <tr><th>항목</th><th>상태</th><th>내용</th></tr>
        {_play_check_rows(readiness["checks"])}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>Play Console 수동 확인</span>
        <span class="sub">사람이 화면에서 최종 확정</span>
      </div>
      <table>
        <tr><th>남은 항목</th></tr>
        {_play_manual_rows(readiness["manual_items"])}
      </table>
    </section>
  </main>
</body>
</html>"""


def _play_check_rows(checks: list[dict]) -> str:
    if not checks:
        return '<tr><td colspan="3">확인 항목이 없습니다.</td></tr>'
    rows = []
    labels = {"ok": "정상", "warn": "확인 필요", "manual": "수동"}
    for check in checks:
        status = check["status"]
        rows.append(
            "<tr>"
            f"<td>{escape(check['name'])}</td>"
            f'<td class="{escape(status)}">{escape(labels.get(status, status))}</td>'
            f"<td>{escape(check['message'])}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _play_manual_rows(items: list[str]) -> str:
    if not items:
        return '<tr><td>남은 수동 확인 항목이 없습니다.</td></tr>'
    return "\n".join(f"<tr><td>{escape(item)}</td></tr>" for item in items)


def _admin_open_source_html() -> str:
    readiness = open_source_release_summary()
    summary = readiness["summary"]
    status = readiness["status"]
    status_label = "공개 전 확인 필요" if status == "manual" else "공개 준비 완료"
    status_class = "warn" if status == "manual" else "ok"
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 공개 저장소 준비</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
      --green: #16a34a;
      --amber: #d97706;
      --red: #dc2626;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }}
    .card, section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    .card {{
      padding: 18px;
      min-height: 112px;
    }}
    .label {{
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 12px;
    }}
    .value {{
      font-size: 24px;
      font-weight: 750;
      letter-spacing: 0;
    }}
    .ok {{ color: var(--green); }}
    .warn {{ color: var(--amber); }}
    .bad {{ color: var(--red); }}
    section {{
      margin-top: 14px;
      overflow: hidden;
    }}
    .section-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      font-weight: 700;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 13px 18px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 14px;
      vertical-align: top;
    }}
    th {{
      color: var(--muted);
      font-weight: 600;
      background: #fafafa;
    }}
    tr:last-child td {{ border-bottom: 0; }}
    @media (max-width: 800px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .cards {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>NowNote 공개 저장소 준비</h1>
        <div class="sub">공개 문서, 템플릿, Actions, 라이선스 보류 항목을 확인합니다</div>
      </div>
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/release">1차 준비</a>
        <a href="/admin/evidence">수동 증빙</a>
        <a href="/admin/mobile">모바일 점검</a>
        <a href="/admin/play">Play 등록</a>
        <a href="/admin/help">도움말</a>
      </nav>
    </header>

    <div class="cards">
      <div class="card">
        <div class="label">상태</div>
        <div class="value {status_class}">{status_label}</div>
      </div>
      <div class="card">
        <div class="label">자동 확인</div>
        <div class="value">{summary["auto_ok"]}/{summary["auto_total"]}</div>
      </div>
      <div class="card">
        <div class="label">경고</div>
        <div class="value {'bad' if summary['warnings'] else 'ok'}">{summary["warnings"]}</div>
      </div>
      <div class="card">
        <div class="label">수동 확인</div>
        <div class="value warn">{summary["manual"]}</div>
        <div class="sub"><a href="/api/v1/admin/open-source-release">JSON API</a></div>
      </div>
    </div>

    <section>
      <div class="section-head">
        <span>자동 확인 항목</span>
        <span class="sub">공개 문서와 GitHub 설정 파일 기준</span>
      </div>
      <table>
        <tr><th>항목</th><th>상태</th><th>내용</th></tr>
        {_open_source_check_rows(readiness["checks"])}
      </table>
    </section>

    <section>
      <div class="section-head">
        <span>공개 전 수동 확인</span>
        <span class="sub">사람이 최종 확정</span>
      </div>
      <table>
        <tr><th>남은 항목</th></tr>
        {_open_source_manual_rows(readiness["manual_items"])}
      </table>
    </section>
  </main>
</body>
</html>"""


def _open_source_check_rows(checks: list[dict]) -> str:
    if not checks:
        return '<tr><td colspan="3">확인 항목이 없습니다.</td></tr>'
    rows = []
    labels = {"ok": "정상", "warn": "확인 필요", "manual": "수동"}
    for check in checks:
        status = check["status"]
        rows.append(
            "<tr>"
            f"<td>{escape(check['name'])}</td>"
            f'<td class="{escape(status)}">{escape(labels.get(status, status))}</td>'
            f"<td>{escape(check['message'])}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _open_source_manual_rows(items: list[str]) -> str:
    if not items:
        return '<tr><td>남은 수동 확인 항목이 없습니다.</td></tr>'
    return "\n".join(f"<tr><td>{escape(item)}</td></tr>" for item in items)


def _admin_mobile_html() -> str:
    return _admin_markdown_doc_html(
        filename="../now_app/docs/mobile_runtime_checklist_ko.md",
        title="NowNote 모바일 실제 실행 점검",
        subtitle="실제 Android 기기, 음성 메모, 녹음 업로드 확인 순서를 봅니다",
        missing_message="now_app/docs/mobile_runtime_checklist_ko.md 파일을 찾을 수 없습니다.",
        nav_links=[
            ("/admin", "관리"),
            ("/admin/release", "1차 준비"),
            ("/admin/play", "Play 등록"),
            ("/admin/deploy", "배포"),
            ("/admin/help", "도움말"),
        ],
    )


def _admin_recovery_html() -> str:
    return _admin_markdown_doc_html(
        filename="RECOVERY.md",
        title="NowNote 서버 복구 절차",
        subtitle="백업 검증, 서버 점검, 복구 판단 기준을 확인합니다",
        missing_message="RECOVERY.md 파일을 찾을 수 없습니다.",
        nav_links=[
            ("/admin", "관리"),
            ("/admin/export", "내보내기"),
            ("/admin/ops", "점검"),
            ("/admin/deploy", "배포"),
            ("/admin/help", "도움말"),
        ],
    )


def _admin_public_html() -> str:
    return _admin_markdown_doc_html(
        filename="../docs/SERVER_AUTH_POLICY.md",
        title="NowNote 공용 서버 준비",
        subtitle="사용자별 토큰, 로그인, 2단계 인증, 데이터 격리 기준을 확인합니다",
        missing_message="docs/SERVER_AUTH_POLICY.md 파일을 찾을 수 없습니다.",
        lead_html=_public_route_summary_html(),
        nav_links=[
            ("/admin", "관리"),
            ("/admin/users", "사용자"),
            ("/admin/devices", "기기"),
            ("/admin/ops", "점검"),
            ("/admin/deploy", "배포"),
            ("/admin/help", "도움말"),
        ],
    )


def _public_route_summary_html() -> str:
    summary = public_route_summary()
    status_label = {
        "ok": "정상",
        "warn": "주의",
        "bad": "확인 필요",
        "planned": "대기",
    }.get(str(summary.get("status")), str(summary.get("status")))
    public_base_url = str(summary.get("public_base_url") or "미설정")
    checks = summary.get("checks", [])
    ok_count = sum(1 for check in checks if check.get("status") == "ok")
    check_count = len(checks)
    cards = [
        ("공개 연결 상태", status_label),
        ("공개 URL", public_base_url),
        ("확인 항목", f"{ok_count}/{check_count} OK"),
    ]
    npm_cards = [
        ("Nginx Proxy Manager Scheme", "http"),
        ("Forward Hostname/IP", "now-api"),
        ("Forward Port", "8080"),
        ("대체 연결값", "서버 IP 또는 호스트명:8750"),
        ("도메인 연결", "루트 전체를 NowNote 서버로 연결"),
        ("Web 확인", f"{public_base_url or 'https://nownote.sinsan.kr'}/"),
        ("개인정보처리방침", f"{public_base_url or 'https://nownote.sinsan.kr'}/privacy"),
        ("API 확인", f"{public_base_url or 'https://nownote.sinsan.kr'}/api/v1/server"),
        ("HTML 반환 시", "정적 페이지나 다른 컨테이너로 연결된 상태"),
    ]
    card_html = "\n".join(
        '<div class="runtime-card">'
        f'<div class="label">{escape(label)}</div>'
        f'<div class="value">{escape(value)}</div>'
        "</div>"
        for label, value in cards
    )
    npm_card_html = "\n".join(
        '<div class="runtime-card">'
        f'<div class="label">{escape(label)}</div>'
        f'<div class="value">{escape(value)}</div>'
        "</div>"
        for label, value in npm_cards
    )
    rows = "\n".join(
        '<div class="runtime-card">'
        f'<div class="label">{escape(str(check.get("name", "")))} · {escape(str(check.get("status", "")))}</div>'
        f'<div class="value">{escape(str(check.get("message", "")))}</div>'
        "</div>"
        for check in checks
        if isinstance(check, dict)
    )
    return (
        '<div class="runtime-grid">'
        f"{card_html}"
        "</div>"
        '<div class="runtime-links">'
        '<a href="/api/v1/admin/public-route">공개 연결 JSON</a>'
        '<a href="/api/v1/server">서버 정보 API</a>'
        '<a href="/admin/ops">운영 점검</a>'
        "</div>"
        '<div class="runtime-grid">'
        f"{npm_card_html}"
        "</div>"
        '<div class="runtime-grid">'
        f"{rows}"
        "</div>"
    )


def _admin_deploy_html() -> str:
    return _admin_markdown_doc_html(
        filename="DEPLOY.md",
        title="NowNote 배포 체크리스트",
        subtitle="WSL/Docker 서버 갱신과 확인 순서를 봅니다",
        missing_message="DEPLOY.md 파일을 찾을 수 없습니다.",
        lead_html=_deploy_runtime_summary_html(),
        nav_links=[
            ("/admin", "관리"),
            ("/admin/ops", "점검"),
            ("/admin/recovery", "복구"),
            ("/admin/help", "도움말"),
        ],
    )


def _admin_markdown_doc_html(
    *,
    filename: str,
    title: str,
    subtitle: str,
    missing_message: str,
    nav_links: list[tuple[str, str]],
    lead_html: str = "",
) -> str:
    doc_path = Path(__file__).resolve().parents[2] / filename
    if doc_path.exists():
        content = doc_path.read_text(encoding="utf-8")
    else:
        content = missing_message
    nav_html = "\n".join(
        f'        <a href="{escape(href)}">{escape(label)}</a>'
        for href, label in nav_links
    )
    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)}</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #e5e7eb;
      --blue: #2563eb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    main {{
      max-width: 1040px;
      margin: 0 auto;
      padding: 32px 18px 48px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 22px;
    }}
    h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    a {{
      color: var(--blue);
      text-decoration: none;
      font-weight: 650;
    }}
    .sub {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }}
    .nav {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .nav a {{
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      font-size: 13px;
    }}
    .runtime-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }}
    .runtime-card {{
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 14px 16px;
      min-height: 90px;
    }}
    .runtime-card .label {{
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
    }}
    .runtime-card .value {{
      font-weight: 750;
      overflow-wrap: anywhere;
    }}
    .runtime-links {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 14px;
    }}
    .runtime-links a {{
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      font-size: 13px;
    }}
    pre {{
      margin: 0;
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      white-space: pre-wrap;
      word-break: keep-all;
      overflow-wrap: anywhere;
      line-height: 1.7;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
    }}
    @media (max-width: 760px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
      .runtime-grid {{ grid-template-columns: 1fr; }}
      main {{ padding: 22px 12px 36px; }}
      h1 {{ font-size: 24px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>{escape(title)}</h1>
        <div class="sub">{escape(subtitle)}</div>
      </div>
      <nav class="nav">
{nav_html}
      </nav>
    </header>
    {lead_html}
    <pre>{escape(content)}</pre>
  </main>
</body>
</html>"""


def _deploy_runtime_summary_html() -> str:
    settings = get_settings()
    public_base_url = (settings.public_base_url or "").strip() or "미설정"
    user_token_state = "필수" if settings.user_token_required else "선택"
    reverse_proxy_state = "사용" if settings.behind_reverse_proxy else "미사용"
    api_token_state = "설정됨" if settings.api_token and not settings.api_token.startswith("change-this") else "미설정 또는 예시값"
    cards = [
        ("서버 이름", settings.server_name),
        ("API 토큰", api_token_state),
        ("사용자별 접속 토큰", user_token_state),
        ("공개 URL", public_base_url),
        ("Reverse proxy", reverse_proxy_state),
        ("녹음 저장소", settings.storage_dir),
    ]
    card_html = "\n".join(
        '<div class="runtime-card">'
        f'<div class="label">{escape(label)}</div>'
        f'<div class="value">{escape(value)}</div>'
        "</div>"
        for label, value in cards
    )
    links = [
        ("/health", "Health"),
        ("/health/ready", "Ready"),
        ("/api/v1/server", "서버 정보 API"),
        ("/admin/ops", "운영 점검"),
        ("/admin/export", "백업 내보내기"),
        ("/admin/recovery", "복구 절차"),
    ]
    link_html = "\n".join(
        f'<a href="{escape(href)}">{escape(label)}</a>'
        for href, label in links
    )
    return (
        '<div class="runtime-grid">'
        f"{card_html}"
        "</div>"
        '<div class="runtime-links">'
        f"{link_html}"
        "</div>"
    )


def _export_link_rows(links: list[tuple[str, str, str, int]]) -> str:
    return "\n".join(
        "<tr>"
        f"<td>{escape(name)}</td>"
        f"<td>{escape(description)}</td>"
        f"<td>{count}</td>"
        f'<td><a href="{escape(url)}">{escape(url)}</a></td>'
        "</tr>"
        for name, url, description, count in links
    )


def _backup_verify_example() -> str:
    return """curl -X POST http://localhost:8750/api/v1/admin/export/verify \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -d '{"backup": { ... 전체 백업 JSON ... }}'"""


def _export_summary_counts_for_page() -> dict[str, int]:
    with SessionLocal() as db:
        settings = get_settings()
        note_total = db.scalar(select(func.count()).select_from(Note)) or 0
        active_notes = (
            db.scalar(select(func.count()).select_from(Note).where(Note.deleted_at.is_(None)))
            or 0
        )
        recordings = db.scalar(select(func.count()).select_from(Recording)) or 0
        users = db.scalar(select(func.count()).select_from(UserAccount)) or 0
        devices = db.scalar(select(func.count()).select_from(UserDevice)) or 0
        analysis_jobs = db.scalar(select(func.count()).select_from(AnalysisJob)) or 0
        sync_logs = db.scalar(select(func.count()).select_from(SyncLog)) or 0
        recording_storage_paths = list(db.scalars(select(Recording.storage_path)).all())
        recording_orphan_files = _recording_storage_orphan_count(
            settings.storage_dir,
            recording_storage_paths,
        )
        recording_rows = list(db.scalars(select(Recording)).all())
        recording_missing_files = len(_recording_missing_files(recording_rows))
        return {
            "notes": note_total,
            "active_notes": active_notes,
            "deleted_notes": note_total - active_notes,
            "recordings": recordings,
            "recording_orphan_files": recording_orphan_files,
            "recording_missing_files": recording_missing_files,
            "users": users,
            "devices": devices,
            "analysis_jobs": analysis_jobs,
            "sync_logs": sync_logs,
            "total_export_items": note_total + recordings + users + devices + analysis_jobs + sync_logs,
        }
