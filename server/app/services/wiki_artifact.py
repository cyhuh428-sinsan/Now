"""Pure append-only wiki document checks; no DB or external requests."""
from app.schemas.wiki import WikiArtifact


def validate_append(previous: WikiArtifact | None, value: WikiArtifact, action: str):
    if previous is None:
        if (action != "create" or len(value.drafts) != 1 or value.approvals or value.rejected_draft_ids
                or value.drafts[0].base_approved_revision_id is not None):
            raise ValueError("wiki_invalid_creation")
        return
    if previous.wiki_id != value.wiki_id or previous.scope != value.scope:
        raise ValueError("wiki_identity_changed")
    for field in ("drafts", "approvals", "rejected_draft_ids"):
        before, after = getattr(previous, field), getattr(value, field)
        if after[:len(before)] != before:
            raise ValueError("wiki_history_rewrite")
    delta = tuple(len(getattr(value, field)) - len(getattr(previous, field))
                  for field in ("drafts", "approvals", "rejected_draft_ids"))
    if delta != {"draft": (1, 0, 0), "approve": (0, 1, 0), "reject": (0, 0, 1)}.get(action):
        raise ValueError("wiki_invalid_append")
    if action == "draft":
        base = previous.approvals[-1].id if previous.approvals else None
        if value.drafts[-1].base_approved_revision_id != base:
            raise ValueError("wiki_stale_draft_base")
