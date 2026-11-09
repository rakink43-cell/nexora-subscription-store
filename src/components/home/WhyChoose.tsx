import {
  BadgeCheck,
  Clock4,
  Headphones,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { SectionHead, Reveal } from '../ui'

const REASONS = [
  {
    icon: BadgeCheck,
    title: 'Genuine premium plans',
    text: 'Real subscriptions on real plans — no cracked apps, no shady mods, no trial abuse.',
    accent: 'blue',
  },
  {
    icon: Clock4,
    title: 'Delivery in minutes',
    text: 'Most orders are activated in 10–30 minutes. You get updates at every step of the way.',
    accent: 'red',
  },
  {
    icon: ShieldCheck,
    title: 'Human payment verification',
    text: 'Every bKash, Nagad and bank transfer is checked by a person before we deliver.',
    accent: 'blue',
  },
  {
    icon: RefreshCw,
    title: '30-day replacement warranty',
    text: 'If something stops working, we fix or replace it within 24 hours — no arguments.',
    accent: 'red',
  },
  {
    icon: Wallet,
    title: 'Local payment methods',
    text: 'Pay the way Bangladesh pays: bKash, Nagad or bank transfer. No card required.',
    accent: 'blue',
  },
  {
    icon: Headphones,
    title: 'Support that answers',
    text: 'WhatsApp, email or the in-site form — a real person replies, usually within minutes.',
    accent: 'red',
  },
]

export function WhyChoose() {
  return (
    <section className="nx-section relative overflow-hidden" aria-labelledby="why-heading">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 15% 30%, rgba(0,140,255,.10), transparent 70%), radial-gradient(ellipse 45% 45% at 85% 70%, rgba(240,0,22,.08), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="nx-container relative">
        <SectionHead
          align="center"
          eyebrow="Why Choose NEXORA"
          title={<span id="why-heading">Built for trust, not just price</span>}
          subtitle="Over 10,000 subscriptions delivered across Bangladesh — here is what keeps customers coming back."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REASONS.map((r, i) => (
            <Reveal key={r.title} delay={i * 60}>
              <div className="nx-card group h-full p-5 transition hover:border-white/20">
                <span
                  className={
                    r.accent === 'blue'
                      ? 'grid h-11 w-11 place-items-center rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/10 text-[#6EC1FF] transition group-hover:scale-105'
                      : 'grid h-11 w-11 place-items-center rounded-xl border border-[#F00016]/25 bg-[#F00016]/10 text-[#FF6B78] transition group-hover:scale-105'
                  }
                >
                  <r.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-white">{r.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">{r.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
