import { useStore } from '../context/SettingsContext'
import { Hero } from '../components/home/Hero'
import { CategoryGrid } from '../components/home/CategoryGrid'
import { ProductRail } from '../components/home/ProductRail'
import { OffersStrip } from '../components/home/OffersStrip'
import { WhyChoose } from '../components/home/WhyChoose'
import { Testimonials } from '../components/home/Testimonials'
import { FaqAccordion } from '../components/home/FaqAccordion'
import { SectionHead } from '../components/ui'

export default function HomePage() {
  const { faqs } = useStore()

  return (
    <>
      <Hero />
      <CategoryGrid />

      <ProductRail
        eyebrow="Best Selling"
        title="What everyone is buying"
        subtitle="The most requested subscriptions this month — restocked daily."
        query={{ sort: 'popular' }}
        viewAllTo="/products?sort=popular"
      />

      <ProductRail
        eyebrow="Popular OTT Platforms"
        title="Streaming worth paying for"
        subtitle="Private profiles on genuine Premium plans, delivered in minutes."
        query={{ categorySlug: 'ott-subscriptions', sort: 'popular' }}
        viewAllTo="/category/ott-subscriptions"
      />

      <ProductRail
        eyebrow="Trending AI Tools"
        title="Work smarter with premium AI"
        subtitle="ChatGPT Plus, Claude Pro and friends — activated on private accounts."
        query={{ categorySlug: 'ai-premium-tools', sort: 'popular' }}
        viewAllTo="/category/ai-premium-tools"
      />

      <ProductRail
        eyebrow="Educational Subscriptions"
        title="Invest in skills that pay"
        subtitle="Certificates from Coursera, Udemy, LinkedIn Learning and more."
        query={{ categorySlug: 'educational-subscriptions' }}
        viewAllTo="/category/educational-subscriptions"
      />

      <OffersStrip />
      <WhyChoose />

      <ProductRail
        eyebrow="Software & Productivity"
        title="Tools that get work done"
        subtitle="Microsoft 365, Canva Pro, Adobe and the rest of your toolkit."
        query={{ categorySlug: 'software-productivity', sort: 'popular' }}
        viewAllTo="/category/software-productivity"
      />

      <Testimonials />

      {faqs.length > 0 && (
        <section className="nx-section" aria-labelledby="home-faq">
          <div className="nx-container max-w-3xl">
            <SectionHead
              align="center"
              eyebrow="FAQ"
              title={<span id="home-faq">Questions, answered</span>}
              subtitle="Everything about delivery, payments and warranties."
            />
            <FaqAccordion faqs={faqs.slice(0, 6)} />
          </div>
        </section>
      )}
    </>
  )
}
