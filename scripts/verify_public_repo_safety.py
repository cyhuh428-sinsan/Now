from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_TRACKED_PATHS = {
    "server/.env",
    "now_app/android/key.properties",
    "now_app/android/upload-keystore.jks",
}

FORBIDDEN_SUFFIXES = (
    ".jks",
    ".keystore",
    ".p12",
    ".pfx",
    ".pem",
)

ALLOWED_SECRET_PLACEHOLDERS = {
    "",
    "CHANGE_ME",
    "change-this-api-token",
    "change-this-postgres-password",
    "now-local-password",
    "긴-랜덤-토큰",
    "사용자별-접속-토큰",
    "여기에-긴-랜덤-토큰",
    "여기에-긴-랜덤-DB-비밀번호",
    "android",
    "upload",
}

SECRET_ASSIGNMENTS = (
    "NOW_API_TOKEN",
    "NOW_POSTGRES_PASSWORD",
    "storePassword",
    "keyPassword",
)

SENSITIVE_PATTERNS = [
    (re.compile(r"-----BEGIN (?:RSA |DSA |EC |OPENSSH |)PRIVATE KEY-----"), "private key block"),
    (re.compile(r"\bghp_[A-Za-z0-9_]{30,}\b"), "GitHub personal access token"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"), "GitHub fine-grained token"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{30,}\b"), "OpenAI-style API key"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"), "Slack token"),
]

CHECK_TOTAL = 0
CHECK_PASSED = 0


def check(condition: bool, name: str, detail: str, failures: list[str]) -> None:
    global CHECK_TOTAL, CHECK_PASSED
    CHECK_TOTAL += 1
    prefix = "[OK]" if condition else "[FAIL]"
    print(f"{prefix} {name} - {detail}")
    if condition:
        CHECK_PASSED += 1
    else:
        failures.append(f"{name}: {detail}")


def git_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=False,
    )
    return [item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def is_binary(data: bytes) -> bool:
    return b"\0" in data[:4096]


def assignment_secret_findings(path: str, text: str) -> list[str]:
    findings: list[str] = []
    for key in SECRET_ASSIGNMENTS:
        pattern = re.compile(rf"(?m)^\s*{re.escape(key)}\s*=\s*([^\s#]+)")
        for match in pattern.finditer(text):
            value = match.group(1).strip().strip('"').strip("'")
            if value in ALLOWED_SECRET_PLACEHOLDERS:
                continue
            if value.startswith("${") and value.endswith("}"):
                continue
            if value.startswith("$env:"):
                continue
            if value.startswith("keystoreProperties["):
                continue
            findings.append(f"{path}: {key}=<non-placeholder>")
    return findings


def sensitive_pattern_findings(path: str, text: str) -> list[str]:
    findings: list[str] = []
    for pattern, label in SENSITIVE_PATTERNS:
        if pattern.search(text):
            findings.append(f"{path}: {label}")
    return findings


def main() -> None:
    failures: list[str] = []
    files = git_files()
    normalized = {path.replace("\\", "/") for path in files}

    check(bool(files), "Tracked file list loaded", f"{len(files)} files", failures)

    for forbidden in sorted(FORBIDDEN_TRACKED_PATHS):
        check(forbidden not in normalized, "Sensitive local file is not tracked", forbidden, failures)

    forbidden_suffix_files = [
        path for path in normalized
        if path.lower().endswith(FORBIDDEN_SUFFIXES)
        and not path.endswith(".example")
    ]
    check(
        not forbidden_suffix_files,
        "Sensitive key/certificate files are not tracked",
        ", ".join(forbidden_suffix_files) if forbidden_suffix_files else "none",
        failures,
    )

    assignment_findings: list[str] = []
    pattern_findings: list[str] = []
    scanned_text_files = 0

    for path in files:
        absolute = ROOT / path
        data = absolute.read_bytes()
        if is_binary(data):
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        scanned_text_files += 1
        assignment_findings.extend(assignment_secret_findings(path.replace("\\", "/"), text))
        pattern_findings.extend(sensitive_pattern_findings(path.replace("\\", "/"), text))

    check(scanned_text_files > 0, "Text files scanned", f"{scanned_text_files} files", failures)
    check(
        not assignment_findings,
        "Tracked text files avoid real secret assignments",
        "; ".join(assignment_findings[:5]) if assignment_findings else "placeholders only",
        failures,
    )
    check(
        not pattern_findings,
        "Tracked text files avoid common raw secret patterns",
        "; ".join(pattern_findings[:5]) if pattern_findings else "none",
        failures,
    )

    if failures:
        print(f"\nNowNote public repo safety verification failed ({CHECK_PASSED}/{CHECK_TOTAL} checks):")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(f"NowNote public repo safety verification passed ({CHECK_PASSED}/{CHECK_TOTAL} checks)")


if __name__ == "__main__":
    main()
