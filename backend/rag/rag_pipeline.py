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
from pathlib import Path
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

_SUBJECT_SLUGS = {
    "math": "Std_8_math",
    "science": "Std_8_science",
    "english": "Std_8_eng",
    "hindi": "Std_8_hindi",
    "social": "Std_8_social",
    "sanskrit": "Std_8_sanskrit",
    "arts": "Std_8_arts",
    "physed": "Std_8_physed",
    "voced": "Std_8_voced",
}

_SUBJECT_LABELS = {
    "math": "Mathematics",
    "science": "Science",
    "english": "English",
    "hindi": "Hindi",
    "social": "Social Science",
    "sanskrit": "Sanskrit",
    "arts": "Fine Arts",
    "physed": "Physical Education",
    "voced": "Vocational Education",
}

_REFERENCE_STEMS = {"index", "intro", "unit", "annexure", "warm up and cool down"}

# Curated chapter titles are used only when chapter PDFs are present for that number.
_CHAPTER_TITLE_OVERRIDES: dict[str, dict[int, str]] = {
    "science": {
        1: "Chapter 1: Exploring the Investigative World of Science",
        2: "Chapter 2: The Invisible Living World: Beyond Our Naked Eye",
        3: "Chapter 3: Health: The Ultimate Treasure",
        4: "Chapter 4: Electricity: Magnetic and Heating Effects",
        5: "Chapter 5: Exploring Forces",
        6: "Chapter 6: Pressure, Winds, Storms, and Cyclones",
        7: "Chapter 7: Particulate Nature of Matter",
        8: "Chapter 8: Nature of Matter: Elements, Compounds, and Mixtures",
        9: "Chapter 9: The Amazing World of Solutes, Solvents, and Solutions",
        10: "Chapter 10: Light: Mirrors and Lenses",
        11: "Chapter 11: Keeping Time with the Skies",
        12: "Chapter 12: How Nature Works in Harmony",
        13: "Chapter 13: Our Home: Earth, a Unique Life Sustaining Planet",
    },
    "arts": {
        1: "Chapter 1: Bringing Words Alive",
        2: "Chapter 2: One Stage, Many Scripts",
        3: "Chapter 3: From Page to Stage",
        4: "Chapter 4: Applause and Advice",
        5: "Chapter 5: Discovering the Elements of Music",
        6: "Chapter 6: Musical Instruments",
        7: "Chapter 7: Indian Classical Music",
        8: "Chapter 8: Inspiration and Imagination",
        9: "Chapter 9: My World of Music",
        10: "Chapter 10: Inner Dynamics of Dance",
        11: "Chapter 11: Pan Indian Dance Forms",
        12: "Chapter 12: Dance for Well-being",
        13: "Chapter 13: Innovation, Inclusivity and Inspiring Change",
        14: "Chapter 14: A Presentation of Dance and Choreography",
        15: "Chapter 15: Elements and Principles of Visual Art and Design",
        16: "Chapter 16: Still Life in Colour",
        17: "Chapter 17: People in Places",
        18: "Chapter 18: Arts of the People",
        19: "Chapter 19: Campaign for Art Awareness",
    },
    "social": {
        1: "Chapter 1: Natural Resources and Their Use",
        2: "Chapter 2: Reshaping India's Political Map",
        3: "Chapter 3: The Rise of the Marathas",
        4: "Chapter 4: The Colonial Era in India",
        5: "Chapter 5: Universal Franchise and India's Electoral System",
        6: "Chapter 6: The Parliamentary System: Legislature and Executive",
        7: "Chapter 7: Factors of Production",
    },
}

_CHAPTER_FILE_PATTERN = re.compile(r"(?i)chapter\s*(\d{1,2})(?:\s*[-:_]\s*(.*))?")


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
    # Resolve social science before generic science to avoid collisions.
    if re.search(r"\bsocial science\b|\bsst\b", q) or re.search(r"\bsocial\b", q):
        return "social"

    for key, hints in _SUBJECT_HINTS.items():
        for hint in hints:
            if re.search(rf"\b{re.escape(hint)}\b", q):
                return key
    return ""


