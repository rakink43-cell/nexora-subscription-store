import { Fragment } from 'react'
import { useStore } from '../context/SettingsContext'
import { Hero } from '../components/home/Hero'
import { CategoryGrid } from '../components/home/CategoryGrid'
import { ProductRail } from '../components/home/ProductRail'
import { OffersStrip } from '../components/home/OffersStrip'
import { WhyChoose } from '../components/home/WhyChoose'
import { Testimonials } from '../components/home/Testimonials'
import { FaqAccordion } from '../components/home/FaqAccordion'
import { SectionHead } from '../components/ui'
import type { HomepageSectionId } from '../types'

const DEFAULT_ORDER: HomepageSectionId[] = [
  'hero', 'categories', 'best_selling', 'ott', 'ai', 'education',
  'offers', 'why_choose', 'software', 'testimonials', 'faq',
]

export default function HomePage() {
  const { faqs, settings } = useStore()
  const homepage = settings.homepage
  const sections = (homepage?.sections?.length
    ? homepage.sections
    : DEFAULT_ORDER.map((id, index) => ({ id, enabled: true, sort_order: index + 1 })))
    .filter((section) => section.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)

  const heading = (id: string, fallback: { eyebrow: string; title: string; subtitle: string }) =>
    homepage?.headings?.[id] ?? fallback

  const renderSection = (id: HomepageSectionId) => {
    switch (id) {
      case 'hero':
        return <Hero />
      case 'categories':
        return <CategoryGrid />
      case 'best_selling': {
        const h = heading(id, { eyebrow: 'Best Selling', title: 'What everyone is buying', subtitle: 'The most requested subscriptions this month — restocked daily.' })
        return <ProductRail eyebrow={h.eyebrow} title={h.title} subtitle={h.subtitle} query={{ sort: 'popular' }} viewAllTo="/products?sort=popular" />
      }
      case 'ott': {
        const h = heading(id, { eyebrow: 'Popular OTT Platforms', title: 'Streaming worth paying for', subtitle: 'Private profiles on genuine Premium plans, delivered in minutes.' })
        return <ProductRail eyebrow={h.eyebrow} title={h.title} subtitle={h.subtitle} query={{ categorySlug: 'ott-subscriptions', sort: 'popular' }} viewAllTo="/category/ott-subscriptions" />
      }
      case 'ai': {
        const h = heading(id, { eyebrow: 'Trending AI Tools', title: 'Work smarter with premium AI', subtitle: 'ChatGPT Plus, Claude Pro and friends — activated on private accounts.' })
        return <ProductRail eyebrow={h.eyebrow} title={h.title} subtitle={h.subtitle} query={{ categorySlug: 'ai-premium-tools', sort: 'popular' }} viewAllTo="/category/ai-premium-tools" />
      }
      case 'education': {
        const h = heading(id, { eyebrow: 'Educational Subscriptions', title: 'Invest in skills that pay', subtitle: 'Certificates from Coursera, Udemy, LinkedIn Learning and more.' })
        return <ProductRail eyebrow={h.eyebrow} title={h.title} subtitle={h.subtitle} query={{ categorySlug: 'educational-subscriptions' }} viewAllTo="/category/educational-subscriptions" />
      }
      case 'offers':
        return <OffersStrip />
      case 'why_choose':
        return <WhyChoose />
      case 'software': {
        const h = heading(id, { eyebrow: 'Software & Productivity', title: 'Tools that get work done', subtitle: 'Microsoft 365, Canva Pro, Adobe and the rest of your toolkit.' })
        return <ProductRail eyebrow={h.eyebrow} title={h.title} subtitle={h.subtitle} query={{ categorySlug: 'software-productivity', sort: 'popular' }} viewAllTo="/category/software-productivity" />
      }
      case 'testimonials':
        return <Testimonials />
      case 'faq':
        return faqs.length > 0 ? (
          <section className="nx-section" aria-labelledby="home-faq">
            <div className="nx-container max-w-3xl">
              <SectionHead align="center" eyebrow="FAQ" title={<span id="home-faq">Questions, answered</span>} subtitle="Everything about delivery, payments and warranties." />
              <FaqAccordion faqs={faqs.slice(0, 6)} />
            </div>
          </section>
        ) : null
      default:
        return null
    }
  }

  return (
    <>
      {sections.map((section) => (
        <Fragment key={section.id}>{renderSection(section.id)}</Fragment>
      ))}
    </>
  )
}
