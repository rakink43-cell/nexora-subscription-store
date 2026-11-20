import { useEffect, useState } from 'react'
import { Building2, Globe, Megaphone, Plus, Save, Trash2, Upload, Wallet } from 'lucide-react'
import { api, isDemoMode } from '../../lib/api'
import { AdminCard, AdminHeader } from '../../components/admin/AdminUI'
import { Button, ErrorNote, Field, Input, Tabs, Tab, Textarea } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useStore } from '../../context/SettingsContext'
import type { PaymentMethodConfig, SiteSettings } from '../../types'

export default function AdminSettings() {
  const { settings, paymentMethods, reload } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('site')
  const [form, setForm] = useState<SiteSettings>(settings)
  const [methods, setMethods] = useState<PaymentMethodConfig[]>(paymentMethods)
  const [saving, setSaving] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newMethod, setNewMethod] = useState({ method_key: '', display_name: '', account_number: '', account_name: '', account_type: 'Personal', instructions: '', payment_type: 'manual' as 'manual' | 'gateway', requires_transaction_id: true })

  useEffect(() => {
    setForm(settings)
  }, [settings])

  useEffect(() => {
    setMethods(paymentMethods)
  }, [paymentMethods])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.admin.saveSettings({
        site: form.site,
        contact: form.contact,
        notices: form.notices,
        seo: form.seo,
        trust: form.trust,
        rewards: form.rewards,
      })
      toast.success('Settings saved', 'Storefront updated immediately.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  const saveMethod = async (method: PaymentMethodConfig) => {
    setSaving(true)
    setError(null)
    try {
      await api.admin.savePaymentMethod(method)
      toast.success('Payment method updated', method.display_name)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the payment method.')
    } finally {
      setSaving(false)
    }
  }

  const patch = <K extends keyof SiteSettings>(key: K, value: Partial<SiteSettings[K]>) =>
    setForm((f) => ({ ...f, [key]: { ...(f[key] as object), ...value } }))

  return (
    <div>
      <AdminHeader
        title="Website settings"
        description="Hero copy, contact details, payment instructions and SEO — all editable here."
        action={
          <Button size="sm" onClick={() => void saveSettings()} loading={saving} icon={<Save className="h-3.5 w-3.5" />}>
            Save changes
          </Button>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      {isDemoMode && (
        <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-[11.5px] text-amber-200/80">
          Demo mode: settings are stored in this browser. With Supabase connected these writes go to the
          <code className="mx-1 rounded bg-black/40 px-1 font-mono text-[10.5px]">website_settings</code> table.
        </p>
      )}

      <Tabs value={tab} onChange={setTab} className="mb-4">
        <Tab value="site">Storefront</Tab>
        <Tab value="hero">Hero & banner</Tab>
        <Tab value="contact">Contact</Tab>
        <Tab value="payment">Payment</Tab>
        <Tab value="notices">Notices</Tab>
        <Tab value="seo">SEO</Tab>
      </Tabs>

      {tab === 'site' && (
        <AdminCard title="Store identity" description="Brand name and tagline used across the site">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name">
              <Input value={form.site.name} onChange={(e) => patch('site', { name: e.target.value })} />
            </Field>
            <Field label="Tagline">
              <Input value={form.site.tagline} onChange={(e) => patch('site', { tagline: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Trust badges (homepage)" hint="One per line: Title | Description">
              <Textarea
                className="min-h-[96px] font-mono text-[12px]"
                value={form.trust.items.map((i) => `${i.title} | ${i.text}`).join('\n')}
                onChange={(e) =>
                  patch('trust', {
                    items: e.target.value
                      .split('\n')
                      .filter((l) => l.trim())
                      .map((line) => {
                        const [title, ...rest] = line.split('|')
                        return { title: title.trim(), text: rest.join('|').trim() }
                      }),
                  })
                }
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Warranty days">
              <Input
                type="number"
                value={form.rewards.warranty_days}
                onChange={(e) => patch('rewards', { warranty_days: Number(e.target.value) })}
              />
            </Field>
            <Field label="Referral note">
              <Input
                value={form.rewards.referral_note}
                onChange={(e) => patch('rewards', { referral_note: e.target.value })}
              />
            </Field>
          </div>
        </AdminCard>
      )}

      {tab === 'hero' && (
        <AdminCard title="Homepage hero" description="The first thing every visitor reads">
          <div className="space-y-3">
            <Field label="Headline">
              <Input value={form.site.hero_headline} onChange={(e) => patch('site', { hero_headline: e.target.value })} />
            </Field>
            <Field label="Subtitle">
              <Input value={form.site.hero_subtitle} onChange={(e) => patch('site', { hero_subtitle: e.target.value })} />
            </Field>
            <Field label="Primary button label">
              <Input value={form.site.hero_cta} onChange={(e) => patch('site', { hero_cta: e.target.value })} />
            </Field>
            <Field label="Banner image path or URL" hint="Upload a JPG, PNG or WEBP image (max 4 MB), or paste an image URL.">
              <Input value={form.site.hero_banner} onChange={(e) => patch('site', { hero_banner: e.target.value })} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <label className="nx-btn nx-btn-ghost inline-flex cursor-pointer items-center gap-2 px-3 py-2 text-[11.5px]">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {bannerUploading ? 'Uploading banner…' : 'Upload banner image'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={bannerUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setBannerUploading(true)
                    try {
                      const url = await api.admin.uploadProductImage(file)
                      patch('site', { hero_banner: url })
                      toast.success('Banner uploaded', 'Save changes to publish it on the homepage.')
                    } catch (err) {
                      toast.error('Banner upload failed', err instanceof Error ? err.message : undefined)
                    } finally {
                      setBannerUploading(false)
                    }
                  }}
                />
              </label>
              <span className="text-[10.5px] text-white/40">Recommended: wide landscape image</span>
            </div>
            {form.site.hero_banner && (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <img src={form.site.hero_banner} alt="Banner preview" className="w-full object-cover" />
              </div>
            )}
          </div>
        </AdminCard>
      )}

      {tab === 'contact' && (
        <AdminCard title="Contact information" description="Shown in the footer, contact page and support section">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp number" hint="Include country code, e.g. +8801575864415">
              <Input value={form.contact.whatsapp} onChange={(e) => patch('contact', { whatsapp: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.contact.phone} onChange={(e) => patch('contact', { phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={form.contact.email} onChange={(e) => patch('contact', { email: e.target.value })} />
            </Field>
            <Field label="Address">
              <Input value={form.contact.address} onChange={(e) => patch('contact', { address: e.target.value })} />
            </Field>
            <Field label="Support hours">
              <Input value={form.contact.hours} onChange={(e) => patch('contact', { hours: e.target.value })} />
            </Field>
            <Field label="Facebook page URL">
              <Input value={form.contact.facebook} onChange={(e) => patch('contact', { facebook: e.target.value })} />
            </Field>
          </div>
        </AdminCard>
      )}

      {tab === 'payment' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Payment methods</h2>
              <p className="mt-1 text-[11.5px] text-white/45">Add, edit, disable or remove any payment option. Active methods appear at checkout.</p>
            </div>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">{methods.filter((m) => m.is_active).length} active</span>
          </div>

          {methods.map((m) => (
            <AdminCard
              key={m.id}
              title={m.display_name}
              description={`Key: ${m.method_key} · ${m.payment_type === 'gateway' ? 'Gateway' : 'Manual payment'}`}
              action={
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (window.confirm(`Delete ${m.display_name}? This will remove it from checkout but keep past orders.`)) {
                      setSaving(true)
                      api.admin.deletePaymentMethod(m.id).then(async () => {
                        toast.success('Payment method deleted', m.display_name)
                        await reload()
                      }).catch((err) => setError(err instanceof Error ? err.message : 'Could not delete method.')).finally(() => setSaving(false))
                    }
                  }} loading={saving} icon={<Trash2 className="h-3.5 w-3.5" />}>Delete</Button>
                  <Button size="sm" onClick={() => void saveMethod(m)} loading={saving} icon={<Save className="h-3.5 w-3.5" />}>Save</Button>
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Display name" required>
                  <Input value={m.display_name} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, display_name: e.target.value } : x))} />
                </Field>
                <Field label="Unique method key" hint="Lowercase letters, numbers, hyphen or underscore">
                  <Input value={m.method_key} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, method_key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') } : x))} />
                </Field>
                <Field label="Account / payment number">
                  <Input value={m.account_number ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, account_number: e.target.value } : x))} />
                </Field>
                <Field label="Account name">
                  <Input value={m.account_name ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, account_name: e.target.value } : x))} />
                </Field>
                <Field label="Account type">
                  <Input value={m.account_type ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, account_type: e.target.value } : x))} />
                </Field>
                <Field label="Bank name (optional)">
                  <Input value={m.bank_name ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, bank_name: e.target.value } : x))} />
                </Field>
                <Field label="Branch (optional)">
                  <Input value={m.branch ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, branch: e.target.value } : x))} />
                </Field>
                <Field label="Routing number (optional)">
                  <Input value={m.routing_number ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, routing_number: e.target.value } : x))} />
                </Field>
                <Field label="QR image URL (optional)">
                  <Input value={m.qr_image_url ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, qr_image_url: e.target.value } : x))} />
                </Field>
                <Field label="Payment flow">
                  <select className="nx-input" value={m.payment_type ?? 'manual'} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, payment_type: e.target.value as 'manual' | 'gateway' } : x))}>
                    <option value="manual">Manual payment</option>
                    <option value="gateway">Online gateway</option>
                  </select>
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Customer instructions" hint="Write the exact steps customers should follow">
                  <Textarea className="min-h-[90px]" value={m.instructions ?? ''} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, instructions: e.target.value } : x))} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Additional details (one per line: Label | Value)" hint="For example: Merchant Name | NEXORA">
                  <Textarea className="min-h-[70px]" value={Object.entries(m.extra_details ?? {}).map(([k,v]) => `${k} | ${v}`).join('\n')} onChange={(e) => {
                    const extra_details = Object.fromEntries(e.target.value.split('\n').filter(Boolean).map((line) => { const [k, ...v] = line.split('|'); return [k.trim(), v.join('|').trim()] }).filter(([k]) => k))
                    setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, extra_details } : x))
                  }} />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-[12px] text-white/70"><input type="checkbox" checked={m.is_active} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, is_active: e.target.checked } : x))} className="h-4 w-4 accent-[#008CFF]" />Show at checkout</label>
                <label className="flex items-center gap-2 text-[12px] text-white/70"><input type="checkbox" checked={m.requires_transaction_id ?? true} onChange={(e) => setMethods((prev) => prev.map((x) => x.id === m.id ? { ...x, requires_transaction_id: e.target.checked } : x))} className="h-4 w-4 accent-[#008CFF]" />Require Transaction ID</label>
              </div>
            </AdminCard>
          ))}

          <AdminCard title="Add a new payment method" description="Create any custom method. It will appear on the public checkout when enabled.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Display name" required><Input value={newMethod.display_name} placeholder="e.g. Rocket / Upay / Bank" onChange={(e) => setNewMethod((v) => ({ ...v, display_name: e.target.value }))} /></Field>
              <Field label="Unique key" required hint="Example: rocket, upay, bank-usd"><Input value={newMethod.method_key} placeholder="rocket" onChange={(e) => setNewMethod((v) => ({ ...v, method_key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') }))} /></Field>
              <Field label="Account / payment number"><Input value={newMethod.account_number} onChange={(e) => setNewMethod((v) => ({ ...v, account_number: e.target.value }))} /></Field>
              <Field label="Account name"><Input value={newMethod.account_name} onChange={(e) => setNewMethod((v) => ({ ...v, account_name: e.target.value }))} /></Field>
              <Field label="Account type"><Input value={newMethod.account_type} onChange={(e) => setNewMethod((v) => ({ ...v, account_type: e.target.value }))} /></Field>
              <Field label="Payment flow"><select className="nx-input" value={newMethod.payment_type} onChange={(e) => setNewMethod((v) => ({ ...v, payment_type: e.target.value as 'manual' | 'gateway' }))}><option value="manual">Manual payment</option><option value="gateway">Online gateway</option></select></Field>
            </div>
            <div className="mt-3"><Field label="Customer instructions"><Textarea className="min-h-[80px]" value={newMethod.instructions} onChange={(e) => setNewMethod((v) => ({ ...v, instructions: e.target.value }))} /></Field></div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[12px] text-white/70"><input type="checkbox" checked={newMethod.requires_transaction_id} onChange={(e) => setNewMethod((v) => ({ ...v, requires_transaction_id: e.target.checked }))} className="h-4 w-4 accent-[#008CFF]" />Require Transaction ID</label>
              <Button loading={saving} icon={<Plus className="h-4 w-4" />} onClick={() => {
                const method_key = newMethod.method_key.trim()
                if (!newMethod.display_name.trim() || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(method_key)) {
                  setError('Enter a display name and a unique key (at least 2 characters).')
                  return
                }
                setSaving(true)
                setError(null)
                api.admin.createPaymentMethod({
                  method: 'bank_transfer',
                  method_key,
                  display_name: newMethod.display_name.trim(),
                  account_number: newMethod.account_number.trim(),
                  account_name: newMethod.account_name.trim() || null,
                  account_type: newMethod.account_type.trim() || null,
                  bank_name: null, branch: null, routing_number: null, instructions: newMethod.instructions.trim() || null,
                  logo_url: null, qr_image_url: null, payment_type: newMethod.payment_type,
                  extra_details: {}, requires_transaction_id: newMethod.requires_transaction_id,
                  is_active: true, sort_order: methods.length + 1,
                }).then(async () => {
                  toast.success('Payment method added', newMethod.display_name)
                  setNewMethod({ method_key: '', display_name: '', account_number: '', account_name: '', account_type: 'Personal', instructions: '', payment_type: 'manual', requires_transaction_id: true })
                  await reload()
                }).catch((err) => setError(err instanceof Error ? err.message : 'Could not add payment method.')).finally(() => setSaving(false))
              }}>Add payment method</Button>
            </div>
          </AdminCard>

          <div className="rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/[0.06] p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-white"><Wallet className="h-4 w-4 text-[#6EC1FF]" aria-hidden />Manual verification model</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">Customers send money and submit a Transaction ID. Admin verifies it before delivery. Gateway methods need a separate approved merchant account and secure server-side integration before they can collect payments automatically.</p>
          </div>
        </div>
      )}

      {tab === 'notices' && (
        <AdminCard title="Announcement & notices" description="Banner text and checkout messaging">
          <div className="space-y-3">
            <Field label="Announcement bar text">
              <Input
                value={form.notices.announcement}
                onChange={(e) => patch('notices', { announcement: e.target.value })}
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
              <input
                type="checkbox"
                checked={form.notices.announcement_active}
                onChange={(e) => patch('notices', { announcement_active: e.target.checked })}
                className="h-4 w-4 accent-[#008CFF]"
              />
              Show the announcement bar
            </label>
            <Field label="Checkout note" hint="Shown under the payment method selector">
              <Textarea
                className="min-h-[80px]"
                value={form.notices.checkout_note}
                onChange={(e) => patch('notices', { checkout_note: e.target.value })}
              />
            </Field>
            <Field label="Support note" hint="Shown on the About page CTA">
              <Textarea
                className="min-h-[70px]"
                value={form.notices.support_note}
                onChange={(e) => patch('notices', { support_note: e.target.value })}
              />
            </Field>
          </div>
        </AdminCard>
      )}

      {tab === 'seo' && (
        <AdminCard title="SEO" description="Title and description used by search engines and social previews">
          <div className="space-y-3">
            <Field label="Page title">
              <Input value={form.seo.title} onChange={(e) => patch('seo', { title: e.target.value })} />
            </Field>
            <Field label="Meta description">
              <Textarea
                className="min-h-[80px]"
                value={form.seo.description}
                onChange={(e) => patch('seo', { description: e.target.value })}
              />
            </Field>
            <Field label="Keywords">
              <Input value={form.seo.keywords} onChange={(e) => patch('seo', { keywords: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] p-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/35">
              <Globe className="h-3 w-3" aria-hidden />
              Google preview
            </p>
            <p className="mt-1.5 text-[13px] text-[#8AB4F8]">{form.seo.title}</p>
            <p className="text-[11px] text-emerald-500/80">nexora.store</p>
            <p className="mt-0.5 line-clamp-2 text-[11.5px] text-white/50">{form.seo.description}</p>
          </div>
        </AdminCard>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void saveSettings()} loading={saving} icon={<Save className="h-4 w-4" />}>
          Save all settings
        </Button>
        <span className="flex items-center gap-1.5 text-[11px] text-white/30">
          <Building2 className="h-3 w-3" aria-hidden />
          Changes apply to the live storefront immediately
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-white/30">
          <Megaphone className="h-3 w-3" aria-hidden />
          Payment numbers are public — keep them accurate
        </span>
      </div>
    </div>
  )
}
