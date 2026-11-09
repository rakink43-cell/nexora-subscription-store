import { useEffect, useState } from 'react'
import { Building2, Globe, Megaphone, Save, Wallet } from 'lucide-react'
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
  const [error, setError] = useState<string | null>(null)

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
            <Field label="Banner image path or URL" hint="Leave as /brand/nexora-banner.png to use the official banner">
              <Input value={form.site.hero_banner} onChange={(e) => patch('site', { hero_banner: e.target.value })} />
            </Field>
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
        <div className="space-y-3">
          {methods.map((m) => (
            <AdminCard
              key={m.id}
              title={`${m.display_name} instructions`}
              description={`Order instructions shown to customers paying with ${m.display_name}`}
              action={
                <Button size="sm" variant="ghost" onClick={() => void saveMethod(m)} loading={saving}>
                  Save
                </Button>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Display name">
                  <Input
                    value={m.display_name}
                    onChange={(e) =>
                      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, display_name: e.target.value } : x)))
                    }
                  />
                </Field>
                <Field label="Account name">
                  <Input
                    value={m.account_name ?? ''}
                    onChange={(e) =>
                      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, account_name: e.target.value } : x)))
                    }
                  />
                </Field>
                <Field label="Account / merchant number" required>
                  <Input
                    value={m.account_number}
                    className="font-mono"
                    onChange={(e) =>
                      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, account_number: e.target.value } : x)))
                    }
                  />
                </Field>
                <Field label="Account type">
                  <Input
                    value={m.account_type ?? ''}
                    onChange={(e) =>
                      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, account_type: e.target.value } : x)))
                    }
                  />
                </Field>
                {m.method === 'bank_transfer' && (
                  <>
                    <Field label="Bank name">
                      <Input
                        value={m.bank_name ?? ''}
                        onChange={(e) =>
                          setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, bank_name: e.target.value } : x)))
                        }
                      />
                    </Field>
                    <Field label="Branch">
                      <Input
                        value={m.branch ?? ''}
                        onChange={(e) =>
                          setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, branch: e.target.value } : x)))
                        }
                      />
                    </Field>
                    <Field label="Routing number">
                      <Input
                        value={m.routing_number ?? ''}
                        onChange={(e) =>
                          setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, routing_number: e.target.value } : x)))
                        }
                      />
                    </Field>
                  </>
                )}
              </div>
              <div className="mt-3">
                <Field label="Customer instructions">
                  <Textarea
                    className="min-h-[90px]"
                    value={m.instructions ?? ''}
                    onChange={(e) =>
                      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, instructions: e.target.value } : x)))
                    }
                  />
                </Field>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-[12.5px] text-white/70">
                <input
                  type="checkbox"
                  checked={m.is_active}
                  onChange={(e) =>
                    setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_active: e.target.checked } : x)))
                  }
                  className="h-4 w-4 accent-[#008CFF]"
                />
                Accept payments with this method
              </label>
            </AdminCard>
          ))}

          <div className="rounded-xl border border-[#008CFF]/25 bg-[#008CFF]/[0.06] p-4">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
              <Wallet className="h-4 w-4 text-[#6EC1FF]" aria-hidden />
              Manual verification model
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/50">
              NEXORA never marks an order as paid automatically. Customers send money, submit a
              transaction ID, and an administrator verifies it. To add an official payment gateway later,
              create a server-side endpoint and write the same{' '}
              <code className="rounded bg-black/40 px-1 font-mono text-[10.5px]">payments</code> row — the
              order workflow does not need to change.
            </p>
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
