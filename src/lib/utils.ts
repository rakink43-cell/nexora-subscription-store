import clsx, { type ClassValue } from 'clsx'
import type { Availability, OrderStatus, PaymentMethod, PaymentStatus } from '../types'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

/* ------------------------------ currency ------------------------------ */
export function formatBDT(value: number | string | null | undefined, withSymbol = true): string {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return withSymbol ? '৳0' : '0'
  const formatted = new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(n)
  return withSymbol ? `৳${formatted}` : formatted
}

export function discountPercent(original: number, discounted: number): number {
  if (!original || original <= 0) return 0
  const pct = ((original - discounted) / original) * 100
  return pct > 0.5 ? Math.round(pct) : 0
}

/* ------------------------------ dates ------------------------------ */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

/* ------------------------------ text ------------------------------ */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/* ------------------------------ validators ------------------------------ */
export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i.test(v.trim())

export const isBDPhone = (v: string) => /^(\+?88)?01[3-9]\d{8}$/.test(v.replace(/[\s-]/g, ''))

export const normalizePhone = (v: string) => v.replace(/[\s-]/g, '').replace(/^\+?88/, '')

export const isTrxId = (v: string) => /^[A-Za-z0-9-]{4,40}$/.test(v.trim())

export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  return { score, label: labels[Math.min(score, 5)] }
}

/* ------------------------------ status meta ------------------------------ */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; short: string; className: string; dot: string; step: number; description: string }
> = {
  pending_payment: {
    label: 'Pending Payment',
    short: 'Pending',
    className: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    step: 0,
    description: 'Send the payment using the instructions, then submit your transaction ID.',
  },
  payment_submitted: {
    label: 'Payment Submitted',
    short: 'Submitted',
    className: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
    step: 1,
    description: 'We received your transaction ID and are verifying it.',
  },
  payment_verified: {
    label: 'Payment Verified',
    short: 'Verified',
    className: 'bg-indigo-500/12 text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-400',
    step: 2,
    description: 'Payment confirmed. Your subscription is queued for activation.',
  },
  processing: {
    label: 'Processing',
    short: 'Processing',
    className: 'bg-violet-500/12 text-violet-300 border-violet-500/30',
    dot: 'bg-violet-400',
    step: 3,
    description: 'We are activating your subscription right now.',
  },
  completed: {
    label: 'Completed',
    short: 'Completed',
    className: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
    step: 4,
    description: 'Delivered. Check your email and dashboard for access details.',
  },
  cancelled: {
    label: 'Cancelled',
    short: 'Cancelled',
    className: 'bg-rose-500/12 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
    step: -1,
    description: 'This order was cancelled. Contact support if this was unexpected.',
  },
  refunded: {
    label: 'Refunded',
    short: 'Refunded',
    className: 'bg-slate-500/12 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400',
    step: -1,
    description: 'The amount was refunded to your original payment method.',
  },
}

export const ORDER_FLOW: OrderStatus[] = [
  'pending_payment',
  'payment_submitted',
  'payment_verified',
  'processing',
  'completed',
]

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'payment_submitted',
  'payment_verified',
  'processing',
  'completed',
  'cancelled',
  'refunded',
]

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; accent: string; bg: string; note: string; short: string }
> = {
  bkash: {
    label: 'bKash',
    accent: '#E2136E',
    bg: 'from-[#E2136E]/20 to-[#E2136E]/5',
    note: 'Send Money · instant',
    short: 'bKash',
  },
  nagad: {
    label: 'Nagad',
    accent: '#F5821F',
    bg: 'from-[#F5821F]/20 to-[#F5821F]/5',
    note: 'Send Money · instant',
    short: 'Nagad',
  },
  bank_transfer: {
    label: 'Bank Transfer',
    accent: '#008CFF',
    bg: 'from-[#008CFF]/20 to-[#008CFF]/5',
    note: 'BEFTN / NPSB',
    short: 'Bank',
  },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting payment', className: 'bg-amber-500/12 text-amber-300 border-amber-500/30' },
  submitted: { label: 'Under review', className: 'bg-sky-500/12 text-sky-300 border-sky-500/30' },
  verified: { label: 'Verified', className: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/30' },
  rejected: { label: 'Rejected', className: 'bg-rose-500/12 text-rose-300 border-rose-500/30' },
}

export const AVAILABILITY_META: Record<Availability, { label: string; className: string; dot: string }> = {
  in_stock: {
    label: 'In Stock',
    className: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  limited: {
    label: 'Limited',
    className: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
    dot: 'bg-amber-400',
  },
  out_of_stock: {
    label: 'Out of Stock',
    className: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
    dot: 'bg-rose-400',
  },
}

/* ------------------------------ misc ------------------------------ */
/** Deterministic accent per brand name → keeps generated product tiles varied. */
export function brandGradient(seed: string): string {
  const palettes = [
    'from-[#0B63C5] via-[#0A4F9E] to-[#071B33]',
    'from-[#C4001A] via-[#8E0013] to-[#2A0006]',
    'from-[#134E6F] via-[#0E3A52] to-[#06121B]',
    'from-[#5B21B6] via-[#3F1785] to-[#150A28]',
    'from-[#0F766E] via-[#0B544E] to-[#04211F]',
    'from-[#B45309] via-[#8A3F07] to-[#2A1203]',
    'from-[#1E3A8A] via-[#172B63] to-[#0A1128]',
    'from-[#9D174D] via-[#76113A] to-[#28041A]',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000
  return palettes[hash % palettes.length]
}

export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

export function contactLink(kind: 'whatsapp' | 'call' | 'email', value: string): string {
  if (kind === 'whatsapp') {
    const digits = value.replace(/\D/g, '').replace(/^0/, '880')
    return `https://wa.me/${digits}`
  }
  if (kind === 'call') return `tel:${value.replace(/\s/g, '')}`
  return `mailto:${value}`
}

export function trackEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  // First-party, PII-free funnel signal. Fire-and-forget; never blocks the UI.
  import('./api').then(({ trackEvent: track }) => track(eventName, metadata)).catch(() => {})
}
