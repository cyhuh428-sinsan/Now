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
    compose_path = server_dir / "docker-compose.yml"
    readme_path = server_dir / "README.md"
    monitor_api_path = server_dir / "app" / "api" / "monitor.py"
    smoke_path = server_dir / "scripts" / "smoke_test.py"
    recovery_path = server_dir / "RECOVERY.md"
    deploy_path = server_dir / "DEPLOY.md"
    auth_policy_path = repo_root / "docs" / "SERVER_AUTH_POLICY.md"
    admin_api_path = server_dir / "app" / "api" / "admin.py"
    capabilities_path = server_dir / "app" / "core" / "capabilities.py"
    user_accounts_service_path = server_dir / "app" / "services" / "user_accounts.py"
    user_devices_service_path = server_dir / "app" / "services" / "user_devices.py"
    web_app_path = repo_root / "web" / "app.js"
    web_readme_path = repo_root / "web" / "README.md"
    mobile_server_sync_path = repo_root / "now_app" / "lib" / "services" / "server_sync_service.dart"
    mobile_server_settings_path = (
        repo_root / "now_app" / "lib" / "features" / "settings" / "server_settings_page.dart"
    )
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
    ]
    for key in required_keys:
        check(key in values, f"{key} set", env_path.name, failures)

    api_token = values.get("NOW_API_TOKEN", "")
    db_password = values.get("NOW_POSTGRES_PASSWORD", "")
    storage_dir = values.get("NOW_STORAGE_DIR", "")
    poll_seconds = values.get("NOW_WORKER_POLL_SECONDS", "")
    batch_size = values.get("NOW_WORKER_BATCH_SIZE", "")
    user_token_required = values.get("NOW_USER_TOKEN_REQUIRED", "").lower()

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
    check(poll_seconds.isdigit() and int(poll_seconds) > 0, "Worker poll seconds valid", poll_seconds, failures)
    check(batch_size.isdigit() and int(batch_size) > 0, "Worker batch size valid", batch_size, failures)

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
                ("사용자별 기기 등록/해제", "README documents public device registration gap", "device registration"),
                ("사용자별 데이터 접근 격리 검증", "README documents public data isolation gap", "data isolation"),
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
    check(admin_api_path.exists(), "Admin API source exists", str(admin_api_path), failures)
    check(monitor_api_path.exists(), "Monitor API source exists", str(monitor_api_path), failures)
    check(capabilities_path.exists(), "Server capabilities source exists", str(capabilities_path), failures)
    check(user_accounts_service_path.exists(), "User accounts service exists", str(user_accounts_service_path), failures)
    check(user_devices_service_path.exists(), "User devices service exists", str(user_devices_service_path), failures)
    check(web_app_path.exists(), "Web app source exists", str(web_app_path), failures)
    check(web_readme_path.exists(), "Web README exists", str(web_readme_path), failures)
    check(mobile_server_sync_path.exists(), "Mobile server sync source exists", str(mobile_server_sync_path), failures)
    check(mobile_server_settings_path.exists(), "Mobile server settings page exists", str(mobile_server_settings_path), failures)
    if capabilities_path.exists():
        capabilities_source = capabilities_path.read_text(encoding="utf-8")
        check_text_contains(
            capabilities_source,
            [
                ('API_VERSION = "v1"', "Capabilities defines API version", "API_VERSION"),
                (
                    'TWO_FACTOR_AUTH_STATUS = "planned"',
                    "Capabilities defines two-factor auth status",
                    "TWO_FACTOR_AUTH_STATUS",
                ),
                ("MAX_TREE_NOTE_LEVEL = 3", "Capabilities defines tree depth limit", "MAX_TREE_NOTE_LEVEL"),
                (
                    'SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]',
                    "Capabilities defines supported note types",
                    "SUPPORTED_NOTE_TYPES",
                ),
                ("PUBLIC_SERVER_READINESS", "Capabilities defines public server readiness", "PUBLIC_SERVER_READINESS"),
                ("public_server_readiness", "Capabilities exposes public server readiness", "public_server_readiness"),
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
            ],
            failures,
        )
    if mobile_server_settings_path.exists():
        mobile_server_settings = mobile_server_settings_path.read_text(encoding="utf-8")
        check_text_contains(
            mobile_server_settings,
            [
                ("publicReadiness?.summary", "Mobile displays public server readiness", "mobile public readiness display"),
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
                    "TWO_FACTOR_AUTH_STATUS",
                    "Admin API uses shared two-factor auth status",
                    "TWO_FACTOR_AUTH_STATUS",
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
                ("공용 서버 기기 등록", "Admin ops covers public device registration", "public device registration"),
                ("공용 서버 데이터 격리", "Admin ops covers public data isolation", "public data isolation"),
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
                    "from app.core.capabilities import TWO_FACTOR_AUTH_STATUS",
                    "Monitor API imports shared two-factor auth status",
                    "TWO_FACTOR_AUTH_STATUS import",
                ),
                (
                    "TWO_FACTOR_AUTH_STATUS",
                    "Monitor API uses shared two-factor auth status",
                    "TWO_FACTOR_AUTH_STATUS",
                ),
                (
                    "status_counts.bad=0",
                    "Monitor export page explains backup status counts",
                    "status_counts.bad=0",
                ),
                ("백업/복구 절차", "Monitor ops covers backup recovery procedure", "backup recovery ops"),
                ("공용 서버 기기 등록", "Monitor ops covers public device registration", "public device registration"),
                ("공용 서버 데이터 격리", "Monitor ops covers public data isolation", "public data isolation"),
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
                ("사용자별 기기 등록/해제", "Deploy checklist covers public device registration gap", "device registration"),
                ("사용자별 데이터 접근 격리", "Deploy checklist covers public data isolation gap", "data isolation"),
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
                ("사용자별 로그인 화면 또는 토큰 전달 UI", "Auth policy covers login/token delivery gap", "login/token delivery"),
                ("실제 2단계 인증 절차", "Auth policy covers real two-factor gap", "real two-factor"),
                ("사용자별 데이터 접근 격리 검증", "Auth policy covers user data isolation check", "data isolation"),
                ("HTTPS, reverse proxy", "Auth policy covers public HTTPS proxy check", "HTTPS reverse proxy"),
                ("--public-server", "Auth policy covers public preflight command", "public preflight"),
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
                ("/admin/help", "Smoke covers help admin page", "admin/help"),
                ("공용 서버 로그인 화면", "Smoke covers public ops help", "public ops help"),
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
                ("사용자 목록 API에 사용자 토큰 해시", "Smoke checks user list token hash safety", "user list token hash safety"),
                ("사용자 export에 사용자 토큰 해시", "Smoke checks user export token hash safety", "user export token hash safety"),
                ("max_tree_note_level", "Smoke covers tree depth capability", "max_tree_note_level"),
                ("supported_note_types", "Smoke covers supported note types", "supported_note_types"),
                ("user_timezone", "Smoke covers user timezone capability", "user_timezone"),
                ("two_factor_auth", "Smoke covers two-factor auth status", "two_factor_auth"),
                ("TWO_FACTOR_AUTH_STATUS", "Smoke checks two-factor auth status", "TWO_FACTOR_AUTH_STATUS"),
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
                ("운영 점검 화면에 공용 서버 로그인 화면 항목", "Smoke checks ops page public login guidance", "ops page public login"),
                ("운영 점검에 공용 서버 인증 항목", "Smoke checks ops public auth item", "ops public auth item"),
                ("운영 점검 요약에 토큰 없는 사용자 집계", "Smoke checks ops users without token summary", "ops users without token"),
                ("사용자별 토큰 기준", "Smoke checks ops public auth token message", "ops public auth token message"),
                ("운영 점검 화면에 공용 서버 기기 등록 항목", "Smoke checks ops page public device guidance", "ops page public device"),
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
                ("서버 정보의 공용 서버 준비 상태에 사용자별 데이터 격리 검증", "Smoke checks server public readiness data isolation", "server public readiness data isolation"),
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
            False,
            "Public server login flow",
            "User-token validation exists, but login UI and real two-factor challenge are not implemented yet",
            failures,
        )
        check(
            False,
            "Public server device registration",
            "User-specific device registration and revocation flow must be confirmed before public opening",
            failures,
        )
        check(
            False,
            "Public server data isolation",
            "User-specific data access isolation must be verified before public opening",
            failures,
        )
        check(
            False,
            "Public server HTTPS/reverse proxy",
            "Confirm domain, HTTPS, reverse proxy, and recovery procedure before opening",
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
