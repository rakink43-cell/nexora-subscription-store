import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Mail, PackageSearch, Search } from 'lucide-react'
import { api } from '../lib/api'
import { getOrderToken, listOrderNumbers, saveOrderToken } from '../lib/orderTokens'
import { useAuth } from '../context/AuthContext'
import { Button, EmptyState, ErrorNote, Field, Input } from '../components/ui'
import { isEmail } from '../lib/utils'

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') ?? '')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const recent = listOrderNumbers().slice(-4).reverse()

  useEffect(() => {
    if (user?.email) setEmail((e) => e || (user.email ?? ''))
  }, [user])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const number = orderNumber.trim().toUpperCase()
    if (!number) {
      setError('Enter your NEXORA order number, for example NX-261105-10001.')
      return
    }

    // 1) Fast path: this browser already holds the order's access token.
    if (getOrderToken(number)) {
      navigate(`/order/${number}`)
      return
    }

    // 2) Signed-in customers see their own orders via RLS.
    if (user) {
      try {
        await api.orders.get(number, null)
        navigate(`/order/${number}`)
        return
      } catch {
        /* fall through to email lookup */
      }
    }

    // 3) Guest lookup by order number + email
    if (!isEmail(email)) {
      setError(
        'For security, enter the email address used on the order (or open this page on the device you ordered from).',
      )
      return
    }

    setLoading(true)
    try {
      const result = await api.orders.get(number, null)
      // Not reachable without a token unless signed in; handled by catch below.
      saveOrderToken(number, '')
      navigate(`/order/${number}`)
      void result
    } catch {
      // ask the data layer for the guest claim path
      try {
        const claimed = await api.orders.claim(number, email)
        if (claimed.ok) {
          setNotice(`${claimed.message} Opening your order…`)
          window.setTimeout(() => navigate(`/order/${number}`), 900)
        } else {
          setError(
            'We could not match that order with this email. Double-check both, or contact support on WhatsApp.',
          )
        }
      } catch (claimError) {
        setError(
          claimError instanceof Error
            ? claimError.message
            : 'We could not find that order. Please contact support.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nx-container py-12">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#008CFF]/25 to-[#F00016]/10 text-[#6EC1FF]">
            <PackageSearch className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">Track your order</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            Enter your order number to see live status, payment verification and delivery progress.
          </p>
        </div>

        <form onSubmit={submit} className="nx-card mt-7 space-y-3.5 p-5">
          <Field label="Order number" required htmlFor="order">
            <Input
              id="order"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="NX-261105-10001"
              className="font-mono"
              autoComplete="off"
            />
          </Field>
          <Field
            label={user ? 'Email on the order' : 'Email address'}
            hint="Used only to confirm the order belongs to you"
            htmlFor="email"
          >
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          {error && <ErrorNote message={error} />}
          {notice && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[12px] text-emerald-300">
              {notice}
            </p>
          )}

          <Button type="submit" loading={loading} className="w-full" icon={<Search className="h-4 w-4" />}>
            Track order
          </Button>
        </form>

        {recent.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              Recent orders on this device
            </p>
            <div className="space-y-1.5">
              {recent.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => navigate(`/order/${num}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[12.5px] text-white/70 transition hover:border-[#008CFF]/40 hover:text-white"
                >
                  <span className="font-mono">{num}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-6 rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center">
            <Mail className="mx-auto h-4 w-4 text-white/30" aria-hidden />
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
              Create a free account and every order is saved automatically — no order numbers to remember.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/register')}>
                Create account
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </div>
          </div>
        )}

        {recent.length === 0 && !user && (
          <div className="mt-6">
            <EmptyState
              icon={<PackageSearch className="h-5 w-5" />}
              title="No orders on this device yet"
              description="Once you place an order, it will appear here for quick access."
            />
          </div>
        )}
      </div>
    </div>
  )
}
