import { BadgeCheck, Heart, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react'
import { useStore } from '../context/SettingsContext'
import { ButtonLink, SectionHead } from '../components/ui'

const STATS = [
  { value: '10,000+', label: 'Orders delivered' },
  { value: '40+', label: 'Premium platforms' },
  { value: '4.9/5', label: 'Average rating' },
  { value: '30 min', label: 'Median delivery time' },
]

const VALUES = [
  {
    icon: BadgeCheck,
    title: 'Genuine plans only',
    text: 'We buy real Premium plans. No cracked APKs, no stolen accounts, no "unlimited trial" tricks that break in a week.',
  },
  {
    icon: ShieldCheck,
    title: 'Human verification',
    text: 'Every bKash, Nagad and bank transfer is checked by a person before anything is delivered — that is why our fraud rate is zero.',
  },
  {
    icon: Heart,
    title: 'Support over sales',
    text: 'We would rather talk you out of a plan that does not fit than sell you something you will not use.',
  },
  {
    icon: Zap,
    title: 'Speed as a feature',
    text: 'Most orders are delivered in under 30 minutes. When something is slow, we tell you exactly why.',
  },
]

export default function AboutPage() {
  const { settings } = useStore()

  return (
    <div className="nx-container py-12">
      <div className="mx-auto max-w-3xl text-center">
        <span className="nx-eyebrow">About NEXORA</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
          A subscription store built for Bangladesh
        </h1>
        <p className="mt-4 text-[14.5px] leading-relaxed text-white/55">
          NEXORA started with a simple frustration: premium subscriptions are priced for Western
          salaries, and paying for them from Bangladesh was either impossible or a gamble. So we built a
          store that speaks your language — BDT prices, bKash and Nagad, verified by people, and delivered
          in minutes.
        </p>
      </div>

      <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="nx-card p-4 text-center">
            <p className="font-display text-xl font-extrabold text-white sm:text-2xl">{s.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="nx-card p-6">
          <h2 className="font-display text-xl font-bold text-white">Our story</h2>
          <div className="mt-3 space-y-3 text-[13.5px] leading-relaxed text-white/55">
            <p>
              In 2023 we were a two-person operation running orders out of a WhatsApp group. Customers
              wanted Netflix, students wanted ChatGPT Plus, freelancers wanted Canva Pro — and nobody
              wanted to give their card details to a stranger online.
            </p>
            <p>
              So we built the boring parts properly: a real catalogue, real order numbers, a manual
              payment verification workflow where a human checks every transaction, and a warranty that
              means what it says. That back office is the reason customers trust the front.
            </p>
            <p>
              Today NEXORA serves thousands of customers across Dhaka, Chattogram, Sylhet, Khulna and
              beyond — mostly through referrals, which we consider the only review that matters.
            </p>
          </div>
        </div>

        <div className="nx-card p-6">
          <h2 className="font-display text-xl font-bold text-white">How we work</h2>
          <ol className="mt-3 space-y-3.5">
            {[
              ['You pick a plan', 'Browse real plans with real prices in BDT — no hidden conversion fees.'],
              ['You pay locally', 'Send money by bKash, Nagad or bank transfer, then submit the transaction ID.'],
              ['We verify by hand', 'A team member matches your transaction to your order — usually in 10–30 minutes.'],
              ['You get access', 'Credentials go to your email and dashboard, with a 30-day replacement warranty.'],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#008CFF]/15 text-[11px] font-bold text-[#6EC1FF]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-12">
        <SectionHead align="center" eyebrow="What we stand for" title="Four principles, no exceptions" />
        <div className="grid gap-3 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="nx-card p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/10 text-[#6EC1FF]">
                <v.icon className="h-4.5 w-4.5" style={{ height: '1.1rem', width: '1.1rem' }} />
              </span>
              <h3 className="mt-3 text-[14.5px] font-semibold text-white">{v.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">{v.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-[#008CFF]/20 bg-gradient-to-br from-[#008CFF]/[0.09] via-[#0B111D] to-[#0B111D] p-7 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-[#6EC1FF]" aria-hidden />
        <h2 className="mt-3 font-display text-xl font-bold text-white sm:text-2xl">
          Questions before you buy? Just ask.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-white/50">
          {settings.notices?.support_note ?? 'Message us on WhatsApp — we reply in minutes.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <ButtonLink to="/products">Browse subscriptions</ButtonLink>
          <ButtonLink to="/contact" variant="ghost">Contact us</ButtonLink>
        </div>
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/25">
        <Users className="h-3 w-3" aria-hidden />
        NEXORA is an independent reseller. All trademarks belong to their respective owners.
      </p>
    </div>
  )
}
