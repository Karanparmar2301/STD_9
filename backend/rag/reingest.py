"""
reingest.py — Re-chunk, re-embed, and re-upload all PDFs to Qdrant.
Run this whenever you change chunk_size or embedding model.

Usage:
  cd "c:\student dashboard"
  python -m backend.rag.reingest
"""
import os, sys, json, time
from tqdm import tqdm
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

# Ensure backend/.env is loaded
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
load_dotenv()

from .chunker import chunk_documents
from .embeddings import embedding_model, COLLECTION_NAME

CACHE_FILE = os.path.join(os.path.dirname(__file__), "..", "embeddings_cache.json")


def reingest():
    # Use a longer-timeout Qdrant client for uploads
    qclient = QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
        timeout=120,  # 2 minute timeout for large uploads
    )

    # 1. Load and chunk PDFs
    print("=" * 60)
    print("Step 1: Loading and chunking PDFs (chunk_size=500, overlap=120)")
    print("=" * 60)
    chunks = chunk_documents()
    print(f"\nTotal chunks: {len(chunks)}")

    # 2. Embed all chunks (with cache to resume if interrupted)
    print("\n" + "=" * 60)
    print("Step 2: Generating embeddings (BAAI/bge-large-en-v1.5)")
    print("=" * 60)

    embeddings_data = []
    if os.path.exists(CACHE_FILE):
        print(f"  Found cache file with embeddings, loading...")
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            embeddings_data = json.load(f)
        print(f"  Loaded {len(embeddings_data)} cached embeddings")

    if len(embeddings_data) != len(chunks):
        print(f"  Embedding {len(chunks)} chunks from scratch...")
        embeddings_data = []
        # Batch embed for speed (embed_documents processes multiple texts at once)
        batch_size = 50
        texts = [c.page_content for c in chunks]
        for i in tqdm(range(0, len(texts), batch_size), desc="Embedding batches", unit="batch"):
            batch_texts = texts[i:i + batch_size]
            vectors = embedding_model.embed_documents(batch_texts)
            for j, vec in enumerate(vectors):
                idx = i + j
                chunk = chunks[idx]
                source = chunk.metadata.get("source", "unknown")
                embeddings_data.append({
                    "vector": vec,
                    "text": chunk.page_content,
                    "source": os.path.basename(source) if os.path.sep in source else source,
                    "page": chunk.metadata.get("page", 0),
                })
        # Cache for resume
        print(f"  Saving cache ({len(embeddings_data)} embeddings)...")
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(embeddings_data, f)
        print("  Cache saved.")

    # 3. Recreate Qdrant collection
    print("\n" + "=" * 60)
    print("Step 3: Recreating Qdrant collection")
    print("=" * 60)
    vector_dim = len(embeddings_data[0]["vector"])
    print(f"Vector dimension: {vector_dim}")

    if qclient.collection_exists(COLLECTION_NAME):
        qclient.delete_collection(COLLECTION_NAME)
    qclient.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=vector_dim,
            distance=Distance.COSINE
        )
    )
    print(f"Collection '{COLLECTION_NAME}' created.")

    # 4. Upload in small batches (20 per batch to avoid timeout)
    print("\n" + "=" * 60)
    print("Step 4: Uploading vectors to Qdrant")
    print("=" * 60)
    batch_size = 20
    total_batches = (len(embeddings_data) + batch_size - 1) // batch_size

    for i in tqdm(range(0, len(embeddings_data), batch_size), desc="Uploading", unit="batch", total=total_batches):
        batch = embeddings_data[i:i + batch_size]
        points = [
            PointStruct(
                id=i + j,
                vector=item["vector"],
                payload={
                    "text": item["text"],
                    "source": item["source"],
                    "page": item["page"],
                }
            )
            for j, item in enumerate(batch)
        ]
        for attempt in range(3):
            try:
                qclient.upsert(collection_name=COLLECTION_NAME, points=points)
                break
            except Exception as e:
                if attempt < 2:
                    print(f"\n  Retry {attempt+1} for batch {i//batch_size}...")
                    time.sleep(2)
                else:
                    raise

    # 5. Verify
    count = qclient.count(collection_name=COLLECTION_NAME).count
    print(f"\n{'=' * 60}")
    print(f"Done! Vectors in Qdrant: {count}")
    print(f"Collection: {COLLECTION_NAME}")
    print(f"Chunk size: 500 | Overlap: 120")
    print(f"{'=' * 60}")

    # Clean up cache
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
        print("Cache cleaned up.")


if __name__ == "__main__":
    reingest()
