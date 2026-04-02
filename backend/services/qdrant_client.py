import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PayloadSchemaType

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

def get_qdrant_client():
    if QDRANT_URL.startswith("http://localhost"):
        # Local embedded or docker
        return QdrantClient(url=QDRANT_URL)
    else:
        # Cloud
        return QdrantClient(
            url=QDRANT_URL,
            api_key=QDRANT_API_KEY
        )

client = get_qdrant_client()
COLLECTION_NAME = "school"

def init_collection(vector_size=384):
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
        )
        
        # Create payload indexes for filtering
        client.create_payload_index(COLLECTION_NAME, "subject", field_schema=PayloadSchemaType.KEYWORD)
        client.create_payload_index(COLLECTION_NAME, "class", field_schema=PayloadSchemaType.INTEGER)
        client.create_payload_index(COLLECTION_NAME, "chapter", field_schema=PayloadSchemaType.KEYWORD)
        
        print(f"Collection '{COLLECTION_NAME}' created.")
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")

