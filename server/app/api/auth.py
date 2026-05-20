from datetime import datetime
from html import escape
from secrets import compare_digest

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.note import UserAccount
from app.services.user_accounts import hash_access_token

api_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
page_router = APIRouter(tags=["auth"])


class TokenLoginRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    access_token: str = Field(min_length=1)


@api_router.post("/token-login")
def token_login(payload: TokenLoginRequest, db: Session = Depends(get_db)) -> dict:
    user = _authenticate_user_token(db, payload.owner_id, payload.access_token)
    return {"status": "ok", "user": _user_payload(user)}


@page_router.get("/auth/token", include_in_schema=False)
def token_login_page() -> HTMLResponse:
    return HTMLResponse(_token_login_html())


@page_router.post("/auth/token", include_in_schema=False)
def submit_token_login(
    owner_id: str = Form(...),
    access_token: str = Form(...),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    try:
        user = _authenticate_user_token(db, owner_id, access_token)
    except HTTPException as exc:
        return HTMLResponse(
            _token_login_html(error_message=str(exc.detail)),
            status_code=exc.status_code,
        )
    return HTMLResponse(_token_login_html(user=_user_payload(user)))


def _authenticate_user_token(db: Session, owner_id: str, access_token: str) -> UserAccount:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id.strip()))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    if not bool(user.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user inactive")
    if not user.access_token_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user token not issued")
    if not compare_digest(hash_access_token(access_token.strip()), user.access_token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid user token")

    now = datetime.utcnow()
    user.access_token_last_used_at = now
    user.last_login_at = now
    user.last_seen_at = now
    db.commit()
    db.refresh(user)
    return user


def _user_payload(user: UserAccount) -> dict:
    return {
        "owner_id": user.owner_id,
        "email": user.email,
        "display_name": user.display_name,
        "timezone": user.timezone,
        "group_name": user.group_name,
        "two_factor_enabled": bool(user.two_factor_enabled),
        "is_active": bool(user.is_active),
        "last_seen_at": user.last_seen_at,
        "last_login_at": user.last_login_at,
        "access_token_issued_at": user.access_token_issued_at,
        "access_token_last_used_at": user.access_token_last_used_at,
    }


def _token_login_html(user: dict | None = None, error_message: str = "") -> str:
    status_block = ""
    if user is not None:
        status_block = f"""
        <section class="result ok">
          <strong>토큰 확인 완료</strong>
          <p>{escape(str(user.get("display_name") or user.get("owner_id") or ""))} 계정으로 접속할 수 있습니다.</p>
          <dl>
            <div><dt>사용자 ID</dt><dd>{escape(str(user.get("owner_id") or ""))}</dd></div>
            <div><dt>시간대</dt><dd>{escape(str(user.get("timezone") or ""))}</dd></div>
            <div><dt>그룹</dt><dd>{escape(str(user.get("group_name") or ""))}</dd></div>
          </dl>
        </section>
        """
    elif error_message:
        status_block = f"""
        <section class="result warn">
          <strong>토큰 확인 실패</strong>
          <p>{escape(error_message)}</p>
        </section>
        """

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NowNote 토큰 확인</title>
  <style>
    :root {{
      color-scheme: light;
      --ink:#1f2937;
      --muted:#667085;
      --line:#d8e0ec;
      --brand:#2f5d8c;
      --bg:#f6f8fb;
      --panel:#ffffff;
    }}
    * {{ box-sizing:border-box; }}
    body {{
      margin:0;
      min-height:100vh;
      display:grid;
      place-items:center;
      background:var(--bg);
      color:var(--ink);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }}
    main {{
      width:min(520px, calc(100vw - 32px));
      background:var(--panel);
      border:1px solid var(--line);
      border-radius:10px;
      padding:28px;
      box-shadow:0 18px 45px rgba(31,41,55,.08);
    }}
    h1 {{ margin:0 0 8px; font-size:24px; }}
    p {{ color:var(--muted); line-height:1.55; }}
    label {{ display:block; margin-top:16px; font-weight:700; }}
    input {{
      width:100%;
      margin-top:8px;
      border:1px solid var(--line);
      border-radius:8px;
      min-height:44px;
      padding:0 12px;
      font:inherit;
    }}
    button {{
      width:100%;
      margin-top:20px;
      min-height:46px;
      border:0;
      border-radius:8px;
      background:var(--brand);
      color:white;
      font-weight:800;
      cursor:pointer;
    }}
    .result {{
      margin-top:20px;
      border:1px solid var(--line);
      border-radius:8px;
      padding:16px;
    }}
    .ok {{ border-color:#9cc8a7; background:#f3fbf5; }}
    .warn {{ border-color:#f0bd9b; background:#fff7ed; }}
    dl {{ margin:12px 0 0; }}
    dl div {{ display:flex; justify-content:space-between; gap:16px; padding:6px 0; }}
    dt {{ color:var(--muted); }}
    dd {{ margin:0; font-weight:700; }}
  </style>
</head>
<body>
  <main>
    <h1>NowNote 토큰 확인</h1>
    <p>관리자에게 받은 사용자별 접속 토큰이 현재 서버에서 유효한지 확인합니다.</p>
    <form method="post" action="/auth/token">
      <label for="owner_id">사용자 ID</label>
      <input id="owner_id" name="owner_id" autocomplete="username" required>
      <label for="access_token">사용자별 접속 토큰</label>
      <input id="access_token" name="access_token" type="password" autocomplete="current-password" required>
      <button type="submit">토큰 확인</button>
    </form>
    {status_block}
  </main>
</body>
</html>"""
