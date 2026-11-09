import { Quote } from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { Rating, SectionHead, Skeleton } from '../ui'
import { formatDate, initials } from '../../lib/utils'

export function Testimonials() {
  const { reviews, loading } = useStore()
  const shown = reviews.slice(0, 6)
  const average = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 4.9

  return (
    <section className="nx-section" aria-labelledby="reviews-heading">
      <div className="nx-container">
        <SectionHead
          eyebrow="Customer Reviews"
          title={<span id="reviews-heading">Trusted by thousands across Bangladesh</span>}
          subtitle={`Rated ${average.toFixed(1)} / 5 from ${reviews.length || 0} verified customers.`}
        />

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => (
              <figure key={r.id} className="nx-card relative h-full p-5">
                <Quote className="absolute right-4 top-4 h-7 w-7 text-white/[0.06]" aria-hidden />
                <Rating value={r.rating} showValue={false} />
                <blockquote className="mt-3 text-[13px] leading-relaxed text-white/70">
                  “{r.comment}”
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5 border-t border-white/8 pt-3.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#008CFF] to-[#F00016] text-[11px] font-bold text-white">
                    {initials(r.customer_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-white">{r.customer_name}</p>
                    <p className="truncate text-[10.5px] text-white/35">
                      {r.customer_city} · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                    Verified
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
