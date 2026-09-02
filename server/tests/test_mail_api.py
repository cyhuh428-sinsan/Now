from datetime import datetime
import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _mail_user(db: Session) -> tuple[str, str]:
    from app.services.user_accounts import create_user_account, issue_web_session

    owner_id = f"mail_user_{uuid.uuid4().hex[:8]}"
    create_user_account(
        db,
        owner_id=owner_id,
        password="Aa12345678!",
        email=f"{owner_id}@example.com",
        group_name="mail",
    )
    db.flush()
    _session, token = issue_web_session(db, owner_id=owner_id)
    db.commit()
    return owner_id, token


def _mail_user_with_app_token(db: Session) -> tuple[str, str]:
    from app.services.user_accounts import create_user_account, issue_user_device_access_token

    owner_id = f"mail_app_user_{uuid.uuid4().hex[:8]}"
    create_user_account(
        db,
        owner_id=owner_id,
        password="Aa12345678!",
        email=f"{owner_id}@example.com",
        group_name="mail",
    )
    db.flush()
    _device, token = issue_user_device_access_token(
        db,
        owner_id=owner_id,
        device_id="mail-app-device",
        display_name="Mail app device",
    )
    db.commit()
    return owner_id, token


def test_mail_status_requires_authenticated_user(client: TestClient) -> None:
    res = client.get("/api/v1/mail/settings/status", params={"owner_id": "sinsan"})
    assert res.status_code == 401


def test_mail_status_without_tested_settings_is_disabled(client: TestClient, db: Session) -> None:
    owner_id, web_token = _mail_user(db)
    res = client.get(
        "/api/v1/mail/settings/status",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": web_token},
    )
    assert res.status_code == 200
    assert res.json() == {
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
        "last_error": None,
    }


def test_mail_status_accepts_app_user_token(client: TestClient, db: Session, monkeypatch) -> None:
    owner_id, user_token = _mail_user_with_app_token(db)

    def fake_send_smtp_message(**kwargs):
        return None

    monkeypatch.setattr("app.services.mail_settings.send_smtp_message", fake_send_smtp_message)
    test_res = client.post(
        "/api/v1/mail/settings/test",
        json={
            "owner_id": owner_id,
            "sender_name": "신산",
            "sender_email": "sender@example.com",
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "security": "starttls",
            "smtp_username": "sender@example.com",
            "smtp_password": "app-password",
            "test_recipient": "receiver@example.com",
        },
        headers={"X-Now-User-Token": user_token},
    )
    assert test_res.status_code == 200, test_res.text

    status_res = client.get(
        "/api/v1/mail/settings/status",
        params={"owner_id": owner_id},
        headers={"X-Now-User-Token": user_token},
    )
    assert status_res.status_code == 200
    assert status_res.json()["enabled"] is True


def test_worklog_mail_recipients_are_separate_from_smtp_settings_and_shared_by_user(
    client: TestClient,
    db: Session,
) -> None:
    owner_id, web_token = _mail_user(db)
    from app.services.user_accounts import issue_user_device_access_token

    _device, app_token = issue_user_device_access_token(
        db,
        owner_id=owner_id,
        device_id="worklog-recipient-desktop",
        display_name="Desktop",
    )
    db.commit()

    create_res = client.post(
        "/api/v1/mail/worklog/recipients",
        json={"owner_id": owner_id, "email": " Receiver@Example.com ", "label": "팀 공유"},
        headers={"X-Now-Web-Session": web_token},
    )
    assert create_res.status_code == 200, create_res.text
    created = create_res.json()["recipient"]
    assert created["email"] == "receiver@example.com"
    assert created["label"] == "팀 공유"
    assert "smtp_password" not in created
    assert "smtp_password_encrypted" not in created

    list_res = client.get(
        "/api/v1/mail/worklog/recipients",
        params={"owner_id": owner_id},
        headers={"X-Now-User-Token": app_token},
    )
    assert list_res.status_code == 200, list_res.text
    body = list_res.json()
    assert body["status"] == "ok"
    assert [item["email"] for item in body["recipients"]] == ["receiver@example.com"]


def test_worklog_mail_recipient_save_validates_email(client: TestClient, db: Session) -> None:
    owner_id, web_token = _mail_user(db)
    res = client.post(
        "/api/v1/mail/worklog/recipients",
        json={"owner_id": owner_id, "email": "not-an-email"},
        headers={"X-Now-Web-Session": web_token},
    )
    assert res.status_code == 422
    assert res.json()["detail"] == "email invalid"


