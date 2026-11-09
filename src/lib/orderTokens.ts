/* ---------------------------------------------------------------------------
   Guest order tokens.
   When someone checks out without an account we receive a private access token
   that authorises that specific order (see the `get_order` / `submit_payment`
   RPCs). We keep it in this browser only — never in the URL — so a guest can
   return later to submit payment or track delivery.
   Signed-in customers do not need it (RLS scopes orders by user_id).
--------------------------------------------------------------------------- */
const KEY = 'nexora.orderTokens.v1'

type TokenMap = Record<string, string>

function read(): TokenMap {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TokenMap) : {}
  } catch {
    return {}
  }
}

export function saveOrderToken(orderNumber: string, token: string) {
  try {
    const map = read()
    map[orderNumber.toUpperCase()] = token
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function getOrderToken(orderNumber: string): string | null {
  return read()[orderNumber.toUpperCase()] ?? null
}

export function forgetOrderToken(orderNumber: string) {
  try {
    const map = read()
    delete map[orderNumber.toUpperCase()]
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function listOrderNumbers(): string[] {
  return Object.keys(read())
}
