import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import models
from langchain_community.embeddings import HuggingFaceEmbeddings

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

COLLECTION_NAME = "class8_textbooks"

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

embedding_model = HuggingFaceEmbeddings(
    model_name="BAAI/bge-large-en-v1.5"
)


def embed_question(question):

    vector = embedding_model.embed_query(question)

    return vector


def search_documents(question):

    query_vector = embed_question(question)

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=4
    )

    documents = []

    for result in results.points:

        documents.append({
            "text": result.payload["text"],
            "source": result.payload["source"],
            "page": result.payload["page"],
            "score": result.score
        })

    return documents


if __name__ == "__main__":

    question = "What is photosynthesis?"

    docs = search_documents(question)

    for doc in docs:

        print("\nSource:", doc["source"])
        print("Page:", doc["page"])
        print("Text:", doc["text"][:300])