def _canonical_subject_key(subject_value: str) -> str:
    raw = (subject_value or "").strip().lower()
    if not raw:
        return ""

    normalized = raw.replace("std_8_", "").replace("_", " ").replace("-", " ")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return ""

    if re.search(r"\bsocial science\b|\bsst\b", normalized) or normalized == "social":
        return "social"

    for key, hints in _SUBJECT_HINTS.items():
        if normalized == key:
            return key
        for hint in hints:
            if re.search(rf"\b{re.escape(hint)}\b", normalized):
                return key

    return ""


def _is_reference_pdf(stem: str) -> bool:
    cleaned = re.sub(r"[_-]+", " ", stem).strip().lower()
    return cleaned in _REFERENCE_STEMS


def _subject_dir(subject_key: str) -> Path | None:
    slug = _SUBJECT_SLUGS.get(subject_key, "")
    if not slug:
        return None

    uploads_root = Path(__file__).resolve().parent.parent / "uploads"
    subject_dir = uploads_root / slug
    if not subject_dir.exists() or not subject_dir.is_dir():
        return None

    return subject_dir


def _file_sort_key(path: Path) -> tuple[int, int, str]:
    stem = re.sub(r"[_-]+", " ", path.stem).strip().lower()
    if stem == "index":
        return (0, 0, stem)
    if stem == "intro":
        return (1, 0, stem)

    chapter_match = _CHAPTER_FILE_PATTERN.search(stem)
    if chapter_match:
        return (2, int(chapter_match.group(1)), stem)

    return (3, 0, stem)


def _format_file_title(path: Path) -> str:
    stem = path.stem.strip()
    chapter_match = _CHAPTER_FILE_PATTERN.search(stem)
    if chapter_match:
        idx = int(chapter_match.group(1))
        suffix = (chapter_match.group(2) or "").strip(" -_:")
        if suffix:
            suffix = re.sub(r"\s+", " ", suffix).strip().title()
            return f"Chapter {idx}: {suffix}"
        return f"Chapter {idx}"

    clean = re.sub(r"[_-]+", " ", stem).strip()
    if clean.lower() == "index":
        return "Index"
    if clean.lower() == "intro":
        return "Intro"
    return clean.title()


def _list_subject_files(subject_key: str, include_reference: bool = True) -> list[str]:
    subject_dir = _subject_dir(subject_key)
    if not subject_dir:
        return []

    files: list[str] = []
    for path in sorted(subject_dir.iterdir(), key=_file_sort_key):
        if not path.is_file() or path.suffix.lower() != ".pdf":
            continue
        if not include_reference and _is_reference_pdf(path.stem):
            continue
        files.append(_format_file_title(path))

    return files


def _list_all_subject_file_counts() -> list[tuple[str, int]]:
    counts: list[tuple[str, int]] = []
    for key in _SUBJECT_SLUGS:
        files = _list_subject_files(key, include_reference=True)
        if not files:
            continue
        label = _SUBJECT_LABELS.get(key, key.title())
        counts.append((label, len(files)))

    counts.sort(key=lambda item: item[0].lower())
    return counts


def _list_subject_chapters(subject_key: str) -> list[tuple[int, str]]:
    subject_dir = _subject_dir(subject_key)
    if not subject_dir:
        return []

    overrides = _CHAPTER_TITLE_OVERRIDES.get(subject_key, {})
    chapters: dict[int, str] = {}

    for path in subject_dir.iterdir():
        if not path.is_file() or path.suffix.lower() != ".pdf":
            continue

        stem = path.stem.strip()
        if _is_reference_pdf(stem):
            continue

        match = _CHAPTER_FILE_PATTERN.search(stem)
        if not match:
            continue

        idx = int(match.group(1))
        if idx <= 0 or idx > 40:
            continue

        title = overrides.get(idx)
        if not title:
            suffix = (match.group(2) or "").strip(" -_:")
            if suffix:
                suffix = re.sub(r"\s+", " ", suffix).strip().title()
                title = f"Chapter {idx}: {suffix}"
            else:
                title = f"Chapter {idx}"

        chapters[idx] = title

    return sorted(chapters.items(), key=lambda item: item[0])


