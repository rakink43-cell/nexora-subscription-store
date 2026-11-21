import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Flame, Sparkles, Zap } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { ButtonLink } from '../ui'

const slides = [
  { title: 'ENJOY THE PLAY', accent: 'THE PLAY', description: 'Premium entertainment, AI tools and digital essentials — all in one place.', href: '/products', label: 'Explore the store' },
  { title: 'POWER UP YOUR LIFE', accent: 'YOUR LIFE', description: 'Unlock premium tools for streaming, learning and creating.', href: '/category/ai-premium-tools', label: 'Explore AI tools' },
  { title: 'UNLOCK YOUR NEXT LEVEL', accent: 'NEXT LEVEL', description: 'Find your next favourite subscription in the NEXORA Gameverse.', href: '/offers', label: 'Discover offers' },
]

export function Hero() {
  const { settings, categories } = useStore()
  const site = settings.site
  const [slideIndex, setSlideIndex] = useState(0)
  const active = slides[slideIndex]
  useEffect(() => {
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), 5800)
    return () => window.clearInterval(timer)
  }, [])

  const cards = categories.filter((category) => category.is_active).slice(0, 3)

  return (
    <section className="nx-reference-hero relative isolate overflow-hidden" aria-label="NEXORA premium gaming marketplace">
      <div className="nx-reference-bg absolute inset-0 -z-10" aria-hidden />
      <div className="nx-reference-shell nx-container">
        <div className="nx-reference-navline">
          <Link to="/" className="nx-reference-brand" aria-label="NEXORA home">
            <span className="nx-brand-orb">✦</span><span>NEXORA</span>
          </Link>
          <nav className="nx-reference-nav" aria-label="Gaming store navigation">
            <Link to="/" aria-current="page">Home</Link>
            <Link to="/products">Games</Link>
            <Link to="/about">Company</Link>
            <Link to="/offers">Offers</Link>
            <Link to="/contact">About us</Link>
          </nav>
          <Link to="/products" className="nx-reference-member">Become Member</Link>
        </div>

        <div className="nx-reference-main">
          <div className="nx-reference-copy" key={slideIndex}>
            <span className="nx-reference-eyebrow"><Sparkles className="h-3.5 w-3.5" /> NEXORA GAMEVERSE</span>
            <h1 className="nx-reference-title">
              {site.hero_headline || active.title}
            </h1>
            <p className="nx-reference-subtitle">{site.hero_subtitle || active.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink to={site.hero_cta ? '/products' : active.href} size="lg" icon={<Zap className="h-4 w-4" />}>{site.hero_cta || 'Play Now'}</ButtonLink>
              <ButtonLink to={site.hero_secondary_link || '/products'} variant="ghost" size="lg" icon={<ArrowRight className="h-4 w-4" />}>{site.hero_secondary_cta || 'Browse Game'}</ButtonLink>
            </div>
          </div>

          <div className="nx-reference-character-wrap" aria-hidden="true">
            <div className="nx-character-aura" />
            <div className="nx-character-spark nx-spark-one">✦</div>
            <div className="nx-character-spark nx-spark-two">✧</div>
            <img className="nx-reference-character" src="/mascot/nexora-arcade-mascot.svg" alt="" />
          </div>
        </div>

        <div className="nx-reference-cards">
          {cards.map((category, index) => (
            <Link to={'/category/' + category.slug} className="nx-reference-card" key={category.id}>
              <div className="nx-reference-card-image">
                {category.image_url ? <img src={category.image_url} alt="" loading="lazy" /> : <span>{category.icon || ['🎮', '✨', '🚀'][index]}</span>}
                <span className="nx-card-play">▷</span>
              </div>
              <strong>{category.name}</strong>
              <small>{category.description || 'Premium gaming essentials'}</small>
              <span className="nx-card-action">Play Now <ArrowRight className="h-3 w-3" /></span>
            </Link>
          ))}
          {cards.length === 0 && <Link to="/products" className="nx-reference-card nx-reference-card-empty"><span>🎮</span><strong>Explore NEXORA</strong><small>Discover premium subscriptions</small></Link>}
          <div className="nx-reference-slide-controls">
            <div className="nx-reference-slide-label"><Flame /> {active.title}</div>
            <div className="nx-feature-pips" aria-label="Hero slideshow controls">
              {slides.map((item, index) => <button key={item.title} type="button" aria-label={'Show ' + item.title} aria-current={index === slideIndex ? 'true' : undefined} onClick={() => setSlideIndex(index)} className={index === slideIndex ? 'active' : ''} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
