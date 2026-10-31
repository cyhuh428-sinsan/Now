"""Legacy recovery metadata uses existing auth and never returns raw results."""
import json

import pytest

from .test_note_crypto import subject, query
from .test_protected_analysis import PA, started, make_bundle, settle_body


@pytest.mark.parametrize("outcome", [None, "done", "failed"])
def test_legacy_recovery_metadata_exact_and_read_only(client, subject, outcome):
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from app.services.user_accounts import issue_user_device_access_token

    s, local = subject, "legacy-recovery-metadata"
    request, execution = started(client, s, local)
    bundle, raws = (None, {}) if outcome is None else make_bundle(execution, outcome=outcome)
    if bundle is not None:
        result = client.post(PA + "/claims/settle", json=settle_body(s, local, execution, bundle), headers=s["headers"])
        assert result.status_code == 200, result.text
    params = {**query(s, local), "server_instance_id": request["server_instance_id"], "execution_id": execution["execution_id"]}
    s["db"].expire_all()
    row = s["db"].get(ProtectedAnalysisClaim, execution["execution_id"])
    before = row.conditions_json, row.progress_json, row.run_version, row.lease_version
    response = client.get(PA + "/claims/status", params=params, headers=s["headers"])
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    assert payload["original_request_metadata"] == request
    assert payload["bundle_metadata"] == bundle
    assert "original input" not in response.text
    assert "raw  result" not in response.text
    assert all(raw.decode() not in response.text for raw in raws.values())
    s["db"].expire_all()
    row = s["db"].get(ProtectedAnalysisClaim, execution["execution_id"])
    assert before == (row.conditions_json, row.progress_json, row.run_version, row.lease_version)
    wrong_owner = client.get(PA + "/claims/status", params={**params, "owner_id": s["other"]}, headers=s["headers"])
    assert wrong_owner.status_code == 401
    _, token = issue_user_device_access_token(s["db"], owner_id=s["owner"], device_id="legacy-reader-peer", display_name="synthetic")
    s["db"].commit()
    peer_headers = {"X-Now-User-Token": token}
    peer_params = {**params, "device_id": "legacy-reader-peer"}
    peer = client.get(PA + "/claims/status", params=peer_params, headers=peer_headers)
    assert peer.status_code == 200, peer.text
    assert peer.json()["original_request_metadata"] == request
    action = {"schema_version": 1, **peer_params, "run_version": payload["run_version"], "lease_version": payload["lease_version"]}
    denied = client.post(PA + "/claims/renew", json=action, headers=peer_headers)
    assert denied.status_code == 403
    from app.models.note import UserDevice
    from sqlalchemy import select
    device = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "legacy-reader-peer"))
    device.is_active = False
    s["db"].commit()
    inactive = client.get(PA + "/claims/status", params=peer_params, headers=peer_headers)
    assert inactive.status_code == 403
    if bundle is not None:
        row = s["db"].get(ProtectedAnalysisClaim, execution["execution_id"])
        progress = json.loads(row.progress_json)
        progress["terminal_bundle"]["source_digest"] = "0" * 64
        row.progress_json = json.dumps(progress)
        s["db"].commit()
        assert client.get(PA + "/claims/status", params=params, headers=s["headers"]).status_code == 409


def test_legacy_recovery_metadata_rejects_bundle_without_terminal(client, subject):
    from app.models.protected_analysis import ProtectedAnalysisClaim

    s, local = subject, "legacy-recovery-inconsistent-pending"
    request, execution = started(client, s, local)
    bundle, _ = make_bundle(execution)
    row = s["db"].get(ProtectedAnalysisClaim, execution["execution_id"])
    progress = json.loads(row.progress_json)
    progress["terminal_bundle"] = bundle
    row.progress_json = json.dumps(progress)
    s["db"].commit()
    params = {**query(s, local), "server_instance_id": request["server_instance_id"], "execution_id": execution["execution_id"]}
    response = client.get(PA + "/claims/status", params=params, headers=s["headers"])
    assert response.status_code == 409
