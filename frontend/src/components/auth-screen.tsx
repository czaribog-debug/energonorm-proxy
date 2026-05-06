import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUsers, saveUsers, saveSession } from '@/lib/storage'
import type { Session } from '@/lib/types'

interface Props {
  onLogin: (session: Session) => void
}

export function AuthScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const submit = () => {
    setErr('')
    if (!email || !pass) return setErr('Заполните все поля')
    const users = getUsers()
    if (mode === 'register') {
      if (!name) return setErr('Введите имя')
      if (users[email]) return setErr('Пользователь уже существует')
      users[email] = { pass, name }
      saveUsers(users)
      const session = { email, name }
      saveSession(session)
      onLogin(session)
    } else {
      if (!users[email] || users[email].pass !== pass) return setErr('Неверный email или пароль')
      const session = { email, name: users[email].name }
      saveSession(session)
      onLogin(session)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-7">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6" />
          </div>
          <div className="font-bold text-xl">ЭнергоНорм</div>
          <div className="text-sm text-muted-foreground mt-1">
            AI-ассистент по нормативам электроэнергетики
          </div>
        </div>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as 'login' | 'register'); setErr('') }} className="mb-5">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="login">Войти</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2.5">
          {mode === 'register' && (
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} placeholder="Ваше имя" />
          )}
          <Input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} type="email" placeholder="Email" />
          <Input value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={onKey} type="password" placeholder="Пароль" />
          {err && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{err}</div>
          )}
          <Button onClick={submit} className="mt-1">
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
