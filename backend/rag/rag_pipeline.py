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


def _get_memory(student_id: str) -> list[dict]:
    return _chat_memory.get(student_id, [])


def _add_to_memory(student_id: str, role: str, content: str):
    if student_id not in _chat_memory:
        _chat_memory[student_id] = []
    _chat_memory[student_id].append({"role": role, "content": content})
    # Trim to last N messages
    _chat_memory[student_id] = _chat_memory[student_id][-_MAX_MEMORY:]


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

    # 1. Language detection
    lang = detect_language(question)
    search_query = question

    # 2. Translate to English if needed
    if lang != "english":
        search_query = translate_to_english(question, lang)

    # 3. Hybrid search (vector + keyword + multi-query)
    raw_docs = hybrid_search(search_query)

    # 4. Re-rank for most relevant context (Top 10 → Reranker → Top 5)
    top_docs = rerank(search_query, raw_docs, top_k=5)

    # 5. Build context with source citations
    context, sources = _build_context(top_docs)

    # 6. Build chat memory context
    memory_ctx = ""
    if student_id:
        history = _get_memory(student_id)
        if history:
            memory_ctx = "\nPrevious conversation:\n"
            for msg in history:
                memory_ctx += f"{msg['role'].title()}: {msg['content']}\n"
            memory_ctx += "\n"

    # 6b. Similarity threshold — reject if best score is too low
    if top_docs:
        best_score = max(d.get('score', 0) for d in top_docs)
        if best_score < 0.40:
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
        max_tokens=1024,
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


if __name__ == "__main__":
    result = generate_answer("What is photosynthesis?")
    print(f"\nAnswer:\n{result['answer']}")
    print(f"\nSources: {result['sources']}")
    print(f"Chunks: {result['chunks_found']}")
    print(f"Time: {result['elapsed_sec']}s")
