import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ClipboardCheck, Eye, EyeOff, HelpCircle, Loader2, LogIn, Lock, Megaphone, User, type LucideIcon } from 'lucide-react'
import logo from '../assets/SINFO_LOGO.png'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'

const features: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BookOpen, title: 'Інструкції та матеріали', text: 'Стандарти й регламенти завжди під рукою' },
  { icon: ClipboardCheck, title: 'Навчання і тестування', text: 'Перевіряйте знання та проходьте курси' },
  { icon: Megaphone, title: 'Новини компанії', text: 'Важливі оголошення та акції — не пропустіть' },
]

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { login, password })
      const me = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      setSession(me.data, data.accessToken, data.refreshToken)
      navigate('/')
    } catch {
      setError('Невірний логін або пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-bg text-ink lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Брендова панель (лише на широких екранах) */}
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <svg
          aria-hidden
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -bottom-32 -right-32 h-[520px] w-[520px] text-accent opacity-[0.12]"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
        >
          <circle cx="200" cy="200" r="190" strokeDasharray="1000 200" />
          <circle cx="200" cy="200" r="140" strokeDasharray="700 180" />
          <circle cx="200" cy="200" r="90" strokeDasharray="400 160" />
          <circle cx="200" cy="200" r="40" />
        </svg>
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />

        <img src={logo} alt="Слухавка Інфо" className="relative h-10 w-auto self-start" />

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Усе, що потрібно команді, — в одному місці
          </h2>
          <p className="mt-3 text-muted">
            Внутрішній портал знань, навчання та новин мережі «Слухавка».
          </p>
          <ul className="mt-8 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <f.icon size={20} />
                </span>
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="block text-sm text-muted">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-muted">© {new Date().getFullYear()} Слухавка</p>
      </aside>

      {/* Форма входу */}
      <main className="relative flex flex-col items-center justify-center overflow-hidden p-4 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent-soft opacity-60 blur-3xl" />

        <div className="relative w-full max-w-md">
          <img src={logo} alt="Слухавка Інфо" className="mx-auto mb-8 h-9 w-auto lg:hidden" />

          <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-10">
            <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <LogIn size={22} />
            </span>
            <h1 className="text-2xl font-semibold">Вхід до порталу</h1>
            <p className="mb-7 mt-1 text-sm text-muted">Введіть свій логін і пароль, щоб продовжити</p>

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="login" className="mb-1.5 block text-sm font-medium">
                Логін
              </label>
              <div className="relative mb-4">
                <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="login"
                  name="login"
                  autoComplete="username"
                  autoFocus
                  className="w-full rounded-xl border border-border bg-surface-2 py-3 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Ваш логін"
                />
              </div>

              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Пароль
              </label>
              <div className="relative mb-5">
                <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-border bg-surface-2 py-3 pl-11 pr-11 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ваш пароль"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Приховати пароль' : 'Показати пароль'}
                  title={show ? 'Приховати пароль' : 'Показати пароль'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-accent"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !login || !password}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Вхід...' : 'Увійти'}
              </button>
            </form>

            <p className="mt-6 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
              <HelpCircle size={14} className="mt-0.5 shrink-0" />
              Забули пароль? Зверніться до свого керівника або адміністратора.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            <a href="https://sluhavka.com" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              Сайт Слухавки
            </a>
            <span className="mx-2">·</span>
            <a
              href="https://forms.clickup.com/90122054837/f/2kxv2v5n-1092/FJGOTVKAG26SAC90Z2"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink"
            >
              Повідомити про помилку
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
