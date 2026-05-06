import * as pdfjs from 'pdfjs-dist'
// Vite сам подставит правильный URL воркера благодаря ?url
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

export async function extractPdfText(file: File): Promise<string> {
  const arrayBuf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuf }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) pages.push(text)
  }
  return pages.join('\n\n')
}
