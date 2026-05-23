from __future__ import annotations

import shutil
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
PACKAGE_DIR = DIST / "nownote-web-pwa"
ZIP_PATH = DIST / "nownote-web-pwa.zip"

APP_FILES = [
    "index.html",
    "app.js",
    "styles.css",
    "help.html",
    "manifest.webmanifest",
    "sw.js",
    "README.md",
    "runtime_checklist_ko.md",
]

APP_DIRS = [
    "icons",
]


def copy_file(relative_path: str) -> None:
    source = ROOT / relative_path
    target = PACKAGE_DIR / relative_path
    if not source.exists():
        raise FileNotFoundError(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def copy_dir(relative_path: str) -> None:
    source = ROOT / relative_path
    target = PACKAGE_DIR / relative_path
    if not source.exists():
        raise FileNotFoundError(source)
    shutil.copytree(source, target)


def main() -> None:
    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)

    for relative_path in APP_FILES:
        copy_file(relative_path)

    for relative_path in APP_DIRS:
        copy_dir(relative_path)

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(PACKAGE_DIR.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(DIST))

    print(f"NowNote Web PWA package created: {ZIP_PATH}")
    print(f"Unpacked directory: {PACKAGE_DIR}")


if __name__ == "__main__":
    main()
