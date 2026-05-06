import { Card } from '@/components/ui/card'
import { Zap, FileText, HardHat, Paperclip } from 'lucide-react'

const FEATURES = [
  { icon: Zap, t: 'Мгновенные ответы', d: 'Не тратьте часы на поиск нужного пункта в нормативах' },
  { icon: FileText, t: 'Ссылки на документы', d: 'Каждый ответ содержит конкретный номер пункта ПУЭ или ГОСТа' },
  { icon: HardHat, t: 'Для практиков', d: 'Для проектировщиков, ГИПов, строителей, проверяющих органов' },
  { icon: Paperclip, t: 'Свои документы', d: 'Загружайте PDF — AI ответит строго по вашим нормативам' },
]

export function AboutPage() {
  return (
    <div className="overflow-y-auto h-full p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">О сервисе</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          ЭнергоНорм — AI-ассистент для инженеров в сфере электроэнергетики. Помогает быстро находить ответы на нормативные вопросы при проектировании и СМР.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <Card key={i} className="p-4">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <div className="font-medium text-sm mb-1">{f.t}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{f.d}</div>
              </Card>
            )
          })}
        </div>

        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          Проектировщики · ГИПы · Строители · Проверяющие органы · Заказчики строительства
        </div>
      </div>
    </div>
  )
}
