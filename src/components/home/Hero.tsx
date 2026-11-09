import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Headphones, ShieldCheck, Zap } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { ButtonLink } from '../ui'
import { cn } from '../../lib/utils'

export function Hero() {
  const { settings } = useStore()
  const site = settings.site

  return (
    <section className="relative isolate overflow-hidden" aria-label="Featured">
      {/* cinematic background using the official promotional banner */}
      <div className="absolute inset-0 -z-10">
        <img
          src={site.hero_banner || '/brand/nexora-banner.png'}
          alt=""
          aria-hidden
          className="h-full w-full object-cover object-center opacity-[0.32]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/80 to-[#050505]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(0,140,255,0.18),transparent_70%)]" />
      </div>
      <div className="nx-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />

      <div className="nx-container pb-14 pt-14 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#008CFF]/30 bg-[#008CFF]/10 px-3 py-1 text-[11px] font-semibold text-[#7CC7FF] backdrop-blur">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Verified bKash · Nagad · Bank payments
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 backdrop-blur">
              10,000+ orders delivered
            </span>
          </div>

          <h1 className="font-display text-[clamp(1.9rem,5.4vw,3.9rem)] font-extrabold leading-[1.06] tracking-tight text-white">
            Unlock a World of{' '}
            <span className="relative whitespace-nowrap">
              <span className="nx-gradient-text">Premium Entertainment</span>
              <svg
                className="absolute -bottom-1.5 left-0 h-2 w-full text-[#F00016]/70"
                viewBox="0 0 200 8"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d="M0 6 Q 50 0 100 5 T 200 3" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </svg>
            </span>{' '}
            &amp; More!
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55 sm:text-base">
            Premium Subscriptions — All in One Place. OTT, AI tools, education, software and gaming
            delivered fast, verified by real people, backed by a 30-day replacement warranty.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink to="/products" size="lg" className="w-full sm:w-auto" icon={<Zap className="h-4 w-4" />}>
              Explore Subscriptions
            </ButtonLink>
            <ButtonLink
              to="/offers"
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              View Special Offers
            </ButtonLink>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {(settings.trust?.items ?? []).slice(0, 4).map((item, i) => {
              const icons = [BadgeCheck, Zap, ShieldCheck, Headphones]
              const Icon = icons[i % 4]
              return (
                <div
                  key={item.title}
                  className="nx-glass flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#008CFF]/25 to-[#008CFF]/5 text-[#6EC1FF]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-semibold text-white">{item.title}</p>
                    <p className="truncate text-[10px] text-white/40">{item.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* official banner showcase */}
      <div className="nx-container pb-12">
        <div className="group relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_80px_-40px_rgba(0,140,255,0.55)]">
          <img
            src={site.hero_banner || '/brand/nexora-banner.png'}
            alt="NEXORA premium subscriptions — OTT, AI tools, software and more"
            className="w-full object-cover transition duration-700 group-hover:scale-[1.01]"
            loading="eager"
          />
          <div className={cn('pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10')} aria-hidden />
          <Link
            to="/products"
            className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-lg bg-black/65 px-3 py-2 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-[#008CFF] sm:inline-flex"
          >
            Browse the full catalogue
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
