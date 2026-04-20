import { useEffect, useRef, useCallback, useState } from 'react'
import { fetchSuggestions } from '../hooks/useGroq'
import SuggestionCard from './SuggestionCard'

const REFRESH_INTERVAL = 30

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 0 1 1 1v2.101a7.002 7.002 0 0 1 11.601 2.566 1 1 0 1 1-1.885.666A5.002 5.002 0 0 0 5.999 7H9a1 1 0 0 1 0 2H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm.008 9.057a1 1 0 0 1 1.276.61A5.002 5.002 0 0 0 14.001 13H11a1 1 0 1 1 0-2h5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-2.101a7.002 7.002 0 0 1-11.601-2.566 1 1 0 0 1 .61-1.276z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
      <path
        fillRule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded bg-surface border border-border px-4 py-3 space-y-2">
      <div className="skeleton h-2.5 w-24 rounded" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-4 w-3/4 rounded" />
    </div>
  )
}

function BatchSeparator({ batchNumber, timestamp }) {
  const time = new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted shrink-0 tabular-nums">
        — BATCH {batchNumber} · {time} —
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export default function SuggestionsPanel({
  isRecording,
  fullTranscript,
  recentTranscript,
  apiKey,
  settings,
  apiKeySet,
  batches,
  onBatchAdd,
  onSuggestionClick,
  onOpenSettings,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)

  // Keep a ref to the latest doRefresh so the countdown interval never goes stale.
  const doRefreshRef = useRef(null)

  const doRefresh = useCallback(async () => {
    if (!apiKeySet || isLoading) return
    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchSuggestions({
        recentTranscript: recentTranscript || fullTranscript.slice(-800) || '(none yet)',
        fullTranscript,
        apiKey,
        settings,
      })

      if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
        throw new Error('Model returned no suggestions')
      }

      onBatchAdd({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        conversationType: data.conversation_type ?? 'unknown',
        suggestions: data.suggestions,
      })
    } catch (err) {
      setError(
        err.message?.includes('JSON')
          ? 'Could not parse suggestions — try refreshing.'
          : err.message || 'Suggestions request failed.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [apiKeySet, isLoading, recentTranscript, fullTranscript, apiKey, settings, onBatchAdd])

  doRefreshRef.current = doRefresh

  // Countdown timer — only ticks while recording.
  useEffect(() => {
    if (!isRecording || !apiKeySet) {
      setCountdown(REFRESH_INTERVAL)
      return
    }

    setCountdown(REFRESH_INTERVAL)

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          doRefreshRef.current()
          return REFRESH_INTERVAL
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording, apiKeySet])

  // Reset countdown to 30 after a manual refresh.
  const handleManualRefresh = useCallback(() => {
    setCountdown(REFRESH_INTERVAL)
    doRefreshRef.current()
  }, [])

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border shrink-0">
        <span className="text-xs font-medium tracking-widest text-muted uppercase">
          2. Live Suggestions
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest text-muted uppercase">
            {batches.length} {batches.length === 1 ? 'Batch' : 'Batches'}
          </span>
          <button
            onClick={onOpenSettings}
            className="text-muted hover:text-gray-300 transition-colors p-0.5"
            aria-label="Open settings"
          >
            <GearIcon />
          </button>
        </div>
      </div>

      {/* Reload row — sticky */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <button
          onClick={handleManualRefresh}
          disabled={!apiKeySet || isLoading}
          className="flex items-center gap-1.5 text-xs text-gray-300 border border-border hover:border-gray-500 px-2.5 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className={isLoading ? 'animate-spin' : ''}>
            <RefreshIcon />
          </span>
          Reload suggestions
        </button>
        {isRecording && (
          <span className="text-xs text-muted tabular-nums">
            auto-refresh in {countdown}s
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Info card — always visible */}
        <div className="rounded border border-border bg-surface px-4 py-3 text-xs text-muted leading-relaxed shrink-0">
          On reload (or auto every ~30s), generate <strong className="text-gray-300">3 fresh suggestions</strong> from
          recent transcript context. New batch appears at the top; older batches push down (faded).
          Each is a tappable card: a{' '}
          <span className="text-blue-400">question to ask</span>, a{' '}
          <span className="text-purple-400">talking point</span>, an{' '}
          <span className="text-green-400">answer</span>, or a{' '}
          <span className="text-orange-400">fact-check</span>.
          The preview alone should already be useful.
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-orange-400 text-center py-1">{error}</p>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Suggestion batches */}
        {batches.length === 0 && !isLoading && (
          <p className="text-muted text-sm text-center mt-8">
            Suggestions appear here once recording starts.
          </p>
        )}

        {batches.map((batch, batchIndex) => (
          <div key={batch.id} className="space-y-2">
            {batch.suggestions.map((s, i) => (
              <SuggestionCard
                key={i}
                suggestion={s}
                onClick={onSuggestionClick}
                faded={batchIndex > 0}
              />
            ))}
            <BatchSeparator
              batchNumber={batches.length - batchIndex}
              timestamp={batch.timestamp}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
