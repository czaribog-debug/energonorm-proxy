import { useEffect, useRef } from 'react'
import { Paperclip, ArrowUp, FileText, X, Cable, Ruler, Zap, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MessageContent } from '@/components/message-content'
import type { Message, UploadedDoc } from '@/lib/types'

const EXAMPLE_CARDS = [
  { icon: Cable, text: 'Можно ли прокладывать кабель ВВГ в земле без защитной трубы?' },
  { icon: Ruler, text: 'Минимальное расстояние между кабелем и водопроводной трубой' },
  { icon: Zap, text: 'Требования к заземлению опор ВЛ 10 кВ' },
  { icon: Lightbulb, text: 'Нормы освещённости кабельных тоннелей' },
]

interface Props {
  messages: Message[]
  input: string
  setInput: (v: string) => void
  loading: boolean
  send: (q?: string) => void
  uploadedDocs: UploadedDoc[]
  onUploadDocs: (docs: UploadedDoc[]) => void
  onRemoveDoc: (i: number) => void
}

export function ChatPage({ messages, input, setInput, loading, send, uploadedDocs, onUploadDocs, onRemoveDoc }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const readPdf = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = rej
      r.readAsDataURL(file)
    })

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const newDocs: UploadedDoc[] = []
    for (const f of Array.from(files)) {
      if (f.type !== 'application/pdf') continue
      const b64 = await readPdf(f)
      newDocs.push({ name: f.name, size: f.size, b64 })
    }
    onUploadDocs(newDocs)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="relative flex flex-col h-full">
      {/* Subtle background gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-br from-blue-200/40 via-cyan-100/30 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-indigo-100/30 to-transparent blur-3xl rounded-full" />
      </div>

      {uploadedDocs.length > 0 && (
        <div className="relative z-10 px-6 py-2 border-b bg-background/80 backdrop-blur flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Документы:</span>
          {uploadedDocs.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-2 py-0.5 text-xs"
            >
              <FileText className="w-3 h-3" />
              <span className="max-w-[180px] truncate">{d.name}</span>
              <button onClick={() => onRemoveDoc(i)} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isEmpty ? (
        <WelcomeScreen
          input={input}
          setInput={setInput}
          loading={loading}
          send={send}
          onKey={onKey}
          fileRef={fileRef}
          handleFiles={handleFiles}
        />
      ) : (
        <>
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-secondary">
                      {m.content}
                    </div>
                  ) : (
                    <div className="max-w-[90%] flex-1">
                      {m.loading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse [animation-delay:300ms]" />
                          </div>
                          Анализирую нормативы...
                        </div>
                      ) : (
                        <MessageContent text={m.content} />
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="relative z-10 px-4 pb-4 pt-2">
            <ChatInput
              input={input}
              setInput={setInput}
              loading={loading}
              send={send}
              onKey={onKey}
              fileRef={fileRef}
              handleFiles={handleFiles}
            />
          </div>
        </>
      )}
    </div>
  )
}

interface InputProps {
  input: string
  setInput: (v: string) => void
  loading: boolean
  send: (q?: string) => void
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  fileRef: React.RefObject<HTMLInputElement | null>
  handleFiles: (files: FileList | null) => void
}

function ChatInput({ input, setInput, loading, send, onKey, fileRef, handleFiles }: InputProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Задайте вопрос по нормативам..."
          rows={2}
          disabled={loading}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 resize-none px-4 pt-3 pb-12 min-h-[80px] max-h-48 text-[15px]"
        />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            className="h-8 w-8 text-muted-foreground"
            title="Загрузить PDF"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-8 w-8 rounded-lg"
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground text-center mt-2">
        Ответы носят справочный характер. Проверяйте актуальность нормативов.
      </div>
    </div>
  )
}

function WelcomeScreen({ input, setInput, loading, send, onKey, fileRef, handleFiles }: InputProps) {
  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-semibold text-center mb-8 tracking-tight">
          Чем могу помочь?
        </h1>

        <ChatInput
          input={input}
          setInput={setInput}
          loading={loading}
          send={send}
          onKey={onKey}
          fileRef={fileRef}
          handleFiles={handleFiles}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
          {EXAMPLE_CARDS.map((ex, i) => {
            const Icon = ex.icon
            return (
              <button
                key={i}
                onClick={() => send(ex.text)}
                className="group flex items-start gap-3 text-left p-3 rounded-xl border bg-background/60 backdrop-blur hover:bg-accent transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <span className="text-xs leading-relaxed text-foreground/80 pt-1.5">{ex.text}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
