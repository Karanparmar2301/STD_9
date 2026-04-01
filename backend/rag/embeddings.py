"""
embeddings.py — Shared embedding model (BAAI/bge-large-en-v1.5, 1024-dim).
Loaded once at import time and reused across the pipeline.
"""
import os
from dotenv import load_dotenv
from langchain_community.embeddings import HuggingFaceEmbeddings
from qdrant_client import QdrantClient

# Load env from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "class8_textbooks"

# Shared instances (loaded once)
embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-large-en-v1.5"
)

qdrant_client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)


def embed_text(text: str) -> list[float]:
    """Embed a single text string and return a 1024-dim vector."""
    return embedding_model.embed_query(text)
