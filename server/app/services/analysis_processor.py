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
    if job.job_type in {
        "knowledge_2_0_review",
        "embedding_index",
        "similar_notes",
        "duplicate_candidates",
        "relation_suggestions",
        "tag_property_suggestions",
        "knowledge_health",
    }:
        return _knowledge_review(text, job.job_type)
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
    elif job.job_type in {
        "knowledge_2_0_review",
        "embedding_index",
        "similar_notes",
        "duplicate_candidates",
        "relation_suggestions",
        "tag_property_suggestions",
        "knowledge_health",
    }:
        schema = """
{
  "summary": "전체 지식 구조 진단 요약",
  "progress_percent": 100,
  "approval_required": true,
  "apply_mode": "user_approval",
  "logs": ["처리 단계"],
  "similar_notes": [{"source": "메모 ID", "target": "메모 ID", "reason": "유사 이유"}],
  "duplicate_candidates": [{"source": "메모 ID", "target": "메모 ID", "reason": "중복 후보 이유"}],
  "relation_candidates": [{"source": "메모 ID", "target": "메모 ID", "link": "[[제목]]", "reason": "연결 이유"}],
  "tag_property_suggestions": [{"noteLocalId": "메모 ID", "tags": ["태그"], "properties": {"status": "검토"}}],
  "suggestions": [{"type": "relation", "noteLocalId": "메모 ID", "title": "제안 제목", "preview": "검토할 내용"}]
}
"""
        instruction = "NowNote 지식 메모 묶음을 분석해 유사/중복/관계/태그/속성/지식 건강 제안을 만들고, 자동 반영 없이 승인 대기 결과로 정리하세요."
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


