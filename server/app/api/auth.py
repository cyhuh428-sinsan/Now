import hmac
import secrets
import time
from datetime import datetime, timedelta
from html import escape
from pathlib import Path
from secrets import compare_digest

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models.note import AnalysisJob, GroupMessage, GroupMessageRead, Note, Recording, SyncLog, UserAccount, UserDevice, WebSession
from app.services.user_accounts import (
    create_user_account,
    hash_access_token,
    issue_user_device_access_token,
    issue_web_session,
    require_web_session_access,
    revoke_web_session,
    set_user_password,
    verify_password,
)
from app.services.email_delivery import send_password_reset_email

api_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
page_router = APIRouter(tags=["auth"])


class TokenLoginRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    access_token: str = Field(min_length=1)
    two_factor_code: str | None = Field(default=None, max_length=20)


class WebLoginRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    password: str = Field(min_length=1)
    device_id: str | None = Field(default=None, max_length=120)
    two_factor_code: str | None = Field(default=None, max_length=20)


class ClientLoginRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    password: str = Field(min_length=1)
    device_id: str = Field(default="desktop", max_length=120)
    device_name: str | None = Field(default=None, max_length=120)
    two_factor_code: str | None = Field(default=None, max_length=20)


class RegisterRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    password: str = Field(min_length=10, max_length=200)
    email: str = Field(min_length=3, max_length=240)
    display_name: str | None = Field(default=None, max_length=120)
    timezone: str = Field(default="Asia/Seoul", max_length=80)
    device_id: str = Field(default="web-client", max_length=120)
    device_name: str | None = Field(default=None, max_length=120)


class DeleteAccountRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    password: str = Field(min_length=1)


class DeviceTokenRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    device_id: str = Field(default="desktop", max_length=120)
    device_name: str | None = Field(default=None, max_length=120)


class PasswordResetRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    email: str = Field(min_length=3, max_length=240)


class PasswordResetConfirmRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    reset_code: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=200)


@api_router.post("/token-login")
def token_login(payload: TokenLoginRequest, db: Session = Depends(get_db)) -> dict:
    user = _authenticate_user_token(
        db,
        payload.owner_id,
        payload.access_token,
        two_factor_code=payload.two_factor_code,
    )
    return {"status": "ok", "user": _user_payload(user)}


@api_router.post("/client-login")
def client_login(payload: ClientLoginRequest, db: Session = Depends(get_db)) -> dict:
    user = _authenticate_user_password(
        db,
        payload.owner_id,
        payload.password,
        two_factor_code=payload.two_factor_code,
    )
    issued = issue_user_device_access_token(
        db,
        owner_id=user.owner_id,
        device_id=payload.device_id,
        display_name=payload.device_name,
    )
    if issued is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    device, access_token = issued
    db.commit()
    db.refresh(user)
    db.refresh(device)
    return {
        "status": "ok",
        "access_token": access_token,
        "device_id": device.device_id,
        "user": _user_payload(user),
    }


