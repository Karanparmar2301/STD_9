"""
chunker.py — Split documents into AI-readable chunks.
Uses RecursiveCharacterTextSplitter with optimised settings.
"""
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .loader import load_pdfs


def chunk_documents():
    documents = load_pdfs()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=120,
        separators=["\n\n", "\n", ".", " "]
    )

    chunks = text_splitter.split_documents(documents)
    print(f"Total Chunks Created: {len(chunks)}")
    return chunks


if __name__ == "__main__":
    chunks = chunk_documents()
    print(chunks[0])
