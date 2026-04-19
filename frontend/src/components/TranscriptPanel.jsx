import { useEffect, useRef } from 'react'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4zm-2 4a2 2 0 0 1 4 0v6a2 2 0 0 1-4 0V5zM5 10a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V19h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 10z" />
    </svg>
  )
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function TranscriptPanel({
  isRecording,
  transcript,
  micError,
  apiKeySet,
  onStart,
  onStop,
  onExport,
}) {
  const bottomRef = useRef(null)

  // Auto-scroll to latest transcript line.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border shrink-0">
        <span className="text-xs font-medium tracking-widest text-muted uppercase">
          1. Mic &amp; Transcript
        </span>
        <div className="flex items-center gap-1.5">
          {isRecording && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse_dot" />
          )}
          {!isRecording && (
            <span className="w-2 h-2 rounded-full bg-muted" />
          )}
          <span className="text-xs tracking-widest text-muted uppercase">
            {isRecording ? 'Recording' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mic button row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
          <button
            onClick={isRecording ? onStop : onStart}
            disabled={!apiKeySet}
            className={[
              'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg',
              isRecording
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 animate-pulse_dot'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
              !apiKeySet && 'opacity-40 cursor-not-allowed',
            ].join(' ')}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? (
              // Stop square
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="5" y="5" width="14" height="14" rx="1" />
              </svg>
            ) : (
              <MicIcon />
            )}
          </button>

          <p className="text-sm text-muted leading-snug">
            {isRecording
              ? 'Listening\u2026 transcript updates every 30s.'
              : 'Click mic to start. Transcript appends every ~30s.'}
          </p>
        </div>

        {/* Mic error */}
        {micError && (
          <div className="mx-4 mb-2 px-3 py-2 rounded bg-red-900/40 border border-red-800 text-red-300 text-xs">
            {micError}
          </div>
        )}

        {/* Transcript lines — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {transcript.length === 0 ? (
            <p className="text-muted text-sm text-center mt-12">
              No transcript yet — start the mic.
            </p>
          ) : (
            transcript.map((line, i) => (
              <div key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-muted shrink-0 tabular-nums text-xs pt-0.5">
                  {formatTimestamp(line.timestamp)}
                </span>
                <span className="text-gray-200">{line.text}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Export button — pinned to bottom */}
        <div className="px-4 py-3 shrink-0 border-t border-border">
          <button
            onClick={onExport}
            disabled={transcript.length === 0}
            className="w-full py-1.5 text-xs text-muted hover:text-gray-300 border border-border hover:border-gray-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Export session
          </button>
        </div>
      </div>
    </div>
  )
}
