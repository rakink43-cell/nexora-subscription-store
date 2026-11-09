import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Search, ShoppingBag } from 'lucide-react'
import { api } from '../../lib/api'
import { Badge, ButtonLink, EmptyState, Input, Skeleton } from '../../components/ui'
import { ORDER_STATUS_META, cn, formatBDT, formatDate } from '../../lib/utils'
import type { Order, OrderStatus } from '../../types'

const FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Pending' },
  { value: 'payment_submitted', label: 'Submitted' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
]

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')

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

  const filtered = useMemo(() => {
    let rows = orders
    if (filter !== 'all') rows = rows.filter((o) => o.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.order_items ?? []).some((i) => i.product_name.toLowerCase().includes(q)),
      )
    }
    return rows
  }, [orders, filter, search])

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-bold text-white">My orders</h2>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number or product"
            className="py-2 pl-8 text-[12.5px]"
            aria-label="Search your orders"
          />
        </div>
      </div>

      <div className="nx-scroll-x mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition',
              filter === f.value
                ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
                : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white',
            )}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1 text-white/30">
                {orders.filter((o) => o.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={orders.length === 0 ? 'No orders yet' : 'No matching orders'}
          description={
            orders.length === 0
              ? 'When you buy a subscription it appears here with live tracking.'
              : 'Try another filter or clear your search.'
          }
          action={
            orders.length === 0 ? (
              <ButtonLink to="/products" size="sm" icon={<ShoppingBag className="h-3.5 w-3.5" />}>
                Browse subscriptions
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((order) => {
            const meta = ORDER_STATUS_META[order.status]
            const items = order.order_items ?? []
            return (
              <li key={order.id}>
                <Link
                  to={`/dashboard/orders/${order.order_number}`}
                  className="nx-card block p-4 transition hover:border-[#008CFF]/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[13px] font-semibold text-white">{order.order_number}</p>
                      <p className="mt-0.5 text-[11.5px] text-white/40">
                        {formatDate(order.created_at)} · {items.length} item{items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-bold text-white">
                        {formatBDT(order.total)}
                      </span>
                      <Badge className={meta.className} dot={meta.dot}>
                        {meta.label}
                      </Badge>
                    </div>
                  </div>
                  {items.length > 0 && (
                    <p className="mt-2 line-clamp-1 text-[12px] text-white/50">
                      {items.map((i) => `${i.product_name} (${i.duration})`).join(' · ')}
                    </p>
                  )}
                  {order.status === 'pending_payment' && (
                    <p className="mt-2 inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10.5px] font-semibold text-amber-300">
                      Action needed — submit your transaction ID
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
