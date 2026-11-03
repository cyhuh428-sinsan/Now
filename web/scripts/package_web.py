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
    "wiki.html",
    "wiki-core.js",
    "wiki-shell.js",
    "wiki-runtime.js",
    "wiki.css",
    "crypto-worker.js",
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
    root, dist = ROOT.resolve(), DIST.resolve()
    if not dist.is_relative_to(root) or PACKAGE_DIR.resolve().parent != dist or ZIP_PATH.resolve().parent != dist:
        raise ValueError("Package output must remain inside this project's dist directory")
    if PACKAGE_DIR.is_symlink() or ZIP_PATH.is_symlink():
        raise ValueError("Package output cannot be a symbolic link")
    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)

    for relative_path in APP_FILES:
        copy_file(relative_path)

    for relative_path in APP_DIRS:
        copy_dir(relative_path)

    wiki_dir = PACKAGE_DIR / "wiki"
    wiki_dir.mkdir()
    for name in ("wiki.html", "wiki-core.js", "wiki-shell.js", "wiki-runtime.js", "wiki.css", "styles.css", "sw.js", "crypto-worker.js"):
        shutil.copy2(ROOT / name, wiki_dir / name)
    shutil.copy2(ROOT / "wiki.html", wiki_dir / "index.html")
    shutil.copytree(ROOT / "icons", wiki_dir / "icons")

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(PACKAGE_DIR.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(DIST))

    print(f"NowNote Web PWA package created: {ZIP_PATH}")
    print(f"Unpacked directory: {PACKAGE_DIR}")


if __name__ == "__main__":
    main()
