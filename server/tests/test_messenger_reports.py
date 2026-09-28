import pytest
from fastapi.testclient import TestClient
from types import SimpleNamespace


@pytest.fixture(autouse=True)
def reset_report_limit() -> None:
    from app.services.messenger_reports import _report_attempts

    _report_attempts.clear()


def _report_context(client: TestClient, user_sinsan: tuple[str, str], user_member: tuple[str, str]):
    reporter_id, reporter_token = user_sinsan
    sender_id, sender_token = user_member
    room_id = client.get(
        "/api/v1/messenger/rooms",
        params={"owner_id": sender_id},
        headers={"X-Now-Web-Session": sender_token},
    ).json()["rooms"][0]["id"]
    message_id = client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": sender_id, "body": "private message body"},
        headers={"X-Now-Web-Session": sender_token},
    ).json()["item"]["id"]
    payload = {
        "owner_id": reporter_id,
        "message_id": message_id,
        "target": "message",
        "reason": "harassment",
        "description": "private optional description",
    }
    return room_id, message_id, payload, {"X-Now-Web-Session": reporter_token}, {"X-Now-Web-Session": sender_token}


def test_report_message_sends_to_operator(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    room_id, message_id, payload, headers, _sender_headers = _report_context(client, user_sinsan, user_member)
    sent = []
    monkeypatch.setattr(
        "app.api.messenger.send_messenger_report_email",
        lambda **kwargs: sent.append(kwargs),
        raising=False,
    )

    res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/reports",
        json=payload,
        headers=headers,
    )

    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
    assert len(sent) == 1
    assert sent[0] == {
        "room_id": room_id,
        "message_id": message_id,
        "target": "message",
        "reason": "harassment",
    }


def test_report_rejects_invalid_access_and_input(client, user_sinsan, user_member, monkeypatch):
    room_id, message_id, payload, headers, sender_headers = _report_context(client, user_sinsan, user_member)
    sent = []
    monkeypatch.setattr("app.api.messenger.send_messenger_report_email", lambda **kw: sent.append(kw))
    url = f"/api/v1/messenger/rooms/{room_id}/reports"
    assert client.post(url, json=payload).status_code == 401
    assert client.post(url, json={**payload, "owner_id": user_member[0]}, headers=sender_headers).status_code == 400
    assert client.post(url, json={**payload, "message_id": message_id + 1000000}, headers=headers).status_code == 404
    assert client.post(url, json={**payload, "target": "unknown"}, headers=headers).status_code == 422
    assert client.post(url, json={**payload, "reason": "unknown"}, headers=headers).status_code == 422
    assert client.post(url, json={**payload, "description": "x" * 501}, headers=headers).status_code == 422
    assert sent == []


def test_report_delivery_failure_and_rate_limit(client, user_sinsan, user_member, monkeypatch):
    room_id, _, payload, headers, _ = _report_context(client, user_sinsan, user_member)
    url = f"/api/v1/messenger/rooms/{room_id}/reports"
    monkeypatch.setattr("app.api.messenger.send_messenger_report_email", lambda **kw: (_ for _ in ()).throw(OSError("secret")))
    for _ in range(5):
        response = client.post(url, json=payload, headers=headers)
        assert response.status_code == 503
        assert "secret" not in response.text
    assert client.post(url, json=payload, headers=headers).status_code == 429


def test_report_cannot_reference_another_room(client, user_sinsan, user_member, user_outsider, monkeypatch):
    room_id, _, payload, headers, _ = _report_context(client, user_sinsan, user_member)
    outsider_id, outsider_token = user_outsider
    outsider_headers = {"X-Now-Web-Session": outsider_token}
    outsider_room = client.get(
        "/api/v1/messenger/rooms",
        params={"owner_id": outsider_id},
        headers=outsider_headers,
    ).json()["rooms"][0]["id"]
    outsider_message = client.post(
        f"/api/v1/messenger/rooms/{outsider_room}/messages",
        json={"owner_id": outsider_id, "body": "not in reporter room"},
        headers=outsider_headers,
    ).json()["item"]["id"]
    sent = []
    monkeypatch.setattr("app.api.messenger.send_messenger_report_email", lambda **kw: sent.append(kw))
    response = client.post(
        f"/api/v1/messenger/rooms/{room_id}/reports",
        json={**payload, "message_id": outsider_message},
        headers=headers,
    )
    assert response.status_code == 404
    assert sent == []


def test_report_email_contains_only_approved_fields(monkeypatch):
    from app.services import messenger_reports

    sent = []

    class FakeSmtp:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def send_message(self, message):
            sent.append(message)

    monkeypatch.setattr(messenger_reports, "get_settings", lambda: SimpleNamespace(
        smtp_host="localhost", smtp_port=25, smtp_from="sender@example.test",
        smtp_use_tls=False, smtp_username=None, smtp_password=None,
    ))
    monkeypatch.setattr(messenger_reports.smtplib, "SMTP", FakeSmtp)
    messenger_reports.send_messenger_report_email(room_id=12, message_id=34, target="user", reason="harassment")
    assert len(sent) == 1
    assert sent[0]["To"] == "cyhuh428@gmail.com"
    assert sent[0].get_content() == "Room ID: 12\nMessage ID: 34\nTarget: user\nReason: harassment\n"


def test_report_email_requires_smtp_configuration(monkeypatch):
    from app.services import messenger_reports

    monkeypatch.setattr(messenger_reports, "get_settings", lambda: SimpleNamespace(smtp_host=None, smtp_from=None))
    with pytest.raises(RuntimeError, match="smtp not configured"):
        messenger_reports.send_messenger_report_email(room_id=12, message_id=34, target="message", reason="other")
