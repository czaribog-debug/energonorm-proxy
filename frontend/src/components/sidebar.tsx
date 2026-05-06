import { useState } from 'react'
import { Plus, MessageSquare, BookOpen, Upload, Info, ChevronLeft, ChevronRight, ChevronsUpDown, LogOut, User as UserIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Chat, Page, Session } from '@/lib/types'

interface Props {
  page: Page
  setPage: (p: Page) => void
  chats: Chat[]
  currentChatId: string | null
  onNewChat: () => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  user: Session
  onLogout: () => void
}

const NAV: Array<{ id: Page; icon: typeof MessageSquare; label: string }> = [
  { id: 'chat', icon: MessageSquare, label: 'Чат' },
  { id: 'docs', icon: BookOpen, label: 'База знаний' },
  { id: 'upload', icon: Upload, label: 'Загрузить' },
  { id: 'about', icon: Info, label: 'О сервисе' },
]

export function Sidebar({ page, setPage, chats, currentChatId, onNewChat, onSelectChat, onDeleteChat, user, onLogout }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 border-r flex flex-col h-full bg-background">
        <div className="p-2 flex flex-col items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNewChat} className="h-9 w-9" title="Новый чат">
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
        <Button onClick={onNewChat} variant="outline" className="w-full justify-start gap-2 h-9 font-normal">
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
        {chats.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2.5 py-1.5">
              История
            </div>
            <div className="space-y-0.5">
              {chats.map((c) => (
                <div key={c.id} className="group relative">
                  <button
                    onClick={() => onSelectChat(c.id)}
                    title={c.title}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 pr-7 rounded-md text-xs truncate transition-colors',
                      currentChatId === c.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    )}
                  >
                    {c.title}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id) }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive"
                    title="Удалить чат"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
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
