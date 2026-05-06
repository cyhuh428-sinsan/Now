from datetime import datetime
from html import escape

from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import func, select, text

from app.core.config import get_settings
from app.db import SessionLocal
from app.models.note import AnalysisJob, Note, Recording

router = APIRouter(tags=["monitor"])


@router.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/monitor")


@router.get("/admin", include_in_schema=False)
def admin() -> RedirectResponse:
    return RedirectResponse(url="/monitor")


@router.get("/monitor", response_class=HTMLResponse, include_in_schema=False)
def monitor() -> str:
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
