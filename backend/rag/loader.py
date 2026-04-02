"""
loader.py — Load PDF textbooks from backend/data/ (recursively).
Falls back to backend/uploads/ if data/ has no PDFs.
Uses PyPDFLoader lazy_load() to skip problematic pages safely.
"""
import os
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from tqdm import tqdm

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data"
UPLOADS_PATH = BASE_DIR / "uploads"


def _detect_subject(source_name: str) -> str:
    name = (source_name or "").lower()
    if "social" in name and "science" in name:
        return "social"
    if "science" in name:
        return "science"
    if "math" in name:
        return "math"
    if "english" in name:
        return "english"
    if "hindi" in name:
        return "hindi"
    if "sanskrit" in name:
        return "sanskrit"
    if "art" in name:
        return "arts"
    if "physical" in name or "physed" in name or "pt" in name:
        return "physed"
    if "voc" in name:
        return "voced"
    return ""


def _discover_pdf_files() -> list[Path]:
    files = sorted(DATA_PATH.rglob("*.pdf"), key=lambda p: str(p).lower()) if DATA_PATH.exists() else []

    if not files and UPLOADS_PATH.exists():
        files = sorted(UPLOADS_PATH.rglob("*.pdf"), key=lambda p: str(p).lower())

    return [f for f in files if f.is_file()]


def load_pdfs():
    documents = []
    pdf_files = _discover_pdf_files()
    if not pdf_files:
        return documents

    for file_path in tqdm(pdf_files, desc="Loading PDFs", unit="file"):
        source_name = file_path.name
        subject = _detect_subject(source_name)
        try:
            loader = PyPDFLoader(str(file_path))
            docs = []
            for doc in loader.lazy_load():
                try:
                    doc.metadata = dict(doc.metadata or {})
                    doc.metadata["source"] = source_name
                    doc.metadata["source_path"] = str(file_path.relative_to(BASE_DIR)).replace("\\", "/")
                    if subject:
                        doc.metadata["subject"] = subject
                    docs.append(doc)
                except Exception as page_err:
                    tqdm.write(f"  ⚠ Skipped a page in {source_name}: {page_err}")
            documents.extend(docs)
            tqdm.write(f"  ✔ Loaded: {source_name} ({len(docs)} pages)")
        except Exception as e:
            tqdm.write(f"  ✘ Error loading {source_name}: {e}")

    return documents


if __name__ == "__main__":
    docs = load_pdfs()
    print(f"\nTotal Pages Loaded: {len(docs)}")