def _knowledge_review(text: str, job_type: str) -> str:
    notes = _parse_knowledge_notes(text)
    all_text = "\n".join(f"{note['title']}\n{note['content']}" for note in notes)
    keywords = _keywords(all_text, limit=16)
    by_keyword = _notes_by_keyword(notes, keywords[:8])
    relation_candidates = _relation_candidates(notes)
    similar_notes = _similar_note_candidates(notes, by_keyword)
    duplicate_candidates = _duplicate_candidates(notes)
    tag_property_suggestions = _tag_property_suggestions(notes, keywords)
    suggestions = _knowledge_suggestions(
        relation_candidates,
        similar_notes,
        duplicate_candidates,
        tag_property_suggestions,
    )
    health = {
        "note_count": len(notes),
        "isolated_note_count": sum(1 for note in notes if "[[" not in note["content"]),
        "duplicate_candidate_count": len(duplicate_candidates),
        "relation_candidate_count": len(relation_candidates),
        "tag_property_candidate_count": len(tag_property_suggestions),
    }
    return json.dumps(
        {
            "version": "2.0",
            "job_type": job_type,
            "summary": f"지식 메모 {len(notes)}개를 점검했습니다. 관계 후보 {len(relation_candidates)}개, 유사 후보 {len(similar_notes)}개, 중복 후보 {len(duplicate_candidates)}개를 검토하세요.",
            "progress_percent": 100,
            "approval_required": True,
            "apply_mode": "user_approval",
            "logs": [
                "입력 메모 목록 파싱",
                "키워드 기반 임베딩 대체 색인 생성",
                "유사/중복/관계/태그 후보 산출",
                "사용자 승인 대기 결과 생성",
            ],
            "embedding_index": [
                {"keyword": keyword, "noteLocalIds": [note["id"] for note in items]}
                for keyword, items in by_keyword.items()
            ],
            "similar_notes": similar_notes,
            "duplicate_candidates": duplicate_candidates,
            "relation_candidates": relation_candidates,
            "tag_property_suggestions": tag_property_suggestions,
            "knowledge_health": health,
            "suggestions": suggestions,
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


def _parse_knowledge_notes(text: str) -> list[dict[str, str]]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = None
    if isinstance(parsed, dict) and isinstance(parsed.get("notes"), list):
        notes = parsed["notes"]
        normalized = []
        for index, note in enumerate(notes):
            if not isinstance(note, dict):
                continue
            normalized.append(
                {
                    "id": str(note.get("id") or f"note-{index + 1}"),
                    "title": str(note.get("title") or "제목 없음").strip(),
                    "content": str(note.get("content") or "").strip(),
                    "tags": str(note.get("tags") or "").strip(),
                }
            )
        return normalized
    return [{"id": "input", "title": "입력 메모", "content": text.strip(), "tags": ""}]


def _notes_by_keyword(notes: list[dict[str, str]], keywords: list[str]) -> dict[str, list[dict[str, str]]]:
    buckets: dict[str, list[dict[str, str]]] = {}
    for keyword in keywords:
        matched = [
            note
            for note in notes
            if keyword and keyword in f"{note['title']} {note['content']} {note['tags']}".lower()
        ]
        if matched:
            buckets[keyword] = matched[:12]
    return buckets


def _relation_candidates(notes: list[dict[str, str]]) -> list[dict[str, str]]:
    candidates = []
    for source in notes:
        source_text = source["content"]
        for target in notes:
            if source["id"] == target["id"] or not target["title"]:
                continue
            link = f"[[{target['title']}]]"
            if target["title"] in source_text and link not in source_text:
                candidates.append(
                    {
                        "source": source["id"],
                        "target": target["id"],
                        "link": link,
                        "reason": "본문에 제목이 언급됐지만 내부 링크가 없습니다.",
                    }
                )
    return candidates[:20]


def _similar_note_candidates(
    notes: list[dict[str, str]],
    by_keyword: dict[str, list[dict[str, str]]],
) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    candidates = []
    for keyword, items in by_keyword.items():
        if len(items) < 2:
            continue
        for index, source in enumerate(items[:-1]):
            target = items[index + 1]
            pair = tuple(sorted((source["id"], target["id"])))
            if pair in seen:
                continue
            seen.add(pair)
            candidates.append(
                {
                    "source": source["id"],
                    "target": target["id"],
                    "reason": f"'{keyword}' 키워드가 함께 반복됩니다.",
                }
            )
    return candidates[:20]


def _duplicate_candidates(notes: list[dict[str, str]]) -> list[dict[str, str]]:
    candidates = []
    for index, source in enumerate(notes[:-1]):
        source_title = source["title"].strip().lower()
        source_content = source["content"].strip().lower()
        for target in notes[index + 1 :]:
            target_title = target["title"].strip().lower()
            target_content = target["content"].strip().lower()
            if source_title and source_title == target_title:
                reason = "제목이 같습니다."
            elif source_content and target_content and source_content[:120] == target_content[:120]:
                reason = "본문 앞부분이 거의 같습니다."
            else:
                continue
            candidates.append({"source": source["id"], "target": target["id"], "reason": reason})
    return candidates[:20]


def _tag_property_suggestions(
    notes: list[dict[str, str]],
    keywords: list[str],
) -> list[dict[str, object]]:
    suggestions = []
    fallback_tags = [keyword for keyword in keywords if len(keyword) <= 20][:3]
    for note in notes[:20]:
        note_keywords = _keywords(f"{note['title']} {note['content']}", limit=3) or fallback_tags
        suggestions.append(
            {
                "noteLocalId": note["id"],
                "tags": note_keywords[:3],
                "properties": {"status": "검토", "type": "지식"},
                "reason": "반복 키워드 기준 태그/속성 후보입니다.",
            }
        )
    return suggestions


def _knowledge_suggestions(
    relation_candidates: list[dict[str, str]],
    similar_notes: list[dict[str, str]],
    duplicate_candidates: list[dict[str, str]],
    tag_property_suggestions: list[dict[str, object]],
) -> list[dict[str, object]]:
    suggestions: list[dict[str, object]] = []
    for item in relation_candidates[:5]:
        suggestions.append(
            {
                "type": "relation",
                "noteLocalId": item["source"],
                "title": "관계 링크 후보",
                "preview": f"{item['link']} 연결을 검토하세요. {item['reason']}",
            }
        )
    for item in similar_notes[:5]:
        suggestions.append(
            {
                "type": "similar",
                "noteLocalId": item["source"],
                "title": "유사 메모 후보",
                "preview": f"{item['target']} 메모와 유사합니다. {item['reason']}",
            }
        )
    for item in duplicate_candidates[:5]:
        suggestions.append(
            {
                "type": "duplicate",
                "noteLocalId": item["source"],
                "title": "중복 메모 후보",
                "preview": f"{item['target']} 메모와 중복 가능성이 있습니다. {item['reason']}",
            }
        )
    for item in tag_property_suggestions[:5]:
        suggestions.append(
            {
                "type": "tag_property",
                "noteLocalId": item["noteLocalId"],
                "title": "태그/속성 후보",
                "preview": f"태그 {', '.join(item['tags'])} 적용을 검토하세요.",
            }
        )
    return suggestions[:20]
