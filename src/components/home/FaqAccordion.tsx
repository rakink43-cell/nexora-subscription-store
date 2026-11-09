import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, MessageCircle } from 'lucide-react'
import type { Faq } from '../../types'
import { cn } from '../../lib/utils'

export function FaqAccordion({ faqs, defaultOpen = 0 }: { faqs: Faq[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<string | null>(faqs[defaultOpen]?.id ?? null)

  return (
    <div className="divide-y divide-white/8 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
      {faqs.map((faq) => {
        const isOpen = open === faq.id
        return (
          <div key={faq.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : faq.id)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5"
            >
              <span className="flex-1 text-[13.5px] font-medium text-white sm:text-sm">{faq.question}</span>
              <ChevronDown
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 text-white/40 transition-transform duration-300',
                  isOpen && 'rotate-180 text-[#6EC1FF]',
                )}
                aria-hidden
              />
            </button>
            <div
              className={cn(
                'grid transition-all duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-[13px] leading-relaxed text-white/50 sm:px-5">{faq.answer}</p>
              </div>
            </div>
          </div>
        )
      })}
      <div className="flex flex-col items-center justify-between gap-2 bg-white/[0.02] px-4 py-3.5 sm:flex-row sm:px-5">
        <p className="text-[12.5px] text-white/45">Still have a question?</p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#6EC1FF] transition hover:text-white"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          Talk to our support team
        </Link>
      </div>
    </div>
  )
}
