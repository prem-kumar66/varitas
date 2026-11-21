"""
Veritas Academic — Global Backend Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Verified model on Groq: 'qwen/qwen3.8-27b'
# Can be changed via GROQ_MODEL in backend/.env (e.g. GROQ_MODEL=openai/gpt-oss-20b)
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
