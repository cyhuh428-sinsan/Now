from email.message import EmailMessage
import smtplib

from app.core.config import get_settings


def smtp_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from)


def send_password_reset_email(*, to_email: str, owner_id: str, reset_code: str) -> None:
    settings = get_settings()
    if not smtp_configured():
        raise RuntimeError("smtp not configured")

    message = EmailMessage()
    message["Subject"] = "NowNote 비밀번호 재설정 코드"
    message["From"] = settings.smtp_from or ""
    message["To"] = to_email
    message.set_content(
        "\n".join(
            [
                "NowNote 비밀번호 재설정 요청이 접수되었습니다.",
                "",
                f"사용자 ID: {owner_id}",
                f"재설정 코드: {reset_code}",
                "",
                f"이 코드는 {settings.password_reset_code_minutes}분 동안 사용할 수 있습니다.",
                "본인이 요청하지 않았다면 이 메일을 무시하세요.",
            ]
        )
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
