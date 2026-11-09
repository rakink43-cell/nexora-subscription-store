import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  StickyNote,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable } from '../../components/admin/AdminUI'
import { StatusTimeline } from '../../components/order/StatusTimeline'
import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import {
  ALL_ORDER_STATUSES,
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  cn,
  formatBDT,
  formatDateTime,
} from '../../lib/utils'
import type { Order, OrderDetail, OrderStatus } from '../../types'

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all')
  const [activeOrder, setActiveOrder] = useState<OrderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.admin.orders({ search, status })
      setOrders(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 220)
    return () => window.clearTimeout(t)
  }, [load])

  useEffect(() => {
    const next = new URLSearchParams()
    if (search) next.set('search', search)
    if (status !== 'all') next.set('status', status)
    setSearchParams(next, { replace: true })
  }, [search, status, setSearchParams])

  const openOrder = async (orderId: string) => {
    setDetailLoading(true)
    try {
      const detail = await api.admin.orderDetail(orderId)
      setActiveOrder(detail)
    } catch (err) {
      toast.error('Could not open order', err instanceof Error ? err.message : undefined)
    } finally {
      setDetailLoading(false)
    }
  }

  // open from dashboard/notification deep link
  useEffect(() => {
    const target = searchParams.get('order')
    if (!target || loading || activeOrder) return
    const match = orders.find((o) => o.order_number === target)
    if (match) void openOrder(match.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, orders, searchParams])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of orders) map[o.status] = (map[o.status] ?? 0) + 1
    return map
  }, [orders])

  const exportCsv = () => {
    const header = ['Order', 'Customer', 'Email', 'Phone', 'Total', 'Status', 'Method', 'Date']
    const rows = orders.map((o) => [
      o.order_number,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.total,
      o.status,
      o.payment_method,
      o.created_at,
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexora-orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export ready', `${orders.length} orders exported to CSV`)
  }

  return (
    <div>
      <AdminHeader
        title="Orders"
        description="Verify payments, update statuses and manage every customer order."
        action={
          <>
            <Button variant="ghost" size="sm" onClick={() => void load()} loading={loading} icon={<RefreshCw className="h-3.5 w-3.5" />}>
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={exportCsv} icon={<Download className="h-3.5 w-3.5" />}>
              Export CSV
            </Button>
          </>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number, name, email or phone…"
            className="py-2 pl-8 text-[12.5px]"
            aria-label="Search orders"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="py-2 text-[12.5px] sm:w-56"
          aria-label="Filter by status"
        >
          <option value="all" className="bg-[#0B111D]">All statuses</option>
          {ALL_ORDER_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[#0B111D]">
              {ORDER_STATUS_META[s].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="nx-scroll-x mb-3">
        <button
          type="button"
          onClick={() => setStatus('all')}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium transition',
            status === 'all'
              ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
              : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white',
          )}
        >
          All
        </button>
        {(['payment_submitted', 'pending_payment', 'processing', 'completed'] as OrderStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium transition',
              status === s
                ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
                : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white',
            )}
          >
            {ORDER_STATUS_META[s].label}
          </button>
        ))}
      </div>

      <AdminCard bodyClassName="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="h-5 w-5" />}
            title="No orders found"
            description={search || status !== 'all' ? 'Try clearing the filters.' : 'Orders will appear here as customers check out.'}
          />
        ) : (
          <AdminTable head={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', '']} >
            {orders.map((o) => {
              const meta = ORDER_STATUS_META[o.status]
              const payment = (o.payments ?? [])[0]
              return (
                <tr key={o.id} className="transition hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-2.5 first:pl-0">
                    <p className="font-mono text-[11.5px] font-semibold text-white">{o.order_number}</p>
                    <p className="text-[10px] text-white/30">
                      {PAYMENT_METHOD_META[o.payment_method].label}
                    </p>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <p className="max-w-[150px] truncate text-[12px] text-white/85">{o.customer_name}</p>
                    <p className="max-w-[150px] truncate text-[10.5px] text-white/35">{o.customer_phone}</p>
                  </td>
                  <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">
                    {(o.order_items ?? []).length}
                  </td>
                  <td className="px-2.5 py-2.5 text-[12px] font-semibold text-white">{formatBDT(o.total)}</td>
                  <td className="px-2.5 py-2.5">
                    {payment ? (
                      <span className="flex flex-col gap-1">
                        <Badge className={PAYMENT_STATUS_META[payment.status].className}>
                          {PAYMENT_STATUS_META[payment.status].label}
                        </Badge>
                        {payment.transaction_id && (
                          <span className="font-mono text-[9.5px] text-white/30">{payment.transaction_id}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/25">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <Badge className={meta.className} dot={meta.dot}>{meta.short}</Badge>
                  </td>
                  <td className="px-2.5 py-2.5 text-[10.5px] text-white/40">{formatDateTime(o.created_at)}</td>
                  <td className="py-2.5 pl-2.5 last:pr-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="px-2 py-1.5 text-[11px]"
                      onClick={() => void openOrder(o.id)}
                      loading={detailLoading}
                      icon={<Eye className="h-3 w-3" />}
                    >
                      Manage
                    </Button>
                  </td>
                </tr>
              )
            })}
          </AdminTable>
        )}
      </AdminCard>

      <p className="mt-2.5 text-[10.5px] text-white/25">
        Showing {orders.length} order{orders.length === 1 ? '' : 's'}
        {Object.keys(counts).length > 0 && ` · ${Object.entries(counts).map(([k, v]) => `${v} ${ORDER_STATUS_META[k as OrderStatus].short.toLowerCase()}`).join(', ')}`}
      </p>

      <OrderManageModal
        detail={activeOrder}
        onClose={() => setActiveOrder(null)}
        onChanged={async () => {
          await load()
          if (activeOrder) {
            const fresh = await api.admin.orderDetail(activeOrder.order.id)
            setActiveOrder(fresh)
          }
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Order management modal                                             */
/* ------------------------------------------------------------------ */
function OrderManageModal({
  detail,
  onClose,
  onChanged,
}: {
  detail: OrderDetail | null
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [nextStatus, setNextStatus] = useState<OrderStatus>('processing')

  useEffect(() => {
    if (detail) {
      setInternalNote(detail.order.admin_note ?? '')
      setNextStatus(
        detail.order.status === 'payment_verified' ? 'processing' : (detail.order.status as OrderStatus),
      )
    }
  }, [detail])

  if (!detail) return null

  const { order, items, payment, history } = detail
  const meta = ORDER_STATUS_META[order.status]

  const verify = async (decision: 'verified' | 'rejected') => {
    if (!payment) return
    if (decision === 'rejected' && !note.trim()) {
      toast.error('Add a reason', 'Please explain why the payment was rejected.')
      return
    }
    setBusy(decision)
    try {
      await api.admin.verifyPayment(payment.id, decision, note.trim() || undefined)
      toast.success(
        decision === 'verified' ? 'Payment verified' : 'Payment rejected',
        decision === 'verified' ? 'Order moved to Payment Verified.' : 'Customer can resubmit.',
      )
      setNote('')
      await onChanged()
    } catch (err) {
      toast.error('Action failed', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const updateStatus = async () => {
    if (nextStatus === order.status) {
      toast.info('No change', 'That is already the current status.')
      return
    }
    setBusy('status')
    try {
      await api.admin.updateOrderStatus(order.id, nextStatus, note.trim() || undefined)
      toast.success('Status updated', ORDER_STATUS_META[nextStatus].label)
      setNote('')
      await onChanged()
    } catch (err) {
      toast.error('Could not update status', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const saveNote = async () => {
    setBusy('note')
    try {
      await api.admin.setNote(order.id, internalNote)
      toast.success('Internal note saved')
      await onChanged()
    } catch (err) {
      toast.error('Could not save note', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={Boolean(detail)}
      onClose={onClose}
      size="xl"
      title={`Order ${order.order_number}`}
      description={`${formatDateTime(order.created_at)} · ${formatBDT(order.total)}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-white/35">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Changes are audited server-side
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={meta.className} dot={meta.dot}>{meta.label}</Badge>
          <Badge className="border-white/10 bg-white/[0.04] text-white/60">
            {PAYMENT_METHOD_META[order.payment_method].label}
          </Badge>
          {payment && (
            <Badge className={PAYMENT_STATUS_META[payment.status].className}>
              Payment: {PAYMENT_STATUS_META[payment.status].label}
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Customer</p>
            <p className="mt-1 text-[12.5px] font-medium text-white">{order.customer_name}</p>
            <p className="break-all text-[11.5px] text-white/50">{order.customer_email}</p>
            <p className="text-[11.5px] text-white/50">{order.customer_phone}</p>
            {order.customer_note && (
              <p className="mt-1.5 border-t border-white/8 pt-1.5 text-[11px] text-white/40">
                “{order.customer_note}”
              </p>
            )}
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Payment</p>
            <dl className="mt-1 space-y-0.5 text-[11.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">Amount</dt>
                <dd className="font-semibold text-white">{formatBDT(payment?.amount ?? order.total)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">TrxID</dt>
                <dd className="font-mono text-white/80">{payment?.transaction_id ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">Sender</dt>
                <dd className="text-white/80">{payment?.sender_number ?? '—'}</dd>
              </div>
              {payment?.proof_url && (
                <div className="flex justify-between gap-2">
                  <dt className="text-white/40">Proof</dt>
                  <dd>
                    <a
                      href={payment.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#6EC1FF] hover:underline"
                    >
                      View screenshot
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            {payment && payment.status === 'submitted' && (
              <div className="mt-2.5 border-t border-white/8 pt-2.5">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Verification note (required if rejecting)…"
                  className="min-h-[56px] text-[12px]"
                />
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => void verify('verified')}
                    loading={busy === 'verified'}
                    icon={<Check className="h-3.5 w-3.5" />}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                  >
                    Verify payment
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void verify('rejected')}
                    loading={busy === 'rejected'}
                    icon={<X className="h-3.5 w-3.5" />}
                    className="flex-1"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">Items</p>
          <ul className="divide-y divide-white/5">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-white/85">{i.product_name}</p>
                  <p className="text-[10.5px] text-white/35">
                    {i.duration} · {formatBDT(i.unit_price)} × {i.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-white">{formatBDT(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-white/8 pt-2 text-[12px]">
            <span className="text-white/45">Total {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
            <span className="font-bold text-white">{formatBDT(order.total)}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">Update status</p>
            <Select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
              className="py-2 text-[12px]"
              aria-label="New order status"
            >
              {ALL_ORDER_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-[#0B111D]">
                  {ORDER_STATUS_META[s].label}
                </option>
              ))}
            </Select>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for the customer timeline"
              className="mt-2 py-2 text-[12px]"
            />
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => void updateStatus()}
              loading={busy === 'status'}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Apply status
            </Button>
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">
              Verifying a payment sets the order to <b>Payment Verified</b> — never straight to Completed.
            </p>
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">Timeline</p>
            <div className="max-h-56 overflow-y-auto pr-1">
              <StatusTimeline status={order.status} history={history} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            <StickyNote className="h-3 w-3" aria-hidden />
            Internal note (never shown to the customer)
          </p>
          <Textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            placeholder="e.g. Delivered via WhatsApp, replacement issued 12 Nov…"
            className="min-h-[60px] text-[12px]"
          />
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => void saveNote()}
            loading={busy === 'note'}
          >
            Save internal note
          </Button>
        </div>
      </div>
    </Modal>
  )
}
