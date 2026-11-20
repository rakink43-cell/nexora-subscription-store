import { Link } from 'react-router-dom'
import { Flame, Sparkles, Zap } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'

export function OfferTicker() {
  const { promotions, loading } = useStore()
  const active = promotions.filter((promo) => promo.is_active !== false)
  if (loading || active.length === 0) return null

  return (
    <section className="nx-offer-ticker" aria-label="Current special offers">
      <div className="nx-offer-ticker-label">
        <span className="nx-live-dot" aria-hidden />
        <Flame className="h-3.5 w-3.5" aria-hidden />
        <span>HOT DEALS</span>
      </div>
      <div className="nx-offer-ticker-window">
        <div className="nx-offer-ticker-track">
          {[0, 1].map((copy) => (
            <div className="nx-offer-ticker-group" key={copy} aria-hidden={copy === 1}>
              {active.map((promo) => (
                <Link key={promo.id} to={promo.cta_link ?? '/offers'} tabIndex={copy === 1 ? -1 : undefined} className="nx-offer-ticker-item">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#70d7ff]" aria-hidden />
                  <strong>{promo.title}</strong>
                  {promo.discount_text && <span className="nx-offer-ticker-discount">{promo.discount_text}</span>}
                  <span className="text-white/45">{promo.cta_label ?? 'Explore offer'}</span>
                  <Zap className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
