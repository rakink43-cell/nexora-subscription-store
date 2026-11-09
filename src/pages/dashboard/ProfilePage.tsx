import { useState } from 'react'
import { Lock, Save, ShieldCheck, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { api, isDemoMode } from '../../lib/api'
import { Button, ErrorNote, Field, Input } from '../../components/ui'
import { isBDPhone } from '../../lib/utils'

export default function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    city: user?.city ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.full_name.trim().length < 2) return setError('Enter your full name.')
    if (form.phone && !isBDPhone(form.phone)) return setError('Enter a valid Bangladeshi mobile number.')
    setSaving(true)
    try {
      await updateProfile(form)
      toast.success('Profile updated', 'Your details have been saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (password.length < 8) return setPwError('Use at least 8 characters.')
    if (password !== confirm) return setPwError('Passwords do not match.')
    if (!('changePassword' in api.auth)) {
      return setPwError('Password changes require a connected Supabase project.')
    }
    setPwSaving(true)
    try {
      await (api.auth as { changePassword: (p: string) => Promise<void> }).changePassword(password)
      toast.success('Password updated')
      setPassword('')
      setConfirm('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not update your password.')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="nx-card p-5">
        <h2 className="font-display text-base font-bold text-white">Profile details</h2>
        <p className="mt-1 text-[12px] text-white/45">
          Keep these up to date — we use them for delivery and support.
        </p>

        <form onSubmit={save} className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name" required htmlFor="name">
            <Input
              id="name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </Field>
          <Field label="Email" htmlFor="email" hint="Contact support to change your email">
            <Input id="email" value={user?.email ?? ''} disabled />
          </Field>
          <Field label="Mobile number" htmlFor="phone">
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              inputMode="tel"
              placeholder="01712345678"
            />
          </Field>
          <Field label="City" htmlFor="city">
            <Input
              id="city"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Dhaka"
            />
          </Field>
          <Field label="Address" htmlFor="address" className="sm:col-span-2">
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="House, road, area"
            />
          </Field>

          {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}

          <div className="sm:col-span-2">
            <Button type="submit" loading={saving} icon={<Save className="h-3.5 w-3.5" />}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      <div className="nx-card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-white">
          <Lock className="h-4 w-4 text-[#6EC1FF]" aria-hidden />
          Password
        </h2>
        <p className="mt-1 text-[12px] text-white/45">
          {isDemoMode
            ? 'Demo mode — password changes are stored in this browser only.'
            : 'Use at least 8 characters with a mix of letters and numbers.'}
        </p>

        <form onSubmit={changePassword} className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <Field label="New password" htmlFor="pw">
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password" htmlFor="pw2">
            <Input
              id="pw2"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </Field>
          {pwError && <div className="sm:col-span-2"><ErrorNote message={pwError} /></div>}
          <div className="sm:col-span-2">
            <Button type="submit" variant="ghost" loading={pwSaving} icon={<ShieldCheck className="h-3.5 w-3.5" />}>
              Update password
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-[12px] leading-relaxed text-white/45">
          <b className="text-white/70">Security note:</b> your profile columns are protected by
          database policies — you can only edit your own name, phone, city and address. Role and
          account status are locked to server-side administration.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-300 transition hover:text-rose-200"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Sign out of this device
        </button>
      </div>
    </div>
  )
}
