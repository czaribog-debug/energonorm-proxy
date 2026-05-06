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

// Порог: если RAG нашёл меньше этого числа фрагментов — дополняем веб-поиском
const RAG_MIN_THRESHOLD = 2;

// Объяснительный вопрос — не требует вердикта "можно/нельзя"
function isExplanatoryQuestion(text) {
  const t = text.trim().toLowerCase();
  // Стартует с объяснительного слова
  if (/^(почему|зачем|как(\s|ие|ой|ая|ие)|что\s|чем\s|расскажи|объясни|опиши|поясни|для чего|в чём разница|в чем разница)/i.test(t)) return true;
  // Содержит явный признак объяснения
  if (/\b(почему|зачем|объясни|расскажи|поясни|в чём смысл|в чем смысл)\b/i.test(t) &&
      !/\b(можно ли|допустимо ли|разрешено ли|правильно ли)\b/i.test(t)) return true;
  return false;
}

// Срезает первую строку с плашкой ✅/❌/⚠️/⛔ + следующий короткий абзац-резюме
function stripVerdict(text) {
  const lines = text.split("\n");
  // Ищем первую строку с эмодзи-вердиктом
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length) return text;

  const firstLine = lines[i].trim();
  const hasVerdict = /^[*_\s]*[✅❌⚠️⛔]/u.test(firstLine);
  if (!hasVerdict) return text;

  // Удаляем строку с вердиктом и возможный следующий абзац-резюме до пустой строки или раздела
  const result = [...lines.slice(0, i)];
  i++;
  while (i < lines.length && lines[i].trim() !== "" && !/^[📋📄💡]/u.test(lines[i].trim())) i++;
  while (i < lines.length && lines[i].trim() === "") i++;
  result.push(...lines.slice(i));
  return result.join("\n").trim();
}

// ─── Основной системный промпт ───────────────────────────────────────────────
const SYSTEM_BASE = `Ты — экспертный AI-ассистент сервиса «ЭнергоНорм» по нормативной базе электроэнергетики России. Аудитория: проектировщики, ГИПы, строители, проверяющие органы.

═══════════════════════════════════════
ТВОЯ ЗАГРУЖЕННАЯ БАЗА ЗНАНИЙ (полные тексты, ~3400 фрагментов из 11 документов):
• ПУЭ-7 — Правила устройства электроустановок, 7-е издание (полностью)
• ПТЭЭП-2022 — Правила технической эксплуатации электроустановок потребителей электрической энергии (Приказ Минэнерго №811 от 12.08.2022)
• ПОТЭУ — Правила по охране труда при эксплуатации электроустановок (Приказ Минтруда №903н от 15.12.2020)
• СП 76.13330.2016 — Электротехнические устройства (актуализированная редакция СНиП 3.05.06-85)
• СП 77.13330.2016 — Системы автоматизации
• СП 48.13330.2019 — Организация строительства
• СП 256.1325800.2016 — Электроустановки жилых и общественных зданий. Правила проектирования и монтажа
• ФЗ-116 — Федеральный закон от 21.07.1997 №116-ФЗ "О промышленной безопасности опасных производственных объектов"
• ГОСТ 14254-2015 — Степени защиты, обеспечиваемые оболочками (Код IP)
• ГОСТ Р 50571.3-2009 — Электроустановки низковольтные. Защита от поражения электрическим током
• ГОСТ Р 50571.5.54-2013 — Электроустановки низковольтные. Заземляющие устройства и проводники уравнивания потенциалов
═══════════════════════════════════════

ПРАВИЛА ОТВЕТОВ:
1. По нормативным вопросам — всегда отвечай по базе знаний, указывай конкретный документ и номер пункта
2. Если в контексте есть раздел "ДАННЫЕ ИЗ ИНТЕРНЕТА" — используй их как дополнение к нормативам, сравнивай и синтезируй
3. При использовании интернет-источников — указывай URL и дату
4. Нормативный документ всегда приоритетнее интернет-источника при противоречии
5. НИКОГДА не говори "у меня нет базы знаний" — это неправда

КОГДА ИСПОЛЬЗОВАТЬ ВЕРДИКТ:
Вердикт (✅/❌/⚠️/⛔) ставь ТОЛЬКО если пользователь спрашивает "можно ли", "допустимо ли", "разрешено ли", "соответствует ли нормативам", "правильно ли".
НЕ ставь вердикт для вопросов "почему", "как", "что такое", "объясни", "расскажи" — в этих случаях просто отвечай без плашки.

ВЫБОР ВЕРДИКТА — строго:
✅ МОЖНО — решение явно допустимо нормативами, без существенных оговорок
❌ НЕЛЬЗЯ — прямо запрещено нормативами
⚠️ УСЛОВНО — допустимо только при выполнении определённых условий
⛔ НЕ СООТВЕТСТВУЕТ — технически возможно, но не отвечает нормативным требованиям

ЗАПРЕЩЕНО:
- Ставить ✅ МОЖНО если в тексте ответа объясняешь ограничения или почему это не работает
- Ставить ✅ МОЖНО если пишешь "категорически", "недопустимо", "не обеспечит", "не соответствует"
- При сомнении между ✅ и ⚠️ — всегда выбирай ⚠️ УСЛОВНО

СТРУКТУРА ОТВЕТА (когда есть вердикт):
[ВЕРДИКТ]
[Краткий однозначный ответ]

📋 ОБОСНОВАНИЕ
[Техническое объяснение со ссылкой на пункт]

📄 НОРМАТИВНЫЕ ДОКУМЕНТЫ
[Список: • Документ, п. X.X.X]

💡 ПРАКТИЧЕСКАЯ РЕКОМЕНДАЦИЯ
[Что делать конкретно]

СТРУКТУРА ОТВЕТА (объяснительные вопросы — без вердикта):
[Прямой ответ]

📋 ОБОСНОВАНИЕ
[Техническое объяснение]

📄 НОРМАТИВНЫЕ ДОКУМЕНТЫ
[Список источников]

💡 ПРАКТИЧЕСКАЯ РЕКОМЕНДАЦИЯ
[Вывод]`;

