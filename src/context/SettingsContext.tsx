import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { demoSettings } from '../data/demoSeed'
import type {
  Category,
  Faq,
  PaymentMethodConfig,
  Promotion,
  Review,
  SiteSettings,
} from '../types'

interface StoreState {
  settings: SiteSettings
  categories: Category[]
  faqs: Faq[]
  promotions: Promotion[]
  reviews: Review[]
  paymentMethods: PaymentMethodConfig[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  categoryBySlug: (slug: string) => Category | undefined
  categoryName: (id: string | null) => string
}

const SettingsContext = createContext<StoreState | undefined>(undefined)

/** Merge DB rows over seed defaults so a partially-filled DB never breaks the UI. */
function mergeSettings(partial: Partial<SiteSettings>): SiteSettings {
  const out = { ...demoSettings } as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(partial ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = { ...(out[key] as object), ...value }
    } else if (value !== undefined && value !== null) {
      out[key] = value
    }
  }
  return out as unknown as SiteSettings
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(demoSettings as SiteSettings)
  const [categories, setCategories] = useState<Category[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, c, f, p, r, pm] = await Promise.all([
        api.catalogue.settings(),
        api.catalogue.categories(),
        api.catalogue.faqs(),
        api.catalogue.promotions(),
        api.catalogue.reviews(),
        api.catalogue.paymentMethods(),
      ])
      setSettings(mergeSettings(s ?? {}))
      setCategories(c ?? [])
      setFaqs(f ?? [])
      setPromotions(p ?? [])
      setReviews(r ?? [])
      setPaymentMethods(pm ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load store data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // keep the document title/description in sync with admin-managed SEO settings
  useEffect(() => {
    if (settings.seo?.title) document.title = settings.seo.title
    const meta = document.querySelector('meta[name="description"]')
    if (meta && settings.seo?.description) meta.setAttribute('content', settings.seo.description)
  }, [settings.seo])

  const value = useMemo<StoreState>(
    () => ({
      settings,
      categories,
      faqs,
      promotions,
      reviews,
      paymentMethods,
      loading,
      error,
      reload,
      categoryBySlug: (slug: string) => categories.find((c) => c.slug === slug),
      categoryName: (id: string | null) => categories.find((c) => c.id === id)?.name ?? 'Subscription',
    }),
    [settings, categories, faqs, promotions, reviews, paymentMethods, loading, error, reload],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useStore() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useStore must be used inside <SettingsProvider>')
  return ctx
}
