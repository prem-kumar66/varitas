import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import requests, json

# Check GROQ_API_KEY env
import os, sys
print("=== ENV CHECK ===")
key = os.getenv("GROQ_API_KEY", "NOT SET")
print(f"GROQ_API_KEY: {key[:15]}..." if len(key) > 15 else f"GROQ_API_KEY: {key}")

# Check what's indexed
print("\n=== RAG INDEXED SUBJECTS ===")
r = requests.get("http://localhost:8000/api/rag/documents", timeout=10)
print(json.dumps(r.json(), indent=2))

# Test generate with global subject key (since NLP pdf is indexed under global)
print("\n=== TESTING GENERATE ENDPOINT ===")
payload = {
    "prompt": "Generate a quiz from the uploaded PDF",
    "subject_key": "global",
    "mode": "quiz",
    "num_questions": 5,
    "difficulty": "medium"
}
r = requests.post("http://localhost:8000/api/assessments/generate", json=payload, timeout=120)
print("Status:", r.status_code)
data = r.json()
if "questions" in data and data["questions"]:
    for i, q in enumerate(data["questions"]):
        question_text = q.get("question", "")
        answer_text = q.get("reference_answer", "")
        print(f"Q{i+1}: {question_text}")
        print(f"  Ans: {answer_text}")
else:
    print("Response:", json.dumps(data, indent=2)[:1000])
