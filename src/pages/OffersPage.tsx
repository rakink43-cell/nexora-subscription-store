import { Link } from 'react-router-dom'
import { ArrowRight, Flame, Percent, Tag, Timer } from 'lucide-react'
import { useStore } from '../context/SettingsContext'
import { ProductCard } from '../components/product/ProductCard'
import { ButtonLink, ProductCardSkeleton, SectionHead, Skeleton } from '../components/ui'
import { useProductRail } from '../hooks/useProducts'

export default function OffersPage() {
  const { promotions, loading } = useStore()
  const { rows, loading: productsLoading } = useProductRail({ sort: 'discount', perPage: 8 })

  return (
    <div className="nx-container py-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="nx-eyebrow">Special Offers</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
          Exclusive deals, verified pricing
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          Curated bundles and limited-time discounts. Every offer is managed by our team and delivered
          with the same warranty as our full-price plans.
        </p>
      </div>

      <div className="mt-9 grid gap-3 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)
          : promotions.map((promo, i) => (
              <article key={promo.id} className="nx-card nx-card-hover group relative overflow-hidden p-5">
                <div
                  className={
                    i % 2 === 1
                      ? 'pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#F00016]/20 blur-2xl'
                      : 'pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#008CFF]/20 blur-2xl'
                  }
                  aria-hidden
                />
                <div className="relative flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#F00016]/30 bg-[#F00016]/12 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#FF7B85]">
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
                <h2 className="relative mt-4 font-display text-lg font-bold text-white">{promo.title}</h2>
                {promo.subtitle && <p className="relative mt-1 text-[12.5px] font-medium text-[#6EC1FF]">{promo.subtitle}</p>}
                {promo.description && (
                  <p className="relative mt-2 text-[12.5px] leading-relaxed text-white/45">{promo.description}</p>
                )}
                <Link
                  to={promo.cta_link ?? '/products'}
                  className="relative mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white"
                >
                  {promo.cta_label ?? 'Shop now'}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" aria-hidden />
                </Link>
              </article>
            ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
        <p className="flex items-center gap-1.5 text-[12px] text-white/50">
          <Percent className="h-3.5 w-3.5 text-[#6EC1FF]" aria-hidden />
          Coupons: <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white/80">NEXORA10</code>
          <span className="text-white/30">·</span>
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white/80">AI200</code>
        </p>
        <p className="flex items-center gap-1.5 text-[12px] text-white/40">
          <Timer className="h-3.5 w-3.5" aria-hidden />
          Applied at checkout · while stock lasts
        </p>
      </div>

      <section className="mt-12">
        <SectionHead
          eyebrow="Biggest discounts"
          title="Deep-cut prices right now"
          subtitle="Sorted by discount percentage — the best value in the catalogue today."
          action={<ButtonLink to="/products?sort=discount" variant="ghost" size="sm">All discounts</ButtonLink>}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {productsLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : rows.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  )
}
