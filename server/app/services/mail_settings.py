import base64
import hashlib
import re
from datetime import datetime, timezone
from html import escape

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.note import Note, UserMailSettings, UserWorklogMailRecipient
from app.services.email_delivery import send_smtp_message

ALLOWED_SECURITY = {"ssl_tls", "starttls", "none"}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def mail_settings_payload(settings: UserMailSettings | None) -> dict:
    if settings is None or settings.last_tested_at is None:
        return {
            "status": "ok",
            "enabled": False,
            "sender_name": None,
            "sender_email": None,
            "smtp_host": None,
            "smtp_port": None,
            "security": None,
            "smtp_username": None,
            "test_recipient": None,
            "last_tested_at": None,
            "last_error": settings.last_error if settings else None,
        }
    return {
        "status": "ok",
        "enabled": True,
        "sender_name": settings.sender_name,
        "sender_email": settings.sender_email,
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "security": settings.security,
        "smtp_username": settings.smtp_username,
        "test_recipient": settings.test_recipient,
        "last_tested_at": _utc_iso(settings.last_tested_at),
        "last_error": settings.last_error,
    }


def save_tested_mail_settings(
    db: Session,
    *,
    owner_id: str,
    sender_name: str,
    sender_email: str,
    smtp_host: str,
    smtp_port: int,
    security: str,
    smtp_username: str,
    smtp_password: str,
    test_recipient: str,
) -> UserMailSettings:
    cleaned = _validated_settings(
        sender_name=sender_name,
        sender_email=sender_email,
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        security=security,
        smtp_username=smtp_username,
        smtp_password=smtp_password,
        test_recipient=test_recipient,
    )
    try:
        send_smtp_message(
            host=cleaned["smtp_host"],
            port=cleaned["smtp_port"],
            security=cleaned["security"],
            username=cleaned["smtp_username"],
            password=cleaned["smtp_password"],
            sender_name=cleaned["sender_name"],
            sender_email=cleaned["sender_email"],
            to=[cleaned["test_recipient"]],
            subject="[NowNote] 메일 연결 테스트",
            text_body="NowNote 메일 보내기 연결 테스트입니다.",
            html_body="<p>NowNote 메일 보내기 연결 테스트입니다.</p>",
        )
    except Exception as exc:
        settings = get_mail_settings(db, owner_id=owner_id)
        if settings is not None:
            settings.last_error = _safe_error(exc)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "smtp_test_failed", "message": _safe_error(exc)},
        ) from exc

    settings = get_mail_settings(db, owner_id=owner_id)
    now = datetime.utcnow()
    if settings is None:
        settings = UserMailSettings(owner_id=owner_id)
        db.add(settings)
    settings.sender_name = cleaned["sender_name"]
    settings.sender_email = cleaned["sender_email"]
    settings.smtp_host = cleaned["smtp_host"]
    settings.smtp_port = cleaned["smtp_port"]
    settings.security = cleaned["security"]
    settings.smtp_username = cleaned["smtp_username"]
    settings.smtp_password_encrypted = encrypt_secret(cleaned["smtp_password"])
    settings.test_recipient = cleaned["test_recipient"]
    settings.last_tested_at = now
    settings.last_error = None
    db.commit()
    db.refresh(settings)
    return settings


def send_note_mail(
    db: Session,
    *,
    owner_id: str,
    note: Note,
    to: list[str],
    subject: str | None,
    message: str | None,
) -> None:
    settings = get_mail_settings(db, owner_id=owner_id)
    if settings is None or settings.last_tested_at is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="mail settings not tested")
    recipients = [_clean_email(item, "to") for item in to]
    if not recipients:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="recipient required")
    password = decrypt_secret(settings.smtp_password_encrypted)
    title = note.title.strip() or "제목 없음"
    mail_subject = (subject or "").strip() or f"[NowNote] {title}"
    text_body = render_note_text(note, message=message)
    html_body = render_note_html(note, message=message)
    try:
        send_smtp_message(
            host=settings.smtp_host,
            port=settings.smtp_port,
            security=settings.security,
            username=settings.smtp_username,
            password=password,
            sender_name=settings.sender_name,
            sender_email=settings.sender_email,
            to=recipients,
            subject=mail_subject,
            text_body=text_body,
            html_body=html_body,
        )
    except Exception as exc:
        settings.last_error = _safe_error(exc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "smtp_send_failed", "message": _safe_error(exc)},
        ) from exc


def get_mail_settings(db: Session, *, owner_id: str) -> UserMailSettings | None:
    return db.query(UserMailSettings).filter(UserMailSettings.owner_id == owner_id.strip()).one_or_none()


def worklog_mail_recipient_payload(recipient: UserWorklogMailRecipient) -> dict:
    return {
        "id": recipient.id,
        "owner_id": recipient.owner_id,
        "email": recipient.email,
        "label": recipient.label,
        "created_at": _utc_iso(recipient.created_at),
        "updated_at": _utc_iso(recipient.updated_at),
    }


