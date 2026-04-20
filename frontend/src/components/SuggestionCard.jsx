import { getTypeConfig } from '../constants'

export default function SuggestionCard({ suggestion, onClick, faded }) {
  const { label, borderColor, textClass } = getTypeConfig(suggestion.type)

  return (
    <button
      onClick={() => onClick(suggestion)}
      className={[
        'w-full text-left rounded bg-surface border border-border px-4 py-3',
        'hover:border-gray-500 hover:bg-[#1f1f35] transition-colors',
        'focus:outline-none focus:ring-1 focus:ring-blue-500',
        faded ? 'opacity-45' : 'opacity-100',
      ].join(' ')}
      style={{ borderLeftWidth: '4px', borderLeftColor: borderColor }}
    >
      <p className={`text-[10px] font-semibold tracking-widest mb-1.5 ${textClass}`}>
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-100 leading-snug">
        {suggestion.preview}
      </p>
    </button>
  )
}
