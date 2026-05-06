# ЭнергоНорм — Claude Code Context

## Что это за проект

**ЭнергоНорм** — AI-ассистент по нормативной базе электроэнергетики России для проектировщиков, ГИПов, строителей и проверяющих органов.

Проект состоит из:
- **energonorm-proxy** (этот репо) — Node.js/Express бэкенд-прокси
- **Фронтенд** — HTML/CSS/JS сайт (строился в чате, нужно перенести сюда)

## Архитектура

```
Пользователь → Фронтенд → energonorm-proxy → proxyapi.ru → Anthropic Claude
                                   ↕
                              Supabase (база знаний, RAG)
```

## Бэкенд (index.js)

### Эндпоинты
| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/` | Health check |
| POST | `/v1/messages` | Основной чат с RAG |
| POST | `/upload-document` | Загрузка документов в базу знаний |

### Переменные окружения (нужны в .env или Railway)
```
SUPABASE_URL=      # URL Supabase проекта
SUPABASE_KEY=      # anon/service key Supabase
ANTHROPIC_API_KEY= # ключ proxyapi.ru (не прямой Anthropic)
PORT=3001          # (опционально)
```

### RAG — поиск по базе знаний
- Суpabase таблица `documents` с колонками: `id`, `content`, `metadata`
- RPC-функция `search_documents(query_text, match_count)` — полнотекстовый поиск
- Fallback: если RPC не нашёл — берёт первые 3 документа

### База знаний (34 документа, 51 фрагмент)
ПУЭ, ПТЭЭП, ПОТЭУ, СП 76/77/48/256, СНиП 3.05.06-85, ФЗ-116, ГОСТ 14254/10434/16037/22687/13015/21208 и другие (~30 ГОСТов)

### Системный промпт
Роль: экспертный AI-ассистент по нормативной базе электроэнергетики.
Структура ответа: ✅/❌/⚠️ → краткий ответ → 📋 Обоснование → 📄 Нормативные документы → 💡 Практическая рекомендация

## Фронтенд (frontend/)

React + TypeScript + Vite. Всё в папке `frontend/`.

### Запуск

```bash
cd frontend
npm run dev    # http://localhost:5173 (с proxy на localhost:3001)
npm run build  # сборка в frontend/dist/
```

### Переменные окружения (frontend/.env.local)

```
VITE_PROXY_URL=   # пусто при локальной разработке (proxy через vite)
                  # https://energonorm-proxy.onrender.com — для прода
```

### Что есть в фронтенде
- **AuthScreen** — логин/регистрация (localStorage, не настоящий бэкенд)
- **Sidebar** — навигация + история чатов
- **ChatPage** — чат с загрузкой PDF (base64 → Anthropic vision)
- **DocsPage** — список нормативных документов в базе
- **UploadPage** — загрузка документов в Supabase через `/upload-document`
- **AboutPage** — о сервисе

### Важно
- URL прокси был захардкожен как `https://energonorm-proxy.onrender.com` — исправлено на `VITE_PROXY_URL`
- `vite.config.ts` настроен с proxy: `/v1` и `/upload-document` → `localhost:3001`
- `index.css` переписан (оригинал был от Vite-стартера и ломал layout)

## Деплой

- Бэкенд задеплоен на **Render** (URL: `https://energonorm-proxy.onrender.com`)
- Фронтенд: пока только GitHub, деплой отдельно (Vercel/Netlify/Render Static)
- Прокси для Anthropic API: `https://api.proxyapi.ru/anthropic/v1`

## Supabase

Таблица `documents`:
```sql
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT,
  metadata JSONB
);
```

RPC функция `search_documents`:
```sql
CREATE OR REPLACE FUNCTION search_documents(query_text TEXT, match_count INT)
RETURNS TABLE(id BIGINT, content TEXT, metadata JSONB) AS $$
  SELECT id, content, metadata
  FROM documents
  WHERE to_tsvector('russian', content) @@ plainto_tsquery('russian', query_text)
  LIMIT match_count;
$$ LANGUAGE SQL;
```

## Запуск локально

```bash
# Установить зависимости
npm install

# Создать .env
cp .env.example .env  # заполнить переменные

# Запустить
npm start  # порт 3001
```

## Запуск всего локально

```bash
# Терминал 1 — бэкенд
cp .env.example .env   # заполнить переменные
npm install
npm start              # :3001

# Терминал 2 — фронтенд
cd frontend
npm run dev            # :5173 (proxy → :3001)
```

## Статус проекта (май 2026)

- [x] Прокси с RAG работает на Render
- [x] База знаний загружена (34 документа)
- [x] Фронтенд добавлен в репо (`frontend/`)
- [x] `.env.example` созданы (бэкенд и фронтенд)
- [x] Vite proxy настроен для локальной разработки
- [ ] Улучшить RAG: векторный поиск (pgvector)
- [ ] Авторизация на настоящем бэкенде (сейчас localStorage)
- [ ] Деплой фронтенда (Vercel/Netlify)
