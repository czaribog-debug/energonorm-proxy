/**
 * Скрипт массовой загрузки нормативных документов в Supabase.
 * Использование:
 *   node scripts/load-norms.js              — загрузить все документы из DOCS
 *   node scripts/load-norms.js --dry-run    — показать список без загрузки
 *   node scripts/load-norms.js --force      — перезаписать уже загруженные
 */

require('dotenv').config()
const https = require('https')
const http = require('http')
const pdf = require('pdf-parse')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

// ─── Список документов ────────────────────────────────────────────────────────
// url: прямая ссылка на PDF (проверь доступность перед запуском)
// source: короткое имя (используется для дедупликации)
// title: полное название документа
const DOCS = [
  {
    source: 'ПУЭ-7',
    title: 'Правила устройства электроустановок. 7-е издание',
    url: 'https://www.consultant.ru/document/cons_doc_LAW_98464/', // замени на прямой PDF
  },
  {
    source: 'ПТЭЭП',
    title: 'Правила технической эксплуатации электроустановок потребителей',
    url: '', // TODO: добавить ссылку
  },
  {
    source: 'ПОТЭУ',
    title: 'Правила охраны труда при эксплуатации электроустановок (Приказ Минтруда №903н)',
    url: '', // TODO: добавить ссылку
  },
  {
    source: 'СП 76.13330.2016',
    title: 'Электротехнические устройства',
    url: '', // TODO: minstroyrf.gov.ru
  },
  {
    source: 'СП 256.1325800.2016',
    title: 'Электроустановки жилых и общественных зданий. Правила проектирования и монтажа',
    url: '', // TODO: добавить ссылку
  },
  {
    source: 'ГОСТ 14254-2015',
    title: 'Степени защиты, обеспечиваемые оболочками (Код IP)',
    url: '', // TODO: gost.ru
  },
]
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000   // символов в чанке
const CHUNK_OVERLAP = 150 // перекрытие между чанками

const isDryRun = process.argv.includes('--dry-run')
const isForce  = process.argv.includes('--force')

// Скачать файл по URL → Buffer
function download(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} для ${url}`))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

// Разбить текст на чанки с перекрытием, стараясь резать по абзацам
function chunkText(text) {
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  const chunks = []
  let start = 0

  while (start < cleanText.length) {
    let end = start + CHUNK_SIZE

    if (end < cleanText.length) {
      // Ищем ближайший конец абзаца назад
      const paragraphBreak = cleanText.lastIndexOf('\n\n', end)
      if (paragraphBreak > start + CHUNK_SIZE / 2) {
        end = paragraphBreak
      } else {
        // Иначе режем по концу предложения
        const sentenceEnd = Math.max(
          cleanText.lastIndexOf('. ', end),
          cleanText.lastIndexOf('.\n', end)
        )
        if (sentenceEnd > start + CHUNK_SIZE / 2) {
          end = sentenceEnd + 1
        }
      }
    }

    const chunk = cleanText.slice(start, end).trim()
    if (chunk.length > 50) chunks.push(chunk)

    start = end - CHUNK_OVERLAP
  }

  return chunks
}

// Проверить — уже загружен ли источник
async function isAlreadyLoaded(source) {
  const { data } = await supabase
    .from('documents')
    .select('id')
    .eq('metadata->>source', source)
    .limit(1)
  return (data?.length ?? 0) > 0
}

// Удалить все чанки источника (для --force)
async function deleteSource(source) {
  await supabase.from('documents').delete().eq('metadata->>source', source)
}

// Загрузить чанки в Supabase
async function uploadChunks(chunks, meta) {
  let saved = 0
  for (const [i, content] of chunks.entries()) {
    const { error } = await supabase.from('documents').insert({
      content,
      metadata: { ...meta, chunk: i + 1, total: chunks.length },
    })
    if (!error) saved++
    else console.error(`  ✗ Ошибка чанка ${i + 1}:`, error.message)
  }
  return saved
}

// ─── Основной цикл ────────────────────────────────────────────────────────────
async function main() {
  const docs = DOCS.filter(d => d.url)

  if (docs.length === 0) {
    console.log('⚠️  Нет документов с заполненными URL. Добавь ссылки в DOCS.')
    console.log('\nДокументы без URL:')
    DOCS.filter(d => !d.url).forEach(d => console.log(`  • ${d.source} — ${d.title}`))
    return
  }

  console.log(`\nЗагрузка нормативов в Supabase`)
  console.log(`Документов с URL: ${docs.length} из ${DOCS.length}`)
  if (isDryRun) console.log('(режим dry-run — только показ, без записи)\n')
  console.log('─'.repeat(50))

  for (const doc of docs) {
    process.stdout.write(`\n📄 ${doc.source}  `)

    if (!isDryRun && !isForce) {
      const loaded = await isAlreadyLoaded(doc.source)
      if (loaded) {
        console.log('→ уже загружен, пропускаю (используй --force для перезаписи)')
        continue
      }
    }

    if (isDryRun) {
      console.log(`→ ${doc.url}`)
      continue
    }

    try {
      // Скачиваем
      process.stdout.write('скачиваю... ')
      const buf = await download(doc.url)

      // Парсим PDF
      process.stdout.write('парсю PDF... ')
      const parsed = await pdf(buf)
      const text = parsed.text
      console.log(`${text.length} символов, ${parsed.numpages} стр.`)

      // Режем на чанки
      const chunks = chunkText(text)
      console.log(`  → ${chunks.length} чанков`)

      // Удаляем старые при --force
      if (isForce) await deleteSource(doc.source)

      // Заливаем в Supabase
      const saved = await uploadChunks(chunks, { source: doc.source, title: doc.title })
      console.log(`  ✓ Загружено ${saved}/${chunks.length} чанков`)

    } catch (err) {
      console.log(`\n  ✗ Ошибка: ${err.message}`)
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log('Готово.')
}

main().catch(console.error)
