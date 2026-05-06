const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY;
const PROXY_URL = "https://api.proxyapi.ru/anthropic/v1";

app.get("/", (req, res) => {
  res.json({ status: "ok", docs: "ready" });
});

// ─── Поиск по базе знаний ────────────────────────────────────────────────────
async function searchDocuments(query) {
  try {
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

    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/documents?select=id,content,metadata&limit=3`, {
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

// ─── Поиск в интернете через Tavily ─────────────────────────────────────────
async function searchWeb(query) {
  if (!TAVILY_KEY) throw new Error("TAVILY_API_KEY не задан");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
  });
  const data = await res.json();
  if (!data.results) throw new Error(data.error || "Tavily не вернул результаты");

  const parts = [];
  if (data.answer) parts.push(`Краткий ответ: ${data.answer}\n`);
  data.results.forEach((r, i) => {
    parts.push(`[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`);
  });
  return parts.join("\n\n---\n\n");
}

// ─── Определение инструментов для Claude ────────────────────────────────────
const TOOLS = [
  {
    name: "web_search",
    description: "Поиск актуальной информации в интернете. Используй когда: вопрос выходит за пределы базы знаний по нормативам, нужны актуальные данные (последние редакции, новости, цены, события), пользователь явно просит найти что-то в интернете, или вопрос общий и не связан с российскими электротехническими нормативами.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос на русском языке. Формулируй конкретно и чётко.",
        },
      },
      required: ["query"],
    },
  },
];

// ─── Основной системный промпт ───────────────────────────────────────────────
const SYSTEM_BASE = `Ты — экспертный AI-ассистент сервиса «ЭнергоНорм» по нормативной базе электроэнергетики России. Аудитория: проектировщики, ГИПы, строители, проверяющие органы.

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
1. По нормативным вопросам — всегда отвечай по базе знаний, указывай конкретный документ и номер пункта
2. Если вопрос выходит за пределы нормативов — используй инструмент web_search для поиска в интернете
3. После поиска — чётко указывай источник (URL) и дату если известна
4. НИКОГДА не говори "у меня нет базы знаний" — это неправда

СТРУКТУРА ОТВЕТА (для нормативных вопросов):
✅ МОЖНО / ❌ НЕЛЬЗЯ / ⚠️ УСЛОВНО
[Краткий ответ]

📋 ОБОСНОВАНИЕ
[Техническое объяснение со ссылкой на пункт]

📄 НОРМАТИВНЫЕ ДОКУМЕНТЫ
[Список: • Документ, п. X.X.X]

💡 ПРАКТИЧЕСКАЯ РЕКОМЕНДАЦИЯ
[Что делать конкретно]`;

// ─── Цикл tool use ───────────────────────────────────────────────────────────
async function runWithTools(messages, systemPrompt) {
  let currentMessages = [...messages];
  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    const response = await fetch(`${PROXY_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANTHROPIC_KEY}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      }),
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message || "Ошибка Claude API");

    // Нет tool_use — возвращаем финальный ответ
    if (data.stop_reason !== "tool_use") {
      return data;
    }

    // Есть tool_use — выполняем инструменты
    const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
    const toolResults = [];

    for (const block of toolUseBlocks) {
      console.log(`🔍 web_search: "${block.input.query}"`);
      let result;
      try {
        result = await searchWeb(block.input.query);
      } catch (err) {
        result = `Ошибка поиска: ${err.message}`;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    // Добавляем ответ ассистента и результаты инструментов в историю
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: data.content },
      { role: "user", content: toolResults },
    ];
  }

  throw new Error("Превышено максимальное количество итераций tool use");
}

// ─── Основной эндпоинт чата ──────────────────────────────────────────────────
app.post("/v1/messages", async (req, res) => {
  try {
    const { messages, system } = req.body;

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userText = Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.find(c => c.type === "text")?.text
      : lastUserMsg?.content;

    // RAG: поиск по базе знаний
    let ragContext = "";
    if (userText) {
      const docs = await searchDocuments(userText);
      if (docs.length > 0) {
        ragContext = "\n\n========================================\n" +
          "ФРАГМЕНТЫ ИЗ ЗАГРУЖЕННОЙ БАЗЫ ЗНАНИЙ (используй их при ответе):\n\n" +
          docs.map((d, i) =>
            `[${i+1}] Источник: ${d.metadata?.source || "Документ"} — ${d.metadata?.title || ""}\n${d.content}`
          ).join("\n\n---\n\n") +
          "\n========================================\n";
        console.log(`📚 RAG: найдено ${docs.length} фрагментов для: ${userText?.slice(0, 50)}`);
      }
    }

    const systemPrompt = (system || SYSTEM_BASE) + ragContext;
    const data = await runWithTools(messages, systemPrompt);
    res.json(data);

  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Список источников в базе знаний ────────────────────────────────────────
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

// ─── Загрузка документов в базу ─────────────────────────────────────────────
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
