import { useEffect, useState } from 'react'
import { LifeBuoy, MessageCircle, Send } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { Badge, Button, ErrorNote, Field, Input, Textarea } from '../../components/ui'
import { contactLink, formatDateTime, isEmail } from '../../lib/utils'
import type { SupportMessage } from '../../types'

export default function SupportPage() {
  const { user } = useAuth()
  const { settings } = useStore()
  const toast = useToast()

  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [form, setForm] = useState({
    name: user?.full_name ?? '',
    email: user?.email ?? '',
    order_number: '',
    subject: '',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api.support
      .mine()
      .then(setMessages)
      .catch(() => setMessages([]))
  }

  useEffect(load, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.name.trim().length < 2) return setError('Enter your name.')
    if (!isEmail(form.email)) return setError('Enter a valid email so we can reply.')
    if (form.message.trim().length < 5) return setError('Tell us a bit more about the issue.')
    setSending(true)
    try {
      await api.support.send({
        name: form.name,
        email: form.email,
        subject: form.subject || 'Support request',
        message: form.message,
        order_number: form.order_number || undefined,
      })
      toast.success('Message sent', 'Our team replies within business hours.')
      setForm({ ...form, subject: '', message: '', order_number: '' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <LifeBuoy className="h-4 w-4 text-emerald-400" aria-hidden />
              Fastest response: WhatsApp
            </p>
            <p className="mt-0.5 text-[12px] text-white/50">{settings.contact.hours}</p>
          </div>
          <a
            href={contactLink('whatsapp', settings.contact.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="nx-btn nx-btn-primary px-3.5 py-2 text-[12.5px]"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Chat on WhatsApp
          </a>
        </div>
      </div>

      <div className="nx-card p-5">
        <h2 className="font-display text-base font-bold text-white">Open a support ticket</h2>
        <form onSubmit={submit} className="mt-3.5 grid gap-3 sm:grid-cols-2">
          <Field label="Your name" required htmlFor="sname">
            <Input id="sname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" required htmlFor="semail">
            <Input id="semail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Order number (optional)" htmlFor="sorder">
            <Input
              id="sorder"
              value={form.order_number}
              onChange={(e) => setForm({ ...form, order_number: e.target.value.toUpperCase() })}
              placeholder="NX-261105-10001"
              className="font-mono"
            />
          </Field>
          <Field label="Subject" htmlFor="ssubject">
            <Input
              id="ssubject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Renewal, replacement, billing…"
            />
          </Field>
          <Field label="Message" required htmlFor="smsg" className="sm:col-span-2">
            <Textarea
              id="smsg"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Describe the issue with as much detail as you can…"
            />
          </Field>
          {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
          <div className="sm:col-span-2">
            <Button type="submit" loading={sending} icon={<Send className="h-3.5 w-3.5" />}>
              Send message
            </Button>
          </div>
        </form>
      </div>

      {messages.length > 0 && (
        <div className="nx-card p-5">
          <h2 className="mb-3 font-display text-base font-bold text-white">Your tickets</h2>
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-white">{m.subject}</p>
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
                <p className="mt-1 line-clamp-2 text-[12px] text-white/45">{m.message}</p>
                <p className="mt-1 text-[10.5px] text-white/25">{formatDateTime(m.created_at)}</p>
                {m.admin_reply && (
                  <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      NEXORA support
                    </p>
                    <p className="mt-0.5 text-[12px] text-white/65">{m.admin_reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
