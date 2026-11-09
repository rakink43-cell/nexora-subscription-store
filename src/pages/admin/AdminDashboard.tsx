import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Package,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable, SalesChart, StatTile } from '../../components/admin/AdminUI'
import { Badge, ErrorNote, Skeleton } from '../../components/ui'
import { ORDER_STATUS_META, formatBDT, formatDate, timeAgo } from '../../lib/utils'
import type { DashboardStats, Order } from '../../types'

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([api.admin.stats(), api.admin.orders({ status: 'all' })])
      .then(([s, o]) => {
        if (!active) return
        setStats(s)
        setOrders(o)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load dashboard data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const needsAction = orders.filter(
    (o) => o.status === 'payment_submitted' || o.status === 'pending_payment',
  )

  return (
    <div>
      <AdminHeader
        title="Dashboard"
        description="Live snapshot of sales, orders and what needs your attention today."
        action={
          <Link to="/admin/orders?status=payment_submitted" className="nx-btn nx-btn-primary px-3 py-2 text-[12.5px]">
            Verify payments
            {stats && stats.pending_orders > 0 && (
              <span className="ml-1 rounded-full bg-white/25 px-1.5 text-[10px] font-bold">
                {stats.pending_orders}
              </span>
            )}
          </Link>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total sales"
          value={formatBDT(stats?.total_sales ?? 0)}
          icon={<Wallet className="h-4 w-4" />}
          hint={`Today: ${formatBDT(stats?.revenue_today ?? 0)}`}
          accent="emerald"
          loading={loading}
        />
        <StatTile
          label="Total orders"
          value={String(stats?.total_orders ?? 0)}
          icon={<Receipt className="h-4 w-4" />}
          hint={`Today: ${stats?.orders_today ?? 0}`}
          loading={loading}
        />
        <StatTile
          label="Pending orders"
          value={String(stats?.pending_orders ?? 0)}
          icon={<Clock className="h-4 w-4" />}
          hint="Awaiting payment or verification"
          accent="amber"
          loading={loading}
        />
        <StatTile
          label="Completed"
          value={String(stats?.completed_orders ?? 0)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Delivered successfully"
          accent="emerald"
          loading={loading}
        />
        <StatTile
          label="Customers"
          value={String(stats?.total_customers ?? 0)}
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        <StatTile
          label="Active products"
          value={String(stats?.total_products ?? 0)}
          icon={<Package className="h-4 w-4" />}
          loading={loading}
        />
        <StatTile
          label="Open support"
          value={String(stats?.open_support ?? 0)}
          icon={<LifeBuoy className="h-4 w-4" />}
          accent="violet"
          loading={loading}
        />
        <StatTile
          label="Unread alerts"
          value={String(stats?.unread_notifications ?? 0)}
          icon={<BellRing className="h-4 w-4" />}
          accent="red"
          loading={loading}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <AdminCard
          title="Sales overview"
          description="Verified revenue over the last 14 days"
          action={
            <span className="flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              <TrendingUp className="h-3 w-3" aria-hidden />
              {formatBDT(stats?.sales_series?.reduce((s, d) => s + Number(d.total), 0) ?? 0)} period
            </span>
          }
        >
          {loading ? <Skeleton className="h-32 w-full" /> : <SalesChart data={stats?.sales_series ?? []} />}
        </AdminCard>

        <AdminCard
          title="Needs action"
          description="Orders waiting on payment or verification"
          action={
            <Link to="/admin/orders" className="text-[11.5px] font-semibold text-[#6EC1FF] hover:text-white">
              All orders
            </Link>
          }
          bodyClassName="p-0"
        >
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : needsAction.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500/50" aria-hidden />
              <p className="mt-2 text-[12.5px] text-white/50">All caught up</p>
              <p className="mt-0.5 text-[11px] text-white/30">No payments waiting for verification.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {needsAction.slice(0, 5).map((o) => {
                const meta = ORDER_STATUS_META[o.status]
                return (
                  <li key={o.id}>
                    <Link
                      to={`/admin/orders?search=${o.order_number}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11.5px] font-semibold text-white">
                          {o.order_number}
                        </p>
                        <p className="truncate text-[10.5px] text-white/40">{o.customer_name}</p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-white">
                        {formatBDT(o.total)}
                      </span>
                      <Badge className={meta.className}>{meta.short}</Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </AdminCard>
      </div>

      <div className="mt-3">
        <AdminCard
          title="Recent orders"
          description="Latest 8 orders across all channels"
          action={
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#6EC1FF] hover:text-white"
            >
              Manage orders <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <AdminTable head={['Order', 'Customer', 'Items', 'Total', 'Status', 'Date']} empty={orders.length === 0}>
              {orders.slice(0, 8).map((o) => {
                const meta = ORDER_STATUS_META[o.status]
                return (
                  <tr key={o.id} className="transition hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-2.5 first:pl-0">
                      <Link
                        to={`/admin/orders?search=${o.order_number}`}
                        className="font-mono text-[11.5px] font-semibold text-[#6EC1FF] hover:underline"
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <p className="truncate text-[12px] text-white/80">{o.customer_name}</p>
                      <p className="truncate text-[10.5px] text-white/35">{o.customer_email}</p>
                    </td>
                    <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">
                      {(o.order_items ?? []).length}
                    </td>
                    <td className="px-2.5 py-2.5 text-[12px] font-semibold text-white">
                      {formatBDT(o.total)}
                    </td>
                    <td className="px-2.5 py-2.5">
                      <Badge className={meta.className} dot={meta.dot}>
                        {meta.short}
                      </Badge>
                    </td>
                    <td className="py-2.5 pl-2.5 text-[11px] text-white/40 last:pr-0">
                      {formatDate(o.created_at)}
                    </td>
                  </tr>
                )
              })}
            </AdminTable>
          )}
        </AdminCard>
      </div>

      {!loading && orders.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-[12.5px] text-white/40">
          No orders yet. Place a test order from the storefront to see the workflow end to end.
          {orders.length === 0 && (
            <span className="mt-1 block text-[11px] text-white/25">
              Tip: open the store in another tab, add a subscription and check out.
            </span>
          )}
        </p>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-white/25">
        <span>Updated {timeAgo(new Date().toISOString())}</span>
        <span>·</span>
        <span>Sales count orders in Processing, Payment Verified and Completed</span>
        <span>·</span>
        <span>Every admin action is written to the audit log</span>
      </p>
    </div>
  )
}
