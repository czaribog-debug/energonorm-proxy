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
  const wantListeningRef = useRef(false)   // намерение пользователя слушать
  const finalTextRef = useRef('')          // накопленный финальный текст между авто-рестартами
  const supported = !!getSpeechRecognition()
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])

  const startInternal = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Голосовой ввод не поддерживается этим браузером. Попробуйте Chrome или Edge.')
      wantListeningRef.current = false
      setListening(false)
      return
    }
    try {
      const rec = new Ctor()
      rec.lang = 'ru-RU'
      rec.interimResults = true
      rec.continuous = true       // не обрывать на первой паузе

      rec.onresult = (e: any) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalTextRef.current += r[0].transcript
          else interim += r[0].transcript
        }
        const combined = (finalTextRef.current + interim).trim()
        if (combined) onTranscriptRef.current(combined)
      }
      rec.onerror = (e: any) => {
        // no-speech / aborted — не показываем; всё остальное — ошибка
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setError('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.')
          wantListeningRef.current = false
        } else if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') {
          setError(`Ошибка распознавания: ${e.error}`)
        }
      }
      rec.onend = () => {
        recRef.current = null
        // Если пользователь не нажимал «стоп» — авто-рестарт (браузер сам прервал по тишине)
        if (wantListeningRef.current) {
          try { startInternal() } catch { setListening(false); wantListeningRef.current = false }
        } else {
          setListening(false)
        }
      }

      recRef.current = rec
      rec.start()
      setListening(true)
    } catch (e: any) {
      // частая ошибка — если start() вызвали слишком быстро после предыдущей сессии
      const msg = String(e?.message ?? e)
      if (!msg.includes('already started')) setError(msg)
      setListening(false)
      wantListeningRef.current = false
    }
  }

  const start = () => {
    setError(null)
    finalTextRef.current = ''
    wantListeningRef.current = true
    startInternal()
  }

  const stop = () => {
    wantListeningRef.current = false
    recRef.current?.stop()
  }

  const toggle = () => {
    if (listening) stop()
    else start()
  }

  useEffect(() => () => {
    wantListeningRef.current = false
    recRef.current?.abort()
  }, [])

  return { listening, supported, error, start, stop, toggle }
}
