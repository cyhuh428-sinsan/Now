"""Tiny local /transcribe stub for mobile record-then-transcribe checks.

This helper is intentionally simple and is not part of production runtime.
It accepts POST /transcribe and returns a fixed Korean transcript so an
Android device can verify the app-side recording upload and response handling
without requiring a real Whisper server.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class TranscribeStubHandler(BaseHTTPRequestHandler):
    server_version = "NowNoteTranscribeStub/1.0"

    def _write_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib hook name
        if self.path == "/health":
            self._write_json(200, {"status": "ok"})
            return
        self._write_json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802 - stdlib hook name
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 0:
            self.rfile.read(length)
        if self.path == "/transcribe":
            self._write_json(200, {"text": "녹음 후 변환 테스트입니다"})
            return
        self._write_json(404, {"error": "not_found"})

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8751)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), TranscribeStubHandler)
    print(f"NowNote transcribe stub listening on http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
