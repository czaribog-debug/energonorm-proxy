import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, X, AlertTriangle, Ban, ClipboardList, FileText, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

const SECTION_PATTERNS: Array<{
  match: RegExp
  icon: typeof Check
  label: string
  tone: string
}> = [
  { match: /^✅\s*(МОЖНО|МОЖЕТ|ДА)/i, icon: Check, label: 'МОЖНО', tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { match: /^❌\s*(НЕЛЬЗЯ|НЕТ|НЕ\s+МОГУ)/i, icon: X, label: 'НЕЛЬЗЯ', tone: 'text-rose-600 bg-rose-50 border-rose-200' },
  { match: /^⚠️\s*УСЛОВНО/i, icon: AlertTriangle, label: 'УСЛОВНО', tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  { match: /^⛔\s*НЕ\s+СООТВЕТСТВУЕТ/i, icon: Ban, label: 'НЕ СООТВЕТСТВУЕТ', tone: 'text-orange-600 bg-orange-50 border-orange-200' },
]

const HEADER_PATTERNS: Array<{
  match: RegExp
  icon: typeof ClipboardList
  label: string
}> = [
  { match: /^📋\s*ОБОСНОВАНИЕ/i, icon: ClipboardList, label: 'Обоснование' },
  { match: /^📄\s*НОРМАТИВНЫЕ\s+ДОКУМЕНТЫ/i, icon: FileText, label: 'Нормативные документы' },
  { match: /^💡\s*ПРАКТИЧЕСКАЯ\s+РЕКОМЕНДАЦИЯ/i, icon: Lightbulb, label: 'Практическая рекомендация' },
]

interface Block {
  type: 'verdict' | 'section' | 'text'
  icon?: typeof Check
  label?: string
  tone?: string
  body: string
}

function parseSections(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let current: Block | null = null

  for (const line of lines) {
    const verdictMatch = SECTION_PATTERNS.find((p) => p.match.test(line.trim()))
    const headerMatch = HEADER_PATTERNS.find((p) => p.match.test(line.trim()))

    if (verdictMatch) {
      if (current) blocks.push(current)
      current = { type: 'verdict', icon: verdictMatch.icon, label: verdictMatch.label, tone: verdictMatch.tone, body: '' }
      continue
    }
    if (headerMatch) {
      if (current) blocks.push(current)
      current = { type: 'section', icon: headerMatch.icon, label: headerMatch.label, body: '' }
      continue
    }
    if (!current) current = { type: 'text', body: '' }
    current.body += (current.body ? '\n' : '') + line
  }
  if (current) blocks.push(current)
  return blocks.filter((b) => b.body.trim() || b.type !== 'text')
}

function MD({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mb-2">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        code: ({ children }) => (
          <code className="bg-muted px-1.5 py-0.5 rounded text-[0.85em] font-mono">{children}</code>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export function MessageContent({ text }: { text: string }) {
  const blocks = parseSections(text)

  if (blocks.length === 1 && blocks[0].type === 'text') {
    return (
      <div className="text-sm">
        <MD>{blocks[0].body}</MD>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      {blocks.map((b, i) => {
        if (b.type === 'verdict' && b.icon) {
          const Icon = b.icon
          return (
            <div key={i} className={cn('rounded-lg border px-3 py-2.5 flex gap-2.5', b.tone)}>
              <Icon className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2.5} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-xs uppercase tracking-wide mb-1">{b.label}</div>
                <div className="text-foreground">
                  <MD>{b.body.trim()}</MD>
                </div>
              </div>
            </div>
          )
        }
        if (b.type === 'section' && b.icon) {
          const Icon = b.icon
          return (
            <div key={i}>
              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                {b.label}
              </div>
              <div className="text-foreground/90 pl-5">
                <MD>{b.body.trim()}</MD>
              </div>
            </div>
          )
        }
        return (
          <div key={i}>
            <MD>{b.body}</MD>
          </div>
        )
      })}
    </div>
  )
}
