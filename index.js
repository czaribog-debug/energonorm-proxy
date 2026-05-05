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

// Поиск по базе знаний через полнотекстовый поиск
async function searchDocuments(query) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/search_documents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ query_text: query, match_count: 5 }),
      }
    );
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.log("Search error:", e.message);
    return [];
  }
}

// Основной эндпоинт чата
app.post("/v1/messages", async (req, res) => {
  try {
    const { messages, system, ...rest } = req.body;

    // Берём последний вопрос пользователя
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userText = Array.isArray(lastUserMsg?.content)
      ? lastUserMsg.content.find(c => c.type === "text")?.text
      : lastUserMsg?.content;

    let ragContext = "";

    if (userText) {
      const docs = await searchDocuments(userText);
      if (docs.length > 0) {
        ragContext = "\n\n---\nРЕЛЕВАНТНЫЕ ФРАГМЕНТЫ ИЗ БАЗЫ ЗНАНИЙ:\n\n" +
          docs.map(d => `[${d.metadata?.source || "Документ"}, ${d.metadata?.title || ""}]\n${d.content}`).join("\n\n---\n\n");
        console.log(`Найдено ${docs.length} релевантных фрагментов`);
      } else {
        console.log("Документы не найдены, отвечаю по общим знаниям");
      }
    }

    const enhancedSystem = system + ragContext;

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
