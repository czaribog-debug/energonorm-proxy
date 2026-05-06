export type Role = 'user' | 'assistant'

export interface Message {
  role: Role
  content: string
  loading?: boolean
}

export interface UploadedDoc {
  name: string
  size: number
  b64: string
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  projectId: string | null
}

export interface Project {
  id: string
  name: string
  createdAt: string
  chatCount?: number
}

export interface ProjectDocument {
  id: string
  projectId: string
  filename: string
  fileSize: number | null
  createdAt: string
  contentLength?: number
}

export interface Session {
  email: string
  name: string
}

export type Page = 'chat' | 'docs' | 'upload' | 'about' | 'project'
