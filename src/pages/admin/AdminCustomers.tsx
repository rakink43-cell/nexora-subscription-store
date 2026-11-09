import { useEffect, useMemo, useState } from 'react'
import { Mail, Phone, Search, Users, UserX } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable } from '../../components/admin/AdminUI'
import { Button, ErrorNote, Input, Modal, Skeleton } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { formatBDT, formatDate, initials } from '../../lib/utils'
import type { Profile } from '../../types'

type CustomerRow = Profile & { order_count: number; total_spent: number; role?: string }

export default function AdminCustomers() {
  const toast = useToast()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.admin
      .customers()
      .then(setCustomers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load customers.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter(
      (c) =>
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q),
    )
  }, [customers, search])

  const toggleBlock = async (customer: CustomerRow) => {
    setBusy(true)
    try {
      if (!('setBlocked' in api.admin)) throw new Error('Blocking requires a connected Supabase project.')
      await (api.admin as { setBlocked: (id: string, b: boolean) => Promise<void> }).setBlocked(
        customer.id,
        !customer.is_blocked,
      )
      toast.success(customer.is_blocked ? 'Customer unblocked' : 'Customer blocked')
      setSelected(null)
      load()
    } catch (err) {
      toast.error('Action failed', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminHeader
        title="Customers"
        description="Everyone who has an account, with their order volume and lifetime value."
        action={
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/60">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {customers.length} accounts
          </span>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="py-2 pl-8 text-[12.5px]"
          aria-label="Search customers"
        />
      </div>

      <AdminCard bodyClassName="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] text-white/50">No customers found</p>
          </div>
        ) : (
          <AdminTable head={['Customer', 'Contact', 'Orders', 'Lifetime value', 'Joined', '']}>
            {filtered.map((c) => (
              <tr key={c.id} className="transition hover:bg-white/[0.02]">
                <td className="py-2.5 pr-2.5 first:pl-0">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#008CFF] to-[#F00016] text-[10px] font-bold text-white">
                      {initials(c.full_name ?? c.email ?? 'N')}
                    </span>
                    <div className="min-w-0">
                      <p className="max-w-[150px] truncate text-[12px] font-medium text-white">
                        {c.full_name ?? 'Unnamed'}
                      </p>
                      <p className="max-w-[150px] truncate text-[10px] text-white/35">
                        {c.city ?? 'Bangladesh'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-2.5 py-2.5">
                  <p className="max-w-[170px] truncate text-[11px] text-white/60">{c.email}</p>
                  <p className="text-[10.5px] text-white/35">{c.phone ?? '—'}</p>
                </td>
                <td className="px-2.5 py-2.5 text-[11.5px] text-white/60">{c.order_count}</td>
                <td className="px-2.5 py-2.5 text-[12px] font-semibold text-white">
                  {formatBDT(c.total_spent)}
                </td>
                <td className="px-2.5 py-2.5 text-[10.5px] text-white/40">{formatDate(c.created_at)}</td>
                <td className="py-2.5 pl-2.5 last:pr-0">
                  <Button size="sm" variant="ghost" className="px-2 py-1.5 text-[11px]" onClick={() => setSelected(c)}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.full_name ?? 'Customer'}
        description={selected?.email ?? undefined}
        footer={
          <div className="flex justify-between gap-2">
            <Button
              size="sm"
              variant={selected?.is_blocked ? 'outline' : 'danger'}
              loading={busy}
              onClick={() => selected && void toggleBlock(selected)}
              icon={<UserX className="h-3.5 w-3.5" />}
            >
              {selected?.is_blocked ? 'Unblock account' : 'Block account'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-white/35">Orders</p>
                <p className="text-[15px] font-bold text-white">{selected.order_count}</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-white/35">Lifetime value</p>
                <p className="text-[15px] font-bold text-white">{formatBDT(selected.total_spent)}</p>
              </div>
            </div>
            <dl className="space-y-1.5 text-[12.5px]">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-white/30" aria-hidden />
                <span className="break-all text-white/70">{selected.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-white/30" aria-hidden />
                <span className="text-white/70">{selected.phone ?? '—'}</span>
              </div>
            </dl>
            <p className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-[11.5px] leading-relaxed text-white/40">
              Customer data is protected by row-level security. This view is only available to
              administrators, and every status change is written to the audit log.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
