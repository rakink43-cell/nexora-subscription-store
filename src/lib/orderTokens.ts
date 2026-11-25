/* ---------------------------------------------------------------------------
   Guest order tokens.
   These tokens authorize access to a single guest order. Keep them in this
   browser only, never in URLs, and validate persisted storage before use.
--------------------------------------------------------------------------- */
const KEY = 'nexora.orderTokens.v1'
const MAX_STORED_TOKENS = 100
const ORDER_NUMBER_PATTERN = /^NX-[0-9]{6}-[0-9]{5}$/i
const MAX_TOKEN_LENGTH = 512

type TokenMap = Record<string, string>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeOrderNumber(value: string): string | null {
  const normalized = value.trim().toUpperCase()
  return ORDER_NUMBER_PATTERN.test(normalized) ? normalized : null
}

function normalizeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const token = value.trim()
  if (token.length < 8 || token.length > MAX_TOKEN_LENGTH) return null
  return token
}

function read(): TokenMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return Object.create(null) as TokenMap
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return Object.create(null) as TokenMap

    const entries = Object.entries(parsed).flatMap(([orderNumber, value]) => {
      const normalizedOrder = normalizeOrderNumber(orderNumber)
      const token = normalizeToken(value)
      return normalizedOrder && token ? [[normalizedOrder, token] as const] : []
    })
    // Retain only the most recent bounded set; old browser storage should not
    // grow indefinitely or allow malformed entries to be queried.
    return Object.fromEntries(entries.slice(-MAX_STORED_TOKENS)) as TokenMap
  } catch {
    return Object.create(null) as TokenMap
  }
}

export function saveOrderToken(orderNumber: string, token: string) {
  try {
    const normalizedOrder = normalizeOrderNumber(orderNumber)
    const normalizedToken = normalizeToken(token)
    if (!normalizedOrder || !normalizedToken) return
    const map = read()
    delete map[normalizedOrder]
    map[normalizedOrder] = normalizedToken
    const entries = Object.entries(map)
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_STORED_TOKENS))))
  } catch {
    /* ignore storage failures */
  }
}

export function getOrderToken(orderNumber: string): string | null {
  const normalizedOrder = normalizeOrderNumber(orderNumber)
  if (!normalizedOrder) return null
  return read()[normalizedOrder] ?? null
}

export function forgetOrderToken(orderNumber: string) {
  try {
    const normalizedOrder = normalizeOrderNumber(orderNumber)
    if (!normalizedOrder) return
    const map = read()
    delete map[normalizedOrder]
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function listOrderNumbers(): string[] {
  return Object.keys(read())
}
