import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from create_embeddings import create_embeddings
from tqdm import tqdm

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

COLLECTION_NAME = "class8_textbooks"


def store_vectors():

    embeddings = create_embeddings()

    # create collection
    client.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(
            size=len(embeddings[0]["vector"]),
            distance=Distance.COSINE
        )
    )

    points = []

    for idx, item in enumerate(tqdm(embeddings, desc="Preparing points", unit="point")):

        points.append(
            PointStruct(
                id=idx,
                vector=item["vector"],
                payload={
                    "text": item["text"],
                    "source": item["metadata"]["source"],
                    "page": item["metadata"]["page"]
                }
            )
        )

    print("Uploading vectors to Qdrant...")
    
    # Upload in batches
    batch_size = 100
    for i in tqdm(range(0, len(points), batch_size), desc="Uploading batches", unit="batch"):
        batch = points[i:i + batch_size]
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=batch
        )

    print("\nVectors successfully stored in Qdrant")
    print(f"Collection: {COLLECTION_NAME}")
    print(f"Total vectors: {len(points)}")


if __name__ == "__main__":

    store_vectors()
