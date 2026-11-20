import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Save } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader } from '../../components/admin/AdminUI'
import { Button, ErrorNote, Field, Input, Textarea } from '../../components/ui'
import { useStore } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import type { HomepageSection, HomepageSectionId, HomepageSettings } from '../../types'

const SECTION_LABELS: Record<HomepageSectionId, { label: string; description: string }> = {
  hero: { label: 'Hero banner', description: 'Main headline, introduction and banner image' },
  categories: { label: 'Category grid', description: 'Browse product categories' },
  best_selling: { label: 'Best sellers', description: 'Popular products across the store' },
  ott: { label: 'OTT subscriptions', description: 'Streaming and entertainment products' },
  ai: { label: 'AI tools', description: 'Premium AI products' },
  education: { label: 'Education', description: 'Learning and course subscriptions' },
  offers: { label: 'Special offers', description: 'Current promotions and campaigns' },
  why_choose: { label: 'Why choose NEXORA', description: 'Store benefits and trust information' },
  software: { label: 'Software & productivity', description: 'Software and productivity products' },
  testimonials: { label: 'Customer reviews', description: 'Approved customer testimonials' },
  faq: { label: 'FAQ', description: 'Frequently asked questions' },
}

const EDITABLE_HEADINGS: HomepageSectionId[] = ['best_selling', 'ott', 'ai', 'education', 'software']

export default function AdminHomepage() {
  const { settings, reload } = useStore()
  const toast = useToast()
  const [form, setForm] = useState<HomepageSettings>(settings.homepage)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setForm(settings.homepage), [settings.homepage])

  const ordered = useMemo(
    () => [...form.sections].sort((a, b) => a.sort_order - b.sort_order),
    [form.sections],
  )

  const updateSection = (id: HomepageSectionId, patch: Partial<HomepageSection>) => {
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section),
    }))
  }

  const moveSection = (id: HomepageSectionId, direction: -1 | 1) => {
    const next = [...ordered]
    const index = next.findIndex((section) => section.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setForm((current) => ({
      ...current,
      sections: next.map((section, position) => ({ ...section, sort_order: position + 1 })),
    }))
  }

  const updateHeading = (id: string, key: 'eyebrow' | 'title' | 'subtitle', value: string) => {
    setForm((current) => ({
      ...current,
      headings: {
        ...current.headings,
        [id]: { ...current.headings[id], [key]: value },
      },
    }))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.admin.saveSettings({ homepage: form })
      await reload()
      toast.success('Homepage updated', 'Your changes are now live on the storefront.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save homepage settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <AdminHeader
        title="Homepage editor"
        description="Control which homepage sections appear, change their order and edit product-section headings."
        action={<Button size="sm" loading={saving} onClick={() => void save()} icon={<Save className="h-3.5 w-3.5" />}>Save changes</Button>}
      />
      {error && <ErrorNote message={error} className="mb-4" />}

      <AdminCard title="Homepage sections" description="Hide sections you do not need, or move them up and down. The hero banner content is edited in Website Settings → Hero & banner.">
        <div className="space-y-2">
          {ordered.map((section, index) => {
            const meta = SECTION_LABELS[section.id]
            return (
              <div key={section.id} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-white">{meta.label}</p>
                  <p className="mt-0.5 text-[10.5px] text-white/40">{meta.description}</p>
                </div>
                <button type="button" onClick={() => moveSection(section.id, -1)} disabled={index === 0} aria-label={`Move ${meta.label} up`} className="rounded-md p-1.5 text-white/50 hover:bg-white/8 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveSection(section.id, 1)} disabled={index === ordered.length - 1} aria-label={`Move ${meta.label} down`} className="rounded-md p-1.5 text-white/50 hover:bg-white/8 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => updateSection(section.id, { enabled: !section.enabled })} aria-label={section.enabled ? `Hide ${meta.label}` : `Show ${meta.label}`} className={section.enabled ? 'rounded-md p-1.5 text-emerald-300 hover:bg-emerald-500/10' : 'rounded-md p-1.5 text-white/35 hover:bg-white/8'}>
                  {section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <span className="w-5 text-right text-[10px] tabular-nums text-white/30">{index + 1}</span>
              </div>
            )
          })}
        </div>
      </AdminCard>

      <div className="mt-4 space-y-4">
        {EDITABLE_HEADINGS.map((id) => {
          const heading = form.headings[id]
          const label = SECTION_LABELS[id].label
          return (
            <AdminCard key={id} title={`${label} heading`} description="These text fields appear above the product carousel on the homepage.">
              <div className="grid gap-3">
                <Field label="Eyebrow"><Input value={heading?.eyebrow ?? ''} onChange={(e) => updateHeading(id, 'eyebrow', e.target.value)} /></Field>
                <Field label="Title"><Input value={heading?.title ?? ''} onChange={(e) => updateHeading(id, 'title', e.target.value)} /></Field>
                <Field label="Subtitle"><Textarea value={heading?.subtitle ?? ''} onChange={(e) => updateHeading(id, 'subtitle', e.target.value)} className="min-h-[70px]" /></Field>
              </div>
            </AdminCard>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" loading={saving} onClick={() => void save()} icon={<Save className="h-3.5 w-3.5" />}>Save homepage</Button>
      </div>
    </div>
  )
}
