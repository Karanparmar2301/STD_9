import os
import pickle
from rank_bm25 import BM25Okapi

BM25_INDEX_DIR = os.getenv("BM25_INDEX_DIR", "backend/data/bm25")

class BM25Service:
    def __init__(self):
        self.bm25 = None
        self.chunks = []
        os.makedirs(BM25_INDEX_DIR, exist_ok=True)
        self.index_path = os.path.join(BM25_INDEX_DIR, "index.pkl")
    
    def tokenize(self, text):
        return text.lower().split()

    def build_index(self, chunks_with_metadata):
        self.chunks = chunks_with_metadata
        tokenized_corpus = [self.tokenize(c['text']) for c in self.chunks]
        self.bm25 = BM25Okapi(tokenized_corpus)
        self.save_index()
    
    def add_more(self, new_chunks):
        self.chunks.extend(new_chunks)
        tokenized_corpus = [self.tokenize(c['text']) for c in self.chunks]
        self.bm25 = BM25Okapi(tokenized_corpus)
        self.save_index()

    def save_index(self):
        with open(self.index_path, "wb") as f:
            pickle.dump((self.bm25, self.chunks), f)
            
    def load_index(self):
        if os.path.exists(self.index_path):
            with open(self.index_path, "rb") as f:
                self.bm25, self.chunks = pickle.load(f)

    def search(self, query, top_k=5, subject=None, year_class=None):
        if not self.bm25:
            self.load_index()
            if not self.bm25:
                return []
                
        tokenized_query = self.tokenize(query)
        doc_scores = self.bm25.get_scores(tokenized_query)
        
        # Get top indices mapped to score
        top_n_indices = sorted(range(len(doc_scores)), key=lambda i: doc_scores[i], reverse=True)
        
        results = []
        for i in top_n_indices:
            chunk = self.chunks[i]
            # Manual filtering
            if subject and chunk.get('subject') != subject:
                continue
            if year_class and chunk.get('class') != year_class:
                continue
            
            score = doc_scores[i]
            if score > 0: # Only return if there is some overlap
                results.append({
                    "id": chunk.get('id'),
                    "text": chunk.get('text'),
                    "score": score,
                    "metadata": chunk
                })
            
            if len(results) >= top_k * 3: # get more to allow for merging
                break

        return results

bm25_service = BM25Service()
bm25_service.load_index()