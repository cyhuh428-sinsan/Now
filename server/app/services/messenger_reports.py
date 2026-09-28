from collections import deque
from email.message import EmailMessage
import smtplib
from threading import Lock
from time import monotonic

from app.core.config import get_settings

REPORT_RECIPIENT = "cyhuh428@gmail.com"
_report_attempts: dict[str, deque[float]] = {}
_report_lock = Lock()


def allow_report_attempt(owner_id: str) -> bool:
    now = monotonic()
    with _report_lock:
        attempts = _report_attempts.setdefault(owner_id, deque())
        while attempts and now - attempts[0] >= 600:
            attempts.popleft()
        if len(attempts) >= 5:
            return False
        attempts.append(now)
        return True


def send_messenger_report_email(*, room_id: int, message_id: int, target: str, reason: str) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from:
        raise RuntimeError("smtp not configured")

    message = EmailMessage()
    message["Subject"] = "NowNote messenger report"
    message["From"] = settings.smtp_from
    message["To"] = REPORT_RECIPIENT
    message.set_content(
        f"Room ID: {room_id}\nMessage ID: {message_id}\nTarget: {target}\nReason: {reason}\n"
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
