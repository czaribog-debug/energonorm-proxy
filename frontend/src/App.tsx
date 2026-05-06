import { useEffect, useState } from 'react'
import { AuthScreen } from '@/components/auth-screen'
import { Sidebar } from '@/components/sidebar'
import { ChatPage } from '@/components/chat-page'
import { DocsPage } from '@/components/docs-page'
import { UploadPage } from '@/components/upload-page'
import { AboutPage } from '@/components/about-page'
import { clearSession, getChats, getSession, saveChats } from '@/lib/storage'
import { PROXY_URL, SYSTEM_PROMPT } from '@/lib/constants'
import type { Chat, Message, Page, Session, UploadedDoc } from '@/lib/types'

export default function App() {
  const [user, setUser] = useState<Session | null>(() => getSession())
  const [page, setPage] = useState<Page>('chat')
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])

  useEffect(() => {
    if (user) setChats(getChats(user.email))
  }, [user])

  const persistChats = (email: string, updated: Chat[]) => {
    setChats(updated)
    saveChats(email, updated)
  }

  const newChat = () => {
    setCurrentChatId(null)
    setMessages([])
    setInput('')
    setUploadedDocs([])
    setPage('chat')
  }

  const selectChat = (id: string) => {
    const c = chats.find((c) => c.id === id)
    if (c) {
      setCurrentChatId(id)
      setMessages(c.messages)
      setUploadedDocs([])
    }
  }

  const send = async (q?: string) => {
    const text = (q || input).trim()
    if (!text || loading) return
    setInput('')
    setPage('chat')

    const userMsg: Message = { role: 'user', content: text }
    const loadingMsg: Message = { role: 'assistant', content: '', loading: true }
    setMessages([...messages, userMsg, loadingMsg])
    setLoading(true)

    try {
      const userContent: Array<Record<string, unknown>> = []
      for (const doc of uploadedDocs) {
        userContent.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: doc.b64 },
          title: doc.name,
        })
      }
      userContent.push({ type: 'text', text })

      const hist = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`${PROXY_URL}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: uploadedDocs.length > 0
            ? SYSTEM_PROMPT + '\n\nПользователь загрузил документы. Отвечай СТРОГО по ним с указанием файла, раздела и пункта.'
            : SYSTEM_PROMPT,
          messages: [...hist, { role: 'user', content: userContent }],
        }),
      })
      const data = await res.json()
      const answer = data.content?.map((b: { text?: string }) => b.text || '').join('') || 'Не удалось получить ответ.'
      const finalMsgs: Message[] = [...messages, userMsg, { role: 'assistant', content: answer }]
      setMessages(finalMsgs)

      if (user) {
        const chatId = currentChatId || Date.now().toString()
        const title = text.slice(0, 45) + (text.length > 45 ? '…' : '')
        const updated = currentChatId
          ? chats.map((c) => (c.id === chatId ? { ...c, messages: finalMsgs } : c))
          : [{ id: chatId, title, messages: finalMsgs }, ...chats].slice(0, 30)
        setCurrentChatId(chatId)
        persistChats(user.email, updated)
      }
    } catch {
      setMessages([...messages, userMsg, { role: 'assistant', content: 'Ошибка соединения. Попробуйте ещё раз.' }])
    }
    setLoading(false)
  }

  if (!user) {
    return (
      <AuthScreen
        onLogin={(u) => {
          setUser(u)
          setChats(getChats(u.email))
        }}
      />
    )
  }

  const headerLabel =
    page === 'chat' ? 'Чат' : page === 'docs' ? 'База знаний' : page === 'upload' ? 'Загрузить' : 'О сервисе'

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        page={page}
        setPage={setPage}
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={newChat}
        onSelectChat={selectChat}
        user={user}
        onLogout={() => {
          clearSession()
          setUser(null)
          setChats([])
          newChat()
        }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-medium">{headerLabel}</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            AI активен
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          {page === 'chat' && (
            <ChatPage
              messages={messages}
              input={input}
              setInput={setInput}
              loading={loading}
              send={send}
              uploadedDocs={uploadedDocs}
              onUploadDocs={(docs) => setUploadedDocs((prev) => [...prev, ...docs])}
              onRemoveDoc={(i) => setUploadedDocs((prev) => prev.filter((_, j) => j !== i))}
            />
          )}
          {page === 'docs' && <DocsPage />}
          {page === 'upload' && <UploadPage />}
          {page === 'about' && <AboutPage />}
        </div>
      </div>
    </div>
  )
}
