import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Flame, Headphones, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { ButtonLink } from '../ui'

const featureCopy = [
  { tag: 'STREAMING ZONE', title: 'Your next binge starts here.', subtitle: 'Premium entertainment, all in one portal.', emoji: '🍿', href: '/category/ott-subscriptions', color: 'from-fuchsia-500/40 to-violet-500/10' },
  { tag: 'AI POWER-UP', title: 'Power up your creativity.', subtitle: 'Discover the AI tools that move ideas forward.', emoji: '🤖', href: '/category/ai-premium-tools', color: 'from-cyan-400/35 to-blue-600/10' },
  { tag: 'LEARNING ARENA', title: 'Unlock your next level.', subtitle: 'Premium learning for your next big move.', emoji: '🚀', href: '/category/educational-subscriptions', color: 'from-amber-400/30 to-pink-600/10' },
  { tag: 'CREATOR LOADOUT', title: 'Build your ultimate toolkit.', subtitle: 'The tools you need to create, design and work.', emoji: '🎮', href: '/category/software-productivity', color: 'from-violet-500/40 to-pink-500/10' },
]

export function Hero() {
  const { settings, categories } = useStore()
  const site = settings.site
  const [featureIndex, setFeatureIndex] = useState(0)
  const active = featureCopy[featureIndex]

  useEffect(() => {
    const timer = window.setInterval(() => setFeatureIndex((index) => (index + 1) % featureCopy.length), 5600)
    return () => window.clearInterval(timer)
  }, [])

  const cards = categories.filter((category) => category.is_active).slice(0, 3)

  return (
    <section className="nx-reference-hero relative isolate overflow-hidden" aria-label="NEXORA premium gaming marketplace">
      <div className="nx-reference-bg absolute inset-0 -z-10" aria-hidden />
      <div className="nx-reference-shell nx-container">
        <div className="nx-reference-navline">
          <span className="nx-reference-brand"><span className="nx-brand-orb">✦</span> NEXORA</span>
          <span className="nx-reference-status"><span className="nx-live-dot" /> PREMIUM UNIVERSE</span>
        </div>

        <div className="nx-reference-main">
          <div className="nx-reference-copy">
            <span className="nx-reference-eyebrow"><Sparkles className="h-3.5 w-3.5" /> LEVEL UP YOUR DIGITAL LIFE</span>
            <h1 className="nx-reference-title">
              {site.hero_headline || 'UNLOCK THE'}{' '}
              <span>{site.hero_headline ? '' : 'NEXT LEVEL'}</span>
            </h1>
            <p className="nx-reference-subtitle">{site.hero_subtitle || 'Premium subscriptions, AI tools, streaming and creator essentials — all in one place.'}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to="/products" size="lg" icon={<Zap className="h-4 w-4" />}>{site.hero_cta || 'Explore Store'}</ButtonLink>
              <ButtonLink to={site.hero_secondary_link || '/offers'} variant="ghost" size="lg" icon={<ArrowRight className="h-4 w-4" />}>{site.hero_secondary_cta || 'View Offers'}</ButtonLink>
            </div>
            <div className="nx-reference-trust">
              <span><BadgeCheck /> Verified payments</span>
              <span><ShieldCheck /> Secure checkout</span>
              <span><Headphones /> Friendly support</span>
            </div>
          </div>

          <div className="nx-reference-character-wrap" aria-hidden="true">
            <div className="nx-character-aura" />
            <div className="nx-character-spark nx-spark-one">✦</div>
            <div className="nx-character-spark nx-spark-two">✧</div>
            <div className="nx-character-planet">◉</div>
            <img className="nx-reference-character" src="/mascot/nexora-arcade-mascot.svg" alt="" />
            <div className="nx-character-caption"><Flame /> NEXORA GAMEVERSE</div>
          </div>
        </div>

        <div className="nx-reference-feature">
          <div className="nx-feature-description" key={featureIndex}>
            <span className="nx-reference-eyebrow">{active.tag}</span>
            <h2>{active.title}</h2>
            <p>{active.subtitle}</p>
            <Link to={active.href}>Explore feature <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="nx-feature-pips" aria-label="Feature slideshow controls">
            {featureCopy.map((item, index) => <button key={item.tag} type="button" aria-label={'Show ' + item.tag} aria-current={index === featureIndex ? 'true' : undefined} onClick={() => setFeatureIndex(index)} className={index === featureIndex ? 'active' : ''} />)}
          </div>
        </div>

        <div className="nx-reference-cards">
          {cards.map((category, index) => (
            <Link to={'/category/' + category.slug} className="nx-reference-card" key={category.id}>
              <div className="nx-reference-card-image">
                {category.image_url ? <img src={category.image_url} alt="" loading="lazy" /> : <span>{category.icon || ['🎮', '✨', '🚀'][index]}</span>}
                <span className="nx-card-play">↗</span>
              </div>
              <strong>{category.name}</strong>
              <small>{category.description || 'Explore premium picks'}</small>
              <span className="nx-card-action">Explore now <ArrowRight className="h-3 w-3" /></span>
            </Link>
          ))}
          {cards.length === 0 && <Link to="/products" className="nx-reference-card nx-reference-card-empty"><span>🎮</span><strong>Explore the NEXORA Store</strong><small>Discover premium subscriptions</small></Link>}
        </div>
      </div>
    </section>
  )
}
