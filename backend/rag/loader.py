"""
loader.py — Load all PDF textbooks from backend/data/ folder.
Uses PyPDFLoader with lazy_load() to handle corrupted pages gracefully.
"""
import os
from langchain_community.document_loaders import PyPDFLoader
from tqdm import tqdm

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data")


def load_pdfs():
    documents = []
    pdf_files = [f for f in os.listdir(DATA_PATH) if f.endswith(".pdf")]

    for file in tqdm(pdf_files, desc="Loading PDFs", unit="file"):
        file_path = os.path.join(DATA_PATH, file)
        try:
            loader = PyPDFLoader(file_path)
            docs = []
            for doc in loader.lazy_load():
                try:
                    docs.append(doc)
                except Exception as page_err:
                    tqdm.write(f"  ⚠ Skipped a page in {file}: {page_err}")
            documents.extend(docs)
            tqdm.write(f"  ✔ Loaded: {file} ({len(docs)} pages)")
        except Exception as e:
            tqdm.write(f"  ✘ Error loading {file}: {e}")

    return documents


if __name__ == "__main__":
    docs = load_pdfs()
    print(f"\nTotal Pages Loaded: {len(docs)}")
