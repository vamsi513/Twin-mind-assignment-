import { useState } from 'react'
import { DEFAULT_SETTINGS } from '../constants'

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-sm font-medium text-gray-200">{label}</label>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsModal({ apiKey, settings, onApiKeyChange, onSave, onClose }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey)
  const [local, setLocal] = useState({ ...settings })

  const set = (key, value) => setLocal((prev) => ({ ...prev, [key]: value }))

  const handleSave = () => {
    onApiKeyChange(localApiKey.trim())
    onSave(local)
  }

  const handleReset = () => {
    setLocal({ ...DEFAULT_SETTINGS })
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#18182a] border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* API Key */}
          <Field
            label="Groq API Key"
            hint="Stored in sessionStorage only — cleared when the tab closes. Never sent anywhere except Groq."
          >
            <input
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-gray-200 placeholder-muted focus:outline-none focus:border-blue-500 font-mono"
              autoComplete="off"
            />
          </Field>

          {/* Context windows */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Suggestions context (tokens)"
              hint="~800 ≈ last 2–3 min of speech"
            >
              <input
                type="number"
                value={local.suggestionsContextTokens}
                onChange={(e) => set('suggestionsContextTokens', Number(e.target.value))}
                min={200}
                max={4000}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </Field>
            <Field
              label="Chat context (tokens)"
              hint="~3000 ≈ full meeting context"
            >
              <input
                type="number"
                value={local.chatContextTokens}
                onChange={(e) => set('chatContextTokens', Number(e.target.value))}
                min={500}
                max={8000}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </Field>
          </div>

          {/* Prompts */}
          {[
            {
              key: 'suggestionsPrompt',
              label: 'Live suggestions prompt',
              hint: 'System prompt sent to /suggestions. Controls suggestion type selection and output format.',
              rows: 8,
            },
            {
              key: 'detailPrompt',
              label: 'Detail answer prompt',
              hint: 'System prompt for /detail — used when a suggestion card is clicked.',
              rows: 5,
            },
            {
              key: 'chatPrompt',
              label: 'Chat system prompt',
              hint: 'System prompt for /chat — prepended to every direct chat message.',
              rows: 5,
            },
          ].map(({ key, label, hint, rows }) => (
            <Field key={key} label={label} hint={hint}>
              <textarea
                value={local[key]}
                onChange={(e) => set(key, e.target.value)}
                rows={rows}
                className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-gray-300 font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
                spellCheck={false}
              />
            </Field>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={handleReset}
            className="text-xs text-muted hover:text-gray-300 underline transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted border border-border rounded hover:border-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