def test_worklog_mail_recipient_delete_removes_only_owner_item(
    client: TestClient,
    db: Session,
) -> None:
    owner_id, web_token = _mail_user(db)
    other_owner_id, other_token = _mail_user(db)
    create_res = client.post(
        "/api/v1/mail/worklog/recipients",
        json={"owner_id": owner_id, "email": "receiver@example.com"},
        headers={"X-Now-Web-Session": web_token},
    )
    recipient_id = create_res.json()["recipient"]["id"]

    forbidden_res = client.delete(
        f"/api/v1/mail/worklog/recipients/{recipient_id}",
        params={"owner_id": other_owner_id},
        headers={"X-Now-Web-Session": other_token},
    )
    assert forbidden_res.status_code == 404

    delete_res = client.delete(
        f"/api/v1/mail/worklog/recipients/{recipient_id}",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": web_token},
    )
    assert delete_res.status_code == 200
    assert delete_res.json() == {"status": "ok", "deleted": True}

    list_res = client.get(
        "/api/v1/mail/worklog/recipients",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": web_token},
    )
    assert list_res.status_code == 200
    assert list_res.json()["recipients"] == []


def test_note_mail_returns_409_when_settings_not_tested(
    client: TestClient,
    db: Session,
) -> None:
    from app.models.note import Note

    owner_id, web_token = _mail_user(db)
    note = Note(
        owner_id=owner_id,
        device_id="mail-test-device",
        local_id="mail-test-note",
        note_type="tree",
        title="메일 미설정 노트",
        content="본문",
    )
    db.add(note)
    db.commit()

    res = client.post(
        f"/api/v1/notes/{note.local_id}/mail",
        params={"owner_id": owner_id},
        json={"to": ["receiver@example.com"]},
        headers={"X-Now-Web-Session": web_token},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "mail settings not tested"


def test_mail_test_persists_encrypted_password_after_success(
    client: TestClient,
    db: Session,
    monkeypatch,
) -> None:
    from app.models.note import UserMailSettings

    owner_id, web_token = _mail_user(db)
    sent_messages = []

    def fake_send_smtp_message(**kwargs):
        sent_messages.append(kwargs)

    monkeypatch.setattr("app.services.mail_settings.send_smtp_message", fake_send_smtp_message)

    res = client.post(
        "/api/v1/mail/settings/test",
        json={
            "owner_id": owner_id,
            "sender_name": "신산",
            "sender_email": "sender@example.com",
            "smtp_host": "smtp.example.com",
            "smtp_port": 587,
            "security": "starttls",
            "smtp_username": "sender@example.com",
            "smtp_password": "app-password",
            "test_recipient": "receiver@example.com",
        },
        headers={"X-Now-Web-Session": web_token},
    )

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ok"
    assert body["enabled"] is True
    assert body["last_tested_at"]
    assert body["last_error"] is None
    assert len(sent_messages) == 1

    saved = db.query(UserMailSettings).filter(UserMailSettings.owner_id == owner_id).one()
    assert saved.smtp_password_encrypted
    assert saved.smtp_password_encrypted != "app-password"
    assert saved.last_tested_at is not None


def test_note_mail_sends_current_note_with_saved_settings(
    client: TestClient,
    db: Session,
    monkeypatch,
) -> None:
    from app.models.note import Note, UserMailSettings
    from app.services.mail_settings import encrypt_secret

    owner_id, web_token = _mail_user(db)
    note = Note(
        owner_id=owner_id,
        device_id="mail-send-device",
        local_id="mail-send-note",
        note_type="tree",
        title="보낼 노트",
        content="# 제목\n\n본문",
    )
    db.add(note)
    db.add(
        UserMailSettings(
            owner_id=owner_id,
            sender_name="신산",
            sender_email="sender@example.com",
            smtp_host="smtp.example.com",
            smtp_port=587,
            security="starttls",
            smtp_username="sender@example.com",
            smtp_password_encrypted=encrypt_secret("app-password"),
            test_recipient="receiver@example.com",
            last_tested_at=datetime.utcnow(),
        )
    )
    db.commit()

    sent_messages = []

    def fake_send_smtp_message(**kwargs):
        sent_messages.append(kwargs)

    monkeypatch.setattr("app.services.mail_settings.send_smtp_message", fake_send_smtp_message)

    res = client.post(
        f"/api/v1/notes/{note.local_id}/mail",
        params={"owner_id": owner_id},
        json={"to": ["receiver@example.com"], "subject": "직접 제목", "message": "전달 메모"},
        headers={"X-Now-Web-Session": web_token},
    )

    assert res.status_code == 200, res.text
    assert res.json()["status"] == "ok"
    assert res.json()["sent"] is True
    assert len(sent_messages) == 1
    sent = sent_messages[0]
    assert sent["password"] == "app-password"
    assert sent["to"] == ["receiver@example.com"]
    assert sent["subject"] == "직접 제목"
    assert "보낼 노트" in sent["text_body"]
    assert "<h1>제목</h1>" in sent["html_body"]


def test_worklog_period_mail_sends_only_actual_worklogs_in_date_order(
    client: TestClient,
    db: Session,
    monkeypatch,
) -> None:
    from app.models.note import Note, UserMailSettings
    from app.services.mail_settings import encrypt_secret

    owner_id, web_token = _mail_user(db)
    db.add_all(
        [
            Note(
                owner_id=owner_id,
                device_id="mail-worklog-device",
                local_id="worklog-later",
                note_type="worklog",
                title="9월 2일 작업",
                content="둘째 날 내용",
                client_updated_at=datetime(2026, 9, 2, 9, 0, 0),
            ),
            Note(
                owner_id=owner_id,
                device_id="mail-worklog-device",
                local_id="worklog-earlier",
                note_type="worklog",
                title="9월 1일 작업",
                content="첫째 날 내용",
                client_updated_at=datetime(2026, 9, 1, 9, 0, 0),
            ),
            Note(
                owner_id=owner_id,
                device_id="mail-worklog-device",
                local_id="worklog-outside",
                note_type="worklog",
                title="9월 3일 작업",
                content="기간 밖 내용",
                client_updated_at=datetime(2026, 9, 3, 9, 0, 0),
            ),
            Note(
                owner_id=owner_id,
                device_id="mail-worklog-device",
                local_id="daily-inside",
                note_type="daily",
                title="일자 메모",
                content="작업 일지가 아님",
                client_updated_at=datetime(2026, 9, 1, 10, 0, 0),
            ),
            UserMailSettings(
                owner_id=owner_id,
                sender_name="신산",
                sender_email="sender@example.com",
                smtp_host="smtp.example.com",
                smtp_port=587,
                security="starttls",
                smtp_username="sender@example.com",
                smtp_password_encrypted=encrypt_secret("app-password"),
                test_recipient="receiver@example.com",
                last_tested_at=datetime.utcnow(),
            ),
        ]
    )
    db.commit()

    sent_messages = []

    def fake_send_smtp_message(**kwargs):
        sent_messages.append(kwargs)

    monkeypatch.setattr("app.services.mail_settings.send_smtp_message", fake_send_smtp_message)

    res = client.post(
        "/api/v1/notes/worklog/mail",
        params={"owner_id": owner_id},
        json={
            "to": ["receiver@example.com"],
            "subject": "작업 일지 공유",
            "message": "확인 부탁드립니다",
            "date_from": "2026-09-01T00:00:00",
            "date_to": "2026-09-02T23:59:59",
        },
        headers={"X-Now-Web-Session": web_token},
    )

    assert res.status_code == 200, res.text
    assert res.json()["sent"] is True
    assert res.json()["sent_count"] == 2
    assert len(sent_messages) == 1
    sent = sent_messages[0]
    assert sent["to"] == ["receiver@example.com"]
    assert sent["subject"] == "작업 일지 공유"
    text = sent["text_body"]
    assert text.index("9월 1일 작업") < text.index("9월 2일 작업")
    assert "첫째 날 내용" in text
    assert "둘째 날 내용" in text
    assert "기간 밖 내용" not in text
    assert "작업 일지가 아님" not in text


def test_worklog_period_mail_rejects_empty_range_without_sending(
    client: TestClient,
    db: Session,
    monkeypatch,
) -> None:
    from app.models.note import UserMailSettings
    from app.services.mail_settings import encrypt_secret

    owner_id, web_token = _mail_user(db)
    db.add(
        UserMailSettings(
            owner_id=owner_id,
            sender_name="신산",
            sender_email="sender@example.com",
            smtp_host="smtp.example.com",
            smtp_port=587,
            security="starttls",
            smtp_username="sender@example.com",
            smtp_password_encrypted=encrypt_secret("app-password"),
            test_recipient="receiver@example.com",
            last_tested_at=datetime.utcnow(),
        )
    )
    db.commit()
    sent_messages = []

    def fake_send_smtp_message(**kwargs):
        sent_messages.append(kwargs)

    monkeypatch.setattr("app.services.mail_settings.send_smtp_message", fake_send_smtp_message)

    res = client.post(
        "/api/v1/notes/worklog/mail",
        params={"owner_id": owner_id},
        json={
            "to": ["receiver@example.com"],
            "date_from": "2026-09-10T00:00:00",
            "date_to": "2026-09-10T23:59:59",
        },
        headers={"X-Now-Web-Session": web_token},
    )

    assert res.status_code == 409
    assert res.json()["detail"] == "worklog notes not found in date range"
    assert sent_messages == []
