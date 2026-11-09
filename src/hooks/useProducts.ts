import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Paged, Product, ProductQuery } from '../types'

/**
 * Catalogue query hook with debounce-free explicit refetching, abort-safe
 * state updates and a loading skeleton flag.
 */
export function useProducts(query: ProductQuery) {
  const [data, setData] = useState<Paged<Product>>({ rows: [], total: 0, page: 1, perPage: 12 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const key = useMemo(() => JSON.stringify(query), [query])

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const result = await api.catalogue.products(query)
      if (requestId.current === id) setData(result)
    } catch (err) {
      if (requestId.current === id) {
        setError(err instanceof Error ? err.message : 'Could not load products.')
      }
    } finally {
      if (requestId.current === id) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  return { ...data, loading, error, refetch: load }
}

/** Small helper for "featured / best selling / trending" rails. */
export function useProductRail(params: ProductQuery) {
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const key = useMemo(() => JSON.stringify(params), [params])

  useEffect(() => {
    let active = true
    setLoading(true)
    api.catalogue
      .products(params)
      .then((r) => {
        if (active) setRows(r.rows)
      })
      .catch(() => {
        if (active) setRows([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { rows, loading }
}
