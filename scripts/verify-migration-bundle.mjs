import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = resolve(root, 'supabase/migrations')
const bundlePath = resolve(root, 'supabase/apply_all.sql')
const bundle = readFileSync(bundlePath, 'utf8')
const migrations = readdirSync(migrationDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

if (migrations.length === 0) {
  throw new Error('No SQL migrations found.')
}

let cursor = 0
for (const name of migrations) {
  const marker = `-- >>> ${name}`
  const markerIndex = bundle.indexOf(marker, cursor)
  if (markerIndex < 0) {
    throw new Error(`Migration ${name} is missing or out of order in apply_all.sql.`)
  }

  const sql = readFileSync(resolve(migrationDir, name), 'utf8')
  const contentIndex = bundle.indexOf(sql, markerIndex + marker.length)
  if (contentIndex < 0) {
    throw new Error(`Migration contents differ from apply_all.sql: ${name}`)
  }
  cursor = contentIndex + sql.length
}

console.log(`✓ Migration bundle matches all ${migrations.length} ordered SQL migrations.`)
