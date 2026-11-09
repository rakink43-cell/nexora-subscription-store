import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react'
import { api } from '../lib/api'
import { useStore } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { Button, ErrorNote, Field, Input, Textarea } from '../components/ui'
import { contactLink, isEmail } from '../lib/utils'

export default function ContactPage() {
  const { settings } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const contact = settings.contact

  const [form, setForm] = useState({
    name: user?.full_name ?? '',
    email: user?.email ?? '',
    phone: '',
    subject: '',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.name.trim().length < 2) return setError('Please tell us your name.')
    if (!isEmail(form.email)) return setError('Enter a valid email address so we can reply.')
    if (form.message.trim().length < 5) return setError('Please write a short message.')
    setSending(true)
    try {
      await api.support.send({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject || 'Website enquiry',
        message: form.message,
      })
      setSent(true)
      toast.success('Message sent', 'We usually reply within a couple of hours.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="nx-container py-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="nx-eyebrow">Contact Us</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
          We answer fast, and like humans
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          Questions about a plan, a payment or a renewal? Message us on WhatsApp for the fastest reply, or
          send the form below and we will get back to you by email.
        </p>
      </div>

      <div className="mt-9 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="nx-card p-5">
          {sent ? (
            <div className="py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-white">Message received</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/50">
                Thanks {form.name.split(' ')[0]} — we sent a copy to {form.email}. Expect a reply during
                business hours, usually within a couple of hours.
              </p>
              <Button variant="ghost" className="mt-4" onClick={() => setSent(false)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-3.5 sm:grid-cols-2">
              <Field label="Your name" required htmlFor="cname">
                <Input id="cname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tanvir Ahmed" />
              </Field>
              <Field label="Email" required htmlFor="cemail">
                <Input id="cemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </Field>
              <Field label="Phone (optional)" htmlFor="cphone">
                <Input id="cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01712345678" inputMode="tel" />
              </Field>
              <Field label="Subject" htmlFor="csubject">
                <Input id="csubject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="How can we help?" />
              </Field>
              <Field label="Message" required htmlFor="cmsg" className="sm:col-span-2">
                <Textarea
                  id="cmsg"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Tell us what you need — include your order number if you have one."
                />
              </Field>
              {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
              <div className="sm:col-span-2">
                <Button type="submit" loading={sending} icon={<Send className="h-4 w-4" />}>
                  Send message
                </Button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-3">
          <a
            href={contactLink('whatsapp', contact.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 transition hover:bg-emerald-500/[0.14]"
          >
            <p className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <MessageCircle className="h-4 w-4 text-emerald-400" aria-hidden />
              WhatsApp support
            </p>
            <p className="mt-1 text-[12px] text-white/55">{contact.phone}</p>
            <p className="mt-1 text-[11px] text-emerald-300">Fastest · usually under 10 minutes</p>
          </a>

          <InfoRow icon={Phone} label="Call us" value={contact.phone} href={contactLink('call', contact.phone)} />
          <InfoRow icon={Mail} label="Email" value={contact.email} href={contactLink('email', contact.email)} />
          <InfoRow icon={MapPin} label="Address" value={contact.address} />
          <InfoRow icon={Clock} label="Support hours" value={contact.hours} />

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Looking for something?</p>
            <ul className="mt-2 space-y-1.5 text-[12px]">
              <li><a href="/track" className="text-[#6EC1FF] hover:underline">Track an existing order</a></li>
              <li><a href="/faq" className="text-[#6EC1FF] hover:underline">Read the FAQ</a></li>
              <li><a href="/refund" className="text-[#6EC1FF] hover:underline">Refund policy</a></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  href?: string
}) {
  const content = (
    <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#008CFF]/12 text-[#6EC1FF]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
        <p className="break-words text-[12.5px] text-white/75">{value}</p>
      </div>
    </div>
  )
  return href ? (
    <a href={href} className="block transition hover:opacity-85">
      {content}
    </a>
  ) : (
    content
  )
}
