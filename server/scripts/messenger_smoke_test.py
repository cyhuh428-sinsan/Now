import os
import sys
import tempfile
from pathlib import Path


def main() -> None:
    server_dir = Path(__file__).resolve().parents[1]
    if str(server_dir) not in sys.path:
        sys.path.insert(0, str(server_dir))

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        db_path = Path(tmp) / "messenger_test.db"
        storage_path = Path(tmp) / "messenger_files"
        os.environ["NOW_DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = storage_path.as_posix()
        os.environ["NOW_WEB_SESSION_TTL_HOURS"] = "24"

        from fastapi.testclient import TestClient

        from app.db import SessionLocal, create_tables, engine
        from app.main import app
        from app.services.user_accounts import create_user_account, issue_web_session

        create_tables()
        with SessionLocal() as db:
            create_user_account(
                db,
                owner_id="sinsan",
                password="Aa12345678!",
                email="sinsan@example.com",
                group_name="sinsan",
            )
            create_user_account(
                db,
                owner_id="member",
                password="Aa12345678!",
                email="member@example.com",
                group_name="sinsan",
            )
            create_user_account(
                db,
                owner_id="outsider",
                password="Aa12345678!",
                email="outsider@example.com",
                group_name="sinsan",
            )
            _session, token = issue_web_session(db, owner_id="sinsan")
            _outsider_session, outsider_token = issue_web_session(db, owner_id="outsider")
            db.commit()

        headers = {"X-Now-Web-Session": token}
        outsider_headers = {"X-Now-Web-Session": outsider_token}
        client = TestClient(app)

        missing_session_res = client.get("/api/v1/messenger/rooms", params={"owner_id": "sinsan"})
        assert missing_session_res.status_code == 401, missing_session_res.text
        assert missing_session_res.json()["detail"] == "web session required"

        rooms_res = client.get("/api/v1/messenger/rooms", params={"owner_id": "sinsan"}, headers=headers)
        assert rooms_res.status_code == 200, rooms_res.text
        rooms = rooms_res.json()["rooms"]
        assert rooms, rooms_res.json()
        room_id = rooms[0]["id"]

        msg_res = client.post(
            f"/api/v1/messenger/rooms/{room_id}/messages",
            json={"owner_id": "sinsan", "body": "안녕하세요"},
            headers=headers,
        )
        assert msg_res.status_code == 200, msg_res.text
        message_id = msg_res.json()["item"]["id"]

        read_res = client.post(
            f"/api/v1/messenger/rooms/{room_id}/read",
            json={"owner_id": "sinsan", "last_read_message_id": message_id},
            headers=headers,
        )
        assert read_res.status_code == 200, read_res.text
        assert read_res.json()["last_read_message_id"] >= message_id

        private_res = client.post(
            "/api/v1/messenger/rooms",
            json={"owner_id": "sinsan", "name": "작업방", "member_owner_ids": ["member"]},
            headers=headers,
        )
        assert private_res.status_code == 200, private_res.text
        private_room_id = private_res.json()["room"]["id"]

        outsider_messages_res = client.get(
            f"/api/v1/messenger/rooms/{private_room_id}/messages",
            params={"owner_id": "outsider"},
            headers=outsider_headers,
        )
        assert outsider_messages_res.status_code == 403, outsider_messages_res.text
        assert outsider_messages_res.json()["detail"] == "room member required"

        bad_extension_res = client.post(
            f"/api/v1/messenger/rooms/{private_room_id}/attachments",
            params={"owner_id": "sinsan", "body": "확장자 거부"},
            files={"file": ("blocked.exe", b"blocked", "text/plain")},
            headers=headers,
        )
        assert bad_extension_res.status_code == 400, bad_extension_res.text
        assert bad_extension_res.json()["detail"] == "file extension not allowed"

        bad_mime_res = client.post(
            f"/api/v1/messenger/rooms/{private_room_id}/attachments",
            params={"owner_id": "sinsan", "body": "MIME 거부"},
            files={"file": ("blocked.txt", b"blocked", "application/x-msdownload")},
            headers=headers,
        )
        assert bad_mime_res.status_code == 400, bad_mime_res.text
        assert bad_mime_res.json()["detail"] == "file mime type not allowed"

        octet_stream_res = client.post(
            f"/api/v1/messenger/rooms/{private_room_id}/attachments",
            params={"owner_id": "sinsan", "body": "기본 MIME 거부"},
            files={"file": ("unknown.txt", b"unknown", "application/octet-stream")},
            headers=headers,
        )
        assert octet_stream_res.status_code == 400, octet_stream_res.text
        assert octet_stream_res.json()["detail"] == "file mime type not allowed"

        upload_res = client.post(
            f"/api/v1/messenger/rooms/{private_room_id}/attachments",
            params={"owner_id": "sinsan", "body": "파일 확인"},
            files={"file": ("hello.txt", b"hello messenger", "text/plain")},
            headers=headers,
        )
        assert upload_res.status_code == 200, upload_res.text
        attachment = upload_res.json()["item"]["attachments"][0]

        download_res = client.get(
            f"/api/v1/messenger/attachments/{attachment['id']}",
            params={"owner_id": "sinsan"},
            headers=headers,
        )
        assert download_res.status_code == 200, download_res.text
        assert download_res.content == b"hello messenger"

        outsider_download_res = client.get(
            f"/api/v1/messenger/attachments/{attachment['id']}",
            params={"owner_id": "outsider"},
            headers=outsider_headers,
        )
        assert outsider_download_res.status_code == 403, outsider_download_res.text
        assert outsider_download_res.json()["detail"] == "room member required"
        engine.dispose()

    print("NowNote 2.3 messenger smoke test passed")


if __name__ == "__main__":
    main()