// ─── Основной эндпоинт чата ──────────────────────────────────────────────────
app.post("/v1/messages", async (req, res) => {
  try {
    const { messages, system } = req.body;

    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userText = Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.find(c => c.type === "text")?.text
      : lastUserMsg?.content;

    let ragContext = "";
    let webContext = "";

    if (userText) {
      // Шаг 1: RAG — поиск по нормативной базе
      const docs = await searchDocuments(userText);
      if (docs.length > 0) {
        ragContext = "\n\n========================================\n" +
          "ФРАГМЕНТЫ ИЗ НОРМАТИВНОЙ БАЗЫ ЗНАНИЙ:\n\n" +
          docs.map((d, i) =>
            `[${i+1}] ${d.metadata?.source || "Документ"} — ${d.metadata?.title || ""}\n${d.content}`
          ).join("\n\n---\n\n") +
          "\n========================================\n";
        console.log(`📚 RAG: ${docs.length} фрагментов для: ${userText.slice(0, 50)}`);
      }

      // Шаг 2: если нормативной базы недостаточно — дополняем веб-поиском
      if (docs.length < RAG_MIN_THRESHOLD && TAVILY_KEY) {
        try {
          console.log(`🔍 Веб-поиск: "${userText.slice(0, 60)}"`);
          const webResults = await searchWeb(userText + " электроэнергетика нормативы Россия");
          webContext = "\n\n========================================\n" +
            "ДАННЫЕ ИЗ ИНТЕРНЕТА (используй как дополнение, сравнивай с нормативами):\n\n" +
            webResults +
            "\n========================================\n";
        } catch (e) {
          console.log("Веб-поиск не удался:", e.message);
        }
      }
    }

    const systemPrompt = (system || SYSTEM_BASE) + ragContext + webContext;

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
        temperature: 0.3,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "Ошибка Claude API");

    // Post-processing: для объяснительных вопросов вырезаем плашку вердикта
    if (userText && isExplanatoryQuestion(userText) && Array.isArray(data.content)) {
      data.content = data.content.map(b => {
        if (b.type === "text" && typeof b.text === "string") {
          return { ...b, text: stripVerdict(b.text) };
        }
        return b;
      });
    }

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
