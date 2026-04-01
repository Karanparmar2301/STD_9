"""
reranker.py — Re-rank retrieved documents by relevance using a cross-encoder.
Uses BAAI/bge-reranker-large for accurate scoring.
Falls back to score-based sorting if model fails to load.
"""
from sentence_transformers import CrossEncoder

_reranker = None
_reranker_failed = False


def _get_reranker():
    global _reranker, _reranker_failed
    if _reranker_failed:
        return None
    if _reranker is None:
        try:
            _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")  # fast & effective
            print("[Reranker] cross-encoder/ms-marco-MiniLM-L-6-v2 loaded")
        except Exception as e:
            print(f"[Reranker] Failed to load: {e}. Falling back to score-based ranking.")
            _reranker_failed = True
            return None
    return _reranker


def rerank(question: str, documents: list[dict], top_k: int = 4) -> list[dict]:
    """
    Re-rank documents using the cross-encoder model.
    Returns the top_k most relevant documents sorted by relevance.
    """
    if not documents:
        return []

    model = _get_reranker()

    if model is None:
        # Fallback: return top_k by original score
        return sorted(documents, key=lambda d: d.get("score", 0), reverse=True)[:top_k]

    # Build (question, document_text) pairs for the cross-encoder
    pairs = [(question, doc["text"]) for doc in documents]
    scores = model.predict(pairs)

    # Attach reranker score and sort
    for doc, score in zip(documents, scores):
        doc["rerank_score"] = float(score)

    documents.sort(key=lambda d: d["rerank_score"], reverse=True)
    return documents[:top_k]