@api_router.post("/register")
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    settings = get_settings()
    if not settings.self_registration_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="self registration disabled")
    if not _valid_owner_id(payload.owner_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="owner_id must use letters, numbers, dot, underscore, or hyphen",
        )
    if not _valid_email(payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="valid email required")
    user = create_user_account(
        db,
        owner_id=payload.owner_id,
        password=payload.password,
        email=payload.email,
        display_name=payload.display_name,
        timezone=payload.timezone,
        group_name="사용자",
        two_factor_enabled=False,
        is_active=True,
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="user already exists")
    user.confirmed_at = datetime.utcnow()
    db.flush()
    issued = issue_user_device_access_token(
        db,
        owner_id=user.owner_id,
        device_id=payload.device_id,
        display_name=payload.device_name,
    )
    if issued is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="client token issue failed")
    device, access_token = issued
    session, session_token = issue_web_session(
        db,
        owner_id=user.owner_id,
        device_id=payload.device_id,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    db.refresh(user)
    db.refresh(device)
    db.refresh(session)
    return {
        "status": "ok",
        "access_token": access_token,
        "device_id": device.device_id,
        "session_token": session_token,
        "expires_at": session.expires_at,
        "user": _user_payload(user),
    }


@api_router.post("/web-login")
def web_login(
    payload: WebLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    user = _authenticate_user_password(
        db,
        payload.owner_id,
        payload.password,
        two_factor_code=payload.two_factor_code,
    )
    session, session_token = issue_web_session(
        db,
        owner_id=user.owner_id,
        device_id=payload.device_id,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    db.refresh(user)
    db.refresh(session)
    return {
        "status": "ok",
        "session_token": session_token,
        "expires_at": session.expires_at,
        "user": _user_payload(user),
    }


@api_router.post("/delete-account")
def delete_account(payload: DeleteAccountRequest, db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    if not settings.self_account_delete_enabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="self account delete disabled")
    user = _authenticate_user_password(db, payload.owner_id, payload.password)
    _delete_user_data(db, owner_id=user.owner_id)
    db.commit()
    return {"status": "ok"}


@api_router.post("/password-reset/request")
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == payload.owner_id.strip()))
    if user is None or (user.email or "").strip().lower() != payload.email.strip().lower():
        return {"status": "ok", "message": "password reset email sent if account exists"}
    reset_code = secrets.token_urlsafe(24)
    user.password_recovery_hash = hash_access_token(reset_code)
    user.password_recovery_issued_at = datetime.utcnow()
    try:
        send_password_reset_email(
            to_email=user.email or "",
            owner_id=user.owner_id,
            reset_code=reset_code,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    db.commit()
    return {"status": "ok", "message": "password reset email sent if account exists"}


@api_router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == payload.owner_id.strip()))
    if user is None or not user.password_recovery_hash or not user.password_recovery_issued_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid reset code")
    expires_at = user.password_recovery_issued_at + timedelta(minutes=get_settings().password_reset_code_minutes)
    if expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="reset code expired")
    if not compare_digest(hash_access_token(payload.reset_code.strip()), user.password_recovery_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid reset code")
    set_user_password(user, payload.new_password)
    user.password_recovery_hash = None
    user.password_recovery_issued_at = None
    user.is_active = 1
    db.commit()
    return {"status": "ok"}


@api_router.get("/web-session")
def web_session(
    owner_id: str,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_web_session_access(
        db,
        owner_id=owner_id,
        session_token=web_session_token,
    )
    db.commit()
    db.refresh(user)
    return {"status": "ok", "user": _user_payload(user)}


@api_router.post("/web-logout")
def web_logout(
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    if web_session_token:
        revoke_web_session(db, session_token=web_session_token)
        db.commit()
    return {"status": "ok"}


@api_router.post("/device-token")
def issue_device_token(
    payload: DeviceTokenRequest,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_web_session_access(
        db,
        owner_id=payload.owner_id.strip(),
        session_token=web_session_token,
    )
    issued = issue_user_device_access_token(
        db,
        owner_id=user.owner_id,
        device_id=payload.device_id,
        display_name=payload.device_name,
    )
    if issued is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    device, access_token = issued
    db.commit()
    db.refresh(device)
    db.refresh(user)
    return {
        "status": "ok",
        "access_token": access_token,
        "device_id": device.device_id,
        "user": _user_payload(user),
    }


@api_router.get("/device-tokens")
def list_device_tokens(
    owner_id: str,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_web_session_access(
        db,
        owner_id=owner_id.strip(),
        session_token=web_session_token,
    )
    devices = list(
        db.scalars(
            select(UserDevice)
            .where(UserDevice.owner_id == user.owner_id)
            .order_by(UserDevice.updated_at.desc(), UserDevice.id.desc())
        ).all()
    )
    db.commit()
    return {
        "status": "ok",
        "items": [
            {
                "device_id": device.device_id,
                "display_name": device.display_name,
                "access_token": device.access_token_value or "",
                "is_active": bool(device.is_active),
                "issued_at": device.access_token_issued_at,
                "last_used_at": device.access_token_last_used_at,
                "last_seen_at": device.last_seen_at,
            }
            for device in devices
            if device.access_token_value
        ],
    }


@page_router.get("/auth/token", include_in_schema=False)
def token_login_page() -> HTMLResponse:
    return HTMLResponse(_token_login_html())


@page_router.post("/auth/token", include_in_schema=False)
def submit_token_login(
    owner_id: str = Form(...),
    access_token: str = Form(...),
    two_factor_code: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    try:
        user = _authenticate_user_token(
            db,
            owner_id,
            access_token,
            two_factor_code=two_factor_code,
        )
    except HTTPException as exc:
        return HTMLResponse(
            _token_login_html(error_message=str(exc.detail)),
            status_code=exc.status_code,
        )
    return HTMLResponse(_token_login_html(user=_user_payload(user)))


def _authenticate_user_token(
    db: Session,
    owner_id: str,
    access_token: str,
    *,
    two_factor_code: str | None = None,
) -> UserAccount:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id.strip()))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    if not bool(user.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user inactive")
    token_hash = hash_access_token(access_token.strip())
    device = db.scalar(
        select(UserDevice).where(
            UserDevice.owner_id == user.owner_id,
            UserDevice.access_token_hash == token_hash,
        )
    )
    legacy_token_ok = bool(user.access_token_hash) and compare_digest(token_hash, user.access_token_hash)
    if device is None and not legacy_token_ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid user token")
    if device is not None and not bool(device.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="device inactive")
    if bool(user.two_factor_enabled):
        _require_two_factor_code(user.owner_id, access_token, two_factor_code)

    now = datetime.utcnow()
    if legacy_token_ok:
        user.access_token_last_used_at = now
    if device is not None:
        device.access_token_last_used_at = now
        device.last_seen_at = now
    user.last_login_at = now
    user.last_seen_at = now
    db.commit()
    db.refresh(user)
    return user


def _authenticate_user_password(
    db: Session,
    owner_id: str,
    password: str,
    *,
    two_factor_code: str | None = None,
) -> UserAccount:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id.strip()))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    if not bool(user.is_active):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user inactive")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid password")
    if bool(user.two_factor_enabled):
        _require_two_factor_code_for_secret(
            user.owner_id,
            user.password_hash or "",
            two_factor_code,
        )

    now = datetime.utcnow()
    user.last_login_at = now
    user.last_seen_at = now
    return user


def _require_two_factor_code(owner_id: str, access_token: str, supplied_code: str | None) -> None:
    _require_two_factor_code_for_secret(
        owner_id,
        hash_access_token(access_token.strip()),
        supplied_code,
    )


def _require_two_factor_code_for_secret(owner_id: str, secret: str, supplied_code: str | None) -> None:
    cleaned = (supplied_code or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="two factor code required",
        )
    current_step = int(time.time() // 30)
    valid_codes = {
        _two_factor_code(owner_id, secret, current_step + offset)
        for offset in (-1, 0, 1)
    }
    if cleaned not in valid_codes:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid two factor code",
        )


def _two_factor_code(owner_id: str, secret: str, step: int) -> str:
    message = f"{owner_id.strip()}:{step}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), message, "sha256").hexdigest()
    return str(int(digest[:12], 16) % 1_000_000).zfill(6)


def _valid_owner_id(owner_id: str) -> bool:
    cleaned = owner_id.strip()
    if not (3 <= len(cleaned) <= 80):
        return False
    return all(char.isalnum() or char in "._-" for char in cleaned)


def _valid_email(email: str) -> bool:
    cleaned = email.strip()
    return "@" in cleaned and "." in cleaned.rsplit("@", 1)[-1]


def _delete_user_data(db: Session, *, owner_id: str) -> None:
    recordings = list(db.scalars(select(Recording).where(Recording.owner_id == owner_id)).all())
    for recording in recordings:
        try:
            Path(recording.storage_path).unlink(missing_ok=True)
        except OSError:
            pass
    for model in (Note, Recording, AnalysisJob, SyncLog, UserDevice, WebSession):
        db.execute(delete(model).where(model.owner_id == owner_id))
    db.execute(delete(GroupMessage).where(GroupMessage.sender_owner_id == owner_id))
    db.execute(delete(GroupMessageRead).where(GroupMessageRead.owner_id == owner_id))
    db.execute(delete(UserAccount).where(UserAccount.owner_id == owner_id))


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
    <p>Web에서 발급한 앱/설치형 연결 토큰이 현재 서버에서 유효한지 확인합니다.</p>
    <form method="post" action="/auth/token">
      <label for="owner_id">사용자 ID</label>
      <input id="owner_id" name="owner_id" autocomplete="username" required>
      <label for="access_token">사용자별 접속 토큰</label>
      <input id="access_token" name="access_token" type="password" autocomplete="current-password" required>
      <label for="two_factor_code">2단계 인증 코드</label>
      <input id="two_factor_code" name="two_factor_code" inputmode="numeric" autocomplete="one-time-code" placeholder="사용 중일 때만 입력">
      <button type="submit">토큰 확인</button>
    </form>
    {status_block}
  </main>
</body>
</html>"""
