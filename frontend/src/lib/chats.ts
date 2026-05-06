import { supabase } from './supabase'
import type { Chat } from './types'

export async function loadChats(): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('id, title, messages, project_id')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) { console.error('loadChats:', error.message); return [] }
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    messages: r.messages,
    projectId: r.project_id ?? null,
  }))
}

export async function upsertChat(chat: Chat): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('chats').upsert({
    id: chat.id,
    user_id: user.id,
    title: chat.title,
    messages: chat.messages,
    project_id: chat.projectId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
}

export async function deleteChat(id: string): Promise<void> {
  await supabase.from('chats').delete().eq('id', id)
}

export async function moveChatToProject(chatId: string, projectId: string | null): Promise<void> {
  await supabase.from('chats').update({ project_id: projectId }).eq('id', chatId)
}
