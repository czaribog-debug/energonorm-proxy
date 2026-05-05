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
  res.json({ status: "ok" });
});

// Получить эмбеддинг текста через OpenAI-совместимый эндпоинт ProxyAPI
async function getEmbedding(text) {
  const res = await fetch("https://api.proxyapi.ru/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANTHROPIC_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  const data = await res.json();
  return data.data?.[0]?.embedding;
}

// Поиск похожих документов в Supabase
async function searchDocuments(embedding) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
    }),
  });
  return await res.json();
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

    // Ищем в базе знаний если есть вопрос
    if (userText && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const embedding = await getEmbedding(userText);
        if (embedding) {
          const docs = await searchDocuments(embedding);
          if (Array.isArray(docs) && docs.length > 0) {
            ragContext = "\n\nРЕЛЕВАНТНЫЕ ФРАГМЕНТЫ ИЗ БАЗЫ ЗНАНИЙ:\n" +
              docs.map(d => `[${d.metadata?.source || "Документ"}]\n${d.content}`).join("\n\n---\n\n");
          }
        }
      } catch (e) {
        console.log("RAG search failed:", e.message);
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
    console.log("Response status:", response.status);
    res.json(data);
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Эндпоинт для загрузки документов в базу знаний
app.post("/upload-document", async (req, res) => {
  try {
    const { content, metadata } = req.body;

    // Разбиваем текст на чанки по 1000 символов
    const chunks = [];
    for (let i = 0; i < content.length; i += 800) {
      chunks.push(content.slice(i, i + 800));
    }

    let saved = 0;
    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk);
      if (!embedding) continue;

      await fetch(`${SUPABASE_URL}/rest/v1/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ content: chunk, metadata, embedding }),
      });
      saved++;
    }

    res.json({ success: true, chunks: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3001);
