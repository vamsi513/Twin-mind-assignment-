// Day 5 — chat panel and settings modal wired in.
// All 3 columns working. API key guard and export in next commit.
import { useState, useCallback, useMemo } from 'react'
import { useAudio } from './hooks/useAudio'
import TranscriptPanel from './components/TranscriptPanel'
import SuggestionsPanel from './components/SuggestionsPanel'
import ChatPanel from './components/ChatPanel'
import SettingsModal from './components/SettingsModal'
import ErrorBoundary from './components/ErrorBoundary'
import { DEFAULT_SETTINGS } from './constants'

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('groq_api_key') || '')
  const [showSettings, setShowSettings] = useState(false)
  const [transcript, setTranscript] = useState([])
  const [batches, setBatches] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [pendingSuggestion, setPendingSuggestion] = useState(null)

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

  const handleApiKeyChange = useCallback((key) => {
    setApiKey(key)
    sessionStorage.setItem('groq_api_key', key)
  }, [])

  const handleExport = useCallback(() => {
    const data = {
      exported_at: new Date().toISOString(),
      transcript: transcript.map((t) => ({ text: t.text, timestamp: t.timestamp })),
      suggestion_batches: batches.map((b) => ({
        timestamp: b.timestamp,
        conversation_type: b.conversationType,
        suggestions: b.suggestions,
      })),
      chat_history: chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `twinmind-session-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [transcript, batches, chatMessages])

  const apiKeySet = apiKey.length > 0

  return (
    <div className="flex h-screen bg-bg text-gray-200 overflow-hidden divide-x divide-border">
      <ErrorBoundary label="Transcript">
        <TranscriptPanel
          isRecording={isRecording}
          transcript={transcript}
          micError={micError}
          apiKeySet={apiKeySet}
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
          apiKeySet={apiKeySet}
          batches={batches}
          onBatchAdd={(batch) => setBatches((prev) => [batch, ...prev])}
          onSuggestionClick={setPendingSuggestion}
          onOpenSettings={() => setShowSettings(true)}
        />
      </ErrorBoundary>

      <ErrorBoundary label="Chat">
        <ChatPanel
          fullTranscript={fullTranscript}
          apiKey={apiKey}
          settings={settings}
          pendingSuggestion={pendingSuggestion}
          onPendingConsumed={() => setPendingSuggestion(null)}
          messages={chatMessages}
          onMessagesChange={setChatMessages}
        />
      </ErrorBoundary>

      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          settings={settings}
          onApiKeyChange={handleApiKeyChange}
          onSave={(s) => { setSettings(s); setShowSettings(false) }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
