from fastapi import Header, HTTPException, status

from app.core.config import get_settings


def require_api_token(
    authorization: str | None = Header(default=None),
    x_now_token: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    expected = settings.api_token
    if not expected:
        return

    bearer_prefix = "Bearer "
    supplied = x_now_token
    if authorization and authorization.startswith(bearer_prefix):
        supplied = authorization[len(bearer_prefix) :]

    if supplied != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid api token",
        )
