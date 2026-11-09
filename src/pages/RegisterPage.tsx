import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, ErrorNote, Field, Input } from '../components/ui'
import { Logo } from '../components/brand/Logo'
import { cn, isBDPhone, isEmail, passwordStrength } from '../lib/utils'

const RULES = [
  { test: (v: string) => v.length >= 8, label: 'At least 8 characters' },
  { test: (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v), label: 'Upper & lowercase letters' },
  { test: (v: string) => /\d/.test(v), label: 'At least one number' },
]

export default function RegisterPage() {
  const { signUp, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const strength = passwordStrength(form.password)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.fullName.trim().length < 2) return setError('Enter your full name.')
    if (!isEmail(form.email)) return setError('Enter a valid email address.')
    if (form.phone && !isBDPhone(form.phone)) return setError('Enter a valid Bangladeshi mobile number.')
    if (passwordStrength(form.password).score < 2) return setError('Choose a stronger password.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const result = await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone || undefined,
      })
      if (result.needsConfirmation) {
        setNeedsConfirmation(true)
      } else {
        toast.success('Account created', 'Welcome to NEXORA.')
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nx-container grid min-h-[calc(100vh-12rem)] place-items-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" withWordmark={false} />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            Free forever. Track every order, get your access details in one place.
          </p>
        </div>

        {needsConfirmation ? (
          <div className="nx-card p-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-lg font-bold text-white">Check your inbox</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
              We sent a confirmation link to <b className="text-white">{form.email}</b>. Click it to
              activate your account, then sign in.
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate('/login')}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <div className="nx-card p-5">
            <form onSubmit={submit} className="space-y-3.5">
              <Field label="Full name" required htmlFor="fullName">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Tanvir Ahmed"
                    autoComplete="name"
                    className="pl-9"
                    required
                  />
                </div>
              </Field>

              <Field label="Email address" required htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="pl-9"
                    required
                  />
                </div>
              </Field>

              <Field label="Mobile number (optional)" htmlFor="phone" hint="For faster WhatsApp delivery">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01712345678"
                    inputMode="tel"
                    autoComplete="tel"
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Password" required htmlFor="password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pl-9 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/35 transition hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </Field>

              {form.password && (
                <div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition',
                          i < strength.score
                            ? strength.score <= 2
                              ? 'bg-rose-500'
                              : strength.score === 3
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            : 'bg-white/10',
                        )}
                      />
                    ))}
                  </div>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {RULES.map((r) => {
                      const passed = r.test(form.password)
                      return (
                        <li
                          key={r.label}
                          className={cn(
                            'flex items-center gap-1 text-[11px]',
                            passed ? 'text-emerald-400' : 'text-white/35',
                          )}
                        >
                          <Check className={cn('h-2.5 w-2.5', !passed && 'opacity-30')} aria-hidden />
                          {r.label}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <Field label="Confirm password" required htmlFor="confirm">
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </Field>

              {error && <ErrorNote message={error} />}

              <Button type="submit" loading={loading} className="w-full" icon={loading ? undefined : <ArrowRight className="h-4 w-4" />}>
                Create account
              </Button>

              <p className="text-center text-[11px] leading-relaxed text-white/30">
                By creating an account you agree to our{' '}
                <Link to="/terms" className="text-white/50 hover:underline">Terms</Link> and{' '}
                <Link to="/privacy" className="text-white/50 hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        )}

        <p className="mt-4 text-center text-[12.5px] text-white/45">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#6EC1FF] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
