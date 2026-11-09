import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, Star, X } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ------------------------------- Button ------------------------------- */
type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'outline' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'nx-btn-primary',
  danger: 'nx-btn-danger',
  ghost: 'nx-btn-ghost',
  outline: 'nx-btn-outline-blue',
  subtle: 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-[13px] rounded-lg',
  md: '',
  lg: 'px-6 py-3.5 text-base rounded-xl',
  icon: 'p-2.5 rounded-lg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn('nx-btn', VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

interface ButtonLinkProps {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
  icon?: ReactNode
  external?: boolean
  onClick?: () => void
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  external,
  onClick,
}: ButtonLinkProps) {
  const classes = cn('nx-btn', VARIANTS[variant], SIZES[size], className)
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={classes} onClick={onClick}>
        {icon}
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={classes} onClick={onClick}>
      {icon}
      {children}
    </Link>
  )
}

/* -------------------------------- Field -------------------------------- */
interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  htmlFor?: string
  className?: string
}

export function Field({ label, hint, error, required, children, htmlFor, className }: FieldProps) {
  const autoId = useId()
  const labelId = `${autoId}-label`
  const errorId = `${autoId}-error`

  // Label association.
  //
  // Two authoring styles exist in this codebase and both must be accessible:
  //   • <Field label="Email" htmlFor="email"><div><input id="email"/></div></Field>
  //     → the wrapper is not a control, so `for`/`htmlFor` does the work.
  //   • <Field label="Product name"><Input/></Field>
  //     → no id anywhere, so the label was purely decorative and screen readers
  //       announced an unnamed text box. Stamping `aria-labelledby` on the
  //       control fixes that without editing every admin form.
  //
  // Only real controls get stamped. Stamping a wrapper <div> would move the id
  // off the input and BREAK association — that regression is why the check on
  // the element type exists.
  let control: ReactNode = children
  if (label && isValidElement(children)) {
    const el = children as ReactElement<Record<string, unknown>>
    const t = el.type
    const isControl = t === 'input' || t === 'select' || t === 'textarea' || typeof t === 'function'
    if (isControl) {
      control = cloneElement(el, {
        'aria-labelledby':
          (el.props['aria-labelledby'] as string | undefined) ?? labelId,
        ...(error ? { 'aria-invalid': true } : {}),
        ...(error
          ? {
              'aria-describedby':
                (el.props['aria-describedby'] as string | undefined) ?? errorId,
            }
          : {}),
      })
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        // The asterisk sits OUTSIDE the <label> element on purpose. A child
        // would join the label's text content ("Password*"), which breaks
        // exact accessible-name matching. aria-hidden keeps it out of the
        // accessible name entirely; the input still carries `required`.
        <span className="nx-label flex items-baseline gap-0.5">
          <label id={labelId} htmlFor={htmlFor}>
            {label}
          </label>
          {required && (
            <span aria-hidden="true" className="text-[#F00016]">
              *
            </span>
          )}
        </span>
      )}
      {control}
      {error ? (
        <p id={errorId} className="mt-1.5 flex items-center gap-1 text-xs text-rose-400">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-white/40">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cn('nx-input', className)} aria-invalid={invalid || undefined} {...rest} />
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn('nx-input min-h-[110px] resize-y', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('nx-input cursor-pointer appearance-none pr-9', className)} {...rest}>
      {children}
    </select>
  )
}

/* -------------------------------- Badge -------------------------------- */
export function Badge({
  children,
  className,
  dot,
}: {
  children: ReactNode
  className?: string
  dot?: string
}) {
  return (
    <span className={cn('nx-badge', className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {children}
    </span>
  )
}

/* ------------------------------- Spinner ------------------------------- */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-white/60', className)} role="status">
      <Loader2 className="h-5 w-5 animate-spin text-[#008CFF]" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">Loading</span>
    </div>
  )
}

/* ------------------------------ Skeletons ------------------------------ */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('nx-skeleton', className)} aria-hidden />
}

export function ProductCardSkeleton() {
  return (
    <div className="nx-card overflow-hidden p-3">
      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-9" />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------ EmptyState ----------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#008CFF]/20 to-[#F00016]/10 text-[#6EC1FF]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-white/50">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------- ErrorNote ----------------------------- */
export function ErrorNote({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

/* -------------------------------- Rating ------------------------------- */
export function Rating({
  value,
  count,
  size = 13,
  showValue = true,
}: {
  value: number | null
  count?: number
  size?: number
  showValue?: boolean
}) {
  const rating = value ?? 0
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={cn(
              i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-white/10 text-white/15',
            )}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-xs font-medium text-white/60">
          {rating.toFixed(1)}
          {count ? <span className="text-white/35"> ({count})</span> : null}
        </span>
      )}
      <span className="sr-only">{rating.toFixed(1)} out of 5 stars</span>
    </div>
  )
}

/* -------------------------------- Modal -------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'nx-glass relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border-white/10 shadow-2xl sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-white">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-white/50">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/8 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

/* ------------------------------ SectionHead ---------------------------- */
export function SectionHead({
  eyebrow,
  title,
  subtitle,
  action,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: string
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && <span className="nx-eyebrow mb-2">{eyebrow}</span>}
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-white/50 sm:text-[15px]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ------------------------------ Pagination ----------------------------- */
export function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null
  const pages: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }
  return (
    <nav className={cn('flex flex-wrap items-center justify-center gap-1.5', className)} aria-label="Pagination">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        Prev
      </Button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-white/30">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-9 rounded-lg border px-2.5 text-sm font-medium transition',
              p === page
                ? 'border-[#008CFF] bg-[#008CFF] text-white'
                : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white',
            )}
          >
            {p}
          </button>
        ),
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next
      </Button>
    </nav>
  )
}

/* ------------------------------- Tabs ---------------------------------- */
const TabsCtx = createContext<{ value: string; onChange: (v: string) => void } | null>(null)

export function Tabs({
  value,
  onChange,
  children,
  className,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <TabsCtx.Provider value={{ value, onChange }}>
      <div
        role="tablist"
        className={cn('nx-scroll-x gap-1 rounded-xl border border-white/8 bg-white/[0.03] p-1', className)}
      >
        {children}
      </div>
    </TabsCtx.Provider>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)
  const active = ctx?.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx?.onChange(value)}
      className={cn(
        'shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium transition',
        active ? 'bg-[#008CFF] text-white shadow-lg' : 'text-white/55 hover:bg-white/8 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

/* --------------------------- Reveal on scroll -------------------------- */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.05 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('nx-reveal', visible && 'is-visible', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
