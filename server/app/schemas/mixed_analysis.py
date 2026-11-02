from typing import Literal

from pydantic import Field

from app.schemas.note_v2 import Strict
from app.schemas.note_mixed import Access, MixedBase, MixedDescriptor, UID, HEX
from app.schemas.protected_analysis import Claim as LegacyClaim
from app.schemas.protected_analysis import Bundle as LegacyBundle, Settle as LegacySettle
from app.schemas.protected_analysis import CipherRecord as LegacyCipherRecord


class SourceContext(Strict):
    server_instance_id: UID
    base: MixedBase
    catalog_digest: str = Field(pattern=HEX)


class SourceKey(Strict):
    descriptor: MixedDescriptor


class Claim(LegacyClaim):
    schema_version: Literal[3]
    mutation_id: UID
    server_instance_id: UID
    source_context: SourceContext
    source_keys: list[SourceKey] = Field(min_length=1)


class Execution(Access):
    execution_id: UID


class Action(Execution):
    run_version: int = Field(ge=1)
    lease_version: int = Field(ge=1)


class Dispatch(Action):
    source_digest: str = Field(pattern=HEX)
    claim_metadata_digest: str = Field(pattern=HEX)


class CipherRecord(LegacyCipherRecord):
    source_etag: UID


class Bundle(LegacyBundle):
    schema_version: Literal[3]
    ciphertext_manifest: list[CipherRecord]


class Settle(LegacySettle):
    schema_version: Literal[3]
    server_instance_id: UID
    execution_id: UID
    dispatch_id: UID
    claim_metadata_digest: str = Field(pattern=HEX)
    bundle_metadata: Bundle | None


class Source(Execution):
    source_digest: str = Field(pattern=HEX)
    kind: str
    representation_id: str
    slot: str
    source_etag: UID
    chunk_index: int = Field(ge=0)
