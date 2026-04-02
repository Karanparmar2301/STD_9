import os
import logging
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PayloadSchemaType

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "school"

_client = None
_client_init_error = None


def get_qdrant_client():
    """Initialize Qdrant lazily so backend boot is resilient on platform startup."""
    global _client, _client_init_error

    if _client is not None:
        return _client

    try:
        if QDRANT_URL.startswith("http://localhost"):
            _client = QdrantClient(url=QDRANT_URL)
        else:
            _client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        _client_init_error = None
    except Exception as exc:
        _client = None
        _client_init_error = str(exc)
        logger.exception("Failed to initialize Qdrant client")

    return _client


def get_qdrant_client_error():
    return _client_init_error


# Keep the public symbol for compatibility with existing imports.
client = get_qdrant_client()


def init_collection(vector_size=384):
    qdrant_client = get_qdrant_client()
    if qdrant_client is None:
        raise RuntimeError(
            f"Qdrant client unavailable: {get_qdrant_client_error() or 'unknown error'}"
        )

    if not qdrant_client.collection_exists(COLLECTION_NAME):
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
        )

        # Create payload indexes for filtering
        qdrant_client.create_payload_index(COLLECTION_NAME, "subject", field_schema=PayloadSchemaType.KEYWORD)
        qdrant_client.create_payload_index(COLLECTION_NAME, "class", field_schema=PayloadSchemaType.INTEGER)
        qdrant_client.create_payload_index(COLLECTION_NAME, "chapter", field_schema=PayloadSchemaType.KEYWORD)

        print(f"Collection '{COLLECTION_NAME}' created.")
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")

