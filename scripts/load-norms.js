/**
 * Скрипт массовой загрузки нормативных документов в Supabase.
 *
 * Вариант Б (URL):
 *   node scripts/load-norms.js              — загрузить все из списка DOCS (URL)
 *   node scripts/load-norms.js --dry-run    — показать список без загрузки
 *   node scripts/load-norms.js --force      — перезаписать уже загруженные
 *   node scripts/load-norms.js --cleanup    — удалить огрызки и устаревшие
 *
 * Вариант А (локальные файлы):
 *   node scripts/load-norms.js --local                        — загрузить PDF из scripts/docs/
 *   node scripts/load-norms.js --local --dir ./my-pdfs        — из другой папки
 *   node scripts/load-norms.js --local --force                — перезаписать
 *   node scripts/load-norms.js --local --dry-run              — только показать файлы
 *
 * Метаданные (имя, название) для локальных файлов:
 *   Создай файл scripts/docs-local.json:
 *   { "ПУЭ-7.pdf": { "source": "ПУЭ-7", "title": "Правила устройства электроустановок" }, ... }
 *   Если файл не найден — source = имя файла без расширения, title = то же самое.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { PDFParse } = require('pdf-parse')
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
  // Уже загруженные
  {
    source: 'ПУЭ-7',
    title: 'Правила устройства электроустановок. 7-е издание',
    url: 'https://www.ruscable.ru/info/pue/pue7.pdf',
  },
  {
    source: 'ПТЭЭП-2022',
    title: 'Правила технической эксплуатации электроустановок потребителей электрической энергии (Приказ Минэнерго №811 от 12.08.2022)',
    url: 'https://www.volt-spb.ru/media/docs/ntd/zazemlenie/pravila-tehnicheskoj-ekspluatacii-elektroustanovok-potrebitelej-elektricheskoj-energii-pteepee.pdf',
  },
  {
    source: 'СП 76.13330.2016',
    title: 'Электротехнические устройства. Актуализированная редакция СНиП 3.05.06-85',
    url: 'https://files.stroyinf.ru/Data2/1/4293747/4293747637.pdf',
  },
  {
    source: 'СП 256.1325800.2016',
    title: 'Электроустановки жилых и общественных зданий. Правила проектирования и монтажа',
    url: 'https://meganorm.ru/Data2/1/4293751/4293751598.pdf',
  },
  {
    source: 'ГОСТ 14254-2015',
    title: 'Степени защиты, обеспечиваемые оболочками (Код IP)',
    url: 'https://meganorm.ru/Data2/1/4293754/4293754313.pdf',
  },
  // Новые приоритетные
  {
    source: 'ПОТЭУ',
    title: 'Правила по охране труда при эксплуатации электроустановок (Приказ Минтруда №903н от 15.12.2020)',
    url: 'https://www.serconsrus.ru/app/uploads/2024/04/pravila-po-ohrane-truda.pdf',
  },
  {
    source: 'ФЗ-116',
    title: 'Федеральный закон от 21.07.1997 №116-ФЗ "О промышленной безопасности опасных производственных объектов"',
    url: 'https://artbur.ru/upload/o_prom_bezopasnosti.pdf',
  },
  {
    source: 'СП 48.13330.2019',
    title: 'Организация строительства. Актуализированная редакция СНиП 12-01-2004',
    url: 'https://files.stroyinf.ru/Data2/1/4293722/4293722445.pdf',
  },
  {
    source: 'СП 77.13330.2016',
    title: 'Системы автоматизации. Актуализированная редакция СНиП 3.05.07-85',
    url: 'https://files.stroyinf.ru/Data2/1/4293747/4293747669.pdf',
  },
  {
    source: 'ГОСТ Р 50571.5.54-2013',
    title: 'Электроустановки низковольтные. Часть 5-54. Заземляющие устройства, защитные проводники и проводники уравнивания потенциалов',
    url: 'https://files.stroyinf.ru/Data2/1/4293775/4293775104.pdf',
  },
  {
    source: 'ГОСТ Р 50571.3-2009',
    title: 'Электроустановки низковольтные. Часть 4-41. Защита от поражения электрическим током',
    url: 'https://meganorm.ru/Data2/1/4293725/4293725420.pdf',
  },
]
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 1000   // символов в чанке
const CHUNK_OVERLAP = 150 // перекрытие между чанками

const isDryRun  = process.argv.includes('--dry-run')
const isForce   = process.argv.includes('--force')
const isCleanup = process.argv.includes('--cleanup')
const isLocal   = process.argv.includes('--local')

// --dir ./path/to/folder
const dirArgIdx = process.argv.indexOf('--dir')
const localDir = dirArgIdx !== -1
  ? path.resolve(process.argv[dirArgIdx + 1])
  : path.resolve(__dirname, 'docs')

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

// Загрузить чанки в Supabase батчами по 50
async function uploadChunks(chunks, meta) {
  const BATCH = 50
  let saved = 0
  const rows = chunks.map((content, i) => ({
    content,
    metadata: { ...meta, chunk: i + 1, total: chunks.length },
  }))
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('documents').insert(batch)
    if (!error) saved += batch.length
    else console.error(`  ✗ Ошибка батча ${Math.floor(i / BATCH) + 1}:`, error.message)
  }
  return saved
}

const STUB_THRESHOLD = 5  // источники с < 5 чанков считаем огрызками

// Удалить: (1) источники не из DOCS; (2) источники из DOCS с < STUB_THRESHOLD чанков
async function cleanupOrphans() {
  const validSources = new Set(DOCS.map(d => d.source))
  // Используем существующий RPC, который точно агрегирует все строки
  const { data, error } = await supabase.rpc('list_sources')
  if (error) throw error

  const toDelete = []
  for (const { source: src, chunks } of data || []) {
    const n = Number(chunks)
    if (!validSources.has(src)) {
      toDelete.push({ src, n, reason: 'не в DOCS' })
    } else if (n < STUB_THRESHOLD) {
      toDelete.push({ src, n, reason: 'огрызок' })
    }
  }

  if (toDelete.length === 0) {
    console.log('  Огрызков нет.')
    return
  }
  console.log(`  Удаляю ${toDelete.length} источника(ов):`)
  for (const { src, n, reason } of toDelete) {
    const { error: delErr } = await supabase
      .from('documents')
      .delete()
      .eq('metadata->>source', src)
    if (delErr) console.error(`    ✗ ${src}: ${delErr.message}`)
    else console.log(`    ✓ ${src} (${n} чанков, ${reason})`)
  }
}

// ─── Загрузка локальных PDF ───────────────────────────────────────────────────
async function loadLocalDocs() {
  if (!fs.existsSync(localDir)) {
    console.log(`\n⚠️  Папка не найдена: ${localDir}`)
    console.log('Создай её и положи туда PDF-файлы:')
    console.log(`  mkdir -p "${localDir}"`)
    return
  }

  // Опциональный маппинг: filename → { source, title }
  const metaPath = path.join(__dirname, 'docs-local.json')
  let metaMap = {}
  if (fs.existsSync(metaPath)) {
    try {
      metaMap = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      console.log(`  Метаданные загружены из docs-local.json (${Object.keys(metaMap).length} записей)`)
    } catch (e) {
      console.warn(`  ⚠️ Не удалось разобрать docs-local.json: ${e.message}`)
    }
  }

  const files = fs.readdirSync(localDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort()

  if (files.length === 0) {
    console.log(`\n⚠️  В папке ${localDir} нет PDF-файлов.`)
    return
  }

  console.log(`\nЗагрузка локальных PDF из: ${localDir}`)
  console.log(`Найдено файлов: ${files.length}`)
  if (isDryRun) console.log('(режим dry-run — только показ, без записи)\n')
  console.log('─'.repeat(50))

  for (const filename of files) {
    const nameWithoutExt = path.basename(filename, '.pdf')
    const meta = metaMap[filename] || { source: nameWithoutExt, title: nameWithoutExt }
    const { source, title } = meta

    process.stdout.write(`\n📄 ${source}  `)

    if (!isDryRun && !isForce) {
      const loaded = await isAlreadyLoaded(source)
      if (loaded) {
        console.log('→ уже загружен, пропускаю (--force для перезаписи)')
        continue
      }
    }

    if (isDryRun) {
      console.log(`→ ${filename}`)
      console.log(`   source: "${source}", title: "${title}"`)
      continue
    }

    try {
      const filePath = path.join(localDir, filename)
      process.stdout.write('читаю файл... ')
      const buf = fs.readFileSync(filePath)

      process.stdout.write('парсю PDF... ')
      const parser = new PDFParse({ data: buf })
      const parsed = await parser.getText()
      const text = parsed.text || ''
      console.log(`${text.length} символов`)

      if (text.length < 200) {
        console.log(`  ⚠️ Слишком мало текста — возможно, PDF содержит сканы (изображения)`)
        continue
      }

      const chunks = chunkText(text)
      console.log(`  → ${chunks.length} чанков`)

      if (isForce) await deleteSource(source)

      const saved = await uploadChunks(chunks, { source, title })
      console.log(`  ✓ Загружено ${saved}/${chunks.length} чанков`)

    } catch (err) {
      console.log(`\n  ✗ Ошибка: ${err.message}`)
    }
  }

  console.log('\n' + '─'.repeat(50))
  console.log('Готово.')
}

// ─── Основной цикл ────────────────────────────────────────────────────────────
async function main() {
  if (isLocal) {
    await loadLocalDocs()
    return
  }

  if (isCleanup) {
    console.log('\n🧹 Очистка огрызков (всё что не в DOCS)')
    console.log('─'.repeat(50))
    await cleanupOrphans()
    console.log('─'.repeat(50))
  }

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
      const parser = new PDFParse({ data: buf })
      const parsed = await parser.getText()
      const text = parsed.text || ''
      console.log(`${text.length} символов, ${parsed.total ?? parsed.pages?.length ?? '?'} стр.`)

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
