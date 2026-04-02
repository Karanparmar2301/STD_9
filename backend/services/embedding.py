from sentence_transformers import SentenceTransformer
import os
import torch

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# Create a singleton model
class EmbeddingService:
    _instance = None
    
    @classmethod
    def get_model(cls):
        if cls._instance is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            cls._instance = SentenceTransformer(MODEL_NAME, device=device)
        return cls._instance

def get_embeddings(texts):
    model = EmbeddingService.get_model()
    return model.encode(texts, convert_to_tensor=False).tolist()

def get_query_embedding(query):
    return get_embeddings([query])[0]
