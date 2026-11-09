import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Zap,
} from 'lucide-react'
import { api } from '../lib/api'
import { useCart } from '../context/CartContext'
import { useStore } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { ProductMedia } from '../components/product/ProductMedia'
import { ProductCard } from '../components/product/ProductCard'
import {
  Badge,
  Button,
  EmptyState,
  Rating,
  Skeleton,
} from '../components/ui'
import { AVAILABILITY_META, cn, discountPercent, formatBDT } from '../lib/utils'
import type { Product } from '../types'

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { add } = useCart()
  const toast = useToast()
  const { categoryName } = useStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    setError(null)
    setQuantity(1)
    api.catalogue
      .productBySlug(slug)
      .then(async (p) => {
        if (!active) return
        if (!p) {
          setError('This product could not be found. It may have been removed.')
          return
        }
        setProduct(p)
        const rel = await api.catalogue.related(p, 4)
        if (active) setRelated(rel)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load this product.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  if (loading) return <ProductSkeleton />

  if (error || !product) {
    return (
      <div className="nx-container py-16">
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Product not available"
          description={error ?? 'This subscription is no longer in the catalogue.'}
          action={<Button onClick={() => navigate('/products')}>Browse all products</Button>}
        />
      </div>
    )
  }

  const off = discountPercent(Number(product.original_price), Number(product.discounted_price))
  const soldOut = product.availability === 'out_of_stock'
  const availability = AVAILABILITY_META[product.availability]
  const total = Number(product.discounted_price) * quantity
  const savings = (Number(product.original_price) - Number(product.discounted_price)) * quantity

  const addToCart = () => {
    add(product, quantity)
    toast.success('Added to cart', `${product.name} · ${quantity} × ${formatBDT(product.discounted_price)}`)
  }

  const buyNow = () => {
    add(product, quantity)
    navigate('/checkout')
  }

  return (
    <div className="nx-container py-8">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-[12px] text-white/40">
        <Link to="/" className="transition hover:text-white">Home</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link to="/products" className="transition hover:text-white">Products</Link>
        {product.category_id && (
          <>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <span className="text-white/60">{categoryName(product.category_id)}</span>
          </>
        )}
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="truncate text-white/70">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-10">
        {/* media column */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.04] to-transparent p-3">
            <ProductMedia
              name={product.name}
              brand={product.brand}
              imageUrl={product.image_url}
              size="lg"
              className="aspect-[16/10] w-full"
              rounded="rounded-xl"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <TrustTile icon={Zap} label="Fast delivery" value={product.delivery_time ?? 'Instant'} />
            <TrustTile icon={ShieldCheck} label="Warranty" value="30 days" />
            <TrustTile icon={RefreshCw} label="Replacement" value="24 hours" />
            <TrustTile icon={PackageCheck} label="Delivery" value="Email + dashboard" />
          </div>

          {/* description */}
          <div className="mt-7">
            <h2 className="font-display text-lg font-bold text-white">About this subscription</h2>
            <div className="mt-2.5 space-y-3 text-[13.5px] leading-relaxed text-white/55">
              {(product.description ?? product.short_description ?? '')
                .split('\n')
                .filter((p) => p.trim())
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
              <Clock className="h-4 w-4 text-[#6EC1FF]" aria-hidden />
              Delivery information
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/50">
              {product.delivery_info ?? 'Instant delivery after payment verification.'}
            </p>
            <p className="mt-2 text-[12.5px] text-white/40">
              Typical delivery window: <b className="text-white/70">{product.delivery_time}</b>
            </p>
          </div>
        </div>

        {/* purchase column */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="nx-card p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#6EC1FF]">
                {product.brand ?? 'Premium'}
              </span>
              <Badge className={availability.className} dot={availability.dot}>
                {availability.label}
              </Badge>
            </div>

            <h1 className="mt-2 font-display text-[22px] font-bold leading-tight text-white sm:text-2xl">
              {product.name}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <Rating value={product.rating} count={product.rating_count} />
              <span className="text-[11.5px] text-white/35">
                {product.sales_count.toLocaleString()} sold
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/60">
                <Clock className="h-2.5 w-2.5" aria-hidden />
                {product.duration}
              </span>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-white/50">{product.short_description}</p>

            <div className="mt-4 rounded-xl border border-white/8 bg-gradient-to-br from-[#008CFF]/[0.07] to-transparent p-4">
              <div className="flex flex-wrap items-end gap-2">
                <span className="font-display text-3xl font-extrabold text-white">
                  {formatBDT(product.discounted_price)}
                </span>
                {off > 0 && (
                  <>
                    <span className="pb-1 text-sm text-white/35 line-through">
                      {formatBDT(product.original_price)}
                    </span>
                    <span className="mb-1.5 rounded-md bg-[#F00016] px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                      {off}% OFF
                    </span>
                  </>
                )}
              </div>
              {off > 0 && (
                <p className="mt-1 text-[12px] text-emerald-400">
                  You save {formatBDT(Number(product.original_price) - Number(product.discounted_price))} on this plan
                </p>
              )}
            </div>

            {/* quantity */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-white/60">Quantity</span>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="grid h-7 w-7 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-[13px] font-semibold text-white">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                  disabled={quantity >= 20}
                  aria-label="Increase quantity"
                  className="grid h-7 w-7 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {quantity > 1 && (
              <p className="mt-2 text-right text-[12.5px] text-white/50">
                Total: <b className="text-white">{formatBDT(total)}</b>
                {savings > 0 && <span className="ml-1 text-emerald-400">· save {formatBDT(savings)}</span>}
              </p>
            )}

            <div className="mt-4 grid gap-2">
              <Button
                size="lg"
                onClick={buyNow}
                disabled={soldOut}
                icon={<Zap className="h-4 w-4" />}
                className="w-full"
              >
                {soldOut ? 'Currently unavailable' : 'Buy Now'}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={addToCart}
                disabled={soldOut}
                icon={<ShoppingCart className="h-4 w-4" />}
                className="w-full"
              >
                Add to Cart
              </Button>
            </div>

            <ul className="mt-4 space-y-2 border-t border-white/8 pt-4">
              {[
                'Manual payment verification (bKash, Nagad, bank)',
                'Delivered to your email and dashboard',
                '30-day replacement warranty included',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-[12px] text-white/50">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-lg font-bold text-white">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TrustTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
      <Icon className="h-3.5 w-3.5 text-[#6EC1FF]" aria-hidden />
      <p className="mt-1.5 truncate text-[10px] uppercase tracking-wide text-white/35">{label}</p>
      <p className="truncate text-[11.5px] font-medium text-white/80">{value}</p>
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="nx-container py-8">
      <Skeleton className="mb-5 h-4 w-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-10">
        <div>
          <Skeleton className={cn('aspect-[16/10] w-full rounded-2xl')} />
          <div className="mt-4 grid grid-cols-4 gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="mt-7 h-5 w-48" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
        <div className="nx-card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-7 w-4/5" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-4 h-20 w-full rounded-xl" />
          <Skeleton className="mt-4 h-11 w-full rounded-xl" />
          <Skeleton className="mt-2 h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
