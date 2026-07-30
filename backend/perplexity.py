"""
Perplexity Scorer — GPT-2 small
================================
AI-generated text has unnaturally low perplexity under a language model.
Humans produce more surprising token sequences. This is the strongest single
signal for AI-generated text detection that has scientific backing.

Caveats:
- Articulate, well-read humans also score low on perplexity
- Domain jargon raises perplexity even when the speaker is fluent
- Short responses (<10 words) are unreliable

Implementation: GPT-2 small (~500MB) loaded once, runs on CPU at ~50ms/answer.
"""
import math
import os
from typing import Optional

# Lazy-loaded — only initialized when first used
_tokenizer = None
_model = None
_torch = None
_disabled = False


def _ensure_loaded():
    global _tokenizer, _model, _torch, _disabled
    if _disabled:
        return False
    if _model is not None:
        return True
    try:
        import torch
        from transformers import GPT2LMHeadModel, GPT2TokenizerFast
        print("Loading GPT-2 small for perplexity scoring...")
        _tokenizer = GPT2TokenizerFast.from_pretrained("gpt2")
        _model = GPT2LMHeadModel.from_pretrained("gpt2")
        _model.eval()
        _torch = torch
        print("✓ GPT-2 loaded")
        return True
    except Exception as e:
        print(f"⚠️  Could not load GPT-2: {e}")
        print("    Perplexity scoring disabled — falling back to heuristic.")
        _disabled = True
        return False


def perplexity(text: str) -> Optional[float]:
    """
    Returns perplexity of `text` under GPT-2.
    Lower = more likely under the LM = more "AI-like" or "common" text.
    Returns None if model unavailable or text too short.
    """
    if not _ensure_loaded():
        return None

    if not text or len(text.split()) < 5:
        return None

    try:
        encodings = _tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        input_ids = encodings.input_ids

        with _torch.no_grad():
            outputs = _model(input_ids, labels=input_ids)
            loss = outputs.loss
            return math.exp(loss.item())
    except Exception as e:
        print(f"Perplexity error: {e}")
        return None


def perplexity_to_signal(ppl: Optional[float]) -> tuple[float, str]:
    """
    Convert raw perplexity to a 0-100 risk score.
    Tuned empirically:
      - GPT-generated text: typically PPL 15-40
      - Natural conversational speech: typically PPL 50-200
      - Technical/jargon speech: PPL 100-400
    """
    if ppl is None:
        return 0.0, "Perplexity scoring unavailable"

    if ppl < 25:
        return 85.0, f"Very low perplexity ({ppl:.0f}) — text is highly predictable, AI-like"
    if ppl < 45:
        return 65.0, f"Low perplexity ({ppl:.0f}) — unusually fluent and predictable"
    if ppl < 80:
        return 35.0, f"Moderate perplexity ({ppl:.0f}) — polished but plausibly human"
    if ppl < 150:
        return 10.0, f"Natural perplexity ({ppl:.0f}) — typical conversational speech"
    return 5.0, f"High perplexity ({ppl:.0f}) — spontaneous, jargon-rich, or atypical"
