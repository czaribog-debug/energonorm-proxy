import { useState } from 'react'
import {
  Plus, MessageSquare, BookOpen, Upload, Info, ChevronLeft, ChevronRight, ChevronsUpDown,
  LogOut, User as UserIcon, Trash2, Folder, FolderOpen, MoreHorizontal, FolderInput, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Chat, Page, Project, Session } from '@/lib/types'

interface Props {
  page: Page
  setPage: (p: Page) => void
  chats: Chat[]
  projects: Project[]
  currentChatId: string | null
  currentProjectId: string | null
  onNewChat: (projectId: string | null) => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onSelectProject: (id: string) => void
  onCreateProject: () => void
  onRenameProject: (id: string) => void
  onDeleteProject: (id: string) => void
  onMoveChatToProject: (chatId: string, projectId: string | null) => void
  user: Session
  onLogout: () => void
}

const NAV: Array<{ id: Page; icon: typeof MessageSquare; label: string }> = [
  { id: 'chat', icon: MessageSquare, label: 'Чат' },
  { id: 'docs', icon: BookOpen, label: 'База знаний' },
  { id: 'upload', icon: Upload, label: 'Загрузить' },
  { id: 'about', icon: Info, label: 'О сервисе' },
]

export function Sidebar({
  page, setPage, chats, projects, currentChatId, currentProjectId,
  onNewChat, onSelectChat, onDeleteChat,
  onSelectProject, onCreateProject, onRenameProject, onDeleteProject, onMoveChatToProject,
  user, onLogout,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openProjectIds, setOpenProjectIds] = useState<Set<string>>(new Set())
  const [chatMenuFor, setChatMenuFor] = useState<string | null>(null)
  const [projectMenuFor, setProjectMenuFor] = useState<string | null>(null)

  const toggleProject = (id: string) => {
    setOpenProjectIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const orphanChats = chats.filter((c) => !c.projectId)
  const chatsByProject = (pid: string) => chats.filter((c) => c.projectId === pid)

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 border-r flex flex-col h-full bg-background">
        <div className="p-2 flex flex-col items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onNewChat(null)} className="h-9 w-9" title="Новый чат">
            <Plus className="w-4 h-4" />
          </Button>
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <Button
                key={item.id}
                variant={active ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setPage(item.id)}
                className="h-9 w-9"
                title={item.label}
              >
                <Icon className="w-4 h-4" />
              </Button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col h-full bg-background">
      <div className="px-3 pt-4 pb-2">
        <div className="text-xs font-medium text-muted-foreground px-2 mb-2">ЭнергоНорм</div>
        <Button onClick={() => onNewChat(null)} variant="outline" className="w-full justify-start gap-2 h-9 font-normal">
          <Plus className="w-4 h-4" />
          Новый чат
        </Button>
      </div>

      <nav className="px-2 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              )}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-2 pt-3 min-h-0">
        {/* Проекты */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Проекты</div>
          <button
            onClick={onCreateProject}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Новый проект"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0.5">
          {projects.map((p) => {
            const open = openProjectIds.has(p.id)
            const inside = chatsByProject(p.id)
            const active = page === 'project' && currentProjectId === p.id
            return (
              <div key={p.id}>
                <div className="group relative flex items-center gap-1">
                  <button
                    onClick={() => toggleProject(p.id)}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {open ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { onSelectProject(p.id); toggleProject(p.id) }}
                    className={cn(
                      'flex-1 text-left px-1.5 py-1 rounded-md text-xs truncate transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'text-foreground/90 hover:bg-accent/60'
                    )}
                    title={p.name}
                  >
                    {p.name}
                    {inside.length > 0 && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{inside.length}</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setProjectMenuFor((v) => v === p.id ? null : p.id) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent text-muted-foreground"
                    title="Меню проекта"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {projectMenuFor === p.id && (
                    <div
                      className="absolute right-0 top-full mt-0.5 z-20 bg-popover border rounded-md shadow-md py-1 min-w-[160px]"
                      onMouseLeave={() => setProjectMenuFor(null)}
                    >
                      <button
                        onClick={() => { setProjectMenuFor(null); onNewChat(p.id) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Новый чат в проекте
                      </button>
                      <button
                        onClick={() => { setProjectMenuFor(null); onRenameProject(p.id) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Переименовать
                      </button>
                      <button
                        onClick={() => { setProjectMenuFor(null); onDeleteProject(p.id) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-destructive text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Удалить проект
                      </button>
                    </div>
                  )}
                </div>

                {open && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    <button
                      onClick={() => onNewChat(p.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Новый чат
                    </button>
                    {inside.map((c) => (
                      <ChatItem
                        key={c.id}
                        chat={c}
                        active={currentChatId === c.id && page === 'chat'}
                        menuOpen={chatMenuFor === c.id}
                        onMenuToggle={() => setChatMenuFor((v) => v === c.id ? null : c.id)}
                        onCloseMenu={() => setChatMenuFor(null)}
                        onSelect={() => onSelectChat(c.id)}
                        onDelete={() => onDeleteChat(c.id)}
                        projects={projects}
                        onMove={(toPid) => onMoveChatToProject(c.id, toPid)}
                      />
                    ))}
                    {inside.length === 0 && (
                      <div className="text-[10px] text-muted-foreground px-2 py-1">Чатов пока нет</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {projects.length === 0 && (
            <div className="text-[10px] text-muted-foreground px-2.5 py-1">
              Создайте проект, чтобы прикреплять к нему документы и чаты
            </div>
          )}
        </div>

        {/* Чаты без проекта */}
        {orphanChats.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2.5 py-1.5 mt-3">
              История
            </div>
            <div className="space-y-0.5">
              {orphanChats.map((c) => (
                <ChatItem
                  key={c.id}
                  chat={c}
                  active={currentChatId === c.id && page === 'chat'}
                  menuOpen={chatMenuFor === c.id}
                  onMenuToggle={() => setChatMenuFor((v) => v === c.id ? null : c.id)}
                  onCloseMenu={() => setChatMenuFor(null)}
                  onSelect={() => onSelectChat(c.id)}
                  onDelete={() => onDeleteChat(c.id)}
                  projects={projects}
                  onMove={(toPid) => onMoveChatToProject(c.id, toPid)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-2 pb-2">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-8 w-8" title="Свернуть">
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="border-t px-2 py-2 relative">
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-popover border rounded-lg shadow-md py-1 z-10">
            <button
              onClick={() => { setMenuOpen(false); onLogout() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-sm font-medium truncate leading-tight">{user.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </button>
      </div>
    </aside>
  )
}

interface ChatItemProps {
  chat: Chat
  active: boolean
  menuOpen: boolean
  onMenuToggle: () => void
  onCloseMenu: () => void
  onSelect: () => void
  onDelete: () => void
  projects: Project[]
  onMove: (projectId: string | null) => void
}

function ChatItem({ chat, active, menuOpen, onMenuToggle, onCloseMenu, onSelect, onDelete, projects, onMove }: ChatItemProps) {
  const [moveOpen, setMoveOpen] = useState(false)

  return (
    <div className="group relative">
      <button
        onClick={onSelect}
        title={chat.title}
        className={cn(
          'w-full text-left px-2.5 py-1.5 pr-7 rounded-md text-xs truncate transition-colors',
          active
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
        )}
      >
        {chat.title}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMenuToggle() }}
        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-foreground"
        title="Меню чата"
      >
        <MoreHorizontal className="w-3 h-3" />
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-0.5 z-20 bg-popover border rounded-md shadow-md py-1 min-w-[160px]"
          onMouseLeave={() => { onCloseMenu(); setMoveOpen(false) }}
        >
          <button
            onClick={() => { setMoveOpen((v) => !v) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Переместить в проект…
          </button>
          {moveOpen && (
            <div className="border-t mt-1 pt-1">
              {projects.length === 0 && (
                <div className="px-3 py-1.5 text-[11px] text-muted-foreground">Проектов нет</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onMove(p.id); onCloseMenu(); setMoveOpen(false) }}
                  className={cn(
                    'w-full px-3 py-1 text-xs hover:bg-accent text-left truncate flex items-center gap-2',
                    chat.projectId === p.id && 'text-primary'
                  )}
                >
                  <Folder className="w-3 h-3" />
                  {p.name}
                </button>
              ))}
              {chat.projectId && (
                <button
                  onClick={() => { onMove(null); onCloseMenu(); setMoveOpen(false) }}
                  className="w-full px-3 py-1 text-xs hover:bg-accent text-left text-muted-foreground"
                >
                  Убрать из проекта
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => { onCloseMenu(); onDelete() }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-destructive text-left border-t mt-1 pt-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Удалить чат
          </button>
        </div>
      )}
    </div>
  )
}
