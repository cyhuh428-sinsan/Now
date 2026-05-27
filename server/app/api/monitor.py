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
from app.models.note import AnalysisJob, Note, Recording, SyncLog, UserAccount, UserDevice
from app.services.user_accounts import create_user_account, issue_user_access_token, update_user_account
from app.services.user_devices import set_user_device_active

router = APIRouter(tags=["monitor"])
basic_security = HTTPBasic(auto_error=False)


@router.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/monitor")


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
        headers={"WWW-Authenticate": 'Basic realm="NowNote 관리"'},
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
      <div class="badge">API 토큰: {auth_required}</div>
    </header>

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
      <nav class="nav">
        <a href="/monitor">모니터</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/users">사용자</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/admin/analysis">분석</a>
        <a href="/admin/public">공용 서버</a>
        <a href="/admin/help">도움말</a>
        <a href="/docs">API 문서</a>
        <a href="/health/ready">준비 상태</a>
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
      <nav class="nav">
        <a href="/admin">관리</a>
        <a href="/admin/notes">메모</a>
        <a href="/admin/recordings">녹음</a>
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/admin/help">도움말</a>
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
      <div class="section-head"><span>그룹별 사용자</span><span class="sub">운영 권한 분류 기준</span></div>
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
        <input type="text" name="group_name" value="사용자">
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
        <input type="text" name="group_name" value="{escape(user.group_name, quote=True)}">
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
          <li>앱 설정에 서버 주소와 API 토큰을 입력합니다.</li>
          <li>사용자별 시간대, 2단계 인증 사용 여부, 그룹, 활성 상태를 관리합니다.</li>
          <li>현재 2단계 인증은 사용 여부 관리 상태이며, 실제 로그인 2단계 인증 절차는 이후 연결합니다.</li>
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


def _admin_recovery_html() -> str:
    return _admin_markdown_doc_html(
        filename="RECOVERY.md",
        title="NowNote 복구 절차",
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
        nav_links=[
            ("/admin", "관리"),
            ("/admin/users", "사용자"),
            ("/admin/devices", "기기"),
            ("/admin/ops", "점검"),
            ("/admin/deploy", "배포"),
            ("/admin/help", "도움말"),
        ],
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
