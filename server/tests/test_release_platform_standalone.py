"""DB 없이 실제 release router의 플랫폼별 안내를 검증한다."""
import json
import re
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.app_release import router
from app.core import capabilities


class ReleasePlatformTest(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)

    def test_independent_versions_and_downloads(self):
        with patch.object(capabilities, "LATEST_APP_VERSION", "2.4.0"), patch.object(
            capabilities, "ANDROID_APP_VERSION", "2.3.9", create=True
        ):
            for platform, version in (("windows", "2.4.0"), ("web", "2.4.0"), ("android", "2.3.9")):
                with self.subTest(platform=platform):
                    response = self.client.get("/api/v1/app/release", params={"platform": platform})
                    self.assertEqual(response.status_code, 200)
                    body = response.json()
                    self.assertEqual(set(body), {"status", "latest_version", "release_tag", "release_url", "downloads"})
                    self.assertEqual(body["status"], "ok")
                    self.assertEqual(body["latest_version"], version)
                    self.assertEqual(body["release_tag"], "v" + version)
                    self.assertTrue(body["release_url"].endswith("/tag/v" + version))
                    self.assertTrue(body["downloads"]["windows_installer"].endswith("/v2.4.0/NowNote-Setup-2.4.0-x64.exe"))
                    self.assertTrue(body["downloads"]["android_apk"].endswith("/v2.3.9/NowNote-2.3.9.apk"))

    def test_legacy_default_is_windows_without_auth(self):
        self.assertEqual(router.dependencies, [])
        self.assertEqual(self.client.get("/api/v1/app/release").json(),
                         self.client.get("/api/v1/app/release?platform=windows").json())

    def test_unknown_platform_rejected(self):
        with self.assertRaises(ValueError):
            capabilities.app_release_info("linux")
        for value in ("", "linux", "ANDROID", "../../android"):
            with self.subTest(platform=value):
                self.assertEqual(self.client.get("/api/v1/app/release", params={"platform": value}).status_code, 422)

    def test_candidate_build_versions_match(self):
        root = Path(__file__).resolve().parents[2]
        package = json.loads((root / "desktop/package.json").read_text(encoding="utf-8"))
        lock = json.loads((root / "desktop/package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(capabilities.LATEST_APP_VERSION, "2.4.0")
        self.assertEqual(capabilities.ANDROID_APP_VERSION, "2.3.9")
        self.assertEqual(package["version"], "2.4.0")
        self.assertEqual(lock["version"], package["version"])
        self.assertEqual(lock["packages"][""]["version"], package["version"])
        for surface in ("web", "desktop/app"):
            source = (root / surface / "app.js").read_text(encoding="utf-8")
            self.assertEqual(re.search(r'const APP_VERSION = "([^"]+)"', source)[1], package["version"])
            self.assertIn('"/api/v1/app/release?platform="', source)


if __name__ == "__main__":
    unittest.main()
