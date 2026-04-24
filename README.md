# TwinMind Live Suggestions

A real-time meeting intelligence app that listens to a live conversation, transcribes it every 30 seconds, and surfaces three targeted suggestions — questions to ask, talking points to raise, direct answers, fact-checks, or clarifications — as they become relevant. Clicking any suggestion streams a detailed elaboration. A persistent chat column lets you ask follow-up questions throughout.

---

## Live Demo

**Frontend:** https://twin-mind-assignment-alpha.vercel.app  
**Backend:** https://twin-mind-assignment.onrender.com

---

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
# Create .env from the example and set your Railway URL:
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173, paste your Groq API key in Settings, and start recording.

---

## Stack & Why

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React 18 + Vite | Fast HMR, no config overhead, industry standard |
| Styling | Tailwind CSS v3 | Utility-first keeps component files readable, no CSS file sprawl |
| Markdown | react-markdown + remark-gfm | Renders structured chat answers correctly; GFM handles tables/lists |
| Backend | FastAPI | Async-native, streaming responses without boilerplate, clean Pydantic models |
| Transcription | whisper-large-v3 via Groq | Best open-weight ASR model; Groq's inference is fast enough for near-real-time |
| LLM | openai/gpt-oss-120b via Groq | Strong instruction-following for structured JSON; Groq latency keeps suggestions snappy |
| Audio | MediaRecorder API | No extra dependencies; built into every modern browser |
| Deploy | Railway (backend) + Vercel (frontend) | Both have zero-config deploys from a git push; Railway handles the long-lived SSE connections that Vercel serverless functions can't |

**Why Groq over OpenAI directly?** Latency. The round-trip from "Reload suggestions" click to first suggestion card rendered is the most user-visible metric. Groq's inference hardware cuts that in half vs. standard OpenAI endpoints at similar quality.

**Why separate Railway from Vercel?** Vercel functions have a 10s execution limit. Server-sent event streams for chat answers can run 15–30 seconds on longer responses. Railway keeps a persistent process running.

---

## Architecture

```
Browser (Vite + React)
│
├── useAudio.js          MediaRecorder → 30s chunks → POST /transcribe
├── useGroq.js           fetch wrappers for all 4 endpoints + SSE parser
│
├── TranscriptPanel      renders timestamped lines, mic control
├── SuggestionsPanel     30s countdown → POST /suggestions → batch display
├── SuggestionCard       click → pendingSuggestion → ChatPanel
└── ChatPanel            POST /detail (suggestion) or POST /chat (direct)
                         ReadableStream → token-by-token rendering

FastAPI (Railway)
│
├── POST /transcribe     audio → whisper-large-v3 → { text }
├── POST /suggestions    transcript → gpt-oss-120b → { suggestions[] } JSON
├── POST /detail         suggestion + transcript → gpt-oss-120b → SSE stream
└── POST /chat           message history + transcript → gpt-oss-120b → SSE stream

prompts.py               all prompt strings as constants, no logic in routes
```

The API key travels in the `X-Groq-Api-Key` request header, read from `sessionStorage` on the client. It touches the Groq SDK constructor and nothing else — never logged, never stored server-side.

---

## Prompt Strategy

This is the core of the assignment. Three prompts, each with a distinct job.

### 1. Live Suggestions Prompt (`SUGGESTIONS_SYSTEM` + `SUGGESTIONS_USER`)

**Goal:** Generate exactly 3 suggestions that a brilliant human expert — one who has been in the room the entire meeting — would offer *right now*.

**Context passed:**
- `full_transcript`: the entire session so far, truncated to 800 tokens (~3200 chars, ~2–3 min of speech). Provides meeting arc and prior decisions.
- `recent_transcript`: the last 30-second chunk verbatim. Grounds the model in *what is literally being said right now*, preventing suggestions that were relevant 5 minutes ago.

**Conversation type detection:** The system prompt lists six types (technical, sales, interview, medical, legal, casual) with their distinguishing signals. The model infers the type from vocabulary and structure. This is not a separate classification call — it happens in the same pass and is returned in the JSON so the UI can expose it without another round trip.

**Suggestion type selection logic:**
The prompt gives the model five suggestion types and explicit rules for choosing:
- If a question was just asked → lead with `answer` (most immediately useful)
- If a factual claim was made → consider `fact_check` (high value, rarely volunteered)
- If conversation is stalling → `question` to drive it forward
- If a key term is ambiguous → `clarification` to prevent downstream confusion
- If context is missing that the other party should know → `talking_point`

The critical rule: **never repeat the same type three times in one batch** unless the context truly demands it. Variety signals that the model is actually reading the conversation, not pattern-matching.

**Preview constraint:** Max 20 words, but must be useful *without* clicking. "Have you considered WebSockets?" is useless — it's a tease. "WebSockets cut your round-trip latency to ~10ms vs. polling at 500ms" is standalone value.

**JSON enforcement:** `response_format: {"type": "json_object"}` + `temperature: 0.4`. The lower temperature keeps the structure reliable without making suggestions feel formulaic. `max_tokens: 600` forces the model to be concise — 3 suggestions fit in ~400 tokens.

### 2. Detail Prompt (`DETAIL_SYSTEM` + `DETAIL_USER`)

**Goal:** When a suggestion card is clicked, deliver a 150–400 word expert-level elaboration that justifies the click.

