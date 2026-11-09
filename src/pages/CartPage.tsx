import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import { ProductMedia } from '../components/product/ProductMedia'
import { Button, ButtonLink, EmptyState } from '../components/ui'
import { cn, formatBDT } from '../lib/utils'

export default function CartPage() {
  const { lines, subtotal, originalTotal, remove, setQuantity, clear, count } = useCart()
  const navigate = useNavigate()

  if (lines.length === 0) {
    return (
      <div className="nx-container py-16">
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title="Your cart is empty"
          description="Add a subscription and it will show up here. Most orders are delivered within 30 minutes."
          action={<ButtonLink to="/products">Browse subscriptions</ButtonLink>}
        />
      </div>
    )
  }

  const savings = originalTotal - subtotal

  return (
    <div className="nx-container py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Shopping Cart</h1>
          <p className="mt-1 text-[13px] text-white/45">
            {count} item{count === 1 ? '' : 's'} in your cart
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-[12.5px] font-medium text-rose-300 transition hover:text-rose-200"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2.5">
          {lines.map((line) => (
            <div key={line.productId} className="nx-card flex gap-3 p-3">
              <Link to={`/product/${line.slug}`} className="shrink-0">
                <ProductMedia
                  name={line.name}
                  brand={line.brand}
                  imageUrl={line.image_url}
                  size="sm"
                  className="h-20 w-24 sm:h-24 sm:w-32"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6EC1FF]">
                      {line.brand}
                    </p>
                    <Link
                      to={`/product/${line.slug}`}
                      className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white transition hover:text-[#8FD0FF]"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-[11.5px] text-white/40">{line.duration}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.productId)}
                    aria-label={`Remove ${line.name} from cart`}
                    className="shrink-0 rounded p-1.5 text-white/30 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      aria-label="Decrease quantity"
                      className="grid h-6 w-6 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center text-[12.5px] font-semibold text-white">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.productId, line.quantity + 1)}
                      disabled={line.quantity >= 20}
                      aria-label="Increase quantity"
                      className="grid h-6 w-6 place-items-center rounded text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-[15px] font-bold text-white">
                      {formatBDT(line.unitPrice * line.quantity)}
                    </p>
                    {line.originalPrice > line.unitPrice && (
                      <p className="text-[11px] text-white/30 line-through">
                        {formatBDT(line.originalPrice * line.quantity)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 pt-1 text-[12.5px] font-semibold text-[#6EC1FF] transition hover:text-white"
          >
            ← Continue shopping
          </Link>
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="nx-card p-5">
            <h2 className="font-display text-base font-bold text-white">Order summary</h2>

            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-white/50">Subtotal ({count} items)</dt>
                <dd className="font-medium text-white">{formatBDT(subtotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <dt>You save</dt>
                  <dd className="font-medium">− {formatBDT(savings)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-white/50">Delivery</dt>
                <dd className="font-medium text-emerald-400">Free</dd>
              </div>
              <div className="nx-divider my-1" />
              <div className="flex items-baseline justify-between">
                <dt className="text-[13px] font-semibold text-white">Total</dt>
                <dd className="font-display text-xl font-extrabold text-white">{formatBDT(subtotal)}</dd>
              </div>
            </dl>

            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={() => navigate('/checkout')}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Proceed to Checkout
            </Button>

            <p className="mt-2.5 text-center text-[11px] text-white/35">
              Coupon codes are applied at checkout
            </p>

            <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
              <p className="flex items-center gap-2 text-[11.5px] text-white/45">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                Manual payment verification on every order
              </p>
              <p className="flex items-center gap-2 text-[11.5px] text-white/45">
                <Truck className="h-3.5 w-3.5 text-[#6EC1FF]" aria-hidden />
                Delivered by email &amp; dashboard
              </p>
            </div>
          </div>

          <div className={cn('mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3.5')}>
            <p className="text-[11px] leading-relaxed text-white/40">
              <b className="text-white/60">No card needed.</b> Pay with bKash, Nagad or bank transfer,
              then submit your transaction ID — our team verifies it and delivers.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
