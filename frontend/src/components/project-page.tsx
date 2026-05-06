import { useEffect, useRef, useState } from 'react'
import { Folder, FileText, Upload, Trash2, Loader2, Plus, AlertCircle, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { addProjectDocument, deleteProjectDocument, loadProjectDocuments } from '@/lib/projects'
import { extractPdfText } from '@/lib/extract-pdf-text'
import type { Project, ProjectDocument } from '@/lib/types'

interface Props {
  project: Project
  chatCount: number
  onNewChat: () => void
}

export function ProjectPage({ project, chatCount, onNewChat }: Props) {
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadProjectDocuments(project.id).then((d) => { if (!cancelled) { setDocs(d); setLoading(false) } })
    return () => { cancelled = true }
  }, [project.id])

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        setError(`Файл "${file.name}" — не PDF, пропущен`)
        continue
      }
      try {
        setUploading(file.name)
        const text = await extractPdfText(file)
        if (text.length < 100) {
          setError(`"${file.name}" — слишком мало текста (возможно, скан без OCR)`)
          setUploading(null)
          continue
        }
        const doc = await addProjectDocument({
          projectId: project.id,
          filename: file.name,
          content: text,
          fileSize: file.size,
        })
        if (doc) setDocs((prev) => [...prev, doc])
      } catch (e: any) {
        setError(`Ошибка при обработке "${file.name}": ${e?.message ?? e}`)
      } finally {
        setUploading(null)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeDoc = async (id: string) => {
    await deleteProjectDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="overflow-y-auto h-full p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Folder className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{project.name}</h2>
            <div className="text-xs text-muted-foreground">
              {chatCount} {pluralRu(chatCount, ['чат', 'чата', 'чатов'])}
              {' · '}
              {docs.length} {pluralRu(docs.length, ['документ', 'документа', 'документов'])} в контексте
            </div>
          </div>
          <Button onClick={onNewChat} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Новый чат
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mt-3 mb-6">
          Документы, загруженные сюда, автоматически прикладываются к каждому чату внутри проекта.
          Удобно для рабочих ТУ, заданий на проектирование, спецификаций объекта.
        </p>

        <Card className="p-6 border-dashed mb-6">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="font-medium text-sm">Добавить PDF в проект</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Только текстовые PDF (сканы без OCR не подойдут)
              </div>
            </div>
            <Button onClick={() => fileRef.current?.click()} disabled={!!uploading} size="sm">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Обрабатываю «{uploading}»…
                </>
              ) : (
                'Выбрать файлы'
              )}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="p-3 bg-amber-50 border-amber-200 flex gap-2 mb-4 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </Card>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загружаю документы…
          </div>
        )}

        {!loading && docs.length > 0 && (
          <div className="border rounded-xl overflow-hidden divide-y">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 group">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{d.filename}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatSize(d.fileSize)} · {d.contentLength?.toLocaleString('ru-RU') ?? 0} символов
                  </div>
                </div>
                <button
                  onClick={() => removeDoc(d.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="Удалить документ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && docs.length === 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200 flex gap-3 mt-4">
            <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900/90 leading-relaxed">
              Пока в проекте нет документов. Загрузите ТУ, чертежи или спецификации — AI будет
              учитывать их в каждом чате этого проекта вместе с базой знаний по нормативам.
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return forms[0]
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1]
  return forms[2]
}
