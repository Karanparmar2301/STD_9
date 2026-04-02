import os
import glob
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ..services.qdrant_client import init_collection, client, COLLECTION_NAME
from ..services.embedding import get_embeddings
from ..services.bm25 import bm25_service
import uuid

# Map folder structures back to class / subject
# This reads data/subject_stores/arts/ etc
data_dir = "backend/data/subject_stores"

def detect_subject(filepath):
    # Determine subject from folder or filename
    path_lower = filepath.lower()
    if 'science' in path_lower or 'science' in filepath:
        return 'science'
    elif 'math' in path_lower:
        return 'mathematics'
    elif 'english' in path_lower:
        return 'english'
    elif 'hindi' in path_lower:
        return 'hindi'
    elif 'social_science' in path_lower or 'social' in path_lower:
        return 'social_science'
    elif 'sanskrit' in path_lower:
        return 'sanskrit'
    elif 'physical_education' in path_lower or 'physed' in path_lower:
        return 'physical_education'
    elif 'vocational_education' in path_lower or 'voced' in path_lower:
        return 'vocational_education'
    else:
        return 'general'

def get_chunking_strategy(subject):
    if subject in ['science', 'social_science']:
        return 900, 200
    elif subject in ['math', 'mathematics']:
        return 400, 100
    elif subject in ['english', 'hindi', 'sanskrit']:
        return 800, 200
    else:
        return 800, 200

def ingest_all():
    print("Starting ingestion process...")
    init_collection(384)
    
    pdfs = glob.glob(f"{data_dir}/**/*.pdf", recursive=True)
    if not pdfs:
        # Fall back to uploads?
        pdfs = glob.glob("backend/uploads/**/*.pdf", recursive=True)
    
    print(f"Found {len(pdfs)} PDFs.")
    
    all_chunks_metadata = []
    
    for pdf_path in pdfs:
        subject = detect_subject(pdf_path)
        chunk_size, chunk_overlap = get_chunking_strategy(subject)
        
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        
        print(f"Loaded {pdf_path}: {len(docs)} pages.")
        
        # Determine class/chapter if possible. 
        # Standard format seems to be 'Std_8_X' or similar. 
        year_class = 8 if '8' in pdf_path else (9 if '9' in pdf_path else 10)
        chapter_name = os.path.basename(pdf_path).replace('.pdf', '')
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", " ", ""]
        )
        
        chunks = splitter.split_documents(docs)
        
        for c in chunks:
            chunk_id = str(uuid.uuid4())
            text = c.page_content.strip()
            if not text:
                continue
                
            payload = {
                "id": chunk_id,
                "text": text,
                "subject": subject,
                "class": year_class,
                "chapter": chapter_name,
                "keywords": [] # Optional extraction logic
            }
            all_chunks_metadata.append(payload)
            
    print(f"Total chunks across all documents: {len(all_chunks_metadata)}")
    
    if all_chunks_metadata:
        # 1. Embed and upload to Qdrant in batches
        BATCH_SIZE = 100
        for i in range(0, len(all_chunks_metadata), BATCH_SIZE):
            batch = all_chunks_metadata[i:i+BATCH_SIZE]
            texts = [b['text'] for b in batch]
            embeddings = get_embeddings(texts)
            
            points = [
                {
                    "id": b["id"],
                    "vector": emb,
                    "payload": b
                }
                for b, emb in zip(batch, embeddings)
            ]
            
            client.upsert(
                collection_name=COLLECTION_NAME,
                points=points
            )
            print(f"Uploaded batch {i//BATCH_SIZE + 1} to Qdrant.")
            
        print("Saving BM25 keyword index...")
        bm25_service.build_index(all_chunks_metadata)
        print("Ingestion complete!")
