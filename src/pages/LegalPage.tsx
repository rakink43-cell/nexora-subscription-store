import { useStore } from '../context/SettingsContext'
import { ButtonLink } from '../components/ui'

type Kind = 'privacy' | 'terms' | 'refund'

interface Section {
  heading: string
  body: string[]
}

const CONTENT: Record<Kind, { title: string; intro: string; sections: Section[] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'NEXORA only collects the information we need to deliver a digital subscription and support you afterwards. We do not sell customer data, and we never ask for your bank PIN, OTP or card credentials.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Account data: your name, email address, mobile number, city and delivery address if you provide one.',
          'Order data: the products you bought, order totals, payment method, transaction IDs and any screenshots you upload as payment proof.',
          'Technical data: anonymous, aggregated page-view events used to improve the store. These carry no personal identifiers.',
          'Support data: the messages you send through our contact form, WhatsApp or email.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To create your order, verify your manual payment and deliver access details to your email and dashboard.',
          'To answer support requests, process replacements or refunds, and keep an audit trail of payment verification.',
          'To send transactional notifications about your order status. We do not send marketing messages without your consent.',
        ],
      },
      {
        heading: 'Payment information',
        body: [
          'We never see or store your bKash/Nagad PIN, OTP or bank credentials. We only record the transaction ID and the number you paid from, so we can match your payment to your order.',
          'Payment proofs you upload are stored in a private storage bucket and are visible only to you and authorised NEXORA administrators.',
        ],
      },
      {
        heading: 'Who can see your data',
        body: [
          'You can see your own orders, payments and profile — and only your own. This is enforced at the database level with row-level security, not just in the interface.',
          'Our administrators can see order and payment records to verify transactions and deliver orders. Access is logged.',
          'Our infrastructure providers (Supabase for database, authentication and storage; Cloudflare Pages for hosting) process data on our behalf.',
        ],
      },
      {
        heading: 'Data retention & your rights',
        body: [
          'Order and payment records are kept for accounting and dispute resolution. Account data is kept while your account is active.',
          'You may ask us to correct, export or delete your personal data at any time by contacting support. Identity verification may be required before we act on a request.',
        ],
      },
      {
        heading: 'Cookies & local storage',
        body: [
          'We use browser local storage for your cart, your session and (for guest checkout) a private order-access token. We do not use third-party advertising cookies.',
        ],
      },
    ],
  },

  terms: {
    title: 'Terms & Conditions',
    intro:
      'By placing an order with NEXORA you agree to these terms. They are written to be readable — if anything is unclear, ask us before you pay.',
    sections: [
      {
        heading: '1. Who we are',
        body: [
          'NEXORA is an independent reseller of digital subscriptions operating from Dhaka, Bangladesh. We are not affiliated with, endorsed by, or acting as an agent of Netflix, OpenAI, Microsoft, Google, Spotify or any other platform named on this site. All trademarks belong to their respective owners.',
        ],
      },
      {
        heading: '2. Orders and pricing',
        body: [
          'All prices are in Bangladeshi Taka (BDT) and include the discount shown at the time of purchase.',
          'Your order is created as "Pending Payment". It only becomes active after you submit a valid transaction ID and our team verifies it. Orders are never marked paid automatically.',
          'We may cancel and refund an order if a product becomes unavailable after purchase, if the price was listed in error, or if we suspect fraudulent activity.',
        ],
      },
      {
        heading: '3. Delivery',
        body: [
          'Delivery times shown on each product page are estimates based on normal operation, during support hours (10:00 AM – 11:00 PM BST).',
          'You are responsible for providing a correct email address and phone number. We are not liable for delivery failures caused by incorrect contact details.',
        ],
      },
      {
        heading: '4. Acceptable use',
        body: [
          'Subscriptions are for personal use by the purchasing customer unless a reseller agreement is in place.',
          'You may not resell, sub-license, publicly share or attempt to extract credentials from any account we provide. Accounts found to be abused may be suspended without refund.',
          'You may not use our store to purchase subscriptions for illegal purposes or in violation of the platform\'s own terms of service.',
        ],
      },
      {
        heading: '5. Warranty and replacement',
        body: [
          'Every subscription carries a 30-day replacement warranty from the delivery date. If access stops working for reasons within our control, we repair or replace it within 24 hours of being notified.',
          'The warranty does not cover user-caused issues such as changing account credentials, violating the platform\'s terms, or device incompatibility.',
        ],
      },
      {
        heading: '6. Limitation of liability',
        body: [
          'Our liability for any order is limited to the amount you paid for that order. We are not liable for indirect losses, including lost income or data, arising from a service interruption.',
        ],
      },
      {
        heading: '7. Changes to these terms',
        body: [
          'We may update these terms as our service evolves. The version in force is always the one published on this page at the time of your order.',
        ],
      },
    ],
  },

  refund: {
    title: 'Refund Policy',
    intro:
      'We would rather fix a problem than keep your money. This policy explains exactly when a refund applies and how fast you get it.',
    sections: [
      {
        heading: 'Full refund — no questions',
        body: [
          'You have not received delivery within 24 hours of a verified payment and we cannot deliver within a further 12 hours.',
          'The product you received is materially different from what the product page described.',
          'Your payment was verified but the subscription became unavailable before delivery.',
        ],
      },
      {
        heading: 'Replacement first, then refund',
        body: [
          'If your subscription stops working within the 30-day warranty period, we will repair or replace it within 24 hours of being notified.',
          'If we cannot restore or replace it within 72 hours, you may choose a full refund instead.',
        ],
      },
      {
        heading: 'When refunds do not apply',
        body: [
          'A delivered subscription that works as described — digital goods cannot be "returned" once access details have been handed over.',
          'Issues caused by you changing the account email, password or profile in a way that breaks access.',
          'Accounts suspended by the platform for violating its own terms of service.',
          'Change of mind after successful delivery.',
        ],
      },
      {
        heading: 'How to request a refund',
        body: [
          'Message us on WhatsApp or open a support ticket with your order number and a short description of the issue.',
          'We may ask for a screenshot showing the problem — this speeds things up considerably.',
          'Approved refunds are sent back to the original bKash/Nagad number or bank account, normally within 24–72 hours.',
        ],
      },
      {
        heading: 'Chargebacks & disputes',
        body: [
          'Because payments are made manually, please contact us before raising a dispute with your bank or mobile wallet. We resolve the overwhelming majority of issues within a day, and a dispute filed without contacting us may delay your resolution.',
        ],
      },
    ],
  },
}

export default function LegalPage({ kind }: { kind: Kind }) {
  const { settings } = useStore()
  const content = CONTENT[kind]

  return (
    <div className="nx-container py-12">
      <div className="mx-auto max-w-3xl">
        <span className="nx-eyebrow">Legal</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{content.title}</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/55">{content.intro}</p>
        <p className="mt-2 text-[11.5px] text-white/30">
          Last updated: {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>

        <div className="mt-8 space-y-6">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-[16px] font-bold text-white">{section.heading}</h2>
              <ul className="mt-2 space-y-2">
                {section.body.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13px] leading-relaxed text-white/55"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#008CFF]" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-9 rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="font-display text-[15px] font-bold text-white">Questions about this policy?</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/45">
            Email <a href={`mailto:${settings.contact.email}`} className="text-[#6EC1FF] hover:underline">{settings.contact.email}</a>{' '}
            or call {settings.contact.phone}. Support hours: {settings.contact.hours}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink to="/contact" size="sm">Contact support</ButtonLink>
            <ButtonLink to="/faq" size="sm" variant="ghost">Read the FAQ</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  )
}
