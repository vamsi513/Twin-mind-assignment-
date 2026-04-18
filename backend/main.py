import json
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel

import prompts

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://YOUR_REAL_VERCEL_URL.vercel.app",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Groq-Api-Key"],
)


# ── helpers ──────────────────────────────────────────────────────────────────

def get_groq(api_key: str) -> Groq:
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing X-Groq-Api-Key header")
    return Groq(api_key=api_key)


async def stream_chat(client: Groq, messages: list[dict]) -> StreamingResponse:
    def generate():
        with client.chat.completions.stream(
            model="openai/gpt-oss-120b",
            messages=messages,
        ) as stream:
            for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield f"data: {json.dumps(token)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── request bodies ────────────────────────────────────────────────────────────

class SuggestionsRequest(BaseModel):
    recent_transcript: str
    full_transcript: str


class SuggestionItem(BaseModel):
    type: str
    preview: str
    detail_context: str


class DetailRequest(BaseModel):
    suggestion: SuggestionItem
    full_transcript: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    transcript_context: str


# ── routes ────────────────────────────────────────────────────────────────────

@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    x_groq_api_key: str = Header(default=""),
):
    client = get_groq(x_groq_api_key)
    audio_bytes = await audio.read()

    if len(audio_bytes) < 1000:
        # Silently skip near-empty chunks (background noise, silence)
        return {"text": ""}

    transcription = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(audio.filename or "audio.webm", audio_bytes),
        response_format="text",
    )
    return {"text": transcription if isinstance(transcription, str) else transcription.text}


@app.post("/suggestions")
async def suggestions(
    body: SuggestionsRequest,
    x_groq_api_key: str = Header(default=""),
):
    client = get_groq(x_groq_api_key)

    user_content = prompts.SUGGESTIONS_USER.format(
        full_transcript=body.full_transcript or "(none yet)",
        recent_transcript=body.recent_transcript or "(none yet)",
    )

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": prompts.SUGGESTIONS_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        temperature=0.4,
        max_tokens=600,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Model returned invalid JSON")

    return parsed


@app.post("/detail")
async def detail(
    body: DetailRequest,
    x_groq_api_key: str = Header(default=""),
):
    client = get_groq(x_groq_api_key)

    user_content = prompts.DETAIL_USER.format(
        full_transcript=body.full_transcript or "(none yet)",
        suggestion_type=body.suggestion.type,
        suggestion_preview=body.suggestion.preview,
        detail_context=body.suggestion.detail_context,
    )

    return await stream_chat(client, [
        {"role": "system", "content": prompts.DETAIL_SYSTEM},
        {"role": "user", "content": user_content},
    ])


@app.post("/chat")
async def chat(
    body: ChatRequest,
    x_groq_api_key: str = Header(default=""),
):
    client = get_groq(x_groq_api_key)

    system_with_context = (
        prompts.CHAT_CONTEXT_HEADER.format(
            transcript_context=body.transcript_context or "(no transcript yet)"
        )
        + prompts.CHAT_SYSTEM
    )

    messages = [{"role": "system", "content": system_with_context}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages]

    return await stream_chat(client, messages)
