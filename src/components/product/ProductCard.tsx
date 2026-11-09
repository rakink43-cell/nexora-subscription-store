import { Link } from 'react-router-dom'
import { Check, Clock, Plus, ShoppingCart, Zap } from 'lucide-react'
import type { Product } from '../../types'
import { AVAILABILITY_META, cn, discountPercent, formatBDT } from '../../lib/utils'
import { ProductMedia } from './ProductMedia'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { Badge, Rating } from '../ui'

export function ProductCard({
  product,
  compact = false,
  className,
}: {
  product: Product
  compact?: boolean
  className?: string
}) {
  const { add, has } = useCart()
  const toast = useToast()
  const off = discountPercent(Number(product.original_price), Number(product.discounted_price))
  const availability = AVAILABILITY_META[product.availability]
  const inCart = has(product.id)
  const soldOut = product.availability === 'out_of_stock'

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (soldOut) return
    add(product)
    toast.success('Added to cart', product.name)
  }

  return (
    <article
      className={cn('nx-card nx-card-hover group relative flex flex-col overflow-hidden', className)}
    >
      <Link to={`/product/${product.slug}`} className="block p-3 pb-0" aria-label={product.name}>
        <div className="relative overflow-hidden rounded-lg">
          <ProductMedia
            name={product.name}
            brand={product.brand}
            imageUrl={product.image_url}
            className={cn('w-full transition duration-500 group-hover:scale-[1.03]', compact ? 'aspect-[16/9]' : 'aspect-[16/10]')}
          />
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {off > 0 && (
              <span className="rounded-md bg-[#F00016] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                {off}% OFF
              </span>
            )}
            {product.badge && (
              <span className="rounded-md border border-white/15 bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                {product.badge}
              </span>
            )}
          </div>
          <div className="absolute bottom-2 right-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur">
              <Clock className="h-2.5 w-2.5" aria-hidden />
              {product.duration}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.13em] text-[#6EC1FF]">
            {product.brand ?? 'Premium'}
          </span>
          <Badge className={cn(availability.className, 'shrink-0')} dot={availability.dot}>
            {availability.label}
          </Badge>
        </div>

        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-white transition group-hover:text-[#8FD0FF]">
            {product.name}
          </h3>
        </Link>

        {!compact && product.short_description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/45">
            {product.short_description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <Rating value={product.rating} count={product.rating_count} />
          <span className="ml-auto hidden items-center gap-1 text-[10.5px] text-white/35 sm:flex">
            <Zap className="h-2.5 w-2.5 text-amber-400" aria-hidden />
            {product.sales_count.toLocaleString()} sold
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-lg font-bold text-white">
                {formatBDT(product.discounted_price)}
              </span>
              {off > 0 && (
                <span className="text-[11px] text-white/35 line-through">
                  {formatBDT(product.original_price)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[10.5px] text-emerald-400/80">
              {product.delivery_time ?? 'Instant delivery'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            aria-label={inCart ? `${product.name} is in your cart` : `Add ${product.name} to cart`}
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition',
              soldOut
                ? 'cursor-not-allowed border-white/8 bg-white/5 text-white/25'
                : inCart
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-[#008CFF]/40 bg-[#008CFF]/12 text-[#6EC1FF] hover:bg-[#008CFF] hover:text-white',
            )}
          >
            {inCart ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : soldOut ? (
              <ShoppingCart className="h-4 w-4" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
