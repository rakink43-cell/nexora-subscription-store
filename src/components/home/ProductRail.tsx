import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ProductCard } from '../product/ProductCard'
import { ProductCardSkeleton, SectionHead } from '../ui'
import { useProductRail } from '../../hooks/useProducts'
import type { ProductQuery } from '../../types'

export function ProductRail({
  eyebrow,
  title,
  subtitle,
  query,
  viewAllTo,
  viewAllLabel = 'View all',
}: {
  eyebrow: string
  title: string
  subtitle?: string
  query: ProductQuery
  viewAllTo: string
  viewAllLabel?: string
}) {
  const { rows, loading } = useProductRail({ perPage: 4, ...query })

  if (!loading && rows.length === 0) return null

  return (
    <section className="nx-section" aria-labelledby={`rail-${query.categorySlug ?? query.sort ?? 'featured'}`}>
      <div className="nx-container">
        <SectionHead
          eyebrow={eyebrow}
          title={<span id={`rail-${query.categorySlug ?? query.sort ?? 'featured'}`}>{title}</span>}
          subtitle={subtitle}
          action={
            <Link
              to={viewAllTo}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6EC1FF] transition hover:text-white"
            >
              {viewAllLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : rows.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </section>
  )
}
