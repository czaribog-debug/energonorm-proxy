import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Lightbulb, Zap, Ruler, HardHat, Building2, ScrollText, BookOpen, FileCheck, ShieldCheck, Loader2 } from 'lucide-react'
import { PROXY_URL } from '@/lib/constants'

interface SourceInfo {
  source: string
  chunks: number
}

interface DocsResponse {
  sources: SourceInfo[]
  total: number
}

function iconFor(source: string): typeof Zap {
  const s = source.toLowerCase()
  if (s.startsWith('пуэ')) return Zap
  if (s.startsWith('гост')) return Ruler
  if (s.startsWith('снип')) return HardHat
  if (s.startsWith('сп ') || s.startsWith('сп.')) return Building2
  if (s.startsWith('птээп') || s.startsWith('потэу')) return ShieldCheck
  if (s.startsWith('фз') || s.includes('федеральный закон')) return ScrollText
  if (s.startsWith('приказ')) return FileCheck
  return BookOpen
}

export function DocsPage() {
  const [data, setData] = useState<DocsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${PROXY_URL}/documents`)
      .then((r) => r.json())
      .then((d: DocsResponse) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="overflow-y-auto h-full p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-xl font-semibold">База знаний</h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.sources.length} {pluralRu(data.sources.length, ['документ', 'документа', 'документов'])} · {data.total} {pluralRu(data.total, ['фрагмент', 'фрагмента', 'фрагментов'])}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Нормативные документы, доступные AI при ответах
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загружаю список документов...
          </div>
        )}

        {error && (
          <Card className="p-4 bg-destructive/5 border-destructive/20 text-sm text-destructive">
            Не удалось загрузить список документов. Попробуйте обновить страницу.
          </Card>
        )}

        {data && data.sources.length === 0 && !loading && (
          <Card className="p-6 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <div className="font-medium mb-1">База знаний пуста</div>
            <div className="text-sm text-muted-foreground">
              Загрузите первый документ через раздел «Загрузить»
            </div>
          </Card>
        )}

        {data && data.sources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
            {data.sources.map((d) => {
              const Icon = iconFor(d.source)
              return (
                <Card key={d.source} className="p-3.5 flex gap-3 items-start hover:bg-accent/40 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm leading-snug">{d.source}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.chunks} {pluralRu(d.chunks, ['фрагмент', 'фрагмента', 'фрагментов'])}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <Card className="p-4 bg-amber-50 border-amber-200 flex gap-3">
          <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm text-amber-900 mb-1">Загрузите свои документы</div>
            <div className="text-sm text-amber-800/90 leading-relaxed">
              В разделе «Загрузить» добавьте текст любых нормативов, регламентов или ТУ — AI будет учитывать их при ответах.
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return forms[0]
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1]
  return forms[2]
}
