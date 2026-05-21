import argparse
from pathlib import Path


PLACEHOLDER_VALUES = {
    "",
    "change-this-api-token",
    "change-this-postgres-password",
    "now-local-password",
}
CHECK_TOTAL = 0
CHECK_PASSED = 0


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def check(condition: bool, name: str, message: str, failures: list[str]) -> None:
    global CHECK_TOTAL, CHECK_PASSED
    CHECK_TOTAL += 1
    prefix = "[OK]" if condition else "[FAIL]"
    print(f"{prefix} {name} - {message}")
    if condition:
        CHECK_PASSED += 1
    else:
        failures.append(f"{name}: {message}")


def check_text_contains(
    text: str,
    requirements: list[tuple[str, str, str]],
    failures: list[str],
) -> None:
    for needle, name, message in requirements:
        check(needle in text, name, message, failures)


def check_text_not_contains(
    text: str,
    forbidden: list[tuple[str, str, str]],
    failures: list[str],
) -> None:
    for needle, name, message in forbidden:
        check(needle not in text, name, message, failures)


def check_summary() -> str:
    return f"{CHECK_PASSED}/{CHECK_TOTAL} checks"


def main() -> None:
    parser = argparse.ArgumentParser(description="NowNote server deployment preflight check")
    parser.add_argument("--env-file", default=".env", help="Path to .env file")
    parser.add_argument(
        "--allow-example",
        action="store_true",
        help="Allow placeholder values when checking .env.example structure",
    )
    parser.add_argument(
        "--public-server",
        action="store_true",
        help="Also check whether this build is ready for a public multi-user server",
    )
    args = parser.parse_args()

    server_dir = Path(__file__).resolve().parents[1]
    repo_root = server_dir.parent
    env_path = (server_dir / args.env_file).resolve()
    root_readme_path = repo_root / "README.md"
    compose_path = server_dir / "docker-compose.yml"
    readme_path = server_dir / "README.md"
    monitor_api_path = server_dir / "app" / "api" / "monitor.py"
    smoke_path = server_dir / "scripts" / "smoke_test.py"
    recovery_path = server_dir / "RECOVERY.md"
    deploy_path = server_dir / "DEPLOY.md"
    auth_policy_path = repo_root / "docs" / "SERVER_AUTH_POLICY.md"
    help_ko_path = repo_root / "docs" / "HELP.md"
    help_en_path = repo_root / "docs" / "HELP.en.md"
    web_help_path = repo_root / "web" / "help.html"
    admin_api_path = server_dir / "app" / "api" / "admin.py"
    auth_api_path = server_dir / "app" / "api" / "auth.py"
    capabilities_path = server_dir / "app" / "core" / "capabilities.py"
    users_api_path = server_dir / "app" / "api" / "users.py"
    user_accounts_service_path = server_dir / "app" / "services" / "user_accounts.py"
    user_devices_service_path = server_dir / "app" / "services" / "user_devices.py"
    web_app_path = repo_root / "web" / "app.js"
    web_readme_path = repo_root / "web" / "README.md"
    mobile_server_sync_path = repo_root / "now_app" / "lib" / "services" / "server_sync_service.dart"
    mobile_server_settings_path = (
        repo_root / "now_app" / "lib" / "features" / "settings" / "server_settings_page.dart"
    )
    mobile_help_path = repo_root / "now_app" / "lib" / "features" / "settings" / "help_page.dart"
    mobile_readme_path = repo_root / "now_app" / "README.md"
    failures: list[str] = []

    check(env_path.exists(), "Env file exists", str(env_path), failures)
    if not env_path.exists():
        raise SystemExit(1)

    values = load_env(env_path)
    required_keys = [
        "NOW_SERVER_NAME",
        "NOW_API_TOKEN",
        "NOW_USER_TOKEN_REQUIRED",
        "NOW_POSTGRES_PASSWORD",
        "NOW_STORAGE_DIR",
        "NOW_WORKER_POLL_SECONDS",
        "NOW_WORKER_BATCH_SIZE",
        "NOW_LLM_PROVIDER",
        "NOW_PUBLIC_BASE_URL",
        "NOW_BEHIND_REVERSE_PROXY",
    ]
    for key in required_keys:
        check(key in values, f"{key} set", env_path.name, failures)

    api_token = values.get("NOW_API_TOKEN", "")
    db_password = values.get("NOW_POSTGRES_PASSWORD", "")
    storage_dir = values.get("NOW_STORAGE_DIR", "")
    poll_seconds = values.get("NOW_WORKER_POLL_SECONDS", "")
    batch_size = values.get("NOW_WORKER_BATCH_SIZE", "")
    user_token_required = values.get("NOW_USER_TOKEN_REQUIRED", "").lower()
    public_base_url = values.get("NOW_PUBLIC_BASE_URL", "")
    behind_reverse_proxy = values.get("NOW_BEHIND_REVERSE_PROXY", "").lower()

    if args.allow_example:
        check(
            api_token == "change-this-api-token",
            "Example API token placeholder",
            "allowed only for .env.example structure check",
            failures,
        )
        check(
            db_password == "change-this-postgres-password",
            "Example DB password placeholder",
            "allowed only for .env.example structure check",
            failures,
        )
    else:
        check(
            api_token not in PLACEHOLDER_VALUES and not api_token.startswith("change-this"),
            "API token changed",
            "NOW_API_TOKEN must be a long private value",
            failures,
        )
        check(
            db_password not in PLACEHOLDER_VALUES and not db_password.startswith("change-this"),
            "Postgres password changed",
            "NOW_POSTGRES_PASSWORD must be set before first docker compose up",
            failures,
        )

    check(storage_dir.startswith("/"), "Storage dir is container absolute path", storage_dir, failures)
    check(user_token_required in {"true", "false"}, "User token required flag valid", "NOW_USER_TOKEN_REQUIRED true/false", failures)
    check(
        behind_reverse_proxy in {"true", "false"},
        "Reverse proxy flag valid",
        "NOW_BEHIND_REVERSE_PROXY true/false",
        failures,
    )
    check(poll_seconds.isdigit() and int(poll_seconds) > 0, "Worker poll seconds valid", poll_seconds, failures)
    check(batch_size.isdigit() and int(batch_size) > 0, "Worker batch size valid", batch_size, failures)

    check(root_readme_path.exists(), "Root README exists", str(root_readme_path), failures)
    if root_readme_path.exists():
        root_readme = root_readme_path.read_text(encoding="utf-8")
        check_text_contains(
            root_readme,
            [
                ("NowNote", "Root README names project", "project name"),
                ("한국어 사용 흐름", "Root README documents Korean-first direction", "Korean-first direction"),
                ("now_app", "Root README links mobile app", "mobile app path"),
                ("web", "Root README links web client", "web path"),
                ("server", "Root README links server", "server path"),
                ("docs/HELP.md", "Root README links user help", "user help path"),
                ("개인 Docker 서버", "Root README documents private server mode", "private server mode"),
                ("공용 서버", "Root README documents public server mode", "public server mode"),
                ("2단계 인증 코드는 저장하지 않고", "Root README documents request-only 2FA code", "2FA storage policy"),
                ("암호화 저장은 1차 범위에서는 켜지지 않으며", "Root README marks encryption disabled", "encryption phase one"),
            ],
            failures,
        )
        check_text_not_contains(
            root_readme,
            [
                ("A new Flutter project", "Root README is not Flutter template", "remove Flutter template"),
                ("Getting Started", "Root README avoids generic starter guide", "remove generic starter guide"),
            ],
            failures,
        )

    compose = compose_path.read_text(encoding="utf-8")
    check('"8750:8080"' in compose, "Compose exposes port 8750", "host 8750 -> container 8080", failures)
    check("NOW_API_TOKEN: ${NOW_API_TOKEN:-}" in compose, "Compose reads NOW_API_TOKEN", "API and worker", failures)
    check("now_recording_data:${NOW_STORAGE_DIR:-/data/recordings}" in compose, "Compose storage volume follows NOW_STORAGE_DIR", "recording volume", failures)
    check("restart: unless-stopped" in compose, "Compose restart policy set", "services restart unless stopped", failures)
    check(readme_path.exists(), "Server README exists", str(readme_path), failures)
    if readme_path.exists():
        readme = readme_path.read_text(encoding="utf-8")
        check_text_contains(
            readme,
            [
                ('`api_version` 값은 `v1`', "README documents current API version", "api_version v1"),
                ("supported_note_types", "README documents supported note types", "supported_note_types"),
                ("max_tree_note_level", "README documents tree depth capability", "max_tree_note_level"),
                ("user_access_tokens", "README documents user token capability", "user_access_tokens"),
                ("status_counts", "README documents backup verify status counts", "status_counts"),
                ("백업/복구 절차 확인 상태", "README documents backup recovery ops check", "backup recovery ops"),
                ("total_export_items", "README documents export summary total", "export summary total"),
                ("recording_orphan_files", "README documents orphan recording summary count", "recording orphan summary count"),
                ("recording_orphan_bytes", "README documents orphan recording summary bytes", "recording orphan summary bytes"),
                ("recording_missing_files", "README documents missing recording summary count", "recording missing summary count"),
                ("고아 녹음 파일 JSON", "README documents orphan recording export link", "recording orphan export"),
                ("recording-missing-files", "README documents missing recording export link", "recording missing export"),
                ("누락 녹음 파일", "README documents missing recording ops check", "recording missing ops"),
                ("/admin/public", "README documents public server admin page", "public server admin page"),
                ("NowNote server preflight passed", "README explains preflight pass summary", "preflight passed summary"),
                ("Preflight failed", "README explains preflight failure summary", "preflight failed summary"),
                ("NowNote server smoke test passed", "README explains smoke pass summary", "smoke passed summary"),
                ("SMOKE TEST FAILED", "README explains smoke failure summary", "smoke failure summary"),
                ("SMOKE TEST HTTP FAILED", "README explains smoke HTTP failure summary", "smoke HTTP failure summary"),
                ("SMOKE TEST CONNECTION FAILED", "README explains smoke connection failure summary", "smoke connection failure summary"),
                ("SMOKE TEST JSON FAILED", "README explains smoke JSON failure summary", "smoke JSON failure summary"),
                ("--timeout 초", "README explains smoke timeout option", "smoke timeout"),
                ("--ready-retries 횟수", "README explains smoke readiness retries", "smoke readiness retries"),
                ("--ready-delay 초", "README explains smoke readiness delay", "smoke readiness delay"),
                ("사용자별 기기 조회/해제 API", "README documents user device self-management API", "device self-management"),
                ("사용자별 데이터 격리 자동 검증", "README documents public data isolation checks", "data isolation"),
                ("백업 내보내기/검증", "README explains smoke backup checks", "smoke backup checks"),
                ("녹음 업로드", "README explains smoke recording upload check", "smoke recording check"),
                ("비활성 사용자 차단", "README explains smoke inactive user check", "smoke inactive user check"),
            ],
            failures,
        )
    check(smoke_path.exists(), "Smoke test script exists", str(smoke_path), failures)
    check(recovery_path.exists(), "Recovery procedure exists", str(recovery_path), failures)
    check(deploy_path.exists(), "Deploy checklist exists", str(deploy_path), failures)
    check(auth_policy_path.exists(), "Server auth policy exists", str(auth_policy_path), failures)
    check(help_ko_path.exists(), "Korean help exists", str(help_ko_path), failures)
    check(help_en_path.exists(), "English help exists", str(help_en_path), failures)
    check(web_help_path.exists(), "Web help exists", str(web_help_path), failures)
    check(admin_api_path.exists(), "Admin API source exists", str(admin_api_path), failures)
    check(auth_api_path.exists(), "Auth API source exists", str(auth_api_path), failures)
    check(monitor_api_path.exists(), "Monitor API source exists", str(monitor_api_path), failures)
    check(capabilities_path.exists(), "Server capabilities source exists", str(capabilities_path), failures)
    check(users_api_path.exists(), "User API source exists", str(users_api_path), failures)
    check(user_accounts_service_path.exists(), "User accounts service exists", str(user_accounts_service_path), failures)
    check(user_devices_service_path.exists(), "User devices service exists", str(user_devices_service_path), failures)
    check(web_app_path.exists(), "Web app source exists", str(web_app_path), failures)
    check(web_readme_path.exists(), "Web README exists", str(web_readme_path), failures)
    check(mobile_server_sync_path.exists(), "Mobile server sync source exists", str(mobile_server_sync_path), failures)
    check(mobile_server_settings_path.exists(), "Mobile server settings page exists", str(mobile_server_settings_path), failures)
    check(mobile_help_path.exists(), "Mobile help page exists", str(mobile_help_path), failures)
    check(mobile_readme_path.exists(), "Mobile README exists", str(mobile_readme_path), failures)
    capabilities_source = ""
    if capabilities_path.exists():
        capabilities_source = capabilities_path.read_text(encoding="utf-8")
        check_text_contains(
            capabilities_source,
            [
                ('API_VERSION = "v1"', "Capabilities defines API version", "API_VERSION"),
                (
                    'TWO_FACTOR_AUTH_STATUS = "token_code"',
                    "Capabilities defines two-factor auth status",
                    "TWO_FACTOR_AUTH_STATUS",
                ),
                ("MAX_TREE_NOTE_LEVEL = 3", "Capabilities defines tree depth limit", "MAX_TREE_NOTE_LEVEL"),
                (
                    'SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]',
                    "Capabilities defines supported note types",
                    "SUPPORTED_NOTE_TYPES",
                ),
                ("PUBLIC_SERVER_READY_ITEMS", "Capabilities defines public server ready items", "PUBLIC_SERVER_READY_ITEMS"),
                ("PUBLIC_SERVER_HTTPS_ITEM", "Capabilities defines public HTTPS readiness item", "PUBLIC_SERVER_HTTPS_ITEM"),
                ("public_https_ready", "Capabilities checks public HTTPS readiness dynamically", "public_https_ready"),
                ("public_https_message", "Capabilities explains public HTTPS readiness", "public_https_message"),
                ("login_or_token_delivery", "Capabilities marks token login ready item", "login_or_token_delivery"),
                ("public_server_readiness", "Capabilities exposes public server readiness", "public_server_readiness"),
                ("public_server_readiness_checks", "Capabilities exposes public server readiness checks", "public readiness checks"),
                ('"ready": ready', "Capabilities returns public server ready list", "public readiness ready list"),
                ('"items": [', "Capabilities returns public server readiness details", "public readiness details"),
            ],
            failures,
        )
    if auth_api_path.exists():
        auth_api_source = auth_api_path.read_text(encoding="utf-8")
        check_text_contains(
            auth_api_source,
            [
                ('@api_router.post("/token-login")', "Auth API exposes token login", "token login API"),
                ('@page_router.get("/auth/token"', "Auth page exposes token check screen", "token check screen"),
                ("last_login_at", "Auth login updates last login time", "last_login_at"),
                ("two factor code required", "Auth login requires two-factor code", "two factor code required"),
                ("invalid two factor code", "Auth login rejects invalid two-factor code", "invalid two factor code"),
                ("_two_factor_code", "Auth API computes two-factor code", "_two_factor_code"),
                ("invalid user token", "Auth login rejects invalid user token", "invalid user token"),
                ("NowNote 토큰 확인", "Auth page is Korean", "Korean auth page"),
            ],
            failures,
        )
    server_info_path = server_dir / "app" / "api" / "server.py"
    check(server_info_path.exists(), "Server info API source exists", str(server_info_path), failures)
    if server_info_path.exists():
        server_info_source = server_info_path.read_text(encoding="utf-8")
        check_text_contains(
            server_info_source,
            [
                ("public_server_readiness", "Server info returns public server readiness", "public_server_readiness"),
            ],
            failures,
        )
    if web_app_path.exists():
        web_app_source = web_app_path.read_text(encoding="utf-8")
        check_text_contains(
            web_app_source,
            [
                ("public_server_readiness", "Web reads public server readiness response", "web public readiness response"),
                ("publicServerReadiness", "Web stores public server readiness", "web public readiness state"),
                ("serverPublicReadinessLabels", "Web renders public server readiness label", "web public readiness label"),
                (
                    "settings.server.publicReadiness.planned",
                    "Web localizes public server readiness",
                    "web public readiness i18n",
                ),
                ("/api/v1/auth/token-login", "Web verifies per-user token login", "web token login API"),
                ("serverTwoFactorCodeInput", "Web exposes two-factor code input", "web two factor input"),
                (
                    'capabilities.two_factor_auth === "token_code"',
                    "Web displays token-code two-factor auth readiness",
                    "web two factor token code",
                ),
            ],
            failures,
        )
    if web_readme_path.exists():
        web_readme = web_readme_path.read_text(encoding="utf-8")
        check_text_contains(
            web_readme,
            [
                ("공용 서버 준비 상태", "Web README documents public readiness display", "web public readiness docs"),
            ],
            failures,
        )
    if mobile_server_sync_path.exists():
        mobile_server_sync = mobile_server_sync_path.read_text(encoding="utf-8")
        check_text_contains(
            mobile_server_sync,
            [
                ("ServerPublicReadiness", "Mobile models public server readiness", "mobile public readiness model"),
                ("public_server_readiness", "Mobile reads public server readiness response", "mobile public readiness response"),
                ("_publicReadinessFromResponse", "Mobile parses public server readiness", "mobile public readiness parser"),
                ("공용 서버 준비 중", "Mobile summarizes public server readiness", "mobile public readiness summary"),
                ("/api/v1/auth/token-login", "Mobile verifies per-user token login", "mobile token login API"),
                ("two_factor_code", "Mobile sends two-factor code", "mobile two factor code"),
                ("twoFactorAuth == 'token_code'", "Mobile displays token-code two-factor auth readiness", "mobile two factor token code"),
            ],
            failures,
        )
        check_text_not_contains(
            mobile_server_sync,
            [
                ("now_server_two_factor", "Mobile does not persist two-factor code", "2FA code is request-only"),
                ("final String twoFactorCode;", "Mobile settings model excludes two-factor code", "2FA code is not stored in settings"),
            ],
            failures,
        )
    if mobile_server_settings_path.exists():
        mobile_server_settings = mobile_server_settings_path.read_text(encoding="utf-8")
        check_text_contains(
            mobile_server_settings,
            [
                ("publicReadiness?.summary", "Mobile displays public server readiness", "mobile public readiness display"),
                ("_twoFactorCodeCtrl", "Mobile exposes two-factor code input", "mobile two factor input"),
                ("twoFactorCode: _twoFactorCodeCtrl.text", "Mobile passes two-factor code only to connection test", "mobile 2FA request-only flow"),
            ],
            failures,
        )
        check_text_not_contains(
            mobile_server_settings,
            [
                ("now_server_two_factor", "Mobile settings page does not store two-factor code", "2FA code is not a saved preference"),
            ],
            failures,
        )
    if admin_api_path.exists():
        admin_source = admin_api_path.read_text(encoding="utf-8")
        check_text_contains(
            admin_source,
            [
                (
                    "from app.core.capabilities import API_VERSION",
                    "Admin API imports shared API version",
                    "API_VERSION import",
                ),
                (
                    "public_server_readiness_checks",
                    "Admin API imports shared public readiness checks",
                    "public readiness checks import",
                ),
                ('"api_version": API_VERSION', "Backup export uses shared API version", "export api_version"),
                (
                    'payload.get("api_version") == API_VERSION',
                    "Backup verify uses shared API version",
                    "verify api_version",
                ),
                ('"status_counts": status_counts', "Backup verify returns status counts", "status_counts response"),
                (
                    'required_sections = ["notes", "recordings", "users", "devices", "analysis_jobs", "sync_logs"]',
                    "Backup verify requires device section",
                    "required devices section",
                ),
                ("_check_status_counts", "Backup verify counts check statuses", "_check_status_counts"),
                ("_verification_status", "Backup verify derives overall status", "_verification_status"),
                ("백업/복구 절차", "Admin ops covers backup recovery procedure", "backup recovery ops"),
                ("status_counts.bad=0", "Admin ops covers backup status count target", "status_counts.bad=0"),
                ("checks.extend(public_server_readiness_checks())", "Admin ops uses shared public readiness checks", "public readiness checks"),
                ("비활성 기기", "Admin ops covers inactive devices", "inactive devices"),
                ("inactive_devices", "Admin ops summary covers inactive devices", "inactive devices summary"),
                ("고아 녹음 파일", "Admin ops covers orphan recording files", "orphan recording files"),
                ("orphan_recording_files", "Admin ops summary covers orphan recording files", "orphan recording files summary"),
                ("recording_orphans", "Admin API exports orphan recording files", "recording orphan export"),
                ("_recording_storage_orphan_files", "Admin API lists orphan recording files", "recording orphan file list"),
                ("recording_missing_files", "Admin API exports missing recording files", "recording missing export"),
                ("_recording_missing_files", "Admin API lists missing recording files", "recording missing file list"),
                ("recording_orphan_files", "Admin export summary includes orphan recording count", "recording orphan summary count"),
                ("recording_orphan_bytes", "Admin export summary includes orphan recording bytes", "recording orphan summary bytes"),
                ("recording_missing_files", "Admin export summary includes missing recording count", "recording missing summary count"),
            ],
            failures,
        )
    if user_accounts_service_path.exists():
        user_accounts_source = user_accounts_service_path.read_text(encoding="utf-8")
        check_text_contains(
            user_accounts_source,
            [
                ("is_active=1", "Auto-created users are active", "new users start active"),
            ],
            failures,
        )
    if users_api_path.exists():
        users_api_source = users_api_path.read_text(encoding="utf-8")
        check_text_contains(
            users_api_source,
            [
                ('@router.get("/{owner_id}/devices")', "User API lists user devices", "user devices list API"),
                ('@router.patch("/{owner_id}/devices/{device_id}")', "User API updates user device status", "user device update API"),
                ("set_user_device_active", "User API changes device active state", "set_user_device_active"),
                ("_device_payload", "User API serializes device payload", "_device_payload"),
            ],
            failures,
        )
    if user_devices_service_path.exists():
        user_devices_source = user_devices_service_path.read_text(encoding="utf-8")
        check_text_contains(
            user_devices_source,
            [
                ("is_active=1", "Auto-created devices are active", "new devices start active"),
                ("device inactive", "Inactive devices are rejected", "device inactive"),
            ],
            failures,
        )
    recording_storage_path = server_dir / "app" / "services" / "recording_storage.py"
    check(recording_storage_path.exists(), "Recording storage service exists", str(recording_storage_path), failures)
    if recording_storage_path.exists():
        recording_storage_source = recording_storage_path.read_text(encoding="utf-8")
        check_text_contains(
            recording_storage_source,
            [
                ("delete_recording_file", "Recording storage can delete replaced files", "delete_recording_file"),
                ("relative_to(storage_root)", "Recording storage deletion is limited to storage root", "storage root guard"),
                ("except OSError", "Recording storage ignores cleanup OS errors", "cleanup os errors"),
                ('cleaned in {"", ".", ".."}', "Recording storage neutralizes empty dot names", "empty/dot safe names"),
            ],
            failures,
        )
    if monitor_api_path.exists():
        monitor_source = monitor_api_path.read_text(encoding="utf-8")
        check_text_contains(
            monitor_source,
            [
                (
                    "from app.core.capabilities import public_server_readiness_checks",
                    "Monitor API imports shared public readiness checks",
                    "public readiness checks import",
                ),
                (
                    "checks.extend(public_server_readiness_checks())",
                    "Monitor ops uses shared public readiness checks",
                    "public readiness checks",
                ),
                (
                    "status_counts.bad=0",
                    "Monitor export page explains backup status counts",
                    "status_counts.bad=0",
                ),
                ("백업/복구 절차", "Monitor ops covers backup recovery procedure", "backup recovery ops"),
                ('@router.get("/admin/public"', "Monitor exposes public server page", "public server page route"),
                ("_admin_public_html", "Monitor renders public server page", "public server page renderer"),
                ("비활성 기기", "Monitor ops covers inactive devices", "inactive devices"),
                ("고아 녹음 파일", "Monitor ops covers orphan recording files", "orphan recording files"),
                ("누락 녹음 파일", "Monitor ops covers missing recording files", "missing recording files"),
                ("고아 녹음 파일 JSON", "Monitor recordings links orphan export", "recording orphan export link"),
                ("누락 녹음 파일 JSON", "Monitor recordings links missing export", "recording missing export link"),
                ("/api/v1/admin/export/recording-orphans", "Monitor recordings uses orphan export API", "recording orphan export API"),
                ("/api/v1/admin/export/recording-missing-files", "Monitor recordings uses missing export API", "recording missing export API"),
                ('summary["recording_orphan_files"]', "Monitor export page shows orphan recording count", "recording orphan export count"),
                ('summary["recording_missing_files"]', "Monitor export page shows missing recording count", "recording missing export count"),
                (
                    "NOW_STORAGE_DIR",
                    "Monitor export page explains recording storage backup",
                    "NOW_STORAGE_DIR",
                ),
                ("/api/v1/admin/export/devices", "Monitor export page links device export", "device export link"),
                ("등록 기기", "Monitor export page shows device count", "device count card"),
                ("_note_export_query", "Monitor notes page builds filtered export link", "note export query"),
                ("제목/내용 검색", "Monitor notes page has search filter", "notes search filter"),
                ("삭제 제외", "Monitor notes page has deleted filter", "notes deleted filter"),
            ],
            failures,
        )
    if recovery_path.exists():
        recovery = recovery_path.read_text(encoding="utf-8")
        check_text_contains(
            recovery,
            [
                ("/api/v1/admin/export/verify", "Recovery procedure covers backup verification", "export/verify"),
                ("content_sha256", "Recovery procedure covers checksum", "content_sha256"),
                ("status_counts.bad", "Recovery procedure covers status counts", "status_counts.bad"),
                ("원본 녹음 파일", "Recovery procedure covers recording files", "recording files"),
                ("summary.recording_orphan_files", "Recovery procedure covers orphan recording count", "recording orphan count"),
                ("summary.recording_missing_files", "Recovery procedure covers missing recording count", "recording missing count"),
                ("고아 녹음 파일 JSON", "Recovery procedure covers orphan recording export", "recording orphan export"),
                ("recording-missing-files", "Recovery procedure covers missing recording export", "recording missing export"),
                ("저장소 백업에서 해당 원본 파일", "Recovery procedure covers missing recording storage restore", "recording missing storage restore"),
                ("DB와 저장소를 먼저 별도 백업", "Recovery procedure covers pre-restore backup", "pre-restore backup"),
                ("checks`에 `bad`", "Recovery procedure covers bad checks", "bad checks"),
                ("checks`에 `warn`", "Recovery procedure covers warn checks", "warn checks"),
                ("/admin/ops", "Recovery procedure covers ops follow-up", "admin/ops"),
            ],
            failures,
        )
    if deploy_path.exists():
        deploy = deploy_path.read_text(encoding="utf-8")
        check_text_contains(
            deploy,
            [
                ("git pull origin main", "Deploy checklist covers source update", "git pull origin main"),
                ("python3 scripts/preflight.py", "Deploy checklist covers preflight", "preflight"),
                ("NowNote server preflight passed", "Deploy checklist explains preflight pass summary", "preflight passed summary"),
                ("Preflight failed", "Deploy checklist explains preflight failure summary", "preflight failed summary"),
                ("docker compose up --build -d", "Deploy checklist covers compose up", "docker compose up --build -d"),
                ("python3 scripts/smoke_test.py", "Deploy checklist covers smoke test", "smoke_test.py"),
                ("--timeout 30", "Deploy checklist covers smoke timeout option", "smoke timeout"),
                ("--ready-retries 10", "Deploy checklist covers smoke readiness retries", "smoke readiness retries"),
                ("NOW_USER_TOKEN_REQUIRED=true", "Deploy checklist documents public token enforcement setting", "deploy public token enforcement"),
                ("사용자별 기기 조회/해제 API", "Deploy checklist covers public device self-management", "device self-management"),
                ("사용자별 데이터 격리 자동 검증", "Deploy checklist covers public data isolation checks", "data isolation"),
                ("NowNote server smoke test passed", "Deploy checklist explains smoke pass summary", "smoke passed summary"),
                ("SMOKE TEST FAILED", "Deploy checklist explains smoke failure summary", "smoke failure summary"),
                ("SMOKE TEST HTTP FAILED", "Deploy checklist explains smoke HTTP failure summary", "smoke HTTP failure summary"),
                ("SMOKE TEST CONNECTION FAILED", "Deploy checklist explains smoke connection failure summary", "smoke connection failure summary"),
                ("SMOKE TEST JSON FAILED", "Deploy checklist explains smoke JSON failure summary", "smoke JSON failure summary"),
                ("백업/복구 절차", "Deploy checklist covers backup recovery ops check", "backup recovery ops"),
                ("고아 녹음 파일", "Deploy checklist covers orphan recording ops check", "recording orphan ops"),
                ("/api/v1/admin/export/recording-orphans", "Deploy checklist covers orphan recording export", "recording orphan export"),
                ("누락 녹음 파일", "Deploy checklist covers missing recording ops check", "recording missing ops"),
                ("/api/v1/admin/export/recording-missing-files", "Deploy checklist covers missing recording export", "recording missing export"),
                ("status_counts.bad=0", "Deploy checklist covers backup verify status count target", "status_counts.bad=0"),
                ("/api/v1/admin/export/all", "Deploy checklist covers backup export", "export/all"),
                ("/api/v1/admin/export/verify", "Deploy checklist covers backup verification", "export/verify"),
            ],
            failures,
        )
    if auth_policy_path.exists():
        auth_policy = auth_policy_path.read_text(encoding="utf-8")
        check_text_contains(
            auth_policy,
            [
                ("개인 Docker 서버", "Auth policy covers private Docker server", "private server auth policy"),
                ("공용 NowNote 서버", "Auth policy covers public NowNote server", "public server auth policy"),
                ("NOW_USER_TOKEN_REQUIRED=true", "Auth policy covers user token required mode", "NOW_USER_TOKEN_REQUIRED=true"),
                ("사용자별 접속 토큰, 사용자 ID, 기기 ID", "Auth policy covers client token setup values", "client token setup values"),
                ("사용자별 접속 토큰 강제", "Auth policy explains public user token enforcement", "public user token enforcement"),
                ("사용자 토큰 확인 화면/API", "Auth policy covers token login readiness", "token login readiness"),
                ("2단계 코드는 저장 대상이 아니라", "Auth policy says two-factor code is not stored", "two factor code storage policy"),
                ("2단계 코드 검증", "Auth policy covers two-factor code flow", "two-factor code flow"),
                ("사용자별 데이터 격리 자동 검증", "Auth policy covers user data isolation check", "data isolation"),
                ("HTTPS, reverse proxy", "Auth policy covers public HTTPS proxy check", "HTTPS reverse proxy"),
                ("--public-server", "Auth policy covers public preflight command", "public preflight"),
            ],
            failures,
        )
    if help_ko_path.exists():
        help_ko = help_ko_path.read_text(encoding="utf-8")
        check_text_contains(
            help_ko,
            [
                ("2단계 인증 코드", "Korean help documents two-factor code setup", "2FA code help ko"),
                ("6자리 인증 코드", "Korean help explains two-factor verification code", "2FA verification help ko"),
                ("암호화 저장은 현재 1차 범위에서는 켜지지 않는 기능입니다", "Korean help marks encryption disabled in phase one", "encryption phase one help ko"),
                ("로그인 기반 암호화 저장이 필요한 운영 구조", "Korean help describes encryption as operating readiness", "encryption readiness help ko"),
                ("사용자별 접속 토큰 강제 설정", "Korean help documents public token enforcement", "public token enforcement help ko"),
            ],
            failures,
        )
        check_text_not_contains(
            help_ko,
            [
                ("나중에 로그인 기반 암호화 저장을 사용", "Korean help avoids outdated encryption wording", "stale encryption help ko"),
                ("로그인 화면, 실제 2단계 인증", "Korean help avoids stale public server blockers", "stale public server help ko"),
            ],
            failures,
        )
    if help_en_path.exists():
        help_en = help_en_path.read_text(encoding="utf-8")
        check_text_contains(
            help_en,
            [
                ("Two-factor code", "English help documents two-factor code setup", "2FA code help en"),
                ("six-digit verification code", "English help explains two-factor verification code", "2FA verification help en"),
                ("Encrypted storage is not enabled in the current first-phase scope", "English help marks encryption disabled in phase one", "encryption phase one help en"),
                ("operating model that can support login-based encrypted storage", "English help describes encryption as operating readiness", "encryption readiness help en"),
                ("per-user token enforcement", "English help documents public token enforcement", "public token enforcement help en"),
            ],
            failures,
        )
        check_text_not_contains(
            help_en,
            [
                ("may later use login-based encrypted storage", "English help avoids outdated encryption wording", "stale encryption help en"),
            ],
            failures,
        )
    if web_help_path.exists():
        web_help = web_help_path.read_text(encoding="utf-8")
        check_text_contains(
            web_help,
            [
                ("암호화 저장은 현재 1차 범위에서는 켜지지 않습니다", "Web help marks encryption disabled in phase one", "web encryption phase one"),
                ("Encrypted storage is not enabled in the current first-phase scope", "Web English help marks encryption disabled in phase one", "web encryption phase one en"),
                ("사용자별 접속 토큰 강제 설정", "Web help documents public token enforcement", "web public token enforcement"),
                ("per-user token enforcement", "Web English help documents public token enforcement", "web public token enforcement en"),
            ],
            failures,
        )
        check_text_not_contains(
            web_help,
            [
                ("로그인 화면, 실제 2단계 인증", "Web help avoids stale public server blockers", "stale public server help web"),
            ],
            failures,
        )
    if mobile_help_path.exists():
        mobile_help = mobile_help_path.read_text(encoding="utf-8")
        check_text_contains(
            mobile_help,
            [
                ("암호화 저장은 현재 1차 범위에서는 켜지지 않습니다", "Mobile help marks encryption disabled in phase one", "mobile encryption phase one"),
                ("서버 주소, API 토큰, 사용자 ID, 기기 ID", "Mobile help documents server connection values", "mobile server connection values"),
                ("사용자별 접속 토큰과 2단계 인증 코드", "Mobile help documents public token and two-factor code", "mobile public token and 2FA help"),
                ("사용자별 접속 토큰 강제 설정", "Mobile help documents public token enforcement", "mobile public token enforcement"),
                ("공개 HTTPS, reverse proxy 환경", "Mobile help documents current public server blocker", "mobile public server HTTPS reverse proxy"),
            ],
            failures,
        )
        check_text_not_contains(
            mobile_help,
            [
                ("로그인 화면, 실제 2단계 인증", "Mobile help avoids stale public server blockers", "stale public server help mobile"),
            ],
            failures,
        )
    if mobile_readme_path.exists():
        mobile_readme = mobile_readme_path.read_text(encoding="utf-8")
        check_text_contains(
            mobile_readme,
            [
                ("NowNote 모바일 앱", "Mobile README describes NowNote app", "mobile README title"),
                ("음성 메모", "Mobile README documents voice memo focus", "mobile README voice memo"),
                ("서버 연결", "Mobile README documents server connection", "mobile README server connection"),
                ("Markdown 가져오기", "Mobile README documents markdown import", "mobile README markdown import"),
                ("2단계 인증 코드는 저장하지 않고", "Mobile README documents request-only 2FA code", "mobile README 2FA storage policy"),
                ("암호화 저장은 현재 1차 범위에서는 켜지지 않습니다", "Mobile README marks encryption disabled", "mobile README encryption phase one"),
            ],
            failures,
        )
        check_text_not_contains(
            mobile_readme,
            [
                ("A new Flutter project", "Mobile README is not Flutter template", "remove Flutter template README"),
                ("Write your first Flutter app", "Mobile README avoids starter guide", "remove starter guide"),
            ],
            failures,
        )
    if smoke_path.exists():
        smoke = smoke_path.read_text(encoding="utf-8")
        check_text_contains(
            smoke,
            [
                ("/api/v1/admin/export/all", "Smoke covers full backup export", "export/all"),
                ("/api/v1/admin/export/devices", "Smoke covers device export", "export/devices"),
                ("/api/v1/admin/export/verify", "Smoke covers backup verification", "export/verify"),
                ("--timeout", "Smoke supports request timeout option", "smoke timeout option"),
                ("--ready-retries", "Smoke supports readiness retry option", "smoke readiness retries"),
                ("--ready-delay", "Smoke supports readiness retry delay option", "smoke readiness delay"),
                ("wait_until_ready", "Smoke waits for readiness before full checks", "wait_until_ready"),
                ("REQUEST_TIMEOUT", "Smoke uses shared request timeout", "REQUEST_TIMEOUT"),
                ("내보내기 화면에 기기 export 링크", "Smoke checks export page device link", "export device link"),
                ("내보내기 화면에 기기 집계", "Smoke checks export page device count", "export device count"),
                ("/admin/recovery", "Smoke covers recovery admin page", "admin/recovery"),
                ("/admin/deploy", "Smoke covers deploy admin page", "admin/deploy"),
                ("배포 체크리스트 화면에 공용 서버 사용자 토큰 강제 설정 안내", "Smoke checks deploy public token enforcement", "deploy public token enforcement"),
                ("/admin/help", "Smoke covers help admin page", "admin/help"),
                ("사용자 토큰 확인 화면/API", "Smoke covers public token check help", "public token help"),
                ("2단계 코드 검증", "Smoke covers public two-factor help", "public two-factor help"),
                ("admin_ops", "Smoke covers admin ops capability", "admin_ops"),
                ("backup_export", "Smoke covers backup export capability", "backup_export"),
                ("backup_verify", "Smoke covers backup verify capability", "backup_verify"),
                ("녹음 저장 파일명에 경로 문자", "Smoke checks recording filename path safety", "recording filename path safety"),
                ("owner/device 디렉터리", "Smoke checks recording owner device directory", "recording owner device directory"),
                ("recordings(path_safety)", "Smoke checks recording upload path safety", "recording path safety"),
                ("recordings(replace)", "Smoke checks recording replacement", "recording replacement"),
                ("같은 local_id가 중복", "Smoke checks recording duplicate local_id", "recording duplicate local_id"),
                ("recording-orphans", "Smoke checks recording orphan export", "recording orphan export"),
                ("고아 녹음 export", "Smoke validates recording orphan export", "recording orphan export validation"),
                ("recording-missing-files", "Smoke checks recording missing export", "recording missing export"),
                ("누락 녹음 export", "Smoke validates recording missing export", "recording missing export validation"),
                ("user_accounts", "Smoke covers user accounts capability", "user_accounts"),
                ("user_access_tokens", "Smoke covers user access tokens capability", "user_access_tokens"),
                ("user_token_required", "Smoke checks user token required flag", "user_token_required"),
                ("user token required로 차단", "Smoke checks missing user token detail", "missing user token detail"),
                ("invalid user token으로 차단", "Smoke checks invalid user token detail", "invalid user token detail"),
                ("실패한 사용자 토큰 요청이 마지막 사용 시각", "Smoke checks failed token does not update last used", "failed token last used"),
                ("다른 사용자 토큰으로 local_user 데이터 API", "Smoke checks cross-user token isolation", "cross user token isolation"),
                ("GET /auth/token", "Smoke checks token login page", "token login page"),
                ("POST /api/v1/auth/token-login", "Smoke checks token login API", "token login API"),
                ("잘못된 사용자 토큰 로그인이 invalid user token", "Smoke checks invalid token login", "invalid token login"),
                ("2단계 인증 사용자의 코드 없는 로그인", "Smoke checks missing two-factor code", "missing two factor code"),
                ("2단계 인증 사용자의 잘못된 코드 로그인", "Smoke checks invalid two-factor code", "invalid two factor code"),
                ("POST /api/v1/auth/token-login(two_factor)", "Smoke checks two-factor token login", "two factor token login"),
                ("local_user 메모 목록에 다른 사용자 메모", "Smoke checks note list user data isolation", "note list user data isolation"),
                ("local_user 검색 결과에 다른 사용자 메모", "Smoke checks note search user data isolation", "note search user data isolation"),
                ("smoke_admin_user 메모 목록에서 자기 메모", "Smoke checks other user can read own data", "other user own data"),
                ("local_user 동기화 응답에 다른 사용자 메모", "Smoke checks sync user data isolation", "sync user data isolation"),
                ("local_user 녹음 목록에 다른 사용자 녹음", "Smoke checks recording user data isolation", "recording user data isolation"),
                ("local_user 분석 작업 목록에 다른 사용자 작업", "Smoke checks analysis user data isolation", "analysis user data isolation"),
                ("사용자 기기 목록 조회 응답", "Smoke checks user device list API", "user device list API"),
                ("사용자 기기 상태 변경 응답", "Smoke checks user device update API", "user device update API"),
                ("사용자 목록 API에 사용자 토큰 해시", "Smoke checks user list token hash safety", "user list token hash safety"),
                ("사용자 export에 사용자 토큰 해시", "Smoke checks user export token hash safety", "user export token hash safety"),
                ("max_tree_note_level", "Smoke covers tree depth capability", "max_tree_note_level"),
                ("supported_note_types", "Smoke covers supported note types", "supported_note_types"),
                ("user_timezone", "Smoke covers user timezone capability", "user_timezone"),
                ("two_factor_auth", "Smoke covers two-factor auth status", "two_factor_auth"),
                ("TWO_FACTOR_AUTH_STATUS", "Smoke checks two-factor auth status", "TWO_FACTOR_AUTH_STATUS"),
                ("token_code", "Smoke checks two-factor token code status", "two factor token code status"),
                ("MAX_TREE_NOTE_LEVEL", "Smoke checks tree depth constant", "MAX_TREE_NOTE_LEVEL"),
                ("SUPPORTED_NOTE_TYPES", "Smoke checks supported note type constant", "SUPPORTED_NOTE_TYPES"),
                ("status_counts", "Smoke checks backup verify status counts", "status_counts"),
                ("내보내기 요약에 기기 건수", "Smoke checks export summary devices count", "summary devices count"),
                ("내보내기 요약에 전체 export 건수", "Smoke checks export summary total count", "summary total count"),
                ("내보내기 요약에 고아 녹음 파일 건수", "Smoke checks export summary orphan recordings", "summary orphan recordings"),
                ("내보내기 요약에 고아 녹음 파일 크기", "Smoke checks export summary orphan bytes", "summary orphan bytes"),
                ("내보내기 요약에 누락 녹음 파일 건수", "Smoke checks export summary missing recordings", "summary missing recordings"),
                ("항목 합계와 다릅니다", "Smoke checks export summary total consistency", "summary total consistency"),
                ("verify(missing-devices)", "Smoke checks missing devices backup verification", "missing devices verify"),
                ("기기 누락 백업 검증", "Smoke checks devices missing message", "missing devices message"),
                ("운영 점검 화면에 백업/복구 절차 항목", "Smoke checks ops page backup recovery guidance", "ops page backup recovery"),
                ("운영 점검 화면에 준비된 사용자별 접속 토큰 항목", "Smoke checks ops ready token guidance", "ops ready token"),
                ("운영 점검 화면에 사용자 토큰 확인 준비 항목", "Smoke checks ops page public login guidance", "ops page public login"),
                ("운영 점검에 공용 서버 인증 항목", "Smoke checks ops public auth item", "ops public auth item"),
                ("운영 점검 요약에 토큰 없는 사용자 집계", "Smoke checks ops users without token summary", "ops users without token"),
                ("사용자별 토큰 기준", "Smoke checks ops public auth token message", "ops public auth token message"),
                ("운영 점검 화면에 사용자별 기기 조회/해제 준비 항목", "Smoke checks ops page public device guidance", "ops page public device"),
                ("운영 점검 화면에 공용 서버 데이터 격리 항목", "Smoke checks ops page public data isolation guidance", "ops page public data isolation"),
                ("운영 점검에 비활성 기기 항목", "Smoke checks ops inactive devices", "ops inactive devices"),
                ("운영 점검에 고아 녹음 파일 항목", "Smoke checks ops orphan recordings", "ops orphan recording files"),
                ("운영 점검 요약에 고아 녹음 파일 집계", "Smoke checks ops orphan summary", "ops orphan recording files summary"),
                ("운영 점검에 누락 녹음 파일 항목", "Smoke checks ops missing recordings", "ops missing recording files"),
                ("운영 점검 요약에 누락 녹음 파일 집계", "Smoke checks ops missing summary", "ops missing recording files summary"),
                ("녹음 관리 화면에 누락 녹음 파일 JSON 링크", "Smoke checks recordings missing link", "recordings missing link"),
                ("녹음 관리 화면에 누락 녹음 파일 export 링크", "Smoke checks recordings missing export link", "recordings missing export link"),
                ("도움말 화면에 공용 서버 기기 등록 점검 안내", "Smoke checks help page public device guidance", "help page public device"),
                ("도움말 화면에 공용 서버 데이터 격리 점검 안내", "Smoke checks help page public data isolation guidance", "help page public data isolation"),
                ("공용 서버 준비 화면에 SERVER_AUTH_POLICY.md 내용", "Smoke checks public server page content", "public server page content"),
                ("공용 서버 준비 화면에 사용자별 토큰 필수 기준", "Smoke checks public server token policy", "public server token policy"),
                ("공용 서버 준비 화면에 데이터 격리 기준", "Smoke checks public server data isolation", "public server data isolation"),
                ("서버 정보에 공용 서버 준비 상태 planned", "Smoke checks server public readiness status", "server public readiness status"),
                ("서버 정보의 공용 서버 준비 상태에 사용자별 접속 토큰 준비 항목", "Smoke checks server public readiness ready items", "server public readiness ready items"),
                ("서버 정보의 공용 서버 준비 상태 상세에 사용자 기기 관리 준비 항목", "Smoke checks server public readiness detail items", "server public readiness detail items"),
                ("서버 정보의 공용 서버 준비 상태에 사용자별 데이터 격리 자동 검증", "Smoke checks server public readiness data isolation", "server public readiness data isolation"),
                ("서버 정보의 공용 서버 준비 상태에 사용자 토큰 확인 화면/API", "Smoke checks server public readiness token login", "server public readiness token login"),
                ("기기 관리 화면에 활성 상태 안내", "Smoke checks devices status guidance", "devices status guidance"),
                ("기기 관리 화면에 비활성 기기 차단 안내", "Smoke checks devices inactive guidance", "devices inactive guidance"),
                ("기기 관리 화면에 현재 조건 JSON 링크", "Smoke checks devices export link", "devices export link"),
                ("기기 관리 화면에 owner/device 필터", "Smoke checks devices filters", "devices filters"),
                ("사용자 관리 화면에 현재 조건 JSON 링크", "Smoke checks users export link", "users export link"),
                ("사용자 관리 화면에 검색 필터", "Smoke checks users search filter", "users search filter"),
                ("user inactive로 차단", "Smoke checks inactive user detail", "inactive user detail"),
                ("분석 관리 화면에 현재 조건 JSON 링크", "Smoke checks analysis export link", "analysis export link"),
                ("분석 관리 화면에 필터", "Smoke checks analysis filters", "analysis filters"),
                ("메모 관리 화면에 현재 조건 JSON 링크", "Smoke checks notes export link", "notes export link"),
                ("메모 관리 화면에 검색 필터", "Smoke checks notes search filter", "notes search filter"),
                ("메모 관리 화면에 타입/삭제 필터", "Smoke checks notes type deleted filters", "notes type deleted filters"),
                ("비활성 기기 동기화 차단", "Smoke checks inactive device blocking", "inactive device blocking"),
                ("백업/복구 절차", "Smoke checks deploy backup recovery guidance", "backup recovery deploy guidance"),
                ("API_VERSION", "Smoke checks API version", "API_VERSION"),
                ("NowNote server smoke test passed", "Smoke prints pass summary", "smoke passed summary"),
                ("SMOKE TEST FAILED", "Smoke prints failure summary", "smoke failure summary"),
                ("SMOKE TEST HTTP FAILED", "Smoke prints HTTP failure summary", "smoke HTTP failure summary"),
                ("SMOKE TEST CONNECTION FAILED", "Smoke prints connection failure summary", "smoke connection failure summary"),
                ("SMOKE TEST JSON FAILED", "Smoke prints JSON failure summary", "smoke JSON failure summary"),
            ],
            failures,
        )

    if args.public_server:
        check(
            user_token_required == "true",
            "Public server user token check enabled",
            "NOW_USER_TOKEN_REQUIRED must be true before public opening",
            failures,
        )
        check(
            "login_or_token_delivery" in capabilities_source,
            "Public server token login flow",
            "User token check page and token-login API are exposed",
            failures,
        )
        check(
            'TWO_FACTOR_AUTH_STATUS = "token_code"' in capabilities_source
            and "real_two_factor_challenge" in capabilities_source,
            "Public server real two-factor challenge",
            "Two-factor code challenge is exposed",
            failures,
        )
        check(
            "user_device_self_management" in capabilities_source,
            "Public server device self-management",
            "User device list and activation API is exposed",
            failures,
        )
        check(
            "user_data_isolation_verification" in capabilities_source,
            "Public server data isolation",
            "User-specific data access isolation smoke checks are exposed",
            failures,
        )
        check(
            public_base_url.startswith("https://") and behind_reverse_proxy == "true",
            "Public server HTTPS/reverse proxy",
            "NOW_PUBLIC_BASE_URL must be https:// and NOW_BEHIND_REVERSE_PROXY must be true before opening",
            failures,
        )

    if failures:
        print(f"\nPreflight failed ({check_summary()}):")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(f"NowNote server preflight passed ({check_summary()})")


if __name__ == "__main__":
    main()
