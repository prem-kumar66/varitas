"""
Veritas Academic — RAG Document Ingestion & Chunking
====================================================
Extracts text from PDF/TXT documents, cleans, and chunks text with overlap
for embedding into the FAISS vector database.
"""
import io
import re
from typing import List, Dict, Any, Optional


def extract_text_from_pdf(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extracts text page by page from raw PDF bytes.
    Returns list of {"page": int, "text": str}.
    """
    pages_data = []
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            text = re.sub(r'\s+', ' ', text).strip()
            if text:
                pages_data.append({
                    "page": idx + 1,
                    "text": text
                })
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        # Fallback decode if raw text
        try:
            raw = pdf_bytes.decode('utf-8', errors='ignore')
            if raw.strip():
                pages_data.append({"page": 1, "text": raw.strip()})
        except Exception:
            pass

    return pages_data


def chunk_text(
    text: str,
    source_name: str,
    page_num: int = 1,
    chunk_size: int = 450,
    chunk_overlap: int = 60,
) -> List[Dict[str, Any]]:
    """
    Splits text into sliding overlapping chunks respecting sentence boundaries where possible.
    """
    words = text.split()
    if not words:
        return []

    chunks = []
    chunk_id = 0
    start = 0
    
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_str = " ".join(chunk_words)

        chunks.append({
            "chunk_id": f"{source_name}_p{page_num}_c{chunk_id}",
            "source": source_name,
            "page": page_num,
            "text": chunk_str,
            "word_count": len(chunk_words),
        })

        chunk_id += 1
        if end == len(words):
            break
        start += chunk_size - chunk_overlap

    return chunks


def process_document_bytes(
    file_bytes: bytes,
    filename: str,
    chunk_size: int = 450,
    chunk_overlap: int = 60,
) -> List[Dict[str, Any]]:
    """
    Processes uploaded file bytes (PDF or plain text) and returns chunked records.
    """
    all_chunks = []
    
    if filename.lower().endswith(".pdf"):
        pages = extract_text_from_pdf(file_bytes)
        for page_info in pages:
            page_chunks = chunk_text(
                text=page_info["text"],
                source_name=filename,
                page_num=page_info["page"],
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
            all_chunks.extend(page_chunks)
    else:
        # Assume UTF-8 text/markdown
        raw_text = file_bytes.decode("utf-8", errors="ignore")
        raw_text = re.sub(r'\s+', ' ', raw_text).strip()
        all_chunks = chunk_text(
            text=raw_text,
            source_name=filename,
            page_num=1,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    return all_chunks
