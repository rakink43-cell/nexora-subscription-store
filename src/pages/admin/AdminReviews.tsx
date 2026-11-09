import { useEffect, useState } from 'react'
import { Check, EyeOff, Star } from 'lucide-react'
import { api } from '../../lib/api'
import { AdminCard, AdminHeader } from '../../components/admin/AdminUI'
import { Badge, Button, ErrorNote, Rating, Skeleton } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useStore } from '../../context/SettingsContext'
import { formatDate, initials } from '../../lib/utils'
import type { Review } from '../../types'

export default function AdminReviews() {
  const toast = useToast()
  const { reload } = useStore()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    api.admin
      .reviews()
      .then(setReviews)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load reviews.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const toggle = async (review: Review) => {
    setBusy(review.id)
    try {
      await api.admin.setReviewApproval(review.id, !review.is_approved)
      toast.success(review.is_approved ? 'Review hidden' : 'Review approved')
      load()
      await reload()
    } catch (err) {
      toast.error('Action failed', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const pending = reviews.filter((r) => !r.is_approved).length

  return (
    <div>
      <AdminHeader
        title="Reviews"
        description="Moderate the testimonials shown on the homepage. Only approved reviews are public."
        action={
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/60">
            <Star className="h-3.5 w-3.5" aria-hidden />
            {reviews.length} total · {pending} pending
          </span>
        }
      />

      {error && <ErrorNote message={error} className="mb-4" />}

      {loading ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <AdminCard>
          <div className="py-12 text-center">
            <Star className="mx-auto h-7 w-7 text-white/20" aria-hidden />
            <p className="mt-2 text-[13px] text-white/50">No reviews yet</p>
          </div>
        </AdminCard>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {reviews.map((r) => (
            <article key={r.id} className="rounded-xl border border-white/8 bg-[#080D18] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#008CFF] to-[#F00016] text-[10px] font-bold text-white">
                    {initials(r.customer_name)}
                  </span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-white">{r.customer_name}</p>
                    <p className="text-[10px] text-white/35">
                      {r.customer_city} · {formatDate(r.created_at)}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    r.is_approved
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  }
                >
                  {r.is_approved ? 'Published' : 'Pending'}
                </Badge>
              </div>

              <div className="mt-2">
                <Rating value={r.rating} showValue={false} />
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">“{r.comment}”</p>

              <Button
                size="sm"
                variant={r.is_approved ? 'ghost' : 'outline'}
                className="mt-3 w-full py-1.5 text-[11.5px]"
                loading={busy === r.id}
                onClick={() => void toggle(r)}
                icon={r.is_approved ? <EyeOff className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              >
                {r.is_approved ? 'Hide from site' : 'Approve & publish'}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
