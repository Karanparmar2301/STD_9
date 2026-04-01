"""
retriever.py — Hybrid search: Vector (semantic) + Keyword (exact match).
Combines Qdrant vector search with payload keyword filtering for better accuracy.
Also supports multi-query expansion for unclear questions.
"""
import re
from .embeddings import embed_text, qdrant_client, COLLECTION_NAME


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


def vector_search(question: str, limit: int = 6) -> list[dict]:
    """Semantic vector search in Qdrant."""
    query_vector = embed_text(question)

    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=limit
    )

    documents = []
    for result in results.points:
        documents.append({
            "text": result.payload["text"],
            "source": result.payload["source"],
            "page": result.payload["page"],
            "score": result.score,
            "method": "vector"
        })
    return documents


def keyword_search(question: str, limit: int = 4) -> list[dict]:
    """
    Keyword-based search using Qdrant scroll + payload filtering.
    Searches for exact keyword matches in stored chunk text.
    """
    # Extract meaningful keywords (3+ chars, no stopwords)
    stopwords = {'the', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when',
                 'where', 'which', 'who', 'does', 'did', 'can', 'will', 'shall',
                 'and', 'but', 'for', 'with', 'from', 'this', 'that', 'about',
                 'explain', 'describe', 'tell', 'give', 'class'}
    words = re.findall(r'\b[a-zA-Z]{3,}\b', question.lower())
    keywords = [w for w in words if w not in stopwords]

    if not keywords:
        return []

    # Use Qdrant scroll with text matching for each keyword
    documents = []
    seen_texts = set()

    for kw in keywords[:3]:  # max 3 keywords
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchText
            results = qdrant_client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="text",
                            match=MatchText(text=kw)
                        )
                    ]
                ),
                limit=limit,
                with_payload=True,
                with_vectors=False,
            )

            for point in results[0]:  # scroll returns (points, next_offset)
                text_snippet = point.payload["text"][:200]
                if text_snippet not in seen_texts:
                    seen_texts.add(text_snippet)
                    documents.append({
                        "text": point.payload["text"],
                        "source": point.payload["source"],
                        "page": point.payload["page"],
                        "score": 0.5,  # no vector score for keyword matches
                        "method": "keyword"
                    })
        except Exception:
            continue

    return documents[:limit]


def hybrid_search(question: str, vector_k: int = 8, keyword_k: int = 5) -> list[dict]:
    """
    Combine vector search + keyword search results.
    De-duplicates by text content and merges scores.
    """
    # Multi-query expansion
    sub_queries = _generate_sub_queries(question)

    all_docs = []
    seen_texts = set()

    # Vector search across all sub-queries
    for sq in sub_queries:
        for doc in vector_search(sq, limit=vector_k):
            snippet = doc["text"][:200]
            if snippet not in seen_texts:
                seen_texts.add(snippet)
                all_docs.append(doc)

    # Keyword search on original question
    for doc in keyword_search(question, limit=keyword_k):
        snippet = doc["text"][:200]
        if snippet not in seen_texts:
            seen_texts.add(snippet)
            all_docs.append(doc)

    # Sort by score descending
    all_docs.sort(key=lambda d: d["score"], reverse=True)

    return all_docs[:10]  # return top 10 for reranking
