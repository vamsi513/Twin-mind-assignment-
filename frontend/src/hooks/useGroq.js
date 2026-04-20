// All communication with the backend lives here.
// Components never call fetch directly.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Approximate token count by character count (4 chars ≈ 1 token).
// Used to trim context before sending — keeps latency and cost predictable.
function truncateToTokens(text, maxTokens) {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return '[...earlier context trimmed...]\n' + text.slice(-maxChars)
}

// Parses a server-sent events stream and yields decoded string tokens.
// Handles chunks split across multiple reads and malformed lines gracefully.
async function* readSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return
      try {
        yield JSON.parse(payload)
      } catch {
        // malformed token — skip without crashing
      }
    }
  }
}

export async function fetchSuggestions({ recentTranscript, fullTranscript, apiKey, settings }) {
  const res = await fetch(`${API_URL}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Groq-Api-Key': apiKey,
    },
    body: JSON.stringify({
      recent_transcript: recentTranscript,
      full_transcript: truncateToTokens(fullTranscript, settings.suggestionsContextTokens),
      system_prompt: settings.suggestionsPrompt,
    }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Suggestions failed (${res.status}): ${msg}`)
  }

  return res.json()
}

// Streams a detailed elaboration for a clicked suggestion card.
// Calls onToken for each arriving string, then onDone when the stream closes.
export async function streamDetail({ suggestion, fullTranscript, apiKey, settings, onToken, onDone, signal }) {
  const res = await fetch(`${API_URL}/detail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Groq-Api-Key': apiKey,
    },
    body: JSON.stringify({
      suggestion,
      full_transcript: truncateToTokens(fullTranscript, settings.chatContextTokens),
      system_prompt: settings.detailPrompt,
    }),
    signal,
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Detail failed (${res.status}): ${msg}`)
  }

  for await (const token of readSSE(res)) {
    onToken(token)
  }
  onDone()
}

// Streams a chat response given the full message history and transcript context.
export async function streamChat({ messages, transcriptContext, apiKey, settings, onToken, onDone, signal }) {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Groq-Api-Key': apiKey,
    },
    body: JSON.stringify({
      messages,
      transcript_context: truncateToTokens(transcriptContext, settings.chatContextTokens),
      system_prompt: settings.chatPrompt,
    }),
    signal,
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(`Chat failed (${res.status}): ${msg}`)
  }

  for await (const token of readSSE(res)) {
    onToken(token)
  }
  onDone()
}
