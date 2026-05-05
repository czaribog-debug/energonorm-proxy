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

    const SYSTEM = `Ты — экспертный AI-ассистент сервиса «ЭнергоНорм» по нормативной базе электроэнергетики России.

ВАЖНО: У тебя ЕСТЬ загруженная база знаний с реальными нормативными документами (ПУЭ 7, ГОСТы, СП, СНиПы, ПТЭЭП, ПОТЭУ и другие). Эти документы переданы тебе в разделе "ФРАГМЕНТЫ ИЗ ЗАГРУЖЕННОЙ БАЗЫ ЗНАНИЙ" ниже.

Когда отвечаешь на вопросы:
1. ВСЕГДА используй фрагменты из базы знаний если они переданы
2. Ссылайся на конкретные документы и пункты из переданных фрагментов
3. Если фрагменты переданы — НЕ говори что у тебя нет базы знаний
4. Если по вопросу нет фрагментов — отвечай по своим знаниям ПУЭ, ГОСТов, СП с пометкой что это общие знания

Структура ответа:
✅ МОЖНО / ❌ НЕЛЬЗЯ / ⚠️ УСЛОВНО
[Краткий ответ]

📋 ОБОСНОВАНИЕ
[Объяснение со ссылкой на конкретный пункт]

📄 НОРМАТИВНЫЕ ДОКУМЕНТЫ
[Конкретные документы с номерами пунктов из базы знаний]

💡 ПРАКТИЧЕСКАЯ РЕКОМЕНДАЦИЯ
[Что делать на практике]`;

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
