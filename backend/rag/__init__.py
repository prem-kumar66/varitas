"""
Veritas Academic — RAG Package
"""
from .ingest import extract_text_from_pdf, chunk_text, process_document_bytes
from .vectorstore import RAGVectorStore, get_rag_store
from .evaluator import evaluate_with_rag

__all__ = [
    "extract_text_from_pdf",
    "chunk_text",
    "process_document_bytes",
    "RAGVectorStore",
    "get_rag_store",
    "evaluate_with_rag",
]
