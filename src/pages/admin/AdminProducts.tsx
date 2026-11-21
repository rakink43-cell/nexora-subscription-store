import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy,
  Edit2,
  ImagePlus,
  Package,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader, AdminTable } from '../../components/admin/AdminUI'
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '../../components/ui'
import { useStore } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import {
  AVAILABILITY_META,
  cn,
  discountPercent,
  formatBDT,
  slugify,
} from '../../lib/utils'
import type { Product } from '../../types'
import { validateStoreImage } from '../../lib/imageValidation'

function validateProductImageUrl(value: string, label: string) {
  const url = value.trim()
  if (!url) return
  if (url.length > 2048) throw new Error(label + ' URL is too long.')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(label + ' must be a complete image URL starting with https://.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(label + ' must use http:// or https://.')
  }
}

const EMPTY: Partial<Product> = {
  name: '',
  slug: '',
  category_id: '',
  brand: '',
  short_description: '',
  description: '',
  image_url: '',
  gallery: [],
  duration: '1 Month',
  original_price: 0,
  discounted_price: 0,
  new_user_offer_enabled: false,
  delivery_info: 'Instant delivery after payment verification.',
  delivery_time: 'Within 30 minutes',
  availability: 'in_stock',
  is_featured: false,
  is_active: true,
  badge: '',
  admin_note: '',
  sort_order: 0,
}

