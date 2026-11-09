import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HelpCircle, MessageCircle } from 'lucide-react'
import { useStore } from '../context/SettingsContext'
import { FaqAccordion } from '../components/home/FaqAccordion'
import { ButtonLink, Skeleton } from '../components/ui'
import { cn, contactLink } from '../lib/utils'

export default function FaqPage() {
  const { faqs, loading, settings } = useStore()
  const [category, setCategory] = useState('All')

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(faqs.map((f) => f.category ?? 'General')))],
    [faqs],
  )

  const shown = useMemo(
    () => (category === 'All' ? faqs : faqs.filter((f) => (f.category ?? 'General') === category)),
    [faqs, category],
  )

  return (
    <div className="nx-container py-12">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="nx-eyebrow">Help centre</span>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/50">
            Everything about delivery, payments, warranties and how our manual verification works.
          </p>
        </div>

        <div className="nx-scroll-x mt-7 justify-center">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition',
                category === c
                  ? 'border-[#008CFF] bg-[#008CFF]/15 text-[#7CC7FF]'
                  : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center">
              <HelpCircle className="mx-auto h-7 w-7 text-white/20" aria-hidden />
              <p className="mt-2 text-[13px] text-white/50">No questions in this category yet.</p>
            </div>
          ) : (
            <FaqAccordion faqs={shown} />
          )}
        </div>

        <div className="mt-7 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center">
          <MessageCircle className="mx-auto h-5 w-5 text-[#6EC1FF]" aria-hidden />
          <h2 className="mt-2 font-display text-base font-bold text-white">Still stuck?</h2>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-white/45">
            A real person answers our WhatsApp — usually within minutes during business hours
            ({settings.contact.hours}).
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ButtonLink
              to={contactLink('whatsapp', settings.contact.whatsapp)}
              external
              icon={<MessageCircle className="h-3.5 w-3.5" />}
            >
              WhatsApp us
            </ButtonLink>
            <ButtonLink to="/contact" variant="ghost">Contact form</ButtonLink>
            <ButtonLink to="/track" variant="ghost">Track order</ButtonLink>
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-white/30">
          Looking for our policies?{' '}
          <Link to="/refund" className="text-[#6EC1FF] hover:underline">Refund</Link> ·{' '}
          <Link to="/terms" className="text-[#6EC1FF] hover:underline">Terms</Link> ·{' '}
          <Link to="/privacy" className="text-[#6EC1FF] hover:underline">Privacy</Link>
        </p>
      </div>
    </div>
  )
}
