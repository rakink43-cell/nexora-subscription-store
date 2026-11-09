import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  PackageOpen,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Badge, ButtonLink, Skeleton } from '../../components/ui'
import { ORDER_STATUS_META, formatBDT, formatDate } from '../../lib/utils'
import type { Order } from '../../types'

export default function DashboardHome() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.orders
      .mine()
      .then((rows) => {
        if (active) setOrders(rows)
      })
      .catch(() => {
        if (active) setOrders([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const completed = orders.filter((o) => o.status === 'completed')
  const pending = orders.filter((o) =>
    ['pending_payment', 'payment_submitted', 'payment_verified', 'processing'].includes(o.status),
  )
  const spent = completed.reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-200">
            <Clock className="h-4 w-4" aria-hidden />
            {pending.length} order{pending.length === 1 ? '' : 's'} need{pending.length === 1 ? 's' : ''} attention
          </p>
          <p className="mt-1 text-[12px] text-amber-100/60">
            {pending.some((o) => o.status === 'pending_payment')
              ? 'Complete your payment by submitting the transaction ID.'
              : 'We are verifying your payment — no action needed.'}
          </p>
          <Link
            to="/dashboard/orders"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-300 hover:underline"
          >
            View orders <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Package} label="Total orders" value={String(orders.length)} loading={loading} />
        <StatCard icon={CheckCircle2} label="Delivered" value={String(completed.length)} loading={loading} accent="emerald" />
        <StatCard icon={Clock} label="In progress" value={String(pending.length)} loading={loading} accent="amber" />
        <StatCard icon={Wallet} label="Total spent" value={formatBDT(spent)} loading={loading} />
      </div>

      <div className="nx-card p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-white">Recent orders</h2>
          <Link
            to="/dashboard/orders"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6EC1FF] hover:text-white"
          >
            All orders <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <PackageOpen className="h-8 w-8 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] font-medium text-white/70">No orders yet</p>
            <p className="mt-1 max-w-xs text-[12px] text-white/40">
              Your delivered subscriptions and access details will appear here.
            </p>
            <ButtonLink to="/products" size="sm" className="mt-4" icon={<ShoppingBag className="h-3.5 w-3.5" />}>
              Browse subscriptions
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-white/8">
            {orders.slice(0, 5).map((order) => {
              const meta = ORDER_STATUS_META[order.status]
              return (
                <li key={order.id}>
                  <Link
                    to={`/dashboard/orders/${order.order_number}`}
                    className="flex flex-wrap items-center gap-3 py-3 transition hover:opacity-80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12.5px] font-semibold text-white">{order.order_number}</p>
                      <p className="truncate text-[11.5px] text-white/40">
                        {(order.order_items ?? []).map((i) => i.product_name).join(', ') || 'Subscription'}
                      </p>
                    </div>
                    <span className="text-[12px] text-white/50">{formatDate(order.created_at)}</span>
                    <span className="text-[13px] font-semibold text-white">{formatBDT(order.total)}</span>
                    <Badge className={meta.className} dot={meta.dot}>
                      {meta.short}
                    </Badge>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="nx-card p-5">
          <h3 className="text-[13.5px] font-semibold text-white">Account</h3>
          <dl className="mt-2.5 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-white/40">Name</dt>
              <dd className="truncate text-white/75">{user?.full_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/40">Email</dt>
              <dd className="truncate text-white/75">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-white/40">Phone</dt>
              <dd className="text-white/75">{user?.phone ?? '—'}</dd>
            </div>
          </dl>
          <ButtonLink to="/dashboard/profile" variant="ghost" size="sm" className="mt-3.5 w-full">
            Edit profile
          </ButtonLink>
        </div>

        <div className="nx-card p-5">
          <h3 className="text-[13.5px] font-semibold text-white">Need a hand?</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
            Renewals, replacements or a new plan recommendation — our team replies on WhatsApp within
            minutes during business hours.
          </p>
          <div className="mt-3 flex gap-2">
            <ButtonLink to="/dashboard/support" size="sm" variant="outline">
              Support
            </ButtonLink>
            <ButtonLink to="/faq" size="sm" variant="ghost">
              FAQ
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  loading?: boolean
  accent?: 'blue' | 'emerald' | 'amber' | 'red'
}) {
  const colors = {
    blue: 'text-[#6EC1FF] bg-[#008CFF]/12 border-[#008CFF]/20',
    emerald: 'text-emerald-300 bg-emerald-500/12 border-emerald-500/20',
    amber: 'text-amber-300 bg-amber-500/12 border-amber-500/20',
    red: 'text-rose-300 bg-rose-500/12 border-rose-500/20',
  }[accent]

  return (
    <div className="nx-card p-4">
      <span className={`grid h-8 w-8 place-items-center rounded-lg border ${colors}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2.5 text-[10.5px] uppercase tracking-wider text-white/35">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-5 w-16" />
      ) : (
        <p className="font-display text-lg font-bold text-white">{value}</p>
      )}
    </div>
  )
}
