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
}

export interface Session {
  email: string
  name: string
}

export type Page = 'chat' | 'docs' | 'upload' | 'about'
