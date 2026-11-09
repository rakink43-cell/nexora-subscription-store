import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../ui'

/**
 * Route guards are UX only — real authorisation is enforced by
 * Supabase RLS + SECURITY DEFINER RPCs (see supabase/migrations).
 * Even a hand-crafted /admin request cannot read another customer's data.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="nx-container grid min-h-[60vh] place-items-center">
        <Spinner label="Checking your session…" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, role } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="nx-container grid min-h-[60vh] place-items-center">
        <Spinner label="Verifying administrator access…" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  if (!isAdmin) {
    return (
      <div className="nx-container py-20">
        <div className="mx-auto max-w-md rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-rose-500/15 text-rose-400">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-display text-xl font-bold text-white">Administrator access required</h1>
          <p className="mt-2 text-sm text-white/50">
            Your account ({user.email}) has the role <b className="text-white/70">{role}</b>. If you
            should be an admin, ask the store owner to grant your role — it is enforced server-side by
            the database, not by this message.
          </p>
          <p className="mt-4 rounded-lg border border-white/8 bg-black/30 px-3 py-2 text-left font-mono text-[11px] text-white/40">
            select public.bootstrap_admin('your@email.com', 'secret');
          </p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
