/* ---------------------------------------------------------------------------
   NEXORA — single entry point for data access, with explicit data-source
   state. Nothing here pretends to be connected when it is not.

   THREE STATES
   ─────────────
   1. `demo`      No Supabase credentials at all  → bundled demo catalogue,
                  everything stored in this browser. Labelled "Demo".
   2. `setup`     Credentials present but the schema is missing
                  (PostgREST PGRST205 / PGRST202) → migrations not applied yet.
                  Read-only catalogue falls back to the bundled demo data so the
                  storefront is explorable, but AUTH, ORDERS, PAYMENTS and ADMIN
                  operations HARD-FAIL with a clear instruction. We never write a
                  fake order to localStorage while the user believes it is real.
   3. `live`      Schema present → the real Supabase backend for everything.
--------------------------------------------------------------------------- */
import { isLive, supabase } from './supabase'
import { supabaseBackend } from '../services/supabaseBackend'
import { demoBackend } from '../services/demoBackend'

export type DataSource = 'demo' | 'setup' | 'live'

/** Schema state is resolved asynchronously by `initDataSource()`. */
type SchemaState = 'unknown' | 'ready' | 'missing'
let schemaState: SchemaState = 'unknown'

export const isDemoMode = !isLive()

/** Synchronous best guess; becomes accurate after `initDataSource()` resolves. */
export function getDataSource(): DataSource {
  if (!isLive()) return 'demo'
  return schemaState === 'ready' ? 'live' : 'setup'
}

export const SETUP_ERROR =
  'The NEXORA database is not initialised on this Supabase project yet. ' +
  'Apply supabase/migrations/0001–0009 in the Supabase SQL editor, then reload. ' +
  '(Authentication, orders and admin tools are disabled until then — no fake data is written.)'

class SetupRequiredError extends Error {
  constructor() {
    super(SETUP_ERROR)
    this.name = 'SetupRequiredError'
  }
}

/**
 * Probe the schema once at boot.
 * A single cheap query against `categories` is enough: PostgREST answers
 * PGRST205 when the table is absent, and a permission/RLS error still proves
 * the table exists.
 */
export async function initDataSource(): Promise<DataSource> {
  if (!isLive()) {
    schemaState = 'missing'
    return 'demo'
  }
  try {
    // NOTE: must be a real SELECT. With `head: true` PostgREST answers 204 and
    // supabase-js reports no error even when the table does not exist, which
    // would make the app wrongly believe the schema is ready.
    const { error, status } = await supabase!.from('categories').select('id').limit(1)

    if (error) {
      // PGRST205 = table not in schema cache; "relation does not exist" (42P01)
      const missing =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        status === 404 ||
        /does not exist|schema cache/i.test(error.message ?? '')
      // Any other error (e.g. RLS 42501) still proves the table exists.
      schemaState = missing ? 'missing' : 'ready'
    } else {
      schemaState = status === 200 || status === 206 ? 'ready' : 'missing'
    }
  } catch {
    schemaState = 'missing'
  }
  return schemaState === 'ready' ? 'live' : 'setup'
}

/**
 * Reads may safely fall back to demo data; writes may not.
 *
 * Three cases, and they must not be confused:
 *   • no credentials at all      → demo backend for everything (state `demo`)
 *   • credentials, no schema     → reads fall back, writes throw (state `setup`)
 *   • credentials + schema       → the real backend (state `live`)
 *
 * `schemaState` alone cannot express this: it is `'missing'` both when there are
 * no credentials and when migrations are pending, so `isLive()` must be checked
 * first. Getting this wrong made demo mode throw the setup error.
 */
function readBackend() {
  if (!isLive()) return demoBackend
  return schemaState === 'ready' ? supabaseBackend : demoBackend
}

function writeBackend() {
  if (!isLive()) return demoBackend // deliberate demo mode: local, labelled
  if (schemaState !== 'ready') throw new SetupRequiredError()
  return supabaseBackend
}

const demo = demoBackend

export const api = {
  /* ---- read-only storefront data: falls back so the UI stays explorable ---- */
  catalogue: {
    settings: () => readBackend().catalogue.settings(),
    categories: () => readBackend().catalogue.categories(),
    products: (q: Parameters<typeof demo.catalogue.products>[0]) =>
      readBackend().catalogue.products(q),
    productBySlug: (slug: string) => readBackend().catalogue.productBySlug(slug),
    related: (p: Parameters<typeof demo.catalogue.related>[0], limit?: number) =>
      readBackend().catalogue.related(p, limit),
    paymentMethods: () => readBackend().catalogue.paymentMethods(),
    faqs: () => readBackend().catalogue.faqs(),
    promotions: () => readBackend().catalogue.promotions(),
    reviews: () => readBackend().catalogue.reviews(),
  },

  /* ---- authentication: in setup mode use the demo accounts so the UI is
          testable, but say so loudly (see getDataSource()) ------------- */
  auth: new Proxy({} as typeof demo.auth, {
    get(_t, prop: string) {
      return (readBackend().auth as unknown as Record<string, unknown>)[prop]
    },
  }),

  /* ---- money paths: never fabricated while in setup mode ---- */
  orders: new Proxy({} as typeof demo.orders, {
    get(_t, prop: string) {
      if (prop === 'get' || prop === 'mine') {
        // read-only lookups may fall back (demo orders live in this browser)
        return (readBackend().orders as unknown as Record<string, unknown>)[prop]
      }
      const backend = writeBackend()
      return (backend.orders as unknown as Record<string, unknown>)[prop]
    },
  }),

  coupons: new Proxy({} as typeof demo.coupons, {
    get(_t, prop: string) {
      return (readBackend().coupons as unknown as Record<string, unknown>)[prop]
    },
  }),

  support: new Proxy({} as typeof demo.support, {
    get(_t, prop: string) {
      if (prop === 'mine') return (readBackend().support as unknown as Record<string, unknown>)[prop]
      return (writeBackend().support as unknown as Record<string, unknown>)[prop]
    },
  }),

  admin: new Proxy({} as typeof demo.admin, {
    get(_t, prop: string) {
      const backend = writeBackend()
      return (backend.admin as unknown as Record<string, unknown>)[prop]
    },
  }),
}

export const backendMode: 'supabase' | 'demo' = isLive() ? 'supabase' : 'demo'

export const backendLabel = isDemoMode
  ? 'Demo mode · local browser storage'
  : (schemaState as SchemaState) === 'ready'
    ? 'Live · Supabase PostgreSQL'
    : 'Supabase connected · migrations pending'

/** Fire-and-forget analytics; silently no-ops without a live schema. */
export async function trackEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  if (!supabase || schemaState !== 'ready') return
  try {
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      path: window.location.pathname,
      metadata,
    })
  } catch {
    /* analytics must never break the app */
  }
}
