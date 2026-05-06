import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { loadChats, upsertChat, deleteChat, moveChatToProject } from '@/lib/chats'
import {
  loadProjects, createProject as apiCreateProject, deleteProject as apiDeleteProject,
  renameProject as apiRenameProject, loadProjectContext,
} from '@/lib/projects'
import { AuthScreen } from '@/components/auth-screen'
import { Sidebar } from '@/components/sidebar'
import { ChatPage } from '@/components/chat-page'
import { DocsPage } from '@/components/docs-page'
import { UploadPage } from '@/components/upload-page'
import { AboutPage } from '@/components/about-page'
import { ProjectPage } from '@/components/project-page'
import { PROXY_URL, SYSTEM_PROMPT } from '@/lib/constants'
import type { Chat, Message, Page, Project, Session, UploadedDoc } from '@/lib/types'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [page, setPage] = useState<Page>('chat')
  const [chats, setChats] = useState<Chat[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null) // для нового чата в проекте
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadChats().then(setChats)
      loadProjects().then(setProjects)
    } else {
      setChats([])
      setProjects([])
    }
  }, [user])

  const session: Session | null = user
    ? { email: user.email ?? '', name: user.user_metadata?.name ?? user.email ?? '' }
    : null

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId]
  )

  const newChat = (projectId: string | null) => {
    setCurrentChatId(null)
    setMessages([])
    setInput('')
    setUploadedDocs([])
    setPendingProjectId(projectId)
    setPage('chat')
  }

  const selectChat = (id: string) => {
    const c = chats.find((c) => c.id === id)
    if (c) {
      setCurrentChatId(id)
      setMessages(c.messages)
      setUploadedDocs([])
      setPendingProjectId(null)
      setPage('chat')
    }
  }

  const removeChat = async (id: string) => {
    await deleteChat(id)
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (currentChatId === id) newChat(null)
  }

  const selectProject = (id: string) => {
    setCurrentProjectId(id)
    setPage('project')
  }

  const createProject = async () => {
    const name = window.prompt('Название проекта')
    if (!name?.trim()) return
    const p = await apiCreateProject(name)
    if (p) {
      setProjects((prev) => [...prev, p])
      setCurrentProjectId(p.id)
      setPage('project')
    }
  }

  const renameProject = async (id: string) => {
    const cur = projects.find((p) => p.id === id)
    const name = window.prompt('Новое название', cur?.name ?? '')
    if (!name?.trim() || name.trim() === cur?.name) return
    await apiRenameProject(id, name)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)))
  }

  const deleteProjectAction = async (id: string) => {
    const cur = projects.find((p) => p.id === id)
    if (!window.confirm(`Удалить проект «${cur?.name}»? Чаты внутри сохранятся (станут «без проекта»), документы проекта удалятся.`)) return
    await apiDeleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setChats((prev) => prev.map((c) => (c.projectId === id ? { ...c, projectId: null } : c)))
    if (currentProjectId === id) {
      setCurrentProjectId(null)
      if (page === 'project') setPage('chat')
    }
  }

  const moveChat = async (chatId: string, projectId: string | null) => {
    await moveChatToProject(chatId, projectId)
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, projectId } : c)))
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

      // Определяем активный проект для этого чата
      const activeChat = currentChatId ? chats.find((c) => c.id === currentChatId) : null
      const chatProjectId = activeChat?.projectId ?? pendingProjectId
      const chatProject = chatProjectId ? projects.find((p) => p.id === chatProjectId) : null

      // Тянем контекст проекта (текст всех его документов)
      const projectContext = chatProjectId ? await loadProjectContext(chatProjectId) : ''

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
          projectContext,
          projectName: chatProject?.name,
        }),
      })
      const data = await res.json()
      const answer = data.content?.map((b: { text?: string }) => b.text || '').join('') || 'Не удалось получить ответ.'
      const finalMsgs: Message[] = [...messages, userMsg, { role: 'assistant', content: answer }]
      setMessages(finalMsgs)

      const chatId = currentChatId || crypto.randomUUID()
      const title = text.slice(0, 45) + (text.length > 45 ? '…' : '')
      const updatedChat: Chat = {
        id: chatId,
        title: currentChatId ? (chats.find(c => c.id === chatId)?.title ?? title) : title,
        messages: finalMsgs,
        projectId: chatProjectId,
      }

      setCurrentChatId(chatId)
      setPendingProjectId(null)
      setChats((prev) =>
        currentChatId
          ? prev.map((c) => (c.id === chatId ? updatedChat : c))
          : [updatedChat, ...prev].slice(0, 50)
      )
      upsertChat(updatedChat)
    } catch {
      setMessages([...messages, userMsg, { role: 'assistant', content: 'Ошибка соединения. Попробуйте ещё раз.' }])
    }
    setLoading(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !session) {
    return <AuthScreen onLogin={() => {}} />
  }

  // Заголовок: для проекта показываем его имя, для нового чата в проекте — подсказку
  const activeChatProject = currentChatId
    ? projects.find((p) => p.id === chats.find((c) => c.id === currentChatId)?.projectId) ?? null
    : pendingProjectId
    ? projects.find((p) => p.id === pendingProjectId) ?? null
    : null

  const headerLabel = page === 'project' && currentProject
    ? currentProject.name
    : page === 'chat'
    ? activeChatProject ? `Чат · ${activeChatProject.name}` : 'Чат'
    : page === 'docs' ? 'База знаний'
    : page === 'upload' ? 'Загрузить'
    : 'О сервисе'

  const chatCountForCurrent = currentProject ? chats.filter((c) => c.projectId === currentProject.id).length : 0

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        page={page}
        setPage={setPage}
        chats={chats}
        projects={projects}
        currentChatId={currentChatId}
        currentProjectId={currentProjectId}
        onNewChat={newChat}
        onSelectChat={selectChat}
        onDeleteChat={removeChat}
        onSelectProject={selectProject}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProjectAction}
        onMoveChatToProject={moveChat}
        user={session}
        onLogout={() => supabase.auth.signOut()}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <div className="text-sm font-medium truncate">{headerLabel}</div>
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
              currentChatId={currentChatId}
            />
          )}
          {page === 'docs' && <DocsPage />}
          {page === 'upload' && <UploadPage />}
          {page === 'about' && <AboutPage />}
          {page === 'project' && currentProject && (
            <ProjectPage
              project={currentProject}
              chatCount={chatCountForCurrent}
              onNewChat={() => newChat(currentProject.id)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
