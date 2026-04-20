// Day 4 — live suggestions panel wired in with batch display.
// Chat column still a placeholder.
import { useState, useCallback, useMemo } from 'react'
import { useAudio } from './hooks/useAudio'
import TranscriptPanel from './components/TranscriptPanel'
import SuggestionsPanel from './components/SuggestionsPanel'
import ErrorBoundary from './components/ErrorBoundary'
import { DEFAULT_SETTINGS } from './constants'

export default function App() {
  const [settings] = useState(DEFAULT_SETTINGS)
  const [apiKey] = useState(() => sessionStorage.getItem('groq_api_key') || '')
  const [transcript, setTranscript] = useState([])
  const [batches, setBatches] = useState([])

  const handleTranscript = useCallback((text) => {
    setTranscript((prev) => [...prev, { text, timestamp: new Date().toISOString() }])
  }, [])

  const { isRecording, error: micError, startRecording, stopRecording } = useAudio({
    onTranscript: handleTranscript,
    apiKey,
  })

  const fullTranscript = useMemo(
    () => transcript.map((t) => t.text).join('\n'),
    [transcript]
  )

  const recentTranscript = transcript.length > 0 ? transcript[transcript.length - 1].text : ''

  const handleExport = useCallback(() => {
    const data = {
      exported_at: new Date().toISOString(),
      transcript: transcript.map((t) => ({ text: t.text, timestamp: t.timestamp })),
      suggestion_batches: batches.map((b) => ({
        timestamp: b.timestamp,
        conversation_type: b.conversationType,
        suggestions: b.suggestions,
      })),
      chat_history: [],
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `twinmind-session-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [transcript, batches])

  return (
    <div className="flex h-screen bg-bg text-gray-200 overflow-hidden divide-x divide-border">
      <ErrorBoundary label="Transcript">
        <TranscriptPanel
          isRecording={isRecording}
          transcript={transcript}
          micError={micError}
          apiKeySet={apiKey.length > 0}
          onStart={startRecording}
          onStop={stopRecording}
          onExport={handleExport}
        />
      </ErrorBoundary>

      <ErrorBoundary label="Suggestions">
        <SuggestionsPanel
          isRecording={isRecording}
          fullTranscript={fullTranscript}
          recentTranscript={recentTranscript}
          apiKey={apiKey}
          settings={settings}
          apiKeySet={apiKey.length > 0}
          batches={batches}
          onBatchAdd={(batch) => setBatches((prev) => [batch, ...prev])}
          onSuggestionClick={() => {}}
          onOpenSettings={() => {}}
        />
      </ErrorBoundary>

      {/* Chat placeholder */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2.5 bg-surface border-b border-border">
          <span className="text-xs font-medium tracking-widest text-muted uppercase">
            3. Chat (Detailed Answers)
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-sm">Coming in next commit</p>
        </div>
      </div>
    </div>
  )
}
