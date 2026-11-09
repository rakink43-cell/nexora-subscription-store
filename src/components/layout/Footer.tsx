import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Globe,
  Share2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Clock,
  Send,
} from 'lucide-react'
import { Logo } from '../brand/Logo'
import { useStore } from '../../context/SettingsContext'
import { getDataSource } from '../../lib/api'
import { contactLink } from '../../lib/utils'

const PRODUCT_LINKS = [
  { label: 'All Products', to: '/products' },
  { label: 'OTT Subscriptions', to: '/category/ott-subscriptions' },
  { label: 'AI Premium Tools', to: '/category/ai-premium-tools' },
  { label: 'Educational', to: '/category/educational-subscriptions' },
  { label: 'Software & Productivity', to: '/category/software-productivity' },
  { label: 'Gaming & Entertainment', to: '/category/gaming-entertainment' },
  { label: 'Special Offers', to: '/offers' },
]

const COMPANY_LINKS = [
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Track Order', to: '/track' },
]

const LEGAL_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Refund Policy', to: '/refund' },
]

export function Footer() {
  const { settings, categories } = useStore()
  const contact = settings.contact
  const source = getDataSource()

  const productLinks = categories.length
    ? categories.map((c) => ({ label: c.name, to: `/category/${c.slug}` }))
    : PRODUCT_LINKS

  return (
    <footer className="relative mt-16 overflow-hidden border-t border-white/8 bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 20% 0%, rgba(0,140,255,.18), transparent 70%), radial-gradient(ellipse 50% 100% at 85% 0%, rgba(240,0,22,.12), transparent 70%)',
        }}
        aria-hidden
      />

      <div className="nx-container relative py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/45">
              {settings.site.tagline}. Genuine premium plans delivered fast, with payments verified by
              real people across Bangladesh.
            </p>

            <div className="mt-5 space-y-2.5 text-[13px]">
              <a
                href={contactLink('call', contact.phone)}
                className="flex items-center gap-2.5 text-white/65 transition hover:text-white"
              >
                <Phone className="h-3.5 w-3.5 text-[#6EC1FF]" aria-hidden />
                {contact.phone}
              </a>
              <a
                href={contactLink('email', contact.email)}
                className="flex items-center gap-2.5 break-all text-white/65 transition hover:text-white"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#6EC1FF]" aria-hidden />
                {contact.email}
              </a>
              <p className="flex items-start gap-2.5 text-white/50">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6EC1FF]" aria-hidden />
                {contact.address}
              </p>
              <p className="flex items-start gap-2.5 text-white/50">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6EC1FF]" aria-hidden />
                {contact.hours}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <a
                href={contactLink('whatsapp', contact.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat on WhatsApp"
                className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href={contactLink('email', contact.email)}
                aria-label="Email us"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-white/25 hover:text-white"
              >
                <Send className="h-4 w-4" />
              </a>
              {contact.facebook ? (
                <a
                  href={contact.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook page"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition hover:border-white/25 hover:text-white"
                >
                  <Globe className="h-4 w-4" />
                </a>
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/8 bg-white/[0.02] text-white/25">
                  <Share2 className="h-4 w-4" aria-hidden />
                </span>
              )}
            </div>
          </div>

          <FooterCol title="Products" links={productLinks.slice(0, 7)} />
          <FooterCol title="Company" links={COMPANY_LINKS} />

          <div>
            <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="group inline-flex items-center gap-1 text-[13px] text-white/60 transition hover:text-white"
                  >
                    {l.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-60" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                Verified payments
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {['bKash', 'Nagad', 'Bank'].map((m) => (
                  <span
                    key={m}
                    className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold text-white/65"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="nx-divider my-8" />

        <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <p className="text-[11.5px] text-white/35">
            © {new Date().getFullYear()} NEXORA · All rights reserved. NEXORA is an independent reseller;
            all trademarks belong to their respective owners.
          </p>
          <div className="flex items-center gap-3">
            <span
              className={
                source === 'live'
                  ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300'
                  : source === 'setup'
                    ? 'inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-300'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300'
              }
              title={
                source === 'live'
                  ? 'Connected to Supabase PostgreSQL with Row Level Security.'
                  : source === 'setup'
                    ? 'Supabase credentials found but migrations are not applied yet.'
                    : 'No Supabase credentials detected — data is stored in this browser only.'
              }
            >
              <span
                className={
                  source === 'live'
                    ? 'h-1.5 w-1.5 rounded-full bg-emerald-400'
                    : source === 'setup'
                      ? 'h-1.5 w-1.5 rounded-full bg-rose-400'
                      : 'h-1.5 w-1.5 rounded-full bg-amber-400'
                }
              />
              {source === 'live' ? 'Live database' : source === 'setup' ? 'Migrations pending' : 'Demo data (not connected)'}
            </span>
            <span className="text-[11.5px] text-white/25">v1.0</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="group inline-flex items-center gap-1 text-[13px] text-white/60 transition hover:text-white"
            >
              {l.label}
              <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-60" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
