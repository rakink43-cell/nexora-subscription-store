import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Copy,
  Lock,
  Loader2,
  ShoppingBag,
  Ticket,
  Wallet,
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { saveOrderToken } from '../lib/orderTokens'
import { ProductMedia } from '../components/product/ProductMedia'
import { Button, ButtonLink, ErrorNote, Field, Input } from '../components/ui'
import {
  PAYMENT_METHOD_META,
  cn,
  formatBDT,
  isBDPhone,
  isEmail,
} from '../lib/utils'
import type { PaymentMethod } from '../types'

export default function CheckoutPage() {
  const { lines, subtotal, count, clear } = useCart()
  const { user } = useAuth()
  const { paymentMethods, settings } = useStore()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', note: '' })
  const [method, setMethod] = useState<PaymentMethod>('bkash')
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; discount: number; description?: string } | null>(null)
  const [couponBusy, setCouponBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        fullName: f.fullName || user.full_name || '',
        email: f.email || user.email || '',
        phone: f.phone || user.phone || '',
      }))
    }
  }, [user])

  const activeMethods = useMemo(
    () => (paymentMethods.length ? paymentMethods : []),
    [paymentMethods],
  )

  useEffect(() => {
    if (activeMethods.length && !activeMethods.some((m) => m.method === method)) {
      setMethod(activeMethods[0].method)
    }
  }, [activeMethods, method])

  const discount = coupon?.discount ?? 0
  const total = Math.max(0, subtotal - discount)
  const selectedMethod = activeMethods.find((m) => m.method === method)

  if (lines.length === 0) {
    return (
      <div className="nx-container py-16 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 text-white/20" aria-hidden />
        <h1 className="mt-3 font-display text-xl font-bold text-white">Nothing to check out</h1>
        <p className="mt-1 text-[13px] text-white/45">Your cart is empty — add a subscription first.</p>
        <ButtonLink to="/products" className="mt-5">Browse subscriptions</ButtonLink>
      </div>
    )
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (form.fullName.trim().length < 2) next.fullName = 'Please enter your full name.'
    if (!isEmail(form.email)) next.email = 'Enter a valid email address (we deliver here).'
    if (!isBDPhone(form.phone)) next.phone = 'Enter a valid Bangladeshi number, e.g. 01712345678.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) return
    setCouponBusy(true)
    try {
      const result = await api.coupons.validate(code, subtotal)
      if (result.valid) {
        setCoupon({
          code: code.toUpperCase(),
          discount: Number(result.discount ?? 0),
          description: result.description ?? undefined,
        })
        toast.success('Coupon applied', result.description ?? `You saved ${formatBDT(Number(result.discount))}`)
      } else {
        setCoupon(null)
        toast.error('Coupon not applied', result.message)
      }
    } catch (err) {
      toast.error('Coupon not applied', err instanceof Error ? err.message : 'Please try again.')
    } finally {
      setCouponBusy(false)
    }
  }

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      toast.error('Could not copy', 'Please copy the number manually.')
    }
  }

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) {
      document.getElementById('checkout-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setSubmitting(true)
    try {
      const result = await api.orders.place({
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        customer_name: form.fullName.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim(),
        customer_note: form.note.trim() || '',
        payment_method: method,
        coupon_code: coupon?.code,
      })

      saveOrderToken(result.orderNumber, result.accessToken)
      clear()
      toast.success('Order created', `${result.orderNumber} · ${formatBDT(result.total)}`)
      navigate(`/order/${result.orderNumber}`, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not place your order.'
      setSubmitError(message)
      toast.error('Order failed', message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="nx-container py-8">
      <div className="mb-6">
        <Link
          to="/cart"
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to cart
        </Link>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-[13px] text-white/45">
          Step 1 of 2 — confirm your details and choose how you want to pay.
        </p>
      </div>

      {submitError && <ErrorNote message={submitError} className="mb-5" />}

      <form id="checkout-form" onSubmit={placeOrder} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {/* customer details */}
          <section className="nx-card p-5" aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="mb-4 flex items-center gap-2 font-display text-base font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[#008CFF]/15 text-[11px] font-bold text-[#6EC1FF]">1</span>
              Customer information
            </h2>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Full name" required error={errors.fullName} htmlFor="fullName">
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Tanvir Ahmed"
                  autoComplete="name"
                  invalid={Boolean(errors.fullName)}
                />
              </Field>
              <Field
                label="Email address"
                required
                error={errors.email}
                hint="Access details are delivered here"
                htmlFor="email"
              >
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  autoComplete="email"
                  invalid={Boolean(errors.email)}
                />
              </Field>
              <Field label="Mobile number" required error={errors.phone} hint="For delivery updates on WhatsApp" htmlFor="phone">
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01712345678"
                  inputMode="tel"
                  autoComplete="tel"
                  invalid={Boolean(errors.phone)}
                />
              </Field>
              <Field label="Order note (optional)" htmlFor="note">
                <Input
                  id="note"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Anything we should know?"
                />
              </Field>
            </div>

            {!user && (
              <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11.5px] text-white/45">
                Checking out as a guest. You can track this order with its order number, or{' '}
                <Link to="/register" className="font-semibold text-[#6EC1FF] hover:underline">
                  create an account
                </Link>{' '}
                to keep everything in one place.
              </p>
            )}
          </section>

          {/* payment method */}
          <section className="nx-card p-5" aria-labelledby="payment-heading">
            <h2 id="payment-heading" className="mb-1 flex items-center gap-2 font-display text-base font-bold text-white">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[#008CFF]/15 text-[11px] font-bold text-[#6EC1FF]">2</span>
              Payment method
            </h2>
            <p className="mb-4 text-[12px] text-white/40">
              We verify every payment by hand — nothing is auto-charged.
            </p>

            {activeMethods.length === 0 ? (
              <ErrorNote message="No payment methods are configured yet. Please contact support." />
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {activeMethods.map((m) => {
                    const meta = PAYMENT_METHOD_META[m.method]
                    const active = method === m.method
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.method)}
                        aria-pressed={active}
                        className={cn(
                          'relative overflow-hidden rounded-xl border p-3 text-left transition',
                          active
                            ? 'border-[#008CFF] bg-[#008CFF]/10 shadow-[0_0_0_1px_rgba(0,140,255,0.4)]'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-extrabold text-white"
                            style={{ backgroundColor: `${meta.accent}22`, color: meta.accent }}
                          >
                            {m.display_name.slice(0, 1)}
                          </span>
                          {active && (
                            <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-[#008CFF]" style={{ height: '1.1rem', width: '1.1rem' }}>
                              <Check className="h-3 w-3 text-white" aria-hidden />
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[13px] font-semibold text-white">{m.display_name}</p>
                        <p className="text-[10.5px] text-white/40">{meta.note}</p>
                      </button>
                    )
                  })}
                </div>

                {selectedMethod && (
                  <div className="mt-4 rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/[0.06] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          {selectedMethod.bank_name ? 'Bank account' : 'Send money to'}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="font-display text-lg font-bold tracking-wide text-white">
                            {selectedMethod.account_number}
                          </p>
                          <button
                            type="button"
                            onClick={() => copy(selectedMethod.account_number, 'number')}
                            className="rounded p-1 text-white/40 transition hover:text-[#6EC1FF]"
                            aria-label="Copy account number"
                          >
                            {copied === 'number' ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {selectedMethod.bank_name && (
                          <p className="mt-0.5 text-[11.5px] text-white/50">
                            {selectedMethod.bank_name}
                            {selectedMethod.branch ? ` · ${selectedMethod.branch}` : ''}
                            {selectedMethod.routing_number ? ` · Routing ${selectedMethod.routing_number}` : ''}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11.5px] text-white/50">
                          Account name: <b className="text-white/75">{selectedMethod.account_name}</b>
                          {selectedMethod.account_type ? ` (${selectedMethod.account_type})` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Exact amount</p>
                        <p className="font-display text-lg font-extrabold text-[#7CC7FF]">{formatBDT(total)}</p>
                      </div>
                    </div>

                    {selectedMethod.instructions && (
                      <p className="mt-3 whitespace-pre-line border-t border-[#008CFF]/15 pt-3 text-[12px] leading-relaxed text-white/55">
                        {selectedMethod.instructions}
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-white/40">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                  {settings.notices?.checkout_note ??
                    'After placing the order you will submit your transaction ID. Our team verifies it before delivery.'}
                </p>
              </>
            )}
          </section>

          {/* delivery note */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden />
              What happens next
            </h3>
            <ol className="mt-2 space-y-1.5 text-[12px] text-white/45">
              <li>1. You place the order — it is saved as <b className="text-white/70">Pending Payment</b>.</li>
              <li>2. Send the exact amount, then submit your transaction ID on the next screen.</li>
              <li>3. We verify it (usually within 30 minutes) and deliver to your email + dashboard.</li>
            </ol>
          </section>
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="nx-card p-5">
            <h2 className="font-display text-base font-bold text-white">Order summary</h2>

            <ul className="mt-3.5 space-y-2.5">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-2.5">
                  <ProductMedia
                    name={l.name}
                    brand={l.brand}
                    imageUrl={l.image_url}
                    size="sm"
                    className="h-10 w-12 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white">{l.name}</p>
                    <p className="text-[10.5px] text-white/40">
                      {l.duration} · × {l.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold text-white">
                    {formatBDT(l.unitPrice * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* coupon */}
            <div className="mt-4 border-t border-white/8 pt-4">
              <label htmlFor="coupon" className="nx-label flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" aria-hidden />
                Coupon code
              </label>
              <div className="flex gap-1.5">
                <Input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="NEXORA10"
                  className="text-[13px]"
                  disabled={Boolean(coupon)}
                />
                {coupon ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCoupon(null)
                      setCouponInput('')
                    }}
                    className="shrink-0"
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyCoupon}
                    loading={couponBusy}
                    className="shrink-0"
                  >
                    Apply
                  </Button>
                )}
              </div>
              {coupon && (
                <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-emerald-400">
                  <Check className="h-3 w-3" aria-hidden />
                  {coupon.code} applied {coupon.description ? `· ${coupon.description}` : ''}
                </p>
              )}
            </div>

            <dl className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-white/50">Subtotal ({count})</dt>
                <dd className="font-medium text-white">{formatBDT(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <dt>Coupon discount</dt>
                  <dd className="font-medium">− {formatBDT(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-white/50">Delivery</dt>
                <dd className="font-medium text-emerald-400">Free</dd>
              </div>
              <div className="nx-divider my-1" />
              <div className="flex items-baseline justify-between">
                <dt className="text-[13px] font-semibold text-white">Total payable</dt>
                <dd className="font-display text-xl font-extrabold text-white">{formatBDT(total)}</dd>
              </div>
            </dl>

            <Button
              type="submit"
              size="lg"
              className="mt-4 w-full"
              loading={submitting}
              icon={submitting ? undefined : <Lock className="h-4 w-4" />}
            >
              {submitting ? 'Creating order…' : `Place Order · ${formatBDT(total)}`}
            </Button>

            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-white/35">
              No payment is taken automatically. You will be asked for your transaction ID next.
            </p>

            <div className="mt-3 flex items-center justify-center gap-3 border-t border-white/8 pt-3 text-[10.5px] text-white/30">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" aria-hidden /> bKash
              </span>
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" aria-hidden /> Nagad
              </span>
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" aria-hidden /> Bank
              </span>
            </div>
          </div>

          {submitting && (
            <p className="mt-3 flex items-center justify-center gap-2 text-[11.5px] text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Securing your order…
            </p>
          )}
        </aside>
      </form>
    </div>
  )
}
