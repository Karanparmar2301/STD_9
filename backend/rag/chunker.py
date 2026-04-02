"""
chunker.py — Split documents into AI-readable chunks.
Uses RecursiveCharacterTextSplitter with optimised settings.
"""
import re
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .loader import load_pdfs


_CHUNK_SIZE = int(os.getenv("RAG_CHUNK_SIZE", "700"))
_CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "140"))


def chunk_documents():
    documents = load_pdfs()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=_CHUNK_SIZE,
        chunk_overlap=_CHUNK_OVERLAP,
        separators=["\n\n\n", "\n\n", "\n", ". ", "? ", "! ", "; ", ": ", " "],
    )

    raw_chunks = text_splitter.split_documents(documents)

    chunks = []
    for idx, chunk in enumerate(raw_chunks):
        text = re.sub(r"\s+", " ", chunk.page_content or "").strip()
        if len(text) < 80:
            continue

        chunk.page_content = text
        meta = dict(chunk.metadata or {})
        source = str(meta.get("source", "unknown"))
        page = meta.get("page", 0)
        meta["chunk_id"] = f"{source}::p{page}::c{idx}"
        chunk.metadata = meta
        chunks.append(chunk)

    print(f"Total Chunks Created: {len(chunks)}")
    return chunks


if __name__ == "__main__":
    chunks = chunk_documents()
    print(chunks[0])
