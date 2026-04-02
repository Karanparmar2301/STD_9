"""
retriever.py — Hybrid search: Vector (semantic) + Keyword (exact match).
Combines Qdrant vector search with payload keyword filtering for better accuracy.
Also supports multi-query expansion for unclear questions.
"""
import re
from typing import Any, cast
from .embeddings import embed_text, qdrant_client, COLLECTION_NAME


_SUBJECT_SOURCE_HINTS = {
    "math": ["math", "maths", "mathematics"],
    "science": ["science"],
    "english": ["english"],
    "hindi": ["hindi"],
    "social": ["social", "social science", "sst"],
    "sanskrit": ["sanskrit"],
    "arts": ["arts", "fine art", "fine arts"],
    "physed": ["physical education", "pt", "physed"],
    "voced": ["vocational", "vocational education", "voc. education", "voced"],
}

_subject_filter_server_supported: bool | None = None


def _mark_subject_filter_unsupported() -> None:
    global _subject_filter_server_supported
    _subject_filter_server_supported = False


def _subject_payload_has_values(sample_size: int = 128) -> bool:
    try:
        points, _ = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=sample_size,
            with_payload=["subject"],
            with_vectors=False,
        )
    except Exception:
        return False

    for point in points:
        raw_payload = getattr(point, "payload", None)
        payload = cast(dict[str, Any], raw_payload) if isinstance(raw_payload, dict) else {}
        value = payload.get("subject")
        if isinstance(value, str) and value.strip():
            return True
    return False


def _can_use_server_subject_filter() -> bool:
    """
    Use server-side subject filtering only when payload index exists.
    Avoids repeated 400 errors on strict Qdrant collections.
    """
    global _subject_filter_server_supported

    if _subject_filter_server_supported is not None:
        return _subject_filter_server_supported

    try:
        info = qdrant_client.get_collection(COLLECTION_NAME)
        raw_schema = getattr(info, "payload_schema", None)
        payload_schema = cast(dict[str, Any], raw_schema) if isinstance(raw_schema, dict) else {}
        has_subject_schema = "subject" in payload_schema
        _subject_filter_server_supported = has_subject_schema and _subject_payload_has_values()
    except Exception:
        _subject_filter_server_supported = False

    return _subject_filter_server_supported


def _normalize_subject_filter(subject_filter: str) -> list[str]:
    """
    Convert subject slug/name (e.g. Std_8_math, Mathematics) into source-match tokens.
    Returned tokens are used against payload['source'] filenames.
    """
    raw = (subject_filter or "").strip().lower()
    if not raw:
        return []

    cleaned = raw.replace("std_8_", "").replace("_", " ").replace("-", " ").strip()
    if not cleaned:
        return []

    tokens = {cleaned}
    tokens.update(part for part in cleaned.split() if len(part) > 2)

    for hints in _SUBJECT_SOURCE_HINTS.values():
        if any(h in cleaned for h in hints):
            tokens.update(hints)

    return sorted(tokens, key=len, reverse=True)


def _detect_subject_key(subject_filter: str) -> str:
    raw = (subject_filter or "").strip().lower()
    if not raw:
        return ""

    cleaned = raw.replace("std_8_", "").replace("_", " ").replace("-", " ").strip()
    for key, hints in _SUBJECT_SOURCE_HINTS.items():
        if any(h in cleaned for h in hints):
            return key
    return ""


def _matches_subject_filter(source: str, subject_tokens: list[str], subject_key: str = "") -> bool:
    if not subject_tokens and not subject_key:
        return True

    source_l = (source or "").lower()

    # Resolve ambiguous naming collisions first.
    if subject_key == "science":
        return ("science" in source_l) and ("social science" not in source_l)
    if subject_key == "social":
        return "social science" in source_l or "social" in source_l
    if subject_key == "math":
        return "math" in source_l
    if subject_key == "arts":
        return "arts" in source_l or "fine art" in source_l
    if subject_key == "physed":
        return "physical education" in source_l or "pt" in source_l
    if subject_key == "voced":
        return "vocational" in source_l or "voc. education" in source_l
    if subject_key == "english":
        return "english" in source_l
    if subject_key == "hindi":
        return "hindi" in source_l
    if subject_key == "sanskrit":
        return "sanskrit" in source_l

    return any(token in source_l for token in subject_tokens)


def _keyword_relevance_score(text: str, keywords: list[str]) -> float:
    """Score lexical relevance in a bounded range [0.15, 0.45]."""
    if not keywords:
        return 0.0

    text_l = (text or "").lower()
    matched = 0
    occurrences = 0

    for kw in keywords:
        if re.search(rf"\b{re.escape(kw)}\b", text_l):
            matched += 1
            occurrences += text_l.count(kw)

    if matched == 0:
        return 0.0

    coverage = matched / len(keywords)
    density = min(occurrences, 6) / 6
    return round(0.15 + (coverage * 0.2) + (density * 0.1), 4)


def _generate_sub_queries(question: str) -> list[str]:
    """
    Generate 2–3 alternative search queries from the student's question.
    Uses simple rule-based expansion (no extra LLM call needed).
    """
    q = question.strip()
    queries = [q]

    # Remove question marks and common filler words for a cleaner search query
    cleaned = re.sub(r'[?!.]', '', q).strip()
    cleaned = re.sub(r'\b(what is|what are|explain|describe|tell me about|how does|why does)\b',
                     '', cleaned, flags=re.IGNORECASE).strip()

    if cleaned and cleaned.lower() != q.lower():
        queries.append(cleaned)

    # Add "definition of X" variant for short queries
    words = cleaned.split()
    if 1 <= len(words) <= 4:
        queries.append(f"definition of {cleaned}")
        queries.append(f"{cleaned} class 8")

    return queries[:4]  # max 4 sub-queries


