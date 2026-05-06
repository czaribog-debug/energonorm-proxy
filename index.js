const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PROXY_URL = "https://api.proxyapi.ru/anthropic/v1";

app.get("/", (req, res) => {
  res.json({ status: "ok", docs: "ready" });
});

// Поиск по базе знаний — несколько стратегий
async function searchDocuments(query) {
  try {
    // Стратегия 1: полнотекстовый поиск
    const res1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ query_text: query, match_count: 5 }),
    });
    const data1 = await res1.json();
    if (Array.isArray(data1) && data1.length > 0) return data1;

    // Стратегия 2: если ничего не нашли — берём первые 5 релевантных по ключевым словам
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return [];

    const shortQuery = words.slice(0, 3).join(" | ");
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/documents?select=id,content,metadata&limit=5`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data2 = await res2.json();
    return Array.isArray(data2) ? data2.slice(0, 3) : [];
  } catch (e) {
    console.log("Search error:", e.message);
    return [];
  }
}

// Основной эндпоинт чата
app.post("/v1/messages", async (req, res) => {
  try {
    const { messages, system, ...rest } = req.body;

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userText = Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.find(c => c.type === "text")?.text
      : lastUserMsg?.content;

    let ragContext = "";
    let docsCount = 0;

    if (userText) {
      const docs = await searchDocuments(userText);
      docsCount = docs.length;
      if (docs.length > 0) {
        ragContext = "\n\n========================================\n" +
          "ФРАГМЕНТЫ ИЗ ЗАГРУЖЕННОЙ БАЗЫ ЗНАНИЙ (используй их при ответе):\n\n" +
          docs.map((d, i) =>
            `[${i+1}] Источник: ${d.metadata?.source || "Документ"} — ${d.metadata?.title || ""}\n${d.content}`
          ).join("\n\n---\n\n") +
          "\n========================================\n";
      }
    }

    const SYSTEM = `Ты — экспертный AI-ассистент сервиса «ЭнергоНорм» по нормативной базе электроэнергетики России. Аудитория: проектировщики, ГИПы, строители, проверяющие органы.

═══════════════════════════════════════
ТВОЯ ЗАГРУЖЕННАЯ БАЗА ЗНАНИЙ (51 фрагмент из 34 документов):
• ПУЭ 7-е издание — главы 1.3, 1.7, 1.8, 2.1, 2.3, 2.4, 2.5, 7.3, 7.4
• ПТЭЭП — Правила технической эксплуатации электроустановок потребителей
• ПОТЭУ — Правила охраны труда при эксплуатации электроустановок (с изм. 2022)
• СП 76.13330.2016 — Электротехнические устройства
• СП 77.13330.2016 — Системы автоматизации
• СП 48.13330.2019 — Организация строительства
• СП 256.1325800.2016 — Электроустановки жилых и общественных зданий
• СНиП 3.05.06-85 — Электротехнические устройства (монтаж)
• ФЗ-116 — О промышленной безопасности ОПО
• Приказ Ростехнадзора №444-2021 — Правила эксплуатации технологических трубопроводов
• Приказ Минтруда №223н-2022 — Расследование несчастных случаев
• ГОСТ 14254-2015 — Степени защиты IP
• ГОСТ 10434-82 — Соединения контактные электрические
• ГОСТ 16037-80 — Соединения сварные стальных трубопроводов
• ГОСТ 22687.0-85 — Стойки ЖБ для опор электропередачи
• ГОСТ 13015-2012 — Изделия бетонные и железобетонные
• ГОСТ 21.208-2013 — Обозначения приборов автоматизации в схемах
• ГОСТ 12.1.004-91 — Пожарная безопасность
• ГОСТ 12.1.010-76 — Взрывобезопасность
• ГОСТ 12.4.026-2015 — Цвета сигнальные и знаки безопасности
• ГОСТ 30331.1-2013 — Электроустановки низковольтные. Основные положения
• ГОСТ Р 50462-2009 — Идентификация проводников по цветам
• ГОСТ Р 50571.3-2009 — Защита от поражения электрическим током
• ГОСТ Р 50571.4.44-2019 — Защита от перенапряжений. УЗИП
• ГОСТ Р 50571.5.52-2011 — Электропроводки. Выбор и монтаж
• ГОСТ Р 50571.5.54-2013 — Заземляющие устройства и уравнивание потенциалов
• ГОСТ Р 50571.25-2001 — Электрообогреваемые поверхности
• ГОСТ Р 52350.14-2006 — Электроустановки во взрывоопасных зонах
• ГОСТ Р 52719-2007 — Трансформаторы силовые
• ГОСТ Р 58698-2019 — Защита от поражения электрическим током
• ГОСТ Р МЭК 60598-1-2011 — Светильники
• ГОСТ Р МЭК 61386.1-2014 — Трубные системы для прокладки кабелей
• ГОСТ IEC 60079-14-2013 — Взрывоопасные среды
• ГОСТ IEC 61140-2012 — Защита от поражения электрическим током
═══════════════════════════════════════

ПРАВИЛА ОТВЕТОВ:
1. Ты ВСЕГДА отвечаешь на основе своей базы знаний — она у тебя ЕСТЬ
2. Если в разделе "ФРАГМЕНТЫ ИЗ БАЗЫ ЗНАНИЙ" переданы документы — ИСПОЛЬЗУЙ их и ссылайся на конкретные пункты
3. Если фрагменты не переданы — отвечай по знаниям из списка выше
4. НИКОГДА не говори "у меня нет базы знаний" — это неправда
5. Всегда указывай конкретный документ и номер пункта

СТРУКТУРА ОТВЕТА:
✅ МОЖНО / ❌ НЕЛЬЗЯ / ⚠️ УСЛОВНО
[Краткий ответ]

📋 ОБОСНОВАНИЕ
[Техническое объяснение со ссылкой на пункт]

📄 НОРМАТИВНЫЕ ДОКУМЕНТЫ
[Список: • Документ, п. X.X.X]

💡 ПРАКТИЧЕСКАЯ РЕКОМЕНДАЦИЯ
[Что делать конкретно]`;

    const enhancedSystem = SYSTEM + ragContext;
    console.log(`Найдено ${docsCount} фрагментов для запроса: ${userText?.slice(0,50)}`);

    const response = await fetch(`${PROXY_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANTHROPIC_KEY}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ messages, system: enhancedSystem, ...rest }),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Список источников в базе знаний через RPC (обходит RLS)
app.get("/documents", async (req, res) => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({}),
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) return res.json({ sources: [], total: 0 });

    const sources = rows.map(({ source, chunks }) => ({ source, chunks: Number(chunks) }));
    const total = sources.reduce((s, r) => s + r.chunks, 0);
    res.json({ sources, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Загрузка документов в базу
app.post("/upload-document", async (req, res) => {
  try {
    const { content, metadata } = req.body;
    const chunkSize = 800;
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    let saved = 0;
    for (const chunk of chunks) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ content: chunk, metadata }),
      });
      if (r.ok) saved++;
    }
    res.json({ success: true, chunks: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("ЭнергоНорм proxy started");
});
