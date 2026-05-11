import json
from collections import Counter

from app.models.note import AnalysisJob
from app.services.llm_client import generate_text, is_llm_enabled


def process_analysis_job(job: AnalysisJob) -> str:
    if is_llm_enabled():
        return _process_with_llm(job)

    text = (job.input_text or "").strip()
    if job.job_type == "memo_summary":
        return _memo_summary(text)
    if job.job_type == "daily_briefing":
        return _daily_briefing(text)
    if job.job_type == "tree_note_index":
        return _tree_note_index(text)
    if job.job_type == "recording_summary":
        return _recording_summary(text)
    raise ValueError(f"unsupported job type: {job.job_type}")


def _process_with_llm(job: AnalysisJob) -> str:
    prompt = _build_llm_prompt(job)
    result = generate_text(prompt, max_tokens=900)
    parsed = _extract_json(result)
    if parsed is not None:
        parsed["source"] = "llm_worker"
        return json.dumps(parsed, ensure_ascii=False)
    return json.dumps(
        {
            "result": result.strip(),
            "source": "llm_worker",
        },
        ensure_ascii=False,
    )


def _build_llm_prompt(job: AnalysisJob) -> str:
    text = (job.input_text or "").strip()
    if job.job_type == "memo_summary":
        schema = """
{
  "summary": "메모 핵심 요약 1~3문장",
  "keywords": ["키워드1", "키워드2"],
  "todos": ["필요 시 할 일"]
}
"""
        instruction = "개인 메모를 분석해 핵심 요약, 키워드, 할 일을 추출하세요."
    elif job.job_type == "daily_briefing":
        schema = """
{
  "mustDo": ["오늘 꼭 확인할 것"],
  "tasks": ["오늘 할 일"],
  "advice": "오늘의 조언 1~3문장",
  "adviceBasis": "근거 한 줄"
}
"""
        instruction = "하루의 일정, 메모, 할 일을 교차 분석해 오늘 브리핑을 만드세요."
    elif job.job_type == "tree_note_index":
        schema = """
{
  "index_terms": ["검색 색인어"],
  "summary": "지식 메모 요약",
  "related_questions": ["관련해서 이어서 검토할 질문"]
}
"""
        instruction = "계층형 지식 메모를 검색과 재사용이 쉬운 색인 정보로 정리하세요."
    elif job.job_type == "recording_summary":
        schema = """
{
  "summary": "녹음/대화 핵심 요약",
  "decisions": ["결정 사항"],
  "actions": ["후속 조치"],
  "keywords": ["키워드"]
}
"""
        instruction = "녹음 전사 내용을 분석해 요약, 결정, 후속 조치, 키워드를 정리하세요."
    else:
        raise ValueError(f"unsupported job type: {job.job_type}")

    return f"""
[작업 타입]
{job.job_type}

[지시]
{instruction}

[출력 규칙]
- 반드시 한국어 JSON만 반환하세요.
- 마크다운 코드블록을 쓰지 마세요.
- 근거 없는 내용을 만들지 마세요.
- 정보가 없으면 빈 배열 또는 빈 문자열을 사용하세요.

[JSON 형식]
{schema}

[입력]
{text}
""".strip()


def _extract_json(text: str) -> dict | None:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:].strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        parsed = json.loads(stripped[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _memo_summary(text: str) -> str:
    sentences = _split_sentences(text)
    summary = sentences[:3] if sentences else []
    keywords = _keywords(text)
    return json.dumps(
        {
            "summary": "\n".join(summary) if summary else text[:300],
            "keywords": keywords,
            "source": "local_worker",
        },
        ensure_ascii=False,
    )


def _daily_briefing(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return json.dumps(
        {
            "mustDo": lines[:3],
            "tasks": lines[3:8],
            "advice": "기록이 충분하지 않으면 오늘 메모부터 남기는 것이 좋습니다.",
            "adviceBasis": f"입력 라인 {len(lines)}개 기준",
            "source": "local_worker",
        },
        ensure_ascii=False,
    )


def _tree_note_index(text: str) -> str:
    keywords = _keywords(text, limit=12)
    sentences = _split_sentences(text)
    return json.dumps(
        {
            "index_terms": keywords,
            "search_text": " ".join(keywords),
            "summary": "\n".join(sentences[:3]) if sentences else text[:300],
            "related_questions": _related_questions(keywords),
            "source": "local_worker",
        },
        ensure_ascii=False,
    )


def _recording_summary(text: str) -> str:
    sentences = _split_sentences(text)
    return json.dumps(
        {
            "summary": "\n".join(sentences[:5]) if sentences else text[:500],
            "segment_count": len(sentences),
            "source": "local_worker",
        },
        ensure_ascii=False,
    )


def _split_sentences(text: str) -> list[str]:
    normalized = text.replace("\r", "\n")
    chunks: list[str] = []
    for line in normalized.splitlines():
        line = line.strip()
        if not line:
            continue
        pieces = line.replace("?", ".").replace("!", ".").split(".")
        chunks.extend(piece.strip() for piece in pieces if piece.strip())
    return chunks


def _keywords(text: str, limit: int = 8) -> list[str]:
    stopwords = {
        "그리고",
        "하지만",
        "그래서",
        "오늘",
        "내일",
        "메모",
        "내용",
        "것",
        "수",
        "있다",
        "없다",
    }
    words = [
        token.strip(".,!?()[]{}:;\"'`").lower()
        for token in text.replace("\n", " ").split()
    ]
    candidates = [
        word
        for word in words
        if len(word) >= 2 and word not in stopwords and not word.isdigit()
    ]
    counts = Counter(candidates)
    return [word for word, _ in counts.most_common(limit)]


def _related_questions(keywords: list[str]) -> list[str]:
    return [f"{keyword}와 관련해 더 확인할 내용은 무엇인가요?" for keyword in keywords[:3]]