**Context passed:** Full transcript truncated to 3000 tokens. The detail answer needs the full meeting arc — not just the last 30 seconds — to give grounded, specific advice.

**Deliberate separation from chat:** This is a *different* prompt from the chat system. The detail prompt instructs the model to:
- Reference specific things said in the transcript
- Use markdown (headers, bullets) since the answer will be longer
- Target 3–5× the depth of the preview
- Never hedge ("as an AI...") — just answer as a domain expert

The chat prompt, by contrast, instructs brevity. Same model, different register.

### 3. Chat Prompt (`CHAT_SYSTEM`)

**Goal:** Answer direct follow-up questions from the user as a concise expert who has been listening.

**Context passed:** Full transcript prepended to the system message as a dedicated `TRANSCRIPT CONTEXT` header block. This keeps the transcript separate from the conversation instructions so the model can reference it without confusing it with chat history.

**Design choice:** The transcript is in the *system* message, not the user turn. This means it benefits from prompt caching on repeated calls — same transcript prefix → cache hit → lower latency on the second and subsequent chat messages in a session.

**Tone:** Short and direct. Meeting participants don't want essays. If the answer is in the transcript, state it plainly. The prompt explicitly says "answer the question asked, then stop."

---

## Tradeoffs

### What I chose not to build

**Speaker diarization.** Knowing *who* said what would dramatically improve suggestion quality — especially for interview and sales calls. Groq's Whisper endpoint doesn't support diarization, and adding a separate pyannote pipeline would have tripled the backend complexity for a demo. Left out deliberately.

**Persistent sessions.** The assignment says "session-only, no login, no persistence." I respected this boundary. A real product would need a database, auth, and a session model. None of that is here.

**Streaming transcription.** Whisper is a batch model — you can't stream mid-sentence. The 30-second chunk approach is the practical workaround. A real product might use a streaming ASR model (Deepgram, AssemblyAI) for lower latency, but that would add a paid dependency and an additional integration layer.

**Mobile layout.** The 3-column layout only makes sense on desktop. The assignment is for a desktop demo tool. No responsive breakpoints are implemented.

### Hardest decisions

**Where to put the context window.** The `recent_transcript` / `full_transcript` split was non-obvious. Sending only recent context misses the meeting arc. Sending everything makes the prompt long and expensive. The solution — recent chunk verbatim + full session truncated to 800 tokens — gives the model both recency and arc at a predictable cost.

**Lifting batches to App state vs. keeping them in SuggestionsPanel.** Batches live in App because the export function needs them. This means SuggestionsPanel gets batches as a prop and calls `onBatchAdd` — slightly more prop-drilling than if batches were local, but cleaner for the export schema.

**SSE over WebSocket.** Chat/detail answers are unidirectional server→client streams. SSE is the right primitive — no overhead of a persistent bidirectional socket, no reconnection logic needed, works through Vercel and Railway without special config.

### What I'd improve with more time

1. **Streaming transcription** — replace 30s chunks with a real-time ASR model so transcript lines appear word-by-word during speech, not in 30s bursts.
2. **Speaker labels** — even simple two-speaker diarization ("Speaker A / Speaker B") would let the suggestion prompt know *which* participant to address.
3. **Suggestion deduplication** — across batches, filter suggestions that are semantically redundant with ones already shown.
4. **Keyboard shortcuts** — `⌘R` to reload suggestions, `⌘K` to focus chat input. Essential for live demo fluency.
5. **Offline queue** — buffer audio chunks locally when the network drops and retry on reconnect, rather than silently dropping them.
6. **Test coverage** — the SSE parser and audio chunking logic deserve unit tests. The prompt outputs deserve eval harnesses, not just manual testing.

---

## Deployment

### Render (backend)

1. Push repo to GitHub (already done)
2. Create new Web Service at render.com → connect repo
3. Set root directory to `backend`, runtime Python 3
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Select Free instance type
7. Copy the Render public URL (e.g. `https://twin-mind-assignment.onrender.com`)

### Vercel (frontend)

1. Import repo at vercel.com → set root directory to `frontend`
2. Add environment variable: `VITE_API_URL` = your Railway URL
3. Deploy — Vercel auto-detects Vite
4. Copy the Vercel URL (e.g. `https://twinmind-live.vercel.app`)

### Update CORS (critical)

After both URLs are known, update `backend/main.py`:

```python
allow_origins=[
    "https://twin-mind-assignment-alpha.vercel.app",
    "http://localhost:5173",
]
```

Redeploy Railway. Never use `"*"` in production.

### End-to-end test checklist

- [ ] Open app → amber API key banner visible, mic button disabled
- [ ] Open Settings → enter Groq key → banner disappears, mic enables
- [ ] Click mic → browser requests permission → recording indicator turns red
- [ ] Speak for 30s → transcript line appears with timestamp
- [ ] Auto-refresh fires → 3 suggestion cards appear with correct type labels
- [ ] Click a card → chat opens → typing dots → streaming answer renders
- [ ] Type a question → streaming response → markdown renders (bold, bullets)
- [ ] Click Export → JSON downloads with correct schema
- [ ] Open DevTools → no API key in console, no API key in Network tab bodies
- [ ] Crash one column (throw in ErrorBoundary child) → other columns stay working