export default function AdminProducts() {
  const { categories } = useStore()
  const toast = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editing, setEditing] = useState<(Partial<Product> & { isNew?: boolean }) | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAvailability, setBulkAvailability] = useState('in_stock')
  const [pricePercent, setPricePercent] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await api.admin.allProducts())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let rows = products
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q),
      )
    }
    if (categoryFilter !== 'all') rows = rows.filter((p) => p.category_id === categoryFilter)
    return rows
  }, [products, search, categoryFilter])

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.admin.deleteProduct(deleting.id)
      toast.success('Product deleted', deleting.name)
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error('Could not delete', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const applyBulk = async (patch: Partial<Product>) => {
    const targets = products.filter((product) => selectedIds.includes(product.id))
    if (!targets.length) return
    setBusy(true)
    try {
      for (const product of targets) await api.admin.saveProduct({ ...product, ...patch })
      toast.success('Bulk update complete', targets.length + ' product(s) updated')
      setSelectedIds([])
      await load()
    } catch (err) {
      toast.error('Bulk update stopped', err instanceof Error ? err.message : undefined)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const applyPriceChange = async () => {
    const percent = Number(pricePercent)
    if (!Number.isFinite(percent) || percent < -90 || percent > 500) {
      toast.error('Enter a percentage between -90 and 500.')
      return
    }
    const targets = products.filter((product) => selectedIds.includes(product.id))
    if (!targets.length) return
    setBusy(true)
    try {
      for (const product of targets) {
        const original = Math.max(0, Math.round(Number(product.original_price) * (1 + percent / 100)))
        const discounted = Math.max(0, Math.round(Number(product.discounted_price) * (1 + percent / 100)))
        await api.admin.saveProduct({ ...product, original_price: original, discounted_price: discounted })
      }
      toast.success('Bulk pricing updated', targets.length + ' product(s) updated')
      setSelectedIds([])
      setPricePercent('')
      await load()
    } catch (err) {
      toast.error('Pricing update stopped', err instanceof Error ? err.message : undefined)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    const quote = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"'
    const rows = [
      ['name', 'slug', 'brand', 'original_price', 'discounted_price', 'availability', 'is_active', 'is_featured', 'new_user_offer_enabled'],
      // Export offer eligibility so catalog edits can preserve or explicitly change it.
      ...filtered.map((product) => [product.name, product.slug, product.brand, product.original_price, product.discounted_price, product.availability, product.is_active, product.is_featured, product.new_user_offer_enabled]),
    ]
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'nexora-products.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const parseCsvRow = (line: string) => {
    const cells: string[] = []
    let value = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++ }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { cells.push(value); value = '' }
      else value += char
    }
    cells.push(value)
    return cells
  }

  const importCsv = async (file?: File) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('CSV must be smaller than 2 MB.'); return }
    const text = await file.text()
    const lines = text.replace(/^\\uFEFF/, '').split(/\\r?\\n/).filter((line) => line.trim())
    if (lines.length < 2) { toast.error('CSV has no product rows.'); return }
    const headers = parseCsvRow(lines[0]).map((header) => header.trim().toLowerCase())
    const required = ['slug', 'original_price', 'discounted_price']
    if (!required.every((header) => headers.includes(header))) {
      toast.error('CSV must include slug, original_price and discounted_price columns.')
      return
    }
    const index = (name: string) => headers.indexOf(name)
    const bySlug = new Map(products.map((product) => [product.slug, product]))
    const updates = lines.slice(1).map((line) => parseCsvRow(line)).filter((cells) => cells.length === headers.length)
    const matched = updates.map((cells) => ({ cells, product: bySlug.get(cells[index('slug')].trim()), slug: cells[index('slug')].trim() }))
    const unknownSlugs = [...new Set(matched.filter((row) => !row.product).map((row) => row.slug || '(blank slug)'))]
    if (unknownSlugs.length) {
      toast.error('CSV contains unknown product slugs', unknownSlugs.slice(0, 5).join(', ') + (unknownSlugs.length > 5 ? ', …' : '') + '. Nothing imported.')
      return
    }
    const slugCounts = new Map<string, number>()
    for (const row of matched) slugCounts.set(row.slug, (slugCounts.get(row.slug) ?? 0) + 1)
    const duplicateSlugs = [...slugCounts].filter(([, count]) => count > 1).map(([slug]) => slug)
    if (duplicateSlugs.length) {
      toast.error('CSV contains duplicate product slugs', duplicateSlugs.slice(0, 5).join(', ') + (duplicateSlugs.length > 5 ? ', …' : '') + '. Nothing imported.')
      return
    }
    if (!matched.length) { toast.error('No product rows found. Nothing imported.'); return }

    // Validate every matched row before writing, avoiding silent skips and
    // preventing malformed CSV from partially changing the catalogue.
    let prepared: Array<{ product: Product; original: number; discounted: number; availability?: string; active?: string; featured?: string; offer?: string; brand?: string }> 
    try {
      const allowedAvailability: Product['availability'][] = ['in_stock', 'limited', 'out_of_stock']
      prepared = matched.map(({ cells, product }) => {
      const original = Number(cells[index('original_price')])
      const discounted = Number(cells[index('discounted_price')])
      if (!Number.isFinite(original) || !Number.isFinite(discounted) || original < 0 || discounted < 0) {
        throw new Error('CSV contains an invalid or negative price.')
      }
      if (discounted > original) throw new Error('Discounted price cannot exceed original price for slug: ' + product!.slug)
      const availability = index('availability') >= 0 ? cells[index('availability')].trim() : undefined
      if (availability !== undefined && !allowedAvailability.includes(availability as Product['availability'])) {
        throw new Error('Invalid availability value for slug: ' + product!.slug)
      }
      const active = index('is_active') >= 0 ? cells[index('is_active')].trim().toLowerCase() : undefined
      const featured = index('is_featured') >= 0 ? cells[index('is_featured')].trim().toLowerCase() : undefined
      const offer = index('new_user_offer_enabled') >= 0 ? cells[index('new_user_offer_enabled')].trim().toLowerCase() : undefined
      if (offer !== undefined && !['true', 'false'].includes(offer)) throw new Error('new_user_offer_enabled must be true or false for slug: ' + product!.slug)
      if (active !== undefined && !['true', 'false'].includes(active)) throw new Error('is_active must be true or false for slug: ' + product!.slug)
      if (featured !== undefined && !['true', 'false'].includes(featured)) throw new Error('is_featured must be true or false for slug: ' + product!.slug)
      return {
        product: product!,
        original,
        discounted,
        availability,
        active,
        featured,
        offer,
        brand: index('brand') >= 0 ? cells[index('brand')] : undefined,
      }
      })
    } catch (err) {
      toast.error('CSV validation failed', err instanceof Error ? err.message : undefined)
      return
    }
    setBusy(true)
    let count = 0
    try {
      for (const row of prepared) {
        await api.admin.saveProduct({
          ...row.product,
          original_price: row.original,
          discounted_price: row.discounted,
          ...(row.brand !== undefined ? { brand: row.brand || null } : {}),
          ...(row.availability !== undefined ? { availability: row.availability as Product['availability'] } : {}),
          ...(row.active !== undefined ? { is_active: row.active === 'true' } : {}),
          ...(row.featured !== undefined ? { is_featured: row.featured === 'true' } : {}),
          ...(row.offer !== undefined ? { new_user_offer_enabled: row.offer === 'true' } : {}),
        })
        count++
      }
      toast.success('CSV import complete', count + ' product(s) updated by matching slug')
      await load()
    } catch (err) {
      toast.error('CSV import stopped', err instanceof Error ? err.message : undefined)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const duplicate = async (product: Product) => {
    try {
      await api.admin.saveProduct({
        ...product,
        id: undefined as unknown as string,
        name: `${product.name} (Copy)`,
        slug: `${product.slug}-copy-${Math.random().toString(36).slice(2, 5)}`,
        is_featured: false,
      })
      toast.success('Product duplicated')
      await load()
    } catch (err) {
      toast.error('Could not duplicate', err instanceof Error ? err.message : undefined)
    }
  }

  return (
    <div>
      <AdminHeader
        title="Products"
        description="Manage the catalogue: pricing, discounts, images, availability, featured status and first-3-order offers."
        action={
          <Button
            size="sm"
            onClick={() => setEditing({ ...EMPTY, category_id: categories[0]?.id ?? '', isNew: true })}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add product
          </Button>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={exportCsv} icon={<Upload className="h-3.5 w-3.5 rotate-180" />}>Export CSV</Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/5">
          <Upload className="h-3.5 w-3.5" /> Import CSV
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(event) => { void importCsv(event.target.files?.[0]); event.currentTarget.value = '' }} />
        </label>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or brand…"
            className="py-2 pl-8 text-[12.5px]"
            aria-label="Search products"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="py-2 text-[12.5px] sm:w-56"
          aria-label="Filter by category"
        >
          <option value="all" className="bg-[#0B111D]">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#0B111D]">{c.name}</option>
          ))}
        </Select>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#168BFF]/25 bg-[#168BFF]/[0.07] p-3">
          <span className="mr-1 text-[11px] font-semibold text-white">{selectedIds.length} selected</span>
          <Button size="sm" variant="subtle" loading={busy} onClick={() => void applyBulk({ is_active: true })}>Show</Button>
          <Button size="sm" variant="subtle" loading={busy} onClick={() => void applyBulk({ is_active: false })}>Hide</Button>
          <Button size="sm" variant="subtle" loading={busy} onClick={() => void applyBulk({ is_featured: true })}>Feature</Button>
          <Button size="sm" variant="subtle" loading={busy} onClick={() => void applyBulk({ is_featured: false })}>Unfeature</Button>
          <Button size="sm" variant="subtle" loading={busy} onClick={() => void applyBulk({ new_user_offer_enabled: true })}>Enable 90%-off first-3-order offer</Button>
          <Button size="sm" variant="subtle" loading={busy} onClick={() => void applyBulk({ new_user_offer_enabled: false })}>Disable offer</Button>
          <Select value={bulkAvailability} onChange={(e) => setBulkAvailability(e.target.value)} className="w-36 py-1.5 text-[11px]">
            <option value="in_stock">In stock</option>
            <option value="limited">Limited</option>
            <option value="out_of_stock">Out of stock</option>
          </Select>
          <Button size="sm" loading={busy} onClick={() => void applyBulk({ availability: bulkAvailability as Product['availability'] })}>Apply stock</Button>
          <div className="flex items-center gap-1.5">
            <Input value={pricePercent} onChange={(e) => setPricePercent(e.target.value)} placeholder="% e.g. 10 or -5" className="w-28 py-1.5 text-[11px]" aria-label="Bulk price percentage change" />
            <Button size="sm" loading={busy} disabled={!pricePercent.trim()} onClick={() => void applyPriceChange()}>Adjust prices</Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
      )}
      <AdminCard bodyClassName="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] font-medium text-white/60">No products</p>
            <p className="mt-0.5 text-[11.5px] text-white/35">Add your first product to start selling.</p>
          </div>
        ) : (
          <>
          <div className="mb-2 flex items-center gap-2">
            <input type="checkbox" checked={filtered.length > 0 && filtered.every((product) => selectedIds.includes(product.id))} onChange={(e) => setSelectedIds(e.target.checked ? filtered.map((product) => product.id) : [])} aria-label="Select all filtered products" className="h-4 w-4 accent-[#168BFF]" />
            <span className="text-[10.5px] text-white/40">Select all {filtered.length} filtered products</span>
          </div>
          <AdminTable head={['Select', 'Product', 'Category', 'Price', 'Discount', 'Stock', 'Flags', '']}>
            {filtered.map((p) => {
              const off = discountPercent(Number(p.original_price), Number(p.discounted_price))
              const availability = AVAILABILITY_META[p.availability]
              return (
                <tr key={p.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-2 py-2.5"><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelected(p.id)} aria-label={`Select ${p.name}`} className="h-4 w-4 accent-[#168BFF]" /></td>
                  <td className="py-2.5 pr-2.5 first:pl-0">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-9 w-11 shrink-0 place-items-center overflow-hidden rounded bg-gradient-to-br from-[#0B63C5] to-[#071B33] text-[9px] font-bold text-white">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (p.brand ?? p.name).slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[190px] truncate text-[12px] font-medium text-white">{p.name}</p>
                        <p className="max-w-[190px] truncate text-[10px] text-white/35">
                          {p.brand} · {p.duration}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-[11px] text-white/50">
                    {categories.find((c) => c.id === p.category_id)?.name ?? '—'}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <p className="text-[12px] font-semibold text-white">{formatBDT(p.discounted_price)}</p>
                    <p className="text-[10px] text-white/30 line-through">{formatBDT(p.original_price)}</p>
                  </td>
                  <td className="px-2.5 py-2.5">
                    {off > 0 ? (
                      <span className="rounded bg-[#F00016]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#FF7B85]">
                        {off}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/25">—</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2.5">
                    <Badge className={availability.className} dot={availability.dot}>
                      {availability.label}
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex items-center gap-1">
                      {p.is_featured && (
                        <span title="Featured" className="text-amber-400">
                          <Star className="h-3 w-3 fill-current" aria-hidden />
                        </span>
                      )}
                      {p.new_user_offer_enabled && (
                        <span
                          title={`First 3 eligible orders: ${formatBDT(Number(p.discounted_price) * 0.1)} each`}
                          className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-rose-300"
                        >
                          Offer
                        </span>
                      )}
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9.5px] font-semibold',
                          p.is_active
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-white/8 text-white/40',
                        )}
                      >
                        {p.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pl-2.5 last:pr-0">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        aria-label={`Edit ${p.name}`}
                        className="rounded p-1.5 text-white/40 transition hover:bg-white/8 hover:text-[#6EC1FF]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void duplicate(p)}
                        aria-label={`Duplicate ${p.name}`}
                        className="rounded p-1.5 text-white/40 transition hover:bg-white/8 hover:text-[#6EC1FF]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(p)}
                        aria-label={`Delete ${p.name}`}
                        className="rounded p-1.5 text-white/40 transition hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </AdminTable>
          </>
        )}
      </AdminCard>

      <p className="mt-2.5 text-[10.5px] text-white/25">
        {filtered.length} of {products.length} products
      </p>

      <ProductFormModal
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null)
          await load()
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete product?"
        description={deleting?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
              Delete permanently
            </Button>
          </div>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-white/50">
          Existing orders keep their price snapshot, so deleting a product will not change past orders.
          If you only want to stop selling it, set it to <b className="text-white/70">Inactive</b> instead.
        </p>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function ProductFormModal({
  value,
  onClose,
  onSaved,
}: {
  value: (Partial<Product> & { isNew?: boolean }) | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { categories } = useStore()
  const toast = useToast()
  const [form, setForm] = useState<Partial<Product>>(value ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setForm(value ?? {})
    setError(null)
  }, [value])

  if (!value) return null

  const set = <K extends keyof Product>(key: K, v: Product[K] | string | number | boolean | undefined) =>
    setForm((f) => ({ ...f, [key]: v }))

  const save = async () => {
    setError(null)
    if (!form.name?.trim()) return setError('Product name is required.')
    const slug = form.slug?.trim() || slugify(form.name)
    if (!slug) return setError('Slug could not be generated — add one manually.')
    if (Number(form.discounted_price ?? 0) > Number(form.original_price ?? 0)) {
      return setError('Discounted price cannot be higher than the original price.')
    }
    let normalizedGallery: string[]
    try {
      validateProductImageUrl(form.image_url ?? '', 'Main product image')
      const gallery = [...new Set((form.gallery ?? []).map((url) => url.trim()).filter(Boolean))]
      if (gallery.length > 20) throw new Error('Product gallery can contain up to 20 images.')
      gallery.forEach((url, index) => validateProductImageUrl(url, 'Gallery image ' + (index + 1)))
      normalizedGallery = gallery
      setForm((current) => ({ ...current, gallery }))
    } catch (err) {
      return setError(err instanceof Error ? err.message : 'Please check the product image URLs.')
    }
    setSaving(true)
    try {
      await api.admin.saveProduct({
        ...form,
        gallery: normalizedGallery,
        name: form.name.trim(),
        slug,
        original_price: Number(form.original_price ?? 0),
        discounted_price: Number(form.discounted_price ?? 0),
      } as Product)
      toast.success(value.isNew ? 'Product created' : 'Product updated', form.name)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the product.')
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      await validateStoreImage(file)
      if (!('uploadProductImage' in api.admin)) {
        throw new Error('Image upload requires a connected Supabase project.')
      }
      const url = await (api.admin as { uploadProductImage: (f: File) => Promise<string> }).uploadProductImage(file)
      set('image_url', url)
      toast.success('Image uploaded')
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : undefined)
    } finally {
      setUploading(false)
    }
  }

  const off = discountPercent(Number(form.original_price ?? 0), Number(form.discounted_price ?? 0))

  return (
    <Modal
      open={Boolean(value)}
      onClose={onClose}
      size="xl"
      title={value.isNew ? 'Add product' : `Edit ${value.name}`}
      description="Pricing, availability and imagery for this subscription."
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] text-white/30">
            {off > 0 ? `${off}% off · save ${formatBDT(Number(form.original_price ?? 0) - Number(form.discounted_price ?? 0))}` : 'No discount set'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" loading={saving} disabled={uploading} onClick={() => void save()}>
              {value.isNew ? 'Create product' : 'Save changes'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product name" required className="sm:col-span-2">
          <Input
            value={form.name ?? ''}
            onChange={(e) => {
              set('name', e.target.value)
              if (value.isNew) set('slug', slugify(e.target.value))
            }}
            placeholder="Netflix Premium 4K"
          />
        </Field>

        <Field label="URL slug" hint="Auto-generated from the name">
          <Input value={form.slug ?? ''} onChange={(e) => set('slug', slugify(e.target.value))} />
        </Field>
        <Field label="Brand">
          <Input value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value)} placeholder="Netflix" />
        </Field>

        <Field label="Category">
          <Select value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0B111D]">{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Subscription duration">
          <Input value={form.duration ?? ''} onChange={(e) => set('duration', e.target.value)} placeholder="1 Month" />
        </Field>

        <Field label="Original price (৳)" required>
          <Input
            type="number"
            min={0}
            value={form.original_price ?? 0}
            onChange={(e) => set('original_price', Number(e.target.value))}
          />
        </Field>
        <Field label="Discounted price (৳)" required>
          <Input
            type="number"
            min={0}
            value={form.discounted_price ?? 0}
            onChange={(e) => set('discounted_price', Number(e.target.value))}
          />
        </Field>

        <Field label="Availability">
          <Select
            value={form.availability ?? 'in_stock'}
            onChange={(e) => set('availability', e.target.value)}
          >
            <option value="in_stock" className="bg-[#0B111D]">In stock</option>
            <option value="limited" className="bg-[#0B111D]">Limited</option>
            <option value="out_of_stock" className="bg-[#0B111D]">Out of stock</option>
          </Select>
        </Field>
        <Field label="Badge" hint="Optional ribbon, e.g. Best Seller">
          <Input value={form.badge ?? ''} onChange={(e) => set('badge', e.target.value)} />
        </Field>

        <Field label="Short description" className="sm:col-span-2" hint="Shown on product cards">
          <Input
            value={form.short_description ?? ''}
            onChange={(e) => set('short_description', e.target.value)}
            placeholder="Private 4K Ultra HD profile with your own PIN."
          />
        </Field>

        <Field label="Full description" className="sm:col-span-2">
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            className="min-h-[96px]"
            placeholder="What the customer gets, device support, activation model…"
          />
        </Field>

        <Field label="Additional gallery images" className="sm:col-span-2" hint="Upload multiple images or paste one image URL per line. Maximum 4 MB per image.">
          <Textarea
            value={(form.gallery ?? []).join('\n')}
            onChange={(e) => set('gallery', e.target.value.split('\n').map((url) => url.trim()).filter(Boolean))}
            className="min-h-[84px] font-mono text-[11px]"
            placeholder="https://example.com/product-image-2.webp\nhttps://example.com/product-image-3.webp"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="nx-btn nx-btn-ghost inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11.5px]">
              <Upload className="h-3 w-3" aria-hidden />
              {uploading ? 'Uploading…' : 'Upload gallery images'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (!files.length) return
                  const current = (form.gallery ?? []).map((url) => url.trim()).filter(Boolean)
                  // Check the maximum before uploading so rejected selections do not
                  // create unnecessary files in storage.
                  if (current.length + files.length > 20) {
                    toast.error('Gallery limit reached', `You can keep up to 20 additional images. Currently ${current.length} image(s) are listed.`)
                    return
                  }
                  setUploading(true)
                  try {
                    const uploader = (api.admin as { uploadProductImage?: (f: File) => Promise<string> }).uploadProductImage
                    if (!uploader) throw new Error('Image upload requires a connected Supabase project.')
                    // Validate the full selection before starting uploads.
                    for (const file of files) await validateStoreImage(file)
                    const urls: string[] = []
                    for (const file of files) urls.push(await uploader(file))
                    urls.forEach((url, index) => validateProductImageUrl(url, 'Uploaded gallery image ' + (index + 1)))
                    const existing = new Set(current)
                    const added = urls.filter((url) => {
                      if (existing.has(url)) return false
                      existing.add(url)
                      return true
                    })
                    if (current.length + added.length > 20) {
                      throw new Error('Gallery can contain up to 20 additional images. Remove an image before adding more.')
                    }
                    set('gallery', [...current, ...added])
                    toast.success('Gallery images uploaded', `${added.length} unique image(s) added`)
                  } catch (err) {
                    toast.error('Gallery upload failed', err instanceof Error ? err.message : undefined)
                  } finally {
                    setUploading(false)
                  }
                }}
              />
            </label>
            <span className="text-[10.5px] text-white/35">{(form.gallery ?? []).length} additional image(s)</span>
          </div>
          {(form.gallery ?? []).length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {(form.gallery ?? []).map((url, index) => (
                <div key={`${url}-${index}`} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
                  <img src={url} alt={`Gallery image ${index + 1}`} className="aspect-square w-full object-cover" />
                  <div className="flex flex-wrap items-center justify-between gap-1 p-1.5">
                    <button type="button" onClick={() => { set('image_url', url); set('gallery', (form.gallery ?? []).filter((_, i) => i !== index)) }} className="rounded px-1 py-0.5 text-[9px] font-semibold text-sky-300 hover:bg-sky-400/10" title="Use as main product image">Set main</button>
                    <div className="flex items-center gap-0.5">
                      <button type="button" disabled={index === 0} onClick={() => { const gallery = [...(form.gallery ?? [])]; [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]]; set('gallery', gallery) }} className="rounded px-1 py-0.5 text-[9px] text-white/55 disabled:opacity-25 hover:bg-white/10" aria-label={`Move gallery image ${index + 1} up`}>↑</button>
                      <button type="button" disabled={index === (form.gallery ?? []).length - 1} onClick={() => { const gallery = [...(form.gallery ?? [])]; [gallery[index + 1], gallery[index]] = [gallery[index], gallery[index + 1]]; set('gallery', gallery) }} className="rounded px-1 py-0.5 text-[9px] text-white/55 disabled:opacity-25 hover:bg-white/10" aria-label={`Move gallery image ${index + 1} down`}>↓</button>
                    </div>
                    <button type="button" onClick={() => set('gallery', (form.gallery ?? []).filter((_, i) => i !== index))} className="rounded px-1 py-0.5 text-[9px] text-rose-300 hover:bg-rose-500/10">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Field>

        <Field label="Delivery information" className="sm:col-span-2">
          <Input value={form.delivery_info ?? ''} onChange={(e) => set('delivery_info', e.target.value)} />
        </Field>
        <Field label="Typical delivery time">
          <Input value={form.delivery_time ?? ''} onChange={(e) => set('delivery_time', e.target.value)} placeholder="Within 10–30 minutes" />
        </Field>
        <Field label="Sort order">
          <Input type="number" value={form.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
        </Field>

        <div className="sm:col-span-2">
          <label className="nx-label">Product image</label>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-[#0B63C5] to-[#071B33] text-[10px] font-bold text-white">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5 text-white/50" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Input
                value={form.image_url ?? ''}
                onChange={(e) => set('image_url', e.target.value)}
                placeholder="https://… or upload a file"
                className="text-[12px]"
              />
              <div className="flex items-center gap-2">
                <label className="nx-btn nx-btn-ghost cursor-pointer px-2.5 py-1.5 text-[11.5px]">
                  <Upload className="h-3 w-3" aria-hidden />
                  {uploading ? 'Uploading…' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.currentTarget.value = ''
                      if (file) void uploadImage(file)
                    }}
                  />
                </label>
                {form.image_url && (
                  <button
                    type="button"
                    onClick={() => set('image_url', '')}
                    className="text-[11.5px] text-rose-300 hover:text-rose-200"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mt-1.5 text-[10.5px] text-white/30">
            No image? NEXORA renders a premium brand tile automatically — nothing breaks.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-rose-200">
            <input
              type="checkbox"
              checked={Boolean(form.new_user_offer_enabled)}
              onChange={(e) => set('new_user_offer_enabled', e.target.checked)}
              className="h-4 w-4 accent-[#F00016]"
            />
            90% off for eligible customers’ first 3 orders
          </label>
          <p className="basis-full text-[11px] leading-relaxed text-white/40">
            This offer uses the current discounted price: eligible customers pay 10% of that price on selected products, for their first 3 orders (excluding cancelled or refunded orders).
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
            <input
              type="checkbox"
              checked={Boolean(form.is_featured)}
              onChange={(e) => set('is_featured', e.target.checked)}
              className="h-4 w-4 accent-[#008CFF]"
            />
            Featured on homepage
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(e) => set('is_active', e.target.checked)}
              className="h-4 w-4 accent-[#008CFF]"
            />
            Active (visible in store)
          </label>
        </div>

        <Field label="Internal note (admin only)" className="sm:col-span-2">
          <Input
            value={form.admin_note ?? ''}
            onChange={(e) => set('admin_note', e.target.value)}
            placeholder="Supplier, cost price, delivery quirks…"
          />
        </Field>

        {error && <div className="sm:col-span-2"><ErrorNote message={error} /></div>}
      </div>
    </Modal>
  )
}
