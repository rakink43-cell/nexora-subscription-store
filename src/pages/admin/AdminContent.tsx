import { useEffect, useState } from 'react'
import { Edit2, HelpCircle, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable } from '../../components/admin/AdminUI'
import { Badge, Button, ErrorNote, Field, Input, Modal, Skeleton, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useStore } from '../../context/SettingsContext'
import type { Faq } from '../../types'

export default function AdminContent() {
  const toast = useToast()
  const { reload } = useStore()
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<(Partial<Faq> & { isNew?: boolean }) | null>(null)
  const [deleting, setDeleting] = useState<Faq | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.admin
      .allFaqs()
      .then(setFaqs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load FAQs.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.admin.deleteFaq(deleting.id)
      toast.success('FAQ deleted')
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
        title="Content & FAQ"
        description="Manage the questions shown on the homepage and the help centre."
        action={
          <Button
            size="sm"
            onClick={() => setEditing({ question: '', answer: '', category: 'General', sort_order: faqs.length + 1, is_active: true, isNew: true })}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add FAQ
          </Button>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <AdminCard bodyClassName="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : faqs.length === 0 ? (
          <div className="py-12 text-center">
            <HelpCircle className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] text-white/50">No FAQs yet</p>
          </div>
        ) : (
          <AdminTable head={['Question', 'Category', 'Order', 'Status', '']}>
            {faqs.map((f) => (
              <tr key={f.id} className="transition hover:bg-white/[0.02]">
                <td className="max-w-[380px] py-2.5 pr-2.5 first:pl-0">
                  <p className="truncate text-[12px] font-medium text-white">{f.question}</p>
                  <p className="truncate text-[10.5px] text-white/35">{f.answer}</p>
                </td>
                <td className="px-2.5 py-2.5">
                  <span className="rounded bg-white/6 px-1.5 py-0.5 text-[10px] text-white/55">{f.category}</span>
                </td>
                <td className="px-2.5 py-2.5 text-[11.5px] text-white/50">{f.sort_order}</td>
                <td className="px-2.5 py-2.5">
                  <Badge
                    className={
                      f.is_active
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-white/40'
                    }
                  >
                    {f.is_active ? 'Published' : 'Draft'}
                  </Badge>
                </td>
                <td className="py-2.5 pl-2.5 last:pr-0">
                  <div className="flex justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(f)}
                      aria-label="Edit FAQ"
                      className="rounded p-1.5 text-white/40 transition hover:bg-white/8 hover:text-[#6EC1FF]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(f)}
                      aria-label="Delete FAQ"
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

      <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11.5px] leading-relaxed text-white/40">
        <b className="text-white/60">Note:</b> hero text, contact details and announcement copy live in{' '}
        <span className="text-[#6EC1FF]">Settings → Website</span>. Policy pages (Privacy, Terms, Refund)
        are versioned in code so they cannot be edited to something non-compliant by accident.
      </p>

      <FaqModal
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
        title="Delete FAQ?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>Delete</Button>
          </div>
        }
      >
        <p className="text-[12.5px] text-white/50">This removes the question from the public FAQ.</p>
      </Modal>
    </div>
  )
}

function FaqModal({
  value,
  onClose,
  onSaved,
}: {
  value: (Partial<Faq> & { isNew?: boolean }) | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<Partial<Faq>>(value ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(value ?? {})
    setError(null)
  }, [value])

  if (!value) return null

  const save = async () => {
    if (!form.question?.trim()) return setError('Question is required.')
    if (!form.answer?.trim()) return setError('Answer is required.')
    setSaving(true)
    setError(null)
    try {
      await api.admin.saveFaq({
        ...form,
        question: form.question.trim(),
        answer: form.answer.trim(),
        sort_order: Number(form.sort_order ?? 0),
      })
      toast.success(value.isNew ? 'FAQ created' : 'FAQ updated')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the FAQ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      title={value.isNew ? 'Add FAQ' : 'Edit FAQ'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Question" required>
          <Input value={form.question ?? ''} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        </Field>
        <Field label="Answer" required>
          <Textarea
            value={form.answer ?? ''}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
            className="min-h-[100px]"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input
              value={form.category ?? ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Payment"
            />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sort_order ?? 0}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
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
          Published
        </label>
        {error && <ErrorNote message={error} />}
      </div>
    </Modal>
  )
}
