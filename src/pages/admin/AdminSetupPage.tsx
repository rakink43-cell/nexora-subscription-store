import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Logo } from '../../components/brand/Logo'
import { Button, ErrorNote, Field, Input } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'

export default function AdminSetupPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!token) return setError('This setup link is missing its security token.')
    if (password.length < 12) return setError('Use at least 12 characters for your new password.')
    if (password !== confirm) return setError('The passwords do not match.')
    if (!supabase) return setError('The live authentication service is not configured.')

    setLoading(true)
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('admin-access', {
        body: { action: 'setup', token, password },
      })
      if (invokeError) throw invokeError
      if (!data?.ok) throw new Error(data?.error ?? 'Could not create the admin password.')
      toast.success('Admin password created', 'You can now sign in using your username.')
      navigate('/admin/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the admin password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nx-container grid min-h-[calc(100vh-12rem)] place-items-center py-12">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" withWordmark={false} />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">Set admin password</h1>
          <p className="mt-1.5 text-[13px] text-white/45">Create a new password for the existing NEXORA administrator account.</p>
        </div>
        <div className="nx-card p-5">
          <form onSubmit={submit} className="space-y-3.5">
            <Field label="New password" required hint="At least 12 characters." htmlFor="admin-new-password">
              <Input id="admin-new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={12} />
            </Field>
            <Field label="Confirm password" required htmlFor="admin-confirm-password">
              <Input id="admin-confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={12} />
            </Field>
            {error && <ErrorNote message={error} />}
            <Button type="submit" loading={loading} className="w-full" icon={<KeyRound className="h-4 w-4" />}>Create admin password</Button>
          </form>
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-white/35">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This one-time link expires and cannot be reused.
          </p>
        </div>
      </div>
    </div>
  )
}
