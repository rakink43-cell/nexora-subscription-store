import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, isDemoMode } from '../lib/api'
import { Button, ErrorNote, Field, Input } from '../components/ui'
import { Logo } from '../components/brand/Logo'
import { isEmail } from '../lib/utils'

export default function LoginPage() {
  const { signIn, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (user) navigate(next, { replace: true })
  }, [user, navigate, next])

  useEffect(() => {
    if (searchParams.get('verified')) {
      toast.success('Email verified', 'You can sign in now.')
    }
  }, [searchParams, toast])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isEmail(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Enter your password.')
      return
    }
    setLoading(true)
    try {
      const profile = await signIn(email, password)
      toast.success('Welcome back', profile.full_name ?? profile.email ?? '')
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.')
    } finally {
      setLoading(false)
    }
  }

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isEmail(email)) {
      setError('Enter the email on your account.')
      return
    }
    setLoading(true)
    try {
      if ('resetPassword' in api.auth) {
        await (api.auth as { resetPassword: (e: string) => Promise<void> }).resetPassword(email)
        setResetSent(true)
      } else {
        setError('Password reset needs a connected Supabase project.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nx-container grid min-h-[calc(100vh-12rem)] place-items-center py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" withWordmark={false} />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">
            {resetMode ? 'Reset your password' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            {resetMode
              ? 'We will email you a secure link to choose a new password.'
              : 'Sign in to track orders, re-order in one click and manage your subscriptions.'}
          </p>
        </div>

        <div className="nx-card p-5">
          {resetSent ? (
            <div className="text-center">
              <p className="text-[13px] leading-relaxed text-white/60">
                If <b className="text-white">{email}</b> has an account, a reset link is on its way.
                Check your inbox and spam folder.
              </p>
              <Button variant="ghost" className="mt-4 w-full" onClick={() => setResetMode(false)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={resetMode ? sendReset : submit} className="space-y-3.5">
              <Field label="Email address" required htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="pl-9"
                    required
                  />
                </div>
              </Field>

              {!resetMode && (
                <Field
                  label="Password"
                  required
                  htmlFor="password"
                  hint={undefined}
                >
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
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
              )}

              {error && <ErrorNote message={error} />}

              <Button
                type="submit"
                loading={loading}
                className="w-full"
                icon={loading ? undefined : <ArrowRight className="h-4 w-4" />}
              >
                {resetMode ? 'Send reset link' : 'Sign in'}
              </Button>

              {!resetMode && 'resetPassword' in api.auth && (
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true)
                    setError(null)
                  }}
                  className="w-full text-center text-[12px] text-white/40 transition hover:text-white"
                >
                  Forgot your password?
                </button>
              )}
              {resetMode && (
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false)
                    setError(null)
                  }}
                  className="w-full text-center text-[12px] text-white/40 transition hover:text-white"
                >
                  Back to sign in
                </button>
              )}
            </form>
          )}
        </div>

        {!resetMode && (
          <p className="mt-4 text-center text-[12.5px] text-white/45">
            New to NEXORA?{' '}
            <Link to="/register" className="font-semibold text-[#6EC1FF] hover:underline">
              Create a free account
            </Link>
          </p>
        )}

        {isDemoMode && (
          <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Demo accounts</p>
            <div className="mt-2 space-y-1.5 text-[11.5px] text-amber-100/70">
              <p>
                Customer · <code className="font-mono">customer@nexora.store</code> /{' '}
                <code className="font-mono">Customer@2026</code>
              </p>
              <p>
                Admin · <code className="font-mono">admin@nexora.store</code> /{' '}
                <code className="font-mono">Nexora@2026</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@nexora.store')
                setPassword('Nexora@2026')
              }}
              className="mt-2 text-[11px] font-semibold text-amber-300 hover:underline"
            >
              Fill admin credentials →
            </button>
          </div>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/25">
          Protected by Supabase authentication. We never store your password in plain text.
        </p>
      </div>
    </div>
  )
}