def vector_search(
    question: str,
    limit: int = 6,
    subject_filter: str = "",
) -> list[dict[str, Any]]:
    """Semantic vector search in Qdrant."""
    query_vector = embed_text(question)
    subject_tokens = _normalize_subject_filter(subject_filter)
    subject_key = _detect_subject_key(subject_filter)
    query_limit = max(limit * 4, limit) if subject_tokens else limit

    query_filter = None
    if subject_key and _can_use_server_subject_filter():
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="subject",
                        match=MatchValue(value=subject_key)
                    )
                ]
            )
        except Exception:
            query_filter = None

    if query_filter is not None:
        try:
            results = qdrant_client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=query_filter,
                limit=query_limit
            )

            # Some legacy points may miss subject payload; recover with local filtering.
            if not getattr(results, "points", None):
                results = qdrant_client.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_vector,
                    limit=query_limit
                )
        except Exception as exc:
            # Strict Qdrant collections reject unindexed payload filters.
            msg = str(exc).lower()
            if "index required" in msg and "subject" in msg:
                _mark_subject_filter_unsupported()

            results = qdrant_client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=query_limit
            )
    else:
        results = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=query_limit
        )

    documents: list[dict[str, Any]] = []
    for result in results.points:
        payload = result.payload or {}
        text = str(payload.get("text", ""))
        source = str(payload.get("source", ""))
        page = int(payload.get("page", 0) or 0)

        if not text or not source:
            continue

        if not _matches_subject_filter(source, subject_tokens, subject_key):
            continue

        documents.append({
            "text": text,
            "source": source,
            "page": page,
            "score": float(result.score),
            "method": "vector"
        })

        if len(documents) >= limit:
            break

    return documents


def keyword_search(
    question: str,
    limit: int = 4,
    subject_filter: str = "",
) -> list[dict[str, Any]]:
    """
    Keyword-style relevance over semantic candidates.
    This avoids fragile Qdrant scroll text-match calls on hosted instances.
    """
    # Extract meaningful keywords (3+ chars, no stopwords)
    stopwords = {'the', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when',
                 'where', 'which', 'who', 'does', 'did', 'can', 'will', 'shall',
                 'and', 'but', 'for', 'with', 'from', 'this', 'that', 'about',
                 'explain', 'describe', 'tell', 'give', 'class', 'book', 'books',
                 'chapter', 'chapters', 'name', 'full', 'information', 'all',
                 'total', 'answer', 'question', 'fig', 'figure', 'page'}
    words = re.findall(r'\b[a-zA-Z]{3,}\b', question.lower())
    keywords = [w for w in words if w not in stopwords]

    if not keywords:
        return []

    # Pull a wider semantic candidate set and score lexical relevance locally.
    candidates = vector_search(
        question,
        limit=max(limit * 6, 24),
        subject_filter=subject_filter,
    )

    rescored: list[dict[str, Any]] = []
    seen_texts: set[str] = set()

    for doc in candidates:
        text = str(doc.get("text", ""))
        source = str(doc.get("source", ""))
        page = int(doc.get("page", 0) or 0)
        if not text or not source:
            continue

        text_snippet = text[:220]
        if text_snippet in seen_texts:
            continue

        lexical_score = _keyword_relevance_score(text, keywords)
        if lexical_score <= 0:
            continue

        seen_texts.add(text_snippet)
        rescored.append({
            "text": text,
            "source": source,
            "page": page,
            "score": lexical_score,
            "method": "keyword",
        })

    rescored.sort(key=lambda d: d["score"], reverse=True)
    return rescored[:limit]


def hybrid_search(
    question: str,
    vector_k: int = 8,
    keyword_k: int = 5,
    subject_filter: str = "",
) -> list[dict[str, Any]]:
    """
    Combine vector search + keyword search results.
    De-duplicates by text content and merges scores.
    """
    # Multi-query expansion
    sub_queries = _generate_sub_queries(question)

    all_docs: list[dict[str, Any]] = []
    seen_texts: dict[str, int] = {}

    def _doc_key(text: str) -> str:
        return re.sub(r"\s+", " ", (text or "")[:260]).strip().lower()

    # Vector search across all sub-queries
    for sq in sub_queries:
        for doc in vector_search(sq, limit=vector_k, subject_filter=subject_filter):
            key = _doc_key(str(doc.get("text", "")))
            idx = seen_texts.get(key)
            if idx is None:
                seen_texts[key] = len(all_docs)
                all_docs.append(doc)
                continue

            doc_score = float(doc.get("score", 0) or 0)
            prev_score = float(all_docs[idx].get("score", 0) or 0)
            if doc_score > prev_score:
                all_docs[idx]["score"] = doc_score

            prev_method = str(all_docs[idx].get("method", ""))
            if "vector" not in prev_method:
                all_docs[idx]["method"] = f"{prev_method}+vector".strip("+")

    # Keyword search on original question
    for doc in keyword_search(question, limit=keyword_k, subject_filter=subject_filter):
        key = _doc_key(str(doc.get("text", "")))
        idx = seen_texts.get(key)
        if idx is None:
            seen_texts[key] = len(all_docs)
            all_docs.append(doc)
            continue

        doc_score = float(doc.get("score", 0) or 0)
        prev_score = float(all_docs[idx].get("score", 0) or 0)
        if doc_score > prev_score:
            all_docs[idx]["score"] = doc_score

        prev_method = str(all_docs[idx].get("method", ""))
        if "keyword" not in prev_method:
            all_docs[idx]["method"] = f"{prev_method}+keyword".strip("+")

    # Sort by score descending
    all_docs.sort(key=lambda d: d["score"], reverse=True)

    return all_docs[:10]  # return top 10 for reranking
