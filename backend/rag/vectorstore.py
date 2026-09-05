"""
Veritas Academic — FAISS Vector Store & Embedding Engine
=========================================================
Handles dense text embeddings via SentenceTransformers (all-MiniLM-L6-v2),
FAISS vector indexing, persistent storage, and top-K similarity search.
"""
import os
import json
import time
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

VECTORSTORE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "vectorstore")
DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

class MiniLMEmbedder:
    def __init__(self, model_name: str = DEFAULT_MODEL_NAME):
        import torch
        from transformers import AutoTokenizer, AutoModel
        print(f"[RAG] Loading embedding model: {model_name}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)
        self.model.eval()
        print("[RAG] [OK] Embedding model loaded successfully.")

    def encode(self, texts: List[str], convert_to_numpy: bool = True, normalize_embeddings: bool = True) -> np.ndarray:
        import torch
        if isinstance(texts, str):
            texts = [texts]
        
        inputs = self.tokenizer(texts, padding=True, truncation=True, max_length=512, return_tensors="pt")
        with torch.no_grad():
            outputs = self.model(**inputs)
            token_embeddings = outputs[0]
            input_mask_expanded = inputs["attention_mask"].unsqueeze(-1).expand(token_embeddings.size()).float()
            sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
            sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
            embeddings = sum_embeddings / sum_mask
            if normalize_embeddings:
                embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        
        return embeddings.cpu().numpy()


_embedding_model = None


def get_embedding_model():
    """Lazily load the embedding model on CPU."""
    global _embedding_model
    if _embedding_model is None:
        try:
            _embedding_model = MiniLMEmbedder(DEFAULT_MODEL_NAME)
        except Exception as e:
            print(f"[RAG] Warning: Could not load embedding model: {e}")
            _embedding_model = None
    return _embedding_model


class RAGVectorStore:
    def __init__(self, base_dir: str = VECTORSTORE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        # In-memory index cache: {subject_key: {"index": faiss.Index, "chunks": List[Dict]}}
        self._indices: Dict[str, Dict[str, Any]] = {}
        self._load_existing_indices()

    def _get_subject_dir(self, subject_key: str) -> str:
        s_dir = os.path.join(self.base_dir, subject_key.lower().replace(" ", "_"))
        os.makedirs(s_dir, exist_ok=True)
        return s_dir

    def _load_existing_indices(self):
        """Loads any previously persisted FAISS indices from disk."""
        if not os.path.exists(self.base_dir):
            return

        try:
            import faiss
        except ImportError:
            print("[RAG] FAISS not yet installed; in-memory fallback will be used.")
            return

        for entry in os.listdir(self.base_dir):
            subj_path = os.path.join(self.base_dir, entry)
            if os.path.isdir(subj_path):
                faiss_file = os.path.join(subj_path, "index.faiss")
                meta_file = os.path.join(subj_path, "chunks.json")
                if os.path.exists(faiss_file) and os.path.exists(meta_file):
                    try:
                        index = faiss.read_index(faiss_file)
                        with open(meta_file, "r", encoding="utf-8") as f:
                            chunks = json.load(f)
                        self._indices[entry] = {"index": index, "chunks": chunks}
                        print(f"[RAG] Loaded index for subject '{entry}' ({len(chunks)} chunks).")
                    except Exception as e:
                        print(f"[RAG] Error loading index for {entry}: {e}")

    def add_documents(
        self,
        chunks: List[Dict[str, Any]],
        subject_key: str = "global",
    ) -> int:
        """
        Embeds and adds document chunks to the FAISS index for a specific subject.
        """
        if not chunks:
            return 0

        model = get_embedding_model()
        if model is None:
            raise RuntimeError("Embedding model is not available.")

        import faiss

        texts = [c["text"] for c in chunks]
        embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        embeddings = np.ascontiguousarray(embeddings, dtype=np.float32)
        dim = embeddings.shape[1]

        subject_key_clean = subject_key.lower().replace(" ", "_")
        subj_dir = self._get_subject_dir(subject_key_clean)

        if subject_key_clean in self._indices:
            idx_data = self._indices[subject_key_clean]
            idx_data["index"].add(embeddings)
            idx_data["chunks"].extend(chunks)
        else:
            index = faiss.IndexFlatIP(dim)  # Inner Product with normalized embeddings = Cosine Sim
            index.add(embeddings)
            self._indices[subject_key_clean] = {
                "index": index,
                "chunks": list(chunks),
            }

        # Persist to disk
        faiss_file = os.path.join(subj_dir, "index.faiss")
        meta_file = os.path.join(subj_dir, "chunks.json")

        faiss.write_index(self._indices[subject_key_clean]["index"], faiss_file)
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(self._indices[subject_key_clean]["chunks"], f, indent=2)

        print(f"[RAG] Saved {len(chunks)} new chunks for subject '{subject_key_clean}'. Total: {len(self._indices[subject_key_clean]['chunks'])}")
        return len(chunks)

    def similarity_search(
        self,
        query: str,
        subject_key: Optional[str] = None,
        top_k: int = 4,
        threshold: float = 0.25,
    ) -> List[Dict[str, Any]]:
        """
        Performs cosine similarity search against indexed subject chunks.
        If subject_key is provided, searches that subject's index + global index.
        """
        if not query.strip():
            return []

        model = get_embedding_model()
        if model is None:
            return []

        query_emb = model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        query_emb = np.ascontiguousarray(query_emb, dtype=np.float32)

        target_subjects = []
        if subject_key:
            s_clean = subject_key.lower().replace(" ", "_")
            if s_clean in self._indices:
                target_subjects.append(s_clean)
        
        # Include global index if available and distinct
        if "global" in self._indices and "global" not in target_subjects:
            target_subjects.append("global")

        # If still empty, search across all available indices
        if not target_subjects:
            target_subjects = list(self._indices.keys())

        if not target_subjects:
            return []

        candidates = []
        for subj in target_subjects:
            idx_data = self._indices.get(subj)
            if not idx_data or idx_data["index"].ntotal == 0:
                continue

            k = min(top_k, idx_data["index"].ntotal)
            scores, indices = idx_data["index"].search(query_emb, k)
            
            for score, doc_idx in zip(scores[0], indices[0]):
                if doc_idx >= 0 and doc_idx < len(idx_data["chunks"]):
                    if float(score) >= threshold:
                        chunk_meta = dict(idx_data["chunks"][doc_idx])
                        chunk_meta["similarity_score"] = float(round(float(score), 4))
                        chunk_meta["subject"] = subj
                        candidates.append(chunk_meta)

        # Sort by similarity score descending and take top_k
        candidates.sort(key=lambda x: x["similarity_score"], reverse=True)
        return candidates[:top_k]

    def list_indexed_sources(self, subject_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns summary of indexed documents and chunk counts."""
        results = []
        target_keys = [subject_key.lower().replace(" ", "_")] if subject_key and subject_key in self._indices else list(self._indices.keys())

        for subj in target_keys:
            data = self._indices.get(subj)
            if not data:
                continue
            chunks = data.get("chunks", [])
            sources = {}
            for c in chunks:
                src = c.get("source", "Unknown")
                sources[src] = sources.get(src, 0) + 1

            results.append({
                "subject": subj,
                "total_chunks": len(chunks),
                "documents": [{"filename": k, "chunks_count": v} for k, v in sources.items()],
            })
        return results

    def _ensure_subject_loaded(self, subject_key: str):
        """Ensures subject metadata is loaded from disk if not yet in cache."""
        clean = subject_key.lower().replace(" ", "_")
        if clean not in self._indices:
            meta_file = os.path.join(self.base_dir, clean, "chunks.json")
            if os.path.exists(meta_file):
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        chunks = json.load(f)
                    self._indices[clean] = {"chunks": chunks}
                except Exception:
                    pass

    def has_document(self, filename: str, subject_key: Optional[str] = None) -> bool:
        """Checks if a document with this filename is already indexed in the given subject (or globally)."""
        target_name = os.path.basename(filename).strip().lower()
        subjs_to_check = []
        if subject_key:
            self._ensure_subject_loaded(subject_key)
            clean = subject_key.lower().replace(" ", "_")
            if clean in self._indices:
                subjs_to_check.append(clean)
        if not subjs_to_check:
            subjs_to_check = list(self._indices.keys())

        for subj in subjs_to_check:
            data = self._indices.get(subj)
            if not data:
                continue
            for c in data.get("chunks", []):
                src = os.path.basename(c.get("source", "")).strip().lower()
                if src == target_name:
                    return True
        return False

    def get_document_chunks(self, filename: str, subject_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns all chunks belonging to a specific filename."""
        target_name = os.path.basename(filename).strip().lower()
        subjs_to_check = []
        if subject_key:
            self._ensure_subject_loaded(subject_key)
            clean = subject_key.lower().replace(" ", "_")
            if clean in self._indices:
                subjs_to_check.append(clean)
        if not subjs_to_check:
            subjs_to_check = list(self._indices.keys())

        matched = []
        for subj in subjs_to_check:
            data = self._indices.get(subj)
            if not data:
                continue
            for c in data.get("chunks", []):
                src = os.path.basename(c.get("source", "")).strip().lower()
                if src == target_name:
                    chunk_copy = dict(c)
                    chunk_copy["subject"] = subj
                    matched.append(chunk_copy)
        return matched

    def get_subject_chunks(self, subject_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns all chunks for a given subject (or all indexed chunks if None)."""
        subjs_to_check = []
        if subject_key:
            self._ensure_subject_loaded(subject_key)
            clean = subject_key.lower().replace(" ", "_")
            if clean in self._indices:
                subjs_to_check.append(clean)
        if not subjs_to_check:
            subjs_to_check = list(self._indices.keys())

        all_chunks = []
        for subj in subjs_to_check:
            data = self._indices.get(subj)
            if not data:
                continue
            for c in data.get("chunks", []):
                chunk_copy = dict(c)
                chunk_copy["subject"] = subj
                all_chunks.append(chunk_copy)
        return all_chunks

    def clear_index(self, subject_key: str):
        """Clears index in memory and on disk for a given subject."""
        subj_clean = subject_key.lower().replace(" ", "_")
        if subj_clean in self._indices:
            del self._indices[subj_clean]
        
        subj_dir = self._get_subject_dir(subj_clean)
        faiss_file = os.path.join(subj_dir, "index.faiss")
        meta_file = os.path.join(subj_dir, "chunks.json")
        if os.path.exists(faiss_file):
            os.remove(faiss_file)
        if os.path.exists(meta_file):
            os.remove(meta_file)


# Global singleton instance
_rag_store = None


def get_rag_store() -> RAGVectorStore:
    global _rag_store
    if _rag_store is None:
        _rag_store = RAGVectorStore()
    return _rag_store
