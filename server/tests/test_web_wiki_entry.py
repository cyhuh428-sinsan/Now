"""Read-only static entry checks; no lifespan, DB, account or external request."""
from pathlib import Path
import asyncio
import unittest
from unittest.mock import patch

from app.main import create_app


class WikiEntryTests(unittest.IsolatedAsyncioTestCase):
    async def test_wiki_entry_is_independent_and_keeps_memo_compatibility(self):
        web = Path(__file__).resolve().parents[2] / "web"
        with patch("app.main._web_app_dir", return_value=web):
            app = create_app()
            async def get(path):
                messages = []
                async def receive():
                    await asyncio.Event().wait()
                async def send(message):
                    messages.append(message)
                await app({"type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
                           "http_version": "1.1", "method": "GET", "scheme": "http", "path": path,
                           "raw_path": path.encode(), "query_string": b"", "root_path": "", "headers": [],
                           "client": ("test", 1234), "server": ("test", 80)}, receive, send)
                status = next(row["status"] for row in messages if row["type"] == "http.response.start")
                body = b"".join(row.get("body", b"") for row in messages if row["type"] == "http.response.body").decode()
                return status, body
            for route in ("/wiki", "/wiki/", "/wiki/index.html"):
                with self.subTest(route=route):
                    status, body = await get(route)
                    self.assertEqual(status, 200)
                    self.assertIn('src="./wiki-shell.js"', body)
                    self.assertNotIn('src="./app.js"', body)
            self.assertIn('src="./app.js?', (await get("/app/"))[1])
            for asset in ("wiki-core.js", "wiki-shell.js", "wiki-runtime.js", "wiki.css", "crypto-worker.js"):
                self.assertEqual((await get("/wiki/" + asset))[0], 200)
            self.assertEqual((await get("/wiki/server/.env"))[0], 404)
            self.assertEqual((await get("/api/v1/wiki-shell-auth"))[0], 404)


if __name__ == "__main__":
    unittest.main()
