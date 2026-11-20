import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, KeyRound, Lock, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Button, ErrorNote, Field, Input } from '../../components/ui'
import { Logo } from '../../components/brand/Logo'
import { supabase } from '../../lib/supabase'

export default function AdminLoginPage() {
  const { signInAdmin, user, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/admin'
  const [username, setUsername] = useState('nexora_admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(params.get('reset') === '1')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (user && isAdmin && !recoveryMode) navigate(next, { replace: true })
  }, [user, isAdmin, recoveryMode, navigate, next])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Enter your admin password.')
    setLoading(true)
    try {
      const profile = await signInAdmin(username, password)
      toast.success('Welcome to NEXORA Admin', profile.full_name ?? 'Administrator')
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!supabase) return setError('The live authentication service is not configured.')
    setLoading(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-access', {
        body: { action: 'forgot', username },
      })
      if (invokeError) throw invokeError
      toast.success('Password recovery', data?.message ?? 'Check your registered recovery email.')
      setForgotMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a reset link.')
    } finally {
      setLoading(false)
    }
  }

  const saveNewPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!supabase) return setError('The live authentication service is not configured.')
    if (newPassword.length < 12) return setError('Use at least 12 characters.')
    if (newPassword !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      toast.success('Password updated', 'Sign in with your new password.')
      setRecoveryMode(false)
      navigate('/admin/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.')
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
            {recoveryMode ? 'Choose a new password' : forgotMode ? 'Reset admin password' : 'NEXORA Admin'}
          </h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            {recoveryMode ? 'Create a new password for your administrator account.' : forgotMode ? 'We will send a secure reset link to the registered recovery email.' : 'Sign in to your single administrator control panel.'}
          </p>
        </div>
        <div className="nx-card p-5">
          {recoveryMode ? (
            <form onSubmit={saveNewPassword} className="space-y-3.5">
              <Field label="New password" required htmlFor="admin-reset-password" hint="At least 12 characters.">
                <Input id="admin-reset-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={12} />
              </Field>
              <Field label="Confirm new password" required htmlFor="admin-reset-confirm">
                <Input id="admin-reset-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={12} />
              </Field>
              {error && <ErrorNote message={error} />}
              <Button type="submit" loading={loading} className="w-full">Update password</Button>
            </form>
          ) : (
            <form onSubmit={forgotMode ? sendReset : submit} className="space-y-3.5">
              <Field label="Admin username" required htmlFor="admin-username">
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                  <Input id="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="pl-9" required />
                </div>
              </Field>
              {!forgotMode && (
                <Field label="Password" required htmlFor="admin-password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
                    <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pl-9" required />
                  </div>
                </Field>
              )}
              {error && <ErrorNote message={error} />}
              <Button type="submit" loading={loading} className="w-full" icon={loading ? undefined : <ArrowRight className="h-4 w-4" />}>
                {forgotMode ? 'Send reset link' : 'Sign in to Admin'}
              </Button>
              <button type="button" onClick={() => { setForgotMode((v) => !v); setError(null) }} className="w-full text-center text-[12px] text-white/40 transition hover:text-white">
                {forgotMode ? 'Back to admin login' : 'Forgot password?'}
              </button>
            </form>
          )}
        </div>
        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/25">Secure administrator access · Passwords are never stored in plain text.</p>
      </div>
    </div>
  )
}
