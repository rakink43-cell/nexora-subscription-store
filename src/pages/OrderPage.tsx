import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileUp,
  Home,
  Package,
  RefreshCw,
  Send,
  Truck,
  Wallet,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { getOrderToken } from '../lib/orderTokens'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { StatusTimeline } from '../components/order/StatusTimeline'
import { ProductMedia } from '../components/product/ProductMedia'
import {
  Badge,
  Button,
  ButtonLink,
  ErrorNote,
  Field,
  Input,
  Select,
  Spinner,
} from '../components/ui'
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  cn,
  contactLink,
  formatBDT,
  formatDateTime,
  isTrxId,
} from '../lib/utils'
import type { OrderDetail, PaymentMethod } from '../types'

export default function OrderPage() {
  const { orderNumber = '' } = useParams<{ orderNumber: string }>()
  const { user } = useAuth()
  const { settings, paymentMethods } = useStore()
  const toast = useToast()

  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const token = getOrderToken(orderNumber)

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const data = await api.orders.get(orderNumber, token)
        setDetail(data)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `We couldn't find order ${orderNumber}. Check the number and try again.`,
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [orderNumber, token],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="nx-container grid min-h-[50vh] place-items-center">
        <Spinner label="Loading your order…" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="nx-container py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-7 text-center">
          <AlertCircle className="mx-auto h-9 w-9 text-rose-400" aria-hidden />
          <h1 className="mt-3 font-display text-lg font-bold text-white">Order not available</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
            {error ?? 'This order could not be opened in this browser.'}
          </p>
          <p className="mt-3 text-[12px] text-white/40">
            If you checked out as a guest on another device, use the order number and email on the
            tracking page.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <ButtonLink to="/track">Track an order</ButtonLink>
            <ButtonLink to="/contact" variant="ghost">Contact support</ButtonLink>
          </div>
        </div>
      </div>
    )
  }

  const { order, items, payment, history } = detail
  const meta = ORDER_STATUS_META[order.status]
  const needsPayment = order.status === 'pending_payment'
  const methodConfig = paymentMethods.find((m) => m.method === order.payment_method)

  return (
    <div className="nx-container py-8">
      {/* header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-white sm:text-[27px]">
              Order {order.order_number}
            </h1>
            <Badge className={meta.className} dot={meta.dot}>
              {meta.label}
            </Badge>
          </div>
          <p className="mt-1.5 text-[12.5px] text-white/45">
            Placed {formatDateTime(order.created_at)} · {items.length} item{items.length === 1 ? '' : 's'} ·{' '}
            {formatBDT(order.total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            loading={refreshing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
          <ButtonLink to="/dashboard/orders" variant="ghost" size="sm" icon={<Package className="h-3.5 w-3.5" />}>
            My orders
          </ButtonLink>
        </div>
      </div>

      {order.status === 'completed' && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-white">Delivered — enjoy!</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
              Your access details were sent to <b className="text-white/80">{order.customer_email}</b> and
              are visible in your dashboard. Any issue? We replace within 24 hours.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          {/* payment instructions / submission */}
          {needsPayment && (
            <PaymentPanel
              order={order}
              orderNumber={order.order_number}
              token={token}
              methodConfig={methodConfig}
              onSubmitted={() => load(true)}
              toast={toast}
            />
          )}

          {!needsPayment && payment && (
            <section className="nx-card p-5" aria-labelledby="payment-status">
              <h2 id="payment-status" className="mb-3 flex items-center gap-2 font-display text-base font-bold text-white">
                <Wallet className="h-4 w-4 text-[#6EC1FF]" aria-hidden />
                Payment
              </h2>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">Method</p>
                    <p className="text-[13px] font-semibold text-white">
                      {PAYMENT_METHOD_META[payment.method].label}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">Transaction ID</p>
                    <p className="font-mono text-[13px] font-semibold text-white">
                      {payment.transaction_id ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">Amount</p>
                    <p className="text-[13px] font-semibold text-white">{formatBDT(payment.amount)}</p>
                  </div>
                  <Badge className={PAYMENT_STATUS_META[payment.status].className}>
                    {PAYMENT_STATUS_META[payment.status].label}
                  </Badge>
                </div>
                {payment.status === 'submitted' && (
                  <p className="mt-3 border-t border-white/8 pt-2.5 text-[11.5px] leading-relaxed text-sky-300/80">
                    We received your transaction ID and are checking it now. Verification usually takes
                    10–30 minutes during business hours.
                  </p>
                )}
                {payment.status === 'rejected' && (
                  <p className="mt-3 border-t border-white/8 pt-2.5 text-[11.5px] leading-relaxed text-rose-300">
                    We couldn&apos;t verify this transaction. Please contact support on WhatsApp with your
                    order number — we will sort it out quickly.
                  </p>
                )}
                {payment.admin_note && payment.status === 'verified' && (
                  <p className="mt-3 border-t border-white/8 pt-2.5 text-[11.5px] text-white/45">
                    Note from our team: {payment.admin_note}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* items */}
          <section className="nx-card p-5" aria-labelledby="items-heading">
            <h2 id="items-heading" className="mb-3 font-display text-base font-bold text-white">
              Items
            </h2>
            <ul className="divide-y divide-white/8">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <ProductMedia
                    name={item.product_name}
                    imageUrl={item.product_image}
                    size="sm"
                    className="h-11 w-14 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{item.product_name}</p>
                    <p className="text-[11px] text-white/40">
                      {item.duration} · {formatBDT(item.unit_price)} × {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-white">
                    {formatBDT(item.line_total)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 border-t border-white/8 pt-3.5 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-white/45">Subtotal</dt>
                <dd className="text-white/80">{formatBDT(order.subtotal)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <dt>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</dt>
                  <dd>− {formatBDT(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-white/8 pt-1.5 text-[13.5px]">
                <dt className="font-semibold text-white">Total</dt>
                <dd className="font-display font-extrabold text-white">{formatBDT(order.total)}</dd>
              </div>
            </dl>
          </section>

          {/* delivery info */}
          <section className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <Truck className="h-4 w-4 text-[#6EC1FF]" aria-hidden />
              Delivery details
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
              Access details go to <b className="text-white/70">{order.customer_email}</b> and your
              dashboard. Need them sent somewhere else? Message support with your order number.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={contactLink('whatsapp', settings.contact.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="nx-btn nx-btn-ghost px-3 py-2 text-[12px]"
              >
                WhatsApp support
              </a>
              <Link to="/faq" className="nx-btn nx-btn-ghost px-3 py-2 text-[12px]">
                Delivery FAQ
              </Link>
            </div>
          </section>
        </div>

        {/* sidebar: tracking + customer */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="nx-card p-5">
            <h2 className="mb-4 font-display text-base font-bold text-white">Order tracking</h2>
            <StatusTimeline status={order.status} history={history} />
          </div>

          <div className="nx-card p-5">
            <h2 className="mb-3 font-display text-base font-bold text-white">Customer</h2>
            <dl className="space-y-2 text-[12.5px]">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/35">Name</dt>
                <dd className="text-white/80">{order.customer_name}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/35">Email</dt>
                <dd className="break-all text-white/80">{order.customer_email}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-white/35">Phone</dt>
                <dd className="text-white/80">{order.customer_phone}</dd>
              </div>
              {order.customer_note && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-white/35">Note</dt>
                  <dd className="text-white/60">{order.customer_note}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
              <Badge className="border-white/10 bg-white/[0.04] text-white/60">
                {PAYMENT_METHOD_META[order.payment_method].label}
              </Badge>
              {!user && (
                <Link
                  to="/register"
                  className="ml-auto text-[11.5px] font-semibold text-[#6EC1FF] hover:underline"
                >
                  Save to an account
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <p className="text-[12.5px] text-white/45">Keep your order number safe: <b className="font-mono text-white/80">{order.order_number}</b></p>
        <div className="flex gap-2">
          <ButtonLink to="/" variant="ghost" size="sm" icon={<Home className="h-3.5 w-3.5" />}>
            Home
          </ButtonLink>
          <ButtonLink to="/products" size="sm" icon={<ArrowRight className="h-3.5 w-3.5" />}>
            Keep shopping
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Payment submission panel                                            */
/* ------------------------------------------------------------------ */
function PaymentPanel({
  order,
  orderNumber,
  token,
  methodConfig,
  onSubmitted,
  toast,
}: {
  order: OrderDetail['order']
  orderNumber: string
  token: string | null
  methodConfig: ReturnType<typeof Object> | undefined
  onSubmitted: () => void
  toast: ReturnType<typeof Object>
}) {
  const config = methodConfig as
    | {
        account_number: string
        account_name: string | null
        bank_name: string | null
        branch: string | null
        routing_number: string | null
        instructions: string | null
        display_name: string
      }
    | undefined

  const [method, setMethod] = useState<PaymentMethod>(order.payment_method)
  const [trxId, setTrxId] = useState('')
  const [sender, setSender] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isTrxId(trxId)) {
      setError('Enter the transaction ID from your payment confirmation (4–40 characters).')
      return
    }
    setSubmitting(true)
    try {
      let proofUrl: string | undefined
      if (file) {
        proofUrl = await api.orders.uploadProof(orderNumber, file)
      }
      await api.orders.submitPayment({
        orderNumber,
        token,
        method,
        transactionId: trxId.trim(),
        senderNumber: sender.trim() || undefined,
        amount: Number(order.total),
        proofUrl,
      })
      toast.success('Payment submitted', 'Our team will verify it shortly.')
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#008CFF]/25 bg-gradient-to-br from-[#008CFF]/[0.08] via-[#0B111D] to-[#0B111D] p-5"
      aria-labelledby="pay-heading"
    >
      <h2 id="pay-heading" className="flex items-center gap-2 font-display text-base font-bold text-white">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[#008CFF] text-[11px] font-bold text-white">₳</span>
        Complete your payment
      </h2>
      <p className="mt-1 text-[12px] text-white/45">
        Send <b className="text-white/80">{formatBDT(order.total)}</b> then submit the transaction ID below.
      </p>

      {config && (
        <div className="mt-3.5 rounded-xl border border-white/10 bg-black/35 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/35">
                {config.bank_name ? 'Bank account' : 'Send money to'}
              </p>
              <p className="mt-0.5 font-display text-lg font-bold tracking-wide text-white">
                {config.account_number}
              </p>
              {config.bank_name && (
                <p className="text-[11px] text-white/45">
                  {config.bank_name}
                  {config.branch ? ` · ${config.branch}` : ''}
                  {config.routing_number ? ` · Routing ${config.routing_number}` : ''}
                </p>
              )}
              <p className="text-[11px] text-white/45">Account name: {config.account_name}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(config.account_number)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1800)
                } catch {
                  /* ignore */
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[11.5px] font-medium text-white/80 transition hover:border-[#008CFF]/50"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy number'}
            </button>
          </div>
          {config.instructions && (
            <p className="mt-2.5 border-t border-white/8 pt-2.5 text-[11.5px] leading-relaxed text-white/50">
              {config.instructions}
            </p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment method" htmlFor="pay-method" required>
            <Select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="text-[13px]"
            >
              {(['bkash', 'nagad', 'bank_transfer'] as PaymentMethod[]).map((m) => (
                <option key={m} value={m} className="bg-[#0B111D]">
                  {PAYMENT_METHOD_META[m].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Transaction ID (TrxID)"
            required
            htmlFor="trx"
            hint="Found in your bKash/Nagad confirmation message"
          >
            <Input
              id="trx"
              value={trxId}
              onChange={(e) => setTrxId(e.target.value.toUpperCase())}
              placeholder="e.g. 9F2X7K1QAB"
              className="font-mono"
              invalid={Boolean(error)}
            />
          </Field>
          <Field label="Sender number (optional)" htmlFor="sender">
            <Input
              id="sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="The number you paid from"
              inputMode="tel"
            />
          </Field>
          <Field label="Payment screenshot (optional)" htmlFor="proof" hint="JPG, PNG or PDF · max 5 MB">
            <label
              htmlFor="proof"
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2.5 text-[12px] text-white/50 transition hover:border-[#008CFF]/50 hover:text-white',
              )}
            >
              <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{file ? file.name : 'Choose a file'}</span>
              {file && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.preventDefault()
                    setFile(null)
                  }}
                  aria-label="Remove file"
                  className="ml-auto rounded p-0.5 text-white/40 hover:text-rose-400"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </label>
            <input
              id="proof"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>

        {error && <ErrorNote message={error} />}

        <Button type="submit" loading={submitting} className="w-full" icon={submitting ? undefined : <Send className="h-4 w-4" />}>
          {submitting ? 'Submitting payment…' : 'Submit payment for verification'}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-white/35">
          We never mark an order as paid automatically — a person checks every transaction.
        </p>
      </form>
    </section>
  )
}
