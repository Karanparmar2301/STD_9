"""
rag_pipeline.py — Production RAG Pipeline
Features:
  ✔ Source citations
  ✔ Anti-hallucination guard
  ✔ Multi-query retrieval
  ✔ Hybrid search (vector + keyword)
  ✔ Re-ranking
  ✔ Multilingual support (Hindi, Gujarati, English)
  ✔ Chat memory support
  ✔ Logging
"""
import os
import re
import time
from datetime import datetime
from dotenv import load_dotenv
from groq import Groq

from .retriever import hybrid_search
from .reranker import rerank
from .translator import detect_language, translate_to_english, translate_from_english

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
load_dotenv()

_groq = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Chat memory store (per-student, last N exchanges) ────────────────────────
_chat_memory: dict[str, list[dict]] = {}
_MAX_MEMORY = 6  # keep last 6 messages (3 exchanges)

_SUBJECT_HINTS = {
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


def _get_memory(student_id: str) -> list[dict]:
    return _chat_memory.get(student_id, [])


def _add_to_memory(student_id: str, role: str, content: str):
    if student_id not in _chat_memory:
        _chat_memory[student_id] = []
    _chat_memory[student_id].append({"role": role, "content": content})
    # Trim to last N messages
    _chat_memory[student_id] = _chat_memory[student_id][-_MAX_MEMORY:]


def _resolve_subject_filter(question: str, subject_filter: str) -> str:
    """Prefer explicit subject filter; otherwise infer from question keywords."""
    explicit = (subject_filter or "").strip()
    if explicit and explicit.lower() not in {"all", "any", "general"}:
        return explicit

    q = (question or "").lower()
    for key, hints in _SUBJECT_HINTS.items():
        for hint in hints:
            if re.search(rf"\b{re.escape(hint)}\b", q):
                return key
    return ""


def _low_relevance_context(docs: list[dict]) -> bool:
    """
    Reject contexts that are likely irrelevant.
    Uses vector similarity as primary guard; reranker score as secondary signal.
    """
    if not docs:
        return True

    vector_scores = [
        float(d.get("score", 0.0))
        for d in docs
        if "vector" in str(d.get("method", ""))
    ]
    best_vector = max(vector_scores) if vector_scores else 0.0

    rerank_scores = [
        float(d.get("rerank_score"))
        for d in docs
        if d.get("rerank_score") is not None
    ]

    if rerank_scores:
        best_rerank = max(rerank_scores)
        return best_vector < 0.33 and best_rerank < 0.75

    return best_vector < 0.38


def _is_catalog_query(question: str) -> bool:
    """Detect chapter-list/table-of-contents style queries that need broader recall."""
    q = (question or "").lower()
    has_chapter = "chapter" in q or "contents" in q or "table of contents" in q
    has_list_intent = any(term in q for term in ["all", "list", "name", "names", "total"])
    return has_chapter and has_list_intent


def _dedupe_docs(docs: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for doc in docs:
        key = re.sub(r"\s+", " ", str(doc.get("text", ""))[:260]).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(doc)
    return unique


_CHAPTER_PATTERN = re.compile(
    r"\bchapter\s*(\d{1,2})\s*[:.\-–]?\s*([^\n\r]{2,120})",
    flags=re.IGNORECASE,
)

_TOC_PATTERN = re.compile(
    r"(?:^|\n)\s*(\d{1,2})\s+([A-Za-z][A-Za-z0-9 ,:&()\-'/’]{4,120}?)(?:\n|\s{2,}|$)",
    flags=re.IGNORECASE,
)


def _is_noisy_title(title: str) -> bool:
    t = title.lower()
    if "indd" in t:
        return True
    if re.search(r"\d{1,2}/\d{1,2}/\d{2,4}", t):
        return True
    if re.search(r"\b\d{1,2}:\d{2}\b", t):
        return True
    words = [w for w in re.findall(r"[A-Za-z']+", title) if len(w) > 1]
    return len(words) < 2


def _extract_chapter_titles(docs: list[dict]) -> dict[int, str]:
    chapter_map: dict[int, str] = {}
    for doc in docs:
        text = str(doc.get("text", ""))

        for number, raw_title in _CHAPTER_PATTERN.findall(text):
            idx = int(number)
            if idx <= 0 or idx > 30:
                continue

            title = re.sub(r"\s+", " ", raw_title).strip(" .:-\t")
            title = re.sub(r"^[\W_]+", "", title)
            if len(title) < 2 or _is_noisy_title(title):
                continue
            if idx not in chapter_map or len(title) > len(chapter_map[idx]):
                chapter_map[idx] = title

        for number, raw_title in _TOC_PATTERN.findall(text):
            idx = int(number)
            if idx <= 0 or idx > 30:
                continue

            title = re.sub(r"\s+", " ", raw_title).strip(" .:-\t")
            title = re.sub(r"^[\W_]+", "", title)
            if len(title) < 2 or _is_noisy_title(title):
                continue
            if idx not in chapter_map or len(title) > len(chapter_map[idx]):
                chapter_map[idx] = title

    return dict(sorted(chapter_map.items(), key=lambda item: item[0]))


# ── Logging ──────────────────────────────────────────────────────────────────
_LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "rag_logs.jsonl")


def _log_interaction(question, answer, sources, elapsed, lang, student_id):
    import json
    entry = {
        "timestamp": datetime.now().isoformat(),
        "student_id": student_id,
        "language": lang,
        "question": question,
        "answer": answer[:500],
        "sources": sources,
        "elapsed_sec": round(elapsed, 2),
    }
    try:
        with open(_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


# ── Context builder with source citations ────────────────────────────────────
def _build_context(docs: list[dict]) -> tuple[str, list[str]]:
    """Build clean context string (no metadata) and internal source list."""
    context_parts = []
    sources = []  # kept internally for debugging / logging
    for doc in docs:
        context_parts.append(doc['text'])
        src_label = f"{doc['source']} – Page {doc['page']}"
        if src_label not in sources:
            sources.append(src_label)
    context = "\n\n".join(context_parts)
    return context, sources


# ── Main pipeline ────────────────────────────────────────────────────────────
def generate_answer(
    question: str,
    student_name: str = "Student",
    student_id: str = "",
    subject_filter: str = "",
) -> dict:
    """
    Production RAG pipeline.
    Returns: {answer, sources, chunks_found, elapsed_sec, language}
    """
    start = time.time()

    try:
        # 1. Language detection
        lang = detect_language(question)
        search_query = question

        # 2. Translate to English if needed
        if lang != "english":
            search_query = translate_to_english(question, lang)

        # 2b. Resolve subject scope from explicit filter or question hints
        resolved_subject_filter = _resolve_subject_filter(search_query, subject_filter)
        catalog_query = _is_catalog_query(search_query)

        vector_k = 16 if catalog_query else 8
        keyword_k = 8 if catalog_query else 5
        rerank_k = 12 if catalog_query else 7

        # 3. Hybrid search (vector + keyword + multi-query)
        raw_docs = hybrid_search(
            search_query,
            vector_k=vector_k,
            keyword_k=keyword_k,
            subject_filter=resolved_subject_filter,
        )

        catalog_seed_docs: list[dict] = []
        if catalog_query and resolved_subject_filter:
            # Second retrieval pass anchored to TOC intent improves chapter-list completeness.
            catalog_seed_docs = hybrid_search(
                "table of contents chapter names",
                vector_k=24,
                keyword_k=0,
                subject_filter=resolved_subject_filter,
            )
            raw_docs = _dedupe_docs(raw_docs + catalog_seed_docs)

        # 4. Re-rank for most relevant context
        top_docs = rerank(search_query, raw_docs, top_k=rerank_k)

        # 4b. If nothing relevant was retrieved, fail safely.
        if not top_docs:
            elapsed = time.time() - start
            return {
                "answer": "I cannot find the answer in the provided textbooks.",
                "sources": [],
                "chunks_found": 0,
                "elapsed_sec": round(elapsed, 2),
                "language": lang,
            }

        # 5. Build context with source citations
        context, sources = _build_context(top_docs)

        # 5b. Deterministic chapter-list extraction for catalog-style queries.
        if catalog_query:
            chapter_titles = _extract_chapter_titles(catalog_seed_docs + top_docs)
            if len(chapter_titles) >= 5:
                lines = [f"{num}. {title}" for num, title in chapter_titles.items()]
                answer = "Here are the chapter names I found in the textbook context:\n\n" + "\n".join(lines)

                if len(chapter_titles) < 10:
                    answer += "\n\nI found these chapter titles in the indexed context."

                if lang != "english":
                    answer = translate_from_english(answer, lang)

                elapsed = time.time() - start
                _log_interaction(question, answer, sources, elapsed, lang, student_id)

                return {
                    "answer": answer,
                    "sources": sources,
                    "chunks_found": len(top_docs),
                    "elapsed_sec": round(elapsed, 2),
                    "language": lang,
                }

        # 6. Build chat memory context
        memory_ctx = ""
        if student_id:
            history = _get_memory(student_id)
            if history:
                memory_ctx = "\nPrevious conversation:\n"
                for msg in history:
                    memory_ctx += f"{msg['role'].title()}: {msg['content']}\n"  
                memory_ctx += "\n"

        # 6b. Relevance threshold — reject weak contexts to avoid wrong answers
        if _low_relevance_context(top_docs):
            elapsed = time.time() - start
            return {
                "answer": "I cannot find the answer in the provided textbooks.",
                "sources": [],
                "chunks_found": 0,
                "elapsed_sec": round(elapsed, 2),
                "language": lang,
            }

        # 7. Generate answer with strict anti-hallucination prompt
        prompt = f"""You are a helpful Class 8 tutor assisting {student_name}.  

Answer the question ONLY using the provided textbook context.

Rules:
- Give a clear and simple answer.
- Do NOT show page numbers.
- Do NOT mention document names or file names.
- Do NOT show sources.
- Do NOT use your own knowledge.
- If the answer is not present in the context, say:
  "I cannot find the answer in the provided textbooks."
- Keep answers student-friendly.
- Use bullet points or numbered lists when explaining steps.
- If context seems incomplete for a long list question, say what is available and state that context is partial.
- For chapter-list questions, include every chapter name you can find in context and continue numbering correctly.
{memory_ctx}
Context:
{context}

Question:
{search_query}

Answer:"""

        response = _groq.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a textbook tutor. Answer ONLY from the given context. Never use your own knowledge. Never mention source names, file names, or page numbers in your answer."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=1400 if catalog_query else 1024,
        )

        answer = response.choices[0].message.content

        # 8. Translate answer back if needed
        if lang != "english":
            answer = translate_from_english(answer, lang)

        elapsed = time.time() - start

        # 9. Update chat memory
        if student_id:
            _add_to_memory(student_id, "user", question)
            _add_to_memory(student_id, "assistant", answer)

        # 10. Log the interaction
        _log_interaction(question, answer, sources, elapsed, lang, student_id)

        return {
            "answer": answer,
            "sources": sources,
            "chunks_found": len(top_docs),
            "elapsed_sec": round(elapsed, 2),
            "language": lang,
        }

    except Exception as e:
        elapsed = time.time() - start
        error_msg = str(e)
        if "HF_TOKEN_REQUIRED" in error_msg:
            answer = "Sorry! I cannot process PDF textbooks correctly right now because the free web server is out of memory. To fix this, please follow the developer instructions to add a free HF_TOKEN to your hosting settings, or try running the server locally!"
        else:
            answer = f"I'm sorry, I ran into an error while finding the answer: {error_msg}"
            
        return {
            "answer": answer,
            "sources": [],
            "chunks_found": 0,
            "elapsed_sec": round(elapsed, 2),
            "language": "english",
        }
