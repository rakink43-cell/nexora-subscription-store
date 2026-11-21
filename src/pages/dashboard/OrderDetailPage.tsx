import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Copy, Check, Clock, Mail, Wallet, FileUp } from 'lucide-react'
import { api } from '../../lib/api'
import { getOrderToken } from '../../lib/orderTokens'
import { StatusTimeline } from '../../components/order/StatusTimeline'
import { ProductMedia } from '../../components/product/ProductMedia'
import { Badge, ButtonLink, EmptyState, ErrorNote, Field, Input, Select, Spinner } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useStore } from '../../context/SettingsContext'
import {
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  formatBDT,
  formatDateTime,
  isTrxId,
} from '../../lib/utils'
import { Button } from '../../components/ui'
import type { OrderDetail, PaymentMethod } from '../../types'

export default function OrderDetailPage() {
  const { orderNumber = '' } = useParams<{ orderNumber: string }>()
  const toast = useToast()
  const { paymentMethods } = useStore()
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [trxId, setTrxId] = useState('')
  const [sender, setSender] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('bkash')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api.orders
      .get(orderNumber, getOrderToken(orderNumber))
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this order.'))
      .finally(() => setLoading(false))
  }, [orderNumber])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (detail?.order.payment_method) setMethod(detail.order.payment_method)
  }, [detail?.order.payment_method])

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner label="Loading order…" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-5 w-5" />}
        title="Order not available"
        description={error ?? 'This order could not be opened.'}
        action={<ButtonLink to="/dashboard/orders" size="sm">Back to orders</ButtonLink>}
      />
    )
  }

  const { order, items, payment, history } = detail
  const meta = ORDER_STATUS_META[order.status]
  const canSubmit = order.status === 'pending_payment'
  const activeMethods = paymentMethods.filter((item) => item.is_active && item.payment_type === 'manual')
  const selectedMethod = activeMethods.find((item) => item.method === method) ?? activeMethods.find((item) => item.method === order.payment_method)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!isTrxId(trxId)) {
      setFormError('Enter the transaction ID from your payment confirmation.')
      return
    }
    setSubmitting(true)
    try {
      const proofUrl = proofFile
        ? await api.orders.uploadProof(order.order_number, proofFile)
        : undefined
      await api.orders.submitPayment({
        orderNumber: order.order_number,
        token: getOrderToken(order.order_number),
        method,
        transactionId: trxId,
        senderNumber: sender || undefined,
        amount: Number(order.total),
        proofUrl,
      })
      toast.success('Payment submitted', 'We will verify it shortly.')
      setTrxId('')
      setSender('')
      setProofFile(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit payment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="nx-game-order-detail">
      <Link
        to="/dashboard/orders"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All orders
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-mono font-display text-lg font-bold text-white">{order.order_number}</h2>
        <Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>
      </div>
      <p className="mb-4 text-[12px] text-white/40">
        Placed {formatDateTime(order.created_at)} · Total {formatBDT(order.total)}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-4">
          {canSubmit && payment && (
            <div className="rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/[0.06] p-4">
              <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
                <Wallet className="h-4 w-4 text-[#6EC1FF]" aria-hidden />
                Submit your payment
              </h3>
              <p className="mt-1 text-[12px] text-white/50">
                Send <b className="text-white/80">{formatBDT(order.total)}</b> using the payment details below, then paste the transaction ID.
              </p>
              {selectedMethod && (
                <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{selectedMethod.display_name}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <code className="break-all font-mono text-[13px] font-semibold text-white">{selectedMethod.account_number}</code>
                    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(selectedMethod.account_number); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { /* ignore */ } }} aria-label="Copy payment number" className="rounded p-1 text-white/40 transition hover:text-[#6EC1FF]">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {selectedMethod.account_name && <p className="mt-1 text-[11px] text-white/45">Account name: {selectedMethod.account_name}</p>}
                  {selectedMethod.bank_name && <p className="text-[11px] text-white/45">{selectedMethod.bank_name}{selectedMethod.branch ? ` · ${selectedMethod.branch}` : ''}{selectedMethod.routing_number ? ` · Routing ${selectedMethod.routing_number}` : ''}</p>}
                  {selectedMethod.instructions && <p className="mt-2 border-t border-white/8 pt-2 text-[11px] leading-relaxed text-white/50">{selectedMethod.instructions}</p>}
                </div>
              )}

              <form onSubmit={submit} className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <Field label="Method" htmlFor="m">
                  <Select id="m" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="py-2 text-[12.5px]">
                    {(activeMethods.length ? activeMethods : [{ method, display_name: PAYMENT_METHOD_META[method]?.label ?? method }]).map((m) => (
                      <option key={m.method} value={m.method} className="bg-[#0B111D]">
                        {'display_name' in m ? m.display_name : m.method}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Transaction ID" htmlFor="t" required>
                  <Input
                    id="t"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                    placeholder="9F2X7K1QAB"
                    className="py-2 font-mono text-[12.5px]"
                  />
                </Field>
                <Field label="Payment screenshot (optional)" htmlFor="proof" hint="JPG, PNG, WEBP or PDF · max 5 MB">
                  <label htmlFor="proof" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2.5 text-[12px] text-white/50 hover:border-[#008CFF]/50 hover:text-white">
                    <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{proofFile?.name ?? 'Choose a payment proof file'}</span>
                  </label>
                  <input id="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
                </Field>
                <Field label="Sender number (optional)" htmlFor="s">
                  <Input
                    id="s"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="py-2 text-[12.5px]"
                  />
                </Field>
                <div className="flex items-end">
                  <Button type="submit" loading={submitting} className="w-full py-2.5 text-[12.5px]">
                    Submit for verification
                  </Button>
                </div>
                {formError && <div className="sm:col-span-2"><ErrorNote message={formError} /></div>}
              </form>
            </div>
          )}

          <div className="nx-card p-4">
            <h3 className="mb-2.5 text-[13.5px] font-semibold text-white">Items</h3>
            <ul className="divide-y divide-white/8">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ProductMedia name={item.product_name} imageUrl={item.product_image} size="sm" className="h-10 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white">{item.product_name}</p>
                    <p className="text-[11px] text-white/40">
                      {item.duration} · {formatBDT(item.unit_price)} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-[12.5px] font-semibold text-white">{formatBDT(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-white/8 pt-2.5 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-white/40">Subtotal</dt>
                <dd className="text-white/75">{formatBDT(order.subtotal)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <dt>Discount</dt>
                  <dd>− {formatBDT(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <dt className="text-white">Total</dt>
                <dd className="text-white">{formatBDT(order.total)}</dd>
              </div>
            </dl>
          </div>

          {payment && !canSubmit && (
            <div className="nx-card p-4">
              <h3 className="mb-2.5 text-[13.5px] font-semibold text-white">Payment</h3>
              <div className="flex flex-wrap items-center gap-4 text-[12px]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">Method</p>
                  <p className="text-white/80">{PAYMENT_METHOD_META[payment.method].label}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">Transaction</p>
                  <p className="font-mono text-white/80">{payment.transaction_id ?? '—'}</p>
                </div>
                <Badge className={PAYMENT_STATUS_META[payment.status].className}>
                  {PAYMENT_STATUS_META[payment.status].label}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="nx-card p-4">
            <h3 className="mb-3 text-[13.5px] font-semibold text-white">Tracking</h3>
            <StatusTimeline status={order.status} history={history} />
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Mail className="h-3 w-3" aria-hidden />
              Delivered to {order.customer_email}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/45">
              <Clock className="h-3 w-3" aria-hidden />
              Usually within 30 minutes of verification
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
