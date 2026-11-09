import { useEffect, useState } from 'react'
import { Edit2, Plus, Ticket, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable } from '../../components/admin/AdminUI'
import { Badge, Button, ErrorNote, Field, Input, Modal, Select, Skeleton } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { formatBDT, formatDate } from '../../lib/utils'
import type { Coupon } from '../../types'

export default function AdminCoupons() {
  const toast = useToast()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<(Partial<Coupon> & { isNew?: boolean }) | null>(null)
  const [deleting, setDeleting] = useState<Coupon | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.admin
      .allCoupons()
      .then(setCoupons)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load coupons.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.admin.deleteCoupon(deleting.id)
      toast.success('Coupon deleted', deleting.code)
      setDeleting(null)
      load()
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminHeader
        title="Coupons"
        description="Percentage or fixed discounts applied at checkout. Customers validate them server-side."
        action={
          <Button
            size="sm"
            onClick={() =>
              setEditing({ code: '', type: 'percentage', value: 10, min_order: 0, is_active: true, isNew: true })
            }
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add coupon
          </Button>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <AdminCard bodyClassName="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-12 text-center">
            <Ticket className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] text-white/50">No coupons yet</p>
            <p className="mt-0.5 text-[11.5px] text-white/30">Create a code to run your first promotion.</p>
          </div>
        ) : (
          <AdminTable head={['Code', 'Discount', 'Min order', 'Used', 'Expires', 'Status', '']}>
            {coupons.map((c) => (
              <tr key={c.id} className="transition hover:bg-white/[0.02]">
                <td className="py-2.5 pr-2.5 first:pl-0">
                  <p className="font-mono text-[12px] font-bold text-white">{c.code}</p>
                  <p className="max-w-[200px] truncate text-[10px] text-white/35">{c.description}</p>
                </td>
                <td className="px-2.5 py-2.5 text-[12px] text-white/70">
                  {c.type === 'percentage' ? `${c.value}%` : formatBDT(c.value)}
                  {c.max_discount ? (
                    <span className="ml-1 text-[10px] text-white/30">max {formatBDT(c.max_discount)}</span>
                  ) : null}
                </td>
                <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">{formatBDT(c.min_order)}</td>
                <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">
                  {c.used_count}
                  {c.usage_limit ? <span className="text-white/30"> / {c.usage_limit}</span> : null}
                </td>
                <td className="px-2.5 py-2.5 text-[10.5px] text-white/40">
                  {c.expires_at ? formatDate(c.expires_at) : 'No expiry'}
                </td>
                <td className="px-2.5 py-2.5">
                  <Badge
                    className={
                      c.is_active
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-white/40'
                    }
                  >
                    {c.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </td>
                <td className="py-2.5 pl-2.5 last:pr-0">
                  <div className="flex justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      aria-label={`Edit ${c.code}`}
                      className="rounded p-1.5 text-white/40 transition hover:bg-white/8 hover:text-[#6EC1FF]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(c)}
                      aria-label={`Delete ${c.code}`}
                      className="rounded p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      <CouponModal
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          load()
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete coupon?"
        description={deleting?.code}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>Delete</Button>
          </div>
        }
      >
        <p className="text-[12.5px] text-white/50">
          Past orders that used this code keep their discount — only future usage is blocked.
        </p>
      </Modal>
    </div>
  )
}

function CouponModal({
  value,
  onClose,
  onSaved,
}: {
  value: (Partial<Coupon> & { isNew?: boolean }) | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<Partial<Coupon>>(value ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(value ?? {})
    setError(null)
  }, [value])

  if (!value) return null

  const save = async () => {
    if (!form.code?.trim()) return setError('Coupon code is required.')
    if (!form.value || Number(form.value) <= 0) return setError('Discount value must be greater than zero.')
    if (form.type === 'percentage' && Number(form.value) > 100) return setError('Percentage cannot exceed 100.')
    setSaving(true)
    setError(null)
    try {
      await api.admin.saveCoupon({
        ...form,
        code: form.code.trim().toUpperCase(),
        value: Number(form.value),
        min_order: Number(form.min_order ?? 0),
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      })
      toast.success(value.isNew ? 'Coupon created' : 'Coupon updated', form.code.toUpperCase())
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the coupon.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title={value.isNew ? 'Add coupon' : `Edit ${value.code}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Coupon code" required>
          <Input
            value={form.code ?? ''}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="NEXORA10"
            className="font-mono"
          />
        </Field>
        <Field label="Description">
          <Input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="10% off your first order"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type ?? 'percentage'} onChange={(e) => setForm({ ...form, type: e.target.value as Coupon['type'] })}>
              <option value="percentage" className="bg-[#0B111D]">Percentage</option>
              <option value="fixed" className="bg-[#0B111D]">Fixed amount</option>
            </Select>
          </Field>
          <Field label={form.type === 'fixed' ? 'Amount (৳)' : 'Percent (%)'} required>
            <Input
              type="number"
              min={1}
              value={form.value ?? 10}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            />
          </Field>
          <Field label="Minimum order (৳)">
            <Input
              type="number"
              min={0}
              value={form.min_order ?? 0}
              onChange={(e) => setForm({ ...form, min_order: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max discount (৳)" hint="Optional cap">
            <Input
              type="number"
              min={0}
              value={form.max_discount ?? ''}
              onChange={(e) => setForm({ ...form, max_discount: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Usage limit" hint="Leave blank for unlimited">
            <Input
              type="number"
              min={0}
              value={form.usage_limit ?? ''}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label="Expires on" hint="Optional">
            <Input
              type="date"
              value={form.expires_at ? form.expires_at.slice(0, 10) : ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
          <input
            type="checkbox"
            checked={Boolean(form.is_active)}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 accent-[#008CFF]"
          />
          Active
        </label>
        {error && <ErrorNote message={error} />}
      </div>
    </Modal>
  )
}
