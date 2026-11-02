"""브라우저 확인창 금지와 내부 사본 확인 메서드를 구분한다."""
import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "preflight.py"
spec = importlib.util.spec_from_file_location("nownote_preflight", SCRIPT)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class ConfirmPreflightTest(unittest.TestCase):
    def test_native_calls_are_rejected(self):
        for source in ("confirm('x');", "if (confirm(value)) {}", "confirm (value);", "confirm(value)\n{ after(); }",
                       "window.confirm(value);", "globalThis.confirm(value);",
                       "self.confirm(value);", "window['confirm'](value);",
                       'globalThis["confirm"] (value);', "window?.confirm(value);"):
            with self.subTest(source=source):
                self.assertTrue(preflight.has_native_browser_confirm(source))

    def test_internal_member_calls_and_methods_are_allowed(self):
        for source in ("await client.confirm(scope, copies, ids);",
                       "await api.\n confirm(scope);", "async confirm(scope, list, selected) { return true; }",
                       "confirm(value) { return this.check(value); }", "confirmCopies(value);"):
            with self.subTest(source=source):
                self.assertFalse(preflight.has_native_browser_confirm(source))

    def test_current_bundle_uses_internal_confirmation_only(self):
        source = (SCRIPT.parents[2] / "web" / "app.js").read_text(encoding="utf-8")
        self.assertFalse(preflight.has_native_browser_confirm(source))


if __name__ == "__main__":
    unittest.main()
