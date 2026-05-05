import json
import urllib.error
import urllib.request

from app.core.config import get_settings


class LlmClientError(RuntimeError):
    pass


def is_llm_enabled() -> bool:
    settings = get_settings()
    return settings.llm_provider.lower() != "local"


def generate_text(prompt: str, *, max_tokens: int = 800) -> str:
    settings = get_settings()
    provider = settings.llm_provider.lower()
    if provider in {"openai", "openai_compatible"}:
        return _openai_chat_completion(prompt, max_tokens=max_tokens)
    raise LlmClientError(f"unsupported llm provider: {settings.llm_provider}")


def _openai_chat_completion(prompt: str, *, max_tokens: int) -> str:
    settings = get_settings()
    if not settings.openai_api_key:
        raise LlmClientError("NOW_OPENAI_API_KEY is required")

    base_url = settings.openai_base_url.rstrip("/")
    url = f"{base_url}/chat/completions"
    payload = {
        "model": settings.openai_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are NowNote's server-side analysis worker. "
                    "Return concise Korean JSON only. Do not include markdown."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise LlmClientError(f"LLM HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise LlmClientError(f"LLM network error: {exc}") from exc

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise LlmClientError(f"unexpected LLM response: {data}") from exc
