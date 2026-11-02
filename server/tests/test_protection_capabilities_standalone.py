"""실행 gate와 기존 광고값의 일치만 DB 없이 검증한다."""
import unittest
from unittest.mock import patch

from app.core import capabilities


class ProtectionCapabilityTest(unittest.TestCase):
    def test_default_gate_stays_closed(self):
        self.assertIs(capabilities.MIXED_MUTATIONS_ENABLED, False)

    def test_advertisement_follows_execution_gate(self):
        keys = ("mixed_current_plain_v1", "mixed_full_conversion_v1", "mixed_note_write_v1",
                "mixed_offline_import_v1", "mixed_analysis_source_v1", "full_protection_complete")
        for enabled in (False, True):
            with self.subTest(enabled=enabled), patch.object(capabilities, "MIXED_MUTATIONS_ENABLED", enabled), patch.object(
                capabilities, "messenger_attachment_capabilities", return_value={}
            ):
                advertised = capabilities.server_capabilities()
                self.assertEqual(advertised["mixed_representation_schema"], 3)
                self.assertIs(advertised["mixed_representation_read_v1"], True)
                for key in keys:
                    self.assertIs(advertised[key], enabled, key)


if __name__ == "__main__":
    unittest.main()
