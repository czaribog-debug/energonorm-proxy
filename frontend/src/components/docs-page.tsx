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

const FULL_NAMES: Record<string, string> = {
  'ПУЭ 7-е издание': 'ПУЭ 7-е издание — Правила устройства электроустановок',
  'ПУЭ 6-е издание': 'ПУЭ 6-е издание — Правила устройства электроустановок',
  'ПТЭЭП': 'ПТЭЭП — Правила технической эксплуатации электроустановок потребителей',
  'ПОТЭУ': 'ПОТЭУ — Правила по охране труда при эксплуатации электроустановок',
  'СП 76.13330.2016': 'СП 76.13330.2016 — Электротехнические устройства',
  'СП 77.13330.2016': 'СП 77.13330.2016 — Системы автоматизации',
  'СП 48.13330.2019': 'СП 48.13330.2019 — Организация строительства',
  'СП 256.1325800.2016': 'СП 256.1325800.2016 — Электроустановки жилых и общественных зданий',
  'СНиП 3.05.06-85': 'СНиП 3.05.06-85 — Электротехнические устройства (монтаж)',
  'ФЗ-116': 'ФЗ-116 — О промышленной безопасности опасных производственных объектов',
  'Приказ Ростехнадзора №444-2021': 'Приказ Ростехнадзора №444 (2021) — Правила эксплуатации технологических трубопроводов',
  'Приказ Минтруда №223н-2022': 'Приказ Минтруда №223н (2022) — Расследование несчастных случаев на производстве',
  'ГОСТ 14254-2015': 'ГОСТ 14254-2015 — Степени защиты, обеспечиваемые оболочками (Код IP)',
  'ГОСТ 10434-82': 'ГОСТ 10434-82 — Соединения контактные электрические. Классификация и общие технические требования',
  'ГОСТ 16037-80': 'ГОСТ 16037-80 — Соединения сварные стальных трубопроводов',
  'ГОСТ 22687.0-85': 'ГОСТ 22687.0-85 — Стойки железобетонные для опор воздушных линий электропередачи',
  'ГОСТ 13015-2012': 'ГОСТ 13015-2012 — Изделия бетонные и железобетонные для строительства',
  'ГОСТ 21.208-2013': 'ГОСТ 21.208-2013 — СПДС. Обозначения приборов и средств автоматизации в схемах',
  'ГОСТ 12.1.004-91': 'ГОСТ 12.1.004-91 — ССБТ. Пожарная безопасность. Общие требования',
  'ГОСТ 12.1.010-76': 'ГОСТ 12.1.010-76 — ССБТ. Взрывобезопасность. Общие требования',
  'ГОСТ 12.4.026-2015': 'ГОСТ 12.4.026-2015 — ССБТ. Цвета сигнальные, знаки безопасности и разметка сигнальная',
  'ГОСТ 30331.1-2013': 'ГОСТ 30331.1-2013 — Электроустановки низковольтные. Основные положения',
  'ГОСТ Р 50462-2009': 'ГОСТ Р 50462-2009 — Идентификация проводников по цветам или цифровым обозначениям',
  'ГОСТ Р 50571.3-2009': 'ГОСТ Р 50571.3-2009 — Электроустановки низковольтные. Защита от поражения электрическим током',
  'ГОСТ Р 50571.4.44-2019': 'ГОСТ Р 50571.4.44-2019 — Электроустановки низковольтные. Защита от перенапряжений и электромагнитных помех. УЗИП',
  'ГОСТ Р 50571.5.52-2011': 'ГОСТ Р 50571.5.52-2011 — Электроустановки низковольтные. Электропроводки. Выбор и монтаж',
  'ГОСТ Р 50571.5.54-2013': 'ГОСТ Р 50571.5.54-2013 — Электроустановки низковольтные. Заземляющие устройства и защитные проводники',
  'ГОСТ Р 50571.25-2001': 'ГОСТ Р 50571.25-2001 — Электроустановки зданий. Требования к специальным установкам. Электрообогреваемые поверхности',
  'ГОСТ Р 52350.14-2006': 'ГОСТ Р 52350.14-2006 — Взрывоопасные среды. Электрические установки во взрывоопасных зонах',
  'ГОСТ Р 52719-2007': 'ГОСТ Р 52719-2007 — Трансформаторы силовые. Общие технические условия',
  'ГОСТ Р 58698-2019': 'ГОСТ Р 58698-2019 — Защита от поражения электрическим током. Общие положения для электрических установок и электрооборудования',
  'ГОСТ Р МЭК 60598-1-2011': 'ГОСТ Р МЭК 60598-1-2011 — Светильники. Общие требования и методы испытаний',
  'ГОСТ Р МЭК 61386.1-2014': 'ГОСТ Р МЭК 61386.1-2014 — Трубные системы для прокладки кабелей. Общие технические требования',
  'ГОСТ IEC 60079-14-2013': 'ГОСТ IEC 60079-14-2013 — Взрывоопасные среды. Проектирование, выбор и монтаж электроустановок',
  'ГОСТ IEC 61140-2012': 'ГОСТ IEC 61140-2012 — Защита от поражения электрическим током. Общие аспекты установок и оборудования',
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
              {data.sources.length} {pluralRu(data.sources.length, ['документ', 'документа', 'документов'])}
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
          <div className="border rounded-xl overflow-hidden mb-6 divide-y">
            {data.sources.map((d) => {
              const Icon = iconFor(d.source)
              return (
                <div key={d.source} className="flex gap-3 items-start px-4 py-3 hover:bg-accent/40 transition-colors">
                  <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="text-sm leading-snug">{FULL_NAMES[d.source] ?? d.source}</span>
                </div>
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
