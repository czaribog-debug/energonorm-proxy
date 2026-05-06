import { useEffect, useRef, useState } from 'react'

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const supported = !!getSpeechRecognition()
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  const start = () => {
    setError(null)
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Голосовой ввод не поддерживается этим браузером. Попробуйте Chrome или Edge.')
      return
    }
    try {
      const rec = new Ctor()
      rec.lang = 'ru-RU'
      rec.interimResults = true
      rec.continuous = false

      let finalText = ''
      rec.onresult = (e: any) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalText += r[0].transcript
          else interim += r[0].transcript
        }
        const combined = (finalText + interim).trim()
        if (combined) onTranscriptRef.current(combined)
      }
      rec.onerror = (e: any) => {
        const msg = e?.error === 'not-allowed'
          ? 'Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.'
          : e?.error === 'no-speech'
          ? null
          : `Ошибка распознавания: ${e?.error ?? 'unknown'}`
        if (msg) setError(msg)
      }
      rec.onend = () => {
        setListening(false)
        recRef.current = null
      }

      recRef.current = rec
      rec.start()
      setListening(true)
    } catch (e: any) {
      setError(String(e?.message ?? e))
      setListening(false)
    }
  }

  const stop = () => {
    recRef.current?.stop()
  }

  const toggle = () => {
    if (listening) stop()
    else start()
  }

  useEffect(() => () => { recRef.current?.abort() }, [])

  return { listening, supported, error, start, stop, toggle }
}
