import { useEffect, useState } from 'react'
import { LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader } from '../../components/admin/AdminUI'
import { Badge, Button, ErrorNote, Modal, Skeleton, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/utils'
import type { SupportMessage } from '../../types'

export default function AdminSupport() {
  const toast = useToast()
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replying, setReplying] = useState<SupportMessage | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    api.admin
      .supportMessages()
      .then(setMessages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load messages.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const send = async () => {
    if (!replying || reply.trim().length < 2) return
    setBusy(true)
    try {
      await api.admin.replySupport(replying.id, reply.trim())
      toast.success('Reply saved', `Visible to ${replying.name} in their dashboard.`)
      setReplying(null)
      setReply('')
      load()
    } catch (err) {
      toast.error('Could not save reply', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const open = messages.filter((m) => m.status === 'open').length

  return (
    <div>
      <AdminHeader
        title="Support inbox"
        description="Contact-form messages and customer tickets. Replies appear in the customer dashboard."
        action={
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/60">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
            {open} open
          </span>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : messages.length === 0 ? (
        <AdminCard>
          <div className="py-12 text-center">
            <LifeBuoy className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] text-white/50">Inbox is empty</p>
            <p className="mt-0.5 text-[11.5px] text-white/30">
              Messages sent through the contact form and customer dashboard appear here.
            </p>
          </div>
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <article key={m.id} className="rounded-xl border border-white/8 bg-[#080D18] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">{m.subject}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {m.name} · {formatDateTime(m.created_at)}
                    {m.order_number ? ` · ${m.order_number}` : ''}
                  </p>
                </div>
                <Badge
                  className={
                    m.status === 'open'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : m.status === 'replied'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-white/50'
                  }
                >
                  {m.status}
                </Badge>
              </div>

              <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-white/60">{m.message}</p>

              {m.admin_reply && (
                <div className="mt-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Your reply
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-[12px] text-white/65">{m.admin_reply}</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-2.5">
                <a
                  href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                  className="inline-flex items-center gap-1.5 text-[11.5px] text-white/50 transition hover:text-white"
                >
                  <Mail className="h-3 w-3" aria-hidden />
                  {m.email}
                </a>
                {m.phone && (
                  <a
                    href={`tel:${m.phone}`}
                    className="inline-flex items-center gap-1.5 text-[11.5px] text-white/50 transition hover:text-white"
                  >
                    <Phone className="h-3 w-3" aria-hidden />
                    {m.phone}
                  </a>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto px-2 py-1.5 text-[11px]"
                  onClick={() => {
                    setReplying(m)
                    setReply(m.admin_reply ?? '')
                  }}
                  icon={<MessageCircle className="h-3 w-3" />}
                >
                  Reply
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(replying)}
        onClose={() => setReplying(null)}
        title="Reply to customer"
        description={replying?.subject}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReplying(null)}>Cancel</Button>
            <Button size="sm" loading={busy} onClick={() => void send()} icon={<Send className="h-3.5 w-3.5" />}>
              Save reply
            </Button>
          </div>
        }
      >
        <div className="space-y-2.5">
          <p className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 text-[12px] leading-relaxed text-white/50">
            “{replying?.message}”
          </p>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply — the customer sees this in their dashboard…"
            className="min-h-[110px]"
          />
        </div>
      </Modal>
    </div>
  )
}