def list_worklog_mail_recipients(db: Session, *, owner_id: str) -> list[UserWorklogMailRecipient]:
    return list(
        db.query(UserWorklogMailRecipient)
        .filter(UserWorklogMailRecipient.owner_id == owner_id.strip())
        .order_by(UserWorklogMailRecipient.email.asc(), UserWorklogMailRecipient.id.asc())
        .all()
    )


def save_worklog_mail_recipient(
    db: Session,
    *,
    owner_id: str,
    email: str,
    label: str | None,
) -> UserWorklogMailRecipient:
    cleaned_owner_id = owner_id.strip()
    cleaned_email = _clean_email(email, "email").lower()
    cleaned_label = (label or "").strip()[:120] or None
    recipient = (
        db.query(UserWorklogMailRecipient)
        .filter(
            UserWorklogMailRecipient.owner_id == cleaned_owner_id,
            UserWorklogMailRecipient.email == cleaned_email,
        )
        .one_or_none()
    )
    if recipient is None:
        recipient = UserWorklogMailRecipient(owner_id=cleaned_owner_id, email=cleaned_email)
        db.add(recipient)
    recipient.label = cleaned_label
    db.commit()
    db.refresh(recipient)
    return recipient


def delete_worklog_mail_recipient(db: Session, *, owner_id: str, recipient_id: int) -> None:
    recipient = (
        db.query(UserWorklogMailRecipient)
        .filter(
            UserWorklogMailRecipient.owner_id == owner_id.strip(),
            UserWorklogMailRecipient.id == recipient_id,
        )
        .one_or_none()
    )
    if recipient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="worklog mail recipient not found")
    db.delete(recipient)
    db.commit()


def encrypt_secret(value: str) -> str:
    return "fernet:" + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    if not value.startswith("fernet:"):
        return value
    try:
        return _fernet().decrypt(value.removeprefix("fernet:").encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="mail secret cannot be decrypted",
        ) from exc


def render_note_text(note: Note, *, message: str | None = None) -> str:
    parts = [note.title.strip() or "제목 없음", ""]
    if message and message.strip():
        parts.extend([message.strip(), ""])
    parts.append(note.content or "")
    return "\n".join(parts)


def render_note_html(note: Note, *, message: str | None = None) -> str:
    body = _render_markdown_subset(note.content or "")
    message_html = ""
    if message and message.strip():
        message_html = f"<p>{escape(message.strip())}</p>"
    return (
        "<!doctype html><html><body>"
        f"<h1>{escape(note.title.strip() or '제목 없음')}</h1>"
        f"{message_html}"
        f"{body}"
        "</body></html>"
    )


def _validated_settings(**values) -> dict:
    cleaned = {
        "sender_name": str(values["sender_name"]).strip()[:120],
        "sender_email": _clean_email(values["sender_email"], "sender_email"),
        "smtp_host": str(values["smtp_host"]).strip()[:240],
        "smtp_port": int(values["smtp_port"]),
        "security": str(values["security"]).strip().lower(),
        "smtp_username": str(values["smtp_username"]).strip()[:240],
        "smtp_password": str(values["smtp_password"]).strip(),
        "test_recipient": _clean_email(values["test_recipient"], "test_recipient"),
    }
    if not cleaned["sender_name"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="sender_name required")
    if not cleaned["smtp_host"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="smtp_host required")
    if cleaned["smtp_port"] < 1 or cleaned["smtp_port"] > 65535:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="smtp_port invalid")
    if cleaned["security"] not in ALLOWED_SECURITY:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="security invalid")
    if not cleaned["smtp_username"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="smtp_username required")
    if not cleaned["smtp_password"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="smtp_password required")
    return cleaned


def _clean_email(value: str, field: str) -> str:
    cleaned = str(value).strip()[:240]
    if not EMAIL_PATTERN.match(cleaned):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{field} invalid")
    return cleaned


def _fernet() -> Fernet:
    settings = get_settings()
    material = settings.mail_secret_key or settings.api_token or f"{settings.server_name}:{settings.database_url}"
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _render_markdown_subset(value: str) -> str:
    lines = value.splitlines()
    html_lines: list[str] = []
    in_list = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("- "):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            html_lines.append(f"<li>{escape(stripped[2:])}</li>")
            continue
        if in_list:
            html_lines.append("</ul>")
            in_list = False
        if stripped.startswith("# "):
            html_lines.append(f"<h1>{escape(stripped[2:])}</h1>")
        elif stripped.startswith("## "):
            html_lines.append(f"<h2>{escape(stripped[3:])}</h2>")
        elif stripped.startswith("### "):
            html_lines.append(f"<h3>{escape(stripped[4:])}</h3>")
        elif stripped:
            html_lines.append(f"<p>{escape(stripped)}</p>")
    if in_list:
        html_lines.append("</ul>")
    return "\n".join(html_lines)


def _safe_error(exc: Exception) -> str:
    return str(exc).strip()[:500] or exc.__class__.__name__


def _utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
