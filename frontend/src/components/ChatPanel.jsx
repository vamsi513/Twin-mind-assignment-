import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamDetail, streamChat } from '../hooks/useGroq'

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-500"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-blue-700 text-white text-sm px-3.5 py-2.5 rounded-2xl rounded-tr-sm leading-relaxed">
        {content}
      </div>
    </div>
  )
}

function AssistantMessage({ content, isStreaming }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] text-sm text-gray-200 leading-relaxed prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-gray-300 ml-0.5 align-middle animate-blink" />
        )}
      </div>
    </div>
  )
}

export default function ChatPanel({
  fullTranscript,
  apiKey,
  settings,
  pendingSuggestion,
  onPendingConsumed,
  messages,
  onMessagesChange,
}) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [hasFirstToken, setHasFirstToken] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const startStreamRef = useRef(null)

  // Auto-scroll on new content.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const addMessage = useCallback((role, content) => {
    const msg = { id: crypto.randomUUID(), role, content, timestamp: new Date().toISOString() }
    onMessagesChange((prev) => [...prev, msg])
    return msg
  }, [onMessagesChange])

  const startStream = useCallback(async (userText, isSuggestion, suggestion) => {
    // Abort any in-flight stream.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    addMessage('user', userText)

    setIsStreaming(true)
    setStreamingContent('')
    setHasFirstToken(false)

    let accumulated = ''

    const onToken = (token) => {
      accumulated += token
      setHasFirstToken(true)
      setStreamingContent(accumulated)
    }

    const onDone = () => {
      addMessage('assistant', accumulated)
      setIsStreaming(false)
      setStreamingContent('')
      setHasFirstToken(false)
    }

    try {
      if (isSuggestion) {
        await streamDetail({
          suggestion,
          fullTranscript,
          apiKey,
          settings,
          onToken,
          onDone,
          signal: controller.signal,
        })
      } else {
        // Build history excluding the just-added user message (it's included via messages state).
        const history = [...messages, { role: 'user', content: userText }].map((m) => ({
          role: m.role,
          content: m.content,
        }))
        await streamChat({
          messages: history,
          transcriptContext: fullTranscript,
          apiKey,
          settings,
          onToken,
          onDone,
          signal: controller.signal,
        })
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      addMessage('assistant', `_Error: ${err.message}_`)
      setIsStreaming(false)
      setStreamingContent('')
      setHasFirstToken(false)
    }
  }, [addMessage, messages, fullTranscript, apiKey, settings])

  // Keep ref current so the pendingSuggestion effect always calls the latest version.
  startStreamRef.current = startStream

  // When a suggestion card is clicked, consume it and start a detail stream.
  useEffect(() => {
    if (!pendingSuggestion) return
    onPendingConsumed()
    startStreamRef.current(pendingSuggestion.preview, true, pendingSuggestion)
    inputRef.current?.focus()
  }, [pendingSuggestion, onPendingConsumed])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    startStream(text, false, null)
  }, [input, isStreaming, startStream])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border shrink-0">
        <span className="text-xs font-medium tracking-widest text-muted uppercase">
          3. Chat (Detailed Answers)
        </span>
        <span className="text-xs tracking-widest text-muted uppercase">Session-only</span>
      </div>

      {/* Description box — always visible */}
      <div className="px-4 pt-3 shrink-0">
        <div className="rounded border border-border bg-surface px-4 py-3 text-xs text-muted leading-relaxed">
          Clicking a suggestion adds it to this chat and streams a detailed answer (separate prompt,
          more context). You can also type questions directly. One continuous chat per session —
          no login, no persistence.
        </div>
      </div>

      {/* Messages — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <p className="text-muted text-sm text-center mt-8">
            Click a suggestion or type a question below.
          </p>
        )}

        {messages.map((msg) =>
          msg.role === 'user' ? (
            <UserMessage key={msg.id} content={msg.content} />
          ) : (
            <AssistantMessage key={msg.id} content={msg.content} isStreaming={false} />
          )
        )}

        {/* In-flight stream */}
        {isStreaming && (
          <div>
            {!hasFirstToken ? (
              <TypingDots />
            ) : (
              <AssistantMessage content={streamingContent} isStreaming />
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="px-4 py-3 border-t border-border shrink-0 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          disabled={isStreaming}
          className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm text-gray-200 placeholder-muted focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  )
}
