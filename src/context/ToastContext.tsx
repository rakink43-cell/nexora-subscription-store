import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

interface ToastApi {
  toast: (kind: ToastKind, title: string, description?: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | undefined>(undefined)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, description }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6500 : 4200)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (t, d) => toast('success', t, d),
      error: (t, d) => toast('error', t, d),
      info: (t, d) => toast('info', t, d),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl',
                'nx-page-enter',
                STYLES[t.kind],
              )}
            >
              <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-white/70">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-white/50 transition hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
