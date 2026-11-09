import { useCallback, useEffect, useState } from 'react'
import { Edit2, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable } from '../../components/admin/AdminUI'
import { Button, ErrorNote, Field, Input, Modal, Select, Skeleton, Textarea } from '../../components/ui'
import { useStore } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { slugify } from '../../lib/utils'
import type { Category } from '../../types'

const ICON_OPTIONS = [
  'Clapperboard',
  'BrainCircuit',
  'GraduationCap',
  'Layers',
  'Gamepad2',
  'Palette',
  'Sparkles',
]

export default function AdminCategories() {
  const { categories, reload: reloadStore } = useStore()
  const toast = useToast()
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<(Partial<Category> & { isNew?: boolean }) | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await api.catalogue.categories())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load categories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.admin.deleteCategory(deleting.id)
      toast.success('Category deleted', deleting.name)
      setDeleting(null)
      await load()
      await reloadStore()
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminHeader
        title="Categories"
        description="Group products into the collections customers browse on the homepage and menu."
        action={
          <Button
            size="sm"
            onClick={() => setEditing({ name: '', slug: '', icon: 'Sparkles', accent: 'blue', sort_order: rows.length + 1, is_active: true, isNew: true })}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add category
          </Button>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <AdminCard bodyClassName="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : (
          <AdminTable head={['Category', 'Slug', 'Products', 'Order', 'Status', '']}>
            {rows.map((c) => (
              <tr key={c.id} className="transition hover:bg-white/[0.02]">
                <td className="py-2.5 pr-2.5 first:pl-0">
                  <p className="text-[12px] font-medium text-white">{c.name}</p>
                  <p className="max-w-[260px] truncate text-[10.5px] text-white/35">{c.description}</p>
                </td>
                <td className="px-2.5 py-2.5 font-mono text-[10.5px] text-white/40">{c.slug}</td>
                <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">
                  {categories.find((x) => x.id === c.id) ? '—' : '—'}
                </td>
                <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">{c.sort_order}</td>
                <td className="px-2.5 py-2.5">
                  <span
                    className={
                      c.is_active
                        ? 'rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-300'
                        : 'rounded bg-white/8 px-1.5 py-0.5 text-[9.5px] font-semibold text-white/40'
                    }
                  >
                    {c.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="py-2.5 pl-2.5 last:pr-0">
                  <div className="flex justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      aria-label={`Edit ${c.name}`}
                      className="rounded p-1.5 text-white/40 transition hover:bg-white/8 hover:text-[#6EC1FF]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(c)}
                      aria-label={`Delete ${c.name}`}
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

      <CategoryModal
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          await load()
          await reloadStore()
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete category?"
        description={deleting?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>Delete</Button>
          </div>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-white/50">
          Products in this category are not deleted — they become uncategorised. Consider hiding the
          category instead if you only want to take it off the storefront.
        </p>
      </Modal>
    </div>
  )
}

function CategoryModal({
  value,
  onClose,
  onSaved,
}: {
  value: (Partial<Category> & { isNew?: boolean }) | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<Partial<Category>>(value ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(value ?? {})
    setError(null)
  }, [value])

  if (!value) return null

  const save = async () => {
    if (!form.name?.trim()) return setError('Category name is required.')
    setSaving(true)
    setError(null)
    try {
      await api.admin.saveCategory({
        ...form,
        name: form.name.trim(),
        slug: form.slug?.trim() || slugify(form.name),
        sort_order: Number(form.sort_order ?? 0),
      })
      toast.success(value.isNew ? 'Category created' : 'Category updated', form.name)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title={value.isNew ? 'Add category' : `Edit ${value.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          <Input
            value={form.name ?? ''}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              if (value.isNew) setForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))
            }}
            placeholder="OTT Subscriptions"
          />
        </Field>
        <Field label="Slug">
          <Input
            value={form.slug ?? ''}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            placeholder="ott-subscriptions"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="min-h-[70px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon">
            <Select value={form.icon ?? 'Sparkles'} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
              {ICON_OPTIONS.map((i) => (
                <option key={i} value={i} className="bg-[#0B111D]">{i}</option>
              ))}
            </Select>
          </Field>
          <Field label="Accent">
            <Select value={form.accent ?? 'blue'} onChange={(e) => setForm({ ...form, accent: e.target.value })}>
              <option value="blue" className="bg-[#0B111D]">Electric blue</option>
              <option value="red" className="bg-[#0B111D]">Vibrant red</option>
            </Select>
          </Field>
        </div>
        <Field label="Sort order">
          <Input
            type="number"
            value={form.sort_order ?? 0}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
          <input
            type="checkbox"
            checked={Boolean(form.is_active)}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="h-4 w-4 accent-[#008CFF]"
          />
          Active (visible in store)
        </label>
        {error && <ErrorNote message={error} />}
      </div>
    </Modal>
  )
}
