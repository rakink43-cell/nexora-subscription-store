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

  // Keep search and social-share metadata in sync with admin-managed SEO settings.
  useEffect(() => {
    const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content?: string) => {
      if (!content) return
      let element = document.head.querySelector<HTMLMetaElement>(selector)
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute(attribute, key)
        document.head.appendChild(element)
      }
      element.content = content
    }
    if (settings.seo?.title) document.title = settings.seo.title
    setMeta('meta[name="description"]', 'name', 'description', settings.seo?.description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', settings.seo?.og_title || settings.seo?.title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', settings.seo?.og_description || settings.seo?.description)
    setMeta('meta[property="og:image"]', 'property', 'og:image', settings.seo?.og_image)
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', settings.seo?.og_title || settings.seo?.title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', settings.seo?.og_description || settings.seo?.description)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', settings.seo?.og_image)
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
