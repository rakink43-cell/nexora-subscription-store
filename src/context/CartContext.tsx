import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CartLine, Product } from '../types'

const STORAGE_KEY = 'nexora.cart.v1'
const MAX_CART_QUANTITY = 20

interface CartState {
  lines: CartLine[]
  count: number
  subtotal: number
  originalTotal: number
  add: (product: Product, quantity?: number) => void
  remove: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
  has: (productId: string) => boolean
  lastAdded: string | null
}

const CartContext = createContext<CartState | undefined>(undefined)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finitePrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

function normalizeCartLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null
  const productId = typeof value.productId === 'string' ? value.productId.trim() : ''
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const unitPrice = finitePrice(value.unitPrice)
  const originalPrice = finitePrice(value.originalPrice)
  if (!productId || !name || unitPrice === null || originalPrice === null) return null

  const quantityValue = typeof value.quantity === 'number' && Number.isFinite(value.quantity)
    ? Math.floor(value.quantity)
    : 1
  const quantity = Math.max(1, Math.min(MAX_CART_QUANTITY, quantityValue || 1))
  const availability = value.availability === 'limited' || value.availability === 'out_of_stock'
    ? value.availability
    : 'in_stock'

  return {
    productId,
    slug: typeof value.slug === 'string' ? value.slug : '',
    name,
    image_url: typeof value.image_url === 'string' ? value.image_url : null,
    brand: typeof value.brand === 'string' ? value.brand : null,
    duration: typeof value.duration === 'string' ? value.duration : '',
    unitPrice,
    originalPrice,
    quantity,
    availability,
    newUserOfferEnabled: value.newUserOfferEnabled === true,
  }
}

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Merge duplicate product IDs from stale or manually edited browser storage.
    // Keep the first validated snapshot and cap the combined quantity.
    const byProduct = new Map<string, CartLine>()
    for (const candidate of parsed) {
      const line = normalizeCartLine(candidate)
      if (!line) continue
      const existing = byProduct.get(line.productId)
      if (existing) {
        existing.quantity = Math.min(MAX_CART_QUANTITY, existing.quantity + line.quantity)
      } else {
        byProduct.set(line.productId, line)
      }
    }
    return [...byProduct.values()]
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readCart)
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      /* ignore quota errors */
    }
  }, [lines])

  // keep the cart consistent across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(readCart())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((product: Product, quantity = 1) => {
    const safeQuantity = Math.max(1, Math.min(MAX_CART_QUANTITY, Math.floor(quantity) || 1))
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: Math.min(MAX_CART_QUANTITY, l.quantity + safeQuantity) }
            : l,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image_url: product.image_url,
          brand: product.brand,
          duration: product.duration,
          unitPrice: Number(product.discounted_price),
          originalPrice: Number(product.original_price),
          quantity: safeQuantity,
          availability: product.availability,
          newUserOfferEnabled: Boolean(product.new_user_offer_enabled),
        },
      ]
    })
    setLastAdded(product.id)
    window.setTimeout(() => setLastAdded(null), 2200)
  }, [])

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const safeQuantity = Math.max(1, Math.min(MAX_CART_QUANTITY, Math.floor(quantity) || 1))
    setLines((prev) =>
      prev.map((l) => l.productId === productId ? { ...l, quantity: safeQuantity } : l),
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartState>(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
    const originalTotal = lines.reduce((sum, l) => sum + l.originalPrice * l.quantity, 0)
    return {
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal,
      originalTotal,
      add,
      remove,
      setQuantity,
      clear,
      has: (productId: string) => lines.some((l) => l.productId === productId),
      lastAdded,
    }
  }, [lines, add, remove, setQuantity, clear, lastAdded])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
