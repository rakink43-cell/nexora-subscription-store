import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronRight,
  Filter,
  PackageSearch,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { ProductCard } from '../components/product/ProductCard'
import {
  Button,
  EmptyState,
  ErrorNote,
  Pagination,
  ProductCardSkeleton,
  Select,
} from '../components/ui'
import { useProducts } from '../hooks/useProducts'
import { useStore } from '../context/SettingsContext'
import { cn } from '../lib/utils'
import type { Availability, ProductQuery } from '../types'

const SORTS = [
  { value: 'featured', label: 'Recommended' },
  { value: 'popular', label: 'Best selling' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'newest', label: 'Newest first' },
]

const PER_PAGE = 12

export default function ProductsPage() {
  const { slug } = useParams<{ slug?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { categories, categoryBySlug } = useStore()

  const category = slug ? categoryBySlug(slug) : undefined
  const search = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') ?? 'featured') as ProductQuery['sort']
  const availability = (searchParams.get('availability') ?? 'all') as Availability | 'all'
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))

  const [searchInput, setSearchInput] = useState(search)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => setSearchInput(search), [search])

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      if (!('page' in patch)) next.delete('page')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const query = useMemo(
    () => ({
      search,
      categorySlug: slug,
      sort,
      availability,
      page,
      perPage: PER_PAGE,
    }),
    [search, slug, sort, availability, page],
  )

  const { rows, total, loading, error } = useProducts(query)
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const title = category?.name ?? (search ? `Results for “${search}”` : 'All Products')
  const subtitle =
    category?.description ??
    'Every premium subscription in the NEXORA catalogue — filtered, sorted and priced in BDT.'

  const activeFilters = [
    search && { key: 'q', label: `“${search}”` },
    availability !== 'all' && { key: 'availability', label: availability.replace('_', ' ') },
  ].filter(Boolean) as { key: string; label: string }[]

  return (
    <div className="nx-container py-8 sm:py-10">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-[12px] text-white/40">
        <Link to="/" className="transition hover:text-white">Home</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        {slug ? (
          <>
            <Link to="/products" className="transition hover:text-white">Products</Link>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-white/70">{category?.name ?? slug}</span>
          </>
        ) : (
          <span className="text-white/70">All Products</span>
        )}
      </nav>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/45">{subtitle}</p>
        </div>
        <p className="shrink-0 text-[12.5px] text-white/40">
          {loading ? 'Loading…' : <><b className="text-white/70">{total}</b> product{total === 1 ? '' : 's'}</>}
        </p>
      </div>

      {/* category chips */}
      <div className="nx-scroll-x mb-5">
        <Link
          to="/products"
          className={cn(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition',
            !slug
              ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
              : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white',
          )}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/category/${c.slug}`}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition',
              slug === c.slug
                ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white',
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            updateParams({ q: searchInput.trim() || null })
          }}
          className="relative min-w-0 flex-1 sm:max-w-sm"
          role="search"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search subscriptions…"
            aria-label="Search products"
            className="nx-input pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                updateParams({ q: null })
              }}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/35 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" aria-hidden />
          <Select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            aria-label="Sort products"
            className="min-w-[172px] pl-9 text-[13px]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-[#0B111D]">
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFiltersOpen((v) => !v)}
          icon={<Filter className="h-3.5 w-3.5" />}
          aria-expanded={filtersOpen}
          className="py-2.5"
        >
          Filters
          {activeFilters.length > 0 && (
            <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#008CFF] px-1 text-[10px] font-bold text-white">
              {activeFilters.length}
            </span>
          )}
        </Button>
      </div>

      {filtersOpen && (
        <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="nx-label">Availability</p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'in_stock', 'limited', 'out_of_stock'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => updateParams({ availability: a === 'all' ? null : a })}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-[12px] font-medium capitalize transition',
                      availability === a
                        ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
                        : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white',
                    )}
                  >
                    {a.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="nx-label">Quick category</p>
              <div className="flex flex-wrap gap-1.5">
                {categories.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    to={`/category/${c.slug}`}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-[#008CFF]/40 hover:text-white"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
              className="mt-3 text-[12px] font-medium text-rose-300 transition hover:text-rose-200"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}

      {error && <ErrorNote message={error} className="mb-5" />}

      {/* grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title="No subscriptions matched your filters"
          description={
            search
              ? `We couldn't find anything for “${search}”. Try a brand name like Netflix, ChatGPT or Canva.`
              : 'Try removing a filter or browsing another category.'
          }
          action={
            <Button variant="outline" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {rows.map((p, i) => (
              <div key={p.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className="nx-page-enter">
                <ProductCard product={p} />
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={(p) => {
              updateParams({ page: String(p) })
              window.scrollTo({ top: 220, behavior: 'smooth' })
            }}
            className="mt-9"
          />
        </>
      )}
    </div>
  )
}
