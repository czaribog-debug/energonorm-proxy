import type { Chat, Session } from './types'

const USERS_KEY = 'en_users'
const SESSION_KEY = 'en_session'

interface UserRecord { pass: string; name: string }
type Users = Record<string, UserRecord>

export function getUsers(): Users {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}') } catch { return {} }
}

export function saveUsers(u: Users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u))
}

export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

export function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getChats(email: string): Chat[] {
  try { return JSON.parse(localStorage.getItem('en_chats_' + email) || '[]') } catch { return [] }
}

export function saveChats(email: string, chats: Chat[]) {
  localStorage.setItem('en_chats_' + email, JSON.stringify(chats))
}
