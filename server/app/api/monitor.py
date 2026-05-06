from datetime import datetime
from html import escape
from secrets import compare_digest

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, select, text

from app.core.config import get_settings
from app.db import SessionLocal
from app.models.note import AnalysisJob, Note, Recording

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
        headers={"WWW-Authenticate": 'Basic realm="NowNote Admin"'},
    )


@router.get("/admin", include_in_schema=False)
def admin(_: None = Depends(_require_monitor_access)) -> HTMLResponse:
    return HTMLResponse(_admin_html())


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

    auth_required = "ON" if settings.api_token else "OFF"
    server_name = escape(settings.server_name)
    latest_note_label = _format_datetime(latest_note_at)
    job_rows = _job_rows(job_status_counts)

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>NowNote Monitor</title>
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
      <div class="badge">API Token: {auth_required}</div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="label">API 상태</div>
        <div class="value {'ok' if status == 'ready' else 'bad'}">{status}</div>
      </div>
      <div class="card">
        <div class="label">DB 상태</div>
        <div class="value {'ok' if db_status == 'ready' else 'bad'}">{db_status}</div>
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
  <title>NowNote Admin</title>
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
        <h1>NowNote Admin</h1>
        <div class="sub">읽기 전용 관리 화면 · 운영 설정과 처리 현황 확인</div>
      </div>
      <nav class="nav">
        <a href="/monitor">Monitor</a>
        <a href="/docs">API Docs</a>
        <a href="/health/ready">Ready</a>
      </nav>
    </header>

    <div class="grid">
      <div class="card">
        <div class="label">API Token</div>
        <div class="value {api_token_class}">{api_token_state}</div>
      </div>
      <div class="card">
        <div class="label">LLM Provider</div>
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
    if api_token:
        return ""
    return (
        '<div class="notice">'
        "현재 API Token이 꺼져 있습니다. 공용 서버로 열기 전에는 "
        "NOW_API_TOKEN을 반드시 설정해야 합니다."
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
