import re

with open("c:/student dashboard/main.py", "r", encoding="utf-8") as f:
    text = f.read()

# Remove RAG block at top
text = re.sub(
    r"# Groq RAG Engine.*?return result",
    "RAG_ENGINE_AVAILABLE = False\n\ndef rag_pipeline(question: str, *args, **kwargs):\n    return {'answer': 'RAG system removed for redesign.', 'sources': [], 'chunks_found': 0}",
    text,
    flags=re.DOTALL
)

# Remove RAG startup check
text = re.sub(
    r"# ── RAG startup check ────────────────────────────────────────────────────────.*?@app\.on_event\(\"startup\"\).*?logger\.warning\(\"\[RAG\] Pipeline not available\"\)",
    "",
    text,
    flags=re.DOTALL
)

# Remove RAG vars inside health check
text = re.sub(
    r"""    rag_ready = False
    rag_chunks = 0
    rag_rebuild_running = bool\(globals\(\)\.get\(\"_RAG_REBUILD_STATE\", \{\}\)\.get\(\"running\", False\)\)
    if RAG_ENGINE_AVAILABLE:
        try:
            from backend\.rag\.embeddings import qdrant_client as _gq, COLLECTION_NAME as _cn
            info = _gq\.get_collection\(_cn\)
            rag_chunks = int\(getattr\(info, \"points_count\", 0\) or 0\)
            rag_ready = rag_chunks > 0
        except Exception:
            rag_ready = False
            rag_chunks = 0""",
    "    rag_ready = False\n    rag_chunks = 0\n    rag_rebuild_running = False\n",
    text,
    flags=re.DOTALL
)

# Replace _groq_rag_reply
text = re.sub(
    r"async def _groq_rag_reply\(.*?\).*?return reply, suggestions",
    "async def _groq_rag_reply(*args, **kwargs):\n    return 'RAG system removed for redesign.', []",
    text,
    flags=re.DOTALL | re.MULTILINE
)

# Replace 'from backend.rag.image_reader import extract_text_from_image' with stub inside upload
text = re.sub(
    r"from backend\.rag\.image_reader import extract_text_from_image",
    "extract_text_from_image = lambda d: ''",
    text
)

# Remove the dedicated rag_chat endpoint entirely
text = re.sub(
    r"# ── Dedicated Groq RAG Chat endpoint ─────────────────────────────────────────.*?@app\.post\(\"/api/assistant/rag-chat\"\).*?raise HTTPException\(status_code=500.*?\)",
    "",
    text,
    flags=re.DOTALL | re.MULTILINE
)

# Remove rebuild_rag_index endpoint and status and variables
text = re.sub(
    r"@app\.post\(\"/api/admin/rebuild-rag\"\).*?_RAG_REBUILD_THREAD = None",
    "",
    text,
    flags=re.DOTALL | re.MULTILINE
)

with open("c:/student dashboard/main.py", "w", encoding="utf-8") as f:
    f.write(text)
print("done")
