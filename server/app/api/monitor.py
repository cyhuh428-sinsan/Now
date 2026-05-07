from datetime import datetime
from html import escape
from pathlib import Path
from secrets import compare_digest

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, select, text

from app.core.config import get_settings
from app.db import SessionLocal
from app.models.note import AnalysisJob, Note, Recording, SyncLog

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
def admin_analysis(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_analysis_html())


@router.get("/admin/notes", include_in_schema=False)
def admin_notes(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_notes_html())


@router.get("/admin/recordings", include_in_schema=False)
def admin_recordings(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_recordings_html())


@router.get("/admin/devices", include_in_schema=False)
def admin_devices(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_devices_html())


@router.get("/admin/ops", include_in_schema=False)
def admin_ops(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_ops_html())


@router.get("/admin/sync", include_in_schema=False)
def admin_sync(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_sync_html())


@router.get("/admin/export", include_in_schema=False)
def admin_export(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_export_html())


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
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
        <a href="/admin/devices">기기</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/admin/analysis">분석</a>
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


def _admin_analysis_html() -> str:
    error_message = ""
    status_counts: dict[str, int] = {}
    job_type_counts: dict[str, int] = {}
    recent_jobs: list[AnalysisJob] = []

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
            recent_jobs = list(
                db.scalars(
                    select(AnalysisJob).order_by(AnalysisJob.created_at.desc()).limit(50)
                ).all()
            )
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
        <span class="sub">최근 50건 · 원문은 앞부분만 표시</span>
      </div>
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


def _admin_notes_html() -> str:
    error_message = ""
    type_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    owner_counts: dict[str, int] = {}
    recent_notes: list[Note] = []

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
            recent_notes = list(
                db.scalars(select(Note).order_by(Note.updated_at.desc()).limit(100)).all()
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
        <span class="sub">최근 100건 · 내용은 앞부분만 표시</span>
      </div>
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


def _admin_recordings_html() -> str:
    error_message = ""
    content_type_counts: dict[str, int] = {}
    owner_counts: dict[str, int] = {}
    recent_recordings: list[Recording] = []
    latest_recording_at = None
    recording_total = 0
    transcript_count = 0

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
            recent_recordings = list(
                db.scalars(
                    select(Recording).order_by(Recording.updated_at.desc()).limit(100)
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
        <span class="sub">최근 100건 · transcript는 앞부분만 표시</span>
      </div>
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


def _admin_devices_html() -> str:
    error_message = ""
    devices: dict[tuple[str, str], dict[str, object]] = {}

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
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
            for owner_id, device_id, count, latest_at, client_latest_at in note_rows:
                devices[(owner_id, device_id)] = {
                    "owner_id": owner_id,
                    "device_id": device_id,
                    "note_count": count,
                    "recording_count": 0,
                    "latest_note_at": latest_at,
                    "latest_client_at": client_latest_at,
                    "latest_recording_at": None,
                }
            for owner_id, device_id, count, latest_at in recording_rows:
                key = (owner_id, device_id)
                if key not in devices:
                    devices[key] = {
                        "owner_id": owner_id,
                        "device_id": device_id,
                        "note_count": 0,
                        "recording_count": 0,
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
            item["latest_note_at"] or item["latest_recording_at"] or datetime.min
        ),
        reverse=True,
    )

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
        <a href="/admin/analysis">분석</a>
        <a href="/admin/sync">동기화</a>
        <a href="/admin/ops">점검</a>
        <a href="/admin/export">내보내기</a>
        <a href="/monitor">모니터</a>
        <a href="/docs">API 문서</a>
      </nav>
    </header>

    <section>
      <div class="section-head">
        <span>기기별 동기화 현황</span>
        <span class="sub">{len(device_rows)}개 device</span>
      </div>
      <table>
        <tr>
          <th>Owner</th>
          <th>Device</th>
          <th>메모</th>
          <th>녹음</th>
          <th>마지막 메모 변경</th>
          <th>마지막 클라이언트 변경</th>
          <th>마지막 녹음 변경</th>
        </tr>
        {_admin_device_rows(device_rows)}
      </table>
    </section>

    {_error_block(error_message)}
  </main>
</body>
</html>"""


def _admin_device_rows(devices: list[dict[str, object]]) -> str:
    if not devices:
        return '<tr><td colspan="7">연결된 기기 흔적이 없습니다.</td></tr>'
    return "\n".join(
        "<tr>"
        f"<td class=\"mono\">{escape(str(device['owner_id']))}</td>"
        f"<td class=\"mono\">{escape(str(device['device_id']))}</td>"
        f"<td>{device['note_count']}</td>"
        f"<td>{device['recording_count']}</td>"
        f"<td>{_format_datetime(device['latest_note_at'])}</td>"
        f"<td>{_format_datetime(device['latest_client_at'])}</td>"
        f"<td>{_format_datetime(device['latest_recording_at'])}</td>"
        "</tr>"
        for device in devices
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

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            note_total = db.scalar(select(func.count()).select_from(Note)) or 0
            recording_total = db.scalar(select(func.count()).select_from(Recording)) or 0
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


def _admin_sync_html() -> str:
    error_message = ""
    sync_total = 0
    latest_sync_at = None
    recent_logs: list[SyncLog] = []
    device_counts: dict[str, int] = {}

    try:
        with SessionLocal() as db:
            db.execute(text("select 1"))
            sync_total = db.scalar(select(func.count()).select_from(SyncLog)) or 0
            latest_sync_at = db.scalar(select(func.max(SyncLog.created_at)))
            recent_logs = list(
                db.scalars(
                    select(SyncLog).order_by(SyncLog.created_at.desc()).limit(100)
                ).all()
            )
            rows = db.execute(
                select(SyncLog.owner_id, SyncLog.device_id, func.count())
                .group_by(SyncLog.owner_id, SyncLog.device_id)
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
        <span class="sub">최근 100건</span>
      </div>
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


def _admin_export_html() -> str:
    export_links = [
        ("Notes", "/api/v1/admin/export/notes", "메모 전체 export"),
        ("삭제 제외 메모", "/api/v1/admin/export/notes?include_deleted=false", "삭제 표시 제외 메모 export"),
        ("Recordings", "/api/v1/admin/export/recordings", "녹음 파일 메타데이터 export"),
        ("분석 작업", "/api/v1/admin/export/analysis-jobs", "분석 작업 이력 export"),
        ("동기화 이력", "/api/v1/admin/export/sync-logs", "동기화 호출 이력 export"),
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
    @media (max-width: 760px) {{
      header {{ display: block; }}
      .nav {{ margin-top: 14px; }}
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
      </nav>
    </header>

    <div class="notice">
      원본 음성 파일 자체는 내려받지 않고, 녹음 파일의 메타데이터만 export합니다.
    </div>

    <section>
      <div class="section-head">
        <span>내보내기 링크</span>
        <span class="sub">JSON</span>
      </div>
      <table>
        <tr><th>항목</th><th>설명</th><th>링크</th></tr>
        {_export_link_rows(export_links)}
      </table>
    </section>
  </main>
</body>
</html>"""


def _export_link_rows(links: list[tuple[str, str, str]]) -> str:
    return "\n".join(
        "<tr>"
        f"<td>{escape(name)}</td>"
        f"<td>{escape(description)}</td>"
        f'<td><a href="{escape(url)}">{escape(url)}</a></td>'
        "</tr>"
        for name, url, description in links
    )
