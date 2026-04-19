import { useRef, useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CHUNK_MS = 30_000

function detectMimeType() {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

// Sends one audio blob to /transcribe and fires onTranscript if text comes back.
async function transcribeBlob(blob, mimeType, apiKey, onTranscript) {
  if (blob.size < 1000) return // skip near-silent chunks

  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `chunk.${ext}`)

  try {
    const res = await fetch(`${API_URL}/transcribe`, {
      method: 'POST',
      headers: { 'X-Groq-Api-Key': apiKey },
      body: form,
    })
    if (!res.ok) return
    const { text } = await res.json()
    if (text?.trim()) onTranscript(text.trim())
  } catch {
    // Network failure — drop the chunk silently. Recording continues.
  }
}

export function useAudio({ onTranscript, apiKey }) {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState(null)

  // Refs that persist across re-renders without triggering them.
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const timerRef = useRef(null)
  const mimeRef = useRef('')
  const isActiveRef = useRef(false)

  // apiKey and onTranscript can change between renders. Keep latest in refs
  // so the chunk cycle always uses the current values without recreating itself.
  const apiKeyRef = useRef(apiKey)
  const onTranscriptRef = useRef(onTranscript)
  apiKeyRef.current = apiKey
  onTranscriptRef.current = onTranscript

  // Records one 30s chunk, ships it, then starts the next cycle.
  const runCycle = useCallback(() => {
    if (!isActiveRef.current || !streamRef.current) return

    const mimeType = mimeRef.current
    const recorder = new MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : undefined
    )
    recorderRef.current = recorder
    const chunks = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.start(1000) // collect data every second for reliable ondataavailable

    timerRef.current = setTimeout(() => {
      recorder.stop()
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        await transcribeBlob(blob, mimeType, apiKeyRef.current, onTranscriptRef.current)
        runCycle() // start next cycle — isActiveRef checked at top
      }
    }, CHUNK_MS)
  }, []) // no deps — reads everything through refs

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      mimeRef.current = detectMimeType()
      isActiveRef.current = true
      setIsRecording(true)
      runCycle()
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied — please allow mic access and try again.'
          : 'Could not start microphone. Check your browser settings.'
      )
    }
  }, [runCycle])

  const stopRecording = useCallback(() => {
    isActiveRef.current = false
    clearTimeout(timerRef.current)

    if (recorderRef.current?.state !== 'inactive') {
      recorderRef.current.stop()
      // onstop will fire → transcribeBlob → runCycle checks isActiveRef and exits
    }

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setIsRecording(false)
  }, [])

  return { isRecording, error, startRecording, stopRecording }
}
