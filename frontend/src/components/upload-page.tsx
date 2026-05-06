import { useRef, useState } from 'react'
import { Paperclip, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PROXY_URL } from '@/lib/constants'

export function UploadPage() {
  const [docName, setDocName] = useState('')
  const [docText, setDocText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsText(file, 'utf-8')
    })

  const handleFile = async (files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    setDocName(file.name)
    if (file.type === 'text/plain') {
      const text = await readFile(file)
      setDocText(text)
    } else {
      setResult('⚠️ Для PDF и Word скопируйте текст вручную в поле ниже')
    }
  }

  const upload = async () => {
    if (!docName || !docText) return
    setLoading(true)
    setResult('')
    try {
      const res = await fetch(`${PROXY_URL}/upload-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: docText, metadata: { source: docName } }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(`✅ Загружено успешно! Создано ${data.chunks} фрагментов.`)
        setDocText('')
        setDocName('')
      } else {
        setResult('❌ Ошибка: ' + (data.error || 'неизвестная ошибка'))
      }
    } catch {
      setResult('❌ Ошибка соединения')
    }
    setLoading(false)
  }

  const ok = result.startsWith('✅')
  const warn = result.startsWith('⚠️')

  return (
    <div className="overflow-y-auto h-full p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-1">Загрузить документ</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Добавьте нормативный документ в базу знаний. AI будет использовать его при ответах.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="docname">Название документа</Label>
            <Input
              id="docname"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="Например: ПУЭ 7-е издание"
            />
          </div>

          <div className="space-y-2">
            <Label>Текст документа</Label>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-center"
            >
              <Paperclip className="w-4 h-4 inline-block mr-1.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Нажмите чтобы загрузить .txt файл</span>
              <div className="text-xs text-muted-foreground/70 mt-1">или вставьте текст вручную ниже</div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files)}
            />
            <Textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Вставьте текст нормативного документа сюда..."
              rows={12}
              className="resize-y leading-relaxed"
            />
            {docText && (
              <div className="text-xs text-muted-foreground">
                {docText.length.toLocaleString()} символов · ~{Math.ceil(docText.length / 800)} фрагментов
              </div>
            )}
          </div>

          <Button onClick={upload} disabled={loading || !docName || !docText} className="w-full" size="lg">
            {loading ? 'Загружаю в базу знаний...' : 'Загрузить документ'}
          </Button>

          {result && (
            <div
              className={
                ok
                  ? 'p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700'
                  : warn
                  ? 'p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800'
                  : 'p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive'
              }
            >
              {result}
            </div>
          )}

          <Card className="p-4 bg-amber-50 border-amber-200 flex gap-3">
            <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm text-amber-900 mb-1">Как загрузить PDF или Word?</div>
              <div className="text-sm text-amber-800/90 leading-relaxed">
                1. Откройте документ в браузере или Word<br />
                2. Нажмите Ctrl+A → Ctrl+C (выделить всё и скопировать)<br />
                3. Вставьте текст в поле выше через Ctrl+V<br />
                4. Укажите название и нажмите "Загрузить"
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
