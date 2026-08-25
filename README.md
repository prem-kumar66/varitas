# Veritas Academic

**Real-Time Cognitive Authenticity Verification for Academic Viva & College Recruitment**

> Behavioral risk estimation. Not detection. Not a verdict.

Veritas listens to candidate responses, analyzes six behavioral signals, generates adaptive follow-up questions designed to break AI-assisted answering flows, calibrates per-candidate baselines for fairness, and surfaces all of this on a live interviewer dashboard with full evidence trails and downloadable PDF reports.

---

## Features (Tier 1 + Tier 2 complete)

### Core analysis
- **6 behavioral signals** with calibrated scoring (per-candidate baselines)
- **Real GPT-2 perplexity** for fluency (with graceful heuristic fallback)
- **Word-level evidence tracking** — every score contribution is auditable
- **Adaptive follow-up generator** (Groq llama-3.1-8b-instant) — sharper probes when risk is high
- **Multi-language follow-ups**: English, Hindi, Telugu (Whisper handles 99 languages for STT)

### Interview workflow
- **Calibration mode** — establish each candidate's natural baseline before scoring
- **Subject-based question banks**: Computer Science, Data Science, Business Administration, General Aptitude
- **MCQ Quiz Mode** — server-side validated multiple-choice questions for technical screening
- **Pre-recorded demo mode** — 3 scripted scenarios (suspicious, natural, borderline) for reliable demos
- **Candidate comparison view** — distribution chart + sortable table across all interviews

### Output
- **PDF report export** — full session breakdown, per-answer signal grid, follow-ups, risk badges
- **"Why this score?" modal** — transcript with evidence spans highlighted, per-signal evidence chips
- **SQLite persistence** — every answer, signal score, and follow-up retained for review

### Reliability
- **Sample-rate handshake** — handles Safari/Firefox forcing native rates (48kHz, 44.1kHz)
- **Audio level meter** on the candidate side
- **Graceful degradation** when Groq API key or GPT-2 model is unavailable

---

## The 6 signals

| Signal | What it measures | Calibrated? | Honest caveat |
|---|---|---|---|
| **Response Delay** | Pause between question-end and answer-start | ✓ Yes | Thoughtful candidates pause too |
| **Fluency (PPL)** | GPT-2 perplexity — AI text is unnaturally predictable | ✓ Yes | Articulate humans score low too |
| **Hesitation** | Filler words, self-corrections per 100 words | ✓ Yes | Non-native speakers differ |
| **Textbook Phrasing** | LLM-tell phrase count (with span evidence) | — | Well-read humans use these too |
| **Speech Pacing** | WPM deviation from candidate's baseline | ✓ Yes | Requires word-level timestamps for production |
| **Consistency** | Contradictions vs. prior answers | — | Keyword-based; production needs embeddings |

**Composite Authenticity Score (0–100)** weighted from these. Every signal contribution is shown on the dashboard with a plain-English explanation, plus highlighted evidence spans in the transcript.

---

## The hero feature: Adaptive Follow-Up Generator

When the candidate answers, Veritas asks Groq's `llama-3.1-8b-instant` to generate **one probing follow-up** designed to require personal experience or a specific failure case.

> **Candidate:** "Blockchain improves transparency."
> **Veritas suggests:** *"Describe a project where blockchain transparency caused a privacy problem you had to solve."*

When risk is high (>60), the probe gets sharper and more experience-specific. The system prompt is multilingual (en/hi/te).

---

## Tech stack

**Backend:** FastAPI · WebSockets · `faster-whisper` (base, int8, CPU) · GPT-2 small (perplexity) · Groq SDK · SQLite (aiosqlite) · ReportLab (PDF)

**Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · lucide-react

**Audio:** PCM16 over WebSocket, sample-rate-flexible with linear resample on backend

---

## Project structure

```
veritas/
├── backend/
│   ├── main.py            # FastAPI app, WebSockets, all REST endpoints
│   ├── analyzer.py        # 6 signals with calibration + evidence tracking
│   ├── perplexity.py      # GPT-2 small wrapper (lazy-loaded)
│   ├── follow_up.py       # Multi-language Groq follow-up generator
│   ├── db.py              # Async SQLite persistence
│   ├── report.py          # ReportLab PDF generator
│   ├── demo_mode.py       # 3 scripted scenarios
│   ├── templates.py       # Academic subjects and MCQ question banks
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── page.tsx                # Landing
    │   ├── candidate/page.tsx      # Mic capture + level meter + handshake
    │   ├── interviewer/page.tsx    # Main dashboard (centerpiece)
    │   ├── sessions/page.tsx       # Comparison view
    │   ├── layout.tsx
    │   └── globals.css
    ├── package.json
    └── tailwind.config.js
```

---

## Quick start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate         # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your Groq API key (free at https://console.groq.com)

python main.py
```

First run downloads:
- Whisper base model (~140 MB)
- GPT-2 small for perplexity (~500 MB) — optional, falls back to heuristic if torch unavailable

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000**.

---

## The interview flow

1. **Start session.** Dashboard at `/interviewer` — enter candidate name + role, click Begin Session.
2. **Calibrate.** A banner prompts you to ask the calibration question ("Tell me about yourself") — this establishes the candidate's natural baseline for delay, pacing, and filler rate.
3. **Run the interview.** Either type custom questions, use a role-based template, or run a demo scenario.
4. **Candidate joins** at `/candidate` with the same session ID, clicks the mic, speaks, clicks to stop.
5. **Dashboard updates** within 2–4 seconds: transcript with evidence-highlighted spans, all 6 signals with explanations, authenticity score, and adaptive follow-up.
6. **Click any answer** to open the "Why this score?" modal with per-signal evidence chips.
7. **Click Compare** in the header to see all candidates side-by-side.
8. **Click Report** to download a polished PDF summary.

---

## 🎬 Demo script

The demo mode runs everything scripted — no mic needed. Click **Demo** in the header, pick a scenario:

- **AI-assisted (suspicious)** — 7-second delay, polished language, zero hesitation → risk spikes red, sharp follow-up generated
- **Natural human** — quick response, filler words, self-corrections → baseline green
- **Borderline** — articulate but with real personal detail → elevated but not red

This is your safety net when live audio fails. Run the suspicious scenario for the wow moment.

---

## Ethical positioning

Veritas is a **decision-support tool**, not a verdict engine. Every signal is weak alone. Calibration mode means scoring is *relative to each candidate*, not against a population — this is the central fairness fix.

The "Why this score?" modal ensures every alert is auditable. The interviewer sees exactly which spans triggered which signals and can override anything.

> **"AI-assisted behavioral risk estimation"** — not "AI cheating detector."

---

## Endpoints reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/session/start` | Begin a new session with candidate metadata |
| POST | `/api/session/finalize` | Mark session ended, compute summary |
| GET | `/api/session/{id}/report` | Download PDF report |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/session/{id}/answers` | All answers in a session |
| POST | `/api/question` | Push a question to the candidate |
| GET | `/api/templates` | List role templates |
| GET | `/api/templates/{key}` | Get template questions |
| GET | `/api/demo/scenarios` | List demo scenarios |
| POST | `/api/demo/run` | Run a scripted demo |
| WS | `/ws/candidate/{id}` | Candidate audio stream (PCM16 + JSON control) |
| WS | `/ws/interviewer/{id}` | Live dashboard updates |
| GET | `/api/health` | Health check |

---
