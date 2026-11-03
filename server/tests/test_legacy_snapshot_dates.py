"""구형 서버 UTC 날짜만 허용하며 일반 쓰기 검증은 유지한다."""
import pytest
from pydantic import ValidationError
from app.schemas.note_v2 import SnapshotNote, NoteValue

def snapshot():
    return dict(id=None, owner_id='synthetic', device_id='qa', local_id='qa-note', note_type='tree', title='synthetic', content='synthetic',
                parent_local_id=None,level=1,tags='[]',source='manual',deleted_at='2026-01-02T03:04:05.123456',
                client_updated_at='2026-01-02T03:04:05',created_at='2026-01-01T00:00:00Z',updated_at='2026-01-02T03:04:05Z')

def test_legacy_server_snapshot_dates_keep_the_same_utc_instant():
    value=SnapshotNote.model_validate(snapshot())
    assert value.client_updated_at=='2026-01-02T03:04:05.000000Z'
    assert value.deleted_at=='2026-01-02T03:04:05.123456Z'

@pytest.mark.parametrize('field',['created_at','updated_at'])
def test_nonlegacy_snapshot_fields_still_require_timezone(field):
    data=snapshot();data[field]='2026-01-02T03:04:05'
    with pytest.raises(ValidationError):SnapshotNote.model_validate(data)

@pytest.mark.parametrize('value',['2026-02-30T00:00:00','2026-01-01','not-a-date','2026-01-01T00:00:00+99:00',''])
def test_invalid_legacy_dates_are_not_repaired(value):
    data=snapshot();data['client_updated_at']=value
    with pytest.raises(ValidationError):SnapshotNote.model_validate(data)

def test_general_note_write_does_not_accept_timezone_free_deletion():
    with pytest.raises(ValidationError):
        NoteValue.model_validate(dict(note_type='tree',title='synthetic',content='synthetic',level=1,deleted_at='2026-01-02T03:04:05'))
