import { useEffect, useState } from 'react'
import { Edit2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader } from '../../components/admin/AdminUI'
import { Badge, Button, ErrorNote, Field, Input, Modal, Skeleton, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useStore } from '../../context/SettingsContext'
import type { Promotion } from '../../types'

export default function AdminPromotions() {
  const toast = useToast()
  const { reload } = useStore()
  const [rows, setRows] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<(Partial<Promotion> & { isNew?: boolean }) | null>(null)
  const [deleting, setDeleting] = useState<Promotion | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.admin
      .promotions()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load promotions.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.admin.deletePromotion(deleting.id)
      toast.success('Promotion deleted')
      setDeleting(null)
      load()
      await reload()
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminHeader
        title="Promotions & offers"
        description="The offer cards shown on the homepage and the Special Offers page."
        action={
          <Button
            size="sm"
            onClick={() => setEditing({ title: '', badge: 'Offer', cta_label: 'Shop Now', cta_link: '/products', is_active: true, isNew: true })}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add offer
          </Button>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      {loading ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <AdminCard>
          <div className="py-10 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] text-white/50">No promotions yet</p>
            <p className="mt-0.5 text-[11.5px] text-white/30">Add an offer card to highlight a bundle.</p>
          </div>
        </AdminCard>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <article key={p.id} className="rounded-xl border border-white/8 bg-[#080D18] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="border-[#F00016]/30 bg-[#F00016]/10 text-[#FF7B85]">{p.badge ?? 'Offer'}</Badge>
                  {p.discount_text && (
                    <Badge className="border-white/10 bg-white/5 text-white/60">{p.discount_text}</Badge>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    aria-label={`Edit ${p.title}`}
                    className="rounded p-1.5 text-white/40 transition hover:bg-white/8 hover:text-[#6EC1FF]"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    aria-label={`Delete ${p.title}`}
                    className="rounded p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="mt-2.5 text-[13.5px] font-semibold text-white">{p.title}</h3>
              {p.subtitle && <p className="mt-0.5 text-[11.5px] text-[#6EC1FF]">{p.subtitle}</p>}
              {p.description && (
                <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-white/40">{p.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2.5">
                <span className="truncate font-mono text-[10px] text-white/30">{p.cta_link}</span>
                <span
                  className={
                    p.is_active
                      ? 'rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-300'
                      : 'rounded bg-white/8 px-1.5 py-0.5 text-[9.5px] font-semibold text-white/40'
                  }
                >
                  {p.is_active ? 'Live' : 'Hidden'}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <PromotionModal
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          load()
          await reload()
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete promotion?"
        description={deleting?.title}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>Delete</Button>
          </div>
        }
      >
        <p className="text-[12.5px] text-white/50">This removes the offer card from the homepage and offers page.</p>
      </Modal>
    </div>
  )
}

function PromotionModal({
  value,
  onClose,
  onSaved,
}: {
  value: (Partial<Promotion> & { isNew?: boolean }) | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<Partial<Promotion>>(value ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(value ?? {})
    setError(null)
  }, [value])

  if (!value) return null

  const save = async () => {
    if (!form.title?.trim()) return setError('Title is required.')
    setSaving(true)
    setError(null)
    try {
      await api.admin.savePromotion({
        ...form,
        title: form.title.trim(),
        sort_order: Number(form.sort_order ?? 0),
      })
      toast.success(value.isNew ? 'Promotion created' : 'Promotion updated')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the promotion.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title={value.isNew ? 'Add promotion' : 'Edit promotion'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Title" required>
          <Input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Subtitle">
          <Input value={form.subtitle ?? ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-h-[70px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Badge">
            <Input value={form.badge ?? ''} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Bundle Deal" />
          </Field>
          <Field label="Discount text">
            <Input
              value={form.discount_text ?? ''}
              onChange={(e) => setForm({ ...form, discount_text: e.target.value })}
              placeholder="Save 45%"
            />
          </Field>
          <Field label="Button label">
            <Input value={form.cta_label ?? ''} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} />
          </Field>
          <Field label="Button link" hint="e.g. /product/netflix-premium-4k">
            <Input value={form.cta_link ?? ''} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} />
          </Field>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-[#008CFF]"
            />
            Active
          </label>
          <div className="ml-auto w-24">
            <Input
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              placeholder="Order"
              className="py-1.5 text-[12px]"
            />
          </div>
        </div>
        {error && <ErrorNote message={error} />}
      </div>
    </Modal>
  )
}