def _extract_requested_chapter(question: str) -> int | None:
    q = (question or "").lower()
    match = re.search(r"\bchapter\s*(\d{1,2})\b", q)
    if not match:
        return None
    return int(match.group(1))


def _is_file_query(question: str) -> bool:
    q = (question or "").lower()
    # Include simple typo-tolerant stems (fil*, subj*) for casual user input.
    has_file_token = bool(re.search(r"\b(file|files|pdf|pdfs|document|documents|fil\w*)\b", q))
    has_list_intent = any(term in q for term in ["all", "list", "show", "give", "available", "which"])
    has_subject_token = bool(re.search(r"\b(subject|subjects|subj\w*)\b", q))
    return (has_file_token and has_list_intent) or (has_subject_token and has_list_intent and has_file_token)


def _is_count_only_chapter_query(question: str) -> bool:
    q = (question or "").lower()
    has_count_intent = any(term in q for term in ["how many", "count", "number of", "total"])
    has_list_intent = any(term in q for term in ["list", "name", "names", "which", "what are"])
    return has_count_intent and not has_list_intent


def _build_deterministic_catalog_answer(question: str, subject_filter: str) -> str:
    q = (question or "").lower()
    subject_key = _canonical_subject_key(subject_filter)
    if not subject_key:
        subject_key = _canonical_subject_key(question)

    if _is_file_query(question):
        if subject_key:
            subject_label = _SUBJECT_LABELS.get(subject_key, subject_key.title())
            files = _list_subject_files(subject_key, include_reference=True)
            if not files:
                return ""

            lines = [f"{i}. {name}" for i, name in enumerate(files, start=1)]
            return f"I found {len(files)} PDF files in {subject_label}:\n\n" + "\n".join(lines)

        all_counts = _list_all_subject_file_counts()
        if not all_counts:
            return ""

        lines = [f"{i}. {label}: {count} files" for i, (label, count) in enumerate(all_counts, start=1)]
        return "Available subject files:\n\n" + "\n".join(lines)

    if not subject_key:
        return ""

    chapters = _list_subject_chapters(subject_key)
    if not chapters:
        return ""

    subject_label = _SUBJECT_LABELS.get(subject_key, subject_key.title())
    total = len(chapters)
    requested_chapter = _extract_requested_chapter(question)

    if requested_chapter is not None and any(term in q for term in ["name", "title", "which", "what"]):
        chapter_lookup = dict(chapters)
        chapter_title = chapter_lookup.get(requested_chapter)
        if chapter_title:
            return f"The name of Chapter {requested_chapter} in {subject_label} is: {chapter_title}."
        return f"I could not find Chapter {requested_chapter} in {subject_label}."

    if _is_count_only_chapter_query(question):
        return f"There are {total} chapters available in {subject_label}."

    lines = [f"{num}. {title}" for num, title in chapters]
    return f"I found {total} chapters in {subject_label}:\n\n" + "\n".join(lines)


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
    has_list_intent = any(
        term in q
        for term in ["all", "list", "name", "names", "total", "how many", "count", "number of"]
    )
    single_chapter_name_intent = bool(re.search(r"\bchapter\s*\d{1,2}\b", q)) and any(
        term in q for term in ["name", "title", "which", "what"]
    )
    return (has_chapter and has_list_intent) or single_chapter_name_intent or _is_file_query(question)


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

        # Deterministic chapter catalog path prevents OCR/noise errors for list/count queries.
        if catalog_query:
            deterministic_answer = _build_deterministic_catalog_answer(
                search_query,
                resolved_subject_filter or subject_filter,
            )
            if deterministic_answer:
                answer = deterministic_answer

                if lang != "english":
                    answer = translate_from_english(answer, lang)

                elapsed = time.time() - start

                if student_id:
                    _add_to_memory(student_id, "user", question)
                    _add_to_memory(student_id, "assistant", answer)

                _log_interaction(question, answer, [], elapsed, lang, student_id)

                return {
                    "answer": answer,
                    "sources": [],
                    "chunks_found": 0,
                    "elapsed_sec": round(elapsed, 2),
                    "language": lang,
                }

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
