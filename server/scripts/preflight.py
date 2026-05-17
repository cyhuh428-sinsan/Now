import argparse
from pathlib import Path


PLACEHOLDER_VALUES = {
    "",
    "change-this-api-token",
    "change-this-postgres-password",
    "now-local-password",
}


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
    prefix = "[OK]" if condition else "[FAIL]"
    print(f"{prefix} {name} - {message}")
    if not condition:
        failures.append(f"{name}: {message}")


def main() -> None:
    parser = argparse.ArgumentParser(description="NowNote server deployment preflight check")
    parser.add_argument("--env-file", default=".env", help="Path to .env file")
    parser.add_argument(
        "--allow-example",
        action="store_true",
        help="Allow placeholder values when checking .env.example structure",
    )
    args = parser.parse_args()

    server_dir = Path(__file__).resolve().parents[1]
    env_path = (server_dir / args.env_file).resolve()
    compose_path = server_dir / "docker-compose.yml"
    smoke_path = server_dir / "scripts" / "smoke_test.py"
    failures: list[str] = []

    check(env_path.exists(), "Env file exists", str(env_path), failures)
    if not env_path.exists():
        raise SystemExit(1)

    values = load_env(env_path)
    required_keys = [
        "NOW_SERVER_NAME",
        "NOW_API_TOKEN",
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
    check(poll_seconds.isdigit() and int(poll_seconds) > 0, "Worker poll seconds valid", poll_seconds, failures)
    check(batch_size.isdigit() and int(batch_size) > 0, "Worker batch size valid", batch_size, failures)

    compose = compose_path.read_text(encoding="utf-8")
    check('"8750:8080"' in compose, "Compose exposes port 8750", "host 8750 -> container 8080", failures)
    check("NOW_API_TOKEN: ${NOW_API_TOKEN:-}" in compose, "Compose reads NOW_API_TOKEN", "API and worker", failures)
    check("now_recording_data:${NOW_STORAGE_DIR:-/data/recordings}" in compose, "Compose storage volume follows NOW_STORAGE_DIR", "recording volume", failures)
    check("restart: unless-stopped" in compose, "Compose restart policy set", "services restart unless stopped", failures)
    check(smoke_path.exists(), "Smoke test script exists", str(smoke_path), failures)

    if failures:
        print("\nPreflight failed:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("NowNote server preflight passed")


if __name__ == "__main__":
    main()
