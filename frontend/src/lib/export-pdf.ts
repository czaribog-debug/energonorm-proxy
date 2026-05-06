import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface ExportArgs {
  question: string
  answerEl: HTMLElement
  filename?: string
}

// Раст-рендер DOM-узла → PDF (кириллица работает, т.к. это картинка).
// Создаём временный оффскрин-контейнер, чтобы корректно отрисовать вопрос + заголовок.
export async function exportAnswerToPdf({ question, answerEl, filename }: ExportArgs) {
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.left = '-10000px'
  wrapper.style.top = '0'
  wrapper.style.width = '720px'
  wrapper.style.padding = '40px'
  wrapper.style.background = '#ffffff'
  wrapper.style.color = '#0f172a'
  wrapper.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  wrapper.style.fontSize = '14px'
  wrapper.style.lineHeight = '1.55'

  const header = document.createElement('div')
  header.style.borderBottom = '2px solid #2563eb'
  header.style.paddingBottom = '12px'
  header.style.marginBottom = '20px'
  header.innerHTML = `
    <div style="font-size:18px;font-weight:600;color:#2563eb">ЭнергоНорм</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">AI-ассистент по нормативной базе электроэнергетики</div>
  `
  wrapper.appendChild(header)

  const qBlock = document.createElement('div')
  qBlock.style.marginBottom = '18px'
  qBlock.innerHTML = `
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Вопрос</div>
    <div style="font-size:14px;font-weight:500"></div>
  `
  ;(qBlock.lastElementChild as HTMLDivElement).textContent = question
  wrapper.appendChild(qBlock)

  const aLabel = document.createElement('div')
  aLabel.style.fontSize = '11px'
  aLabel.style.color = '#64748b'
  aLabel.style.textTransform = 'uppercase'
  aLabel.style.letterSpacing = '0.05em'
  aLabel.style.marginBottom = '8px'
  aLabel.textContent = 'Ответ'
  wrapper.appendChild(aLabel)

  const answerClone = answerEl.cloneNode(true) as HTMLElement
  answerClone.style.maxWidth = 'none'
  wrapper.appendChild(answerClone)

  const footer = document.createElement('div')
  footer.style.marginTop = '24px'
  footer.style.paddingTop = '12px'
  footer.style.borderTop = '1px solid #e2e8f0'
  footer.style.fontSize = '10px'
  footer.style.color = '#94a3b8'
  footer.textContent = `Сформировано: ${new Date().toLocaleString('ru-RU')} • Ответы носят справочный характер. Проверяйте актуальность нормативов.`
  wrapper.appendChild(footer)

  document.body.appendChild(wrapper)

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 28
    const usableW = pageW - margin * 2
    const imgH = (canvas.height * usableW) / canvas.width

    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, usableW, imgH)
    } else {
      // Многостраничный экспорт: режем длинную картинку по высоте страницы
      const pageContentH = pageH - margin * 2
      const ratio = usableW / canvas.width
      const sliceHpx = pageContentH / ratio

      let y = 0
      while (y < canvas.height) {
        const h = Math.min(sliceHpx, canvas.height - y)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = h
        const ctx = slice.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, slice.width, slice.height)
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
        const sliceData = slice.toDataURL('image/png')
        if (y > 0) pdf.addPage()
        pdf.addImage(sliceData, 'PNG', margin, margin, usableW, h * ratio)
        y += h
      }
    }

    const safeName = (filename || 'energonorm-otvet').replace(/[^\wЀ-ӿа-яА-Я\s.-]/g, '').slice(0, 80)
    pdf.save(`${safeName}.pdf`)
  } finally {
    document.body.removeChild(wrapper)
  }
}
