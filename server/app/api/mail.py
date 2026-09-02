from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import UserAccount
from app.services.mail_settings import (
    delete_worklog_mail_recipient,
    get_mail_settings,
    list_worklog_mail_recipients,
    mail_settings_payload,
    save_tested_mail_settings,
    save_worklog_mail_recipient,
    worklog_mail_recipient_payload,
)
from app.services.user_accounts import require_user_api_access

router = APIRouter(
    prefix="/api/v1/mail",
    tags=["mail"],
    dependencies=[Depends(require_client_api_access)],
)


class MailSettingsTestRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    sender_name: str = Field(min_length=1, max_length=120)
    sender_email: str = Field(min_length=3, max_length=240)
    smtp_host: str = Field(min_length=1, max_length=240)
    smtp_port: int = Field(ge=1, le=65535)
    security: str = Field(pattern="^(ssl_tls|starttls|none)$")
    smtp_username: str = Field(min_length=1, max_length=240)
    smtp_password: str = Field(min_length=1, max_length=500)
    test_recipient: str = Field(min_length=3, max_length=240)


class WorklogMailRecipientSaveRequest(BaseModel):
    owner_id: str = Field(max_length=80)
    email: str = Field(min_length=3, max_length=240)
    label: str | None = Field(default=None, max_length=120)


@router.get("/settings/status")
def mail_settings_status(
    owner_id: str = Query(max_length=80),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _mail_user(db, owner_id=owner_id, user_token=user_token, web_session_token=web_session_token)
    return mail_settings_payload(get_mail_settings(db, owner_id=user.owner_id))


@router.post("/settings/test")
def test_mail_settings(
    payload: MailSettingsTestRequest,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _mail_user(db, owner_id=payload.owner_id, user_token=user_token, web_session_token=web_session_token)
    settings = save_tested_mail_settings(
        db,
        owner_id=user.owner_id,
        sender_name=payload.sender_name,
        sender_email=payload.sender_email,
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        security=payload.security,
        smtp_username=payload.smtp_username,
        smtp_password=payload.smtp_password,
        test_recipient=payload.test_recipient,
    )
    return mail_settings_payload(settings)


@router.get("/worklog/recipients")
def worklog_mail_recipients(
    owner_id: str = Query(max_length=80),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _mail_user(db, owner_id=owner_id, user_token=user_token, web_session_token=web_session_token)
    recipients = list_worklog_mail_recipients(db, owner_id=user.owner_id)
    return {
        "status": "ok",
        "recipients": [worklog_mail_recipient_payload(item) for item in recipients],
    }


@router.post("/worklog/recipients")
def save_worklog_mail_recipient_api(
    payload: WorklogMailRecipientSaveRequest,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _mail_user(db, owner_id=payload.owner_id, user_token=user_token, web_session_token=web_session_token)
    recipient = save_worklog_mail_recipient(
        db,
        owner_id=user.owner_id,
        email=payload.email,
        label=payload.label,
    )
    return {"status": "ok", "recipient": worklog_mail_recipient_payload(recipient)}


@router.delete("/worklog/recipients/{recipient_id}")
def delete_worklog_mail_recipient_api(
    recipient_id: int,
    owner_id: str = Query(max_length=80),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _mail_user(db, owner_id=owner_id, user_token=user_token, web_session_token=web_session_token)
    delete_worklog_mail_recipient(db, owner_id=user.owner_id, recipient_id=recipient_id)
    return {"status": "ok", "deleted": True}


def _mail_user(
    db: Session,
    *,
    owner_id: str,
    user_token: str | None,
    web_session_token: str | None,
) -> UserAccount:
    if not user_token and not web_session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="mail auth required")
    return require_user_api_access(
        db,
        owner_id=owner_id.strip(),
        access_token=user_token,
        web_session_token=web_session_token,
    )
