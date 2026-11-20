import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Headphones, ShieldCheck, Zap } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { ButtonLink } from '../ui'
import { cn } from '../../lib/utils'

export function Hero() {
  const { settings } = useStore()
  const site = settings.site
  const slides = [site.hero_banner, ...(site.hero_slides ?? [])].filter((url): url is string => Boolean(url))
  const [slideIndex, setSlideIndex] = useState(0)
  const [featureIndex, setFeatureIndex] = useState(0)
  const features = [
    { tag: 'STREAMING ZONE', title: 'Your favourite worlds. One portal.', text: 'Unlock premium entertainment and stream without limits.', emoji: '🍿', color: 'from-sky-500/30 to-indigo-600/20', link: '/category/ott-subscriptions', action: 'Explore OTT' },
    { tag: 'AI POWER-UP', title: 'Level up your creativity.', text: 'Discover smart AI tools for ideas, work, learning and creation.', emoji: '🤖', color: 'from-violet-500/30 to-fuchsia-600/20', link: '/category/ai-premium-tools', action: 'Explore AI' },
    { tag: 'LEARNING ARENA', title: 'Unlock your next skill.', text: 'Premium learning platforms to power your next big move.', emoji: '🚀', color: 'from-emerald-500/25 to-cyan-600/20', link: '/category/educational-subscriptions', action: 'Start learning' },
    { tag: 'CREATOR LOADOUT', title: 'Build your ultimate toolkit.', text: 'Get productivity, design and creator subscriptions in one place.', emoji: '🎮', color: 'from-rose-500/25 to-orange-500/20', link: '/category/software-productivity', action: 'View toolkit' },
  ]
  const activeImage = slides.length ? slides[slideIndex % slides.length] : '/brand/nexora-banner.png'

  useEffect(() => { setSlideIndex(0) }, [slides.join('|')])
  useEffect(() => {
    const timer = window.setInterval(() => setFeatureIndex((index) => (index + 1) % features.length), 5200)
    return () => window.clearInterval(timer)
  }, [features.length])
  useEffect(() => {
    if (slides.length < 2) return
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), 5000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  return (
    <section className="nx-game-hero relative isolate overflow-hidden" aria-label="Featured NEXORA gaming marketplace">
      {/* cinematic background using the official promotional banner */}
      <div className="absolute inset-0 -z-10">
        <img
          src={activeImage}
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
          <div className="nx-game-mascot" aria-hidden>👾</div>
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#008CFF]/30 bg-[#008CFF]/10 px-3 py-1 text-[11px] font-semibold text-[#7CC7FF] backdrop-blur">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Verified bKash · Nagad · Bank payments
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 backdrop-blur">
              10,000+ orders delivered
            </span>
          </div>

          <div className="nx-game-kicker mx-auto mb-4"><span className="nx-live-dot" /> WELCOME TO THE NEXORA GAMEVERSE</div>
          <h1 className="nx-game-title font-display text-[clamp(1.9rem,5.4vw,3.9rem)] font-extrabold leading-[1.06] tracking-tight text-white">
            <span className="nx-gradient-text">{site.hero_headline || 'Unlock a World of Premium Entertainment & More!'}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55 sm:text-base">
            {site.hero_subtitle || 'Premium Subscriptions — All in One Place. OTT, AI tools, education, software and gaming delivered fast.'}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink to="/products" size="lg" className="w-full sm:w-auto" icon={<Zap className="h-4 w-4" />}>
              {site.hero_cta || 'Explore Subscriptions'}
            </ButtonLink>
            <ButtonLink
              to={site.hero_secondary_link || '/offers'}
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              {site.hero_secondary_cta || 'View Special Offers'}
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

      {/* rotating game-feature showcase */}
      <div className="nx-container pb-14 sm:pb-16">
        <div className={cn('nx-feature-stage relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br p-5 sm:p-8 md:p-10', features[featureIndex].color)}>
          <div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, white 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, white 1px, transparent 1.5px)', backgroundSize: '42px 42px, 58px 58px' }} />
          <div className="relative grid items-center gap-7 md:grid-cols-[1.15fr_.85fr]">
            <div key={featureIndex} className="nx-feature-copy">
              <span className="nx-game-kicker">{features[featureIndex].tag}</span>
              <h2 className="mt-4 max-w-xl font-display text-3xl font-black leading-tight text-white sm:text-4xl">{features[featureIndex].title}</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/65 sm:text-base">{features[featureIndex].text}</p>
              <Link to={features[featureIndex].link} className="nx-btn nx-btn-primary mt-6 inline-flex">{features[featureIndex].action}<ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="relative flex min-h-[180px] items-center justify-center sm:min-h-[230px]">
              <div className="nx-feature-orbit absolute h-44 w-44 rounded-full border border-dashed border-white/25 sm:h-56 sm:w-56" />
              <div className="nx-feature-orbit nx-feature-orbit-reverse absolute h-32 w-32 rounded-full border border-white/15 sm:h-40 sm:w-40" />
              <div className="nx-feature-character relative grid h-32 w-32 place-items-center rounded-[2rem] border border-white/20 bg-black/25 text-7xl shadow-2xl backdrop-blur-sm sm:h-40 sm:w-40 sm:text-8xl">{features[featureIndex].emoji}</div>
              <span className="absolute right-[12%] top-[12%] text-2xl animate-pulse">✦</span><span className="absolute bottom-[10%] left-[12%] text-xl animate-bounce">✧</span>
            </div>
          </div>
          <div className="relative mt-7 flex items-center justify-between border-t border-white/15 pt-4">
            <span className="text-[10px] font-bold tracking-[.2em] text-white/50">FEATURE {String(featureIndex + 1).padStart(2, '0')} / 04</span>
            <div className="flex items-center gap-2" aria-label="Feature slideshow controls">
              {features.map((feature, index) => <button key={feature.tag} type="button" onClick={() => setFeatureIndex(index)} aria-label={'Show ' + feature.tag} aria-current={featureIndex === index ? 'true' : undefined} className={featureIndex === index ? 'h-2 w-8 rounded-full bg-white' : 'h-2 w-2 rounded-full bg-white/35 transition hover:bg-white/70'} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
