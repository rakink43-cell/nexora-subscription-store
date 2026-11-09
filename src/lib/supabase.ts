import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * `VITE_DEMO_MODE=true` forces the local demo backend even when real
 * credentials are present. Used by the e2e suite so the full UI flow
 * (sign-up, login, cart, checkout, admin) can be exercised without a
 * database, and by anyone who wants to browse the storefront offline.
 */
const forcedDemo = import.meta.env.VITE_DEMO_MODE === 'true'

const hasCreds =
  !forcedDemo &&
  Boolean(url && anonKey) &&
  !url!.includes('YOUR-PROJECT-REF') &&
  !url!.includes('your-') &&
  Boolean(anonKey && anonKey.length > 20)

/**
 * `null` when no valid Supabase credentials are configured.
 * The app then transparently switches to the local demo backend so every
 * screen and flow stays testable. `isLive()` tells UI which mode is active.
 */
export const supabase: SupabaseClient | null = hasCreds
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'nexora.auth',
      },
      global: {
        headers: { 'x-application-name': 'nexora-storefront' },
      },
    })
  : null

export const isLive = () => supabase !== null

export const SUPABASE_URL = url ?? ''
export const ANON_KEY = anonKey ?? ''
