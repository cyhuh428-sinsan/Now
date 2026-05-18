API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "planned"
MAX_TREE_NOTE_LEVEL = 3
SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]

SERVER_CAPABILITIES = {
    "sync": True,
    "recordings": True,
    "analysis_jobs": True,
    "admin_ops": True,
    "backup_export": True,
    "backup_verify": True,
    "user_accounts": True,
    "user_profile": True,
    "user_timezone": True,
    "two_factor_status": True,
    "two_factor_auth": TWO_FACTOR_AUTH_STATUS,
    "user_groups": True,
    "user_access_tokens": True,
    "max_tree_note_level": MAX_TREE_NOTE_LEVEL,
    "supported_note_types": SUPPORTED_NOTE_TYPES,
}


def server_capabilities() -> dict:
    capabilities = dict(SERVER_CAPABILITIES)
    capabilities["supported_note_types"] = list(SERVER_CAPABILITIES["supported_note_types"])
    return capabilities
