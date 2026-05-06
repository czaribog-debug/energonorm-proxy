import { useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'

interface Props {
  onLogin: () => void
}

export function AuthScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setErr('')
    if (!email || !pass) return setErr('Заполните все поля')
    if (mode === 'register' && !name) return setErr('Введите имя')
    setLoading(true)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { name } },
      })
      if (error) { setErr(translateError(error.message)); setLoading(false); return }
      // После регистрации сразу входим
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (loginErr) { setErr(translateError(loginErr.message)); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) { setErr(translateError(error.message)); setLoading(false); return }
    }

    setLoading(false)
    onLogin()
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ваше имя"
              disabled={loading}
            />
          )}
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKey}
            type="email"
            placeholder="Email"
            disabled={loading}
          />
          <Input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={onKey}
            type="password"
            placeholder="Пароль"
            disabled={loading}
          />
          {err && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{err}</div>
          )}
          <Button onClick={submit} disabled={loading} className="mt-1">
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль'
  if (msg.includes('Email not confirmed')) return 'Подтвердите email перед входом'
  if (msg.includes('User already registered')) return 'Пользователь с таким email уже существует'
  if (msg.includes('Password should be at least')) return 'Пароль должен быть не менее 6 символов'
  if (msg.includes('Unable to validate email address')) return 'Некорректный email'
  return msg
}
