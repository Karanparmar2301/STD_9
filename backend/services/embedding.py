import os
import logging

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
logger = logging.getLogger(__name__)

# Create a singleton model
class EmbeddingService:
    _instance = None
    _load_error = None
    
    @classmethod
    def get_model(cls):
        if cls._instance is None:
            try:
                import torch
                from sentence_transformers import SentenceTransformer
                device = "cuda" if torch.cuda.is_available() else "cpu"
                cls._instance = SentenceTransformer(MODEL_NAME, device=device)
                cls._load_error = None
            except Exception as exc:
                cls._load_error = str(exc)
                logger.exception("Failed to load embedding model")
                raise
        return cls._instance


def get_embedding_load_error():
    return EmbeddingService._load_error

def get_embeddings(texts):
    model = EmbeddingService.get_model()
    return model.encode(texts, convert_to_tensor=False).tolist()

def get_query_embedding(query):
    return get_embeddings([query])[0]
