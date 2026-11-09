import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui'

export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-[12.5px] text-white/45">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

export function AdminCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('rounded-xl border border-white/8 bg-[#080D18]', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
          <div>
            {title && <h2 className="text-[13.5px] font-semibold text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-[11.5px] text-white/40">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatTile({
  label,
  value,
  icon,
  hint,
  accent = 'blue',
  loading,
}: {
  label: string
  value: string
  icon: ReactNode
  hint?: string
  accent?: 'blue' | 'red' | 'emerald' | 'amber' | 'violet'
  loading?: boolean
}) {
  const accents = {
    blue: 'border-[#008CFF]/25 bg-[#008CFF]/10 text-[#6EC1FF]',
    red: 'border-[#F00016]/25 bg-[#F00016]/10 text-[#FF6B78]',
    emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    violet: 'border-violet-500/25 bg-violet-500/10 text-violet-400',
  }[accent]

  return (
    <div className="rounded-xl border border-white/8 bg-[#080D18] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-6 w-20" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold text-white">{value}</p>
          )}
          {hint && <p className="mt-0.5 truncate text-[10.5px] text-white/35">{hint}</p>}
        </div>
        <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', accents)}>{icon}</span>
      </div>
    </div>
  )
}

export function AdminTable({
  head,
  children,
  empty,
}: {
  head: string[]
  children: ReactNode
  empty?: boolean
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/8">
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/35 first:pl-0 last:pr-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-2.5 py-10 text-center text-[12.5px] text-white/35">
                Nothing to show yet.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}

export function SalesChart({ data }: { data: { day: string; total: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map((d) => Number(d.total)), 1)

  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {data.map((point) => {
          const height = Math.max(3, (Number(point.total) / max) * 100)
          return (
            <div key={point.day} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-gradient-to-t from-[#008CFF]/30 to-[#008CFF] transition group-hover:from-[#008CFF]/50 group-hover:to-[#4FAEFF]"
                style={{ height: `${height}%` }}
              />
              <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-black/90 px-1.5 py-1 text-[10px] text-white group-hover:block">
                ৳{Number(point.total).toLocaleString()}
                <span className="ml-1 text-white/40">
                  {new Date(point.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[9.5px] text-white/25">
        <span>{new Date(data[0].day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
        <span>Last 14 days</span>
        <span>
          {new Date(data[data.length - 1].day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
