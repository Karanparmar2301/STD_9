import os
import logging
from .qdrant_client import get_qdrant_client, get_qdrant_client_error, COLLECTION_NAME
from .bm25 import bm25_service
from .embedding import get_query_embedding, get_embedding_load_error

from qdrant_client.http.models import Filter, FieldCondition, MatchValue

logger = logging.getLogger(__name__)

def perform_hybrid_search(query, subject=None, year_class=None, chapter=None, top_k=5):
    # Semantic Search (best-effort; do not fail whole request on vector issues)
    query_vector = None
    try:
        query_vector = get_query_embedding(query)
    except Exception as exc:
        logger.warning(
            "Embedding unavailable, falling back to BM25 only: %s (%s)",
            get_embedding_load_error() or str(exc),
            type(exc).__name__,
        )
    
    # Keyword Search
    bm25_results = bm25_service.search(query, top_k=top_k*2, subject=subject, year_class=year_class)
    if not bm25_results:
        # Retry with just standard bm25
        bm25_results = bm25_service.search(query, top_k=top_k*2)
        
    # Hybrid merging
    semantic_results = []
    
    # Filtering
    filters = []
    if subject:
        filters.append(FieldCondition(key="subject", match=MatchValue(value=subject)))
    if year_class:
        filters.append(FieldCondition(key="class", match=MatchValue(value=year_class)))
    if chapter:
        filters.append(FieldCondition(key="chapter", match=MatchValue(value=chapter)))
        
    query_filter = Filter(must=filters) if filters else None

    qdrant_points = []
    qdrant_client = get_qdrant_client()
    if query_vector is None:
        logger.warning("Skipping vector search because query embedding could not be created")
    elif qdrant_client is None:
        logger.warning("Qdrant unavailable, falling back to BM25 only: %s", get_qdrant_client_error())
    else:
        try:
            qdrant_results = qdrant_client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=top_k * 2,
                query_filter=query_filter
            )
            qdrant_points = qdrant_results.points or []
        except Exception as exc:
            logger.exception("Qdrant query failed, falling back to BM25 only: %s", exc)
    
    # Reranking based on 0.7 * semantic + 0.3 * keyword
    merged_results = {}
    
    # Store Qdrant results natively
    for res in qdrant_points:
        payload = res.payload or {}
        text = payload.get("text")
        if not text:
            continue
        merged_results[res.id] = {
            "text": text,
            "subject": payload.get("subject"),
            "class": payload.get("class"),
            "chapter": payload.get("chapter"),
            "semantic_score": res.score,
            "keyword_score": 0.0,
            "final_score": 0.0
        }
        
    # Store BM25 results natively
    for res in bm25_results:
        if res["id"] in merged_results:
            merged_results[res["id"]]["keyword_score"] = res["score"]
        else:
            merged_results[res["id"]] = {
                "text": res["text"],
                "subject": res["metadata"].get("subject"),
                "class": res["metadata"].get("class"),
                "chapter": res["metadata"].get("chapter"),
                "semantic_score": 0.0,
                "keyword_score": res["score"],
                "final_score": 0.0
            }
            
    # Calculate final scores
    for item in merged_results.values():
        # normalize BM25 score (heuristic approach since bm25 ranges can be open-ended)
        kw_score = item["keyword_score"] / 10 if item["keyword_score"] > 0 else 0
        sem_score = item["semantic_score"]
        item["final_score"] = (0.7 * sem_score) + (0.3 * kw_score)

    sorted_results = sorted(merged_results.values(), key=lambda x: x["final_score"], reverse=True)
    return sorted_results[:top_k]