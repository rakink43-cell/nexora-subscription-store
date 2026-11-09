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

function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CartLine[]) : []
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
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: Math.min(20, l.quantity + quantity) }
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
          quantity,
          availability: product.availability,
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
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId
          ? { ...l, quantity: Math.max(1, Math.min(20, Math.floor(quantity) || 1)) }
          : l,
      ),
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
