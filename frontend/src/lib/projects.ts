import { supabase } from './supabase'
import type { Project, ProjectDocument } from './types'

export async function loadProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at')
    .order('created_at', { ascending: true })
  if (error) { console.error('loadProjects:', error.message); return [] }
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

export async function createProject(name: string): Promise<Project | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: name.trim() })
    .select('id, name, created_at')
    .single()
  if (error) { console.error('createProject:', error.message); return null }
  return { id: data.id, name: data.name, createdAt: data.created_at }
}

export async function renameProject(id: string, name: string): Promise<void> {
  await supabase.from('projects').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteProject(id: string): Promise<void> {
  // Чаты внутри проекта благодаря ON DELETE SET NULL станут "без проекта", не удалятся
  await supabase.from('projects').delete().eq('id', id)
}

// ─── Документы проекта ───────────────────────────────────────────────────────
export async function loadProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('id, project_id, filename, file_size, created_at, content')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) { console.error('loadProjectDocuments:', error.message); return [] }
  return (data ?? []).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    filename: r.filename,
    fileSize: r.file_size,
    createdAt: r.created_at,
    contentLength: r.content?.length ?? 0,
  }))
}

// Возвращает объединённый текст всех документов проекта (для контекста LLM)
export async function loadProjectContext(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('project_documents')
    .select('filename, content')
    .eq('project_id', projectId)
  if (error) { console.error('loadProjectContext:', error.message); return '' }
  if (!data || data.length === 0) return ''
  return data
    .map((d) => `=== ДОКУМЕНТ ПРОЕКТА: ${d.filename} ===\n${d.content}`)
    .join('\n\n')
}

export async function addProjectDocument(args: {
  projectId: string
  filename: string
  content: string
  fileSize: number
}): Promise<ProjectDocument | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('project_documents')
    .insert({
      project_id: args.projectId,
      user_id: user.id,
      filename: args.filename,
      content: args.content,
      file_size: args.fileSize,
    })
    .select('id, project_id, filename, file_size, created_at')
    .single()
  if (error) { console.error('addProjectDocument:', error.message); return null }
  return {
    id: data.id,
    projectId: data.project_id,
    filename: data.filename,
    fileSize: data.file_size,
    createdAt: data.created_at,
    contentLength: args.content.length,
  }
}

export async function deleteProjectDocument(id: string): Promise<void> {
  await supabase.from('project_documents').delete().eq('id', id)
}
