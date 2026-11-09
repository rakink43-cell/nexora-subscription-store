import { Link } from 'react-router-dom'
import { ArrowRight, Flame, Tag } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { SectionHead } from '../ui'

export function OffersStrip() {
  const { promotions, loading } = useStore()
  if (!loading && promotions.length === 0) return null

  return (
    <section className="nx-section" aria-labelledby="offers-heading">
      <div className="nx-container">
        <SectionHead
          eyebrow="Exclusive Offers"
          title={<span id="offers-heading">This week&apos;s best-value bundles</span>}
          subtitle="Hand-picked deals curated by our team — limited stock, verified pricing."
          action={
            <Link
              to="/offers"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6EC1FF] transition hover:text-white"
            >
              All offers
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />

        <div className="grid gap-3 lg:grid-cols-3">
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={`skeleton-${i}`} className="nx-skeleton h-52 rounded-xl" />
            ))}
          {!loading &&
            promotions.slice(0, 3).map((promo, i) => {
            const isRed = i % 2 === 1
            return (
              <Link
                key={promo.id}
                to={promo.cta_link ?? '/products'}
                className="nx-card nx-card-hover group relative flex flex-col overflow-hidden p-5"
              >
                <div
                  className={
                    isRed
                      ? 'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#F00016]/20 blur-2xl'
                      : 'pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#008CFF]/20 blur-2xl'
                  }
                  aria-hidden
                />
                <div className="relative flex items-center gap-2">
                  <span
                    className={
                      isRed
                        ? 'inline-flex items-center gap-1 rounded-md border border-[#F00016]/30 bg-[#F00016]/12 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#FF7B85]'
                        : 'inline-flex items-center gap-1 rounded-md border border-[#008CFF]/30 bg-[#008CFF]/12 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#7CC7FF]'
                    }
                  >
                    <Flame className="h-2.5 w-2.5" aria-hidden />
                    {promo.badge ?? 'Offer'}
                  </span>
                  {promo.discount_text && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/70">
                      <Tag className="h-2.5 w-2.5" aria-hidden />
                      {promo.discount_text}
                    </span>
                  )}
                </div>

                <h3 className="relative mt-4 font-display text-lg font-bold leading-snug text-white">
                  {promo.title}
                </h3>
                {promo.subtitle && (
                  <p className="relative mt-1 text-[12.5px] font-medium text-[#6EC1FF]">{promo.subtitle}</p>
                )}
                {promo.description && (
                  <p className="relative mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-white/45">
                    {promo.description}
                  </p>
                )}

                <span className="relative mt-auto inline-flex items-center gap-1.5 pt-4 text-[12.5px] font-semibold text-white">
                  {promo.cta_label ?? 'Shop now'}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" aria-hidden />
                </span>
                </Link>
              )
            })}
        </div>
      </div>
    </section>
  )
}
