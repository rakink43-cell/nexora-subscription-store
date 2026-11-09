import { Check, Circle, X } from 'lucide-react'
import type { OrderStatus, StatusEvent } from '../../types'
import { ORDER_FLOW, ORDER_STATUS_META, cn, formatDateTime } from '../../lib/utils'

export function StatusTimeline({
  status,
  history = [],
}: {
  status: OrderStatus
  history?: StatusEvent[]
}) {
  const isTerminalBad = status === 'cancelled' || status === 'refunded'
  const currentStep = ORDER_STATUS_META[status].step

  const eventFor = (s: OrderStatus) =>
    [...history].reverse().find((h) => h.status === s)

  return (
    <div>
      {isTerminalBad ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-4">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rose-500/20 text-rose-300">
            <X className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-white">{ORDER_STATUS_META[status].label}</p>
            <p className="mt-0.5 text-[12px] text-white/50">{ORDER_STATUS_META[status].description}</p>
          </div>
        </div>
      ) : (
        <ol className="relative space-y-0">
          {ORDER_FLOW.map((step, i) => {
            const done = currentStep > i
            const active = currentStep === i
            const event = eventFor(step)
            const meta = ORDER_STATUS_META[step]
            const isLast = i === ORDER_FLOW.length - 1
            return (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && (
                  <span
                    className={cn(
                      'absolute left-[11px] top-6 h-full w-0.5',
                      done ? 'bg-emerald-500/40' : 'bg-white/8',
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition',
                    done
                      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                      : active
                        ? 'border-[#008CFF] bg-[#008CFF]/20 text-[#6EC1FF] ring-4 ring-[#008CFF]/10'
                        : 'border-white/12 bg-white/[0.03] text-white/25',
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : active ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#008CFF]" />
                  ) : (
                    <Circle className="h-2 w-2" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-[13px] font-semibold',
                      done || active ? 'text-white' : 'text-white/35',
                    )}
                  >
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/40">
                    {active ? meta.description : event?.note ?? ''}
                  </p>
                  {event?.created_at && (done || active) && (
                    <p className="mt-1 text-[10.5px] text-white/25">{formatDateTime(event.created_at)}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
