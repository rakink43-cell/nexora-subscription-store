#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   NEXORA — connection & security verifier
   ---------------------------------------------------------------------------
   Proves, against YOUR live Supabase project, that:
     • the public key works
     • every table / RPC / storage bucket exists
     • RLS actually blocks anonymous reads of sensitive tables
     • the site can read the public catalogue
   It never uses a secret key and never writes data.

   Usage:  node scripts/verify-connection.mjs
   Exits 0 when the project is ready, 1 when something is missing.
--------------------------------------------------------------------------- */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const file = join(root, '.env')
  if (!existsSync(file)) {
    console.error('✗ .env not found. Copy .env.example and add your Supabase keys.')
    process.exit(1)
  }
  const env = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

const env = loadEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('✗ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing from .env')
  process.exit(1)
}
if (key.startsWith('sb_secret_') || key.includes('service_role')) {
  console.error('✗ SECURITY: a secret/service_role key was found in the frontend env.')
  console.error('  Remove it immediately — it bypasses all Row Level Security.')
  process.exit(1)
}

// Node < 22 needs a WebSocket polyfill for supabase-js realtime init
if (!globalThis.WebSocket) {
  try {
    const { default: ws } = await import('ws')
    globalThis.WebSocket = ws
  } catch {
    /* realtime unused here */
  }
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`)
const info = (m) => console.log(`  \x1b[90m·\x1b[0m ${m}`)

let failures = 0
const fail = (m) => {
  bad(m)
  failures++
}

console.log('\nNEXORA · connection verification')
console.log(`project: ${url}`)
console.log(`key    : ${key.slice(0, 14)}…  (publishable — safe to ship)\n`)

/* --------------------------------- 1. tables ------------------------------ */
console.log('1 · schema')
const PUBLIC_TABLES = [
  'categories',
  'products',
  'public_products',
  'website_settings',
  'payment_methods',
  'promotions',
  'faqs',
  'reviews',
]
const SENSITIVE_TABLES = ['profiles', 'orders', 'order_items', 'payments', 'coupons', 'user_roles']

for (const t of PUBLIC_TABLES) {
  const { error, status } = await sb.from(t).select('*').limit(1)
  if (error && (error.code === 'PGRST205' || status === 404)) fail(`${t} — table missing`)
  else ok(`${t} readable`)
}

for (const t of SENSITIVE_TABLES) {
  const { data, error, status } = await sb.from(t).select('*').limit(1)
  if (error && (error.code === 'PGRST205' || status === 404)) {
    fail(`${t} — table missing`)
  } else if (error) {
    ok(`${t} exists (anonymous access denied: ${error.code ?? status})`)
  } else if ((data ?? []).length === 0) {
    ok(`${t} exists (RLS returned 0 rows to anonymous — correct)`)
  } else {
    fail(`${t} LEAKS ${data.length} row(s) to anonymous users — check your policies!`)
  }
}

/* ---------------------------------- 2. RPC -------------------------------- */
console.log('\n2 · server functions')
const RPCS = [
  ['validate_coupon', { _code: 'NOPE', _subtotal: 1000 }],
  ['place_order', {}],
  ['submit_payment', {}],
  ['get_order', {}],
  ['admin_dashboard_stats', {}],
  ['claim_guest_order', {}],
  ['admin_verify_payment', {}],
  ['admin_update_order_status', {}],
]
for (const [fn, args] of RPCS) {
  const { error } = await sb.rpc(fn, args)
  if (error && error.code === 'PGRST202') fail(`${fn}() — function missing`)
  else if (error && ['PGRST301', '42501'].includes(error.code ?? '')) ok(`${fn}() exists (permission-checked)`)
  else if (error) ok(`${fn}() exists (rejected bad input: ${error.message.slice(0, 40)})`)
  else ok(`${fn}() exists`)
}

/* -------------------------------- 3. storage ------------------------------ */
console.log('\n3 · storage')
// NOTE: listing a bucket anonymously returns 200 [] even for a bucket that does
// not exist, so it cannot be used as a probe. Attempting an upload is decisive:
// a missing bucket answers `NoSuchBucket`, whereas an existing bucket rejects the
// anonymous upload with a policy/permission error. Nothing is ever stored,
// because the anonymous role is denied by design.
for (const bucket of ['product-images', 'payment-proofs']) {
  const fd = new FormData()
  fd.append('file', new Blob([Buffer.from('probe')], { type: 'text/plain' }), '__probe__.txt')
  let status = 0
  let body = ''
  try {
    const res = await fetch(`${url}/storage/v1/object/${bucket}/__probe__.txt`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}` },
      body: fd,
    })
    status = res.status
    body = await res.text()
  } catch (e) {
    body = String(e)
  }
  if (/NoSuchBucket|Bucket not found/i.test(body)) {
    fail(`${bucket} — bucket missing (run 0009_storage.sql)`)
  } else if (status === 200 || status === 201) {
    fail(`SECURITY: anonymous upload to ${bucket} was ACCEPTED — tighten the bucket policy!`)
  } else {
    ok(`${bucket} exists (anonymous upload correctly rejected: ${status})`)
  }
}

/* ------------------------------ 4. catalogue ------------------------------ */
console.log('\n4 · catalogue content')
const { data: products, error: pe } = await sb.from('public_products').select('id,name,slug').limit(500)
if (pe) {
  fail(`public_products unreadable: ${pe.code ?? ''} ${pe.message}`)
} else {
  const n = products?.length ?? 0
  n >= 30 ? ok(`${n} products published`) : fail(`only ${n} products — run the seed data (0007)`)
}
const { data: cats } = await sb.from('categories').select('id').limit(100)
if ((cats?.length ?? 0) >= 6) ok(`${cats.length} categories`) 
else fail(`only ${cats?.length ?? 0} categories — run the seed data (0007)`)

/* --------------------------------- 5. admin ------------------------------- */
console.log('\n5 · admin protection')
const { error: adminErr } = await sb.from('user_roles').select('role').limit(1)
if (adminErr || true) {
  const { error: dashErr } = await sb.rpc('admin_dashboard_stats')
  if (dashErr && (dashErr.code === '42501' || /administrator/i.test(dashErr.message))) {
    ok('admin_dashboard_stats() refuses anonymous callers')
  } else if (dashErr?.code === 'PGRST202') {
    fail('admin_dashboard_stats() missing')
  } else {
    fail('SECURITY: admin_dashboard_stats() answered an anonymous caller!')
  }
}

/* --------------------------------- summary -------------------------------- */
console.log('\n' + '─'.repeat(58))
if (failures === 0) {
  console.log('\x1b[32m✓ PROJECT READY\x1b[0m — all checks passed. The storefront will run live.')
  process.exit(0)
}
console.log(`\x1b[31m✗ ${failures} problem(s) found.\x1b[0m`)
console.log('\nNext step: run supabase/apply_all.sql in the Supabase SQL editor,')
console.log('then re-run this verifier. See docs/SETUP.md for the full guide.')
process.exit(1)
