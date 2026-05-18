API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "planned"

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
    "max_tree_note_level": 3,
    "supported_note_types": ["daily", "tree", "record"],
}


def server_capabilities() -> dict:
    capabilities = dict(SERVER_CAPABILITIES)
    capabilities["supported_note_types"] = list(SERVER_CAPABILITIES["supported_note_types"])
    return capabilities
