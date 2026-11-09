import { Link } from 'react-router-dom'
import {
  BrainCircuit,
  Clapperboard,
  Gamepad2,
  GraduationCap,
  Layers,
  Palette,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useStore } from '../../context/SettingsContext'
import { SectionHead, Skeleton } from '../ui'
import { cn } from '../../lib/utils'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Clapperboard,
  BrainCircuit,
  GraduationCap,
  Layers,
  Gamepad2,
  Palette,
  Sparkles,
}

export function CategoryGrid() {
  const { categories, loading } = useStore()

  return (
    <section className="nx-section" aria-labelledby="categories-heading">
      <div className="nx-container">
        <SectionHead
          eyebrow="Featured Categories"
          title={<span id="categories-heading">Shop by category</span>}
          subtitle="Six curated collections covering everything digital — from streaming to serious work tools."
          action={
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6EC1FF] transition hover:text-white"
            >
              All products
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => {
              const Icon = ICONS[cat.icon ?? 'Sparkles'] ?? Sparkles
              const isRed = cat.accent === 'red'
              return (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="nx-card nx-card-hover group relative overflow-hidden p-4"
                >
                  <div
                    className={cn(
                      'pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition group-hover:opacity-90',
                      isRed ? 'bg-[#F00016]/15' : 'bg-[#008CFF]/15',
                    )}
                    aria-hidden
                  />
                  <div className="relative flex items-start gap-3">
                    <span
                      className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition',
                        isRed
                          ? 'border-[#F00016]/25 bg-[#F00016]/10 text-[#FF6B78] group-hover:border-[#F00016]/60'
                          : 'border-[#008CFF]/25 bg-[#008CFF]/10 text-[#6EC1FF] group-hover:border-[#008CFF]/60',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex items-center gap-1 text-[14.5px] font-semibold text-white">
                        {cat.name}
                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-70" aria-hidden />
                      </h3>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/45">
                        {cat.description}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
